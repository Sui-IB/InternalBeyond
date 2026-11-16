/*
 * RF-01 控制台：把核心逻辑、仿真画面、串口、语音和界面接到一起。
 */
(function (root) {
  'use strict';
  var RF = root.RF;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ───────────────────────── 本地存储（只在本机浏览器里） ─────────────────────────
  var store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 隐私模式下可能写不进去 */ } }
  };
  var DEFAULT_SETTINGS = {
    provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: RF.DEFAULT_MODEL, apiKey: '',
    system: RF.DEFAULT_SYSTEM_PROMPT,
    tts: 'browser', lang: 'zh-CN', ttsBase: '', ttsKey: '', ttsModel: 'tts-1', ttsVoice: 'alloy',
    cam: 'pointer', idle: true, speak: true,
    visionUrl: RF.VISION_DEFAULTS.visionUrl, wasmUrl: RF.VISION_DEFAULTS.wasmUrl, modelUrl: RF.VISION_DEFAULTS.modelUrl
  };
  var settings = Object.assign({}, DEFAULT_SETTINGS, store.get('rf01.settings', {}));
  function saveSettings() { store.set('rf01.settings', settings); }

  // ───────────────────────── 核心对象 ─────────────────────────
  var controller = new RF.FaceController({ calibration: store.get('rf01.cal', null), idle: settings.idle });
  var sim = new RF.Sim($('face'));
  var audio = new RF.AudioEngine();
  var darkQuery = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;

  var state = {
    emotion: 'neutral', intensity: 1,
    manual: false, manualPose: RF.neutralPose(),
    speaking: null,          // 当前在念的一句：{ mode, env, t0, handle }
    speechQueue: [],
    chatAbort: null,
    history: [],
    listening: null,
    camera: null,
    liveCal: null            // 校准页正在试动的通道 id
  };

  // ───────────────────────── 提示 ─────────────────────────
  var msgTimer = 0;
  function stageMsg(text, ms) {
    var m = $('stageMsg');
    clearTimeout(msgTimer);
    if (!text) { m.hidden = true; return; }
    m.textContent = text; m.hidden = false;
    if (ms !== 0) msgTimer = setTimeout(function () { m.hidden = true; }, ms || 6000);
  }

  // ───────────────────────── 标签页 ─────────────────────────
  var tabs = document.querySelectorAll('.tab');
  function showTab(name) {
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].dataset.tab === name;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      var page = $('page-' + tabs[i].dataset.tab);
      page.classList.toggle('is-active', on);
      page.hidden = !on;
    }
    if (name !== 'cal') stopLiveCal();      // 离开校准页就停止试动
  }
  for (var ti = 0; ti < tabs.length; ti++) tabs[ti].addEventListener('click', function () { showTab(this.dataset.tab); });

  // ───────────────────────── 表情 ─────────────────────────
  function applyEmotion(name, hold) {
    state.emotion = RF.EMOTIONS[name] ? name : 'neutral';
    controller.setEmotion(state.emotion, state.intensity, hold);
    $('emoNow').textContent = RF.EMOTION_LABELS[state.emotion] || state.emotion;
    var btns = $('emoGrid').children;
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('is-on', btns[i].dataset.emo === state.emotion);
  }
  RF.EMOTION_NAMES.forEach(function (name) {
    var b = el('button', 'btn', RF.EMOTION_LABELS[name] || name);
    b.type = 'button'; b.dataset.emo = name;
    b.addEventListener('click', function () { applyEmotion(name); });
    $('emoGrid').appendChild(b);
  });
  $('emoIntensity').addEventListener('input', function () {
    state.intensity = this.value / 100;
    $('emoIntensityOut').textContent = this.value + '%';
    controller.setEmotion(state.emotion, state.intensity);
  });

  // 手动滑块
  var manualInputs = {};
  RF.CHANNELS.forEach(function (c) {
    var row = el('div', 'slider-row');
    var lab = el('label', '', c.label); lab.htmlFor = 'man-' + c.id;
    var inp = el('input'); inp.type = 'range'; inp.id = 'man-' + c.id;
    inp.min = c.pose_min; inp.max = c.pose_max; inp.step = 0.01; inp.value = 0;
    var out = el('output', '', '0.00');
    inp.addEventListener('input', function () {
      state.manualPose[c.id] = Number(inp.value);
      out.textContent = Number(inp.value).toFixed(2);
      if (!state.manual) { $('manualToggle').checked = true; setManual(true); }
      else controller.setManual(state.manualPose);
    });
    manualInputs[c.id] = { inp: inp, out: out };
    row.appendChild(lab); row.appendChild(inp); row.appendChild(out);
    $('manualSliders').appendChild(row);
  });
  function setManual(on) {
    state.manual = on;
    $('manualSliders').classList.toggle('is-off', !on);
    controller.setManual(on ? state.manualPose : null);
    updateGazeChip();
  }
  $('manualToggle').addEventListener('change', function () { setManual(this.checked); });
  $('manualZero').addEventListener('click', function () {
    state.manualPose = RF.neutralPose();
    RF.CHANNEL_IDS.forEach(function (id) { manualInputs[id].inp.value = 0; manualInputs[id].out.textContent = '0.00'; });
    if (state.manual) controller.setManual(state.manualPose);
  });
  setManual(false);

  // ───────────────────────── 校准 ─────────────────────────
  var calUi = {};
  function calMsg(text, isErr) {
    var m = $('calMsg');
    m.textContent = text; m.hidden = !text;
    m.style.color = isErr ? 'var(--danger)' : '';
  }
  function saveCal() { store.set('rf01.cal', controller.cal); }
  function stopLiveCal() {
    if (!state.liveCal) return;
    controller.setUsOverride(state.liveCal, null);
    if (calUi[state.liveCal]) { calUi[state.liveCal].card.classList.remove('is-live'); calUi[state.liveCal].stop.hidden = true; }
    state.liveCal = null;
  }
  function buildCal() {
    var list = $('calList');
    list.textContent = '';
    calUi = {};
    RF.CHANNELS.forEach(function (c) {
      var k = controller.cal[c.id];
      var card = el('div', 'cal-card');
      var head = el('div', 'cal-head');
      head.appendChild(el('b', '', c.label));
      head.appendChild(el('span', '', '通道 ' + c.pca + ' · ' + c.id));
      card.appendChild(head);

      var live = el('div', 'cal-live');
      var slider = el('input'); slider.type = 'range'; slider.min = RF.PWM.hard_min_us; slider.max = RF.PWM.hard_max_us; slider.step = 5;
      slider.value = k.us_neutral; slider.setAttribute('aria-label', c.label + ' 试动脉宽');
      var out = el('output', '', k.us_neutral + ' µs');
      var stop = el('button', 'btn', '停止试动'); stop.type = 'button'; stop.hidden = true;
      slider.addEventListener('input', function () {
        if (state.liveCal && state.liveCal !== c.id) stopLiveCal();
        state.liveCal = c.id;
        controller.setUsOverride(c.id, Number(slider.value));
        out.textContent = slider.value + ' µs';
        card.classList.add('is-live'); stop.hidden = false;
      });
      stop.addEventListener('click', stopLiveCal);
      live.appendChild(slider); live.appendChild(out); live.appendChild(stop);
      card.appendChild(live);

      var pts = el('div', 'cal-pts');
      var inputs = {};
      [['us_min', '最小（' + c.pose_min + '）'], ['us_neutral', '中位（0）'], ['us_max', '最大（' + c.pose_max + '）']].forEach(function (def) {
        var key = def[0];
        var na = key === 'us_min' && c.pose_min === 0;      // 没有负半程的通道，最小 = 中位
        var pt = el('label', 'cal-pt' + (na ? ' is-na' : ''));
        pt.appendChild(el('span', '', na ? '最小（同中位）' : def[1]));
        var row = el('div', 'row');
        var inp = el('input'); inp.type = 'number'; inp.min = RF.PWM.hard_min_us; inp.max = RF.PWM.hard_max_us; inp.step = 5;
        inp.value = k[key]; inp.disabled = na;
        var take = el('button', 'btn', '取当前'); take.type = 'button'; take.disabled = na;
        function commit(v) {
          v = Math.round(Number(v));
          if (!(v >= RF.PWM.hard_min_us && v <= RF.PWM.hard_max_us)) { inp.value = controller.cal[c.id][key]; calMsg('脉宽必须在 500–2500 µs 之间。', true); return; }
          var next = JSON.parse(JSON.stringify(controller.cal));
          next[c.id][key] = v;
          controller.setCalibration(next);
          saveCal();
          inp.value = controller.cal[c.id][key];
          if (inputs.us_min && c.pose_min === 0) inputs.us_min.value = controller.cal[c.id].us_min;
          calMsg('');
        }
        inp.addEventListener('change', function () { commit(inp.value); });
        take.addEventListener('click', function () { commit(slider.value); });
        inputs[key] = inp;
        row.appendChild(inp); row.appendChild(take);
        pt.appendChild(row);
        pts.appendChild(pt);
      });
      card.appendChild(pts);
      list.appendChild(card);
      calUi[c.id] = { card: card, slider: slider, out: out, stop: stop };
    });
  }
  buildCal();
  $('calReset').addEventListener('click', function () {
    stopLiveCal();
    controller.setCalibration(null); saveCal(); buildCal();
    calMsg('已恢复默认校准值。');
  });
  $('calExport').addEventListener('click', function () {
    var blob = new Blob([RF.exportCalibration(controller.cal)], { type: 'application/json' });
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'rf01-calibration.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('calImportBtn').addEventListener('click', function () { $('calImport').click(); });
  $('calImport').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    f.text().then(function (txt) {
      stopLiveCal();
      controller.setCalibration(RF.importCalibration(txt)); saveCal(); buildCal();
      calMsg('已导入 ' + f.name + '。');
    }).catch(function (e) { calMsg('导入失败：' + e.message, true); });
  });
  $('calSendLimits').addEventListener('click', function () {
    if (link.state !== 'connected') { calMsg('还没有连接设备。先到“连接”页连上串口。', true); return; }
    RF.limitsFromCalibration(controller.cal, 20).forEach(function (l) { link.send(RF.encodeLimit(l.ch, l.min, l.max)); });
    calMsg('已下发 12 路限位（校准范围两端各放宽 20 µs），结果见“连接”页的日志。');
  });

  // ───────────────────────── 串口 ─────────────────────────
  var logLines = [];
  function log(line) {
    logLines.push(line);
    if (logLines.length > 300) logLines.splice(0, logLines.length - 300);
    var pre = $('serialLog');
    pre.textContent = logLines.join('\n');
    pre.scrollTop = pre.scrollHeight;
  }
  var link = new RF.SerialLink({
    getFrame: function () { return controller.us; },
    onTx: function (t) { log('> ' + t); },
    onLine: function (line, reply) {
      log('< ' + line + (reply.type === 'err' && RF.ERR_TEXT[reply.code] ? '    （' + RF.ERR_TEXT[reply.code] + '）' : ''));
      if (reply.type === 'hello') { $('liFw').textContent = reply.hello.fw + '（协议 RF' + reply.hello.proto + '，' + reply.hello.ch + ' 路，' + reply.hello.hz + ' Hz）'; refreshLink(); }
    },
    onState: function (s, info) {
      if (s === 'disconnected' && info) log('— ' + info);
      if (s === 'connected') log('— 串口已打开，等待握手');
      refreshLink();
    }
  });
  function refreshLink() {
    var on = link.state === 'connected';
    var pill = $('hwStatus');
    pill.className = 'pill ' + (on ? 'pill-live' : 'pill-sim');
    pill.textContent = on ? (link.hello ? '已连接 RF-01 固件 ' + link.hello.fw : '串口已打开，未握手') : '未连接硬件 — 仿真模式';
    $('liState').textContent = link.state === 'connecting' ? '正在打开…' : (on ? (link.hello ? '已连接' : '串口已打开，设备还没有回应握手') : '未连接');
    if (!on) $('liFw').textContent = '—';
    $('connectBtn').textContent = on ? '断开' : '连接串口';
    $('connectBtn').disabled = link.state === 'connecting' || !RF.SerialLink.supported();
    ['releaseBtn', 'wdSend', 'slewSend', 'limitQuery'].forEach(function (id) { $(id).disabled = !on; });
    $('outputToggle').checked = link.outputEnabled;
  }
  $('serialNote').textContent = RF.SerialLink.supported()
    ? '用 USB 线接上 ESP32，点“连接串口”后在弹出的列表里选它。没有硬件也可以先用左边的仿真画面。'
    : '这个浏览器不支持 Web Serial，连不了硬件；请换用电脑上的 Chrome 或 Edge。仿真画面不受影响。';
  $('connectBtn').addEventListener('click', function () {
    if (link.state === 'connected') { link.disconnect(); return; }
    link.outputEnabled = true;
    link.connect().catch(function (e) { log('— ' + e.message); refreshLink(); });
  });
  $('releaseBtn').addEventListener('click', function () { link.releaseAll(); refreshLink(); log('— 已松开全部舵机，并暂停持续输出；重新勾选“持续输出”后恢复。'); });
  $('outputToggle').addEventListener('change', function () { link.outputEnabled = this.checked; });
  $('wdSend').addEventListener('click', function () { link.send(RF.encodeWatchdog($('wdInput').value)); });
  $('slewSend').addEventListener('click', function () { link.send(RF.encodeSlew($('slewInput').value)); });
  $('limitQuery').addEventListener('click', function () { link.send(RF.encodeLimitQuery()); });
  $('logClear').addEventListener('click', function () { logLines = []; $('serialLog').textContent = ''; });
  setInterval(function () { $('liSent').textContent = link.sent; $('liSkip').textContent = link.skipped; }, 500);
  refreshLink();

  // ───────────────────────── 朗读与口型 ─────────────────────────
  function ttsConfig() {
    return { baseUrl: settings.ttsBase, apiKey: settings.ttsKey || settings.apiKey, model: settings.ttsModel, voice: settings.ttsVoice };
  }
  function speakingDone() {
    if (state.speaking) clearTimeout(state.speaking.guard);
    state.speaking = null;
    pumpSpeech();
  }
  /** 取队列里的下一句开始念。队列空了就让表情保持几秒后回到平静。 */
  function pumpSpeech() {
    if (state.speaking) return;
    var item = state.speechQueue.shift();
    if (!item) {
      $('speakNow').hidden = true;
      controller.lipsync.reset();
      if (state.emotion !== 'neutral' && !state.chatAbort) applyEmotionHold();
      return;
    }
    $('speakNow').hidden = false;
    if (item.emotion) applyEmotion(item.emotion);
    var env = RF.textEnvelope(item.text, 1);
    var sp = { mode: 'silent', env: env, t0: performance.now(), handle: null, offset: 0 };
    state.speaking = sp;
    var useVoice = settings.speak;

    if (useVoice && settings.tts === 'api') {
      sp.mode = 'api-wait';
      var ac = new AbortController();
      sp.handle = { cancel: function () { ac.abort(); } };
      RF.Speech.apiFetch(item.text, ttsConfig(), ac.signal).then(function (buf) {
        if (state.speaking !== sp) return null;
        return audio.play(buf);
      }).then(function (p) {
        if (!p || state.speaking !== sp) { if (p) p.stop(); return; }
        sp.mode = 'api';
        sp.handle = { cancel: function () { p.stop(); } };
        return p.done.then(function () { if (state.speaking === sp) speakingDone(); });
      }).catch(function (e) {
        if (state.speaking !== sp) return;
        if (!e || e.name !== 'AbortError') stageMsg((e && e.message) || '语音合成失败', 8000);
        sp.mode = 'silent'; sp.t0 = performance.now(); sp.handle = null;   // 合成失败：这一句改为无声口型
      });
      return;
    }
    if (useVoice && settings.tts === 'browser' && RF.Speech.browserSupported()) {
      sp.mode = 'browser';
      var started = false;
      sp.handle = RF.Speech.browserSpeak(item.text, {
        lang: settings.lang,
        onStart: function () { started = true; sp.t0 = performance.now(); sp.offset = 0; },
        onBoundary: function (ci) { sp.offset = env.timeOfChar(ci); sp.t0 = performance.now(); },   // 用实际念到的位置对齐
        onEnd: function (err) {
          if (state.speaking !== sp) return;
          if (err && !started && err !== 'canceled' && err !== 'interrupted') {
            // 这台电脑念不出来（常见原因：没有装语音包）：这一句改为无声口型，脸照样动
            clearTimeout(sp.guard);
            sp.mode = 'silent'; sp.t0 = performance.now(); sp.offset = 0; sp.handle = null;
            if (!state.ttsWarned) { state.ttsWarned = true; stageMsg('浏览器自带语音不可用（可能没有装语音包），已改为只动嘴不出声。', 8000); }
            return;
          }
          speakingDone();
        }
      });
      // 有些环境（没有装语音包）不会触发 onend，设一个兜底超时
      sp.guard = setTimeout(function () { if (state.speaking === sp) { if (sp.handle) sp.handle.cancel(); speakingDone(); } },
        (env.duration * 1.8 + 2.5) * 1000 + (started ? 0 : 1500));
      return;
    }
    // 不出声：按文字估算的节奏动嘴
    sp.mode = 'silent';
  }
  function applyEmotionHold() { controller.setEmotion(state.emotion, state.intensity, 6); holdWatch(); }
  var holdTimer = 0;
  function holdWatch() {
    clearInterval(holdTimer);
    holdTimer = setInterval(function () {
      if (controller.emotion === 'neutral' && state.emotion !== 'neutral') { clearInterval(holdTimer); applyEmotion('neutral'); }
      else if (controller.holdS <= 0) clearInterval(holdTimer);
    }, 250);
  }
  function stopSpeech() {
    state.speechQueue = [];
    var sp = state.speaking;
    state.speaking = null;
    if (sp) { clearTimeout(sp.guard); if (sp.handle) sp.handle.cancel(); }
    controller.lipsync.reset();
    $('speakNow').hidden = true;
  }
  /** 每帧算一次口型。 */
  function lipFrame(dt) {
    var sp = state.speaking;
    if (!sp) return controller.lipsync.update(dt, 0);
    if (sp.mode === 'api') { var m = audio.ttsLevel(); return controller.lipsync.update(dt, m.level, m.hi); }
    if (sp.mode === 'api-wait') return controller.lipsync.update(dt, 0);
    var t = sp.offset + (performance.now() - sp.t0) / 1000;
    if (sp.mode === 'silent' && t > sp.env.duration + 0.15) { speakingDone(); return controller.lipsync.update(dt, 0); }
    return controller.lipsync.update(dt, sp.env.levelAt(t));
  }

  // ───────────────────────── 对话 ─────────────────────────
  function addMsg(cls, text) {
    $('chatEmpty').hidden = true;
    var m = el('div', 'msg ' + cls, text);
    $('chatLog').appendChild(m);
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
    return m;
  }
  function setBusy(on) {
    $('sendBtn').disabled = on;
    $('stopBtn').hidden = !on;
  }
  async function sendChat(text) {
    text = String(text || '').trim();
    if (!text || state.chatAbort) return;
    addMsg('msg-user', text);
    if (!settings.apiKey) {
      addMsg('msg-note', '还没有填 API Key。到“设置”页填好接口地址、模型和 Key 之后就能聊天了。');
      return;
    }
    stopSpeech();
    audio.ensure().catch(function () { /* 没有音频也能用 */ });
    state.history.push({ role: 'user', content: text });
    if (state.history.length > 24) state.history = state.history.slice(-24);
    while (state.history.length && state.history[0].role !== 'user') state.history.shift();

    var bubble = addMsg('msg-bot', '');
    var emoTag = el('span', 'msg-emo'); emoTag.hidden = true;
    var body = el('span', 'msg-text');
    bubble.appendChild(emoTag); bubble.appendChild(body);

    var parser = new RF.TagStreamParser();
    var splitter = new RF.SentenceSplitter();
    var clean = '', raw = '';
    var pendingEmotion = null, firstEmotion = true;
    function onEvents(events) {
      events.forEach(function (ev) {
        if (ev.type === 'emotion') {
          emoTag.textContent = RF.EMOTION_LABELS[ev.name] || ev.name; emoTag.hidden = false;
          if (firstEmotion) { firstEmotion = false; applyEmotion(ev.name); }   // 第一个标签立刻生效，显得反应快
          pendingEmotion = ev.name;
        } else {
          clean += ev.text;
          body.textContent = clean;
          splitter.feed(ev.text).forEach(queueSentence);
        }
      });
      $('chatLog').scrollTop = $('chatLog').scrollHeight;
    }
    function queueSentence(s) {
      state.speechQueue.push({ text: s, emotion: pendingEmotion });
      pendingEmotion = null;
      pumpSpeech();
    }

    var ac = new AbortController();
    state.chatAbort = ac;
    setBusy(true);
    try {
      var cfg = { provider: settings.provider, baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model };
      var res = await RF.streamChat(cfg, settings.system, state.history.slice(), {
        onText: function (t) { raw += t; onEvents(parser.feed(t)); }
      }, ac.signal);
      onEvents(parser.end());
      splitter.flush().forEach(queueSentence);
      if (pendingEmotion && !state.speaking && !state.speechQueue.length) applyEmotion(pendingEmotion);
      var stopText = RF.describeStop(res.stopReason);
      if (!clean.trim() && !stopText) stopText = '模型没有返回任何文字。';
      if (stopText) addMsg('msg-note', stopText);
      if (!clean.trim()) bubble.remove();
      if (raw.trim()) state.history.push({ role: 'assistant', content: raw });
      else state.history.pop();                    // 没有回复：撤回这一轮，保持 user/assistant 交替
    } catch (e) {
      onEvents(parser.end());
      if (!clean.trim()) bubble.remove();
      if (e && e.name === 'AbortError') {
        addMsg('msg-note', '已停止。');
        if (raw.trim()) state.history.push({ role: 'assistant', content: raw }); else state.history.pop();
      } else {
        addMsg('msg-err', (e && e.message) || '请求失败');
        state.history.pop();
      }
    } finally {
      state.chatAbort = null;
      setBusy(false);
      if (!state.speaking && !state.speechQueue.length && state.emotion !== 'neutral') applyEmotionHold();
    }
  }
  $('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('chatInput').value;
    $('chatInput').value = '';
    sendChat(v);
  });
  $('stopBtn').addEventListener('click', function () { if (state.chatAbort) state.chatAbort.abort(); stopSpeech(); });
  $('clearBtn').addEventListener('click', function () {
    if (state.chatAbort) state.chatAbort.abort();
    stopSpeech();
    state.history = [];
    var logEl = $('chatLog');
    Array.prototype.slice.call(logEl.querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    $('chatEmpty').hidden = false;
    applyEmotion('neutral');
  });
  $('speakToggle').checked = settings.speak;
  $('speakToggle').addEventListener('change', function () {
    settings.speak = this.checked; saveSettings();
    if (!this.checked && state.speaking && state.speaking.mode !== 'silent') stopSpeech();
  });

  // 语音输入
  var micBtn = $('micBtn');
  if (!RF.Speech.recognitionSupported()) {
    micBtn.disabled = true;
    micBtn.title = '这个浏览器不支持语音识别，请直接打字';
  }
  micBtn.addEventListener('click', function () {
    if (state.listening) { state.listening.stop(); return; }
    stopSpeech();                                   // 它在说话时先停下，免得把自己的声音听进去
    try {
      state.listening = RF.Speech.listen({
        lang: settings.lang,
        onPartial: function (t) { $('chatInput').value = t; },
        onFinal: function (t) { $('chatInput').value = ''; sendChat(t); },
        onError: function (msg) { stageMsg(msg); },
        onEnd: function () { state.listening = null; micBtn.setAttribute('aria-pressed', 'false'); }
      });
      micBtn.setAttribute('aria-pressed', 'true');
    } catch (e) { stageMsg(e.message); }
  });

  // ───────────────────────── 注视：指针 / 摄像头 ─────────────────────────
  var pointerIdle = 0;
  function gazeFromPointer(clientX, clientY) {
    var r = $('face').getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
    var span = Math.max(260, Math.min(r.width, r.height) * 0.9);
    controller.setGaze((clientX - cx) / span, -(clientY - cy) / span);
    clearTimeout(pointerIdle);
    pointerIdle = setTimeout(function () { if (settings.cam === 'pointer') controller.setGaze(0, 0); }, 2500);
  }
  root.addEventListener('pointermove', function (e) {
    if (settings.cam !== 'pointer') return;
    if (e.pointerType !== 'mouse' && !e.target.closest('.stage')) return;   // 触屏只在仿真画面上跟随，不影响滚动面板
    gazeFromPointer(e.clientX, e.clientY);
  }, { passive: true });
  function updateGazeChip() {
    var t = { pointer: '注视：跟随指针', track: '注视：摄像头找人脸', mirror: '镜像：模仿你的表情', off: '注视：正前方' }[settings.cam] || '';
    if (state.manual) t = '手动控制中';
    $('gazeNow').textContent = t;
  }
  function stopCamera() {
    if (state.camera) { state.camera.stop(); state.camera = null; }
    $('cam').hidden = true;
    controller.setMirror(null);
  }
  function applyCamMode() {
    updateGazeChip();
    controller.setGaze(0, 0);
    if (settings.cam !== 'track' && settings.cam !== 'mirror') { stopCamera(); return; }
    controller.setMirror(null);
    if (state.camera) return;                       // 两种摄像头模式共用同一个追踪器
    var cam = new RF.CameraTracker({
      video: $('cam'),
      urls: { visionUrl: settings.visionUrl, wasmUrl: settings.wasmUrl, modelUrl: settings.modelUrl },
      onFace: function (f) {
        if (settings.cam === 'mirror') {
          var p = RF.blendshapesToPose(f.blendshapes, { mirror: true });
          // 镜像模式下，头的位置也镜像：你往自己左边移，它朝画面左边（它的右边）看
          p.neck_yaw = -f.x * 0.5; p.neck_pitch = f.y * 0.4;
          controller.setMirror(p);
        } else {
          controller.setMirror(null);
          controller.setGaze(f.x, f.y);
        }
      },
      onLost: function () { if (settings.cam === 'mirror') controller.setMirror(null); else controller.setGaze(0, 0); }
    });
    state.camera = cam;
    $('cam').hidden = false;
    stageMsg('正在打开摄像头并下载人脸模型…', 0);
    cam.start().then(function () { if (state.camera === cam) stageMsg(''); }).catch(function (e) {
      if (state.camera === cam) { stopCamera(); settings.cam = 'pointer'; $('setCam').value = 'pointer'; saveSettings(); updateGazeChip(); }
      stageMsg(e.message, 10000);
    });
  }

  // ───────────────────────── 设置 ─────────────────────────
  var PROVIDER_DEFAULTS = {
    anthropic: { baseUrl: 'https://api.anthropic.com', model: RF.DEFAULT_MODEL },
    openai: { baseUrl: 'https://api.openai.com/v1', model: '' }
  };
  function bind(id, key, onChange) {
    var e = $(id);
    if (e.type === 'checkbox') e.checked = !!settings[key]; else e.value = settings[key] === undefined ? '' : settings[key];
    e.addEventListener('change', function () {
      settings[key] = e.type === 'checkbox' ? e.checked : e.value.trim ? e.value.trim() : e.value;
      saveSettings();
      if (onChange) onChange();
    });
  }
  bind('setProvider', 'provider', function () {
    // 换接口类型时，如果地址和模型还是另一种的默认值，就一起换掉
    var other = settings.provider === 'anthropic' ? PROVIDER_DEFAULTS.openai : PROVIDER_DEFAULTS.anthropic;
    var mine = PROVIDER_DEFAULTS[settings.provider];
    if (!settings.baseUrl || settings.baseUrl === other.baseUrl) { settings.baseUrl = mine.baseUrl; $('setBase').value = mine.baseUrl; }
    if (!settings.model || settings.model === other.model) { settings.model = mine.model; $('setModel').value = mine.model; }
    saveSettings();
  });
  bind('setModel', 'model'); bind('setBase', 'baseUrl'); bind('setKey', 'apiKey');
  $('setSystem').value = settings.system;
  $('setSystem').addEventListener('change', function () { settings.system = this.value; saveSettings(); });
  $('setSystemReset').addEventListener('click', function () { settings.system = RF.DEFAULT_SYSTEM_PROMPT; $('setSystem').value = settings.system; saveSettings(); });
  function refreshTtsBox() { $('ttsApiBox').hidden = settings.tts !== 'api'; }
  bind('setTts', 'tts', function () { stopSpeech(); refreshTtsBox(); });
  bind('setLang', 'lang'); bind('setTtsBase', 'ttsBase'); bind('setTtsKey', 'ttsKey'); bind('setTtsModel', 'ttsModel'); bind('setTtsVoice', 'ttsVoice');
  bind('setCam', 'cam', applyCamMode);
  bind('setVisionUrl', 'visionUrl'); bind('setWasmUrl', 'wasmUrl'); bind('setModelUrl', 'modelUrl');
  bind('setIdle', 'idle', function () { controller.idle = settings.idle; });
  refreshTtsBox();
  if (settings.cam === 'track' || settings.cam === 'mirror') {
    // 摄像头需要用户手势才能打开，刷新页面后退回指针模式
    settings.cam = 'pointer'; $('setCam').value = 'pointer';
  }
  updateGazeChip();

  // ───────────────────────── 主循环 ─────────────────────────
  var last = performance.now();
  function step() {
    var now = performance.now();
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    controller.setLip(lipFrame(dt));
    controller.update(dt);
  }
  function frame() {
    step();
    sim.draw(controller.us, controller.cal, darkQuery && darkQuery.matches ? 'dark' : 'light');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // 页面切到后台时 requestAnimationFrame 会停，用定时器让姿态继续更新，串口那边不至于卡在半个表情上
  setInterval(function () { if (document.hidden) step(); }, 50);
  root.addEventListener('resize', function () { sim.resize(); });
  root.addEventListener('beforeunload', function () { if (link.state === 'connected') link.disconnect(); });

  // 供调试和自动化测试用
  RF.app = { controller: controller, link: link, state: state, settings: settings, sendChat: sendChat, applyEmotion: applyEmotion, showTab: showTab };
})(typeof self !== 'undefined' ? self : this);
