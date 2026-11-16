// rf-core.js 的单元测试。运行：node --test app/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const RF = require('../js/rf-core.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} 应约等于 ${b}（容差 ${eps}）`);

// ───────────── 通道表与 spec/rig.json 一致 ─────────────
test('通道表与 spec/rig.json 完全一致', () => {
  const rig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'spec', 'rig.json'), 'utf8'));
  assert.equal(RF.CHANNELS.length, rig.channels.length);
  const keys = ['id', 'pca', 'label', 'pose_min', 'pose_max', 'us_min', 'us_neutral', 'us_max'];
  rig.channels.forEach((c, i) => {
    for (const k of keys) assert.deepEqual(RF.CHANNELS[i][k], c[k], `通道 ${c.id} 的 ${k}`);
  });
  assert.equal(RF.PWM.frequency_hz, rig.pwm.frequency_hz);
  assert.equal(RF.PWM.hard_min_us, rig.pwm.hard_min_us);
  assert.equal(RF.PWM.hard_max_us, rig.pwm.hard_max_us);
  assert.equal(RF.PWM.default_limit_min_us, rig.pwm.default_limit_min_us);
  assert.equal(RF.PWM.default_limit_max_us, rig.pwm.default_limit_max_us);
  // 通道号不重复且都在 0–15
  const pcas = RF.CHANNELS.map((c) => c.pca);
  assert.equal(new Set(pcas).size, pcas.length);
  assert.ok(pcas.every((p) => p >= 0 && p < 16));
});

// ───────────── 校准 ─────────────
test('校准：三个标定点正好落在对应脉宽上', () => {
  for (const c of RF.CHANNELS) {
    assert.equal(RF.poseToUs(c.id, 0), c.us_neutral, c.id);
    assert.equal(RF.poseToUs(c.id, c.pose_max), c.us_max, c.id);
    assert.equal(RF.poseToUs(c.id, c.pose_min), c.us_min, c.id);
  }
});

test('校准：姿态 → 脉宽 → 姿态 往返误差在 1 µs 的量化之内', () => {
  for (const c of RF.CHANNELS) {
    for (let i = 0; i <= 40; i++) {
      const v = c.pose_min + (c.pose_max - c.pose_min) * i / 40;
      const us = RF.poseToUs(c.id, v);
      const back = RF.usToPose(c.id, us);
      const span = v >= 0 ? Math.abs(c.us_max - c.us_neutral) / c.pose_max : Math.abs(c.us_min - c.us_neutral) / -c.pose_min;
      near(back, v, 0.5 / span + 1e-9);
    }
  }
});

test('校准：越界姿态被钳制，脉宽不超出硬范围', () => {
  assert.equal(RF.poseToUs('eye_pan', 5), 1250);       // 默认值里左右舵机是反向的
  assert.equal(RF.poseToUs('eye_pan', -5), 1750);
  assert.equal(RF.poseToUs('jaw', -1), 1710);          // 下颌没有负半程
  assert.equal(RF.poseToUs('lid_upper_l', -1), 1860);  // 钳到 -0.3
  assert.equal(RF.poseToUs('eye_pan', NaN), 1500);
  const wild = RF.mergeCalibration({ eye_pan: { us_min: 500, us_neutral: 1500, us_max: 2500 } });
  assert.equal(RF.poseToUs('eye_pan', 1, wild), 2500);
  assert.equal(RF.poseToUs('eye_pan', -1, wild), 500);
  assert.throws(() => RF.poseToUs('nope', 0));
});

test('校准：反向安装（us_max < us_neutral）和非对称半程', () => {
  // 用固定的校准值，不依赖默认表：上眼皮最小 1620（-0.3）、中位 1500、最大 1100（1）；下颌 1500→1900
  const cal = RF.mergeCalibration({
    lid_upper_l: { us_min: 1620, us_neutral: 1500, us_max: 1100 },
    jaw: { us_neutral: 1500, us_max: 1900 }
  });
  assert.equal(RF.poseToUs('lid_upper_l', 0.5, cal), 1300);
  assert.equal(RF.poseToUs('lid_upper_l', -0.15, cal), 1560);
  near(RF.usToPose('lid_upper_l', 1300, cal), 0.5, 1e-9);
  near(RF.usToPose('lid_upper_l', 1560, cal), -0.15, 1e-9);
  near(RF.usToPose('lid_upper_l', 900, cal), 1);       // 超出范围的脉宽钳到姿态上限
  near(RF.usToPose('lid_upper_l', 2000, cal), -0.3);
  near(RF.usToPose('jaw', 1300, cal), 0);              // 没有负半程：中位以下都算 0
  near(RF.usToPose('jaw', 0, cal), 0);                 // 0 = 松开
});

