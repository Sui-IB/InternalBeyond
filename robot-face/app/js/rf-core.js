/*
 * RF-01 核心逻辑（纯计算，不依赖 DOM）
 * 浏览器里挂到全局 RF，node 里通过 module.exports 导出，供测试使用。
 *
 * 数据流：
 *   表情 / 注视 / 待机动作 → 弹簧平滑 → 叠加口型与眨眼 → 钳制 → 校准成脉宽(µs) → 串口帧
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.RF = root.RF || {};
    for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) root.RF[k] = api[k];
  }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // ───────────────────────── 通道表（与 spec/rig.json 保持一致，测试会比对） ─────────────────────────
  var CHANNELS = [
    { id: 'eye_pan',     pca: 0,  label: '眼球左右', pose_min: -1.0, pose_max: 1.0, us_min: 1750, us_neutral: 1500, us_max: 1250 },
    { id: 'eye_tilt',    pca: 1,  label: '眼球上下', pose_min: -1.0, pose_max: 1.0, us_min: 1085, us_neutral: 1500, us_max: 1895 },
    { id: 'lid_upper_l', pca: 2,  label: '左上眼皮', pose_min: -0.3, pose_max: 1.0, us_min: 1860, us_neutral: 1725, us_max: 1190 },
    { id: 'lid_upper_r', pca: 3,  label: '右上眼皮', pose_min: -0.3, pose_max: 1.0, us_min: 1140, us_neutral: 1275, us_max: 1810 },
    { id: 'lid_lower',   pca: 4,  label: '下眼皮',   pose_min: 0.0,  pose_max: 1.0, us_min: 1310, us_neutral: 1310, us_max: 1650 },
    { id: 'brow_l',      pca: 5,  label: '左眉',     pose_min: -1.0, pose_max: 1.0, us_min: 1720, us_neutral: 1500, us_max: 1280 },
    { id: 'brow_r',      pca: 6,  label: '右眉',     pose_min: -1.0, pose_max: 1.0, us_min: 1280, us_neutral: 1500, us_max: 1720 },
    { id: 'jaw',         pca: 7,  label: '下颌',     pose_min: 0.0,  pose_max: 1.0, us_min: 1710, us_neutral: 1710, us_max: 1300 },
    { id: 'mouth_l',     pca: 8,  label: '左嘴角',   pose_min: -1.0, pose_max: 1.0, us_min: 1250, us_neutral: 1500, us_max: 1750 },
    { id: 'mouth_r',     pca: 9,  label: '右嘴角',   pose_min: -1.0, pose_max: 1.0, us_min: 1750, us_neutral: 1500, us_max: 1250 },
    { id: 'neck_yaw',    pca: 10, label: '脖子左右', pose_min: -1.0, pose_max: 1.0, us_min: 1100, us_neutral: 1500, us_max: 1900 },
    { id: 'neck_pitch',  pca: 11, label: '脖子俯仰', pose_min: -1.0, pose_max: 1.0, us_min: 1300, us_neutral: 1500, us_max: 1700 }
  ];
  var PWM = { frequency_hz: 50, hard_min_us: 500, hard_max_us: 2500, default_limit_min_us: 900, default_limit_max_us: 2100 };
  var PCA_CHANNELS = 16;
  var CHANNEL_IDS = CHANNELS.map(function (c) { return c.id; });
  var CHANNEL_BY_ID = {};
  CHANNELS.forEach(function (c) { CHANNEL_BY_ID[c.id] = c; });

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ───────────────────────── 姿态 ─────────────────────────
  function neutralPose() {
    var p = {};
    for (var i = 0; i < CHANNEL_IDS.length; i++) p[CHANNEL_IDS[i]] = 0;
    return p;
  }
  /** 补全缺失通道并钳制到 pose_min / pose_max。非数字按 0 处理。 */
  function clampPose(pose) {
    var out = {};
    for (var i = 0; i < CHANNELS.length; i++) {
      var c = CHANNELS[i];
      var v = pose ? Number(pose[c.id]) : 0;
      if (!isFinite(v)) v = 0;
      out[c.id] = clamp(v, c.pose_min, c.pose_max) + 0;   // “+ 0” 把 -0 归一成 0
    }
    return out;
  }
  function addPose(a, b, scale) {
    var out = {};
    var s = scale === undefined ? 1 : scale;
    for (var i = 0; i < CHANNEL_IDS.length; i++) {
      var id = CHANNEL_IDS[i];
      out[id] = ((a && a[id]) || 0) + ((b && b[id]) || 0) * s;
    }
    return out;
  }

  // ───────────────────────── 表情预设（只写非零通道） ─────────────────────────
  var EMOTIONS = {
    neutral:   {},
    happy:     { mouth_l: 0.85, mouth_r: 0.85, lid_lower: 0.45, brow_l: 0.2, brow_r: 0.2, lid_upper_l: 0.08, lid_upper_r: 0.08 },
    sad:       { brow_l: 0.85, brow_r: 0.85, mouth_l: -0.7, mouth_r: -0.7, lid_upper_l: 0.3, lid_upper_r: 0.3, eye_tilt: -0.3, neck_pitch: -0.3 },
    angry:     { brow_l: -0.95, brow_r: -0.95, mouth_l: -0.5, mouth_r: -0.5, lid_upper_l: 0.2, lid_upper_r: 0.2, lid_lower: 0.45, neck_pitch: -0.1 },
    surprised: { brow_l: 0.95, brow_r: 0.95, lid_upper_l: -0.3, lid_upper_r: -0.3, jaw: 0.5, neck_pitch: 0.12 },
    fear:      { brow_l: 0.75, brow_r: 0.75, lid_upper_l: -0.3, lid_upper_r: -0.3, jaw: 0.25, mouth_l: -0.4, mouth_r: -0.4, neck_pitch: -0.12 },
    disgust:   { brow_l: -0.65, brow_r: -0.25, lid_lower: 0.6, lid_upper_l: 0.25, lid_upper_r: 0.25, mouth_l: -0.55, mouth_r: -0.2, neck_yaw: -0.12 },
    sleepy:    { lid_upper_l: 0.68, lid_upper_r: 0.68, brow_l: -0.1, brow_r: -0.1, eye_tilt: -0.2, neck_pitch: -0.35, mouth_l: -0.1, mouth_r: -0.1 },
    thinking:  { eye_pan: 0.55, eye_tilt: 0.6, brow_l: 0.55, brow_r: -0.25, mouth_l: -0.15, mouth_r: 0.25, neck_yaw: 0.15, neck_pitch: 0.1 },
    shy:       { eye_pan: -0.45, eye_tilt: -0.5, neck_pitch: -0.3, neck_yaw: -0.2, mouth_l: 0.45, mouth_r: 0.45, lid_upper_l: 0.28, lid_upper_r: 0.28, lid_lower: 0.3, brow_l: 0.3, brow_r: 0.3 },
    wink:      { lid_upper_l: 1.0, lid_lower: 0.5, mouth_l: 0.75, mouth_r: 0.5, brow_r: 0.35, brow_l: -0.1, neck_yaw: 0.08 }
  };
  var EMOTION_NAMES = Object.keys(EMOTIONS);
  var EMOTION_LABELS = {
    neutral: '平静', happy: '开心', sad: '难过', angry: '生气', surprised: '惊讶', fear: '害怕',
    disgust: '嫌弃', sleepy: '困', thinking: '思考', shy: '害羞', wink: '眨眼'
  };

  /** 取某个表情在给定强度下的完整姿态（未钳制前即在范围内）。未知名字按 neutral。 */
  function emotionPose(name, intensity) {
    var preset = EMOTIONS[name] || EMOTIONS.neutral;
    var k = intensity === undefined ? 1 : clamp(Number(intensity) || 0, 0, 1);
    var p = neutralPose();
    for (var id in preset) if (Object.prototype.hasOwnProperty.call(preset, id)) p[id] = preset[id] * k;
    return clampPose(p);
  }

  // ───────────────────────── 随机数 ─────────────────────────
  /** 可复现的伪随机数发生器，测试里用固定种子。 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────────────────────── 临界阻尼弹簧 ─────────────────────────
  // 用解析解推进，所以结果与帧间隔 dt 无关（20 ms 一步和 1 ms 二十步得到同样的值）。
  function Spring(omega, x0) {
    this.omega = omega;
    this.x = x0 || 0;
    this.v = 0;
    this.target = x0 || 0;
  }
  Spring.prototype.step = function (dt) {
    if (!(dt > 0)) return this.x;
    var w = this.omega;
    var d = this.x - this.target;
    var e = Math.exp(-w * dt);
    var t = (this.v + w * d) * dt;
    this.x = this.target + (d + t) * e;
    this.v = (this.v - w * t) * e;
    return this.x;
  };
  Spring.prototype.snap = function (x) { this.x = x; this.target = x; this.v = 0; };

  // 各通道的角频率（rad/s）：眼球和眼皮快，眉毛嘴角中等，脖子慢。
  var SPRING_OMEGA = {
    eye_pan: 42, eye_tilt: 42,
    lid_upper_l: 38, lid_upper_r: 38, lid_lower: 30,
    brow_l: 14, brow_r: 14,
    jaw: 26,
    mouth_l: 13, mouth_r: 13,
    neck_yaw: 5, neck_pitch: 5
  };

  // ───────────────────────── 眨眼 ─────────────────────────
  // 一次眨眼：闭合 60 ms + 停顿 30 ms + 睁开 110 ms，眼皮闭合过半的时间约 130 ms。
  var BLINK = { closeS: 0.06, holdS: 0.03, openS: 0.11, minGapS: 2.0, maxGapS: 6.0, doubleProb: 0.15, doubleGapS: 0.12 };

  function Blinker(rng) {
    this.rng = rng || Math.random;
    this.t = 0;                 // 当前这次眨眼已进行的时间
    this.active = false;
    this.wait = this._gap();    // 距离下一次眨眼还有多久
    this.secondPending = false; // 连眨：第二下还没开始
    this.isSecond = false;      // 正在进行的是连眨的第二下
    this.count = 0;             // 已开始的眨眼次数
  }
  Blinker.prototype._gap = function () { return lerp(BLINK.minGapS, BLINK.maxGapS, this.rng()); };
  Blinker.prototype.duration = function () { return BLINK.closeS + BLINK.holdS + BLINK.openS; };
  Blinker.prototype._start = function () {
    this.active = true; this.t = 0; this.count++;
    this.isSecond = this.secondPending;
    this.secondPending = false;
  };
  /** 立即眨一次（例如刚换表情时）。 */
  Blinker.prototype.trigger = function () { if (!this.active) { this.secondPending = false; this._start(); } };
  /**
   * 推进 dt 秒，返回眨眼量 0..1。suppress 为真时不发起新的眨眼（单眼眨眼表情期间用），
   * 已经开始的那一次会正常做完。
   */
  Blinker.prototype.update = function (dt, suppress) {
    if (this.active) {
      this.t += dt;
      if (this.t < this.duration()) return this.value();
      this.active = false;
      this.wait = this._gap();
      // 只有普通眨眼结束时才可能接一次连眨，第二下之后一定回到正常间隔
      if (!this.isSecond && this.rng() < BLINK.doubleProb) { this.secondPending = true; this.wait = BLINK.doubleGapS; }
      this.isSecond = false;
      return 0;
    }
    if (suppress) {
      this.secondPending = false;
      if (this.wait < 0.4) this.wait = 0.4;   // 解除压制后不会立刻眨
      return 0;
    }
    this.wait -= dt;
    if (this.wait <= 0) { this._start(); return this.value(); }
    return 0;
  };
  Blinker.prototype.value = function () {
    if (!this.active) return 0;
    var t = this.t;
    if (t < BLINK.closeS) { var a = t / BLINK.closeS; return a * a * (3 - 2 * a); }
    t -= BLINK.closeS;
    if (t < BLINK.holdS) return 1;
    t -= BLINK.holdS;
    var b = clamp(t / BLINK.openS, 0, 1);
    return 1 - b * b * (3 - 2 * b);
  };

  // ───────────────────────── 眼球微跳 ─────────────────────────
  function Saccader(rng) {
    this.rng = rng || Math.random;
    this.wait = lerp(0.8, 3.0, this.rng());
    this.dx = 0; this.dy = 0;
    this.count = 0;
  }
  Saccader.prototype.update = function (dt) {
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = lerp(0.8, 3.0, this.rng());
      this.count++;
      if (this.rng() < 0.3) { this.dx = 0; this.dy = 0; }          // 三成概率回到正中
      else {
        this.dx = (this.rng() * 2 - 1) * 0.14;
        this.dy = (this.rng() * 2 - 1) * 0.09;
      }
    }
    return { eye_pan: this.dx, eye_tilt: this.dy };
  };

  // ───────────────────────── 脖子缓慢漂移 ─────────────────────────
  function NeckDrift(rng) {
    var r = rng || Math.random;
    this.t = 0;
    this.p = [r() * 6.283, r() * 6.283, r() * 6.283, r() * 6.283];
  }
  NeckDrift.prototype.update = function (dt) {
    this.t += dt;
    var t = this.t, p = this.p;
    return {
      neck_yaw: 0.045 * Math.sin(0.23 * t + p[0]) + 0.03 * Math.sin(0.11 * t + p[1]),
      neck_pitch: 0.03 * Math.sin(0.19 * t + p[2]) + 0.02 * Math.sin(0.07 * t + p[3])
    };
  };

  // ───────────────────────── 注视 ─────────────────────────
  // 目标 (x, y) ∈ [-1, 1]：x 正 = 机器人的左侧（观察者看到的右边），y 正 = 上。
  // 眼球先到，脖子慢慢跟上；脖子转过去多少，眼球就回正多少。
  function Gaze() {
    this.x = 0; this.y = 0;
    this.neckX = new Spring(3.2, 0);
    this.neckY = new Spring(3.2, 0);
    this.neckShare = 0.5;
  }
  Gaze.prototype.set = function (x, y) {
    this.x = clamp(Number(x) || 0, -1, 1);
    this.y = clamp(Number(y) || 0, -1, 1);
  };
  Gaze.prototype.update = function (dt) {
    this.neckX.target = this.x * this.neckShare;
    this.neckY.target = this.y * this.neckShare;
    var nx = this.neckX.step(dt), ny = this.neckY.step(dt);
    return {
      eye_pan: clamp(this.x - nx, -1, 1),
      eye_tilt: clamp(this.y - ny, -1, 1),
      neck_yaw: nx,
      neck_pitch: ny
    };
  };

  // ───────────────────────── 口型 ─────────────────────────
  /**
   * 音量驱动的口型。每帧喂入音量 level(0..1) 和可选的高频占比 hi(0..1)。
   * 下颌张开快（约 25 ms）、合上慢（约 90 ms），嘴角随高频略微外展（“衣”）或收拢（“乌”）。
   */
  function LipSync(opts) {
    opts = opts || {};
    this.gate = opts.gate === undefined ? 0.04 : opts.gate;
    this.gain = opts.gain === undefined ? 1.6 : opts.gain;
    this.attackS = opts.attackS || 0.025;
    this.releaseS = opts.releaseS || 0.09;
    this.jaw = 0;
    this.corner = 0;
  }
  LipSync.prototype.update = function (dt, level, hi) {
    var lv = clamp(Number(level) || 0, 0, 1);
    var x = lv <= this.gate ? 0 : (lv - this.gate) / (1 - this.gate);
    var target = clamp(Math.pow(x * this.gain, 0.7), 0, 1);
    var tau = target > this.jaw ? this.attackS : this.releaseS;
    var k = dt > 0 ? 1 - Math.exp(-dt / tau) : 0;
    this.jaw += (target - this.jaw) * k;
    if (this.jaw < 1e-4) this.jaw = 0;
    var h = hi === undefined || hi === null ? 0.5 : clamp(Number(hi) || 0, 0, 1);
    var cTarget = (h - 0.5) * 0.5 * Math.min(1, this.jaw * 2.5);
    var kc = dt > 0 ? 1 - Math.exp(-dt / 0.06) : 0;
    this.corner += (cTarget - this.corner) * kc;
    return { jaw: this.jaw, corner: this.corner };
  };
  LipSync.prototype.reset = function () { this.jaw = 0; this.corner = 0; };

  function isCJK(ch) {
    var c = ch.charCodeAt(0);
    return (c >= 0x3400 && c <= 0x9FFF) || (c >= 0x3040 && c <= 0x30FF) || (c >= 0xAC00 && c <= 0xD7AF);
  }
  var PAUSE_LONG = '。！？!?…\n';
  var PAUSE_SHORT = '，、；：,;:—';

  /**
   * 文字驱动的口型包络：拿不到真实音频采样时（例如浏览器自带的语音合成）用它凑口型。
   * 每个汉字算一个音节，英文按元音组估音节，标点处停顿。
   * 返回 { duration, levelAt(t), timeOfChar(i) }，时间单位秒。
   */
  function textEnvelope(text, rate) {
    var r = rate && rate > 0 ? rate : 1;
    var syl = 0.2 / r, shortP = 0.16 / r, longP = 0.32 / r;
    var pulses = [];           // {t0, dur, amp}
    var charTime = [];
    var t = 0, i = 0, s = String(text || '');
    while (i < s.length) {
      var ch = s[i];
      charTime[i] = t;
      if (isCJK(ch)) {
        var code = ch.charCodeAt(0);
        pulses.push({ t0: t, dur: syl, amp: 0.55 + ((code * 37) % 45) / 100 });
        t += syl; i++;
      } else if (/[A-Za-z0-9]/.test(ch)) {
        var j = i;
        while (j < s.length && /[A-Za-z0-9']/.test(s[j])) { charTime[j] = t; j++; }
        var word = s.slice(i, j);
        var groups = word.match(/[aeiouyAEIOUY]+/g);
        var n = Math.max(1, groups ? groups.length : Math.ceil(word.length / 3));
        if (/^[0-9]+$/.test(word)) n = word.length;
        var d = 0.17 / r;
        for (var q = 0; q < n; q++) {
          pulses.push({ t0: t + q * d, dur: d, amp: 0.5 + ((word.charCodeAt(q % word.length) * 29) % 50) / 100 });
        }
        for (var m = i; m < j; m++) charTime[m] = t + ((m - i) / (j - i)) * n * d;
        t += n * d; i = j;
      } else if (PAUSE_LONG.indexOf(ch) >= 0) { t += longP; i++; }
      else if (PAUSE_SHORT.indexOf(ch) >= 0) { t += shortP; i++; }
      else if (ch === ' ') { t += 0.03 / r; i++; }
      else { i++; }
    }
    charTime[s.length] = t;
    var duration = t;
    return {
      duration: duration,
      pulseCount: pulses.length,
      levelAt: function (time) {
        if (!(time >= 0) || time > duration) return 0;
        var lv = 0;
        for (var k = 0; k < pulses.length; k++) {
          var p = pulses[k];
          if (time < p.t0) break;
          var u = (time - p.t0) / p.dur;
          if (u <= 1) {
            var v = p.amp * 0.5 * (1 - Math.cos(2 * Math.PI * u));   // 升余弦脉冲
            if (v > lv) lv = v;
          }
        }
        return clamp(lv, 0, 1);
      },
      timeOfChar: function (idx) {
        var n2 = clamp(Math.floor(Number(idx) || 0), 0, s.length);
        return charTime[n2] === undefined ? duration : charTime[n2];
      }
    };
  }

  // ───────────────────────── 合成 ─────────────────────────
  /**
   * 把各层叠成最终姿态。优先级从低到高：
   *   base（表情 + 注视 + 待机，已平滑）
   *   → 上眼皮跟随眼球俯仰（往下看时眼皮跟着落，往上看时略微抬起）
   *   → 口型：下颌取 max(表情, 口型)，嘴角叠加
   *   → 眨眼：把上眼皮推向闭合，覆盖表情
   *   → 钳制
   * layers = { base, lip:{jaw,corner}, blink: 数字 或 {l, r} }
   */
  function composePose(layers) {
    var base = (layers && layers.base) || {};
    var p = {};
    for (var i = 0; i < CHANNEL_IDS.length; i++) p[CHANNEL_IDS[i]] = Number(base[CHANNEL_IDS[i]]) || 0;

    var tilt = clamp(p.eye_tilt, -1, 1);
    var follow = tilt < 0 ? -tilt * 0.35 : -tilt * 0.15;
    p.lid_upper_l += follow;
    p.lid_upper_r += follow;

    var lip = layers && layers.lip;
    if (lip) {
      var jaw = Number(lip.jaw) || 0;
      if (jaw > p.jaw) p.jaw = jaw;
      var corner = Number(lip.corner) || 0;
      p.mouth_l += corner;
      p.mouth_r += corner;
    }

    var blink = layers && layers.blink;
    if (blink !== undefined && blink !== null) {
      var bl = typeof blink === 'number' ? blink : Number(blink.l) || 0;
      var br = typeof blink === 'number' ? blink : Number(blink.r) || 0;
      bl = clamp(bl, 0, 1); br = clamp(br, 0, 1);
      p.lid_upper_l = lerp(p.lid_upper_l, 1, bl);
      p.lid_upper_r = lerp(p.lid_upper_r, 1, br);
      // 眨眼时下眼皮略微上提
      p.lid_lower = Math.max(p.lid_lower, 0.25 * Math.max(bl, br));
    }
    return clampPose(p);
  }

  // ───────────────────────── 校准：姿态 ↔ 脉宽 ─────────────────────────
  function defaultCalibration() {
    var cal = {};
    CHANNELS.forEach(function (c) { cal[c.id] = { us_min: c.us_min, us_neutral: c.us_neutral, us_max: c.us_max }; });
    return cal;
  }
  function validUs(v) { return typeof v === 'number' && isFinite(v) && v >= PWM.hard_min_us && v <= PWM.hard_max_us; }
  /** 把（可能不完整的）覆盖值合并到默认校准上，非法值丢弃。 */
  function mergeCalibration(overrides) {
    var cal = defaultCalibration();
    if (overrides && typeof overrides === 'object') {
      CHANNEL_IDS.forEach(function (id) {
        var o = overrides[id];
        if (!o || typeof o !== 'object') return;
        ['us_min', 'us_neutral', 'us_max'].forEach(function (k) {
          var v = Number(o[k]);
          if (o[k] !== undefined && o[k] !== null && o[k] !== '' && validUs(v)) cal[id][k] = Math.round(v);
        });
      });
    }
    // pose_min 为 0 的通道没有负半程，us_min 跟随中位
    CHANNELS.forEach(function (c) { if (c.pose_min === 0) cal[c.id].us_min = cal[c.id].us_neutral; });
    return cal;
  }
  function exportCalibration(cal) {
    return JSON.stringify({ rig: 'RF-01', version: 1, calibration: mergeCalibration(cal) }, null, 2);
  }
  /** 解析导入的 JSON。成功返回校准对象，格式不对抛出带中文说明的 Error。 */
  function importCalibration(json) {
    var obj;
    try { obj = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { throw new Error('不是合法的 JSON 文件'); }
    if (!obj || typeof obj !== 'object') throw new Error('校准文件内容为空');
    var src = obj.calibration && typeof obj.calibration === 'object' ? obj.calibration : obj;
    var seen = 0;
    CHANNEL_IDS.forEach(function (id) {
      var o = src[id];
      if (!o) return;
      ['us_min', 'us_neutral', 'us_max'].forEach(function (k) {
        if (o[k] === undefined) return;
        if (!validUs(Number(o[k]))) throw new Error('通道 ' + id + ' 的 ' + k + ' 超出 ' + PWM.hard_min_us + '–' + PWM.hard_max_us + ' µs');
        seen++;
      });
    });
    if (!seen) throw new Error('文件里没有找到任何通道的校准值');
    return mergeCalibration(src);
  }

  /** 单通道：姿态值 → 脉宽（µs，整数）。经过 (pose_min, us_min)、(0, us_neutral)、(pose_max, us_max) 的折线。 */
  function poseToUs(id, value, cal) {
    var c = CHANNEL_BY_ID[id];
    if (!c) throw new Error('未知通道 ' + id);
    var k = (cal && cal[id]) || c;
    var v = clamp(Number(value) || 0, c.pose_min, c.pose_max);
    var us;
    if (v >= 0) us = c.pose_max > 0 ? lerp(k.us_neutral, k.us_max, v / c.pose_max) : k.us_neutral;
    else us = c.pose_min < 0 ? lerp(k.us_neutral, k.us_min, v / c.pose_min) : k.us_neutral;
    return Math.round(clamp(us, PWM.hard_min_us, PWM.hard_max_us));
  }
  /** 单通道：脉宽 → 姿态值（poseToUs 的逆，仿真器用它，这样校准填错了能直接看出来）。 */
  function usToPose(id, us, cal) {
    var c = CHANNEL_BY_ID[id];
    if (!c) throw new Error('未知通道 ' + id);
    var k = (cal && cal[id]) || c;
    var u = Number(us);
    if (!isFinite(u) || u <= 0) return 0;                 // 0 = 该路松开，按中位画
    var dPos = k.us_max - k.us_neutral;
    var dNeg = k.us_min - k.us_neutral;
    var d = u - k.us_neutral;
    var v = 0;
    if (d === 0) v = 0;
    else if (dPos !== 0 && d * dPos > 0) v = c.pose_max * d / dPos;
    else if (dNeg !== 0 && d * dNeg > 0) v = c.pose_min * d / dNeg;
    else if (dPos !== 0) v = c.pose_max * d / dPos;       // 没有负半程：沿正半程外推后钳制
    return clamp(v, c.pose_min, c.pose_max);
  }
  /** 整个姿态 → 16 路脉宽数组（按 PCA9685 通道号排，未用通道为 0）。 */
  function poseToUsArray(pose, cal) {
    var arr = new Array(PCA_CHANNELS);
    for (var i = 0; i < PCA_CHANNELS; i++) arr[i] = 0;
    CHANNELS.forEach(function (c) { arr[c.pca] = poseToUs(c.id, pose ? pose[c.id] : 0, cal); });
    return arr;
  }
  function usArrayToPose(arr, cal) {
    var p = {};
    CHANNELS.forEach(function (c) { p[c.id] = usToPose(c.id, arr ? arr[c.pca] : 0, cal); });
    return p;
  }
  /** 由校准值推出每路建议的硬限位（三点范围外各留 margin µs）。 */
  function limitsFromCalibration(cal, margin) {
    var m = margin === undefined ? 20 : margin;
    var full = mergeCalibration(cal);
    return CHANNELS.map(function (c) {
      var k = full[c.id];
      var lo = Math.min(k.us_min, k.us_neutral, k.us_max) - m;
      var hi = Math.max(k.us_min, k.us_neutral, k.us_max) + m;
      return { ch: c.pca, min: clamp(lo, PWM.hard_min_us, PWM.hard_max_us - 1), max: clamp(hi, PWM.hard_min_us + 1, PWM.hard_max_us) };
    });
  }

  // ───────────────────────── 串口协议（docs/PROTOCOL.md） ─────────────────────────
  /** NMEA 式校验：所有字节按位异或，两位大写十六进制。 */
  function checksum(body) {
    var x = 0;
    for (var i = 0; i < body.length; i++) x ^= body.charCodeAt(i) & 0xFF;
    var h = x.toString(16).toUpperCase();
    return h.length < 2 ? '0' + h : h;
  }
  function encodeLine(body) { return body + '*' + checksum(body) + '\n'; }
  /** P 帧。count 缺省为已定义的通道数（12）；值取整，0 表示该路松开。 */
  function encodeFrame(usArray, count) {
    var n = count === undefined ? CHANNELS.length : clamp(count | 0, 1, PCA_CHANNELS);
    var parts = [];
    for (var i = 0; i < n; i++) {
      var v = Math.round(Number(usArray && usArray[i]) || 0);
      parts.push(v > 0 ? clamp(v, PWM.hard_min_us, PWM.hard_max_us) : 0);
    }
    return encodeLine('P ' + parts.join(' '));
  }
  function encodeLimit(ch, min, max) {
    var c = ch | 0, lo = Math.round(min), hi = Math.round(max);
    if (c < 0 || c >= PCA_CHANNELS) throw new Error('通道号超出 0–15');
    if (!(lo >= PWM.hard_min_us && lo < hi && hi <= PWM.hard_max_us)) throw new Error('限位必须满足 500 ≤ min < max ≤ 2500');
    return encodeLine('L ' + c + ' ' + lo + ' ' + hi);
  }
  function encodeHello() { return encodeLine('?'); }
  function encodeRelease() { return encodeLine('R'); }
  function encodeLimitQuery() { return encodeLine('L?'); }
  function encodeSlew(usPerS) { return encodeLine('V ' + Math.max(0, Math.round(Number(usPerS) || 0))); }
  function encodeWatchdog(ms) { return encodeLine('T ' + Math.max(0, Math.round(Number(ms) || 0))); }
  /** 校验一行（可带 *HH）。返回 { ok, body }。 */
  function verifyLine(line) {
    var s = String(line).replace(/[\r\n]+$/, '');
    var star = s.lastIndexOf('*');
    if (star < 0) return { ok: true, body: s };
    var body = s.slice(0, star), hh = s.slice(star + 1);
    return { ok: /^[0-9A-Fa-f]{2}$/.test(hh) && hh.toUpperCase() === checksum(body), body: body };
  }
  /** 解析握手回复 `RF1 fw=0.1.0 ch=16 hz=50`，不是握手行返回 null。 */
  function parseHello(line) {
    var m = /^RF(\d+)\s+(.*)$/.exec(String(line).trim());
    if (!m) return null;
    var out = { proto: Number(m[1]), fw: '', ch: 0, hz: 0 };
    m[2].split(/\s+/).forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] === 'fw') out.fw = p[1] || '';
      else if (p[0] === 'ch') out.ch = Number(p[1]) || 0;
      else if (p[0] === 'hz') out.hz = Number(p[1]) || 0;
    });
    return out;
  }
  /** 解析下位机的一行回复。 */
  function parseReply(line) {
    var s = String(line).trim();
    if (!s) return { type: 'empty' };
    var hello = parseHello(s);
    if (hello) return { type: 'hello', hello: hello };
    if (s === 'OK') return { type: 'ok' };
    var e = /^ERR\s+(\d+)\s*(.*)$/.exec(s);
    if (e) return { type: 'err', code: Number(e[1]), message: e[2] };
    var l = /^L\s+(\d+)\s+(\d+)\s+(\d+)$/.exec(s);
    if (l) return { type: 'limit', ch: Number(l[1]), min: Number(l[2]), max: Number(l[3]) };
    return { type: 'other', text: s };
  }
  var ERR_TEXT = { 1: '校验错误', 2: '格式错误', 3: '数值越界', 4: '未知命令' };

  // ───────────────────────── 大模型回复解析 ─────────────────────────
  /**
   * 流式剥离表情标签。模型的回复形如 `[happy]你好呀！[thinking]让我想想…`，
   * 标签可能被切在两个分片中间，所以遇到 `[` 先攒着，凑齐再判断。
   *   已知标签 → 发出 {type:'emotion', name}，不进正文
   *   像标签但不认识（纯字母下划线）→ 丢弃
   *   其它方括号内容（如 [1]、[注]）→ 原样当正文
   * 也接受 `[emotion:happy]` 和全角 `【happy】`。
   */
  function TagStreamParser(validTags) {
    this.valid = {};
    var list = validTags || EMOTION_NAMES;
    for (var i = 0; i < list.length; i++) this.valid[String(list[i]).toLowerCase()] = true;
    this.buf = '';
    this.maxTag = 28;
  }
  TagStreamParser.prototype.feed = function (chunk) {
    var out = [];
    var text = '';
    var s = String(chunk === undefined || chunk === null ? '' : chunk);
    function flushText() { if (text) { out.push({ type: 'text', text: text }); text = ''; } }
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (this.buf) {
        if (ch === ']' || ch === '】') {
          var inner = this.buf.slice(1).trim().toLowerCase().replace(/^(emotion|emo|表情)\s*[:：]\s*/, '');
          if (this.valid[inner]) { flushText(); out.push({ type: 'emotion', name: inner }); }
          else if (/^[a-z_]{1,20}$/.test(inner)) { /* 不认识的标签：丢弃 */ }
          else text += this.buf + ch;
          this.buf = '';
        } else if (ch === '[' || ch === '【') {
          text += this.buf; this.buf = ch;                 // 前一个不是标签，重新开始
        } else {
          this.buf += ch;
          if (this.buf.length > this.maxTag || ch === '\n') { text += this.buf; this.buf = ''; }
        }
      } else if (ch === '[' || ch === '【') {
        this.buf = ch;
      } else {
        text += ch;
      }
    }
    flushText();
    return out;
  };
  /** 流结束：把没凑成标签的残留当正文吐出来。 */
  TagStreamParser.prototype.end = function () {
    var out = [];
    if (this.buf) { out.push({ type: 'text', text: this.buf }); this.buf = ''; }
    return out;
  };

  /** 一次性处理整段文本，返回 { text, emotions }。 */
  function stripTags(str, validTags) {
    var p = new TagStreamParser(validTags);
    var ev = p.feed(str).concat(p.end());
    var text = '', emotions = [];
    ev.forEach(function (e) { if (e.type === 'text') text += e.text; else emotions.push(e.name); });
    return { text: text, emotions: emotions };
  }

  /**
   * 流式断句，给语音合成用。按中西文句末标点切；小数点（3.14）和省略号不会切碎。
   * feed() 返回已完整的句子数组，flush() 吐出最后的残句。
   */
  function SentenceSplitter(opts) {
    this.buf = '';
    this.maxLen = (opts && opts.maxLen) || 60;
  }
  var SENT_END = '。！？!?；;\n…';
  var SENT_TRAIL = '。！？!?；;…”’」』）)"\'';
  SentenceSplitter.prototype.feed = function (chunk) {
    this.buf += String(chunk === undefined || chunk === null ? '' : chunk);
    var out = [];
    var start = 0, b = this.buf, i = 0;
    while (i < b.length) {
      var ch = b[i];
      var end = false;
      if (SENT_END.indexOf(ch) >= 0) end = true;
      else if (ch === '.') {
        var prev = b[i - 1], next = b[i + 1];
        if (next === undefined) { break; }                       // 句点在分片末尾：等下一片再判断
        if (/[0-9]/.test(prev || '') && /[0-9]/.test(next)) end = false;   // 小数
        else if (next === '.' || prev === '.') end = next !== '.';         // 省略号 ... 的最后一个点才切
        else end = /[\s"'”’)）]/.test(next);
      } else if ((ch === '，' || ch === ',') && i - start >= this.maxLen) end = true;   // 太长的句子在逗号处切
      if (end) {
        var j = i + 1;
        while (j < b.length && SENT_TRAIL.indexOf(b[j]) >= 0) j++;
        if (j === b.length && ch !== '\n') {
          // 标点串可能还没收完（例如 “？” 后面还跟着 “！”），留到下一片
          break;
        }
        var seg = b.slice(start, j).trim();
        if (seg) out.push(seg);
        start = j; i = j;
        continue;
      }
      i++;
    }
    this.buf = b.slice(start);
    return out;
  };
  SentenceSplitter.prototype.flush = function () {
    var s = this.buf.trim();
    this.buf = '';
    return s ? [s] : [];
  };
  function splitSentences(text) {
    var sp = new SentenceSplitter();
    return sp.feed(text).concat(sp.flush());
  }

  // ───────────────────────── 面部捕捉（MediaPipe blendshapes）→ 姿态 ─────────────────────────
  /**
   * MediaPipe 的 “Left / Right” 指被拍的人自己的左右。
   * mirror = true（默认，镜像模式）：机器人像一面镜子——你闭左眼，它闭的是你左手边的那只，
   *   也就是机器人自己的右眼；你往左看，它也朝房间的同一侧看（对它来说是右）。
   * mirror = false：按解剖学左右一一对应（你的左眼 → 它的左眼）。
   */
  function blendshapesToPose(bs, opts) {
    var mirror = !opts || opts.mirror !== false;
    function g(name) { var v = bs ? Number(bs[name]) : 0; return isFinite(v) ? clamp(v, 0, 1) : 0; }
    function side(a, b) { return mirror ? [b, a] : [a, b]; }   // 返回 [机器人左, 机器人右]

    // 被拍者朝自己左侧看的程度（左眼外转 + 右眼内转）
    var lookLeft = (g('eyeLookOutLeft') + g('eyeLookInRight')) / 2 - (g('eyeLookInLeft') + g('eyeLookOutRight')) / 2;
    var lookUp = (g('eyeLookUpLeft') + g('eyeLookUpRight')) / 2 - (g('eyeLookDownLeft') + g('eyeLookDownRight')) / 2;

    function lid(blink, wide) {
      var closed = clamp((blink - 0.12) / 0.55, 0, 1);
      return closed > 0 ? closed : -0.3 * clamp((wide - 0.1) / 0.6, 0, 1);
    }
    var lids = side(lid(g('eyeBlinkLeft'), g('eyeWideLeft')), lid(g('eyeBlinkRight'), g('eyeWideRight')));
    var inner = g('browInnerUp');
    var brows = side(inner + 0.3 * g('browOuterUpLeft') - 1.2 * g('browDownLeft'),
                     inner + 0.3 * g('browOuterUpRight') - 1.2 * g('browDownRight'));
    var mouths = side(1.3 * g('mouthSmileLeft') - 1.5 * g('mouthFrownLeft'),
                      1.3 * g('mouthSmileRight') - 1.5 * g('mouthFrownRight'));
    var squint = Math.max((g('eyeSquintLeft') + g('eyeSquintRight')) / 2, (g('cheekSquintLeft') + g('cheekSquintRight')) / 2);

    return clampPose({
      eye_pan: (mirror ? -1 : 1) * lookLeft * 1.6,
      eye_tilt: lookUp * 1.6,
      lid_upper_l: lids[0],
      lid_upper_r: lids[1],
      lid_lower: clamp((squint - 0.1) * 1.4, 0, 1),
      brow_l: brows[0],
      brow_r: brows[1],
      jaw: g('jawOpen') * 1.4,
      mouth_l: mouths[0],
      mouth_r: mouths[1],
      neck_yaw: 0,
      neck_pitch: 0
    });
  }

  // ───────────────────────── 大模型请求（纯函数，便于测试） ─────────────────────────
  var DEFAULT_MODEL = 'claude-opus-5-5';
  var DEFAULT_SYSTEM_PROMPT =
    '你是一台放在桌面上的小机器人，有一张会动的脸。你通过语音和人聊天，所以：\n' +
    '1. 每次只说 1–3 句简短、口语化的中文，不用列表、不用 Markdown、不用表情符号。\n' +
    '2. 每次回复的最前面必须带且只带一个表情标签，从下面选：\n' +
    '   [neutral] [happy] [sad] [angry] [surprised] [fear] [disgust] [sleepy] [thinking] [shy] [wink]\n' +
    '3. 如果后面某一句的情绪变了，可以在那一句前面再加一个标签。\n' +
    '4. 标签只用上面这些英文单词，不要解释标签，也不要把它读出来。\n' +
    '示例：[happy]你回来啦！[thinking]今天想聊点什么呢？';

  function trimBase(base) { return String(base || '').trim().replace(/\/+$/, ''); }
  function hostOf(url) {
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:]+)/i.exec(String(url || ''));
    return m ? m[1].toLowerCase() : '';
  }
  /**
   * Anthropic 原生 Messages 接口（流式）。
   * 不发 temperature / top_p / top_k，不发 thinking，不预填 assistant。
   * 只有直连 api.anthropic.com 时才带服务端回退参数（中转站多半不认）。
   */
  function buildAnthropicRequest(cfg, system, messages) {
    var base = trimBase(cfg.baseUrl) || 'https://api.anthropic.com';
    var url = /\/v1$/.test(base) ? base + '/messages' : (/\/v1\/messages$/.test(base) ? base : base + '/v1/messages');
    var headers = {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey || '',
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    var body = {
      model: cfg.model || DEFAULT_MODEL,
      max_tokens: 2000,
      stream: true,
      system: system || '',
      messages: messages,
      output_config: { effort: 'low' }
    };
    if (hostOf(base) === 'api.anthropic.com') {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    return { url: url, headers: headers, body: body };
  }
  /** OpenAI 兼容接口（中转站、DeepSeek 等）。 */
  function buildOpenAIRequest(cfg, system, messages) {
    var base = trimBase(cfg.baseUrl) || 'https://api.openai.com/v1';
    var url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
    var msgs = system ? [{ role: 'system', content: system }].concat(messages) : messages.slice();
    return {
      url: url,
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + (cfg.apiKey || '') },
      body: { model: cfg.model || '', stream: true, messages: msgs }
    };
  }

  /** SSE 分片解析：feed(文本分片) 返回 [{event, data}]，分片可以切在任意位置。 */
  function SSEParser() { this.buf = ''; this.event = ''; this.data = []; }
  SSEParser.prototype.feed = function (chunk) {
    this.buf += chunk;
    var out = [];
    var idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      var line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
      if (line === '') {
        if (this.data.length) out.push({ event: this.event || 'message', data: this.data.join('\n') });
        this.event = ''; this.data = [];
      } else if (line.charAt(0) === ':') { /* 注释行 */ }
      else {
        var c = line.indexOf(':');
        var field = c < 0 ? line : line.slice(0, c);
        var val = c < 0 ? '' : line.slice(c + 1);
        if (val.charAt(0) === ' ') val = val.slice(1);
        if (field === 'event') this.event = val;
        else if (field === 'data') this.data.push(val);
      }
    }
    return out;
  };
  SSEParser.prototype.end = function () {
    var out = [];
    if (this.data.length) out.push({ event: this.event || 'message', data: this.data.join('\n') });
    this.event = ''; this.data = [];
    return out;
  };

  /**
   * 把一条 SSE 事件翻译成统一的增量。返回
   *   { text } 文本增量 | { stop: 原因 } | { error: 说明 } | { done: true } | null（忽略）
   */
  function interpretSSE(provider, ev) {
    if (!ev || ev.data === undefined) return null;
    if (ev.data === '[DONE]') return { done: true };
    var j;
    try { j = JSON.parse(ev.data); } catch (e) { return null; }
    if (!j || typeof j !== 'object') return null;
    if (provider === 'anthropic') {
      if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') return { text: j.delta.text || '' };
      if (j.type === 'message_delta' && j.delta && j.delta.stop_reason) return { stop: j.delta.stop_reason };
      if (j.type === 'error') return { error: (j.error && (j.error.message || j.error.type)) || '未知错误' };
      if (j.type === 'message_stop') return { done: true };
      return null;
    }
    if (j.error) return { error: j.error.message || String(j.error) };
    var ch = j.choices && j.choices[0];
    if (!ch) return null;
    var out = null;
    if (ch.delta && typeof ch.delta.content === 'string' && ch.delta.content) out = { text: ch.delta.content };
    if (ch.finish_reason) {
      var stop = ch.finish_reason === 'length' ? 'max_tokens' : (ch.finish_reason === 'content_filter' ? 'refusal' : ch.finish_reason);
      if (out) out.stop = stop; else out = { stop: stop };
    }
    return out;
  }
  /** HTTP 状态码 → 给人看的中文说明。 */
  function describeHttpError(status, detail) {
    var d = detail ? '（' + String(detail).slice(0, 160) + '）' : '';
    if (status === 401 || status === 403) return '密钥无效或没有权限，请检查 API Key 和接口地址' + d;
    if (status === 429) return '请求太频繁或额度用完了，稍等一会儿再试' + d;
    if (status >= 500) return '服务端出错（' + status + '），稍后重试' + d;
    if (status === 404) return '接口地址或模型名不对（404）' + d;
    return '请求失败（HTTP ' + status + '）' + d;
  }
  function describeStop(reason) {
    if (reason === 'refusal') return '模型拒绝回答这个请求。';
    if (reason === 'max_tokens') return '回复太长，被长度上限截断了。';
    return '';
  }

  // ───────────────────────── 总控 ─────────────────────────
  /**
   * 脸部控制器：每帧调用 update(dt)，返回 { pose, us }。
   * opts: { rng, calibration, idle: true/false }
   */
  function FaceController(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.cal = mergeCalibration(opts.calibration);
    this.idle = opts.idle !== false;
    this.blinker = new Blinker(this.rng);
    this.saccader = new Saccader(this.rng);
    this.drift = new NeckDrift(this.rng);
    this.gaze = new Gaze();
    this.lipsync = new LipSync();
    this.springs = {};
    for (var i = 0; i < CHANNEL_IDS.length; i++) this.springs[CHANNEL_IDS[i]] = new Spring(SPRING_OMEGA[CHANNEL_IDS[i]], 0);
    this.emotion = 'neutral';
    this.intensity = 1;
    this.holdS = 0;              // >0 时倒计时，归零后回到 neutral
    this.manual = null;          // 手动姿态（覆盖表情、注视和待机动作）
    this.mirror = null;          // 面部捕捉姿态（覆盖表情和注视，保留口型）
    this.lip = { jaw: 0, corner: 0 };
    this.usOverride = {};        // 校准页“试动”：{ 通道id: µs }
    this.pose = neutralPose();
    this.us = poseToUsArray(this.pose, this.cal);
  }
  FaceController.prototype.setCalibration = function (cal) { this.cal = mergeCalibration(cal); };
  /** hold（秒）：到时间后自动回到平静；不传或 0 表示一直保持。 */
  FaceController.prototype.setEmotion = function (name, intensity, hold) {
    var n = EMOTIONS[name] ? name : 'neutral';
    if (n !== this.emotion && this.idle && n !== 'wink' && this.rng() < 0.6) this.blinker.trigger();   // 换表情时常伴随一次眨眼
    this.emotion = n;
    this.intensity = intensity === undefined ? 1 : clamp(Number(intensity) || 0, 0, 1);
    this.holdS = hold > 0 ? hold : 0;
  };
  FaceController.prototype.setGaze = function (x, y) { this.gaze.set(x, y); };
  FaceController.prototype.setManual = function (pose) { this.manual = pose ? clampPose(pose) : null; };
  FaceController.prototype.setMirror = function (pose) { this.mirror = pose ? clampPose(pose) : null; };
  /** 直接给口型（jaw, corner），通常来自 this.lipsync.update(...) 的返回值。 */
  FaceController.prototype.setLip = function (lip) {
    this.lip = lip ? { jaw: Number(lip.jaw) || 0, corner: Number(lip.corner) || 0 } : { jaw: 0, corner: 0 };
  };
  FaceController.prototype.setUsOverride = function (id, us) {
    if (us === null || us === undefined) delete this.usOverride[id];
    else this.usOverride[id] = Math.round(clamp(Number(us) || 0, PWM.hard_min_us, PWM.hard_max_us));
  };
  /** 两只上眼皮的目标差别很大（单眼眨眼）时不发起自动眨眼。 */
  FaceController.prototype._winking = function (target) {
    return Math.abs(target.lid_upper_l - target.lid_upper_r) > 0.5;
  };
  FaceController.prototype.update = function (dt) {
    dt = clamp(Number(dt) || 0, 0, 0.1);     // 切到后台再回来时 dt 会很大，限制一下
    if (this.holdS > 0) {
      this.holdS -= dt;
      if (this.holdS <= 0) { this.holdS = 0; this.emotion = 'neutral'; this.intensity = 1; }
    }

    var target, blink = 0, lip = this.lip;
    var g = this.gaze.update(dt);
    if (this.manual) {
      target = this.manual;
    } else if (this.mirror) {
      target = this.mirror;
    } else {
      target = emotionPose(this.emotion, this.intensity);
      target = addPose(target, g);
      if (this.idle) {
        target = addPose(target, this.saccader.update(dt));
        target = addPose(target, this.drift.update(dt));
      }
      target = clampPose(target);
      blink = this.idle ? this.blinker.update(dt, this._winking(target)) : 0;
    }

    var smooth = {};
    for (var i = 0; i < CHANNEL_IDS.length; i++) {
      var id = CHANNEL_IDS[i], sp = this.springs[id];
      sp.target = target[id];
      smooth[id] = sp.step(dt);
    }
    if (this.manual) {
      this.pose = clampPose(smooth);         // 手动模式：滑块是什么就是什么，不叠加任何东西
    } else {
      this.pose = composePose({ base: smooth, lip: lip, blink: blink });
    }
    this.us = poseToUsArray(this.pose, this.cal);
    for (var oid in this.usOverride) {
      if (CHANNEL_BY_ID[oid]) this.us[CHANNEL_BY_ID[oid].pca] = this.usOverride[oid];
    }
    return { pose: this.pose, us: this.us };
  };

  return {
    CHANNELS: CHANNELS, CHANNEL_IDS: CHANNEL_IDS, CHANNEL_BY_ID: CHANNEL_BY_ID, PWM: PWM, PCA_CHANNELS: PCA_CHANNELS,
    clamp: clamp, lerp: lerp,
    neutralPose: neutralPose, clampPose: clampPose, addPose: addPose,
    EMOTIONS: EMOTIONS, EMOTION_NAMES: EMOTION_NAMES, EMOTION_LABELS: EMOTION_LABELS, emotionPose: emotionPose,
    mulberry32: mulberry32,
    Spring: Spring, SPRING_OMEGA: SPRING_OMEGA,
    BLINK: BLINK, Blinker: Blinker, Saccader: Saccader, NeckDrift: NeckDrift, Gaze: Gaze,
    LipSync: LipSync, textEnvelope: textEnvelope,
    composePose: composePose,
    defaultCalibration: defaultCalibration, mergeCalibration: mergeCalibration,
    exportCalibration: exportCalibration, importCalibration: importCalibration,
    poseToUs: poseToUs, usToPose: usToPose, poseToUsArray: poseToUsArray, usArrayToPose: usArrayToPose,
    limitsFromCalibration: limitsFromCalibration,
    checksum: checksum, encodeLine: encodeLine, encodeFrame: encodeFrame, encodeLimit: encodeLimit,
    encodeHello: encodeHello, encodeRelease: encodeRelease, encodeLimitQuery: encodeLimitQuery,
    encodeSlew: encodeSlew, encodeWatchdog: encodeWatchdog,
    verifyLine: verifyLine, parseHello: parseHello, parseReply: parseReply, ERR_TEXT: ERR_TEXT,
    TagStreamParser: TagStreamParser, stripTags: stripTags,
    SentenceSplitter: SentenceSplitter, splitSentences: splitSentences,
    blendshapesToPose: blendshapesToPose,
    DEFAULT_MODEL: DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT: DEFAULT_SYSTEM_PROMPT,
    buildAnthropicRequest: buildAnthropicRequest, buildOpenAIRequest: buildOpenAIRequest,
    SSEParser: SSEParser, interpretSSE: interpretSSE, describeHttpError: describeHttpError, describeStop: describeStop,
    FaceController: FaceController
  };
});
