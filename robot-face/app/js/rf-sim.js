/*
 * RF-01 仿真器：在 Canvas 上画一张示意的机械脸。
 * 输入是 16 路脉宽（µs），先用当前校准反算回姿态再画——
 * 所以校准填反了、限位太窄了，在这里都能直接看出来。
 * 画面上观察者的右边 = 机器人自己的左边。
 */
(function (root) {
  'use strict';
  var RF = root.RF = root.RF || {};

  var THEMES = {
    light: {
      shell: '#eef1f4', shellEdge: '#9aa6b2', plate: '#dde3e9', plateEdge: '#b4bec9',
      socket: '#161d27', sclera: '#f8fafb', scleraShade: '#cfd8e0', iris: '#17a398', irisDark: '#0b5f59', pupil: '#0b0f14',
      lid: '#c5ced8', lidEdge: '#6f7c8a', brow: '#27313d', bolt: '#f3f5f7', boltEdge: '#7b8794',
      lip: '#ee6a5c', cavity: '#2b151b', teeth: '#fcfdfd', teethEdge: '#b9c2cc', neck: '#59636f', neckEdge: '#3b444e',
      line: '#aeb8c3'
    },
    dark: {
      shell: '#3a434f', shellEdge: '#6b7887', plate: '#2c343e', plateEdge: '#56616f',
      socket: '#0b0f14', sclera: '#eef2f5', scleraShade: '#b5c0cb', iris: '#22c3b6', irisDark: '#0e6b64', pupil: '#05080b',
      lid: '#566271', lidEdge: '#9aa7b5', brow: '#e8edf2', bolt: '#4a5563', boltEdge: '#a3afbc',
      lip: '#ff7b6c', cavity: '#12080b', teeth: '#f1f4f6', teethEdge: '#8d99a6', neck: '#20262e', neckEdge: '#4b5562',
      line: '#566170'
    }
  };

  var VIEW_W = 420, VIEW_H = 520;      // 逻辑坐标系
  var EYE_X = 68, EYE_Y = -24, R_SOCKET = 47, R_LID = 43, R_BALL = 40;

  function Sim(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = 'light';
    this.cssW = 0; this.cssH = 0; this.dpr = 1;
    this.resize();
  }

  /** 画布尺寸跟随 CSS 尺寸和 devicePixelRatio。 */
  Sim.prototype.resize = function () {
    var c = this.canvas;
    var rect = c.getBoundingClientRect();
    var dpr = root.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  };

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
  function bolt(ctx, T, x, y, r, angle) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = T.bolt; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = T.boltEdge; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * r * 0.6, y - Math.sin(angle) * r * 0.6);
    ctx.lineTo(x + Math.cos(angle) * r * 0.6, y + Math.sin(angle) * r * 0.6);
    ctx.stroke();
  }

  /** 一只眼：眼窝、眼球、虹膜、上下眼皮。side = +1 是画面右侧（机器人的左眼）。 */
  function drawEye(ctx, T, side, pose) {
    var upper = side > 0 ? pose.lid_upper_l : pose.lid_upper_r;
    ctx.save();
    ctx.translate(side * EYE_X, EYE_Y);

    ctx.beginPath(); ctx.arc(0, 0, R_SOCKET, 0, Math.PI * 2);
    ctx.fillStyle = T.socket; ctx.fill();

    // 眼球
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R_BALL, 0, Math.PI * 2); ctx.clip();
    var g = ctx.createRadialGradient(-8, -10, 6, 0, 0, R_BALL);
    g.addColorStop(0, T.sclera); g.addColorStop(1, T.scleraShade);
    ctx.fillStyle = g; ctx.fillRect(-R_BALL, -R_BALL, R_BALL * 2, R_BALL * 2);
    var ix = pose.eye_pan * 15, iy = -pose.eye_tilt * 11;
    var ig = ctx.createRadialGradient(ix, iy, 4, ix, iy, 19);
    ig.addColorStop(0, T.iris); ig.addColorStop(1, T.irisDark);
    ctx.beginPath(); ctx.arc(ix, iy, 19, 0, Math.PI * 2); ctx.fillStyle = ig; ctx.fill();
    ctx.beginPath(); ctx.arc(ix, iy, 8.5, 0, Math.PI * 2); ctx.fillStyle = T.pupil; ctx.fill();
    ctx.beginPath(); ctx.arc(ix - 6, iy - 7, 3.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.restore();

    // 眼皮是绕水平轴转动的球壳，边缘始终经过左右两个转轴点，正面看是半个椭圆
    var lowerEdge = 34 - 28 * pose.lid_lower;                       // 下眼皮边缘中点的 y
    var upperEdge = upper >= 0 ? -27 + (lowerEdge + 27) * upper : -27 - 14 * (upper / -0.3);
    ctx.lineWidth = 2; ctx.strokeStyle = T.lidEdge; ctx.fillStyle = T.lid;

    ctx.beginPath();                                                // 下眼皮
    ctx.moveTo(R_LID, 0);
    ctx.arc(0, 0, R_LID, 0, Math.PI, false);
    ctx.ellipse(0, 0, R_LID, Math.max(0.5, lowerEdge), 0, Math.PI, 0, true);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.beginPath();                                                // 上眼皮
    ctx.moveTo(-R_LID, 0);
    ctx.arc(0, 0, R_LID, Math.PI, Math.PI * 2, false);
    if (upperEdge >= 0) ctx.ellipse(0, 0, R_LID, Math.max(0.5, upperEdge), 0, 0, Math.PI, false);
    else ctx.ellipse(0, 0, R_LID, -upperEdge, 0, 0, Math.PI, true);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // 眼窝外圈和两侧转轴
    ctx.beginPath(); ctx.arc(0, 0, R_SOCKET, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = T.plateEdge; ctx.stroke();
    bolt(ctx, T, -R_LID - 1, 0, 4, 0.6);
    bolt(ctx, T, R_LID + 1, 0, 4, -0.6);
    ctx.restore();
  }

  /** 眉毛：一根绕外端转动的横杆。value +1 = 内端上扬。 */
  function drawBrow(ctx, T, side, value) {
    var px = side * 118, py = -92;
    var a = value * 24 * Math.PI / 180;
    var len = 82;
    var ex = px - side * Math.cos(a) * len, ey = py - Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey);
    ctx.lineCap = 'round'; ctx.lineWidth = 13; ctx.strokeStyle = T.brow; ctx.stroke();
    bolt(ctx, T, px, py, 7, a * side + 0.8);
  }

  Sim.prototype.draw = function (usArray, cal, themeName) {
    this.resize();
    var ctx = this.ctx;
    var T = THEMES[themeName || this.theme] || THEMES.light;
    var pose = RF.usArrayToPose(usArray, cal);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var scale = Math.min(this.cssW / VIEW_W, this.cssH / VIEW_H);
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale,
      this.dpr * this.cssW / 2, this.dpr * (this.cssH / 2 + 6 * scale));
    ctx.lineJoin = 'round';

    // 脖子带动整个头略微平移；五官移动得比外壳多一点，造成转头的错觉
    var hx = pose.neck_yaw * 16, hy = -pose.neck_pitch * 12;
    var jawDrop = pose.jaw * 30;

    // 脖子
    roundRect(ctx, -44, 150, 88, 110, 10);
    ctx.fillStyle = T.neck; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = T.neckEdge; ctx.stroke();
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-44, 196 + k * 18); ctx.lineTo(44, 196 + k * 18); ctx.stroke(); }

    ctx.save();
    ctx.translate(hx * 0.45, hy * 0.45);

    // 两侧的“耳朵”（舵机盖）
    for (var s = -1; s <= 1; s += 2) {
      roundRect(ctx, s * 158 - 17, -62, 34, 72, 9);
      ctx.fillStyle = T.plate; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.shellEdge; ctx.stroke();
      bolt(ctx, T, s * 164, -26, 5, 0.4 * s);
    }

    // 下颌：一整块板，上沿藏在颅骨后面，张嘴时整体下移
    ctx.save();
    ctx.translate(0, jawDrop);
    ctx.beginPath();
    ctx.moveTo(-126, 40);
    ctx.bezierCurveTo(-124, 120, -92, 176, -40, 192);
    ctx.quadraticCurveTo(0, 200, 40, 192);
    ctx.bezierCurveTo(92, 176, 124, 120, 126, 40);
    ctx.closePath();
    ctx.fillStyle = T.plate; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = T.shellEdge; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-34, 162); ctx.quadraticCurveTo(0, 170, 34, 162);
    ctx.lineWidth = 2; ctx.strokeStyle = T.line; ctx.stroke();
    bolt(ctx, T, -86, 136, 5, 0.5);
    bolt(ctx, T, 86, 136, 5, -0.5);
    ctx.restore();

    // 上半颅骨（盖住下颌的上沿）
    ctx.beginPath();
    ctx.moveTo(0, -214);
    ctx.bezierCurveTo(96, -214, 152, -150, 152, -56);
    ctx.bezierCurveTo(152, -4, 144, 44, 124, 78);
    ctx.quadraticCurveTo(106, 112, 74, 112);
    ctx.lineTo(-74, 112);
    ctx.quadraticCurveTo(-106, 112, -124, 78);
    ctx.bezierCurveTo(-144, 44, -152, -4, -152, -56);
    ctx.bezierCurveTo(-152, -150, -96, -214, 0, -214);
    ctx.closePath();
    ctx.fillStyle = T.shell; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = T.shellEdge; ctx.stroke();
    // 头顶接缝
    ctx.beginPath(); ctx.moveTo(-104, -168); ctx.quadraticCurveTo(0, -196, 104, -168);
    ctx.lineWidth = 2; ctx.strokeStyle = T.line; ctx.stroke();
    bolt(ctx, T, 0, -196, 5, 0.3);

    // 五官层
    ctx.save();
    ctx.translate(hx * 0.55, hy * 0.55);

    // 面板
    ctx.beginPath();
    ctx.moveTo(-132, -112);
    ctx.quadraticCurveTo(0, -132, 132, -112);
    ctx.bezierCurveTo(140, -40, 132, 30, 108, 70);
    ctx.quadraticCurveTo(98, 92, 80, 92);
    ctx.lineTo(-80, 92);
    ctx.quadraticCurveTo(-98, 92, -108, 70);
    ctx.bezierCurveTo(-132, 30, -140, -40, -132, -112);
    ctx.closePath();
    ctx.fillStyle = T.plate; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = T.plateEdge; ctx.stroke();

    drawEye(ctx, T, -1, pose);
    drawEye(ctx, T, 1, pose);

    // 鼻梁
    ctx.beginPath();
    ctx.moveTo(-7, -6); ctx.lineTo(7, -6); ctx.lineTo(15, 56); ctx.quadraticCurveTo(0, 66, -15, 56); ctx.closePath();
    ctx.fillStyle = T.shell; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.plateEdge; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 44, 3.5, 0, Math.PI * 2); ctx.fillStyle = T.socket; ctx.fill();

    drawBrow(ctx, T, -1, pose.brow_r);
    drawBrow(ctx, T, 1, pose.brow_l);

    // 嘴：两个嘴角拨片之间拉着上下两条唇线。+1 向上向外（笑），-1 向下略向内（撇嘴）。
    // 闭嘴时两条线重合；张嘴后中间露出口腔和上下两排牙。
    function corner(side, m) {
      var up = m >= 0 ? m : 0, down = m < 0 ? -m : 0;
      return {
        x: side * (60 + 8 * up - 4 * down),
        y: 104 + jawDrop * 0.4 - 18 * up + 13 * down
      };
    }
    var cR = corner(-1, pose.mouth_r), cL = corner(1, pose.mouth_l);
    var cAvg = (cR.y + cL.y) / 2;
    var midUp = 104, midLow = 104 + jawDrop * 1.05;
    var ctrlUp = 2 * midUp - cAvg, ctrlLow = 2 * midLow - cAvg;
    function mouthPath() {
      ctx.beginPath();
      ctx.moveTo(cR.x, cR.y);
      ctx.quadraticCurveTo(0, ctrlUp, cL.x, cL.y);
      ctx.quadraticCurveTo(0, ctrlLow, cR.x, cR.y);
      ctx.closePath();
    }
    if (jawDrop > 0.5) {
      ctx.save();
      mouthPath(); ctx.clip();
      ctx.fillStyle = T.cavity; ctx.fillRect(-90, 60, 180, 120);
      ctx.fillStyle = T.teeth; ctx.strokeStyle = T.teethEdge; ctx.lineWidth = 1.5;
      roundRect(ctx, -44, midUp - 12, 88, 20, 5); ctx.fill(); ctx.stroke();            // 上排牙，固定
      ctx.beginPath(); for (var u = -30; u <= 30; u += 15) { ctx.moveTo(u, midUp - 10); ctx.lineTo(u, midUp + 7); } ctx.stroke();
      roundRect(ctx, -38, midLow - 9, 76, 20, 5); ctx.fill(); ctx.stroke();            // 下排牙，随下颌
      ctx.beginPath(); for (var w2 = -26; w2 <= 26; w2 += 13) { ctx.moveTo(w2, midLow - 7); ctx.lineTo(w2, midLow + 9); } ctx.stroke();
      ctx.restore();
    }
    ctx.lineCap = 'round'; ctx.lineWidth = 6.5; ctx.strokeStyle = T.lip;
    ctx.beginPath(); ctx.moveTo(cR.x, cR.y); ctx.quadraticCurveTo(0, ctrlUp, cL.x, cL.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cR.x, cR.y); ctx.quadraticCurveTo(0, ctrlLow, cL.x, cL.y); ctx.stroke();
    bolt(ctx, T, cR.x, cR.y, 6.5, 0.9);
    bolt(ctx, T, cL.x, cL.y, 6.5, -0.9);

    ctx.restore();   // 五官层
    ctx.restore();   // 头
    return pose;
  };

  RF.Sim = Sim;
  RF.SIM_THEMES = THEMES;
})(typeof self !== 'undefined' ? self : this);