test('校准：覆盖值合并、导入导出、非法输入', () => {
  const cal = RF.mergeCalibration({ jaw: { us_neutral: 1400, us_max: 1800, us_min: 1000 }, brow_l: { us_max: 99999 }, bogus: { us_min: 1 } });
  assert.equal(cal.jaw.us_neutral, 1400);
  assert.equal(cal.jaw.us_max, 1800);
  assert.equal(cal.jaw.us_min, 1400, '没有负半程的通道 us_min 跟随中位');
  assert.equal(cal.brow_l.us_max, 1280, '非法值被丢弃，保持默认');
  assert.equal(cal.bogus, undefined);

  const json = RF.exportCalibration(cal);
  assert.deepEqual(RF.importCalibration(json), cal);
  assert.deepEqual(RF.importCalibration({ jaw: { us_max: 1700 } }).jaw.us_max, 1700);
  assert.throws(() => RF.importCalibration('{oops'), /JSON/);
  assert.throws(() => RF.importCalibration('{}'), /没有找到/);
  assert.throws(() => RF.importCalibration({ jaw: { us_max: 3000 } }), /超出/);

  const arr = RF.poseToUsArray(RF.emotionPose('happy'), cal);
  assert.equal(arr.length, 16);
  assert.deepEqual(arr.slice(12), [0, 0, 0, 0]);
  const back = RF.usArrayToPose(arr, cal);
  near(back.mouth_l, 0.85, 0.01);

  const limits = RF.limitsFromCalibration(cal, 20);
  assert.equal(limits.length, 12);
  const lj = limits.find((l) => l.ch === 7);
  assert.deepEqual(lj, { ch: 7, min: 1380, max: 1820 });
  for (const l of limits) assert.ok(l.min >= 500 && l.min < l.max && l.max <= 2500);
});

// ───────────── 协议 ─────────────
test('协议：校验和与 docs/PROTOCOL.md 的示例一致', () => {
  assert.equal(RF.encodeHello(), '?*3F\n');
  assert.equal(RF.encodeLimit(7, 1450, 1950), 'L 7 1450 1950*56\n');
  assert.equal(RF.encodeFrame(new Array(16).fill(1500)), 'P 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500 1500*50\n');
  // 文档里的三行示例原样取出来再验一遍
  const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'PROTOCOL.md'), 'utf8');
  const sent = doc.split('\n').filter((l) => l.startsWith('> ')).map((l) => l.slice(2));
  assert.equal(sent.length, 3);
  for (const l of sent) assert.ok(RF.verifyLine(l).ok, l);
});

test('协议：帧编码、参数检查、回复解析', () => {
  assert.equal(RF.encodeFrame([1500.4, 0, -5, 99999], 4), RF.encodeLine('P 1500 0 0 2500'));
  assert.equal(RF.encodeFrame([1, 2], 2), RF.encodeLine('P 500 500'));
  assert.equal(RF.encodeFrame([1500], 16).trim().split(' ').length, 17);
  assert.equal(RF.encodeSlew(800), 'V 800*4E\n');
  assert.equal(RF.encodeWatchdog(250), 'T 250*43\n');
  assert.equal(RF.encodeRelease(), 'R*52\n');
  assert.throws(() => RF.encodeLimit(16, 1000, 2000));
  assert.throws(() => RF.encodeLimit(0, 400, 2000));
  assert.throws(() => RF.encodeLimit(0, 2000, 1000));

  assert.equal(RF.verifyLine('?*3F\n').ok, true);
  assert.equal(RF.verifyLine('?*3f').ok, true);
  assert.equal(RF.verifyLine('?*00').ok, false);
  assert.equal(RF.verifyLine('?*3').ok, false);
  assert.deepEqual(RF.verifyLine('OK'), { ok: true, body: 'OK' });

  assert.deepEqual(RF.parseHello('RF1 fw=0.1.0 ch=16 hz=50'), { proto: 1, fw: '0.1.0', ch: 16, hz: 50 });
  assert.equal(RF.parseHello('OK'), null);
  assert.deepEqual(RF.parseReply('OK\r'), { type: 'ok' });
  assert.deepEqual(RF.parseReply('ERR 3 range'), { type: 'err', code: 3, message: 'range' });
  assert.deepEqual(RF.parseReply('L 7 1450 1950'), { type: 'limit', ch: 7, min: 1450, max: 1950 });
  assert.equal(RF.parseReply('RF1 fw=0.1.0 ch=16 hz=50').type, 'hello');
  assert.equal(RF.parseReply('boot...').type, 'other');
});

// ───────────── 弹簧 ─────────────
test('弹簧：收敛到目标、不超调、与帧间隔无关', () => {
  const a = new RF.Spring(20, 0); a.target = 1;
  let max = 0;
  for (let i = 0; i < 100; i++) { a.step(0.01); max = Math.max(max, a.x); }
  near(a.x, 1, 1e-6);
  assert.ok(max <= 1 + 1e-9, '临界阻尼不应超调');

  // 1 秒：50 步 × 20 ms 对比 1000 步 × 1 ms 对比 7 步不等长
  const run = (steps) => { const s = new RF.Spring(14, 0.2); s.target = -0.7; for (const dt of steps) s.step(dt); return s; };
  const s1 = run(new Array(50).fill(0.02));
  const s2 = run(new Array(1000).fill(0.001));
  const s3 = run([0.3, 0.05, 0.15, 0.2, 0.1, 0.12, 0.08]);
  near(s1.x, s2.x, 1e-9); near(s1.v, s2.v, 1e-9);
  near(s1.x, s3.x, 1e-9); near(s1.v, s3.v, 1e-9);

  // 中途改目标也一样
  const t1 = new RF.Spring(30, 0), t2 = new RF.Spring(30, 0);
  t1.target = 1; t2.target = 1;
  for (let i = 0; i < 5; i++) t1.step(0.02);
  for (let i = 0; i < 100; i++) t2.step(0.001);
  t1.target = 0; t2.target = 0;
  for (let i = 0; i < 5; i++) t1.step(0.02);
  for (let i = 0; i < 100; i++) t2.step(0.001);
  near(t1.x, t2.x, 1e-9);

  // 眼睛比眉毛快，眉毛比脖子快
  assert.ok(RF.SPRING_OMEGA.eye_pan > RF.SPRING_OMEGA.brow_l);
  assert.ok(RF.SPRING_OMEGA.lid_upper_l > RF.SPRING_OMEGA.mouth_l);
  assert.ok(RF.SPRING_OMEGA.brow_l > RF.SPRING_OMEGA.neck_yaw);
  assert.equal(new RF.Spring(10, 0.5).step(0), 0.5, 'dt = 0 不改变状态');
});

