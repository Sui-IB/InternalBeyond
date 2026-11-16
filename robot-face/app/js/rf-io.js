/*
 * RF-01 输入输出：串口、音频、语音合成/识别、摄像头人脸、大模型流式请求。
 * 只在浏览器里用；纯逻辑都在 rf-core.js。
 */
(function (root) {
  'use strict';
  var RF = root.RF = root.RF || {};
  var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  // ═════════════════════════ 串口（Web Serial） ═════════════════════════
  /**
   * opts:
   *   getFrame()   返回当前 16 路脉宽数组；每 20 ms 取一次发给下位机
   *   onLine(text, reply)   收到下位机一行
   *   onTx(text)            发出一条命令（P 帧不上报，太多）
   *   onState(state, info)  'connecting' | 'connected' | 'disconnected'
   */
  function SerialLink(opts) {
    this.opts = opts || {};
    this.port = null; this.writer = null; this.reader = null;
    this.timer = null;
    this.busy = false;             // 上一次写入还没完成
    this.cmdQueue = [];            // 待发的命令（优先于 P 帧）
    this.outputEnabled = true;
    this.sent = 0; this.skipped = 0;
    this.hello = null;
    this.state = 'disconnected';
    this.frameIntervalMs = 20;     // 50 Hz
  }
  SerialLink.supported = function () { return typeof navigator !== 'undefined' && !!navigator.serial; };

  SerialLink.prototype._setState = function (s, info) {
    this.state = s;
    if (this.opts.onState) this.opts.onState(s, info);
  };

  SerialLink.prototype.connect = async function () {
    if (!SerialLink.supported()) throw new Error('这个浏览器不支持 Web Serial，请使用电脑上的 Chrome 或 Edge。');
    if (this.port) return;
    var port;
    try { port = await navigator.serial.requestPort(); }
    catch (e) { throw new Error('没有选择串口。'); }
    this._setState('connecting');
    try { await port.open({ baudRate: 115200 }); }
    catch (e) { this._setState('disconnected'); throw new Error('串口打不开：可能被别的程序（如串口监视器）占用了。'); }
    this.port = port;
    this.writer = port.writable.getWriter();
    this.sent = 0; this.skipped = 0; this.hello = null; this.busy = false; this.cmdQueue = [];
    this._readLoop();
    this._setState('connected');
    this.send(RF.encodeHello());
    var self = this;
    this.timer = setInterval(function () { self._tick(); }, this.frameIntervalMs);
  };

  SerialLink.prototype._readLoop = async function () {
    var port = this.port, self = this;
    var decoder = new TextDecoder();
    var buf = '';
    try {
      this.reader = port.readable.getReader();
      for (;;) {
        var r = await this.reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        var idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (!line) continue;
          var reply = RF.parseReply(line);
          if (reply.type === 'hello') self.hello = reply.hello;
          if (self.opts.onLine) self.opts.onLine(line, reply);
        }
        if (buf.length > 4096) buf = '';            // 对面一直不发换行：丢弃，防止无限增长
      }
    } catch (e) {
      if (self.port === port) self._teardown('串口断开了：' + (e && e.message ? e.message : '读取失败'));
    } finally {
      try { if (this.reader) this.reader.releaseLock(); } catch (e2) { /* 已释放 */ }
      this.reader = null;
    }
  };

  /** 发一条已编码好的命令行（带校验和换行）。命令排队发送，优先于 P 帧。 */
  SerialLink.prototype.send = function (encodedLine) {
    if (!this.writer) return false;
    this.cmdQueue.push(encodedLine);
    if (this.opts.onTx) this.opts.onTx(encodedLine.replace(/\n$/, ''));
    this._pump();
    return true;
  };

  SerialLink.prototype._write = function (text, isFrame) {
    var self = this, writer = this.writer;
    this.busy = true;
    writer.write(enc.encode(text)).then(function () {
      self.busy = false;
      if (isFrame) self.sent++;
      self._pump();
    }, function (e) {
      self.busy = false;
      if (self.writer === writer) self._teardown('串口写入失败：' + (e && e.message ? e.message : '未知原因'));
    });
  };
  SerialLink.prototype._pump = function () {
    if (!this.writer || this.busy || !this.cmdQueue.length) return;
    this._write(this.cmdQueue.shift(), false);
  };

  /** 每 20 ms：上一帧还没写完就跳过这一帧（不堆积），否则发最新姿态。 */
  SerialLink.prototype._tick = function () {
    if (!this.writer) return;
    if (this.cmdQueue.length) { this._pump(); return; }
    if (!this.outputEnabled || !this.opts.getFrame) return;
    var ds = this.writer.desiredSize;
    if (this.busy || (typeof ds === 'number' && ds <= 0)) { this.skipped++; return; }
    this._write(RF.encodeFrame(this.opts.getFrame()), true);
  };

  /** 松开全部舵机，并停止持续输出（否则下一帧又会把舵机顶回去）。 */
  SerialLink.prototype.releaseAll = function () {
    this.outputEnabled = false;
    return this.send(RF.encodeRelease());
  };

  SerialLink.prototype._teardown = function (reason) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var port = this.port, writer = this.writer, reader = this.reader;
    this.port = null; this.writer = null; this.cmdQueue = []; this.busy = false;
    try { if (reader) reader.cancel().catch(function () {}); } catch (e) { /* 忽略 */ }
    try { if (writer) writer.releaseLock(); } catch (e2) { /* 忽略 */ }
    if (port) setTimeout(function () { try { port.close().catch(function () {}); } catch (e3) { /* 忽略 */ } }, 50);
    this._setState('disconnected', reason || '');
  };

  SerialLink.prototype.disconnect = async function () {
    if (!this.port) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var writer = this.writer;
    try {
      // 断开前先让舵机松开，等这条命令写完
      if (writer) await writer.write(enc.encode(RF.encodeRelease()));
    } catch (e) { /* 写不进去也照常断开 */ }
    this._teardown('已断开');
  };

  // ═════════════════════════ 音频 ═════════════════════════
  function AudioEngine() {
    this.ctx = null;
    this.micStream = null; this.micAnalyser = null;
    this.ttsAnalyser = null; this.ttsSource = null;
    this._td = null; this._fd = null;
  }
  AudioEngine.prototype.ensure = async function () {
    if (!this.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('这个浏览器不支持 Web Audio。');
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* 需要用户手势，稍后再试 */ } }
    return this.ctx;
  };
  AudioEngine.prototype._analyser = function () {
    var a = this.ctx.createAnalyser();
    a.fftSize = 1024;
    a.smoothingTimeConstant = 0.5;
    return a;
  };
  /** 读一个 AnalyserNode：返回 { level: 0..1（按分贝映射）, hi: 2 kHz 以上能量占比 0..1 }。 */
  AudioEngine.prototype.measure = function (analyser) {
    if (!analyser) return { level: 0, hi: 0.5 };
    var n = analyser.fftSize;
    if (!this._td || this._td.length !== n) this._td = new Float32Array(n);
    analyser.getFloatTimeDomainData(this._td);
    var sum = 0;
    for (var i = 0; i < n; i++) sum += this._td[i] * this._td[i];
    var rms = Math.sqrt(sum / n);
    var db = rms > 1e-6 ? 20 * Math.log10(rms) : -120;
    var level = RF.clamp((db + 50) / 38, 0, 1);            // -50 dB → 0，-12 dB → 1
    var bins = analyser.frequencyBinCount;
    if (!this._fd || this._fd.length !== bins) this._fd = new Uint8Array(bins);
    analyser.getByteFrequencyData(this._fd);
    var cut = Math.floor(2000 / (this.ctx.sampleRate / 2) * bins), lo = 0, hi = 0;
    for (var k = 1; k < bins; k++) { if (k < cut) lo += this._fd[k]; else hi += this._fd[k]; }
    var ratio = lo + hi > 0 ? hi / (lo + hi) : 0.5;
    return { level: level, hi: RF.clamp(ratio * 2.2, 0, 1) };
  };
  AudioEngine.prototype.micStart = async function () {
    await this.ensure();
    if (this.micStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('这个浏览器拿不到麦克风。');
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    var src = this.ctx.createMediaStreamSource(this.micStream);
    this.micAnalyser = this._analyser();
    src.connect(this.micAnalyser);                         // 不接到扬声器，避免啸叫
  };
  AudioEngine.prototype.micStop = function () {
    if (this.micStream) this.micStream.getTracks().forEach(function (t) { t.stop(); });
    this.micStream = null; this.micAnalyser = null;
  };
  AudioEngine.prototype.micLevel = function () { return this.measure(this.micAnalyser); };
  AudioEngine.prototype.ttsLevel = function () { return this.measure(this.ttsSource ? this.ttsAnalyser : null); };
  /** 播放一段已下载的音频（mp3 / wav…），返回 { done: Promise, stop() }。播放期间 ttsLevel() 有读数。 */
  AudioEngine.prototype.play = async function (arrayBuffer) {
    var ctx = await this.ensure();
    var audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (!this.ttsAnalyser) { this.ttsAnalyser = this._analyser(); this.ttsAnalyser.connect(ctx.destination); }
    var src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.ttsAnalyser);
    var self = this;
    this.ttsSource = src;
    var done = new Promise(function (resolve) {
      src.onended = function () { if (self.ttsSource === src) self.ttsSource = null; resolve(); };
    });
    src.start();
    return { done: done, duration: audio.duration, stop: function () { try { src.stop(); } catch (e) { /* 已停止 */ } } };
  };

  // ═════════════════════════ 语音合成 ═════════════════════════
  function maskKey(s) { return String(s).replace(/\b(sk-[A-Za-z0-9_-]{3})[A-Za-z0-9_-]{6,}/g, '$1…'); }

  var Speech = {};
  Speech.browserSupported = function () { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; };
  /**
   * 浏览器自带语音。拿不到音频采样，所以口型由调用方用 RF.textEnvelope 估算，
   * 这里通过 onBoundary(charIndex) 报告念到第几个字，用来对齐。
   */
  Speech.browserSpeak = function (text, opts) {
    opts = opts || {};
    var u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || 'zh-CN';
    u.rate = opts.rate || 1;
    var voices = speechSynthesis.getVoices();
    var prefix = u.lang.slice(0, 2).toLowerCase();
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf(prefix) === 0) { u.voice = voices[i]; break; }
    }
    var finished = false;
    function finish(err) { if (finished) return; finished = true; if (opts.onEnd) opts.onEnd(err); }
    u.onstart = function () { if (opts.onStart) opts.onStart(); };
    u.onboundary = function (e) { if (opts.onBoundary && typeof e.charIndex === 'number') opts.onBoundary(e.charIndex); };
    u.onend = function () { finish(null); };
    u.onerror = function (e) { finish(e && e.error ? e.error : 'error'); };
    speechSynthesis.speak(u);
    return { cancel: function () { finished = true; try { speechSynthesis.cancel(); } catch (e) { /* 忽略 */ } } };
  };
  /** OpenAI 兼容的语音合成接口：POST {base}/audio/speech，返回音频的 ArrayBuffer。 */
  Speech.apiFetch = async function (text, cfg, signal) {
    var base = String(cfg.baseUrl || '').trim().replace(/\/+$/, '') || 'https://api.openai.com/v1';
    var url = /\/audio\/speech$/.test(base) ? base : base + '/audio/speech';
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + (cfg.apiKey || '') },
        body: JSON.stringify({ model: cfg.model || 'tts-1', voice: cfg.voice || 'alloy', input: text, response_format: 'mp3' }),
        signal: signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('语音接口连不上，请检查地址和网络。');
    }
    if (!resp.ok) {
      var detail = '';
      try { var j = await resp.json(); detail = (j.error && (j.error.message || j.error)) || ''; } catch (e2) { /* 不是 JSON */ }
      throw new Error('语音合成失败：' + RF.describeHttpError(resp.status, maskKey(detail)));
    }
    return await resp.arrayBuffer();
  };

  // ═════════════════════════ 语音识别 ═════════════════════════
  Speech.recognitionSupported = function () { return !!(root.SpeechRecognition || root.webkitSpeechRecognition); };
  /** 开始听一句话。返回 { stop() }。opts: lang, onPartial(text), onFinal(text), onEnd(), onError(说明) */
  Speech.listen = function (opts) {
    var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
    if (!SR) throw new Error('这个浏览器不支持语音识别，请直接打字。');
    var rec = new SR();
    rec.lang = opts.lang || 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = function (e) {
      var finalText = '', partial = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else partial += t;
      }
      if (partial && opts.onPartial) opts.onPartial(partial);
      if (finalText && opts.onFinal) opts.onFinal(finalText);
    };
    rec.onerror = function (e) {
      var map = {
        'not-allowed': '没有麦克风权限。', 'service-not-allowed': '浏览器不允许使用语音识别服务。',
        'network': '语音识别服务连不上（它依赖浏览器厂商的在线服务）。', 'no-speech': '没有听到声音。',
        'audio-capture': '找不到麦克风。'
      };
      if (e.error !== 'aborted' && opts.onError) opts.onError(map[e.error] || ('语音识别出错：' + e.error));
    };
    rec.onend = function () { if (opts.onEnd) opts.onEnd(); };
    rec.start();
    return { stop: function () { try { rec.stop(); } catch (e) { /* 已停止 */ } } };
  };

  // ═════════════════════════ 摄像头人脸（MediaPipe，按需从网络加载） ═════════════════════════
  var VISION_DEFAULTS = {
    visionUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  };
  /**
   * opts: video 元素, urls, onFace({x, y, blendshapes}), onLost()
   * x, y ∈ [-1, 1]：人脸在画面里的位置，已换算成注视目标
   *（摄像头朝前看，画面左侧 = 机器人自己的左侧；y 向上为正）。
   */
  function CameraTracker(opts) {
    this.opts = opts;
    this.stream = null; this.landmarker = null; this.raf = 0; this.running = false; this.lastTime = -1;
  }
  CameraTracker.prototype.start = async function () {
    var o = this.opts, urls = o.urls || VISION_DEFAULTS;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('这个浏览器拿不到摄像头。');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) { throw new Error('摄像头打不开：没有权限或没有设备。'); }
    o.video.srcObject = this.stream;
    try { await o.video.play(); } catch (e2) { /* 自动播放被拦时，用户点一下页面即可 */ }
    try {
      var vision = await import(urls.visionUrl || VISION_DEFAULTS.visionUrl);
      var fileset = await vision.FilesetResolver.forVisionTasks(urls.wasmUrl || VISION_DEFAULTS.wasmUrl);
      this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: urls.modelUrl || VISION_DEFAULTS.modelUrl },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true
      });
    } catch (e3) {
      this.stop();
      throw new Error('人脸模型下载失败（需要能访问 jsdelivr 和 googleapis）。可以在“高级”里换成自己能访问的地址。');
    }
    this.running = true;
    var self = this;
    (function loop() {
      if (!self.running) return;
      self.raf = requestAnimationFrame(loop);
      var v = o.video;
      if (!v.videoWidth || v.currentTime === self.lastTime) return;
      self.lastTime = v.currentTime;
      var res;
      try { res = self.landmarker.detectForVideo(v, performance.now()); } catch (e) { return; }
      var lm = res && res.faceLandmarks && res.faceLandmarks[0];
      if (!lm) { if (o.onLost) o.onLost(); return; }
      var nose = lm[1] || lm[0];
      var bs = {};
      var cats = res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories;
      if (cats) for (var i = 0; i < cats.length; i++) bs[cats[i].categoryName] = cats[i].score;
      if (o.onFace) o.onFace({ x: RF.clamp((0.5 - nose.x) * 2.4, -1, 1), y: RF.clamp((0.5 - nose.y) * 2.4, -1, 1), blendshapes: bs });
    })();
  };
  CameraTracker.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
    this.stream = null;
    if (this.opts.video) this.opts.video.srcObject = null;
    try { if (this.landmarker && this.landmarker.close) this.landmarker.close(); } catch (e) { /* 忽略 */ }
    this.landmarker = null;
  };

  // ═════════════════════════ 大模型流式请求 ═════════════════════════
  /**
   * cfg: { provider: 'anthropic' | 'openai', baseUrl, apiKey, model }
   * handlers.onText(增量文本)
   * 返回 { stopReason }。HTTP 错误、流内错误都以带中文说明的 Error 抛出。
   * API Key 只放进请求头，不写日志、不进错误信息。
   */
  async function streamChat(cfg, system, messages, handlers, signal) {
    var provider = cfg.provider === 'openai' ? 'openai' : 'anthropic';
    var req = provider === 'anthropic' ? RF.buildAnthropicRequest(cfg, system, messages) : RF.buildOpenAIRequest(cfg, system, messages);
    var resp;
    try {
      resp = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('连不上接口：请检查接口地址和网络（有些中转站不允许浏览器直接访问）。');
    }
    if (!resp.ok) {
      var detail = '';
      try {
        var txt = await resp.text();
        try { var j = JSON.parse(txt); detail = (j.error && (j.error.message || j.error.type)) || j.message || ''; }
        catch (e2) { detail = txt.slice(0, 160); }
      } catch (e3) { /* 读不到正文 */ }
      throw new Error(RF.describeHttpError(resp.status, maskKey(detail)));
    }
    if (!resp.body) throw new Error('接口没有返回流式数据。');
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var sse = new RF.SSEParser();
    var stopReason = '';
    function handle(events) {
      for (var i = 0; i < events.length; i++) {
        var d = RF.interpretSSE(provider, events[i]);
        if (!d) continue;
        if (d.error) throw new Error('接口返回错误：' + maskKey(d.error));
        if (d.text && handlers && handlers.onText) handlers.onText(d.text);
        if (d.stop) stopReason = d.stop;
      }
    }
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      handle(sse.feed(decoder.decode(r.value, { stream: true })));
    }
    handle(sse.feed(decoder.decode()));
    handle(sse.end());
    return { stopReason: stopReason };
  }

  RF.SerialLink = SerialLink;
  RF.AudioEngine = AudioEngine;
  RF.Speech = Speech;
  RF.CameraTracker = CameraTracker;
  RF.VISION_DEFAULTS = VISION_DEFAULTS;
  RF.streamChat = streamChat;
  RF.maskKey = maskKey;
})(typeof self !== 'undefined' ? self : this);
