// 用浏览器端的编码器（app/js/rf-core.js）生成一批真实的串口行，写成 C++ 头文件，
// 让固件测试确认“主机发出来的东西，下位机确实按预期执行”。
// 用法：node gen_js_frames.js > js_frames.h
'use strict';
const path = require('path');
const RF = require(path.join(__dirname, '..', '..', 'app', 'js', 'rf-core.js'));

const lines = [];
const esc = (s) => JSON.stringify(s.replace(/\n$/, ''));
const ctl = new RF.FaceController({ rng: RF.mulberry32(7), idle: false });

// 每个表情跑 2 秒让弹簧收敛，取最终帧
for (const name of RF.EMOTION_NAMES) {
  ctl.setEmotion(name, 1);
  for (let i = 0; i < 100; i++) ctl.update(0.02);
  const us = ctl.us.slice(0, 12);
  const expect = us.map((v) => Math.min(2100, Math.max(900, v)));   // 出厂限位 900–2100
  lines.push(`  { ${esc(RF.encodeFrame(ctl.us))}, 12, { ${expect.join(', ')} } },`);
}
// 极端值：超出限位的要被钳住，0 表示松开
lines.push(`  { ${esc(RF.encodeFrame([500, 2500, 0, 1500], 4))}, 4, { 900, 2100, 0, 1500 } },`);

const out = [];
out.push('// 由 gen_js_frames.js 自动生成，请勿手改。');
out.push('struct JsFrame { const char* line; int n; int expect[16]; };');
out.push('static const JsFrame kJsFrames[] = {');
out.push(...lines);
out.push('};');
out.push(`static const char* const kJsHello = ${esc(RF.encodeHello())};`);
out.push(`static const char* const kJsRelease = ${esc(RF.encodeRelease())};`);
out.push(`static const char* const kJsLimit = ${esc(RF.encodeLimit(7, 1450, 1950))};`);
out.push(`static const char* const kJsLimitQuery = ${esc(RF.encodeLimitQuery())};`);
out.push(`static const char* const kJsSlew = ${esc(RF.encodeSlew(800))};`);
out.push(`static const char* const kJsWatchdog = ${esc(RF.encodeWatchdog(250))};`);
process.stdout.write(out.join('\n') + '\n');