// ───────────── 眨眼 ─────────────
function simulateBlinks(seed, seconds, dt = 0.005) {
  const b = new RF.Blinker(RF.mulberry32(seed));
  const starts = [], closedSpans = [];
  let prev = 0, closedSince = -1, peak = 0;
  for (let t = 0; t < seconds; t += dt) {
    const v = b.update(dt, false);
    assert.ok(v >= 0 && v <= 1);
    if (prev === 0 && v > 0) { starts.push(t); peak = 0; }
    if (v > peak) peak = v;
    if (v > 0.5 && closedSince < 0) closedSince = t;
    if (v <= 0.5 && closedSince >= 0) { closedSpans.push(t - closedSince); closedSince = -1; }
    prev = v;
  }
  return { starts, closedSpans, count: b.count };
}

test('眨眼：间隔 2–6 秒，偶尔连眨，闭合过半约 130 ms', () => {
  const dur = RF.BLINK.closeS + RF.BLINK.holdS + RF.BLINK.openS;
  const r = simulateBlinks(12345, 600);
  assert.ok(r.starts.length > 100 && r.starts.length < 320, `600 秒内眨了 ${r.starts.length} 次`);
  let doubles = 0;
  for (let i = 1; i < r.starts.length; i++) {
    const gap = r.starts[i] - r.starts[i - 1] - dur;       // 上一次结束到这一次开始
    if (gap < 0.5) { doubles++; near(gap, RF.BLINK.doubleGapS, 0.02); }
    else assert.ok(gap >= 2 - 0.02 && gap <= 6 + 0.02, `间隔 ${gap.toFixed(3)} 秒不在 2–6 秒内`);
  }
  assert.ok(doubles > 3 && doubles < r.starts.length * 0.3, `连眨 ${doubles} 次`);
  // 不会三连眨
  for (let i = 2; i < r.starts.length; i++) {
    const g1 = r.starts[i - 1] - r.starts[i - 2] - dur, g2 = r.starts[i] - r.starts[i - 1] - dur;
    assert.ok(!(g1 < 0.5 && g2 < 0.5), '出现了三连眨');
  }
  for (const s of r.closedSpans) near(s, 0.13, 0.03);
});

test('眨眼：同一个种子结果完全相同，换种子则不同', () => {
  const a = simulateBlinks(7, 60), b = simulateBlinks(7, 60), c = simulateBlinks(8, 60);
  assert.deepEqual(a.starts, b.starts);
  assert.notDeepEqual(a.starts, c.starts);
});

test('眨眼：压制期间不发起新的眨眼，解除后恢复', () => {
  const b = new RF.Blinker(RF.mulberry32(3));
  for (let t = 0; t < 30; t += 0.01) assert.equal(b.update(0.01, true), 0);
  assert.equal(b.count, 0);
  let seen = false;
  for (let t = 0; t < 10; t += 0.01) if (b.update(0.01, false) > 0) seen = true;
  assert.ok(seen);
});

test('控制器：单眼眨眼（wink）期间不会自动眨眼去抢', () => {
  const ctl = new RF.FaceController({ rng: RF.mulberry32(99) });
  ctl.setEmotion('wink', 1);
  for (let i = 0; i < 50; i++) ctl.update(0.02);            // 先让它到位
  const before = ctl.blinker.count;
  let maxRight = -1, minLeft = 1;
  for (let i = 0; i < 3000; i++) {                          // 60 秒
    const p = ctl.update(0.02).pose;
    minLeft = Math.min(minLeft, p.lid_upper_l);
    maxRight = Math.max(maxRight, p.lid_upper_r);
  }
  assert.equal(ctl.blinker.count, before, 'wink 期间发起了自动眨眼');
  assert.ok(minLeft > 0.9, '左眼应一直闭着');
  assert.ok(maxRight < 0.3, `右眼应一直睁着（最大 ${maxRight}）`);
  // 回到平静后又会眨
  ctl.setEmotion('neutral');
  for (let i = 0; i < 1500; i++) ctl.update(0.02);
  assert.ok(ctl.blinker.count > before);
});

