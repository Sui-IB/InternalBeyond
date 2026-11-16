// 冒烟测试：用无头 Chromium 直接打开 face.html（file://），把整条链路走一遍。
// 运行：node app/tests/smoke.mjs      （需要本机已装 Playwright 和 Chromium）
// 不访问网络：大模型接口用假的 fetch 顶替，串口用假的 navigator.serial 顶替。
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RF = require('../js/rf-core.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, '..', 'face.html')).href;
const shotDir = path.join(here, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function check(cond, what) {
  if (cond) console.log('  ✓ ' + what);
  else { failed++; console.log('  ✗ ' + what); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 页面加载前注入：假接口 + 假串口
function initScript() {
  // —— 假的大模型接口：按 Anthropic 的 SSE 格式分片流式返回，标签故意切在两片中间 ——
  window.__fetchCalls = [];
  const realFetch = window.fetch;
  window.fetch = async function (url, init) {
    const u = String(url);
    if (!/\/v1\/messages$|\/chat\/completions$/.test(u)) return realFetch.apply(this, arguments);
    const body = JSON.parse(init.body);
    window.__fetchCalls.push({ url: u, headers: init.headers, body });
    if (window.__fetchMode === 'http401') {
      return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 });
    }
    const anth = /\/v1\/messages$/.test(u);
    const pieces = window.__fetchMode === 'refusal' ? [] : ['[hap', 'py]你好呀！', '很高兴见到你。[thin', 'king]让我想想', '今天聊点什么呢？'];
    const stop = window.__fetchMode === 'refusal' ? 'refusal' : 'end_turn';
    const enc = new TextEncoder();
    const frames = [];
    if (anth) {
      frames.push('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test"}}\n\n');
      for (const p of pieces) frames.push('event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } }) + '\n\n');
      frames.push('event: message_delta\ndata: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: stop } }) + '\n\n');
      frames.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    } else {
      for (const p of pieces) frames.push('data: ' + JSON.stringify({ choices: [{ delta: { content: p } }] }) + '\n\n');
      frames.push('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
    }
    const all = frames.join('');
    const stream = new ReadableStream({
      async start(ctrl) {
        // 每 7 个字节一片，确保 SSE 行和 UTF-8 多字节字符都会被切开
        const bytes = enc.encode(all);
        for (let i = 0; i < bytes.length; i += 7) {
          ctrl.enqueue(bytes.slice(i, i + 7));
          if (i % 70 === 0) await new Promise((r) => setTimeout(r, 4));
        }
        ctrl.close();
      }
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };

  // —— 假串口：记录主机写出的每一行和时间；收到握手就回一行固件信息 ——
  window.__serial = { lines: [], opened: null, closed: false };
  let rxCtrl = null;
  const dec = new TextDecoder(), enc2 = new TextEncoder();
  let pending = '';
  const port = {
    async open(opts) { window.__serial.opened = opts; },
    async close() { window.__serial.closed = true; },
    readable: new ReadableStream({ start(c) { rxCtrl = c; } }),
    writable: new WritableStream({
      write(chunk) {
        pending += dec.decode(chunk, { stream: true });
        let i;
        while ((i = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, i); pending = pending.slice(i + 1);
          window.__serial.lines.push({ t: performance.now(), line });
          if (line.startsWith('?')) rxCtrl.enqueue(enc2.encode('RF1 fw=0.1.0 ch=16 hz=50\r\n'));
          else if (/^[LVTR]/.test(line)) rxCtrl.enqueue(enc2.encode('OK\n'));
        }
      }
    })
  };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: async () => port } });
}

async function run() {
  const browser = await chromium.launch();
  const errors = [];

  // ═════════ 桌面 ═════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.addInitScript(initScript);
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.RF && window.RF.app);

  console.log('页面加载');
  check((await page.textContent('#hwStatus')).includes('仿真模式'), '未连接时显示“仿真模式”');
  check(await page.evaluate(() => { const c = document.getElementById('face'); return c.width >= c.clientWidth * 2 - 2 && c.height > 0; }), '画布按 devicePixelRatio = 2 放大');
  check(await page.evaluate(() => {
    const c = document.getElementById('face');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n++;
    return n > 50;
  }), '仿真画面确实画出了东西');

  console.log('表情预设');
  await page.click('.tab[data-tab="face"]');
  const emoButtons = await page.$$('#emoGrid .btn');
  check(emoButtons.length === RF.EMOTION_NAMES.length, `有 ${RF.EMOTION_NAMES.length} 个表情按钮`);
  for (const name of RF.EMOTION_NAMES) {
    await page.click(`#emoGrid .btn[data-emo="${name}"]`);
    await sleep(700);
    const got = await page.evaluate(() => ({ emo: RF.app.controller.emotion, pose: RF.app.controller.pose, chip: document.getElementById('emoNow').textContent }));
    const want = RF.emotionPose(name, 1);
    // 眉毛和嘴角不受眨眼、注视影响，用它们判断表情是否到位
    const ok = ['brow_l', 'brow_r', 'mouth_l', 'mouth_r'].every((id) => Math.abs(got.pose[id] - want[id]) < 0.12);
    check(got.emo === name && ok && got.chip === RF.EMOTION_LABELS[name], `${RF.EMOTION_LABELS[name]}（${name}）到位`);
    if (name === 'happy') await page.screenshot({ path: path.join(shotDir, 'desktop-happy.png') });
    if (name === 'surprised') await page.screenshot({ path: path.join(shotDir, 'desktop-surprised.png') });
    if (name === 'angry') await page.screenshot({ path: path.join(shotDir, 'desktop-angry.png') });
    if (name === 'wink') await page.screenshot({ path: path.join(shotDir, 'desktop-wink.png') });
  }
  await page.click('#emoGrid .btn[data-emo="neutral"]');

  console.log('手动滑块');
  await page.evaluate(() => { const s = document.getElementById('man-jaw'); s.value = 0.8; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(500);
  check(await page.evaluate(() => document.getElementById('manualToggle').checked && Math.abs(RF.app.controller.pose.jaw - 0.8) < 0.02), '拖动滑块自动进入手动模式，下颌到 0.8');
  await page.click('#manualZero');
  await page.uncheck('#manualToggle');

  console.log('对话（假接口）');
  await page.click('.tab[data-tab="chat"]');
  await page.fill('#chatInput', '你好');
  await page.click('#sendBtn');
  await sleep(300);
  check((await page.textContent('#chatLog')).includes('API Key'), '没填 Key 时给出提示而不是报错');
  check(await page.evaluate(() => window.__fetchCalls.length === 0), '没填 Key 时不发请求');

  await page.click('.tab[data-tab="settings"]');
  await page.fill('#setKey', 'test-key-not-real');
  await page.dispatchEvent('#setKey', 'change');
  await page.uncheck('#setIdle');                      // 关掉待机动作，下面的断言更稳定
  await page.click('.tab[data-tab="chat"]');
  await page.uncheck('#speakToggle');                  // 不出声：按文字节奏动嘴
  await page.fill('#chatInput', '你好');
  await page.press('#chatInput', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#chatLog .msg-bot').length === 1 && !document.getElementById('sendBtn').disabled, null, { timeout: 5000 });
  const bot = await page.textContent('#chatLog .msg-bot .msg-text');
  check(bot === '你好呀！很高兴见到你。让我想想今天聊点什么呢？', '回复里的标签被剥掉，正文完整：' + bot);
  check(!/\[|\]/.test(await page.textContent('#chatLog .msg-bot')), '气泡里没有残留的方括号');
  const call = await page.evaluate(() => window.__fetchCalls[0]);
  check(call.url === 'https://api.anthropic.com/v1/messages', '请求发到 Anthropic 原生接口');
  check(call.headers['x-api-key'] === 'test-key-not-real' && call.headers['anthropic-version'] === '2026-10-21'
    && call.headers['anthropic-dangerous-direct-browser-access'] === 'true', '请求头正确');
  check(call.body.stream === true && call.body.fallbacks === 'default' && call.body.output_config.effort === 'low'
    && !('temperature' in call.body) && !('thinking' in call.body) && call.body.messages.at(-1).role === 'user', '请求体正确（流式、不带采样参数、不预填）');
  check(await page.evaluate(() => RF.app.controller.emotion) === 'happy', '第一个标签立刻把表情切到“开心”');
  // 口型：念的过程中下颌应当张开过
  let maxJaw = 0, sawThinking = false;
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => ({ jaw: RF.app.controller.pose.jaw, emo: RF.app.controller.emotion, speaking: !!RF.app.state.speaking }));
    maxJaw = Math.max(maxJaw, s.jaw);
    if (s.emo === 'thinking') sawThinking = true;
    if (i === 6) await page.screenshot({ path: path.join(shotDir, 'desktop-chat.png') });
    if (!s.speaking && i > 10) break;
    await sleep(100);
  }
  check(maxJaw > 0.3, `说话时嘴在动（下颌最大 ${maxJaw.toFixed(2)}）`);
  check(sawThinking, '念到第三句时表情切到“思考”');
  await page.waitForFunction(() => !RF.app.state.speaking && RF.app.state.speechQueue.length === 0, null, { timeout: 15000 });
  await sleep(400);
  check(await page.evaluate(() => RF.app.controller.pose.jaw) < 0.05, '说完后嘴合上');
  check(await page.evaluate(() => RF.app.state.history.length === 2 && RF.app.state.history[1].role === 'assistant'), '对话历史里记了一问一答');

  // 被拒绝 / HTTP 错误都要显示出来
  await page.evaluate(() => { window.__fetchMode = 'refusal'; });
  await page.fill('#chatInput', '测试拒绝');
  await page.press('#chatInput', 'Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#chatLog .msg-note')].some((m) => /模型拒绝/.test(m.textContent)), null, { timeout: 5000 });
  check(true, 'stop_reason = refusal 时显示“模型拒绝…”，而不是空白气泡');
  check(await page.evaluate(() => document.querySelectorAll('#chatLog .msg-bot').length === 1), '没有留下空的回复气泡');
  await page.evaluate(() => { window.__fetchMode = 'http401'; });
  await page.fill('#chatInput', '测试错误');
  await page.press('#chatInput', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#chatLog .msg-err').length === 1, null, { timeout: 5000 });
  const errText = await page.textContent('#chatLog .msg-err');
  check(/密钥/.test(errText) && !errText.includes('test-key-not-real'), 'HTTP 401 显示为密钥问题，且不泄露 Key');
  check(await page.evaluate(() => RF.app.state.history.length === 2), '失败的那一轮没有留在历史里');
  await page.evaluate(() => { window.__fetchMode = ''; });

  // OpenAI 兼容格式
  await page.click('.tab[data-tab="settings"]');
  await page.selectOption('#setProvider', 'openai');
  check(await page.inputValue('#setBase') === 'https://api.openai.com/v1', '切换接口类型时默认地址跟着换');
  await page.fill('#setBase', 'https://relay.example.com/v1'); await page.dispatchEvent('#setBase', 'change');
  await page.fill('#setModel', 'some-model'); await page.dispatchEvent('#setModel', 'change');
  await page.click('.tab[data-tab="chat"]');
  await page.click('#clearBtn');
  await page.fill('#chatInput', '再来一次');
  await page.press('#chatInput', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#chatLog .msg-bot').length === 1 && !document.getElementById('sendBtn').disabled, null, { timeout: 5000 });
  const call2 = await page.evaluate(() => window.__fetchCalls.at(-1));
  check(call2.url === 'https://relay.example.com/v1/chat/completions' && call2.headers.authorization === 'Bearer test-key-not-real'
    && call2.body.messages[0].role === 'system' && call2.body.model === 'some-model', 'OpenAI 兼容请求正确');
  check((await page.textContent('#chatLog .msg-bot .msg-text')) === '你好呀！很高兴见到你。让我想想今天聊点什么呢？', 'OpenAI 兼容流解析正确');
  await page.click('#stopBtn', { force: true }).catch(() => {});
  await page.evaluate(() => RF.app.state.speechQueue.length = 0);

  console.log('校准');
  await page.click('.tab[data-tab="cal"]');
  check((await page.$$('#calList .cal-card')).length === 12, '12 个通道的校准卡片');
  await page.evaluate(() => { const s = document.querySelector('#calList .cal-card:nth-child(8) input[type=range]'); s.value = 1700; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(100);
  check(await page.evaluate(() => RF.app.controller.us[7]) === 1700, '拖动试动滑块直接驱动下颌那一路（1700 µs）');
  await page.click('#calList .cal-card:nth-child(8) .cal-pt:nth-child(3) .btn');
  check(await page.evaluate(() => RF.app.controller.cal.jaw.us_max) === 1700, '“取当前”把 1700 写进下颌的最大值');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('rf01.cal')).jaw.us_max) === 1700, '校准值已保存到本机');
  await page.screenshot({ path: path.join(shotDir, 'desktop-cal.png') });
  await page.click('#calList .cal-card:nth-child(8) .cal-live .btn');
  await sleep(100);
  check(await page.evaluate(() => RF.app.controller.us[7]) !== 1700, '停止试动后恢复正常输出');
  await page.click('#calReset');
  check(await page.evaluate(() => RF.app.controller.cal.jaw.us_max) === 1300, '恢复默认');

  console.log('串口（假设备）');
  await page.click('.tab[data-tab="link"]');
  await page.click('#connectBtn');
  await page.waitForFunction(() => /已连接 RF-01 固件 0\.1\.0/.test(document.getElementById('hwStatus').textContent), null, { timeout: 3000 });
  check(true, '握手成功，顶栏显示已连接和固件版本');
  check(await page.evaluate(() => window.__serial.opened && window.__serial.opened.baudRate === 115200), '以 115200 打开串口');
  await page.evaluate(() => { window.__serial.lines.length = 0; });
  await page.click('.tab[data-tab="face"]');
  await page.click('#emoGrid .btn[data-emo="happy"]');
  await sleep(2000);
  const lines = await page.evaluate(() => window.__serial.lines.slice());
  const frames = lines.filter((l) => l.line.startsWith('P '));
  const wellFormed = frames.every((f) => /^P( \d+){12}\*[0-9A-F]{2}$/.test(f.line) && RF.verifyLine(f.line).ok);
  check(frames.length > 0 && wellFormed, `全部 ${frames.length} 帧格式正确且校验通过`);
  const inRange = frames.every((f) => RF.verifyLine(f.line).body.split(' ').slice(1).every((v) => Number(v) >= 500 && Number(v) <= 2500));
  check(inRange, '每个脉宽都在 500–2500 µs');
  const span = (frames.at(-1).t - frames[0].t) / 1000;
  const hz = (frames.length - 1) / span;
  check(hz > 42 && hz < 56, `帧率约 50 Hz（实测 ${hz.toFixed(1)} Hz）`);
  const lastVals = RF.verifyLine(frames.at(-1).line).body.split(' ').slice(1).map(Number);
  check(Math.abs(lastVals[8] - RF.poseToUs('mouth_l', 0.85)) <= 3 && Math.abs(lastVals[9] - RF.poseToUs('mouth_r', 0.85)) <= 3, '帧里的嘴角脉宽就是“开心”表情对应的值');

  await page.click('.tab[data-tab="cal"]');
  await page.evaluate(() => { window.__serial.lines.length = 0; });
  await page.click('#calSendLimits');
  await sleep(600);
  const lim = (await page.evaluate(() => window.__serial.lines.map((l) => l.line))).filter((l) => l.startsWith('L '));
  check(lim.length === 12 && lim.every((l) => RF.verifyLine(l).ok) && lim.includes(RF.encodeLimit(7, 1280, 1730).trim()), '下发 12 条限位命令，下颌为 1280–1730');

  await page.click('.tab[data-tab="link"]');
  await page.click('#releaseBtn');
  await sleep(300);
  await page.evaluate(() => { window.__serial.lines.length = 0; });
  await sleep(500);
  check(await page.evaluate(() => window.__serial.lines.filter((l) => l.line.startsWith('P ')).length) === 0, '“松开全部舵机”之后不再发 P 帧');
  check(!(await page.isChecked('#outputToggle')), '“持续输出”开关同步变为关闭');
  check((await page.textContent('#serialLog')).includes('< RF1 fw=0.1.0') && (await page.textContent('#serialLog')).includes('> R*52'), '日志里有握手回复和 R 命令');
  await page.screenshot({ path: path.join(shotDir, 'desktop-link.png') });
  await page.evaluate(() => { window.__serial.lines.length = 0; });
  await page.click('#connectBtn');
  await page.waitForFunction(() => /仿真模式/.test(document.getElementById('hwStatus').textContent), null, { timeout: 3000 });
  await page.waitForFunction(() => window.__serial.closed, null, { timeout: 2000 }).catch(() => {});
  check(await page.evaluate(() => window.__serial.closed), '断开后串口被关闭，回到仿真模式');
  check((await page.evaluate(() => window.__serial.lines.map((l) => l.line))).includes('R*52'), '断开前先发 R 让舵机松开');

  await page.click('.tab[data-tab="settings"]');
  await page.screenshot({ path: path.join(shotDir, 'desktop-settings.png') });
  await page.click('.tab[data-tab="face"]');
  await page.click('#emoGrid .btn[data-emo="neutral"]');
  await sleep(600);
  await page.screenshot({ path: path.join(shotDir, 'desktop-face.png') });
  await ctx.close();

  // ═════════ 桌面 · 深色 ═════════
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  const dpage = await dctx.newPage();
  dpage.on('console', (m) => { if (m.type() === 'error') errors.push('console(dark): ' + m.text()); });
  dpage.on('pageerror', (e) => errors.push('pageerror(dark): ' + e.message));
  await dpage.goto(pageUrl);
  await dpage.waitForFunction(() => window.RF && window.RF.app);
  await dpage.evaluate(() => { RF.app.showTab('face'); RF.app.applyEmotion('shy'); });
  await sleep(900);
  await dpage.screenshot({ path: path.join(shotDir, 'desktop-dark.png') });
  await dctx.close();

  // ═════════ 手机 ═════════
  console.log('手机宽度');
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  mpage.on('console', (m) => { if (m.type() === 'error') errors.push('console(mobile): ' + m.text()); });
  mpage.on('pageerror', (e) => errors.push('pageerror(mobile): ' + e.message));
  await mpage.goto(pageUrl);
  await mpage.waitForFunction(() => window.RF && window.RF.app);
  await sleep(500);
  const noOverflow = () => mpage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(await noOverflow(), '对话页没有横向溢出');
  check(await mpage.evaluate(() => {
    const s = document.querySelector('.stage').getBoundingClientRect(), p = document.querySelector('.panel').getBoundingClientRect();
    return s.bottom <= p.top + 1 && s.width > 300;
  }), '仿真画面叠在面板上方');
  await mpage.screenshot({ path: path.join(shotDir, 'phone-chat.png') });
  for (const tab of ['face', 'cal', 'link', 'settings']) {
    await mpage.evaluate((t) => RF.app.showTab(t), tab);
    await sleep(200);
    check(await noOverflow(), `${tab} 页没有横向溢出`);
    await mpage.screenshot({ path: path.join(shotDir, `phone-${tab}.png`), fullPage: tab !== 'cal' });
  }
  await mctx.close();
  await browser.close();

  console.log('控制台错误');
  check(errors.length === 0, errors.length ? '出现错误：\n    ' + errors.join('\n    ') : '全程没有 console.error 和页面异常');

  console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