// ───────────── 口型 ─────────────
test('口型：张开快、合上慢，静音时归零，范围 0–1', () => {
  const lip = new RF.LipSync();
  let t = 0, tOpen = -1, tClose = -1;
  for (let i = 0; i < 200; i++) {                           // 响 200 ms
    const r = lip.update(0.001, 0.8); t += 0.001;
    assert.ok(r.jaw >= 0 && r.jaw <= 1);
    if (tOpen < 0 && r.jaw > 0.5) tOpen = t;
  }
  const peak = lip.jaw;
  assert.ok(peak > 0.8, `峰值 ${peak}`);
  t = 0;
  for (let i = 0; i < 1000; i++) {                          // 静音
    const r = lip.update(0.001, 0); t += 0.001;
    if (tClose < 0 && r.jaw < peak / 2) tClose = t;
  }
  assert.ok(tOpen > 0 && tOpen < 0.04, `张到一半用了 ${tOpen} 秒`);
  assert.ok(tClose > tOpen * 1.8, `合到一半用了 ${tClose} 秒，应明显慢于张开`);
  assert.equal(lip.jaw, 0);

  // 噪声门以下不动嘴；高频多时嘴角外展，低频多时收拢
  const q = new RF.LipSync();
  for (let i = 0; i < 100; i++) q.update(0.01, 0.03);
  assert.equal(q.jaw, 0);
  const hi = new RF.LipSync(), lo = new RF.LipSync();
  for (let i = 0; i < 100; i++) { hi.update(0.01, 0.7, 0.9); lo.update(0.01, 0.7, 0.1); }
  assert.ok(hi.corner > 0.05 && lo.corner < -0.05);
  assert.ok(Math.abs(hi.corner) <= 0.25);

  // 与帧间隔无关（同样的输入，10 ms 一步和 1 ms 十步）
  const a = new RF.LipSync(), b = new RF.LipSync();
  for (let i = 0; i < 20; i++) a.update(0.01, 0.6);
  for (let i = 0; i < 200; i++) b.update(0.001, 0.6);
  near(a.jaw, b.jaw, 1e-6);
});

test('口型：文字包络——每个字一下，标点处停顿', () => {
  const env = RF.textEnvelope('你好，世界！');
  assert.equal(env.pulseCount, 4);
  assert.ok(env.duration > 0.8 && env.duration < 2.5);
  // 找峰的个数
  let peaks = 0, prev = 0, rising = false, max = 0;
  for (let t = 0; t <= env.duration; t += 0.005) {
    const v = env.levelAt(t);
    assert.ok(v >= 0 && v <= 1);
    max = Math.max(max, v);
    if (v > prev) rising = true;
    else if (v < prev && rising) { peaks++; rising = false; }
    prev = v;
  }
  assert.equal(peaks, 4);
  assert.ok(max > 0.5);
  // 逗号处有一段静音
  const tComma = env.timeOfChar(2);
  assert.equal(env.levelAt(tComma + 0.08), 0);
  assert.equal(env.levelAt(-1), 0);
  assert.equal(env.levelAt(env.duration + 1), 0);
  // 字符时间单调不减
  let last = 0;
  for (let i = 0; i <= 6; i++) { const tt = env.timeOfChar(i); assert.ok(tt >= last); last = tt; }
  near(env.timeOfChar(999), env.duration);

  const en = RF.textEnvelope('Hello robot, 42.');
  assert.equal(en.pulseCount, 2 + 2 + 2);                  // hel-lo, ro-bot, 4-2
  assert.equal(RF.textEnvelope('').duration, 0);
  assert.ok(RF.textEnvelope('你好', 2).duration < RF.textEnvelope('你好', 1).duration);
});

// ───────────── 表情与合成 ─────────────
test('表情：预设都在范围内，强度按比例缩放，未知名字按平静', () => {
  assert.deepEqual(RF.EMOTION_NAMES, ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'sleepy', 'thinking', 'shy', 'wink']);
  for (const name of RF.EMOTION_NAMES) {
    assert.ok(RF.EMOTION_LABELS[name], name);
    const p = RF.emotionPose(name, 1);
    for (const c of RF.CHANNELS) {
      assert.ok(p[c.id] >= c.pose_min && p[c.id] <= c.pose_max, `${name}.${c.id}`);
      for (const id of Object.keys(RF.EMOTIONS[name])) assert.ok(RF.CHANNEL_BY_ID[id], `${name} 里有未知通道 ${id}`);
    }
  }
  near(RF.emotionPose('happy', 0.5).mouth_l, 0.425);
  assert.deepEqual(RF.emotionPose('happy', 0), RF.neutralPose());
  assert.deepEqual(RF.emotionPose('???'), RF.neutralPose());
  assert.ok(RF.emotionPose('happy').mouth_l > 0 && RF.emotionPose('sad').mouth_l < 0);
  assert.ok(RF.emotionPose('angry').brow_l < 0 && RF.emotionPose('surprised').brow_l > 0);
  assert.equal(RF.emotionPose('wink').lid_upper_l, 1);
  assert.equal(RF.emotionPose('wink').lid_upper_r, 0);
});

test('合成：口型取最大、眨眼覆盖表情、眼皮跟随眼球、最后钳制', () => {
  const base = RF.emotionPose('surprised');                 // jaw 0.5，上眼皮 -0.3
  // 口型：下颌取 max
  near(RF.composePose({ base, lip: { jaw: 0.2, corner: 0 } }).jaw, 0.5);
  near(RF.composePose({ base, lip: { jaw: 0.9, corner: 0 } }).jaw, 0.9);
  // 嘴角叠加并钳制
  near(RF.composePose({ base: RF.emotionPose('happy'), lip: { jaw: 0, corner: 0.1 } }).mouth_l, 0.95);
  near(RF.composePose({ base: RF.emotionPose('happy'), lip: { jaw: 0, corner: 0.9 } }).mouth_l, 1);
  // 眨眼：哪怕表情是“睁大”，眨眼量为 1 时上眼皮也要闭上
  const blinked = RF.composePose({ base, blink: 1 });
  near(blinked.lid_upper_l, 1); near(blinked.lid_upper_r, 1);
  assert.ok(blinked.lid_lower >= 0.25);
  const half = RF.composePose({ base, blink: 0.5 });
  near(half.lid_upper_l, (-0.3 - 0.15 * 0 + 1) / 2, 1e-9);
  // 眨眼可以只眨一边
  const one = RF.composePose({ base: RF.neutralPose(), blink: { l: 1, r: 0 } });
  near(one.lid_upper_l, 1); near(one.lid_upper_r, 0);
  // 没有眨眼层：表情原样通过
  near(RF.composePose({ base }).lid_upper_l, -0.3);
  // 眼皮跟随：往下看眼皮落下，往上看眼皮抬起
  const down = RF.composePose({ base: { eye_tilt: -1 } }), up = RF.composePose({ base: { eye_tilt: 1 } });
  assert.ok(down.lid_upper_l > 0.3 && up.lid_upper_l < 0);
  // 钳制
  const wild = RF.composePose({ base: { eye_pan: 9, jaw: -3, lid_upper_l: 7, brow_l: -9 } });
  assert.deepEqual([wild.eye_pan, wild.jaw, wild.lid_upper_l, wild.brow_l], [1, 0, 1, -1]);
  // 所有通道都有值
  assert.deepEqual(Object.keys(RF.composePose({})), RF.CHANNEL_IDS);
});

test('控制器：表情收敛、保持时间到后回到平静、手动与试动覆盖', () => {
  const ctl = new RF.FaceController({ rng: RF.mulberry32(1), idle: false });
  ctl.setEmotion('happy', 1);
  let r;
  for (let i = 0; i < 150; i++) r = ctl.update(0.02);
  near(r.pose.mouth_l, 0.85, 1e-3);
  assert.equal(r.us.length, 16);
  assert.equal(r.us[8], RF.poseToUs('mouth_l', r.pose.mouth_l));

  ctl.setEmotion('sad', 1, 1.0);                            // 保持 1 秒
  for (let i = 0; i < 40; i++) r = ctl.update(0.02);
  assert.ok(r.pose.mouth_l < -0.4);
  for (let i = 0; i < 200; i++) r = ctl.update(0.02);
  assert.equal(ctl.emotion, 'neutral');
  near(r.pose.mouth_l, 0, 1e-3);

  // 手动：直接是滑块的值，不叠加口型和眨眼
  ctl.setLip({ jaw: 1, corner: 0 });
  ctl.setManual({ jaw: 0.3, eye_pan: -0.5 });
  for (let i = 0; i < 150; i++) r = ctl.update(0.02);
  near(r.pose.jaw, 0.3, 1e-3); near(r.pose.eye_pan, -0.5, 1e-3);
  ctl.setManual(null);
  for (let i = 0; i < 150; i++) r = ctl.update(0.02);
  near(r.pose.jaw, 1, 1e-3);                               // 退出手动后口型重新生效

  // 试动：直接指定某一路的脉宽
  ctl.setUsOverride('jaw', 1234);
  r = ctl.update(0.02);
  assert.equal(r.us[7], 1234);
  ctl.setUsOverride('jaw', 9999);
  assert.equal(ctl.update(0.02).us[7], 2500);
  ctl.setUsOverride('jaw', null);
  assert.notEqual(ctl.update(0.02).us[7], 2500);

  // dt 异常（负数、极大、NaN）不会把状态搞坏
  for (const dt of [-1, 1e9, NaN, 0]) {
    const p = ctl.update(dt).pose;
    for (const id of RF.CHANNEL_IDS) assert.ok(Number.isFinite(p[id]));
  }
});

test('控制器：注视——眼睛先到，脖子慢慢跟上，眼睛再回正一部分', () => {
  const ctl = new RF.FaceController({ rng: RF.mulberry32(5), idle: false });
  ctl.setGaze(0.8, 0.4);
  let r;
  for (let i = 0; i < 10; i++) r = ctl.update(0.02);        // 0.2 秒
  const earlyEye = r.pose.eye_pan, earlyNeck = r.pose.neck_yaw;
  assert.ok(earlyEye > 0.45, `0.2 秒时眼睛 ${earlyEye}`);
  assert.ok(earlyNeck < 0.12, `0.2 秒时脖子 ${earlyNeck}`);
  for (let i = 0; i < 300; i++) r = ctl.update(0.02);       // 再过 6 秒
  near(r.pose.neck_yaw, 0.4, 0.01);
  near(r.pose.eye_pan, 0.4, 0.01);
  assert.ok(r.pose.eye_pan < earlyEye);
  near(r.pose.neck_pitch, 0.2, 0.01);
  ctl.setGaze(9, -9);
  assert.equal(ctl.gaze.x, 1); assert.equal(ctl.gaze.y, -1);
});

test('控制器：待机动作确定可复现，眼球微跳幅度小', () => {
  const run = (seed) => {
    const ctl = new RF.FaceController({ rng: RF.mulberry32(seed) });
    const out = [];
    let maxPan = 0, maxYaw = 0;
    for (let i = 0; i < 1500; i++) {
      const p = ctl.update(0.02).pose;
      maxPan = Math.max(maxPan, Math.abs(p.eye_pan)); maxYaw = Math.max(maxYaw, Math.abs(p.neck_yaw));
      if (i % 100 === 0) out.push(ctl.us.join(','));
    }
    return { out, maxPan, maxYaw, sacc: ctl.saccader.count, blinks: ctl.blinker.count };
  };
  const a = run(42), b = run(42), c = run(43);
  assert.deepEqual(a.out, b.out);
  assert.notDeepEqual(a.out, c.out);
  assert.ok(a.maxPan > 0.01 && a.maxPan <= 0.2, `微跳最大 ${a.maxPan}`);
  assert.ok(a.maxYaw > 0.001 && a.maxYaw < 0.1);
  assert.ok(a.sacc >= 8 && a.sacc <= 40, `30 秒微跳 ${a.sacc} 次`);     // 每 0.8–3 秒一次
  assert.ok(a.blinks >= 4 && a.blinks <= 20, `30 秒眨眼 ${a.blinks} 次`);
});

// ───────────── 标签解析与断句 ─────────────
function feedAll(chunks, valid) {
  const p = new RF.TagStreamParser(valid);
  const ev = [];
  for (const c of chunks) ev.push(...p.feed(c));
  ev.push(...p.end());
  return { text: ev.filter((e) => e.type === 'text').map((e) => e.text).join(''), emotions: ev.filter((e) => e.type === 'emotion').map((e) => e.name), ev };
}

test('标签解析：标签被剥掉并发出表情事件', () => {
  const r = feedAll(['[happy]你回来啦！[thinking]今天想聊点什么呢？']);
  assert.equal(r.text, '你回来啦！今天想聊点什么呢？');
  assert.deepEqual(r.emotions, ['happy', 'thinking']);
  // 事件顺序：表情在它后面的文字之前
  assert.deepEqual(r.ev.map((e) => e.type), ['emotion', 'text', 'emotion', 'text']);
});

test('标签解析：标签在任意位置被切开都一样', () => {
  const full = '[happy]你好呀！[sad]唉[1]，[emotion:wink]好吧【angry】哼[foo]。';
  const want = feedAll([full]);
  assert.equal(want.text, '你好呀！唉[1]，好吧哼。');
  assert.deepEqual(want.emotions, ['happy', 'sad', 'wink', 'angry']);
  for (let cut = 1; cut < full.length; cut++) {
    const r = feedAll([full.slice(0, cut), full.slice(cut)]);
    assert.equal(r.text, want.text, `在 ${cut} 处切开`);
    assert.deepEqual(r.emotions, want.emotions, `在 ${cut} 处切开`);
  }
  const chars = feedAll(full.split(''));                    // 一个字一片
  assert.equal(chars.text, want.text);
  assert.deepEqual(chars.emotions, want.emotions);
});

test('标签解析：不认识的标签丢弃，非标签的方括号保留，未闭合的原样输出', () => {
  assert.equal(feedAll(['[confused]嗯']).text, '嗯');
  assert.deepEqual(feedAll(['[confused]嗯']).emotions, []);
  assert.equal(feedAll(['见脚注[1]和[注]']).text, '见脚注[1]和[注]');
  assert.equal(feedAll(['数组 a[i] = b[j]']).text, '数组 a = b');     // 纯字母的方括号会被当成未知标签丢掉（已知取舍）
  assert.equal(feedAll(['没闭合 [happ']).text, '没闭合 [happ');
  assert.equal(feedAll(['[这是一段很长很长很长很长很长很长很长很长很长很长的话]']).text, '[这是一段很长很长很长很长很长很长很长很长很长很长的话]');
  assert.equal(feedAll(['[[happy]好']).text, '[好');
  assert.deepEqual(feedAll(['[[happy]好']).emotions, ['happy']);
  assert.deepEqual(feedAll(['[HAPPY] [ Sad ]']).emotions, ['happy', 'sad']);
  assert.deepEqual(feedAll(['[x]y'], ['x']).emotions, ['x']);
  assert.deepEqual(RF.stripTags('[shy]嘿嘿'), { text: '嘿嘿', emotions: ['shy'] });
  assert.deepEqual(feedAll([undefined, null, '']).text, '');
});

test('断句：中英文标点、小数、省略号、连续标点', () => {
  assert.deepEqual(RF.splitSentences('你好呀！今天3.14号……真的吗？！好的. Yes. wait...ok'),
    ['你好呀！', '今天3.14号……', '真的吗？！', '好的.', 'Yes.', 'wait...', 'ok']);
  assert.deepEqual(RF.splitSentences('他说：“走吧。”然后就走了'), ['他说：“走吧。”', '然后就走了']);
  assert.deepEqual(RF.splitSentences('第一行\n第二行'), ['第一行', '第二行']);
  assert.deepEqual(RF.splitSentences('   '), []);
  assert.deepEqual(RF.splitSentences('没有标点'), ['没有标点']);
});

test('断句：流式输入与一次性输入结果相同', () => {
  const full = '你好呀！今天3.14号……真的吗？！好的. Yes. 最后一句没有标点';
  const want = RF.splitSentences(full);
  for (let cut = 1; cut < full.length; cut++) {
    const sp = new RF.SentenceSplitter();
    const got = [...sp.feed(full.slice(0, cut)), ...sp.feed(full.slice(cut)), ...sp.flush()];
    assert.deepEqual(got, want, `在 ${cut} 处切开`);
  }
  const sp = new RF.SentenceSplitter();
  const got = [];
  for (const ch of full) got.push(...sp.feed(ch));
  got.push(...sp.flush());
  assert.deepEqual(got, want);
  // 太长的句子在逗号处切开
  const long = '这是一句特别特别长的话，' .repeat(8);
  assert.ok(RF.splitSentences(long).length >= 2);
});

// ───────────── 面部捕捉映射 ─────────────
test('面部捕捉：镜像模式左右对调，非镜像模式一一对应', () => {
  const bs = { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.05, mouthSmileLeft: 0.6, mouthSmileRight: 0.1, browDownLeft: 0.5, jawOpen: 0.5 };
  const m = RF.blendshapesToPose(bs);                       // 默认镜像
  assert.ok(m.lid_upper_r > 0.9, '你闭左眼 → 它闭自己的右眼（在你左手边）');
  assert.equal(m.lid_upper_l, 0);
  assert.ok(m.mouth_r > m.mouth_l);
  assert.ok(m.brow_r < 0 && m.brow_l === 0);
  near(m.jaw, 0.7);
  const a = RF.blendshapesToPose(bs, { mirror: false });
  assert.ok(a.lid_upper_l > 0.9 && a.lid_upper_r === 0);
  assert.ok(a.mouth_l > a.mouth_r);
  assert.ok(a.brow_l < 0);
});

test('面部捕捉：视线方向、睁大、挑眉、撇嘴、范围', () => {
  // 被拍者往自己左边看：左眼外转 + 右眼内转
  const look = { eyeLookOutLeft: 0.6, eyeLookInRight: 0.6, eyeLookUpLeft: 0.5, eyeLookUpRight: 0.5 };
  assert.ok(RF.blendshapesToPose(look).eye_pan < -0.5, '镜像：它朝自己的右边看（房间的同一侧）');
  assert.ok(RF.blendshapesToPose(look, { mirror: false }).eye_pan > 0.5);
  assert.ok(RF.blendshapesToPose(look).eye_tilt > 0.5);
  assert.ok(RF.blendshapesToPose({ eyeLookDownLeft: 0.6, eyeLookDownRight: 0.6 }).eye_tilt < -0.5);

  const wide = RF.blendshapesToPose({ eyeWideLeft: 0.9, eyeWideRight: 0.9, browInnerUp: 0.8 });
  near(wide.lid_upper_l, -0.3); near(wide.lid_upper_r, -0.3);
  assert.ok(wide.brow_l > 0.7 && wide.brow_r > 0.7);
  const frown = RF.blendshapesToPose({ mouthFrownLeft: 0.7, mouthFrownRight: 0.7 });
  assert.equal(frown.mouth_l, -1); assert.equal(frown.mouth_r, -1);

  // 空输入、乱七八糟的输入都落在合法范围内
  for (const input of [undefined, {}, { jawOpen: 99, eyeBlinkLeft: -4, browInnerUp: 'x', mouthSmileLeft: NaN }]) {
    const p = RF.blendshapesToPose(input);
    for (const c of RF.CHANNELS) assert.ok(p[c.id] >= c.pose_min && p[c.id] <= c.pose_max, c.id);
  }
  assert.deepEqual(RF.blendshapesToPose({}), RF.neutralPose());
});

// ───────────── 大模型请求与流解析 ─────────────
test('请求构造：Anthropic 原生接口', () => {
  const msgs = [{ role: 'user', content: '你好' }];
  const r = RF.buildAnthropicRequest({ baseUrl: 'https://api.anthropic.com/', apiKey: 'k', model: '' }, 'sys', msgs);
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.headers['x-api-key'], 'k');
  assert.equal(r.headers['anthropic-version'], '2026-10-21');
  assert.equal(r.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(r.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(r.body.fallbacks, 'default');
  assert.equal(r.body.model, RF.DEFAULT_MODEL);
  assert.equal(r.body.max_tokens, 2000);
  assert.equal(r.body.stream, true);
  assert.equal(r.body.system, 'sys');
  assert.deepEqual(r.body.output_config, { effort: 'low' });
  assert.deepEqual(r.body.messages, msgs);
  for (const k of ['temperature', 'top_p', 'top_k', 'thinking']) assert.ok(!(k in r.body), `不应发送 ${k}`);
  assert.equal(r.body.messages[r.body.messages.length - 1].role, 'user', '不预填 assistant');

  // 中转站：不带服务端回退参数
  const relay = RF.buildAnthropicRequest({ baseUrl: 'https://relay.example.com/v1', apiKey: 'k', model: 'm' }, 's', msgs);
  assert.equal(relay.url, 'https://relay.example.com/v1/messages');
  assert.ok(!('anthropic-beta' in relay.headers));
  assert.ok(!('fallbacks' in relay.body));
  assert.equal(relay.body.model, 'm');
  // 长得像但不是官方域名的，也不带
  const fake = RF.buildAnthropicRequest({ baseUrl: 'https://api.anthropic.com.evil.example', apiKey: 'k' }, 's', msgs);
  assert.ok(!('fallbacks' in fake.body));
  assert.equal(RF.buildAnthropicRequest({ baseUrl: '' }, 's', msgs).url, 'https://api.anthropic.com/v1/messages');
});

test('请求构造：OpenAI 兼容接口', () => {
  const r = RF.buildOpenAIRequest({ baseUrl: 'https://api.deepseek.com/v1/', apiKey: 'k', model: 'deepseek-chat' }, 'sys', [{ role: 'user', content: 'hi' }]);
  assert.equal(r.url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(r.headers.authorization, 'Bearer k');
  assert.equal(r.body.stream, true);
  assert.deepEqual(r.body.messages, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }]);
  assert.equal(RF.buildOpenAIRequest({ baseUrl: 'https://x.example/v1/chat/completions' }, '', []).url, 'https://x.example/v1/chat/completions');
});

test('SSE：分片切在任意位置都能解析', () => {
  const raw = 'event: message_start\ndata: {"type":"message_start"}\n\n' +
    'event: content_block_delta\r\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"[happy]你"}}\r\n\r\n' +
    ': ping\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"…"}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"好"}}\n\n' +
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n' +
    'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  const collect = (chunks) => {
    const p = new RF.SSEParser();
    let text = '', stop = '';
    const ev = [];
    for (const c of chunks) ev.push(...p.feed(c));
    ev.push(...p.end());
    for (const e of ev) { const d = RF.interpretSSE('anthropic', e); if (d && d.text) text += d.text; if (d && d.stop) stop = d.stop; }
    return { text, stop, n: ev.length };
  };
  const want = collect([raw]);
  assert.deepEqual(want, { text: '[happy]你好', stop: 'end_turn', n: 6 });
  for (let cut = 1; cut < raw.length; cut += 3) assert.deepEqual(collect([raw.slice(0, cut), raw.slice(cut)]), want, `在 ${cut} 处切开`);
});

test('SSE：停止原因、错误事件、OpenAI 格式', () => {
  const ev = (o) => ({ event: 'x', data: JSON.stringify(o) });
  assert.deepEqual(RF.interpretSSE('anthropic', ev({ type: 'message_delta', delta: { stop_reason: 'refusal' } })), { stop: 'refusal' });
  assert.deepEqual(RF.interpretSSE('anthropic', ev({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } })), { stop: 'max_tokens' });
  assert.deepEqual(RF.interpretSSE('anthropic', ev({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })), { error: 'Overloaded' });
  assert.equal(RF.interpretSSE('anthropic', ev({ type: 'ping' })), null);
  assert.equal(RF.interpretSSE('anthropic', { event: 'x', data: 'not json' }), null);

  assert.deepEqual(RF.interpretSSE('openai', ev({ choices: [{ delta: { content: '嗨' } }] })), { text: '嗨' });
  assert.deepEqual(RF.interpretSSE('openai', ev({ choices: [{ delta: {}, finish_reason: 'length' }] })), { stop: 'max_tokens' });
  assert.deepEqual(RF.interpretSSE('openai', ev({ choices: [{ delta: {}, finish_reason: 'content_filter' }] })), { stop: 'refusal' });
  assert.deepEqual(RF.interpretSSE('openai', { event: 'message', data: '[DONE]' }), { done: true });
  assert.deepEqual(RF.interpretSSE('openai', ev({ error: { message: 'bad key' } })), { error: 'bad key' });
  assert.equal(RF.interpretSSE('openai', ev({ choices: [] })), null);

  assert.match(RF.describeStop('refusal'), /拒绝/);
  assert.match(RF.describeStop('max_tokens'), /截断/);
  assert.equal(RF.describeStop('end_turn'), '');
  assert.match(RF.describeHttpError(401), /密钥/);
  assert.match(RF.describeHttpError(403), /密钥/);
  assert.match(RF.describeHttpError(429), /频繁|额度/);
  assert.match(RF.describeHttpError(529), /服务端/);
  assert.match(RF.describeHttpError(404), /404/);
  assert.notEqual(RF.describeHttpError(401), RF.describeHttpError(429));
  assert.notEqual(RF.describeHttpError(429), RF.describeHttpError(500));
});

test('默认提示词里列出的标签与预设表情一致', () => {
  const tags = [...RF.DEFAULT_SYSTEM_PROMPT.matchAll(/\[([a-z]+)\]/g)].map((m) => m[1]);
  for (const name of RF.EMOTION_NAMES) assert.ok(tags.includes(name), `提示词里缺 [${name}]`);
  for (const t of tags) assert.ok(RF.EMOTIONS[t], `提示词里的 [${t}] 不是预设表情`);
});
