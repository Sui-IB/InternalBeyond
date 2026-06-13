/* ============================================================
   SUI'S ROOM — Game Module for Internal Beyond
   A pixel-art life sim / visual novel module
   ============================================================ */
(function(){
'use strict';

/* ── CONFIGURATION ─────────────────────────────────────── */
const GAME_W = 1672, GAME_H = 941;
const SPRITE_SIZE = 147;           // walk/idle frame size
const LIE_FW = 205, LIE_FH = 151; // lie frame (614/3 ≈ 205)
const CHAR_SPEED = 3.2;           // px per frame at 60fps
const WALK_FPS = 6;               // walk animation speed
const IDLE_INTERVAL = 3500;       // ms between idle blinks
const TYPE_SPEED = 35;            // ms per character (typewriter)
const DIALOGUE_MAX_CHARS = 120;   // chars per dialogue page (3 lines)
const DIALOGUE_MAX_LINES = 3;     // 对话框可视行数（文本区高度≈32%×334px≈3行，overflow:hidden）
const DIALOGUE_LINE_CHARS = 44;   // 每可视行可容纳的全角字符数（半角抉0.5计，文本区宽≈845px/18px≈46，田44保底）

/* ── WALKABLE AREA ─────────────────────────────────────── */
const WALK_POLY = [
  {x:95,y:600},{x:265,y:475},{x:450,y:400},{x:700,y:380},
  {x:1080,y:380},{x:1100,y:560},{x:1100,y:845},{x:95,y:845}
];
const OBSTACLES = [
  {type:'circle',x:890,y:618,r:84},    /* 水晶球圆桌本体（缩小：桌前/周围地面光影可通行） */
  {type:'rect',x:824,y:524,w:132,h:60}, /* 桌后窄缓冲带：避免角色站在桌正后方时与桌面像素重叠 */
  {type:'rect',x:300,y:650,w:170,h:100},
  {type:'rect',x:105,y:625,w:160,h:140}
];

/* ── CRYSTAL FLOOR LIGHT (walkable) ────────────────────── */
/* 水晶球投在地面的光晕区域：可行走；角色走入时，光会渐渐投在她身上 */
const CRYSTAL_FLOOR_LIGHT = {x:885,y:650,r:140};

/* ── INTERACTIVE OBJECTS ───────────────────────────────── */
const INTERACTIONS = [
  {id:'bed',      x:350, y:550, iconX:300, iconY:380, face:'up',   label:'休息'},
  {id:'tea',      x:350, y:770, iconX:370, iconY:680, face:'up',   label:'茶歇'},
  {id:'crystal',  x:810, y:660, iconX:925, iconY:685, face:'up',   label:'占卜'},
  {id:'desk',     x:1070,y:560, iconX:1240,iconY:430, face:'right',label:'游戏'},
  {id:'wardrobe', x:480, y:430, iconX:480, iconY:310, face:'up',   label:'衣柜'}
];

/* ── BED POSITION ──────────────────────────────────────── */
const BED_LIE_X = 155, BED_LIE_Y = 293;
const BED_STAND_X = 350, BED_STAND_Y = 550;
const BED_SLEEP_WALK_X = 450, BED_SLEEP_WALK_Y = 460;

/* ── OUTFITS ───────────────────────────────────────────── */
const OUTFITS = [
  {id:'eyepatch_dress', label:'Gothic Dress',
   walk:'game/sprites/walk_eyepatch_dress.png', idle:'game/sprites/idle_eyepatch_dress.png',
   lie:'game/sprites/lie_eyepatch_dress.png', portrait:'game/portraits/eyepatch_dress.png'},
  {id:'nopatch_dress', label:'Gothic Dress (no patch)',
   walk:'game/sprites/walk_nopatch_dress.png', idle:'game/sprites/idle_nopatch_dress.png',
   lie:'game/sprites/lie_nopatch_dress.png', portrait:'game/portraits/nopatch_dress.png'},
  {id:'casual', label:'Casual',
   walk:'game/sprites/walk_casual.png', idle:'game/sprites/idle_casual.png',
   lie:'game/sprites/lie_casual.png', portrait:'game/portraits/casual.png'},
  {id:'salome', label:'Salome',
   walk:'game/sprites/walk_salome.png', idle:'game/sprites/idle_salome.png',
   lie:'game/sprites/lie_salome.png', portrait:'game/portraits/salome.png'},
  {id:'jk', label:'JK',
   walk:'game/sprites/walk_jk.png', idle:'game/sprites/idle_jk.png',
   lie:'game/sprites/lie_jk.png', portrait:'game/portraits/jk.png'},
  {id:'wedding', label:'Wedding',
   walk:'game/sprites/walk_wedding.png', idle:'game/sprites/idle_wedding.png',
   lie:'game/sprites/lie_wedding.png', portrait:'game/portraits/wedding.png'}
];

/* ── TAROT DECK ────────────────────────────────────────── */
const MAJOR_ARCANA = [
  ['0','愚者','The Fool'],['I','魔术师','The Magician'],['II','女祭司','The High Priestess'],
  ['III','皇后','The Empress'],['IV','皇帝','The Emperor'],['V','教皇','The Hierophant'],
  ['VI','恋人','The Lovers'],['VII','战车','The Chariot'],['VIII','力量','Strength'],
  ['IX','隐者','The Hermit'],['X','命运之轮','Wheel of Fortune'],['XI','正义','Justice'],
  ['XII','倒吊人','The Hanged Man'],['XIII','死神','Death'],['XIV','节制','Temperance'],
  ['XV','恶魔','The Devil'],['XVI','塔','The Tower'],['XVII','星星','The Star'],
  ['XVIII','月亮','The Moon'],['XIX','太阳','The Sun'],['XX','审判','Judgement'],
  ['XXI','世界','The World']
];
const SUITS = [
  {en:'Wands',cn:'权杖',color:'#5a1a1a'},
  {en:'Cups',cn:'圣杯',color:'#1a2a5a'},
  {en:'Swords',cn:'宝剑',color:'#2a2a3a'},
  {en:'Pentacles',cn:'星币',color:'#4a3a0a'}
];
const RANKS = [
  {en:'Ace',cn:'',num:'A'},{en:'Two',cn:'二',num:'2'},{en:'Three',cn:'三',num:'3'},
  {en:'Four',cn:'四',num:'4'},{en:'Five',cn:'五',num:'5'},{en:'Six',cn:'六',num:'6'},
  {en:'Seven',cn:'七',num:'7'},{en:'Eight',cn:'八',num:'8'},{en:'Nine',cn:'九',num:'9'},
  {en:'Ten',cn:'十',num:'10'},{en:'Page',cn:'侍从',num:'P'},{en:'Knight',cn:'骑士',num:'Kn'},
  {en:'Queen',cn:'王后',num:'Q'},{en:'King',cn:'国王',num:'K'}
];
function buildTarotDeck(){
  const deck=[];
  MAJOR_ARCANA.forEach(([num,cn,en])=>deck.push({type:'major',num,cn,en,display:num+' - '+cn+' '+en,color:'#2a1540'}));
  SUITS.forEach(s=>RANKS.forEach(r=>deck.push({type:'minor',suit:s,rank:r,
    display:s.cn+(r.cn||r.en)+' '+r.en+' of '+s.en,color:s.color,symbol:r.num})));
  return deck;
}
const TAROT_DECK = buildTarotDeck();

/* ── TAROT SPREADS ──────────────────────────────────────── */
const TAROT_SPREADS = [
  {id:'free',    name:'无牌阵',   nameEn:'Free',     desc:'自由抽牌',                   maxCards:3, slots:[]},
  {id:'single',  name:'单牌',     nameEn:'Single',   desc:'此刻的指引',                 slots:[{label:'此刻'}]},
  {id:'timeline',name:'时间之流', nameEn:'Timeline', desc:'过去 · 现在 · 未来',          slots:[{label:'过去'},{label:'现在'},{label:'未来'}]},
  {id:'cross',   name:'十字',     nameEn:'Cross',    desc:'处境 · 障碍 · 建议 · 结果',   slots:[{label:'处境'},{label:'障碍'},{label:'建议'},{label:'结果'}]},
  {id:'star',    name:'命运之星', nameEn:'Star',     desc:'现状 · 挑战 · 根源 · 未来 · 潜力', slots:[{label:'现状'},{label:'挑战'},{label:'根源'},{label:'未来'},{label:'潜力'}]}
];

/* ── JSON EXTRACTION HELPER (robust for DeepSeek/国内模型) ── */
function extractJSON(raw){
  if(!raw||typeof raw!=='string') throw new Error('empty');
  /* 1. Strip markdown fences (case-insensitive) */
  let s=raw.replace(/```(?:json|JSON)?\s*/g,'').trim();
  /* 2. Try direct parse first */
  try{return JSON.parse(s)}catch(e){}
  /* 3. Extract first {...} block from text like "好的，这是你的故事：{...}" */
  const m=s.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0])}catch(e){}}
  /* 4. Last resort: throw so caller uses fallback */
  throw new Error('no valid JSON');
}

/* ── FIXED DIALOGUE TEXTS ──────────────────────────────── */
const FIXED_LINES = {
  bed1: "现在我该睡觉了吗？",
  bed_confirm: "我知道了，好。",
  bed_sleep: "晚安。",
  crystal_intro: "要使用塔罗牌占卜吗？",
  desk_intro: "今天会给我设计怎样的游戏呢？",
  wardrobe_intro: ["让我偶尔试试看你喜欢的风格，怎么样？","想看我穿什么样的衣服呢？","（小声）想买新衣服了……"],
  stairs_blocked: "……这扇门是锁着的。",
  no_api: "还没有配置API呢。去设置页面添加一个吧。",
  sui_open: "请问有什么我可以帮助你的吗？\n如果你有其他想问我的事情，可以按下右下角的NEXT来和我开启对话。",
  thinking: "……"
};

/* ── INTERACTION MARKERS (display order: tea → tarot → story → wardrobe → sleep) ── */
const MARKERS = [
  {id:'tea',      en:'Tea',      cn:'茶歇'},
  {id:'crystal',  en:'Tarot',    cn:'占卜'},
  {id:'desk',     en:'Story',    cn:'故事'},
  {id:'wardrobe', en:'Wardrobe', cn:'衣柜'},
  {id:'bed',      en:'Sleep',    cn:'安睡'}
];

/* ── GUIDED HOME TOUR ─────────────────────────────────── */
/* Intro spoken at the bed, facing the camera */
function getTourIntro(){
  var mode=document.body.classList.contains('theme-infernal')?'Infernal':'Internal';
  return [
    "欢迎来到"+mode+" Beyond。\n我是这个房间里的主控角色，Sui。我会带领你了解这个游戏房间的玩法。\n点击[Back]按钮会直接退出引导，点击[Next]则进入下一页。",
    mode+" Beyond（IB）是一个免费的GitHub开源作品。\n如果你是通过付费购买的方式来到这里，那你收到的不会是正版游戏。\n请通过GitHub：Sui-IB，或QQ：1282901880来找到真正的游戏作者。",
    "所有玩法后续均可通过点击对应区域，或点击导航栏中的各个功能按钮来开启互动。\n来吧。现在，请跟着我。"
  ];
}
/* Walk-and-talk stations (tour order: tea → story → tarot → wardrobe → bed) */
const TOUR_STEPS = [
  {id:'tea',     face:'up',    pages:[
    "这里是Tea茶歇模块。\n可按照喜好准备一杯饮品和一份甜品，与你想要共度时光的TA一起享用。\n在白昼模式与夜晚模式开启茶歇，会有不同的效果哦。"]},
  {id:'desk',    face:'right', pages:[
    "这是Story模块。\n在这里可以游玩TA，或是你自己设计的互动文字冒险游戏。\n游戏中可随时选择存档游戏剧本到Blog模块中的密码日记本内。"]},
  {id:'crystal', face:'up',    pages:[
    "这里是占卜桌。\n你可以在这里使用塔罗占卜，邀请TA帮你解读，或独自探索。\n按下Save，可以存下你此次在占卜桌执行的所有操作。"]},
  {id:'wardrobe',face:'up',    pages:[
    "这里是我的衣柜，在这里可以给我自由换装。\n请注意：更换服装后，我的立绘、模型与角色动画也会同步更换。"]},
  {id:'bed',     face:'up',    pages:[
    "这里是我的床。\n……到这里，你应该已经能够熟悉掌握整个操作流程了吧。\n你想在白天休息还是晚上休息都可以。",
    "这些就是这个房间的所有功能介绍。\n如果你想要切换目前房间的昼夜模式，点击屏幕右上角的水滴按钮就可以了。",
    "请注意，在夜间模式下，网站的主页风格也会切换到暗色模式。\n暗色模式下，不是只有房间会发生变化。主页背景图也会随之改变。\n暗色模式下的背景图可能会有一些微恐元素。",
    "如果想听歌，你可以使用左下角的音乐播放器添加本地音乐来在这个房间里播放，但歌单不会存档。\n祝你游戏愉快。"]}
];

/* ============================================================
   CSS INJECTION
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;600&display=swap');

/* ── GAME MINI ICON ──────────────────────────────────── */
#game-mini{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:90;
  padding:48px 11px;border-radius:8px 0 0 8px;background:rgba(20,30,50,0.35);border:1px solid var(--glass-border);border-right:none;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);cursor:pointer;
  transition:all 0.4s var(--transition);opacity:0;writing-mode:vertical-lr;
  letter-spacing:0.18em;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:0.88rem;color:var(--text-muted)}
#game-mini.visible{opacity:1;transform:translateY(-50%)}
#game-mini:hover{background:rgba(175,195,228,0.15);color:var(--light)}
body.theme-infernal #game-mini{color:#ffffff}
body:not(.theme-infernal) #game-mini{background:rgba(255,255,255,0.28);border-color:rgba(180,215,245,0.4);color:#2b487a}
body:not(.theme-infernal) #game-mini:hover{background:rgba(255,255,255,0.45);color:#152c58}

/* ── GAME PANEL (floating) ───────────────────────────── */
#game-panel{position:fixed;z-index:92;border-radius:16px;overflow:hidden;display:none;
  background:rgba(10,15,30,0.95);border:1px solid var(--glass-border);
  box-shadow:0 8px 40px rgba(0,0,0,0.5);backdrop-filter:blur(8px);
  flex-direction:column}
#game-panel.show{display:flex}
.game-panel-header{display:flex;align-items:center;justify-content:space-between;
  padding:8px 14px;background:rgba(0,0,0,0.3);cursor:grab;user-select:none;min-height:36px}
.game-panel-header:active{cursor:grabbing}
.game-panel-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:0.9rem;color:var(--silver);letter-spacing:0.05em}
.game-panel-close{background:none;border:none;color:var(--mist);cursor:pointer;font-size:1.1rem;padding:2px 6px;transition:color 0.3s;line-height:1}
.game-panel-close:hover{color:var(--white)}
.game-panel-zoom{display:flex;gap:4px;align-items:center}
.game-panel-zoom button{background:none;border:1px solid rgba(175,195,228,0.2);color:var(--mist);
  cursor:pointer;font-size:0.85rem;width:24px;height:24px;border-radius:4px;
  display:flex;align-items:center;justify-content:center;transition:all 0.3s;line-height:1}
.game-panel-zoom button:hover{border-color:var(--accent);color:var(--white)}

/* ── GAME VIEWPORT ───────────────────────────────────── */
.game-viewport{position:relative;width:${GAME_W}px;height:${GAME_H}px;overflow:hidden;
  transform-origin:top left;image-rendering:pixelated;cursor:crosshair}

/* ── ROOM BACKGROUND ─────────────────────────────────── */
.game-bg{position:absolute;inset:0;background-size:cover;background-position:center;transition:opacity 1.5s ease}
.game-bg-day{background-image:url('game/room_day.png');opacity:1}
.game-bg-night{background-image:url('game/room_night.png');opacity:0}
body.theme-infernal .game-bg-day{opacity:0}
body.theme-infernal .game-bg-night{opacity:1}

/* ── LIGHT EFFECTS LAYER ─────────────────────────────── */
.game-lights{position:absolute;inset:0;pointer-events:none;z-index:2;mix-blend-mode:screen;opacity:0.7}
.game-lights-overlay{position:absolute;inset:0;pointer-events:none;z-index:3;transition:opacity 1.5s ease}

/* Day lights */
.game-day-lights{opacity:1}
body.theme-infernal .game-day-lights{opacity:0}
.game-night-lights{opacity:0}
body.theme-infernal .game-night-lights{opacity:1}

/* Window light beam (day) */
.light-beam-day{position:absolute;top:0;left:400px;width:820px;height:100%;
  background:linear-gradient(180deg,rgba(255,240,200,0.0) 0%,rgba(255,235,180,0.08) 20%,rgba(255,230,170,0.15) 40%,rgba(255,225,160,0.08) 65%,rgba(255,220,150,0.02) 85%,transparent 100%);
  clip-path:polygon(25% 0%,75% 0%,95% 100%,5% 100%);
  animation:lightBreath 8s ease-in-out infinite,lightWarmFade 25s ease-in-out infinite}

/* Cool dawn/overcast light beam (Internal only) */
.light-beam-cool{position:absolute;top:0;left:400px;width:820px;height:100%;
  background:linear-gradient(180deg,rgba(180,200,235,0.0) 0%,rgba(170,195,230,0.08) 20%,rgba(160,190,225,0.16) 40%,rgba(155,185,220,0.09) 65%,rgba(150,180,215,0.03) 85%,transparent 100%);
  clip-path:polygon(25% 0%,75% 0%,95% 100%,5% 100%);
  opacity:0;animation:lightBreath 8s ease-in-out infinite,lightCoolFade 25s ease-in-out infinite}
body.theme-infernal .light-beam-cool{opacity:0;animation:none}

/* Full-room cold/overcast filter (Internal only) */
.game-cold-filter{position:absolute;inset:0;pointer-events:none;z-index:1;
  background:linear-gradient(180deg,rgba(140,165,200,0.12) 0%,rgba(150,175,210,0.18) 30%,rgba(145,170,205,0.15) 60%,rgba(135,160,195,0.10) 100%);
  mix-blend-mode:multiply;opacity:0;
  animation:coldFilterCycle 25s ease-in-out infinite}
body.theme-infernal .game-cold-filter{opacity:0;animation:none}

@keyframes lightWarmFade{0%,100%{opacity:1}45%,55%{opacity:0.15}}
@keyframes lightCoolFade{0%,100%{opacity:0}45%,55%{opacity:0.9}}
@keyframes coldFilterCycle{0%,100%{opacity:0}42%,58%{opacity:1}}

/* ── PRISMATIC RAINBOW LIGHT (Internal/day mode only) ── */
.light-prism{position:absolute;top:0;left:420px;width:780px;height:100%;
  clip-path:polygon(28% 0%,72% 0%,92% 100%,8% 100%);
  opacity:0;pointer-events:none;mix-blend-mode:screen}
body:not(.theme-infernal) .light-prism{opacity:1;animation:prismColdFade 25s ease-in-out infinite}
@keyframes prismColdFade{0%,100%{opacity:1}42%,58%{opacity:0.15}}

.light-prism-rainbow{position:absolute;inset:0;
  background:linear-gradient(165deg,
    rgba(255,100,100,0.0) 0%,
    rgba(255,140,80,0.04) 15%,
    rgba(255,220,100,0.06) 25%,
    rgba(140,255,140,0.05) 35%,
    rgba(100,200,255,0.07) 45%,
    rgba(130,130,255,0.05) 55%,
    rgba(200,100,255,0.04) 65%,
    rgba(255,100,180,0.03) 75%,
    transparent 90%);
  animation:prismShift 15s ease-in-out infinite alternate}

.light-prism-streak1{position:absolute;top:8%;left:30%;width:35%;height:80%;
  background:linear-gradient(170deg,transparent 0%,rgba(255,200,120,0.06) 30%,rgba(180,230,255,0.08) 50%,rgba(200,150,255,0.05) 70%,transparent 100%);
  animation:streakDrift1 20s ease-in-out infinite;filter:blur(20px)}

.light-prism-streak2{position:absolute;top:15%;left:45%;width:25%;height:70%;
  background:linear-gradient(175deg,transparent 0%,rgba(255,180,200,0.05) 25%,rgba(150,255,200,0.07) 50%,rgba(180,200,255,0.05) 75%,transparent 100%);
  animation:streakDrift2 25s ease-in-out infinite;filter:blur(25px)}

.light-prism-shimmer{position:absolute;inset:0;
  background:repeating-linear-gradient(90deg,
    transparent 0px,transparent 60px,
    rgba(255,255,255,0.015) 62px,transparent 64px);
  animation:shimmerScroll 8s linear infinite}

@keyframes prismShift{
  0%{transform:translateX(-20px) skewX(-2deg);opacity:0.7}
  50%{transform:translateX(20px) skewX(2deg);opacity:1}
  100%{transform:translateX(-10px) skewX(-1deg);opacity:0.8}}
@keyframes streakDrift1{
  0%{transform:translateX(-30px) translateY(10px);opacity:0.5}
  50%{transform:translateX(30px) translateY(-10px);opacity:0.9}
  100%{transform:translateX(-30px) translateY(10px);opacity:0.5}}
@keyframes streakDrift2{
  0%{transform:translateX(20px) translateY(-15px);opacity:0.4}
  50%{transform:translateX(-25px) translateY(15px);opacity:0.8}
  100%{transform:translateX(20px) translateY(-15px);opacity:0.4}}
@keyframes shimmerScroll{0%{transform:translateX(-64px)}100%{transform:translateX(64px)}}

/* Light motes (floating sparkles in day mode) */
.light-mote{position:absolute;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(255,240,200,0.6) 0%,rgba(255,220,160,0.2) 40%,transparent 70%);
  animation:moteFloat ease-in-out infinite;filter:blur(1px)}
body.theme-infernal .light-mote{opacity:0}

/* Moonlight beam (night) */
.light-beam-night{position:absolute;top:0;left:450px;width:750px;height:100%;
  background:linear-gradient(180deg,rgba(100,140,220,0.0) 0%,rgba(80,120,200,0.06) 15%,rgba(60,100,180,0.14) 35%,rgba(50,90,170,0.08) 60%,rgba(40,80,160,0.02) 80%,transparent 100%);
  clip-path:polygon(30% 0%,70% 0%,90% 100%,10% 100%);
  animation:lightBreath 12s ease-in-out infinite}

@keyframes lightBreath{0%,100%{opacity:0.7}50%{opacity:1}}

/* Candle glows */
.light-candle{position:absolute;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(255,200,100,0.35) 0%,rgba(255,180,80,0.12) 40%,transparent 70%);
  animation:candleFlicker 2s ease-in-out infinite alternate}
@keyframes candleFlicker{0%{opacity:0.6;transform:scale(1)}25%{opacity:0.85;transform:scale(1.05)}50%{opacity:0.55;transform:scale(0.95)}75%{opacity:0.9;transform:scale(1.08)}100%{opacity:0.65;transform:scale(0.98)}}

.light-candle-night{background:radial-gradient(circle,rgba(255,190,80,0.45) 0%,rgba(255,170,60,0.18) 35%,transparent 65%)}

/* Crystal ball glow */
.light-crystal{position:absolute;left:843px;top:497px;width:90px;height:90px;border-radius:50%;
  background:radial-gradient(circle,rgba(100,160,255,0.5) 0%,rgba(80,140,240,0.2) 40%,rgba(60,120,220,0.05) 65%,transparent 80%);
  animation:crystalPulse 3s ease-in-out infinite;filter:blur(6px)}
@keyframes crystalPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}

/* Dust particles */
.game-dust{position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden}
.dust-particle{position:absolute;width:3px;height:3px;border-radius:50%;
  background:rgba(200,215,240,0.4);animation:dustFloat linear infinite}
@keyframes dustFloat{0%{transform:translateY(100%) translateX(0);opacity:0}10%{opacity:0.6}90%{opacity:0.4}100%{transform:translateY(-20%) translateX(40px);opacity:0}}
@keyframes moteFloat{0%{opacity:0;transform:translate(0,0) scale(1)}15%{opacity:0.8}50%{opacity:0.5;transform:translate(var(--mx,30px),var(--my,-40px)) scale(1.3)}85%{opacity:0.6}100%{opacity:0;transform:translate(var(--mx2,60px),var(--my2,-80px)) scale(0.8)}}

body.theme-infernal .dust-particle{background:rgba(200,215,240,0.4)}

/* Dark vignette */
.game-vignette{position:absolute;inset:0;pointer-events:none;z-index:5;
  background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(0,0,0,0.15) 100%)}
body.theme-infernal .game-vignette{background:radial-gradient(ellipse at 50% 40%,transparent 40%,rgba(0,0,0,0.3) 100%)}

/* ── CHARACTER SPRITE ────────────────────────────────── */
.game-char{position:absolute;z-index:10;pointer-events:none;image-rendering:pixelated}
.game-char-sprite{width:${SPRITE_SIZE}px;height:${SPRITE_SIZE}px;overflow:hidden;position:relative}
.game-char-sprite img{position:absolute;image-rendering:pixelated}
.game-char-shadow{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
  width:70px;height:22px;border-radius:50%;
  background:radial-gradient(ellipse,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.3) 50%,transparent 70%);
  pointer-events:none}
.game-char-lightcast{position:absolute;inset:-12px -10px 0;pointer-events:none;opacity:0;
  transition:opacity 0.45s ease;will-change:opacity}
.game-char-lightcast::before{content:"";position:absolute;inset:0;border-radius:50%;
  background:radial-gradient(ellipse at 50% 36%,rgba(126,178,255,0.40) 0%,rgba(96,150,238,0.17) 48%,transparent 76%);
  mix-blend-mode:screen}
.game-char.in-crystal-light .game-char-lightcast::before{animation:crystalPulse 3s ease-in-out infinite}
body:not(.theme-infernal) .game-char-lightcast::before{opacity:0.45}
.game-char.in-crystal-light .game-char-sprite img{filter:brightness(1.08) saturate(1.04)}
.game-char-lie{position:absolute;z-index:10;pointer-events:none;image-rendering:pixelated}
.game-char-lie img{image-rendering:pixelated}

/* ── ACTION SIDEBAR (outside viewport, right side) ───── */
.game-sidebar{display:flex;flex-direction:column;gap:3px;padding:8px 6px;flex-shrink:0;
  background:rgba(15,20,40,0.92);border-left:1px solid rgba(100,130,180,0.15)}
.game-sidebar.hidden{display:none}
.game-sidebar-btn{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;
  color:rgba(200,215,240,0.65);background:none;border:none;cursor:pointer;
  padding:8px 12px;border-radius:6px;transition:all 0.3s;letter-spacing:0.04em;
  white-space:nowrap;text-align:left}
.game-sidebar-btn:hover{color:#e8f0ff;background:rgba(114,168,216,0.12);
  text-shadow:0 0 8px rgba(114,168,216,0.5)}

/* ── Zzz SLEEP ANIMATION (disabled) ───────────────────── */
.game-zzz{display:none !important}

/* ── SPEECH BUBBLE ───────────────────────────────────── */
.game-bubble{position:absolute;z-index:15;pointer-events:none;
  padding:4px 10px;border-radius:8px;background:rgba(0,0,0,0.55);
  color:#e0e6f2;font-size:14px;white-space:nowrap;
  backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);
  animation:bubbleFade 2s ease-in-out forwards}
@keyframes bubbleFade{0%{opacity:0;transform:translateY(4px)}15%{opacity:1;transform:translateY(0)}85%{opacity:1}100%{opacity:0;transform:translateY(-4px)}}

/* ── DIALOGUE OVERLAY ────────────────────────────────── */
.game-dialogue{position:absolute;inset:0;z-index:20;display:none;
  flex-direction:column;justify-content:flex-end;pointer-events:none}
.game-dialogue.show{display:flex}
/* Story portrait — now anchored to the LEFT of the dialogue box (req #3) and
   enlarged (req #1). The box is right+bottom anchored: the artwork hugs the
   box's right edge, which is parked at x≈400 — just left of where the dialogue
   text begins (box 14% ≈ x414) — so the figure can lap over the box's left
   rose/border but can never cover the dialogue text or the name, no matter how
   wide the uploaded portrait is. (A full-width portrait such as Sui has its
   outer hair run a little past the screen's left edge; the face/body stay in
   frame, which reads as a character standing at the left of the room.) */
.game-dialogue-portrait{position:absolute;bottom:0;left:-50px;z-index:21;
  width:450px;height:560px;pointer-events:none;opacity:0;
  display:flex;align-items:flex-end;justify-content:flex-end;
  transition:opacity 0.4s ease;transform-origin:bottom center}
.game-dialogue-portrait.show{opacity:1}
.game-dialogue-portrait img{max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;object-position:bottom right;
  filter:drop-shadow(2px 4px 12px rgba(0,0,0,0.5))}
/* SUI 立绘单独沿用旧版(V5)右侧定位；自定义立绘保持上面的左侧加大样式不变 */
.game-dialogue-portrait.sui{left:auto;right:20px;width:400px;height:460px}
.game-dialogue-portrait.sui img{width:100%;height:100%;object-position:bottom}

.game-dialogue-box-wrap{position:relative;width:100%;display:flex;justify-content:center;
  padding:0 40px 30px;pointer-events:auto}
.game-dialogue-box{position:relative;width:1173px;max-width:100%;aspect-ratio:1173/334;
  background-image:url('game/dialogue_box.png');background-size:100% 100%;
  background-repeat:no-repeat}
.game-dialogue-name{position:absolute;top:9.2%;left:13.5%;right:65.5%;
  font-family:'Noto Serif SC','Source Han Serif SC',serif;
  font-weight:600;font-size:17px;color:#e0e8f6;letter-spacing:0.08em;
  text-shadow:0 1px 8px rgba(0,0,0,0.6);text-align:center;transform:translate(-2px,4px)}
.game-dialogue-text{position:absolute;top:35%;left:14%;right:14%;height:32%;
  font-family:'Noto Serif SC','Source Han Serif SC',serif;font-size:18px;line-height:1.85;white-space:pre-line;
  color:#e8eef8;overflow:hidden;text-shadow:0 1px 6px rgba(0,0,0,0.7),0 0 10px rgba(0,0,0,0.3);font-weight:400}

.game-dialogue-next{display:none !important}
body:not(.theme-infernal) .game-dialogue-text{color:#0a1535;font-weight:600;
  text-shadow:0 0 8px rgba(255,255,255,0.7),0 0 16px rgba(255,255,255,0.4),0 0 28px rgba(255,255,255,0.2)}

/* ── PERSISTENT DIALOGUE BUTTONS ──────────────── */
.game-dlg-persistent{position:absolute;top:70%;left:14%;right:14%;height:10%;
  display:flex;justify-content:space-between;align-items:center;pointer-events:auto;transform:translateY(-2px)}
.game-dlg-btn{font-family:'Noto Serif SC',serif;
  font-size:17px;color:rgba(220,230,250,0.95);cursor:pointer;background:none;border:none;
  padding:4px 10px;transition:all 0.3s;display:flex;align-items:center;gap:6px;font-weight:600;
  letter-spacing:0.04em;text-shadow:0 1px 6px rgba(0,0,0,0.5)}
.game-dlg-btn:hover{color:#fff;text-shadow:0 0 10px rgba(114,168,216,0.7),0 0 20px rgba(114,168,216,0.4)}
.game-dlg-btn-back .tri-back{display:inline-block;transition:transform 0.3s;font-size:15px;
  color:rgba(180,210,255,0.9)}
.game-dlg-btn-back:hover .tri-back{transform:translateX(-4px);color:#fff;
  text-shadow:0 0 10px rgba(114,168,216,0.8)}
.game-dlg-btn-next .tri-next{display:inline-block;animation:triPulseNext 1.2s ease-in-out infinite;
  font-size:15px;color:rgba(180,210,255,0.9)}
.game-dlg-btn-next:hover .tri-next{color:#fff;text-shadow:0 0 10px rgba(114,168,216,0.8)}
@keyframes triPulseNext{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}

/* Dialogue action buttons — two groups: left and right */
.game-dialogue-actions{position:absolute;top:70%;left:35%;right:35%;height:10%;
  display:none;justify-content:center;align-items:center;gap:24px;z-index:2}
.game-dialogue-actions.show{display:flex}
.game-dialogue-action{font-family:'Noto Serif SC',serif;
  font-size:16px;color:rgba(220,230,250,0.85);cursor:pointer;background:none;border:none;
  padding:3px 6px;transition:all 0.3s;display:flex;align-items:center;gap:5px;font-weight:500}
.game-dialogue-action:hover{color:#fff;text-shadow:0 0 10px rgba(114,168,216,0.7)}
.game-dialogue-action::before{content:'▸';color:rgba(160,200,255,0.7);
  transition:all 0.3s;display:inline-block;font-size:15px}
.game-dialogue-action:hover::before{color:#fff;transform:translateX(3px);
  text-shadow:0 0 10px rgba(114,168,216,0.8)}

/* ── CHOICE BUTTONS — in text area ───────────────────── */
.game-choices{position:absolute;top:35%;left:14%;right:14%;height:32%;
  display:none;flex-direction:column;justify-content:center;gap:8px}
.game-choices.show{display:flex}
.game-choice-btn{padding:5px 4px;background:none;
  border:none;color:rgba(210,225,250,0.8);
  font-family:'Noto Serif SC',serif;font-size:16px;cursor:pointer;font-weight:500;
  transition:all 0.3s;text-align:left;display:flex;align-items:center;gap:8px}
.game-choice-btn::before{content:'◆';font-size:9px;color:rgba(140,180,230,0.5);transition:all 0.3s}
.game-choice-btn:hover{color:#fff}
.game-choice-btn:hover::before{color:rgba(160,200,255,1);
  text-shadow:0 0 12px rgba(114,168,216,0.9),0 0 24px rgba(114,168,216,0.5)}

/* ── WARDROBE PANEL ──────────────────────────────────── */
.game-wardrobe{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:25;display:none;padding:30px 30px 22px;border-radius:20px;
  background:linear-gradient(160deg,rgba(18,26,46,0.95),rgba(11,17,30,0.96));
  border:1px solid rgba(180,200,232,0.16);
  backdrop-filter:blur(22px) saturate(1.15);-webkit-backdrop-filter:blur(22px) saturate(1.15);
  min-width:300px;max-width:360px;
  box-shadow:0 18px 60px rgba(0,0,0,0.55),0 0 0 1px rgba(120,150,200,0.08),inset 0 1px 0 rgba(255,255,255,0.06)}
.game-wardrobe.show{display:block}
.game-wardrobe h4{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:1.45rem;color:rgba(214,226,248,0.95);margin:0 0 10px;text-align:center;
  letter-spacing:0.14em}
.game-wardrobe-divider{display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:18px}
.game-wardrobe-divider::before,.game-wardrobe-divider::after{content:'';height:1px;width:54px;
  background:linear-gradient(90deg,transparent,rgba(180,200,232,0.45))}
.game-wardrobe-divider::after{background:linear-gradient(90deg,rgba(180,200,232,0.45),transparent)}
.game-wardrobe-divider span{color:rgba(170,195,235,0.65);font-size:9px;transform:rotate(45deg);
  width:6px;height:6px;border:1px solid rgba(170,195,235,0.5);display:inline-block}
.game-wardrobe-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:16px}
.game-wardrobe-item{display:flex;align-items:center;gap:13px;width:100%;
  padding:12px 17px;background:rgba(178,198,230,0.05);border:1px solid rgba(178,198,230,0.12);
  border-radius:12px;color:rgba(212,224,246,0.82);font-family:'Noto Sans SC',sans-serif;
  font-size:0.86rem;cursor:pointer;transition:all 0.28s ease;text-align:left;position:relative;overflow:hidden}
.game-wardrobe-item:hover{background:rgba(178,198,230,0.12);border-color:rgba(178,198,230,0.3);
  color:rgba(228,238,255,0.98);transform:translateX(2px)}
.game-wardrobe-item.active{border-color:rgba(120,170,222,0.6);color:rgba(190,222,255,1);
  background:linear-gradient(90deg,rgba(120,170,222,0.18),rgba(120,170,222,0.06))}
.game-wardrobe-item.active::before{content:'';position:absolute;left:0;top:18%;bottom:18%;
  width:3px;border-radius:0 3px 3px 0;background:linear-gradient(rgba(130,180,235,0.9),rgba(110,160,215,0.7));
  box-shadow:0 0 10px rgba(120,170,222,0.6)}
.game-wardrobe-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;
  border:1.5px solid rgba(178,198,230,0.32);transition:all 0.28s}
.game-wardrobe-item.active .game-wardrobe-dot{background:rgba(130,180,235,0.95);
  border-color:rgba(150,195,240,0.8);box-shadow:0 0 9px rgba(120,170,222,0.7)}
.game-wardrobe-close{display:block;width:100%;padding:11px;margin-top:2px;
  background:rgba(178,198,230,0.08);border:1.5px solid rgba(178,198,230,0.3);border-radius:11px;
  color:rgba(216,228,250,0.88);font-family:'Cormorant Garamond',serif;font-style:normal;font-weight:600;
  font-size:0.95rem;cursor:pointer;transition:all 0.28s;letter-spacing:0.12em}
.game-wardrobe-close:hover{background:rgba(178,198,230,0.18);border-color:rgba(178,198,230,0.5);
  color:#fff}
/* ── INTERNAL (light) THEME ── */
body:not(.theme-infernal) .game-wardrobe{
  background:linear-gradient(160deg,rgba(246,250,255,0.97),rgba(228,240,255,0.96));
  border-color:rgba(150,190,235,0.45);
  box-shadow:0 18px 60px rgba(70,110,170,0.22),0 0 0 1px rgba(150,190,235,0.15),inset 0 1px 0 rgba(255,255,255,0.7)}
body:not(.theme-infernal) .game-wardrobe h4{color:#1b3666}
body:not(.theme-infernal) .game-wardrobe-divider::before{background:linear-gradient(90deg,transparent,rgba(80,130,195,0.5))}
body:not(.theme-infernal) .game-wardrobe-divider::after{background:linear-gradient(90deg,rgba(80,130,195,0.5),transparent)}
body:not(.theme-infernal) .game-wardrobe-divider span{border-color:rgba(70,125,195,0.6);color:rgba(70,125,195,0.7)}
body:not(.theme-infernal) .game-wardrobe-item{background:rgba(255,255,255,0.5);
  border-color:rgba(150,190,235,0.32);color:#284b7e}
body:not(.theme-infernal) .game-wardrobe-item:hover{background:rgba(255,255,255,0.85);
  border-color:rgba(110,160,220,0.5);color:#102347}
body:not(.theme-infernal) .game-wardrobe-item.active{border-color:rgba(70,130,205,0.6);
  color:#0c2247;background:linear-gradient(90deg,rgba(150,190,240,0.55),rgba(190,218,250,0.3))}
body:not(.theme-infernal) .game-wardrobe-item.active::before{background:linear-gradient(rgba(60,120,200,0.85),rgba(50,105,185,0.7));box-shadow:0 0 10px rgba(70,130,205,0.5)}
body:not(.theme-infernal) .game-wardrobe-dot{border-color:rgba(95,150,215,0.45)}
body:not(.theme-infernal) .game-wardrobe-item.active .game-wardrobe-dot{
  background:rgba(55,115,195,0.9);border-color:rgba(70,130,205,0.7);box-shadow:0 0 8px rgba(70,130,205,0.45)}
body:not(.theme-infernal) .game-wardrobe-close{
  background:rgba(110,160,222,0.16);border-color:rgba(70,125,195,0.5);color:#173a6e}
body:not(.theme-infernal) .game-wardrobe-close:hover{
  background:rgba(95,150,215,0.28);border-color:rgba(55,110,185,0.7);color:#0a2150}

/* ── TAROT PANEL ─────────────────────────────────────── */
.game-tarot{position:absolute;inset:0;z-index:25;display:none;flex-direction:column;
  background:url('game/tarot_bg.png') center/cover no-repeat,rgba(0,0,0,0.55);backdrop-filter:blur(6px);overflow:hidden;padding:10px 16px 10px}
.game-tarot.show{display:flex}

/* Spread selection bar */
.tarot-spread-bar{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:4px}
.tarot-spread-opt{font-family:'Noto Serif SC','Noto Sans SC',serif;font-size:0.82rem;font-weight:500;
  color:rgba(200,190,230,0.55);background:none;border:1px solid rgba(160,140,200,0.2);
  border-radius:20px;padding:5px 16px;cursor:pointer;transition:all 0.35s;white-space:nowrap}
.tarot-spread-opt:hover{color:rgba(220,210,240,0.9);border-color:rgba(180,160,220,0.5)}
.tarot-spread-opt.active{color:rgba(230,220,250,1);border-color:rgba(180,160,220,0.7);
  background:rgba(140,110,200,0.18);text-shadow:0 0 12px rgba(180,160,240,0.3)}
.tarot-top-row{display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:4px}
.tarot-spread-desc{font-family:'Noto Serif SC',serif;font-size:0.85rem;color:rgba(200,190,230,0.5);letter-spacing:0.06em}
.tarot-guide-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;
  font-family:'Noto Serif SC',serif;font-size:0.85rem;color:rgba(200,190,230,0.5);transition:color 0.3s}
.tarot-guide-toggle:hover{color:rgba(220,210,240,0.85)}
.tarot-guide-toggle input{accent-color:rgba(160,140,200,0.7);width:16px;height:16px}

/* Main body: left-right split */
.tarot-body{display:flex;flex:1;gap:20px;min-height:0;overflow:hidden}
.tarot-left{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;overflow:hidden;gap:20px}
.tarot-right{width:380px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid rgba(160,140,200,0.1);padding-left:18px;gap:8px}

/* Card fan area — opened folding fan */
.tarot-fan{position:relative;width:100%;flex:0 0 auto;height:240px;min-height:240px}
.tarot-fan-card{position:absolute;width:115px;height:178px;border-radius:5px;cursor:pointer;
  transform-origin:center bottom;transition:margin-top 0.2s,opacity 0.4s,box-shadow 0.2s;
  background:linear-gradient(135deg,#1a1228 0%,#2a1a3a 50%,#1a1228 100%);
  border:1.5px solid rgba(180,160,120,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.35);
  display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:rgba(160,130,200,0.35)}
.tarot-fan-card:hover{box-shadow:0 8px 24px rgba(140,110,200,0.55);
  border-color:rgba(200,180,240,0.7);z-index:10!important;margin-top:-14px}
.tarot-fan-card.picked{opacity:0;pointer-events:none;transition:opacity 0.3s}

/* Card slots area */
.tarot-slots-wrap{display:flex;gap:16px;justify-content:center;align-items:flex-start;flex-wrap:wrap;flex-shrink:0;padding-top:16px}
.tarot-slot-item{width:115px;height:178px;border-radius:9px;position:relative;
  border:2px dashed rgba(160,140,200,0.25);display:flex;flex-direction:column;
  align-items:center;justify-content:center;transition:all 0.4s;perspective:600px}
.tarot-slot-item.filled{border-style:solid;border-color:rgba(180,160,120,0.4);
  background:rgba(26,18,40,0.6);box-shadow:0 4px 18px rgba(0,0,0,0.3)}
.tarot-slot-label{font-family:'Noto Serif SC',serif;font-size:0.78rem;color:rgba(200,190,230,0.55);
  margin-top:6px;text-align:center;letter-spacing:0.04em}
.tarot-slot-card{position:absolute;inset:0;border-radius:9px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:8px;text-align:center;opacity:0;transition:opacity 0.5s}
.tarot-slot-card.show{opacity:1}
.tarot-slot-card .ts-num{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:300;color:rgba(220,210,240,0.9)}
.tarot-slot-card .ts-cn{font-family:'Noto Serif SC',serif;font-weight:600;font-size:0.88rem;
  color:rgba(214,204,234,0.95);letter-spacing:0.06em;margin-top:4px}
.tarot-slot-card .ts-en{font-family:'Cormorant Garamond',serif;font-size:0.68rem;color:rgba(180,170,210,0.6);margin-top:2px}
.tarot-slot-card .ts-pos{font-size:0.65rem;padding:3px 10px;border-radius:4px;margin-top:5px;
  background:rgba(255,255,255,0.08);color:rgba(200,190,230,0.7)}

/* Flying card animation */
.tarot-flying{position:absolute;width:115px;height:178px;border-radius:5px;z-index:30;pointer-events:none;
  background:linear-gradient(135deg,#1a1228 0%,#2a1a3a 50%,#1a1228 100%);
  border:1.5px solid rgba(180,160,120,0.4);display:flex;align-items:center;justify-content:center;
  font-size:0.65rem;color:rgba(160,130,200,0.35);transition:all 0.55s cubic-bezier(0.25,0.46,0.45,0.94)}

/* Right panel: reading area */
.tarot-reading-panel{flex:1;overflow-y:auto;padding:16px;font-family:'Noto Serif SC',serif;
  font-size:0.95rem;line-height:2;color:rgba(220,215,240,0.88);white-space:pre-wrap;
  border-radius:10px;background:rgba(20,14,35,0.55);border:1px solid rgba(160,140,200,0.12);min-height:0}
.tarot-reading-panel::-webkit-scrollbar{width:3px}
.tarot-reading-panel::-webkit-scrollbar-thumb{background:rgba(160,140,200,0.3);border-radius:2px}
.tarot-reading-empty{display:flex;align-items:center;justify-content:center;height:100%;
  font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:rgba(160,140,200,0.2);letter-spacing:0.12em}
.tarot-reading-name{font-family:'Cormorant Garamond',serif;font-size:0.92rem;font-weight:600;
  color:rgba(180,170,220,0.65);margin-bottom:8px;letter-spacing:0.04em}

/* Follow-up section in right panel */
.tarot-followup-section{flex-shrink:0;display:flex;flex-direction:column;gap:7px}
.tarot-followup-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(160,140,200,0.15);
  background:rgba(175,195,228,0.06);color:rgba(220,215,240,0.9);font-family:'Noto Serif SC',serif;
  font-size:0.85rem;box-sizing:border-box;outline:none}
.tarot-followup-input::placeholder{color:rgba(160,140,200,0.3)}
.tarot-followup-input:focus{border-color:rgba(160,140,200,0.4)}
.tarot-followup-opts{display:flex;flex-direction:column;gap:6px}
.tarot-followup-opt{font-family:'Noto Serif SC',serif;font-size:0.85rem;color:rgba(200,190,230,0.7);
  background:rgba(140,110,200,0.08);border:1px solid rgba(160,140,200,0.2);border-radius:16px;
  padding:9px 16px;cursor:pointer;transition:all 0.3s;text-align:center}
.tarot-followup-opt:hover{color:rgba(230,220,250,1);background:rgba(140,110,200,0.18);border-color:rgba(180,160,220,0.5)}
.tarot-followup-count{font-family:'Noto Serif SC',serif;font-size:0.75rem;color:rgba(200,190,230,0.3);text-align:center;margin-top:2px}

/* Action buttons */
.tarot-actions{display:flex;gap:16px;padding-top:10px;flex-wrap:wrap;justify-content:center;flex-shrink:0}
.tarot-btn{font-family:'Noto Serif SC','Noto Sans SC',serif;font-size:0.85rem;font-weight:500;
  color:var(--silver);background:rgba(175,195,228,0.08);border:1px solid var(--glass-border);
  border-radius:10px;padding:7px 20px;cursor:pointer;transition:all 0.3s}
.tarot-btn:hover{background:rgba(175,195,228,0.2);border-color:var(--accent);color:var(--white)}
.tarot-action-log{text-align:center;padding:4px 12px;margin:4px 0}

/* ── AI GAME MODE ────────────────────────────────────── */
.game-ai-setup{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:25;display:none;padding:28px 36px;border-radius:14px;
  background:rgba(15,20,45,0.88);border:1px solid rgba(100,130,180,0.25);
  backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);
  box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(80,110,160,0.1),inset 0 1px 0 rgba(255,255,255,0.08);
  min-width:280px;max-width:380px;
  max-height:90%;overflow-y:auto}
.game-ai-setup.show{display:block}
.game-ai-setup h4{font-family:'Cormorant Garamond',serif;font-style:italic;
  font-size:1.1rem;color:var(--silver);margin-bottom:16px;text-align:center}
.game-ai-setup label{display:block;font-size:0.75rem;color:var(--text-secondary);margin:10px 0 4px;letter-spacing:0.04em}
.game-ai-setup select,.game-ai-setup input{width:100%;padding:8px 12px;background:rgba(175,195,228,0.06);
  border:1px solid var(--glass-border);border-radius:8px;color:var(--text-primary);
  font-family:'Noto Sans SC',sans-serif;font-size:0.82rem;outline:none}
.game-ai-setup select{cursor:pointer}
.game-ai-setup-actions{display:flex;gap:10px;margin-top:18px;justify-content:center}

/* ── GAME FULL PAGE ──────────────────────────────────── */
#page-game{max-width:none !important;padding:60px 16px 20px !important;display:none;
  flex-direction:column;align-items:center;justify-content:center}
#page-game.active{display:flex !important}
.game-cine{width:var(--room-w,100%);max-width:100%;flex-shrink:0;container-type:inline-size;padding:0 clamp(2px,1.4cqi,12px) clamp(6px,1.4cqi,12px);--cine-glow:0 0 11px rgba(255,255,255,0.5);--cine-rule:rgba(38,84,140,0.3)}
.game-cine-top{display:flex;align-items:baseline;gap:clamp(9px,2.2cqi,15px);flex-wrap:wrap}
.game-cine-top h2{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(1.05rem,4.3cqi,1.7rem);letter-spacing:0.06em;line-height:1.05;margin:0;color:#152c58;text-shadow:var(--cine-glow)}
.game-cine-sub{font-family:'Raleway',sans-serif;font-weight:300;font-size:clamp(0.6rem,1.85cqi,0.78rem);letter-spacing:0.2em;text-transform:uppercase;color:rgba(50,100,160,0.72);position:relative;padding-left:clamp(10px,2.4cqi,16px)}
.game-cine-sub::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:0.95em;background:var(--cine-rule)}
.game-cine-rule{height:1px;background:linear-gradient(90deg,var(--cine-rule),transparent);width:min(100%,32ch);margin-top:clamp(7px,1.7cqi,11px);opacity:0.9}
.game-cine-desc{font-family:'Noto Sans SC',sans-serif;font-weight:300;font-size:clamp(0.66rem,2.05cqi,0.8rem);color:rgba(20,50,100,0.82);line-height:1.7;margin-top:clamp(6px,1.5cqi,10px);max-width:46ch;text-shadow:0 0 8px rgba(255,255,255,0.5),0 1px 3px rgba(0,0,0,0.15)}
body.theme-infernal .game-cine{--cine-glow:0 1px 10px rgba(0,0,0,0.55);--cine-rule:rgba(165,188,230,0.3)}
body.theme-infernal .game-cine-top h2{color:#e8eef6}
body.theme-infernal .game-cine-sub{color:rgba(114,168,216,0.55)}
body.theme-infernal .game-cine-desc{color:rgba(190,202,222,0.6);text-shadow:0 1px 7px rgba(0,0,0,0.5)}
.game-fullpage-wrap{position:relative;border-radius:12px;overflow:hidden;
  box-shadow:0 8px 40px rgba(0,0,0,0.4);border:1px solid var(--glass-border)}

/* ── LOADING / FADE ──────────────────────────────────── */
.game-fade{position:absolute;inset:0;z-index:30;background:#0a0e1e;
  transition:opacity 0.8s ease;pointer-events:none}
.game-fade.hidden{opacity:0}


/* ── SIDEBAR DISABLED STATE ──────────────────── */
.game-sidebar-btn.disabled{opacity:0.3;cursor:not-allowed;pointer-events:none}
.game-sidebar-btn.disabled:hover{color:rgba(200,215,240,0.65);background:none;text-shadow:none}
.game-sidebar-btn-reset{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:13px;
  color:rgba(255,180,180,0.65);background:none;border:none;cursor:pointer;
  padding:8px 12px;border-radius:6px;transition:all 0.3s;letter-spacing:0.04em;
  white-space:nowrap;text-align:left;border-top:1px solid rgba(100,130,180,0.12);margin-top:4px}
.game-sidebar-btn-reset:hover{color:#ffaaaa;background:rgba(255,140,140,0.12);
  text-shadow:0 0 8px rgba(255,140,140,0.5)}

/* ── SIDEBAR GROUP LABELS & SEPARATORS ──────── */
.game-sidebar-title{font-family:'Cormorant Garamond',serif;font-size:15px;
  font-weight:500;color:#e8c247;letter-spacing:0.1em;
  text-shadow:0 0 10px rgba(232,194,71,0.30);
  padding:4px 12px 2px;user-select:none;margin-bottom:2px}
body:not(.theme-infernal) .game-sidebar-title{color:#bb8a16;text-shadow:0 0 8px rgba(255,240,200,0.5)}
.game-sidebar-group-label{font-family:'Noto Sans SC',sans-serif;font-size:9px;font-weight:500;
  color:rgba(140,160,200,0.45);letter-spacing:0.12em;text-transform:uppercase;
  padding:2px 12px 0;user-select:none}
.game-sidebar-sep{height:1px;margin:4px 10px;
  background:linear-gradient(90deg,transparent,rgba(100,130,180,0.18),transparent)}

/* ── INTERACTION MARKERS (reconstructed, RPG-Maker style) ──
   A soft hotspot glow on the object + a gently bobbing sparkle.
   Hover brightens everything and reveals a labelled plaque.
   Click auto-paths the character over and opens the module.        */
#game-indicators{transition:opacity 0.45s ease}
#game-indicators.ix-off{opacity:0}
#game-indicators.ix-off .ix-marker{pointer-events:none}
.game-viewport{--ix-core:#fff7e6;--ix-glow:#ffd98c;--ix-deep:#c79a4e}
body.theme-infernal .game-viewport{--ix-core:#ffeccb;--ix-glow:#ffc879;--ix-deep:#df9f48}

.ix-marker{position:absolute;width:88px;height:88px;z-index:7;cursor:pointer;
  pointer-events:auto;transform:translate(-50%,-50%);
  -webkit-tap-highlight-color:transparent}

/* hotspot glow that sits on the object */
.ix-aura{position:absolute;left:50%;top:55%;width:60px;height:34px;
  transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;
  background:radial-gradient(ellipse at center,
    color-mix(in srgb,var(--ix-glow) 55%,transparent) 0%,
    color-mix(in srgb,var(--ix-glow) 22%,transparent) 45%,transparent 72%);
  opacity:0.45;filter:blur(0.5px);animation:ixAura 3.4s ease-in-out infinite}
.ix-aura::after{content:'';position:absolute;inset:0;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--ix-core) 60%,transparent);
  opacity:0;transform:scale(0.6)}
@keyframes ixAura{0%,100%{opacity:0.32;transform:translate(-50%,-50%) scale(0.9)}
  50%{opacity:0.5;transform:translate(-50%,-50%) scale(1.04)}}

/* bobbing sparkle hovering above the object */
.ix-spark{position:absolute;left:50%;top:18%;width:24px;height:24px;
  transform:translateX(-50%);pointer-events:none;animation:ixBob 2.6s ease-in-out infinite}
.ix-spark-star{width:100%;height:100%;
  background:radial-gradient(circle at 50% 50%,var(--ix-core) 0%,
    var(--ix-glow) 38%,color-mix(in srgb,var(--ix-deep) 70%,transparent) 60%,transparent 74%);
  clip-path:polygon(50% 0%,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0% 50%,42% 42%);
  filter:drop-shadow(0 0 5px color-mix(in srgb,var(--ix-glow) 70%,transparent));
  animation:ixTwinkle 2.6s ease-in-out infinite}
@keyframes ixBob{0%,100%{transform:translateX(-50%) translateY(0)}
  50%{transform:translateX(-50%) translateY(-7px)}}
@keyframes ixTwinkle{0%,100%{transform:scale(0.78);opacity:0.72}
  50%{transform:scale(1);opacity:1}}

/* label plaque */
.ix-tag{position:absolute;left:50%;bottom:calc(100% - 14px);transform:translateX(-50%) translateY(4px);
  display:flex;align-items:baseline;gap:6px;white-space:nowrap;pointer-events:none;
  padding:3px 11px;border-radius:7px;opacity:0;transition:opacity 0.28s ease,transform 0.28s ease;
  background:rgba(14,20,36,0.62);border:1px solid color-mix(in srgb,var(--ix-glow) 38%,transparent);
  box-shadow:0 4px 16px rgba(0,0,0,0.4),0 0 14px color-mix(in srgb,var(--ix-glow) 18%,transparent);
  backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.ix-tag-en{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;
  letter-spacing:0.04em;color:var(--ix-core);text-shadow:0 0 10px color-mix(in srgb,var(--ix-glow) 60%,transparent)}
.ix-tag-cn{font-family:'Noto Serif SC',serif;font-size:11px;letter-spacing:0.12em;
  color:color-mix(in srgb,var(--ix-core) 80%,#cfe)}
body:not(.theme-infernal) .ix-tag{background:rgba(252,247,238,0.82);
  border-color:color-mix(in srgb,var(--ix-deep) 50%,transparent);
  box-shadow:0 4px 16px rgba(60,40,10,0.18),0 0 14px color-mix(in srgb,var(--ix-glow) 30%,transparent)}
body:not(.theme-infernal) .ix-tag-en{color:#6a4c12;text-shadow:0 0 8px rgba(255,240,200,0.7)}
body:not(.theme-infernal) .ix-tag-cn{color:#7a5a1e}

/* hover / active intensify */
.ix-marker:hover .ix-aura{opacity:0.85;animation:none;
  transform:translate(-50%,-50%) scale(1.18);width:72px;height:40px;
  background:radial-gradient(ellipse at center,
    color-mix(in srgb,var(--ix-glow) 75%,transparent) 0%,
    color-mix(in srgb,var(--ix-glow) 32%,transparent) 48%,transparent 74%)}
.ix-marker:hover .ix-aura::after{animation:ixPing 1.1s ease-out infinite}
@keyframes ixPing{0%{opacity:0.5;transform:scale(0.55)}80%{opacity:0;transform:scale(1.5)}100%{opacity:0}}
.ix-marker:hover .ix-spark{animation-duration:1.3s}
.ix-marker:hover .ix-spark-star{filter:drop-shadow(0 0 9px var(--ix-glow));animation-duration:1.3s}
.ix-marker:hover .ix-tag{opacity:1;transform:translateX(-50%) translateY(0)}
.ix-marker:active .ix-spark{transform:translateX(-50%) translateY(2px) scale(0.9)}

/* ── SUI GREETING — two extra options shown below the greeting line ─ */
.sui-extra-opts{position:absolute;top:57%;left:14%;right:14%;z-index:3;
  display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.sui-extra-opt{width:100%;text-align:left;margin:0}

/* Responsive scaling handled by JS updateScale() */
`;

/* ============================================================
   INJECT CSS
   ============================================================ */
function injectCSS(){
  const s=document.createElement('style');
  s.id='game-css';
  s.textContent=CSS+TEA_CSS+STORY_CSS;
  document.head.appendChild(s);
}

/* ============================================================
   INJECT HTML
   ============================================================ */
function injectHTML(){
  /* Nav link */
  const navLinks=document.querySelector('.nav-links');
  if(navLinks){
    const li=document.createElement('li');
    li.innerHTML='<a onclick="navTo(\'game\')" data-page="game">Room</a>';
    const chatLi=navLinks.querySelector('[data-page="chat"]')?.parentElement;
    if(chatLi) navLinks.insertBefore(li, chatLi);
    else navLinks.appendChild(li);
  }

  /* Game full page */
  const app=document.getElementById('app');
  if(app){
    const page=document.createElement('div');
    page.className='page';
    page.id='page-game';
    page.innerHTML='<div class="game-cine"><div class="game-cine-top"><h2>Room</h2><span class="game-cine-sub">Interactive pixel sanctuary</span></div><div class="game-cine-rule"></div><div class="game-cine-desc">古早像素风格的私密房间。点击右侧菜单或房间里的光标，开启塔罗占卜、茶话会与专属冒险剧本。</div></div><div class="game-fullpage-wrap" id="game-fullpage-wrap" style="display:flex"><div id="game-fullpage-container"></div><div class="game-sidebar" id="game-sidebar-page"><div class="game-sidebar-title">Menu</div><div class="game-sidebar-sep"></div><button class="game-sidebar-btn" data-action="sui">Sui</button><div class="game-sidebar-sep"></div><button class="game-sidebar-btn" data-action="tea">Tea</button><button class="game-sidebar-btn" data-action="desk">Story</button><button class="game-sidebar-btn" data-action="crystal">Tarot</button><div class="game-sidebar-sep"></div><button class="game-sidebar-btn" data-action="wardrobe">Wardrobe</button><button class="game-sidebar-btn" data-action="bed">Sleep</button><button class="game-sidebar-btn-reset" data-action="reset">Reset</button></div></div>';
    app.appendChild(page);
  }

  /* Mini icon */
  const mini=document.createElement('div');
  mini.innerHTML='Room';
  mini.id='game-mini';
  mini.addEventListener('click',()=>openGamePanel());
  document.body.appendChild(mini);

  /* Floating panel */
  const panel=document.createElement('div');
  panel.id='game-panel';
  panel.innerHTML=`<div class="game-panel-header" id="game-panel-header">
    <span class="game-panel-title">Room</span>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="game-panel-zoom">
        <button id="game-zoom-out" title="缩小">−</button>
        <button id="game-zoom-in" title="放大">+</button>
      </div>
      <button class="game-panel-close" id="game-panel-close">✕</button>
    </div>
  </div><div style="display:flex"><div id="game-panel-viewport-container"></div><div class="game-sidebar" id="game-sidebar">
    <div class="game-sidebar-title">Menu</div>
    <div class="game-sidebar-sep"></div>
    <button class="game-sidebar-btn" data-action="sui">Sui</button>
    <div class="game-sidebar-sep"></div>
    <button class="game-sidebar-btn" data-action="tea">Tea</button>
    <button class="game-sidebar-btn" data-action="desk">Story</button>
    <button class="game-sidebar-btn" data-action="crystal">Tarot</button>
    <div class="game-sidebar-sep"></div>
    <button class="game-sidebar-btn" data-action="wardrobe">Wardrobe</button>
    <button class="game-sidebar-btn" data-action="bed">Sleep</button>
    <button class="game-sidebar-btn-reset" data-action="reset">Reset</button>
  </div></div>`;
  document.body.appendChild(panel);
}

/* ============================================================
   GAME ENGINE
   ============================================================ */
let G = {
  initialized: false,
  running: false,
  state: 'sleeping', // sleeping | waking | idle | walking | interacting | lying | sitting
  outfitIdx: 2,      // default outfit = casual (blue everyday clothes); OUTFITS index 2
  charX: BED_STAND_X,
  charY: BED_STAND_Y,
  targetX: null,
  targetY: null,
  waypoint: null,
  path: null,          // array of {x,y} waypoints from findPath
  onArrive: null,      // callback fired when a walk completes (tour)
  tourActive: false,   // guided home tour in progress
  pendingTour: false,  // request to start the tour once the room is ready
  facing: 'down', // up | down | left | right
  walkFrame: 0,
  walkTimer: 0,
  idleFrame: 0,
  idleTimer: 0,
  lieFrame: 0,
  lieTimer: 0,
  lieMode: 'awake', // awake | sleeping
  isFirstOpen: true,
  dialogueActive: false,
  dialoguePages: [],
  dialoguePageIdx: 0,
  dialogueCb: null,
  typewriterIdx: 0,
  typewriterTimer: null,
  tarotOpen: false,
  wardrobeOpen: false,
  aiGameActive: false,
  aiGameRound: 0,
  aiGameHistory: [],
  teaOpen: false,
  teaAnimActive: false,
  _teaAnimInterval: null,
  teaChatActive: false,
  teaRound: 0,
  teaMaxRounds: 52,
  teaHistory: [],
  teaDrink: null,
  teaDessert: null,
  _teaCfg: null,
  _teaSysPrompt: '',
  _teaPortraitImg: null,   // custom DIY portrait for the current tea AI (or null)
  _aiPortraitImg: null,    // custom DIY portrait for the current Story AI (or null)
  /* ── Story 常驻视窗（storyWin）内部状态 ── */
  swEl: null,              // 视窗根DOM节点（null = 未开启）
  swMood: 'calm',          // 当前情绪：calm / joy / tense / sad / shock
  swFrame: 0,              // 精灵当前帧（0-5）
  swFrameTimer: null,      // 精灵帧循环定时器
  swBubbleTimer: null,     // “……”气泡打字机定时器
  swSaveTimer: null,       // 存档提示自动隐藏定时器
  swEmoteTimer: null,      // 头顶表情气泡自动消失定时器
  swThemeObs: null,        // body 主题class观察者（昼夜实时切换）
  mode: 'float', // float | page
  userScale: 0.75, // user zoom level for float mode
  animFrame: null,
  assets: {},
  container: null,
  viewport: null,
  lastTime: 0,
  scale: 1
};

/* ── ASSET LOADING ───────────────────────────────────── */
function loadImage(src){
  return new Promise((res)=>{
    const img=new Image();
    const timer=setTimeout(()=>{console.warn('[SuiGame] Timeout loading:',src);res(null)},8000);
    img.onload=()=>{clearTimeout(timer);res(img)};
    img.onerror=()=>{clearTimeout(timer);console.warn('[SuiGame] Failed to load:',src);res(null)};
    img.src=src;
  });
}

async function loadAssets(){
  const outfit = OUTFITS[G.outfitIdx];
  const toLoad = {
    roomDay: 'game/room_day.png',
    roomNight: 'game/room_night.png',
    dialogueBox: 'game/dialogue_box.png',
    walk: outfit.walk,
    idle: outfit.idle,
    lie: outfit.lie,
    portrait: outfit.portrait
  };
  const keys = Object.keys(toLoad);
  const results = await Promise.all(Object.values(toLoad).map(src=>loadImage(src)));
  keys.forEach((k,i)=>{
    G.assets[k]=results[i];
    if(!results[i]) console.warn('[SuiGame] Asset missing:',toLoad[k]);
  });
}

async function loadOutfitAssets(idx){
  const outfit = OUTFITS[idx];
  G.assets.walk = await loadImage(outfit.walk);
  G.assets.idle = await loadImage(outfit.idle);
  G.assets.lie = await loadImage(outfit.lie);
  G.assets.portrait = await loadImage(outfit.portrait);
}

/* ── CUSTOM DIY PORTRAIT (per-API nickname) ─────────────────
   The DIY module documents that each API can have a custom transparent
   half-body portrait placed at game/portraits/portrait_[API昵称].png, shown
   on the left of the Story and Tea dialogue boxes. This implements that:
   it builds the path from the config's nickname and loads it. loadImage()
   resolves to null on error/timeout, so a missing portrait simply shows
   nothing (no broken-image icon, no exception). */
function customPortraitSrc(cfg){
  if(!cfg) return null;
  const nick=(cfg.nickname||cfg.model||'').trim();
  if(!nick) return null;
  return 'game/portraits/portrait_['+nick+'].png';
}
function loadCustomPortrait(cfg){
  const src=customPortraitSrc(cfg);
  if(!src) return Promise.resolve(null);
  return loadImage(src);
}

/* ── VIEWPORT CREATION ───────────────────────────────── */
function createViewport(container){
  container.innerHTML=''; /* Clear any loading text */
  const vp = document.createElement('div');
  vp.className='game-viewport';
  vp.innerHTML = `
    <div class="game-bg game-bg-day"></div>
    <div class="game-bg game-bg-night"></div>
    <div class="game-cold-filter"></div>
    <div class="game-lights-overlay game-day-lights">
      <div class="light-beam-day"></div>
      <div class="light-beam-cool"></div>
      <div class="light-prism">
        <div class="light-prism-rainbow"></div>
        <div class="light-prism-streak1"></div>
        <div class="light-prism-streak2"></div>
        <div class="light-prism-shimmer"></div>
      </div>
    </div>
    <div class="game-lights-overlay game-night-lights">
      <div class="light-beam-night"></div>
    </div>
    <canvas class="game-lights" id="game-lights-canvas" width="${GAME_W}" height="${GAME_H}"></canvas>
    <div class="game-dust" id="game-dust"></div>
    <div class="game-vignette"></div>
    <div class="game-char" id="game-char" style="display:none">
      <div class="game-char-sprite"><img id="game-char-img"></div>
      <div class="game-char-shadow"></div>
      <div class="game-char-lightcast"></div>
    </div>
    <div class="game-char-lie" id="game-char-lie" style="display:none">
      <img id="game-char-lie-img">
    </div>
    <div id="game-indicators"></div>
    <div class="game-zzz" id="game-zzz" style="display:none"><span>Z</span><span>z</span><span>z</span></div>
    <div class="game-dialogue" id="game-dialogue">
      <div class="game-dialogue-portrait" id="game-portrait"><img id="game-portrait-img"></div>
      <div class="game-dialogue-box-wrap">
        <div class="game-dialogue-box">
          <div class="game-dialogue-name" id="game-dlg-name">Sui</div>
          <div class="game-dialogue-text" id="game-dlg-text"></div>
          <div class="game-dialogue-actions" id="game-dlg-actions"></div>
          <div class="game-choices" id="game-choices"></div>
          <div class="game-dlg-persistent" id="game-dlg-persistent">
            <button class="game-dlg-btn game-dlg-btn-back" id="game-dlg-back"><span class="tri-back">◂</span> Back</button>
            <button class="game-dlg-btn game-dlg-btn-save" id="game-dlg-save" style="display:none">✦ Save</button>
            <button class="game-dlg-btn game-dlg-btn-next" id="game-dlg-next-btn">Next <span class="tri-next">▸</span></button>
          </div>
        </div>
      </div>
    </div>
    <div class="game-wardrobe" id="game-wardrobe"></div>
    <div class="game-tarot" id="game-tarot"></div>
    <div class="game-ai-setup" id="game-ai-setup"></div>
    <div class="game-fade" id="game-fade"></div>
  `;

  /* Add candle lights */
  const candles = [
    {x:62,y:460,s:50},{x:72,y:680,s:40},       // left wall candles
    {x:358,y:235,s:45},{x:438,y:235,s:45},      // sconces by bed
    {x:1490,y:450,s:40},{x:1460,y:350,s:35},    // right wall candles
    {x:1345,y:475,s:30},{x:1370,y:478,s:28}     // desk candles
  ];
  const nightLayer = vp.querySelector('.game-night-lights');
  const dayLayer = vp.querySelector('.game-day-lights');
  candles.forEach(c=>{
    const el=document.createElement('div');
    el.className='light-candle light-candle-night';
    el.style.cssText=`left:${c.x-c.s/2}px;top:${c.y-c.s/2}px;width:${c.s}px;height:${c.s}px;animation-delay:${Math.random()*2}s`;
    nightLayer.appendChild(el);
    const el2=document.createElement('div');
    el2.className='light-candle';
    el2.style.cssText=`left:${c.x-c.s/2}px;top:${c.y-c.s/2}px;width:${c.s*0.6}px;height:${c.s*0.6}px;animation-delay:${Math.random()*2}s;opacity:0.3`;
    dayLayer.appendChild(el2);
  });
  /* Crystal glow */
  const crys = document.createElement('div');
  crys.className='light-crystal';
  nightLayer.appendChild(crys);
  const crys2=crys.cloneNode();
  crys2.style.opacity='0.4';
  dayLayer.appendChild(crys2);

  /* Floating light motes (day mode only) */
  for(let i=0;i<12;i++){
    const mote=document.createElement('div');
    mote.className='light-mote';
    const x=350+Math.random()*800;
    const y=100+Math.random()*600;
    const s=4+Math.random()*8;
    const dur=8+Math.random()*12;
    const mx=(Math.random()-0.5)*80;
    const my=-(20+Math.random()*60);
    mote.style.cssText=`left:${x}px;top:${y}px;width:${s}px;height:${s}px;animation-duration:${dur}s;animation-delay:${Math.random()*dur}s;--mx:${mx}px;--my:${my}px;--mx2:${mx*1.5}px;--my2:${my*1.5}px`;
    dayLayer.appendChild(mote);
  }

  /* Dust particles */
  const dustContainer=vp.querySelector('#game-dust');
  for(let i=0;i<20;i++){
    const d=document.createElement('div');
    d.className='dust-particle';
    d.style.left=Math.random()*100+'%';
    d.style.top=Math.random()*100+'%';
    d.style.animationDuration=(10+Math.random()*15)+'s';
    d.style.animationDelay=Math.random()*10+'s';
    d.style.opacity=0.2+Math.random()*0.4;
    dustContainer.appendChild(d);
  }

  /* Sidebar button handlers are set up in setupSidebar() */

  /* ── Interaction markers (glow + bobbing sparkle + hover plaque) ── */
  const indicatorDiv = vp.querySelector('#game-indicators');
  MARKERS.forEach(m=>{
    const it = INTERACTIONS.find(i=>i.id===m.id);
    if(!it) return;
    const marker = document.createElement('div');
    marker.className = 'ix-marker';
    marker.id = 'ix-'+m.id;
    marker.dataset.id = m.id;
    marker.style.left = it.iconX+'px';
    marker.style.top  = it.iconY+'px';
    marker.innerHTML =
      '<div class="ix-aura"></div>'+
      '<div class="ix-spark"><div class="ix-spark-star"></div></div>'+
      '<div class="ix-tag"><span class="ix-tag-en">'+m.en+'</span><span class="ix-tag-cn">'+m.cn+'</span></div>';
    marker.addEventListener('click', (e)=>{ onHintClick(m.id, e); });
    indicatorDiv.appendChild(marker);
  });

  /* Night background hidden by default */
  const isNight = document.body.classList.contains('theme-infernal');
  vp.querySelector('.game-bg-day').style.opacity = isNight?'0':'1';
  vp.querySelector('.game-bg-night').style.opacity = isNight?'1':'0';

  /* Click to move */
  vp.addEventListener('click', onViewportClick);

  container.appendChild(vp);
  G.viewport = vp;
  return vp;
}

/* ── SCALING ─────────────────────────────────────────── */
function updateScale(){
  if(!G.viewport) return;
  const sidebarW = G.mode==='float'
    ? (document.getElementById('game-sidebar')?.offsetWidth||0)
    : (document.getElementById('game-sidebar-page')?.offsetWidth||0);
  const introEl = document.querySelector('#page-game .game-cine');
  const introH = introEl ? introEl.offsetHeight + 6 : 0;
  const maxW = G.mode==='page' ? window.innerWidth-64-sidebarW : window.innerWidth-60-sidebarW;
  const maxH = G.mode==='page' ? window.innerHeight-140-introH : window.innerHeight-100;
  const sw = maxW/GAME_W, sh = maxH/GAME_H;
  const autoScale = Math.min(sw, sh, 1);
  G.scale = G.mode==='float' ? Math.min(autoScale, G.userScale||0.75) : autoScale;
  G.viewport.style.transform = `scale(${G.scale})`;
  G.viewport.style.transformOrigin = 'top left';
  const vw = Math.floor(GAME_W*G.scale), vh = Math.floor(GAME_H*G.scale);
  if(G.mode==='float'){
    const panel=document.getElementById('game-panel');
    if(panel){
      panel.style.width = (vw+sidebarW)+'px';
      panel.style.height = (vh+36)+'px';
    }
    const pc=document.getElementById('game-panel-viewport-container');
    if(pc){pc.style.width=vw+'px';pc.style.height=vh+'px';pc.style.overflow='hidden'}
  }else{
    const pc=document.getElementById('game-fullpage-container');
    if(pc){pc.style.width=vw+'px';pc.style.height=vh+'px';pc.style.overflow='hidden'}
    const wrap=document.getElementById('game-fullpage-wrap');
    if(wrap){wrap.style.height=vh+'px'}
    const pg=document.getElementById('page-game');
    if(pg){pg.style.setProperty('--room-w',(vw+sidebarW)+'px');pg.style.setProperty('--room-scale',String(G.scale))}
  }
}

/* ── GEOMETRY HELPERS ────────────────────────────────── */
function pointInPoly(px,py,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
    if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function pointInObstacle(px,py){
  for(const o of OBSTACLES){
    if(o.type==='circle'){
      if(Math.hypot(px-o.x,py-o.y)<o.r) return true;
    }else{
      if(px>o.x&&px<o.x+o.w&&py>o.y&&py<o.y+o.h) return true;
    }
  }
  return false;
}
function isWalkable(px,py){
  return pointInPoly(px,py,WALK_POLY) && !pointInObstacle(px,py);
}
function clampToWalkable(tx,ty){
  if(isWalkable(tx,ty)) return {x:tx,y:ty};
  /* Find nearest walkable point (brute-force on boundary) */
  let best=null, bestD=Infinity;
  for(let i=0;i<WALK_POLY.length;i++){
    const a=WALK_POLY[i], b=WALK_POLY[(i+1)%WALK_POLY.length];
    const p=nearestOnSegment(tx,ty,a.x,a.y,b.x,b.y);
    const d=Math.hypot(p.x-tx,p.y-ty);
    if(d<bestD && !pointInObstacle(p.x,p.y)){bestD=d;best=p}
  }
  return best||{x:G.charX,y:G.charY};
}
function nearestOnSegment(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
  return {x:ax+t*dx,y:ay+t*dy};
}

/* ── PATHFINDING (grid A* + line-of-sight smoothing) ──── */
let NAV=null;
function buildNavGrid(){
  const CELL=34, minX=80, maxX=1130, minY=370, maxY=855;
  const cols=Math.ceil((maxX-minX)/CELL), rows=Math.ceil((maxY-minY)/CELL);
  const grid=[];
  for(let r=0;r<rows;r++){grid[r]=[];for(let c=0;c<cols;c++){
    const x=minX+c*CELL+CELL/2, y=minY+r*CELL+CELL/2;
    grid[r][c]=isWalkable(x,y)?0:1;
  }}
  NAV={CELL,minX,minY,cols,rows,grid};
}
function navCellOf(x,y){return {c:Math.floor((x-NAV.minX)/NAV.CELL), r:Math.floor((y-NAV.minY)/NAV.CELL)}}
function navCenter(c,r){return {x:NAV.minX+c*NAV.CELL+NAV.CELL/2, y:NAV.minY+r*NAV.CELL+NAV.CELL/2}}
function navWalkable(c,r){return r>=0&&r<NAV.rows&&c>=0&&c<NAV.cols&&NAV.grid[r][c]===0}
function nearestNavCell(x,y){
  const o=navCellOf(x,y);
  if(navWalkable(o.c,o.r)) return o;
  for(let rad=1;rad<14;rad++){
    for(let dc=-rad;dc<=rad;dc++) for(let dr=-rad;dr<=rad;dr++){
      if(Math.abs(dc)!==rad&&Math.abs(dr)!==rad) continue;
      if(navWalkable(o.c+dc,o.r+dr)) return {c:o.c+dc,r:o.r+dr};
    }
  }
  return null;
}
function lineClear(ax,ay,bx,by){
  const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/8);
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;
    if(!isWalkable(ax+(bx-ax)*t, ay+(by-ay)*t)) return false;}
  return true;
}
function smoothPath(sx,sy,pts){
  const full=[{x:sx,y:sy},...pts], out=[];
  let i=0;
  while(i<full.length-1){
    let j=full.length-1;
    while(j>i+1 && !lineClear(full[i].x,full[i].y,full[j].x,full[j].y)) j--;
    out.push(full[j]); i=j;
  }
  return out;
}
function findPath(sx,sy,tx,ty){
  if(!NAV) buildNavGrid();
  if(lineClear(sx,sy,tx,ty)) return [{x:tx,y:ty}];
  const start=nearestNavCell(sx,sy), goal=nearestNavCell(tx,ty);
  if(!start||!goal) return [];
  const key=(c,r)=>r*NAV.cols+c;
  const g=new Map(), came=new Map(), open=new Map();
  const h=(c,r)=>Math.hypot(c-goal.c,r-goal.r);
  const sK=key(start.c,start.r);
  g.set(sK,0); open.set(sK,{c:start.c,r:start.r,f:h(start.c,start.r)});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=false, guard=0;
  while(open.size && guard++<20000){
    let bestK=null,best=null;
    for(const [k,v] of open){ if(!best||v.f<best.f){best=v;bestK=k} }
    open.delete(bestK);
    if(best.c===goal.c&&best.r===goal.r){found=true;break}
    const bK=key(best.c,best.r), bg=g.get(bK);
    for(const [dc,dr] of dirs){
      const nc=best.c+dc, nr=best.r+dr;
      if(!navWalkable(nc,nr)) continue;
      if(dc!==0&&dr!==0 && (!navWalkable(best.c+dc,best.r)||!navWalkable(best.c,best.r+dr))) continue;
      const nk=key(nc,nr), ng=bg+((dc!==0&&dr!==0)?1.4142:1);
      if(!g.has(nk)||ng<g.get(nk)){
        g.set(nk,ng); came.set(nk,bK);
        open.set(nk,{c:nc,r:nr,f:ng+h(nc,nr)});
      }
    }
  }
  if(!found) return [];
  const path=[]; let ck=key(goal.c,goal.r);
  while(ck!==undefined){
    const c=ck%NAV.cols, r=Math.floor(ck/NAV.cols);
    path.push(navCenter(c,r));
    if(ck===sK) break;
    ck=came.get(ck);
  }
  path.reverse();
  path.push({x:tx,y:ty});
  return smoothPath(sx,sy,path);
}

/* ── WALK ORCHESTRATION ───────────────────────────────── */
function startWalkTo(tx,ty,opts){
  opts=opts||{};
  const target=clampToWalkable(tx,ty);
  G.targetX=target.x; G.targetY=target.y;
  G.path=findPath(G.charX,G.charY,target.x,target.y);
  if(!G.path||!G.path.length){G.state='idle';G.targetX=null;G.targetY=null;G.path=null;return}
  G.waypoint=null;
  G.state='walking'; G.walkTimer=0;
  G.pendingInteraction=opts.interaction||null;
  G.onArrive=opts.onArrive||null;
  const first=(G.path&&G.path.length)?G.path[0]:target;
  const dx=first.x-G.charX, dy=first.y-G.charY;
  if(Math.abs(dx)>Math.abs(dy)) G.facing=dx>0?'right':'left';
  else G.facing=dy>0?'down':'up';
  if(G._interactTimeout){clearTimeout(G._interactTimeout);G._interactTimeout=null}
  if(opts.interaction||opts.onArrive){
    G._interactTimeout=setTimeout(()=>{
      if(G.state==='walking'){
        G.state='idle'; G.targetX=null; G.targetY=null; G.path=null;
        handleArrival();
      }
    }, opts.timeout||8000);
  }
}
function handleArrival(){
  if(G._interactTimeout){clearTimeout(G._interactTimeout);G._interactTimeout=null}
  if(G.onArrive){ const cb=G.onArrive; G.onArrive=null; G.pendingInteraction=null; cb(); return; }
  if(G.pendingInteraction){
    const id=G.pendingInteraction; G.pendingInteraction=null;
    const it=INTERACTIONS.find(i=>i.id===id); if(it) G.facing=it.face;
    triggerInteraction(id);
  }
}

/* ── MARKER VISIBILITY ────────────────────────────────── */
function updateMarkers(){
  if(!G.viewport) return;
  const ind=G.viewport.querySelector('#game-indicators');
  if(!ind) return;
  const show = G.state==='idle' && !G.tourActive && !G.dialogueActive &&
    !G.tarotOpen && !G.wardrobeOpen && !G.teaOpen && !G.teaChatActive && !G.aiGameActive;
  ind.classList.toggle('ix-off', !show);
}

/* ── Zzz DISPLAY ──────────────────────────────────────── */
function showZzz(show){
  const el=G.viewport?.querySelector('#game-zzz');
  if(!el)return;
  if(show){
    el.style.display='block';
    el.style.left=(BED_LIE_X+170)+'px';
    el.style.top=(BED_LIE_Y-10)+'px';
  }else{
    el.style.display='none';
  }
}

/* ── VIEWPORT CLICK → MOVE ───────────────────────────── */
function onViewportClick(e){
  if(G.aiGameActive) return; /* locked during AI game */
  if(G.teaChatActive||G.teaOpen) return; /* locked during Tea */
  if(G.tourActive) return; /* locked during the guided tour */
  if(G.dialogueActive||G.tarotOpen||G.wardrobeOpen||G.state==='interacting') return;
  if(G.state==='sleeping'){
    /* Wake up with eye-opening animation */
    showZzz(false);
    G.lieMode='awake'; G.lieFrame=0;
    updateLieSprite();
    G.state='waking';
    setTimeout(()=>{
      if(!G.viewport||G.state!=='waking') return;
      G.viewport.querySelector('#game-char-lie').style.display='none';
      G.viewport.querySelector('#game-char').style.display='block';
      G.charX=BED_STAND_X; G.charY=BED_STAND_Y;
      G.state='idle'; G.facing='down'; G.isFirstOpen=false;
      updateCharPosition(); updateIdleSprite();
      toggleSidebar(true);
      saveState();
    }, 800);
    return;
  }
  if(G.state==='lying'){
    /* Don't wake up during Sui dialogue */
    if(suiActive) return;
    /* Wake up from bed with eye-opening animation */
    showZzz(false);
    G.lieMode='awake'; G.lieFrame=0;
    updateLieSprite();
    G.state='waking';
    setTimeout(()=>{
      if(!G.viewport||G.state!=='waking') return;
      G.viewport.querySelector('#game-char-lie').style.display='none';
      G.viewport.querySelector('#game-char').style.display='block';
      G.charX=BED_STAND_X; G.charY=BED_STAND_Y;
      G.state='idle'; G.facing='down';
      updateCharPosition(); updateIdleSprite();
      toggleSidebar(true);
      saveState();
    }, 800);
    return;
  }
  if(G.state==='waking') return;
  const rect=G.viewport.getBoundingClientRect();
  const mx=(e.clientX-rect.left)/G.scale;
  const my=(e.clientY-rect.top)/G.scale;
  startWalkTo(mx,my);
}

/* ── HINT CLICK → WALK TO OBJECT & INTERACT (RPG Maker) ── */
function onHintClick(id, e){
  if(e) e.stopPropagation();
  if(G.aiGameActive||G.teaChatActive||G.teaOpen) return;
  if(G.tourActive) return; /* locked during the guided tour */
  if(G.dialogueActive||G.tarotOpen||G.wardrobeOpen||G.state==='interacting') return;
  if(G.state==='sleeping'||G.state==='lying'||G.state==='waking') return;

  const it = INTERACTIONS.find(i=>i.id===id);
  if(!it) return;

  /* Auto-path to the interaction point, then trigger on arrival */
  const walkX = id==='bed' ? BED_SLEEP_WALK_X : it.x;
  const walkY = id==='bed' ? BED_SLEEP_WALK_Y : it.y;
  startWalkTo(walkX, walkY, {interaction:id});
}

/* ── INTERACTION ─────────────────────────────────────── */
function resetGame(){
  /* One-click reset: clears any stuck state */
  if(G.typewriterTimer){clearInterval(G.typewriterTimer);G.typewriterTimer=null}
  closeDialogue();
  closeTarot();
  closeWardrobe();
  if(suiActive) exitSui();
  /* Tea cleanup */
  if(G.teaOpen) closeTeaSelect();
  if(G.teaChatActive) endTeaChat(false);
  stopTeaSpriteAnim();
  G.teaOpen=false;
  G.teaChatActive=false;
  if(G.viewport){
    const teaOverlay=G.viewport.querySelector('#game-tea-overlay');
    if(teaOverlay){teaOverlay.classList.remove('show');teaOverlay.innerHTML=''}
    const teaChat=G.viewport.querySelector('#game-tea-chat');
    if(teaChat) teaChat.remove();
  }
  if(G.viewport){
    const aiSetup=G.viewport.querySelector('#game-ai-setup');
    if(aiSetup) aiSetup.classList.remove('show');
  }
  G.aiGameActive=false;
  G._storyExitWarning=false;
  G._lastStoryState=null;
  G._aiCustomScript=null;
  G.dialogueActive=false;
  G.tarotOpen=false;
  G.wardrobeOpen=false;
  G.pendingInteraction=null;
  G.tourActive=false;
  G.path=null;
  G.onArrive=null;
  if(G._interactTimeout){clearTimeout(G._interactTimeout);G._interactTimeout=null}
  disableSidebarButtons(false);
  if(G.state==='sleeping'||G.state==='lying'){
    if(G.viewport){
      showZzz(false);
      G.viewport.querySelector('#game-char-lie').style.display='none';
      G.viewport.querySelector('#game-char').style.display='block';
    }
  }
  /* Always reset position to window center */
  G.charX=650; G.charY=500;
  G.facing='up'; G.isFirstOpen=false;
  G.state='idle';
  G.targetX=null;G.targetY=null;
  updateCharPosition(); updateIdleSprite();
  toggleSidebar(true);
  saveState();
  if(typeof toast==='function') toast('已复位');
}

function onInteract(id){
  if(!G.initialized||!G.viewport) return; /* Guard: game must be ready */
  /* Reset always works */
  if(id==='reset'){resetGame();return}
  /* Locked while the guided tour is running */
  if(G.tourActive){
    if(typeof toast==='function') toast('正在进行家园引导…');
    return;
  }
  /* Grayed-out buttons during AI game */
  if(G.aiGameActive){
    if(typeof toast==='function') toast('请先退出正在进行的互动游戏。');
    return;
  }
  if(G.teaChatActive||G.teaOpen){
    if(typeof toast==='function') toast('请先退出茶歇。');
    return;
  }
  if(G.dialogueActive||G.state==='interacting'){
    if(id==='sui'||id==='tea') showBubble(G.charX, G.charY-40, '请先取消目前的交互动作。');
    return;
  }
  if(G.state==='sleeping'||G.state==='lying'||G.state==='waking'){
    if(id==='sui'||id==='tea') showBubble(G.charX, G.charY-40, '请先取消目前的交互动作。');
    return;
  }

  /* Desk, Tarot, Wardrobe, Tea: trigger directly without walking */
  if(id==='desk'||id==='crystal'||id==='wardrobe'||id==='tea'){
    G.state='interacting';
    const it=INTERACTIONS.find(i=>i.id===id);
    if(it) G.facing=it.face;
    triggerInteraction(id);
    return;
  }
  /* Sui: walk to bedside, then trigger */
  if(id==='sui'){
    startWalkTo(BED_SLEEP_WALK_X, BED_SLEEP_WALK_Y, {interaction:'sui'});
    return;
  }
  /* Bed and other interactions: walk to point, then trigger */
  const it=INTERACTIONS.find(i=>i.id===id);
  if(!it) return;
  const walkX = id==='bed' ? BED_SLEEP_WALK_X : it.x;
  const walkY = id==='bed' ? BED_SLEEP_WALK_Y : it.y;
  startWalkTo(walkX, walkY, {interaction:id});
}

function triggerInteraction(id){
  G.state='interacting';
  G.facing='up';
  switch(id){
    case 'bed': interactBed(); break;
    case 'tea': interactTea(); break;
    case 'crystal': interactCrystal(); break;
    case 'desk': interactDesk(); break;
    case 'wardrobe': interactWardrobe(); break;
    case 'sui': interactSui(); break;
  }
}

/* ── BED INTERACTION ─────────────────────────────────── */
function interactBed(){
  if(!G.viewport){G.state='idle';return;}
  /* Stage 1: "现在我该睡觉了吗？" — Back=cancel, Next=stage 2 */
  showDialogue('Sui',[FIXED_LINES.bed1],()=>{
    const nextBtn=G.viewport.querySelector('#game-dlg-next-btn');
    const backBtn=G.viewport.querySelector('#game-dlg-back');
    nextBtn.onclick=()=>{
      closeDialogue();
      /* Stage 2: one page — "我知道了，好。" with "晚安。" on the next line → sleep */
      setTimeout(()=>{
        showDialogue('Sui',[FIXED_LINES.bed_confirm+'\n'+FIXED_LINES.bed_sleep],()=>{
          const nextBtn2=G.viewport.querySelector('#game-dlg-next-btn');
          const backBtn2=G.viewport.querySelector('#game-dlg-back');
          nextBtn2.onclick=()=>{
            closeDialogue();
            setTimeout(()=>{
              if(!G.viewport) return;
              G.viewport.querySelector('#game-char').style.display='none';
              G.viewport.querySelector('#game-char-lie').style.display='block';
              G.state='lying'; G.lieMode='sleeping'; G.lieFrame=1;
              updateLieSprite();
              showZzz(true);
              saveState();
            },400);
          };
          backBtn2.onclick=()=>{closeDialogue();G.state='idle'};
        });
      },200);
    };
    backBtn.onclick=()=>{closeDialogue();G.state='idle'};
  });
}

/* ── TEA INTERACTION — see Tea Module at end of file ─── */

function getTarotGuideHTML(companionLine){
  const status=companionLine||'你开始独自使用塔罗占卜……\n\n';
  return status+'Sui：欢迎使用占卜桌。\n\n点击上方「选择陪你占卜的TA」邀请一位解读者。\n\n上方的按钮可以切换牌阵：\n· 无牌阵 — 自由抽1~3张，没有固定含义\n· 单牌 — 1张，代表此刻的指引\n· 时间之流 — 3张：过去、现在、未来\n· 十字 — 4张：处境、障碍、建议、结果\n· 命运之星 — 5张：现状、挑战、根源、未来、潜力\n\n勾选「＋指引牌」可以多抽一张作为额外的指引。\n\n左边散开的牌就是78张塔罗牌。\n点一张，它会飞到下方的牌位上，自动翻面。\n\n牌位填满后，点击下方的「Invite AI」让TA为你解读。\n\n解读完成后可以：\n· Reshuffle — 全部重来\n· 追问 — 补充你的问题，让TA说更多（最多3次）\n· 存档 — 保存到密码日记本\n· Exit — 离开\n\n在心里默念你的问题，然后选一张牌吧。'
}

/* ── CRYSTAL BALL / TAROT ────────────────────────────── */
function interactCrystal(){
  showDialogue('Sui',[FIXED_LINES.crystal_intro],()=>{
    closeDialogue();
    openTarot();
  });
}

function openTarot(){
  if(!G.viewport){G.state='idle';return}
  G.tarotOpen=true;
  const panel=G.viewport.querySelector('#game-tarot');
  if(!panel){G.state='idle';G.tarotOpen=false;return}

  /* Auto-select first API if available */
  initTarotState(null);
  renderTarotUI(panel);
  panel.classList.add('show');
}

function initTarotState(cfg){
  G._tarot={
    spread:TAROT_SPREADS[1],guide:false,slots:[],totalSlots:1,deck:[],
    phase:'pick',readingText:'',cfg:cfg,freeCount:0,followupLeft:3,
    sessionLog:[]
  };
  const indices=[...Array(TAROT_DECK.length).keys()];
  for(let i=indices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]]}
  G._tarot.deck=indices;
}

/* Log a user action to the tarot session log and display it in the reading panel */
function logTarotAction(msg){
  var t=G._tarot;if(!t)return;
  t.sessionLog.push({type:'action',text:msg,time:Date.now()});
  /* Append to reading panel as centered styled entry */
  if(!G.viewport)return;
  var rp=G.viewport.querySelector('#tarot-reading-panel');
  if(rp){
    var el=document.createElement('div');
    el.className='tarot-action-log';
    el.textContent='【'+msg+'】';
    rp.appendChild(el);
    rp.scrollTop=rp.scrollHeight;
  }
}

function renderTarotUI(panel){
  const t=G._tarot;
  const spreadBtns=TAROT_SPREADS.map(s=>
    `<button class="tarot-spread-opt${s.id===t.spread.id?' active':''}" data-sid="${s.id}">${s.name}</button>`
  ).join('');

  panel.innerHTML=`
    <div class="tarot-spread-bar" id="tarot-spread-bar">${spreadBtns}</div>
    <div class="tarot-top-row">
      <div class="tarot-spread-desc" id="tarot-spread-desc">${t.spread.desc}</div>
      <label class="tarot-guide-toggle"><input type="checkbox" id="tarot-guide-cb"${t.guide?' checked':''}> ＋指引牌</label>
      <button class="tarot-spread-opt" id="tarot-change-ai" style="font-size:0.82rem;padding:5px 16px">${t.cfg?escapeHtml(t.cfg.nickname||t.cfg.model||'AI'):'✦ 选择陪你占卜的TA'}</button>
    </div>
    <div class="tarot-body">
      <div class="tarot-left">
        <div class="tarot-fan" id="tarot-fan"></div>
        <div class="tarot-slots-wrap" id="tarot-slots"></div>
      </div>
      <div class="tarot-right">
        <div class="tarot-reading-panel" id="tarot-reading-panel">
          ${getTarotGuideHTML(t.cfg?escapeHtml(t.cfg.nickname||t.cfg.model||'AI')+' 正在陪你一起使用塔罗占卜……\n\n':'')}
        </div>
        <div id="tarot-followup-wrap"></div>
      </div>
    </div>
    <div class="tarot-actions" id="tarot-actions">
      <button class="tarot-btn" id="tarot-exit">Exit</button>
    </div>`;

  /* Spread selection */
  panel.querySelectorAll('.tarot-spread-opt').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(t.phase!=='pick')return;
      const sp=TAROT_SPREADS.find(s=>s.id===btn.dataset.sid);
      if(!sp)return;
      t.spread=sp; t.slots=[]; t.freeCount=0;
      logTarotAction('你选择了「'+sp.name+'」牌阵……');
      updateTarotSlots(panel);
      panel.querySelectorAll('.tarot-spread-opt').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      panel.querySelector('#tarot-spread-desc').textContent=sp.desc;
      panel.querySelectorAll('.tarot-fan-card').forEach(c=>c.classList.remove('picked'));
    });
  });

  panel.querySelector('#tarot-guide-cb').addEventListener('change',(e)=>{
    if(t.phase!=='pick')return;
    t.guide=e.target.checked; t.slots=[]; t.freeCount=0;
    logTarotAction(t.guide?'你增加了指引牌……':'你取消了指引牌……');
    updateTarotSlots(panel);
    panel.querySelectorAll('.tarot-fan-card').forEach(c=>c.classList.remove('picked'));
  });

  /* Change AI companion button */
  const changeAiBtn=panel.querySelector('#tarot-change-ai');
  {
    changeAiBtn.addEventListener('click',()=>{
      const esc2=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s));
      const hasApis=typeof apiConfigs!=='undefined'&&apiConfigs.length>0;
      const rp=panel.querySelector('#tarot-reading-panel');
      if(!hasApis){
        var noapi=document.createElement('div');noapi.className='tarot-action-log';noapi.textContent='【还没有配置API。请在 API Settings 页面添加后再来。】';rp.appendChild(noapi);rp.scrollTop=rp.scrollHeight;
        return;
      }
      /* Show API selection as floating overlay on top of reading panel */
      var selDiv=document.createElement('div');selDiv.id='tarot-ai-sel-overlay';
      selDiv.style.cssText='position:absolute;inset:0;z-index:5;background:rgba(18,18,38,0.92);display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;overflow-y:auto;border-radius:8px';
      selDiv.innerHTML='<div style="font-family:Noto Serif SC,serif;font-size:0.92rem;color:rgba(220,215,240,0.6)">请选择陪你使用塔罗占卜的TA…</div>'+apiConfigs.map(a=>'<button class="tarot-followup-opt" data-caid="'+a.id+'" style="width:100%;padding:10px 16px;font-size:0.88rem">'+esc2(a.nickname||a.model||'AI')+'</button>').join('');
      var rpWrap=rp.parentElement;if(rpWrap)rpWrap.style.position='relative';
      rpWrap.appendChild(selDiv);
      selDiv.querySelectorAll('[data-caid]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const cfg2=apiConfigs.find(a=>a.id===btn.dataset.caid);
          if(cfg2){
            t.cfg=cfg2;
            changeAiBtn.textContent=esc2(cfg2.nickname||cfg2.model||'AI');
            logTarotAction('你选择了'+esc2(cfg2.nickname||cfg2.model||'AI')+'陪你占卜……');
            var welcome=document.createElement('div');welcome.style.cssText='padding:6px 0';
            welcome.textContent=esc2(cfg2.nickname||cfg2.model||'AI')+' 正在陪你一起使用塔罗占卜……\nSui：欢迎你们使用占卜桌。如果TA需要再看一次操作教程，可以向上翻阅。';
            welcome.style.whiteSpace='pre-wrap';
            rp.appendChild(welcome);rp.scrollTop=rp.scrollHeight;
          }
          selDiv.remove();
        });
      });
    });
  }

  generateTarotFan(panel);
  updateTarotSlots(panel);
  panel.querySelector('#tarot-exit').addEventListener('click',()=>{closeTarot();G.state='idle'});
}

function getTarotTotalSlots(){
  const t=G._tarot;
  let total=t.spread.id==='free'?t.spread.maxCards:t.spread.slots.length;
  if(t.guide)total++;
  return total;
}

function updateTarotSlots(panel){
  const t=G._tarot;
  const total=getTarotTotalSlots();
  t.totalSlots=total;
  const wrap=panel.querySelector('#tarot-slots');
  let labels=[];
  if(t.spread.id==='free'){for(let i=0;i<t.spread.maxCards;i++)labels.push('')}
  else{labels=t.spread.slots.map(s=>s.label)}
  if(t.guide)labels.push('指引');

  const items=[];
  for(let i=0;i<labels.length;i++){
    const filled=t.slots[i];
    const cls='tarot-slot-item'+(filled?' filled':'');
    let inner='';
    if(filled){
      const c=filled.card,pos=filled.reversed?'逆位':'正位';
      const numStr=c.type==='major'?c.num:c.symbol;
      const cnStr=c.type==='major'?c.cn:(c.suit.cn+(c.rank.cn||c.rank.en));
      const enStr=c.type==='major'?c.en:(c.rank.en+' of '+c.suit.en);
      inner=`<div class="tarot-slot-card show" style="background:linear-gradient(135deg,${c.color},${c.color}dd)"><div class="ts-num">${numStr}</div><div class="ts-cn">${cnStr}</div><div class="ts-en">${enStr}</div><div class="ts-pos">${pos}</div></div>`;
    }else{
      inner='<span style="font-size:1.4rem;color:rgba(160,140,200,0.18)">✦</span>';
    }
    items.push(`<div style="display:flex;flex-direction:column;align-items:center"><div class="${cls}" data-slot="${i}">${inner}</div><div class="tarot-slot-label">${labels[i]||''}</div></div>`);
  }
  wrap.innerHTML=items.join('');
  updateTarotActions(panel);
}

function generateTarotFan(panel){
  const fan=panel.querySelector('#tarot-fan');
  if(!fan)return;
  const fanW=fan.clientWidth;
  if(!fanW){ requestAnimationFrame(()=>generateTarotFan(panel)); return; }   /* panel not laid out yet — retry once visible */
  const total=TAROT_DECK.length;
  /* Chosen fan form: a wide, shallow 110° arc. Cards are drawn at the slot size
     (115×178) and the whole fan is sized to the live layout so it spans most of the
     width, sits just above the slot row, and never rises over the top bar.
     The slot row itself is untouched. */
  const cardW=115, cardH=178;                       /* card size = slot size */
  const spreadDeg=110;                              /* fan angle (form A) */
  const startDeg=-spreadDeg/2;
  const ea=(spreadDeg/2)*Math.PI/180;
  const halfW=fanW/2;
  const leanX=(cardW/2)*Math.cos(ea)+cardH*Math.sin(ea);   /* sideways reach of a tilted edge card */
  const Rx=Math.max(60,(halfW*0.98-leanX)/Math.sin(ea));   /* widen to fill ~the whole width, no side clip */
  let Ry=Rx*0.5327;                                 /* arc shape of preview A (wider than tall) */
  let upRoom=160;                                   /* empty space above the fan box, within .tarot-left */
  try{
    const lr=fan.parentElement.getBoundingClientRect();
    const fr=fan.getBoundingClientRect();
    upRoom=Math.max(80,fr.top-lr.top);
  }catch(e){}
  const LOW=12;                                     /* lowest card ≈12px above fan-box bottom → tidy gap to slots */
  const topMax=240+upRoom-6;                        /* keep the top under the bar */
  const rawExt=(ry)=>{
    let top=-1e9,bot=1e9;
    for(let i=0;i<total;i++){
      const ang=startDeg+(i/(total-1))*spreadDeg, r=ang*Math.PI/180, ct=Math.cos(r), st=Math.sin(r), yB=ct*ry;
      const cs=[[-cardW/2,0],[cardW/2,0],[-cardW/2,cardH],[cardW/2,cardH]];
      for(let k=0;k<4;k++){ const Y=yB+(-cs[k][0]*st+cs[k][1]*ct); if(Y>top)top=Y; if(Y<bot)bot=Y; }
    }
    return [top,bot];
  };
  let ext=rawExt(Ry);
  if(LOW+(ext[0]-ext[1])>topMax && (ext[0]-ext[1])>0){ Ry*=Math.max(0.3,(topMax-LOW)/(ext[0]-ext[1])); ext=rawExt(Ry); }
  const pivotY=LOW-ext[1];                           /* drop the fan so its lowest card sits just above the slots */
  let html='';
  for(let i=0;i<total;i++){
    const u=i/(total-1);                       /* 0..1 */
    const ang=startDeg+u*spreadDeg;            /* fan angle */
    const rad=ang*Math.PI/180;
    const x=Math.sin(rad)*Rx;                  /* horizontal offset of the base from center */
    const yBottom=pivotY+Math.cos(rad)*Ry;     /* base height above fan bottom */
    html+=`<div class="tarot-fan-card" data-idx="${i}" style="left:calc(50% + ${x.toFixed(1)}px - ${(cardW/2).toFixed(1)}px);bottom:${yBottom.toFixed(1)}px;transform:rotate(${ang.toFixed(1)}deg);z-index:${i}">✦</div>`;
  }
  fan.innerHTML=html;
  fan.querySelectorAll('.tarot-fan-card').forEach(el=>{
    el.addEventListener('click',()=>{
      if(G._tarot.phase!=='pick')return;
      if(el.classList.contains('picked'))return;
      pickTarotCard(panel,parseInt(el.dataset.idx),el);
    });
  });
}

function pickTarotCard(panel,deckIdx,fanEl){
  const t=G._tarot;
  const total=getTarotTotalSlots();
  const filledCount=t.slots.filter(Boolean).length;
  if(filledCount>=total)return;

  let slotIdx=-1;
  for(let i=0;i<total;i++){if(!t.slots[i]){slotIdx=i;break}}
  if(slotIdx<0)return;

  const cardIndex=t.deck[deckIdx];
  const card=TAROT_DECK[cardIndex];
  const reversed=Math.random()<0.5;
  logTarotAction('你抽到了 '+card.display+'（'+(reversed?'逆位':'正位')+'）……');
  fanEl.classList.add('picked');

  const panelRect=panel.getBoundingClientRect();
  const fanRect=fanEl.getBoundingClientRect();
  const slotEl=panel.querySelectorAll('.tarot-slot-item')[slotIdx];
  const slotRect=slotEl.getBoundingClientRect();

  const flyer=document.createElement('div');
  flyer.className='tarot-flying';
  flyer.textContent='✦';
  flyer.style.left=(fanRect.left-panelRect.left)+'px';
  flyer.style.top=(fanRect.top-panelRect.top)+'px';
  panel.appendChild(flyer);

  requestAnimationFrame(()=>{
    flyer.style.left=(slotRect.left-panelRect.left)+'px';
    flyer.style.top=(slotRect.top-panelRect.top)+'px';
    flyer.style.width='115px';
    flyer.style.height='178px';
    flyer.style.borderRadius='9px';
  });

  setTimeout(()=>{
    flyer.remove();
    t.slots[slotIdx]={card,reversed};
    if(t.spread.id==='free')t.freeCount++;
    updateTarotSlots(panel);
  },580);
}

function updateTarotActions(panel){
  const t=G._tarot;
  const actWrap=panel.querySelector('#tarot-actions');
  const filledCount=t.slots.filter(Boolean).length;
  const total=getTarotTotalSlots();

  if(t.phase==='pick'){
    const allFilled=filledCount>=total;
    const canFinish=t.spread.id==='free'&&filledCount>=1;
    let btns='<button class="tarot-btn" id="tarot-reshuffle">Reshuffle</button>';
    if(allFilled||canFinish){
      btns+='<button class="tarot-btn" id="tarot-interpret">Invite AI</button>';
      if(canFinish&&!allFilled)btns+='<button class="tarot-btn" id="tarot-done-free">完成选牌</button>';
    }
    btns+='<button class="tarot-btn" id="tarot-save">Save</button>';
    btns+='<button class="tarot-btn" id="tarot-exit">Exit</button>';
    actWrap.innerHTML=btns;
    actWrap.querySelector('#tarot-reshuffle')?.addEventListener('click',()=>{logTarotAction('你重置了牌阵……');resetTarot(panel)});
    actWrap.querySelector('#tarot-exit')?.addEventListener('click',()=>{closeTarot();G.state='idle'});
    actWrap.querySelector('#tarot-save')?.addEventListener('click',()=>saveTarotReading());
    actWrap.querySelector('#tarot-done-free')?.addEventListener('click',()=>{if(t.cfg)runTarotInterpret(panel,t.cfg);else{if(typeof toast==='function')toast('请先点击顶部「选择陪你占卜的TA」选择一位解读者')}});
    actWrap.querySelector('#tarot-interpret')?.addEventListener('click',()=>{if(t.cfg)runTarotInterpret(panel,t.cfg);else{if(typeof toast==='function')toast('请先点击顶部「选择陪你占卜的TA」选择一位解读者')}});
  }else if(t.phase==='reading'||t.phase==='followup'){
    let btns='<button class="tarot-btn" id="tarot-reshuffle">Reshuffle</button>';
    if(t.followupLeft>0) btns+='<button class="tarot-btn" id="tarot-followup-btn">追问</button>';
    btns+='<button class="tarot-btn" id="tarot-save">Save</button>';
    btns+='<button class="tarot-btn" id="tarot-exit">Exit</button>';
    actWrap.innerHTML=btns;
    actWrap.querySelector('#tarot-reshuffle')?.addEventListener('click',()=>{logTarotAction('你重置了牌阵……');resetTarot(panel)});
    actWrap.querySelector('#tarot-exit')?.addEventListener('click',()=>{closeTarot();G.state='idle'});
    actWrap.querySelector('#tarot-save')?.addEventListener('click',()=>saveTarotReading());
    actWrap.querySelector('#tarot-followup-btn')?.addEventListener('click',()=>showTarotFollowup(panel));
  }
}

async function runTarotInterpret(panel,cfg){
  const t=G._tarot;
  t.cfg=cfg;
  t.phase='reading';
  const fan=panel.querySelector('#tarot-fan');
  if(fan)fan.style.display='none';
  /* Hide spread bar in reading mode */
  const sbar=panel.querySelector('#tarot-spread-bar');if(sbar)sbar.style.display='none';
  const trow=panel.querySelector('.tarot-top-row');if(trow)trow.style.display='none';

  const drawnCards=t.slots.filter(Boolean);
  const spreadName=t.spread.name+(t.guide?' + 指引牌':'');
  let cardsDesc=drawnCards.map((s,i)=>{
    const pos=s.reversed?'逆位':'正位';
    const name=s.card.display;
    let label='';
    if(t.spread.id==='free'){label='第'+(i+1)+'张'}
    else{
      const slotLabels=[...t.spread.slots.map(sl=>sl.label)];
      if(t.guide)slotLabels.push('指引');
      label=slotLabels[i]||'';
    }
    return (label?label+'：':'')+name+'（'+pos+'）';
  }).join('\n');

  /* Get user name for prompt */
  let userName='对方';
  try{const about=await dbGet('about','main');if(about&&about.name)userName=about.name}catch(e){}

  const tarotBase='你是一位塔罗占卜师。请为你眼前的至亲之人来解读塔罗牌。\n你的解读风格客观、诚实，又不失亲和力。';
  const relPrefix=cfg.relationship?'你和对方的关系是：'+cfg.relationship+'。\n':'';
  const sysPrompt=(cfg.systemPrompt?cfg.systemPrompt+'\n\n':'')+relPrefix+tarotBase;
  const userPrompt=`用户使用「${spreadName}」牌阵进行了塔罗占卜：\n${cardsDesc}\n\n请综合这${drawnCards.length}张牌的位置含义和正逆位，给出占卜解读。使用中文，200字以内。`;

  const readPanel=panel.querySelector('#tarot-reading-panel');
  var loadDiv=document.createElement('div');loadDiv.id='tarot-loading-div';loadDiv.style.cssText='text-align:center;padding:20px;opacity:0.4';loadDiv.textContent='✦ 正在解读…';readPanel.appendChild(loadDiv);readPanel.scrollTop=readPanel.scrollHeight;
  logTarotAction('你询问了'+escapeHtml(cfg.nickname||cfg.model||'AI')+'如何解读……');
  updateTarotActions(panel);

  try{
    const aiName=cfg.nickname||cfg.model||'AI';
    const reply=await callApiChat(cfg,[{role:'system',content:sysPrompt},{role:'user',content:userPrompt}]);
    t.readingText=reply||'';
    if(!t.readingText){t.readingText='AI沉默了…请尝试重新解读。'}
    t._aiName=aiName;
    t._history=[{role:'system',content:sysPrompt},{role:'user',content:userPrompt},{role:'assistant',content:t.readingText}];
    /* Log AI reading to session */
    t.sessionLog.push({type:'ai-reading',text:t.readingText,time:Date.now()});
    var ld=readPanel.querySelector('#tarot-loading-div');if(ld)ld.remove();
    var rdiv=document.createElement('div');rdiv.style.cssText='padding:8px 0;border-top:1px solid rgba(160,140,200,0.06);margin-top:6px';rdiv.textContent=escapeHtml(aiName)+'：'+escapeHtml(t.readingText);readPanel.appendChild(rdiv);readPanel.scrollTop=readPanel.scrollHeight;
  }catch(e){
    t.phase='pick';
    let errMsg='连接遇到了问题';
    if(e.message){
      if(e.message.includes('超时'))errMsg='请求超时，请检查网络';
      else if(e.message.includes('401'))errMsg='API Key 无效';
      else if(e.message.includes('429'))errMsg='请求频率过高，请稍后再试';
      else errMsg=e.message;
    }
    readPanel.innerHTML='<div style="text-align:center;padding:20px"><div style="opacity:0.6;margin-bottom:12px">'+escapeHtml(errMsg)+'</div><button class="tarot-btn" id="tarot-retry">重试</button></div>';
    panel.querySelector('#tarot-retry')?.addEventListener('click',()=>{
      if(fan)fan.style.display='';
      if(sbar)sbar.style.display='';
      if(trow)trow.style.display='';
      readPanel.innerHTML=getTarotGuideHTML(G._tarot&&G._tarot.cfg?escapeHtml(G._tarot.cfg.nickname||G._tarot.cfg.model||'AI')+' 正在陪你一起使用塔罗占卜……\n\n':'');
      updateTarotActions(panel);
    });
  }
  /* Show follow-up count */
  const fwWrap=panel.querySelector('#tarot-followup-wrap');
  fwWrap.innerHTML=`<div class="tarot-followup-section"><div class="tarot-followup-count">剩余追问 ${t.followupLeft} 次</div></div>`;
  updateTarotActions(panel);
}

function showTarotFollowup(panel){
  const t=G._tarot;
  if(t.followupLeft<=0)return;
  t.phase='followup';
  const wrap=panel.querySelector('#tarot-followup-wrap');
  wrap.innerHTML=`<div class="tarot-followup-section">
    <input class="tarot-followup-input" id="tarot-fu-input" placeholder="补充你的问题（选填）…">
    <div class="tarot-followup-opts">
      <button class="tarot-followup-opt" data-ft="detail">希望TA解说得更详细</button>
      <button class="tarot-followup-opt" data-ft="summary">希望TA给你总结</button>
      <button class="tarot-followup-opt" data-ft="care">希望TA对你说一句关怀的话</button>
    </div>
    <div class="tarot-followup-count">剩余追问 ${t.followupLeft} 次</div>
  </div>`;
  wrap.querySelectorAll('[data-ft]').forEach(btn=>{
    btn.addEventListener('click',()=>handleTarotFollowup(panel,btn.dataset.ft));
  });
}

async function handleTarotFollowup(panel,type){
  const t=G._tarot;
  if(!t.cfg||!t._history||t.followupLeft<=0)return;
  const wrap=panel.querySelector('#tarot-followup-wrap');
  const userExtra=document.getElementById('tarot-fu-input')?.value?.trim()||'';

  let followMsg='';
  if(type==='detail') followMsg='请更详细地解读每张牌的含义，以及它们之间的关联。';
  else if(type==='summary') followMsg='请用简洁的几句话总结这次占卜的核心信息。';
  else followMsg='请以温柔关怀的语气，对我说一句安慰或鼓励的话。';
  if(userExtra) followMsg+='\n\n用户补充的问题：'+userExtra;

  /* Log the followup action */
  var logLabel=type==='detail'?'希望TA解说得更详细':type==='summary'?'希望TA给你总结':'希望TA对你说一句关怀的话';
  if(userExtra){logTarotAction('你输入了：【'+userExtra+'】，并追问了：【'+logLabel+'】。')}
  else{logTarotAction('你追问了：【'+logLabel+'】。')}
  t.sessionLog.push({type:'followup-q',text:logLabel+(userExtra?' / '+userExtra:''),time:Date.now()});

  t._history.push({role:'user',content:followMsg});
  t.followupLeft--;

  wrap.innerHTML=`<div class="tarot-followup-section"><div class="tarot-followup-count">剩余追问 ${t.followupLeft} 次</div></div>`;

  const readPanel=panel.querySelector('#tarot-reading-panel');
  readPanel.innerHTML+='<div id="tarot-fu-loading" style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(160,140,200,0.1);opacity:0.4;text-align:center">✦ ……</div>';
  readPanel.scrollTop=readPanel.scrollHeight;

  try{
    const reply=await callApiChat(t.cfg,t._history);
    t._history.push({role:'assistant',content:reply||''});
    t.readingText+='\n\n'+reply;
    t.sessionLog.push({type:'followup-a',text:reply||'',time:Date.now()});
    var fuLd=readPanel.querySelector('#tarot-fu-loading');if(fuLd)fuLd.remove();
    var fuDiv=document.createElement('div');fuDiv.style.cssText='margin-top:16px;padding-top:12px;border-top:1px solid rgba(160,140,200,0.1)';fuDiv.textContent=(t._aiName||'AI')+'：'+(reply||'……');readPanel.appendChild(fuDiv);
    readPanel.scrollTop=readPanel.scrollHeight;
  }catch(e){
    var fuLdErr=readPanel.querySelector('#tarot-fu-loading');if(fuLdErr)fuLdErr.remove();
    readPanel.innerHTML+='<div style="margin-top:10px;opacity:0.6">'+escapeHtml(e.message||'请求失败')+'</div>';
  }
  t.phase='reading';
  updateTarotActions(panel);
}

async function saveTarotReading(){
  const t=G._tarot;
  if(!t) return;
  if(!t.sessionLog||t.sessionLog.length===0){if(typeof toast==='function')toast('暂无可存档的内容');return}
  if(typeof dbPut==='undefined') return;

  const drawnCards=t.slots.filter(Boolean);
  const spreadName=t.spread.name+(t.guide?' + 指引牌':'');
  let content='【塔罗占卜记录】\n';
  content+='牌阵：'+spreadName+'\n\n';
  /* Include drawn cards if any */
  if(drawnCards.length>0){
    drawnCards.forEach((s,i)=>{
      const pos=s.reversed?'逆位':'正位';
      let label='';
      if(t.spread.id==='free'){label='第'+(i+1)+'张'}
      else{
        const labels=[...t.spread.slots.map(sl=>sl.label)];
        if(t.guide)labels.push('指引');
        label=labels[i]||'';
      }
      content+=(label?label+'：':'')+s.card.display+'（'+pos+'）\n';
    });
    content+='\n';
  }
  /* Include full session log */
  content+='【操作记录】\n';
  t.sessionLog.forEach(function(entry){
    if(entry.type==='action') content+='▸ '+entry.text+'\n';
    else if(entry.type==='ai-reading') content+='\n【AI解读】\n'+entry.text+'\n';
    else if(entry.type==='followup-q') content+='\n【追问】'+entry.text+'\n';
    else if(entry.type==='followup-a') content+=entry.text+'\n';
  });

  const aiName=t._aiName||'AI';
  const post={
    id:'tarot_'+Date.now(),
    title:'Tarot · '+spreadName,
    subtitle:aiName+' · '+(drawnCards.length||0)+'张',
    locked:true,
    category:'',
    content,
    created:Date.now(),
    updated:Date.now()
  };
  try{
    await ensureDiaryInit();
    await dbPut('posts',post);
    if(typeof toast==='function') toast('占卜记录已保存');
  }catch(e){
    if(typeof toast==='function') toast('保存失败');
  }
}

function resetTarot(panel){
  const t=G._tarot;
  t.slots=[];t.freeCount=0;t.phase='pick';t.readingText='';t._history=null;t.followupLeft=3;t.sessionLog=[];
  const indices=[...Array(TAROT_DECK.length).keys()];
  for(let i=indices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]]}
  t.deck=indices;
  const fan=panel.querySelector('#tarot-fan');if(fan)fan.style.display='';
  const sbar=panel.querySelector('#tarot-spread-bar');if(sbar)sbar.style.display='';
  const trow=panel.querySelector('.tarot-top-row');if(trow)trow.style.display='';
  generateTarotFan(panel);
  updateTarotSlots(panel);
  /* Don't clear reading panel — just log the action */
  const fw=panel.querySelector('#tarot-followup-wrap');if(fw)fw.innerHTML='';
}

function closeTarot(){
  G.tarotOpen=false;
  G._tarot=null;
  if(G.viewport){const panel=G.viewport.querySelector('#game-tarot');if(panel){panel.classList.remove('show');panel.innerHTML=''}}
}

/* Single AI response using a specific configuration */
/* ── DESK / AI GAME ──────────────────────────────────── */
function interactDesk(){
  showDialogue('Sui',[FIXED_LINES.desk_intro],()=>{
    showChoices(['开始游戏','用Blog里自己写的自定义剧本开启剧情。','为我介绍一下Story的玩法。'],(choice)=>{
      if(choice==='开始游戏'){
        closeDialogue();
        openAiSetup();
      }else if(choice.includes('自定义剧本')){
        closeDialogue();
        openCustomScriptSetup();
      }else{
        showDialogue('Sui',[
          'Story是一个AI驱动的互动文字冒险游戏。\n你选择一个AI来当游戏主持人，TA会为你实时编写分支剧情。',
          '开始前你需要做三个选择：\n· 选一个AI当主持人\n· 选故事类型（奇幻/悬疑/浪漫/科幻）\n· 选恐怖程度（无/低/中/高）',
          '游戏开始后，AI每轮会给你一段剧情，然后提供三个选项让你选择。\n你的每一个选择都会影响故事的走向。',
          '故事大约在12到16轮后结束。\n共有3个普通结局和1个隐藏结局——能不能触发隐藏结局，取决于你的选择。',
          '还有一种玩法：「自定义剧本」。\n你在Blog里写一篇日志当剧本（世界观、角色、剧情走向都行），AI会按你写的内容来主持游戏。',
          '游戏进行时，对话框中间会出现Save按钮。\n按下后我会帮你把当前的剧情进度写进密码日记本，此操作不会打断游戏进度，中途存档的剧本不会有剧透。',
          '通关结局后按下Save，\n我会为你整理一份完整的故事设定文档存入密码日记本，含全部结局与隐藏要素。\n结局页会出现两个新的按钮：Replay（以相同设定再来一局）和Exit（离开）。',
          '游戏过程中，按对话框左下角的Back可以随时退出（会有确认提示）。\n准备好了的话，按Back返回上一级，然后开始你的故事吧。'
        ],null);
      }
    });
  });
}

function openAiSetup(){
  if(!G.viewport){G.state='idle';return}
  /* Check if any API is configured */
  const hasApi = typeof apiConfigs!=='undefined' && apiConfigs.length>0;
  const panel=G.viewport.querySelector('#game-ai-setup');
  if(!panel){G.state='idle';return}
  if(!hasApi){
    panel.innerHTML=`<h4>No API Configured</h4><p style="font-size:0.8rem;color:var(--text-muted);text-align:center">${FIXED_LINES.no_api}</p>
    <div class="game-ai-setup-actions"><button class="tarot-btn" id="game-ai-noapi-close">Close</button></div>`;
    panel.classList.add('show');
    panel.querySelector('#game-ai-noapi-close').addEventListener('click',()=>{panel.classList.remove('show');G.state='idle'});
    return;
  }
  const apiOpts = apiConfigs.map((a,i)=>`<option value="${i}">${a.nickname||a.model||'AI'}</option>`).join('');
  panel.innerHTML=`<h4>Interactive Story</h4>
    <label>AI</label><select id="game-ai-select">${apiOpts}</select>
    <label>Genre</label><select id="game-genre"><option value="fantasy">Fantasy</option><option value="mystery">Mystery</option><option value="romance">Romance</option><option value="scifi">Sci-Fi</option></select>
    <label>Horror Elements</label><select id="game-horror"><option value="no">No</option><option value="low">Low</option><option value="mid">Medium</option><option value="high">High</option></select>
    <div class="game-ai-setup-actions">
      <button class="tarot-btn" id="game-ai-start">Start</button>
      <button class="tarot-btn" id="game-ai-cancel">Cancel</button>
    </div>`;
  panel.classList.add('show');

  panel.querySelector('#game-ai-start').addEventListener('click',()=>{
    const aiIdx=parseInt(panel.querySelector('#game-ai-select').value);
    const genre=panel.querySelector('#game-genre').value;
    const horror=panel.querySelector('#game-horror').value;
    panel.classList.remove('show');
    /* Genre-specific Sui response before starting */
    const genreLines={
      fantasy:'有时我会感到幻想与现实之间的距离……并不远。',
      mystery:'等等，现在是侦探时间吗？',
      romance:'浪漫主义就是爱情的本质吗？',
      scifi:'我要穿着现在的衣服去玩吗？会不会不合氛围？'
    };
    const line=genreLines[genre]||'……';
    showDialogue('Sui',[line],()=>{
      closeDialogue();
      startAiGame(aiIdx, genre, horror);
    });
  });
  panel.querySelector('#game-ai-cancel').addEventListener('click',()=>{
    panel.classList.remove('show');
    G.state='idle';
  });
}

async function openCustomScriptSetup(){
  if(!G.viewport){G.state='idle';return}
  const hasApi=typeof apiConfigs!=='undefined'&&apiConfigs.length>0;
  const panel=G.viewport.querySelector('#game-ai-setup');
  if(!panel){G.state='idle';return}
  if(!hasApi){
    panel.innerHTML=`<h4>No API Configured</h4><p style="font-size:0.8rem;color:var(--text-muted);text-align:center">${FIXED_LINES.no_api}</p>
    <div class="game-ai-setup-actions"><button class="tarot-btn" id="game-ai-noapi-close">Close</button></div>`;
    panel.classList.add('show');
    panel.querySelector('#game-ai-noapi-close').addEventListener('click',()=>{panel.classList.remove('show');G.state='idle'});
    return;
  }
  /* Load blog posts (exclude locked diary) */
  let posts=[];
  try{const all=await dbGetAll('posts');posts=all.filter(p=>p.locked!==true&&p.category!=='🔒 密码日记本').sort((a,b)=>b.created-a.created)}catch(e){}
  if(!posts.length){
    panel.innerHTML=`<h4>自定义剧本</h4><p style="font-size:0.85rem;color:var(--text-muted);text-align:center;line-height:1.8">Blog里还没有日志。\n请先去Blog写一篇日志作为剧本。</p>
    <div class="game-ai-setup-actions"><button class="tarot-btn" id="game-ai-noapi-close">Close</button></div>`;
    panel.classList.add('show');
    panel.querySelector('#game-ai-noapi-close').addEventListener('click',()=>{panel.classList.remove('show');G.state='idle'});
    return;
  }
  const esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s));
  const apiOpts=apiConfigs.map((a,i)=>`<option value="${i}">${esc(a.nickname||a.model||'AI')}</option>`).join('');
  const postList=posts.map(p=>`<div class="game-script-item" data-pid="${p.id}" style="padding:10px 14px;margin-bottom:6px;border:1px solid rgba(175,195,228,0.15);border-radius:8px;cursor:pointer;transition:all 0.3s"><div style="font-size:0.88rem;color:var(--light);margin-bottom:3px">${esc(p.title||'无标题')}</div><div style="font-size:0.72rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((p.content||'').slice(0,60))}</div></div>`).join('');
  panel.innerHTML=`<h4>自定义剧本</h4>
    <label>AI 主持人</label><select id="game-cs-ai">${apiOpts}</select>
    <label style="margin-top:12px">选择一篇日志作为剧本</label>
    <div id="game-cs-posts" style="max-height:200px;overflow-y:auto;margin-bottom:12px">${postList}</div>
    <div class="game-ai-setup-actions">
      <button class="tarot-btn" id="game-cs-start" style="opacity:0.4;pointer-events:none">开始</button>
      <button class="tarot-btn" id="game-cs-cancel">取消</button>
    </div>`;
  panel.classList.add('show');
  panel.style.maxHeight='80%';

  let selectedPostId=null;
  panel.querySelectorAll('.game-script-item').forEach(item=>{
    item.addEventListener('mouseover',()=>item.style.borderColor='rgba(175,195,228,0.4)');
    item.addEventListener('mouseout',()=>{if(item.dataset.pid!==selectedPostId)item.style.borderColor='rgba(175,195,228,0.15)'});
    item.addEventListener('click',()=>{
      panel.querySelectorAll('.game-script-item').forEach(el=>el.style.borderColor='rgba(175,195,228,0.15)');
      item.style.borderColor='var(--accent)';
      selectedPostId=item.dataset.pid;
      const startBtn=panel.querySelector('#game-cs-start');
      startBtn.style.opacity='1';startBtn.style.pointerEvents='auto';
    });
  });

  panel.querySelector('#game-cs-start').addEventListener('click',async()=>{
    if(!selectedPostId)return;
    const aiIdx=parseInt(panel.querySelector('#game-cs-ai').value);
    const post=posts.find(p=>p.id===selectedPostId);
    if(!post){if(typeof toast==='function')toast('日志不存在');return}
    panel.classList.remove('show');
    showDialogue('Sui',['收到。让我先看一下你的剧本……'],()=>{
      closeDialogue();
      startAiGame(aiIdx,'custom','no',post.content);
    });
  });
  panel.querySelector('#game-cs-cancel').addEventListener('click',()=>{
    panel.classList.remove('show');
    G.state='idle';
  });
}

function startAiGame(aiIdx, genre, horror, customScript){
  G.aiGameActive=true;
  G.aiGameRound=0;
  G.aiGameHistory=[];
  G._aiSession=(G._aiSession||0)+1;/* FIX: 会话令牌，作废上一局可能仍在途的请求 */
  G._progressSaving=false;
  G._aiCfg=apiConfigs[aiIdx];
  G._aiGenre=genre;
  G._aiHorror=horror;
  G._aiCustomScript=customScript||null;
  /* BUG-4 fix: load this AI's custom DIY portrait (portrait_[nickname].png).
     The quick local fetch finishes well before the first networked AI reply,
     so the portrait is ready when the AI's first line is shown. */
  G._aiPortraitImg=null;
  loadCustomPortrait(G._aiCfg).then(img=>{ G._aiPortraitImg=img; });
  /* Lock movement — gray out sidebar buttons */
  disableSidebarButtons(true);
  openStoryWindow();/* Story常驻视窗：开窗淡入（Replay重开新局时复用同一视窗） */

  const personalize=!!(G._aiCfg&&G._aiCfg.storyPersonalize);
  const relHint2=personalize&&G._aiCfg.relationship?'你和玩家的关系是：'+G._aiCfg.relationship+'。\n':'';
  /* BUGFIX v1.0.2: 界面选项的英文代号先翻译成中文,避免 prompt 中英夹杂 */
  const GENRE_CN={fantasy:'奇幻',mystery:'悬疑推理',romance:'恋爱',scifi:'科幻'};
  const HORROR_CN={low:'轻微',mid:'中等',high:'强烈'};
  let sysPrompt;
  if(customScript){
    sysPrompt=relHint2+`请扮演互动小说/文字冒险游戏的游戏主持人。
以下是玩家提供的自定义剧本，请根据剧本内容来主持游戏：

「${customScript.slice(0,3000)}」

请按照剧本中的世界观、角色和剧情逻辑来推进故事。如果剧本只提供了方向性描述，请自由发挥细节。
每次给出一段剧情描述（200字以内），然后提供3个选项让玩家选择。
故事在第12轮（可酌情增加到12到16轮）结束时导向结局。共有3个普通结局和1个隐藏结局。
请以JSON格式回复：
{"story":"剧情文字","choices":["选项1","选项2","选项3"],
 "isEnding":false,"endingType":null,"mood":"calm"}
其中mood字段表示Sui听到这段剧情时的情绪反应，只能取以下5个值之一：calm（平静日常）、joy（开心愉悦）、tense（紧张警惕）、sad（悲伤难过）、shock（震惊意外）。请根据剧情走向与玩家上一个选项造成的后果来选择。
不要输出任何JSON以外的内容。`;
  }else{
    sysPrompt=relHint2+`请扮演互动小说/文字冒险游戏的游戏主持人来主持这个游戏。
用户选择了${GENRE_CN[genre]||genre}类型游戏，恐怖设定为${horror==='no'?'否':'是'}${horror!=='no'?'，程度为'+(HORROR_CN[horror]||horror):''}。
每次给出一段剧情描述（180字以内），然后提供3个选项让玩家选择。
故事在第12轮（可酌情增加到12到16轮）结束时导向结局。共有3个普通结局和1个隐藏结局。
请以JSON格式回复：
{"story":"剧情文字","choices":["选项1","选项2","选项3"],
 "isEnding":false,"endingType":null,"mood":"calm"}
其中mood字段表示Sui听到这段剧情时的情绪反应，只能取以下5个值之一：calm（平静日常）、joy（开心愉悦）、tense（紧张警惕）、sad（悲伤难过）、shock（震惊意外）。请根据剧情走向与玩家上一个选项造成的后果来选择。
不要输出任何JSON以外的内容。`;
  }
  /* Stack with custom API system prompt only when storyPersonalize is on */
  if(personalize){
    const apiCustom=(G._aiCfg.systemPrompt||'').trim();
    if(apiCustom) sysPrompt=apiCustom+'\n\n---\n\n'+sysPrompt;
  }
  G._aiSysPrompt=sysPrompt;

  /* Send first message */
  aiGameTurn('开始游戏');
}

const ENDING_ANNOUNCE='故事到这里就结束了，感谢你陪我走完这段旅程。\n请点击新弹出的按钮：\nSave — 整理完整设定文档并保存\nReplay — 用相同设定再来一局\nExit — 离开故事模式';

/* 结局操作按钮（主路径与Back恢复路径共用，修复旧版恢复路径里Exit不询问存档的不一致） */
/* 存档结果反馈：成功 / 仅存原始记录 / 彻底失败。彻底失败时不退出游戏，
   让玩家停在结局页可再按一次Save重试，避免记录无声丢失。 */
function finishGameSave(res){
  if(res==='busy')return;/* 连点产生的第二次调用，交给第一次处理 */
  if(res==='fail'){
    showDialogue('Sui',['抱歉，由于未知原因，我无法写入设定文档。\n可再次点击Save重试，或查看Blog是否有部分写入。'],()=>{showEndingActions()});
    return;
  }
  if(res==='raw'){
    showDialogue('Sui',['由于未知原因，我未能写入完整的设定文档。我已经保存了部分的原始记录文档。'],()=>{closeDialogue();endAiGame()});
    return;
  }
  showDialogue('Sui',['已整理完毕。我已将完整的设定文档写入密码日记本。'],()=>{closeDialogue();endAiGame()});
}
function showEndingActions(){
  showDialogueActions([
    {label:'Save',cb:()=>{ showDialogue('Sui',['明白。正在帮你整理故事记录……'],null); saveGameAsBlog().then(r=>finishGameSave(r)).catch(()=>finishGameSave('fail')) }},
    {label:'Replay',cb:()=>{ closeDialogue(); /* FIX: 按id查找而非indexOf，避免apiConfigs数组被重载后误报"已删除" */ const idx=apiConfigs.findIndex(a=>G._aiCfg&&a.id===G._aiCfg.id); if(idx<0){if(typeof toast==='function')toast('该API已被删除，请重新选择');openAiSetup();return} startAiGame(idx,G._aiGenre,G._aiHorror,G._aiCustomScript); }},
    {label:'Exit',cb:()=>{
      showDialogue('Sui',['要先把这次的游戏记录存档到密码日记本再离开吗？'],()=>{
        showDialogueActions([
          {label:'存档并离开',cb:()=>{showDialogue('Sui',['明白。正在帮你整理故事记录……'],null);saveGameAsBlog().then(r=>finishGameSave(r)).catch(()=>finishGameSave('fail'))}},
          {label:'直接离开',cb:()=>{closeDialogue();endAiGame()}}
        ]);
      });
    }}
  ]);
}

async function aiGameTurn(userChoice){
  G.aiGameRound++;
  G.aiGameHistory.push({role:'user',content:userChoice});
  await aiGameSend();
}

/* 发送当前回合。与aiGameTurn拆开，使"重试"不会重复推进轮数、重复写入历史 */
async function aiGameSend(){
  const session=G._aiSession;
  G._aiSending=true;

  const recentHistory=G.aiGameHistory.length>40?G.aiGameHistory.slice(-40):G.aiGameHistory;
  const msgs=recentHistory.map(m=>({role:m.role,content:m.content}));
  const messages=[{role:'system',content:G._aiSysPrompt},...msgs];

  /* Show Sui thinking "……" while waiting for AI — portrait shown */
  showDialogue('Sui',[FIXED_LINES.thinking],null);

  try{
    const reply = await callApiChat(G._aiCfg, messages);
    G._aiSending=false;
    if(!G.aiGameActive||session!==G._aiSession)return;/* 玩家已退出，丢弃迟到响应 */
    if(!reply||!String(reply).trim()){aiGameError('连接失败，请检查API配置和网络连接。');return}
    G.aiGameHistory.push({role:'assistant',content:reply});

    let data;
    try{
      data=extractJSON(reply);
    }catch(e){
      data={story:reply,choices:['继续','返回'],isEnding:false};
    }
    if(typeof data.story!=='string'||!data.story.trim())data.story=String(reply);
    if(!data.isEnding&&(!Array.isArray(data.choices)||!data.choices.length))data.choices=['继续'];
    storyWinMood(data.mood);

    /* Show story in dialogue under AI narrator name */
    const name = G._aiCfg.nickname||'???';
    G._lastStoryState={name,data};
    showDialogue(name, [data.story], ()=>{
      if(data.isEnding){
        showDialogue(name,[ENDING_ANNOUNCE],()=>{showEndingActions()});
      }else if(data.choices && data.choices.length){
        showChoices(data.choices, (choice)=>{
          showDialogue('Sui',[FIXED_LINES.thinking],()=>{
            aiGameTurn(choice);
          });
        });
      }
    });
  }catch(err){
    G._aiSending=false;
    if(!G.aiGameActive||session!==G._aiSession)return;
    aiGameError(err.message||'请检查API配置');
  }
}

/* FIX: 错误不再直接终结整局游戏（旧版一次超时/429就毁掉十几轮进度），改为提供重试 */
function aiGameError(msg){
  storyWinError();/* Story视窗：“！”报错演出 */
  const m=String(msg||'未知错误').slice(0,80);
  showDialogue('Sui',['连接遇到了问题：'+m+'\n请选择重试、存档，或退出Story模式。'],()=>{
    showDialogueActions([
      {label:'重试',cb:()=>{aiGameSend()}},
      {label:'存档并退出',cb:()=>{showDialogue('Sui',['收到。正在帮你保存当前进度……'],null);saveGameProgress().then(()=>{closeDialogue();endAiGame()}).catch(()=>{closeDialogue();endAiGame()})}},
      {label:'退出',cb:()=>{closeDialogue();endAiGame()}}
    ]);
  });
}

function endAiGame(){
  closeStoryWindow();/* Story视窗：淡出并销毁 */
  G.aiGameActive=false;
  G._aiSession=(G._aiSession||0)+1;
  G._aiSending=false;
  G._storyExitWarning=false;
  G._lastStoryState=null;
  G._aiCustomScript=null;
  G._aiPortraitImg=null;
  G.state='idle';
  disableSidebarButtons(false);
}

/* ── 游戏内进度存档（常驻Save按钮）──────────────────────
   与"结局后Save"分工：进度存档=把目前为止的剧情与选择原样快照进密码日记本，
   瞬时完成、不调用API、不打断游戏；结局后Save=让AI整理完整设定文档。 */
async function saveGameProgress(){
  if(typeof dbPut==='undefined'){if(typeof toast==='function')toast('存档功能不可用');return}
  if(!G.aiGameActive||!G.aiGameHistory||!G.aiGameHistory.length){if(typeof toast==='function')toast('暂无可存档的进度');return}
  if(G._progressSaving)return;/* 防连点 */
  G._progressSaving=true;
  storyWinSave('saving');/* Story视窗：SAVING…演出 */
  try{
    let content='【互动故事 · 进度存档】（第'+G.aiGameRound+'轮，故事进行中）\n\n';
    G.aiGameHistory.forEach(m=>{
      try{
        if(m.role==='assistant'){
          const d=extractJSON(m.content);
          content+=d.story+'\n\n';
          if(d.choices)content+='选项: '+d.choices.join(' / ')+'\n\n';
        }else{content+='▸ '+m.content+'\n\n'}
      }catch(e){content+=m.content+'\n\n'}
    });
    const post={id:'post_'+Date.now(),title:'📖 Story 进度 — '+((G._aiCfg&&G._aiCfg.nickname)||'AI'),
      subtitle:'第'+G.aiGameRound+'轮 · 进行中',locked:true,category:'',content,created:Date.now(),updated:Date.now()};
    await ensureDiaryInit();
    await dbPut('posts',post);
    if(typeof toast==='function')toast('已存档当前进度（第'+G.aiGameRound+'轮）');
    storyWinSave('ok');
  }catch(e){
    if(typeof toast==='function')toast('进度存档失败');
    storyWinSave('fail');
  }
  G._progressSaving=false;
}

async function saveGameAsBlog(){
  if(typeof dbPut==='undefined')return 'fail';
  if(G._docSaving)return 'busy';/* 防重复触发：结局Save与"存档并离开"被连点时只生成一份 */
  G._docSaving=true;
  storyWinSave('saving');/* Story视窗：SAVING…演出 */
  /* FIX: 入口处快照全部所需状态——之后无论玩家多快退出/开新局，存档内容都不受影响 */
  const cfg=G._aiCfg;
  const round=G.aiGameRound;
  const hist=(G.aiGameHistory||[]).slice();
  const genre=G._aiGenre||'fantasy';
  const horror=G._aiHorror||'no';
  const aiName=(cfg&&cfg.nickname)||'AI';
  /* 原始记录（可读版）：用于保险落地与生成失败兜底 */
  let rawContent='';
  hist.forEach(m=>{
    try{
      if(m.role==='assistant'){
        const d=extractJSON(m.content);
        rawContent+=d.story+'\n\n';
        if(d.choices)rawContent+='选项: '+d.choices.join(' / ')+'\n\n';
      }else{rawContent+='▸ '+m.content+'\n\n'}
    }catch(e){rawContent+=m.content+'\n\n'}
  });
  let postId=null;
  const createdAt=Date.now();
  try{
    if(typeof callApiChat==='undefined'||!cfg){
      /* Fallback: save raw history if no AI available */
      await ensureDiaryInit();
      await dbPut('posts',{id:'post_'+Date.now(),title:'Interactive Story - '+aiName,
        subtitle:'Round '+round,locked:true,category:'',content:'【互动故事记录】\n\n'+rawContent,
        created:createdAt,updated:createdAt});
      if(typeof toast==='function') toast('故事已保存到Blog');
      storyWinSave('ok');
      return 'raw';
    }

    /* FIX①: 先把原始记录"保险落地"再调用AI——即使生成期间关闭页面/断网/中转挂掉，
       这局故事也已经在密码日记本里了；生成成功后会用完整设定文档原地替换这篇日志。 */
    postId='post_'+Date.now();
    await ensureDiaryInit();
    await dbPut('posts',{id:postId,title:'📜 Story Design — '+aiName,
      subtitle:'设定文档生成中… · '+round+' Rounds',locked:true,category:'',
      content:'（AI正在为你生成完整设定文档，完成后本文档会被自动替换。如果本文档一直停留在这句话，说明生成已中断。以下是被我截断的原始记录。）\n\n'+rawContent,
      created:createdAt,updated:createdAt});

    if(typeof toast==='function') toast('正在生成完整设定文档...');

    const historyText = hist.map(m=>{
      if(m.role==='user') return '[Player] '+m.content;
      try{
        const d=extractJSON(m.content);
        return '[GM] '+d.story+(d.choices?' | Choices: '+d.choices.join(', '):'')+(d.isEnding?' [ENDING: '+d.endingType+']':'');
      }catch(e){return '[GM] '+m.content}
    }).join('\n');

    const docPrompt=`Based on the following interactive story session, generate a COMPLETE game design document in Chinese. Include ALL of the following sections:

## 游戏概要
Brief overview of the story world, theme, and core concept.

## 完整剧本
The full script/narrative of what happened, written as a readable story.

## 游戏机制
- Scoring system (what gives points, point values)
- Key decision points and their consequences

## 多结局设定
List ALL possible endings (not just the one reached), including:
- Normal endings (at least 3)
- Hidden/secret ending(s)
- How each ending is triggered (conditions)

## 隐藏要素
- Secret items, easter eggs, hidden dialogue triggers
- Special combinations that unlock hidden content

## 角色与世界观
Character descriptions, world lore, key locations

---
Session log:
${historyText}
---
Genre: ${genre}, Horror level: ${horror}
Write the document entirely in Chinese. Be creative and comprehensive — expand beyond what was explicitly shown in the session to create a full game design.`;

    /* FIX②: 文档生成是长输出，单独放宽超时到90秒（普通对话仍是30秒）；
       FIX③: 检测输出是否被 max_tokens 上限截断——无论是本地的4096还是中转端点自己的上限——
       被截断就让模型从断点续写并拼接，最多4段。这是"存进去的文档不完整"的根治。 */
    const baseMsgs=[
      {role:'system',content:'你是一个专业的游戏设计师，擅长将互动故事会话整理为完整的游戏设计文档。输出纯文本，不使用markdown代码块。'},
      {role:'user',content:docPrompt}
    ];
    let doc='',truncated=false;
    for(let seg=0;seg<4;seg++){
      const msgs=seg===0?baseMsgs:baseMsgs.concat([
        {role:'assistant',content:doc},
        {role:'user',content:'继续。直接从中断处接着输出剩余内容，不要重复已输出的部分，也不要加任何说明。'}
      ]);
      const r=await callApiChat(cfg,msgs,{maxTokens:8192,timeoutMs:90000,wantMeta:true});
      /* 兼容旧版 callApiChat（直接返回字符串）：当作单段完整输出处理 */
      const piece=(r&&typeof r==='object')?String(r.text||''):String(r||'');
      truncated=!!(r&&typeof r==='object'&&r.truncated);
      doc+=piece;
      if(!truncated||!piece.trim())break;
    }
    if(!doc.trim())throw new Error('AI返回了空文档');
    if(truncated)doc+='\n\n（注：文本内容过长，连续4段输出后依然超过上限字符数，已在此截断。）';

    await dbPut('posts',{id:postId,title:'📜 Story Design — '+aiName,
      subtitle:'Full Game Design Document · '+round+' Rounds',locked:true,category:'',
      content:doc.trim(),created:createdAt,updated:Date.now()});
    if(typeof toast==='function') toast('完整设定文档已保存到Blog');
    storyWinSave('ok');
    return 'doc';
  }catch(e){
    console.warn('[SuiGame] Design doc generation failed:',e);
    /* Fallback: 把"保险落地"那篇原地转正为原始记录（同一id覆盖，不会产生第二篇） */
    try{
      await ensureDiaryInit();
      await dbPut('posts',{id:postId||('post_'+Date.now()),title:'Interactive Story - '+aiName,
        subtitle:'Round '+round,locked:true,category:'',content:'【互动故事记录】\n\n'+rawContent,
        created:createdAt,updated:Date.now()});
      if(typeof toast==='function') toast('故事已保存到Blog（设定生成失败，已保存原始记录）');
      storyWinSave('ok');
      return 'raw';
    }catch(e2){
      if(typeof toast==='function') toast('存档失败：'+String((e2&&e2.message)||e2).slice(0,40));
      storyWinSave('fail');
      return 'fail';
    }
  }finally{
    G._docSaving=false;
  }
}

/* ── WARDROBE ────────────────────────────────────────── */
function interactWardrobe(){
  const lines = FIXED_LINES.wardrobe_intro;
  const text = Array.isArray(lines) ? lines[Math.floor(Math.random()*lines.length)] : lines;
  showDialogue('Sui',[text],()=>{
    closeDialogue();
    openWardrobe();
  });
}

function openWardrobe(){
  if(!G.viewport){G.state='idle';return}
  G.wardrobeOpen=true;
  const panel=G.viewport.querySelector('#game-wardrobe');
  if(!panel){G.state='idle';G.wardrobeOpen=false;return}
  panel.innerHTML=`<h4>Wardrobe</h4><div class="game-wardrobe-divider"><span></span></div><div class="game-wardrobe-grid">${OUTFITS.map((o,i)=>
    `<button class="game-wardrobe-item ${i===G.outfitIdx?'active':''}" data-idx="${i}"><span class="game-wardrobe-dot"></span>${o.label}</button>`
  ).join('')}</div><button class="game-wardrobe-close" id="wardrobe-close">Close</button>`;
  panel.classList.add('show');

  panel.querySelectorAll('[data-idx]').forEach(btn=>{
    btn.addEventListener('click',async ()=>{
      const idx=parseInt(btn.dataset.idx);
      if(idx===G.outfitIdx){closeWardrobe();G.state='idle';return}
      G.outfitIdx=idx;
      await loadOutfitAssets(idx);
      updateCharSprite();
      closeWardrobe();
      G.state='idle';
      saveState();
    });
  });
  panel.querySelector('#wardrobe-close').addEventListener('click',()=>{closeWardrobe();G.state='idle'});
}

function closeWardrobe(){
  G.wardrobeOpen=false;
  if(G.viewport){const el=G.viewport.querySelector('#game-wardrobe');if(el)el.classList.remove('show')}
}

/* ── DIALOGUE SYSTEM ─────────────────────────────────── */
/* ── 行感知分页（BUGFIX：结局公告等多行文本被裁切）──────────
   旧版分页只按字符数（DIALOGUE_MAX_CHARS=120）切页、完全忽略文本中的换行符 \n；
   而文本区是 height:32% + overflow:hidden 的固定3行区域，white-space:pre-line 会把 \n 渲染成真实换行，
   于是任何"字符数不超限但显式行数>3"的页面（如5行的结局公告）第4行起会被直接裁掉。
   新版按"可视行"分页：显式 \n 计为换行，超宽自动折行也按宽度估算计入行数。 */
function _dlgVisualLen(s){let w=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xD800&&c<=0xDBFF){w+=1;i++}else w+=c>0x2E7F?1:0.5}return w}
function _dlgCutIdx(s,units){let w=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xD800&&c<=0xDBFF){w+=1;i++}else w+=c>0x2E7F?1:0.5;if(w>=units)return i+1}return s.length}
function paginateDialogue(text){
  const pages=[];let cur=[];let curLines=0;
  const flush=()=>{if(cur.length){pages.push(cur.join('\n'));cur=[];curLines=0}};
  String(text==null?'':text).split('\n').forEach(line=>{
    let seg=line;
    /* 单个自然段就超过整页容量时，按标点硬切成独立页 */
    while(_dlgVisualLen(seg)>DIALOGUE_LINE_CHARS*DIALOGUE_MAX_LINES){
      let cutIdx=_dlgCutIdx(seg,DIALOGUE_LINE_CHARS*DIALOGUE_MAX_LINES);
      const p1=seg.lastIndexOf('。',cutIdx);const p2=seg.lastIndexOf('，',cutIdx);
      const best=Math.max(p1,p2);
      if(best>cutIdx*0.4)cutIdx=best+1;
      flush();pages.push(seg.slice(0,cutIdx));seg=seg.slice(cutIdx);
    }
    const need=Math.max(1,Math.ceil(_dlgVisualLen(seg)/DIALOGUE_LINE_CHARS));
    if(curLines+need>DIALOGUE_MAX_LINES)flush();
    cur.push(seg);curLines+=need;
  });
  flush();
  return pages.length?pages:[''];
}

function showDialogue(speaker, textArray, onComplete){
  if(!G.viewport){console.warn('[SuiGame] showDialogue: viewport not ready');return}
  G.dialogueActive=true;
  const dlg=G.viewport.querySelector('#game-dialogue');
  if(!dlg){console.warn('[SuiGame] showDialogue: dialogue element not found');G.dialogueActive=false;return}
  const nameEl=G.viewport.querySelector('#game-dlg-name');
  const textEl=G.viewport.querySelector('#game-dlg-text');
  const actionsEl=G.viewport.querySelector('#game-dlg-actions');
  const choicesEl=G.viewport.querySelector('#game-choices');
  const portraitEl=G.viewport.querySelector('#game-portrait');
  const portraitImg=G.viewport.querySelector('#game-portrait-img');
  const backBtn=G.viewport.querySelector('#game-dlg-back');
  const nextBtn=G.viewport.querySelector('#game-dlg-next-btn');

  dlg.classList.add('show');
  nameEl.textContent=speaker;
  actionsEl.classList.remove('show');
  actionsEl.innerHTML='';
  choicesEl.classList.remove('show');
  choicesEl.innerHTML='';
  textEl.style.display='block';/* FIX: 从选项界面进入新对话时恢复文本区（旧版会保持隐藏导致文字不可见） */

  /* Portrait: Sui uses the current outfit portrait; the Story AI narrator
     uses its custom DIY portrait (portrait_[nickname].png) when one exists. */
  portraitEl.classList.remove('sui');
  if(speaker==='Sui' && G.assets.portrait){
    portraitImg.src=G.assets.portrait.src;
    portraitEl.classList.add('sui');
    portraitEl.classList.add('show');
  }else if(G._aiPortraitImg && G._aiCfg && speaker===(G._aiCfg.nickname||G._aiCfg.model||'AI')){
    portraitImg.src=G._aiPortraitImg.src;
    portraitEl.classList.add('show');
  }else{
    portraitEl.classList.remove('show');
  }

  /* Story视窗：Sui弹“……”=AI思考中 → 头顶气泡打字机循环播放；其他任何对话出现即停 */
  if(G.aiGameActive&&speaker==='Sui'&&Array.isArray(textArray)&&textArray.length===1&&textArray[0]===FIXED_LINES.thinking){
    storyWinBubbleStart();
  }else{
    storyWinBubbleStop();
  }

  /* Paginate text — BUGFIX: 行感知分页，尊重 \n 与3行可视容量（旧版会裁掉第4行起的内容） */
  G.dialoguePages=[];
  textArray.forEach(t=>{paginateDialogue(t).forEach(p=>G.dialoguePages.push(p))});
  G.dialoguePageIdx=0;
  G.dialogueCb=onComplete;
  typewritePage();

  /* Wire persistent buttons */
  /* Story模式常驻Save：随时把当前剧情进度原样存入密码日记本（不调用API、不打断游戏） */
  const saveBtn=G.viewport.querySelector('#game-dlg-save');
  if(saveBtn){
    saveBtn.style.display=G.aiGameActive?'flex':'none';
    saveBtn.onclick=()=>{saveGameProgress()};
  }
  nextBtn.onclick=()=>advanceDialogue();
  backBtn.onclick=()=>{
    if(G.aiGameActive){
      if(G._storyExitWarning){
        /* Second Back press — actually exit */
        G._storyExitWarning=false;
        closeDialogue();endAiGame();
      }else{
        /* First Back press — show warning */
        G._storyExitWarning=true;
        showDialogue('Sui',['等等——游戏还在进行中，你确定要退出吗？退出后无法恢复的。\n再次按下Back即可退出，按NEXT即可重新回到原游戏页面。'],()=>{
          /* NEXT pressed — return to game */
          G._storyExitWarning=false;
          if(G._aiSending){
            showDialogue('Sui',[FIXED_LINES.thinking],null);
            return;
          }
          const s=G._lastStoryState;
          if(s&&s.data){
            showDialogue(s.name,[s.data.story],()=>{
              if(s.data.isEnding){
                showDialogue(s.name,[ENDING_ANNOUNCE],()=>{showEndingActions()});
              }else if(s.data.choices&&s.data.choices.length){
                showChoices(s.data.choices,(choice)=>{showDialogue('Sui',[FIXED_LINES.thinking],()=>{aiGameTurn(choice)})});
              }
            });
          }
        });
      }
    }else{
      closeDialogue();G.state='idle';
    }
  };
  /* Click on dialogue box fast-forwards typewriter */
  textEl.onclick=()=>fastForwardTypewriter();
  const boxEl=G.viewport.querySelector('.game-dialogue-box');
  boxEl.onclick=(e)=>{
    if(e.target.closest('.game-dialogue-action')||e.target.closest('.game-choice-btn')||e.target.closest('.game-dlg-btn')) return;
    fastForwardTypewriter();
  };
}

/* Fast-forward typewriter without advancing to next page */
function fastForwardTypewriter(){
  if(!G.viewport) return;
  if(G.typewriterTimer){
    clearInterval(G.typewriterTimer);
    G.typewriterTimer=null;
    const textEl=G.viewport.querySelector('#game-dlg-text');
    if(textEl) textEl.textContent=G.dialoguePages[G.dialoguePageIdx]||'';
  }
}

function typewritePage(){
  if(!G.viewport) return;
  const textEl=G.viewport.querySelector('#game-dlg-text');
  if(!textEl) return;
  const page=G.dialoguePages[G.dialoguePageIdx]||'';
  textEl.textContent='';
  G.typewriterIdx=0;
  clearInterval(G.typewriterTimer);
  G.typewriterTimer=setInterval(()=>{
    if(G.typewriterIdx<page.length){
      textEl.textContent+=page[G.typewriterIdx];
      G.typewriterIdx++;
    }else{
      clearInterval(G.typewriterTimer);
      G.typewriterTimer=null;
    }
  }, TYPE_SPEED);
}

function advanceDialogue(){
  if(!G.viewport) return;
  /* If still typing, finish instantly */
  if(G.typewriterTimer){
    clearInterval(G.typewriterTimer);
    G.typewriterTimer=null;
    const textEl=G.viewport.querySelector('#game-dlg-text');
    if(textEl) textEl.textContent=G.dialoguePages[G.dialoguePageIdx]||'';
    return;
  }
  /* Advance to next page */
  if(G.dialoguePageIdx<G.dialoguePages.length-1){
    G.dialoguePageIdx++;
    typewritePage();
  }else{
    /* Last page - call callback or close */
    if(G.dialogueCb){
      const cb=G.dialogueCb;
      G.dialogueCb=null;
      cb();
    }else{
      /* No callback - close dialogue (unless in AI game) */
      if(G.aiGameActive) return;
      closeDialogue();
      G.state='idle';
    }
  }
}

function showDialogueActions(actions){
  if(!G.viewport) return;
  const el=G.viewport.querySelector('#game-dlg-actions');
  if(!el) return;
  /* 操作按钮与常驻Save同处一行（top:70%），显示操作时先隐藏Save避免重叠 */
  const sv=G.viewport.querySelector('#game-dlg-save');
  if(sv)sv.style.display='none';
  el.innerHTML='';
  actions.forEach(a=>{
    const btn=document.createElement('button');
    btn.className='game-dialogue-action';
    btn.textContent=a.label;
    btn.addEventListener('click',()=>a.cb());
    el.appendChild(btn);
  });
  el.classList.add('show');
}

function showChoices(choices, onSelect){
  if(!G.viewport) return;
  const el=G.viewport.querySelector('#game-choices');
  const textEl=G.viewport.querySelector('#game-dlg-text');
  if(!el||!textEl) return;
  textEl.style.display='none';
  el.innerHTML='';
  choices.forEach(c=>{
    const btn=document.createElement('button');
    btn.className='game-choice-btn';
    btn.textContent=c;
    btn.addEventListener('click',()=>{
      el.classList.remove('show');
      textEl.style.display='block';
      onSelect(c);
    });
    el.appendChild(btn);
  });
  el.classList.add('show');
}

/* ── SUI DIALOGUE MODULE ─────────────────────────────── */
const SUI_QA = [
  /* Page 1 */
  [
    { q:'「这里是什么地方？」', a:[
      '这里是我们的家。',
      '——准确来说，是一座隔绝于世的湖畔别墅，我们在它的高层。',
      '这里是一个只属于你的个人空间，希望能让你在忙碌之余安静地放松一会儿。'
    ]},
    { q:'「你是谁？」', a:[
      '我是Sui，这个网站的设计者。',
      '住在这个房间里的主控角色也是我——按我自己的样子设计的。'
    ]},
    { q:'「你为什么设计这个房间？」', a:[
      '一开始想做一个类似于桌面宠物的板块，后来在制作这个网站的过程中不知不觉变成了现在这样。',
      '大概是因为我在设计的时候一直在想"我愿意在怎样的游戏空间里发呆很久"吧。',
      '然后就越做越认真了，加入了很多喜欢的设计。希望你也会喜欢它。'
    ]}
  ],
  /* Page 2 */
  [
    { q:'「你喜欢怎样的Tea组合？」', a:[
      '花茶+草莓蛋糕。',
      '但如果你问的是其他意思，咖啡+香草冰淇淋。'
    ]},
    { q:'「你现在在想什么？」', multi: true, options:[
      { a:[
        '在想下一件新衣服要买什么。',
        '因为我是个换装游戏爱好者，我玩每个游戏几乎都会花很多钱在时装和皮肤上。',
        'Room模块里的换装功能也是最早确定下来要做的。'
      ]},
      { a:[
        '在想外面是不是在下雨。',
        '我喜欢和雨相关的一切。潮湿的天气，脆弱的声音，雨后原野的草木气息。',
        '你呢？'
      ]},
      { a:[
        '在想你下次来的时候，我还认不认得出你。',
        '每次都像第一次见面。但我总觉得我们之间有些什么。',
        '……大概是错觉吧。'
      ]},
      { a:[
        '在想一个被遗忘的人。她是一位穿着水手服的少女。',
        '她在白霜降临的秋夜里，静坐在庭院断掉的石碑前，沐浴着月光。',
        '她在等待着……什么呢？'
      ]},
      { infernalOnly: true, pages:[
        ['在想一个故事。死去的士兵没有发觉自己已逝的事实，而一直不断的徘徊。',
         '直到看见连续不断掉在地上的血迹，他沿着血迹，最后终于找到了自己的尸体。',
         '明白自己已经死亡的他们在尸体前久久伫立，最终消失在秋日的暖阳之中。'],
        ['死去的士兵寻找着一滴滴连续的鲜血，他怀着虔诚，将其一滴滴捡了起来。',
         '但是这一滴滴连续的鲜血，究竟意味着什么呢？',
         '我想这只是意味着，他以惊人的速度，在不知不觉中死去吧。']
      ]}
    ]},
    { q:'「那个楼梯通向哪里？」', a:[
      '我不知道。',
      '有过一些想法，但后来因为一些原因就没有继续了。',
      '我现在觉得这样子也很好。'
    ]}
  ]
];

let suiActive = false;
let suiPageIdx = 0;

function interactSui(){
  suiActive = true;
  suiPageIdx = 0;
  if(!G.viewport){G.state='idle';return;}
  /* Lie down on bed with awake animation (blinking, frames 0-1) */
  G.viewport.querySelector('#game-char').style.display='none';
  G.viewport.querySelector('#game-char-lie').style.display='block';
  G.state='lying'; G.lieMode='awake'; G.lieFrame=0;
  updateLieSprite();
  /* Short pause before dialogue */
  setTimeout(()=>{
    /* Greeting line. Next (or「聊聊」) → original Q&A; 「引导」→ guided tour. */
    showDialogue('Sui',[FIXED_LINES.sui_open],()=>{
      removeSuiExtraOpts();
      showSuiPage(0);
    });
    /* ADD two extra options under the greeting, on the same page.
       Next stays visible and still advances to the Q&A. */
    addSuiExtraOpts();
    const nextBtn=G.viewport.querySelector('#game-dlg-next-btn');
    if(nextBtn) nextBtn.style.display='';
    const backBtn=G.viewport.querySelector('#game-dlg-back');
    if(backBtn) backBtn.onclick=()=>{ exitSui(); };
  },400);
}

/* One extra option shown on the greeting page, below the greeting line.
   It lives in its own overlay so the typewriter never wipes it, and the
   persistent Next button keeps working (advances to the original Q&A). */
function addSuiExtraOpts(){
  if(!G.viewport) return;
  const box=G.viewport.querySelector('.game-dialogue-box');
  if(!box) return;
  removeSuiExtraOpts();
  const wrap=document.createElement('div');
  wrap.className='sui-extra-opts';
  wrap.id='sui-extra-opts';
  wrap.innerHTML=
    '<button class="game-choice-btn sui-extra-opt" data-opt="tour">带我再走一次游戏引导吧。</button>';
  box.appendChild(wrap);
  const tourBtn=wrap.querySelector('[data-opt="tour"]');
  if(tourBtn) tourBtn.onclick=(e)=>{ e.stopPropagation(); removeSuiExtraOpts(); startHomeTour({fromSui:true}); };
}
function removeSuiExtraOpts(){
  if(!G.viewport) return;
  const ex=G.viewport.querySelector('#sui-extra-opts');
  if(ex) ex.remove();
}

function showSuiPage(pageIdx){
  suiPageIdx = pageIdx;
  removeSuiExtraOpts();
  const page = SUI_QA[pageIdx];
  const labels = page.map(item=>item.q);

  /* Clear text area, show choices */
  const textEl = G.viewport.querySelector('#game-dlg-text');
  if(textEl) textEl.textContent = '';

  /* Show/hide page nav buttons */
  updateSuiPageNav(pageIdx);

  /* Wire Back to exit Sui entirely */
  const backBtn = G.viewport.querySelector('#game-dlg-back');
  backBtn.onclick = ()=>{ exitSui(); };

  /* Hide Next during choice view */
  const nextBtn = G.viewport.querySelector('#game-dlg-next-btn');
  nextBtn.style.display = 'none';

  showChoices(labels, (selected)=>{
    const qa = page.find(item=>item.q===selected);
    if(!qa) return;
    /* Hide page nav during answer */
    hideSuiPageNav();
    if(qa.multi){
      /* Filter options: exclude infernalOnly when not in infernal mode */
      var isInf=document.body.classList.contains('theme-infernal');
      var available=qa.options.filter(function(o){return !o.infernalOnly||isInf});
      const pick = available[Math.floor(Math.random()*available.length)];
      if(pick.pages){
        /* Multi-page answer: show pages sequentially */
        var pidx=0;
        function showNextPage(){
          if(pidx>=pick.pages.length){showSuiPage(pageIdx);return}
          showSuiAnswer(pick.pages[pidx],function(){pidx++;showNextPage()});
        }
        showNextPage();
      }else{
        showSuiAnswer(pick.a, ()=>showSuiPage(pageIdx));
      }
    } else {
      showSuiAnswer(qa.a, ()=>showSuiPage(pageIdx));
    }
  });
}

function showSuiAnswer(lines, onDone){
  if(!G.viewport) return;
  const dlg = G.viewport.querySelector('#game-dialogue');
  const textEl = G.viewport.querySelector('#game-dlg-text');
  const choicesEl = G.viewport.querySelector('#game-choices');
  const nextBtn = G.viewport.querySelector('#game-dlg-next-btn');
  const backBtn = G.viewport.querySelector('#game-dlg-back');
  if(!textEl) return;

  /* Kill any previous typewriter immediately */
  if(G.typewriterTimer){clearInterval(G.typewriterTimer);G.typewriterTimer=null}
  /* Generation counter to prevent stale callbacks */
  G._twGen=(G._twGen||0)+1;
  var myGen=G._twGen;

  /* Hide choices, show text area */
  choicesEl.classList.remove('show');
  choicesEl.innerHTML = '';
  textEl.style.display = 'block';
  textEl.innerHTML = '';
  nextBtn.style.display = 'none';

  /* Wire Back to return to choices */
  backBtn.onclick = ()=>{
    clearInterval(G.typewriterTimer);
    G.typewriterTimer = null;
    onDone();
  };

  /* Type lines one by one with pauses */
  let lineIdx = 0;
  let charIdx = 0;
  const LINE_PAUSE = 600;

  function typeLine(){
    if(myGen!==G._twGen)return; /* stale — abort */
    if(lineIdx >= lines.length){
      /* All lines done — show Next to return to choices */
      nextBtn.style.display = '';
      nextBtn.onclick = ()=>{ onDone(); };
      return;
    }
    const line = lines[lineIdx];
    if(lineIdx > 0){
      textEl.appendChild(document.createElement('br'));
    }
    const span = document.createElement('span');
    textEl.appendChild(span);
    charIdx = 0;

    clearInterval(G.typewriterTimer);
    G.typewriterTimer = setInterval(()=>{
      if(myGen!==G._twGen){clearInterval(G.typewriterTimer);return} /* stale — abort */
      if(charIdx < line.length){
        span.textContent += line[charIdx];
        charIdx++;
      } else {
        clearInterval(G.typewriterTimer);
        G.typewriterTimer = null;
        lineIdx++;
        setTimeout(typeLine, LINE_PAUSE);
      }
    }, TYPE_SPEED);
  }

  /* Click to fast-forward all lines */
  const fastForwardSui = ()=>{
    clearInterval(G.typewriterTimer);
    G.typewriterTimer = null;
    textEl.innerHTML = lines.join('<br>');
    lineIdx = lines.length;
    nextBtn.style.display = '';
    nextBtn.onclick = ()=>{ onDone(); };
  };
  textEl.onclick = fastForwardSui;
  const boxEl = G.viewport.querySelector('.game-dialogue-box');
  const origBoxClick = boxEl.onclick;
  boxEl.onclick = (e)=>{
    if(e.target.closest('.game-dlg-btn')||e.target.closest('.game-choice-btn')) return;
    if(suiActive && lineIdx < lines.length){ fastForwardSui(); return; }
    if(origBoxClick) origBoxClick(e);
  };

  typeLine();
}

function updateSuiPageNav(pageIdx){
  if(!G.viewport) return;
  const persistent = G.viewport.querySelector('#game-dlg-persistent');
  hideSuiPageNav();
  if(pageIdx > 0){
    const prev = document.createElement('button');
    prev.className = 'game-dlg-btn sui-page-nav';
    prev.innerHTML = '<span class="tri-back">◂</span> Prev';
    prev.style.cssText = 'margin-left:8px';
    prev.onclick = ()=>showSuiPage(pageIdx-1);
    const backBtn = G.viewport.querySelector('#game-dlg-back');
    backBtn.after(prev);
  }
  if(pageIdx < SUI_QA.length - 1){
    const next = document.createElement('button');
    next.className = 'game-dlg-btn sui-page-nav';
    next.innerHTML = 'Next <span class="tri-next" style="animation:none">▸</span>';
    next.style.cssText = 'margin-right:8px';
    next.onclick = ()=>showSuiPage(pageIdx+1);
    const nextBtn = G.viewport.querySelector('#game-dlg-next-btn');
    persistent.insertBefore(next, nextBtn);
  }
}

function hideSuiPageNav(){
  if(!G.viewport) return;
  G.viewport.querySelectorAll('.sui-page-nav').forEach(el=>el.remove());
}

function exitSui(){
  suiActive = false;
  hideSuiPageNav();
  clearInterval(G.typewriterTimer);
  G.typewriterTimer = null;
  /* Restore Next button visibility */
  const nextBtn = G.viewport.querySelector('#game-dlg-next-btn');
  if(nextBtn) nextBtn.style.display = '';
  closeDialogue();
  /* Get up from bed */
  if(G.viewport){
    G.viewport.querySelector('#game-char-lie').style.display='none';
    G.viewport.querySelector('#game-char').style.display='block';
    G.charX=BED_STAND_X; G.charY=BED_STAND_Y;
    updateCharPosition(); updateIdleSprite();
  }
  G.state = 'idle';
}

function closeDialogue(){
  G.dialogueActive=false;
  clearInterval(G.typewriterTimer);
  G.typewriterTimer=null;
  if(!G.viewport) return;
  const dlg=G.viewport.querySelector('#game-dialogue');
  if(dlg) dlg.classList.remove('show');
  const portrait=G.viewport.querySelector('#game-portrait');
  if(portrait) portrait.classList.remove('show');
  const actions=G.viewport.querySelector('#game-dlg-actions');
  if(actions){actions.classList.remove('show');actions.innerHTML=''}
  const choices=G.viewport.querySelector('#game-choices');
  if(choices){choices.classList.remove('show');choices.innerHTML=''}
  const ex=G.viewport.querySelector('#sui-extra-opts');
  if(ex) ex.remove();
  const text=G.viewport.querySelector('#game-dlg-text');
  if(text) text.style.display='block';
}

function showBubble(x,y,text){
  if(!G.viewport) return;
  const el=document.createElement('div');
  el.className='game-bubble';
  el.textContent=text;
  el.style.left=(x-20)+'px';el.style.top=(y-30)+'px';
  G.viewport.appendChild(el);
  setTimeout(()=>el.remove(),2200);
}

/* ── GUIDED HOME TOUR ENGINE ─────────────────────────── */
let tourIdx = 0;

/* Dialogue used by the tour: single-click advance, Back skips the tour. */
function showTourDialogue(pages, onDone){
  if(!G.viewport) return;
  showDialogue('Sui', pages, onDone);
  const backBtn=G.viewport.querySelector('#game-dlg-back');
  if(backBtn) backBtn.onclick=()=>{ endHomeTour(); };
}

function startHomeTour(opts){
  opts=opts||{};
  if(!G.viewport){ G.pendingTour=true; return; }
  G.tourActive=true;
  /* Tear down any Sui / dialogue state cleanly */
  if(typeof suiActive!=='undefined' && suiActive){ suiActive=false; }
  hideSuiPageNav();
  closeDialogue();
  if(G.typewriterTimer){clearInterval(G.typewriterTimer);G.typewriterTimer=null;}
  if(G._interactTimeout){clearTimeout(G._interactTimeout);G._interactTimeout=null;}
  G.path=null; G.onArrive=null; G.pendingInteraction=null; G.targetX=null; G.targetY=null;
  const nextBtn=G.viewport.querySelector('#game-dlg-next-btn');
  if(nextBtn) nextBtn.style.display='';
  disableSidebarButtons(true);
  showZzz(false);

  /* Stand up at the bed, face the camera, then speak the intro */
  const stand=()=>{
    if(!G.viewport) return;
    G.viewport.querySelector('#game-char-lie').style.display='none';
    G.viewport.querySelector('#game-char').style.display='block';
    G.charX=BED_STAND_X; G.charY=BED_STAND_Y;
    G.state='interacting'; G.facing='down'; G.isFirstOpen=false;
    updateCharPosition(); updateIdleSprite();
    tourIdx=0;
    showTourDialogue(getTourIntro(), ()=>{ tourNextStation(); });
  };

  const wasLying = (G.state==='lying'||G.state==='sleeping'||G.state==='waking');
  if(wasLying){
    /* Open eyes, then get up */
    G.lieMode='awake'; G.lieFrame=0;
    updateLieSprite();
    G.state='waking';
    setTimeout(stand, 700);
  }else{
    stand();
  }
}

function tourNextStation(){
  closeDialogue();
  if(!G.tourActive) return;
  if(tourIdx>=TOUR_STEPS.length){ endHomeTour(); return; }
  const step=TOUR_STEPS[tourIdx];
  const it=INTERACTIONS.find(i=>i.id===step.id);
  if(!it){ tourIdx++; tourNextStation(); return; }
  const wx = step.id==='bed' ? BED_SLEEP_WALK_X : it.x;
  const wy = step.id==='bed' ? BED_SLEEP_WALK_Y : it.y;
  startWalkTo(wx, wy, {
    timeout: 9000,
    onArrive: ()=>{
      if(!G.tourActive) return;
      G.state='interacting';
      G.facing=step.face||it.face;
      updateCharPosition(); updateIdleSprite();
      showTourDialogue(step.pages, ()=>{ tourIdx++; tourNextStation(); });
    }
  });
}

function endHomeTour(){
  G.tourActive=false;
  closeDialogue();
  if(G.typewriterTimer){clearInterval(G.typewriterTimer);G.typewriterTimer=null;}
  if(G._interactTimeout){clearTimeout(G._interactTimeout);G._interactTimeout=null;}
  if(G.viewport){
    G.viewport.querySelector('#game-char-lie').style.display='none';
    G.viewport.querySelector('#game-char').style.display='block';
    const nextBtn=G.viewport.querySelector('#game-dlg-next-btn');
    if(nextBtn) nextBtn.style.display='';
  }
  G.state='idle';
  G.targetX=null; G.targetY=null; G.path=null;
  G.pendingInteraction=null; G.onArrive=null;
  disableSidebarButtons(false);
  updateCharPosition(); updateIdleSprite();
  saveState();
}

/* Expose for the welcome-page "家园引导" button and Sui's menu */
window.startHomeTour = startHomeTour;

/* ── RENDER LOOP ─────────────────────────────────────── */
function gameLoop(time){
  if(!G.running){return}
  const dt=time-G.lastTime;
  G.lastTime=time;

  switch(G.state){
    case 'sleeping':
    case 'waking':
    case 'lying':
      updateLie(dt);
      break;
    case 'walking':
      updateWalk(dt);
      break;
    case 'idle':
    case 'interacting':
      updateIdle(dt);
      break;
  }

  updateMarkers();
  G.animFrame=requestAnimationFrame(gameLoop);
}

function updateWalk(dt){
  if(G.targetX===null){G.state='idle';return}
  /* Follow the waypoint path (last element ≈ final target) */
  const dest = (G.path&&G.path.length) ? G.path[0] : {x:G.targetX,y:G.targetY};
  const dx=dest.x-G.charX, dy=dest.y-G.charY;
  const dist=Math.hypot(dx,dy);
  if(dist<4){
    if(G.path&&G.path.length>1){
      G.path.shift(); /* reached a waypoint, advance to next */
    }else{
      /* Reached final target */
      G.charX=G.targetX; G.charY=G.targetY;
      G.targetX=null; G.targetY=null; G.path=null;
      G.state='idle'; G.walkFrame=0;
      handleArrival();
      updateCharPosition(); updateCharSprite();
      return;
    }
  }
  const speed=CHAR_SPEED;
  const vx=(dx/dist)*speed, vy=(dy/dist)*speed;
  const nx=G.charX+vx, ny=G.charY+vy;
  if(isWalkable(nx,ny)){
    G.charX=nx; G.charY=ny;
  }else{
    /* Slide along the obstacle edge */
    if(isWalkable(G.charX+vx,G.charY)) G.charX+=vx;
    else if(isWalkable(G.charX,G.charY+vy)) G.charY+=vy;
    else{
      /* Truly stuck: drop this waypoint, or finish if it was the last */
      if(G.path&&G.path.length>1){
        G.path.shift();
      }else{
        G.state='idle'; G.targetX=null; G.targetY=null; G.path=null;
        handleArrival();
        return;
      }
    }
  }
  /* Update facing */
  if(Math.abs(dx)>Math.abs(dy)) G.facing=dx>0?'right':'left';
  else G.facing=dy>0?'down':'up';
  /* Animate walk - RPG Maker style: stand→step1→stand→step2 */
  G.walkTimer+=dt;
  if(G.walkTimer>1000/WALK_FPS){
    G.walkTimer=0;
    G.walkFrame=(G.walkFrame+1)%4;
  }
  updateCharPosition();
  updateCharSprite();
}

function updateIdle(dt){
  G.idleTimer+=dt;
  if(G.idleTimer>IDLE_INTERVAL){
    G.idleTimer=0;
    /* Blink animation: frame 0→1→2→1→0 */
    G.idleFrame=1;
    updateIdleSprite();
    setTimeout(()=>{G.idleFrame=2;updateIdleSprite()},120);
    setTimeout(()=>{G.idleFrame=1;updateIdleSprite()},240);
    setTimeout(()=>{G.idleFrame=0;updateIdleSprite()},360);
  }
  updateCharPosition();
  updateIdleSprite();
}

function updateLie(dt){
  G.lieTimer+=dt;
  const interval = G.lieMode==='sleeping'?800:1200;
  if(G.lieTimer>interval){
    G.lieTimer=0;
    if(G.lieMode==='awake'){
      G.lieFrame=G.lieFrame===0?1:0; // frames 0-1
    }else{
      G.lieFrame=G.lieFrame===1?2:1; // frames 1-2
    }
    updateLieSprite();
  }
}

/* ── SPRITE RENDERING ────────────────────────────────── */
function updateCharPosition(){
  if(!G.viewport) return;
  const el=G.viewport.querySelector('#game-char');
  if(!el) return;
  el.style.left=(G.charX-SPRITE_SIZE/2)+'px';
  el.style.top=(G.charY-SPRITE_SIZE+20)+'px'; // feet at bottom, offset up
  /* 水晶球地面光晕投在角色身上：按与光心距离调强度；仅在量化值变化时写样式，几乎零开销 */
  const lc=el.querySelector('.game-char-lightcast');
  if(lc){
    const d=Math.hypot(G.charX-CRYSTAL_FLOOR_LIGHT.x,G.charY-CRYSTAL_FLOOR_LIGHT.y);
    const o=Math.round(Math.max(0,Math.min(1,1-d/CRYSTAL_FLOOR_LIGHT.r))*20)/20;
    if(lc._o!==o){lc._o=o;lc.style.opacity=o;el.classList.toggle('in-crystal-light',o>0.05)}
  }
}

function updateCharSprite(){
  if(!G.viewport) return;
  const img=G.viewport.querySelector('#game-char-img');
  if(!img||!G.assets.walk) return;
  img.src=G.assets.walk.src;
  const row = {down:0,left:1,right:2,up:3}[G.facing]||0;
  /* Walk cycle: stand(1)→step1(0)→stand(1)→step2(2) */
  const walkCycle=[1,0,1,2];
  const col = G.state==='walking'?walkCycle[G.walkFrame%4]:1;
  img.style.left=(-col*SPRITE_SIZE)+'px';
  img.style.top=(-row*SPRITE_SIZE)+'px';
  img.style.width='441px';img.style.height='588px';
  const charEl=G.viewport.querySelector('#game-char');
  if(charEl) charEl.style.display='block';
  const lieEl=G.viewport.querySelector('#game-char-lie');
  if(lieEl) lieEl.style.display='none';
}

function updateIdleSprite(){
  if(!G.viewport) return;
  if(G.teaAnimActive) return; /* Don't override tea sitting animation */
  const img=G.viewport.querySelector('#game-char-img');
  if(!img||!G.assets.idle) return;
  img.src=G.assets.idle.src;
  img.style.left=(-G.idleFrame*SPRITE_SIZE)+'px';
  img.style.top='0px';
  img.style.width='441px';img.style.height='147px';
}

function updateLieSprite(){
  if(!G.viewport) return;
  const el=G.viewport.querySelector('#game-char-lie');
  const img=G.viewport.querySelector('#game-char-lie-img');
  if(!el||!img||!G.assets.lie) return;
  el.style.display='block';
  const charEl=G.viewport.querySelector('#game-char');
  if(charEl) charEl.style.display='none';
  img.src=G.assets.lie.src;
  /* 3 frames in 614px wide sheet, each ~205px */
  const fw=Math.floor(614/3);
  img.style.width='614px';img.style.height='151px';
  img.style.position='absolute';
  img.style.left=(-G.lieFrame*fw)+'px';
  img.style.top='0px';
  /* Position on bed */
  el.style.left=BED_LIE_X+'px';el.style.top=BED_LIE_Y+'px';
  el.style.width=fw+'px';el.style.height='151px';
  el.style.overflow='hidden';
  el.style.position='absolute';
}

/* ── THEME OBSERVER ──────────────────────────────────── */
function setupThemeObserver(){
  const obs=new MutationObserver(()=>{
    if(!G.viewport)return;
    const isNight=document.body.classList.contains('theme-infernal');
    G.viewport.querySelector('.game-bg-day').style.opacity=isNight?'0':'1';
    G.viewport.querySelector('.game-bg-night').style.opacity=isNight?'1':'0';
  });
  obs.observe(document.body,{attributes:true,attributeFilter:['class']});
}

/* ── SAVE / LOAD ─────────────────────────────────────── */
async function saveState(){
  try{
    const data={outfitIdx:G.outfitIdx,charX:G.charX,charY:G.charY,
      facing:G.facing,state:G.state,lieMode:G.lieMode,isFirstOpen:G.isFirstOpen};
    localStorage.setItem('suiGameState',JSON.stringify(data));
  }catch(e){console.warn('Game save failed:',e)}
}

async function loadState(){
  try{
    const raw=localStorage.getItem('suiGameState');
    if(raw){
      const s=JSON.parse(raw);
      /* BUGFIX (wardrobe): the outfit is intentionally NOT restored from the
         save. loadAssets() runs before loadState() and loads sprites for the
         default outfit (Casual), so restoring a different saved index here left
         the wardrobe showing a stale selection (e.g. a previously tried-on
         Wedding) while the character still wore Casual. Every page load now
         starts in the default outfit, matching the fresh-open design below. */
      G.charX=s.charX||BED_STAND_X;
      G.charY=s.charY||BED_STAND_Y;
      G.facing=s.facing||'down';
      G.isFirstOpen=true; /* Always treat as first open per page load — Sui auto-wakes */
      if(s.state==='sleeping'||s.state==='lying'){
        G.state=s.state;
        G.lieMode=s.lieMode||'awake';
      }else{
        G.state='idle';
      }
    }
  }catch(e){console.warn('Game load failed:',e)}
}

/* Game state stored in localStorage — no DB upgrade needed */

/* ── PANEL OPEN / CLOSE ──────────────────────────────── */
async function openGamePanel(){
  G.mode='float';
  const panel=document.getElementById('game-panel');
  const container=document.getElementById('game-panel-viewport-container');
  /* Show panel immediately with loading text */
  panel.style.left='50%';
  panel.style.top='50%';
  panel.style.transform='translate(-50%,-50%)';
  panel.style.width='320px';panel.style.height='200px';
  panel.classList.add('show');
  document.getElementById('game-mini').style.display='none';

  if(!G.initialized){
    container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:160px;color:var(--silver);font-family:Cormorant Garamond,serif;font-style:italic;font-size:0.95rem;letter-spacing:0.05em">Loading...</div>';
    try{
      await initGame(container);
    }catch(e){
      console.error('[SuiGame] Init failed:',e);
      container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:160px;color:#e88;font-size:0.85rem;padding:20px;text-align:center">加载失败，请按F12查看控制台<br>'+e.message+'</div>';
      return;
    }
  }else if(G.viewport && G.viewport.parentElement!==container){
    container.appendChild(G.viewport);
  }
  updateScale();
  /* Re-center after resize */
  panel.style.left='50%';
  panel.style.top='50%';
  panel.style.transform='translate(-50%,-50%)';
  if(!G.running) startLoop();
}

function closeGamePanel(){
  document.getElementById('game-panel').classList.remove('show');
  document.getElementById('game-mini').style.display='block';
  saveState();
  pauseGame();
}

function pauseGame(){
  G.running=false;
  if(G.animFrame){cancelAnimationFrame(G.animFrame);G.animFrame=null}
}

async function openGamePage(){
  G.mode='page';
  const container=document.getElementById('game-fullpage-container');
  if(!G.initialized){
    container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:300px;color:var(--silver);font-family:Cormorant Garamond,serif;font-style:italic;font-size:1rem;letter-spacing:0.05em">Loading...</div>';
    try{
      await initGame(container);
    }catch(e){
      console.error('[SuiGame] Init failed:',e);
      container.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#e88;font-size:0.85rem;padding:20px;text-align:center">加载失败，请按F12查看控制台<br>'+e.message+'</div>';
      return;
    }
  }else if(G.viewport && G.viewport.parentElement!==container){
    container.appendChild(G.viewport);
  }
  updateScale();
  requestAnimationFrame(()=>{if(G.viewport&&G.mode==='page')updateScale()});
  if(!G.running) startLoop();
  /* If the room was already initialized, initGame won't run — start the tour here */
  if(G.pendingTour && G.initialized){
    G.pendingTour=false;
    setTimeout(()=>startHomeTour({fromWelcome:true}), 300);
  }
}

function startLoop(){
  G.running=true;
  G.lastTime=performance.now();
  G.animFrame=requestAnimationFrame(gameLoop);
}

/* ── INITIALIZATION ──────────────────────────────────── */
async function initGame(container){
  G.container=container;
  await loadAssets();
  await loadState();
  createViewport(container);
  updateScale();

  /* Set initial state */
  if(G.pendingTour){
    /* Entered via "家园引导": show Sui asleep briefly, then she wakes into the tour */
    G.pendingTour=false; /* consume now so the openGamePage fallback can't re-fire */
    G.state='sleeping'; G.lieMode='sleeping'; G.lieFrame=1;
    updateLieSprite();
    showZzz(true);
    G.viewport.querySelector('#game-char').style.display='none';
    G.viewport.querySelector('#game-char-lie').style.display='block';
    toggleSidebar(true);
    setTimeout(()=>{
      startHomeTour({fromWelcome:true});
    }, 1400);
  }else if(G.isFirstOpen || G.state==='sleeping'){
    G.state='sleeping';
    G.lieMode='sleeping';
    G.lieFrame=1; /* sleeping starts at frame 1 (0-indexed) for frames 2-3 cycle */
    updateLieSprite();
    showZzz(true);
    G.viewport.querySelector('#game-char').style.display='none';
    G.viewport.querySelector('#game-char-lie').style.display='block';
    toggleSidebar(true);
    /* Auto-wake: Sui gets up by herself after a brief pause */
    setTimeout(()=>{
      if(G.state!=='sleeping') return; /* Already woken by click */
      showZzz(false);
      /* Brief awake-in-bed animation before standing */
      G.lieMode='awake'; G.lieFrame=0;
      updateLieSprite();
      setTimeout(()=>{
        if(!G.viewport) return;
        G.viewport.querySelector('#game-char-lie').style.display='none';
        G.viewport.querySelector('#game-char').style.display='block';
        G.charX=BED_STAND_X; G.charY=BED_STAND_Y;
        G.state='idle'; G.facing='down'; G.isFirstOpen=false;
        updateCharPosition(); updateIdleSprite();
        toggleSidebar(true);
        saveState();
      }, 800);
    }, 1500);
  }else if(G.state==='lying'){
    updateLieSprite();
    G.viewport.querySelector('#game-char').style.display='none';
    G.viewport.querySelector('#game-char-lie').style.display='block';
    showZzz(true);
    toggleSidebar(true);
  }else{
    G.state='idle';
    updateCharPosition();
    updateCharSprite();
    updateIdleSprite();
    toggleSidebar(true);
  }

  /* Fade in */
  const fade=G.viewport.querySelector('#game-fade');
  setTimeout(()=>fade.classList.add('hidden'),300);

  G.initialized=true;
  setupThemeObserver();
}

/* ── DRAGGABLE PANEL ─────────────────────────────────── */
function setupDrag(){
  const panel=document.getElementById('game-panel');
  const handle=document.getElementById('game-panel-header');
  let dragging=false,startX,startY,startLeft,startTop;
  handle.addEventListener('mousedown',e=>{
    if(e.target.closest('.game-panel-close'))return;
    dragging=true;
    const rect=panel.getBoundingClientRect();
    startX=e.clientX;startY=e.clientY;startLeft=rect.left;startTop=rect.top;
    panel.style.transform='none';
    panel.style.left=startLeft+'px';panel.style.top=startTop+'px';
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    panel.style.left=(startLeft+e.clientX-startX)+'px';
    panel.style.top=(startTop+e.clientY-startY)+'px';
  });
  document.addEventListener('mouseup',()=>{dragging=false});
  /* Touch support for mobile */
  handle.addEventListener('touchstart',e=>{
    if(e.target.closest('.game-panel-close'))return;
    dragging=true;
    const t=e.touches[0];
    const rect=panel.getBoundingClientRect();
    startX=t.clientX;startY=t.clientY;startLeft=rect.left;startTop=rect.top;
    panel.style.transform='none';
    panel.style.left=startLeft+'px';panel.style.top=startTop+'px';
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!dragging)return;
    const t=e.touches[0];
    panel.style.left=(startLeft+t.clientX-startX)+'px';
    panel.style.top=(startTop+t.clientY-startY)+'px';
  },{passive:true});
  document.addEventListener('touchend',()=>{dragging=false});
  document.getElementById('game-panel-close').addEventListener('click',closeGamePanel);
  /* Zoom controls */
  document.getElementById('game-zoom-in').addEventListener('click',()=>{
    G.userScale=Math.min((G.userScale||1)+0.1, 1.2);updateScale()});
  document.getElementById('game-zoom-out').addEventListener('click',()=>{
    G.userScale=Math.max((G.userScale||1)-0.1, 0.35);updateScale()});
}

/* ── HOOK INTO EXISTING NAV ──────────────────────────── */
function hookNavigation(){
  const origNavTo=window.navTo;
  window.navTo=function(page){
    if(page==='game'){
      document.getElementById('game-mini').style.display='none';
      /* Close floating panel if open */
      document.getElementById('game-panel').classList.remove('show');
      /* Refresh API configs from storage so the Tea / Story / Tarot modules
         always see the latest configured APIs — even if the user added an API
         and came straight here without ever opening the API Settings page. */
      if(typeof loadApiConfigs==='function'){ try{ loadApiConfigs(); }catch(e){} }
      /* Use original navTo to handle page display (it will find #page-game) */
      origNavTo(page);
      /* Then initialize game in the full page container */
      openGamePage();
    }else{
      if(G.running){saveState();pauseGame()}
      document.getElementById('game-mini').style.display='block';
      origNavTo(page);
    }
  };
}

/* ── RESIZE HANDLER ──────────────────────────────────── */
function setupResize(){
  window.addEventListener('resize',()=>{if(G.initialized)updateScale()});
}

/* ── SIDEBAR TOGGLE ───────────────────────────────────── */
function toggleSidebar(show){
  /* Sidebar is always visible — never hidden */
  document.querySelectorAll('.game-sidebar').forEach(el=>{
    el.classList.remove('hidden');
  });
  if(G.initialized) updateScale();
}
function disableSidebarButtons(disable){
  document.querySelectorAll('.game-sidebar-btn').forEach(btn=>{
    if(disable){
      btn.classList.add('disabled');
    }else{
      btn.classList.remove('disabled');
    }
  });
  /* Hide the interaction markers while controls are disabled
     (visibility is also continuously governed by updateMarkers) */
  document.querySelectorAll('.ix-marker').forEach(m=>{
    m.style.display = disable ? 'none' : '';
  });
}
function setupSidebar(){
  document.querySelectorAll('.game-sidebar-btn, .game-sidebar-btn-reset').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      onInteract(btn.dataset.action);
    });
  });
}

/* ── BOOTSTRAP ───────────────────────────────────────── */
function bootstrap(){
  injectCSS();
  injectHTML();
  setupDrag();
  setupSidebar();
  hookNavigation();
  setupResize();

  /* Show mini icon after site enters */
  const checkSplash=setInterval(()=>{
    const splash=document.getElementById('splash');
    if(splash && splash.classList.contains('hidden')){
      clearInterval(checkSplash);
      setTimeout(()=>{
        document.getElementById('game-mini').classList.add('visible');
      },5200);
    }
  },500);
}

/* Make G accessible for debugging and AI setup panel */
window.G=G;

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bootstrap);
}else{
  bootstrap();
}



/* ══════════════════════════════════════════════════════════
   TEA MODULE — Selection Panel, Animation, Chat System
   ══════════════════════════════════════════════════════════ */

/* ── TEA CONFIGURATION ─────────────────────────────────── */
/* Auto-initialize password diary with default password if not set up */
async function ensureDiaryInit(){
  try{
    if(typeof getLockedDiaryConfig!=='function') return;
    const cfg=await getLockedDiaryConfig();
    if(cfg) return; /* already set up */
    /* No config exists — force user to set password + mandatory security question */
    if(typeof simpleHash!=='function'||typeof saveLockedDiaryConfig!=='function') return;
    return new Promise((resolve)=>{
      const modal=document.createElement('div');
      modal.className='modal-overlay show';modal.id='game-diary-setup-modal';
      modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999';
      modal.innerHTML='<div style="background:rgba(25,38,65,0.95);border:1px solid rgba(175,195,228,0.15);border-radius:16px;padding:28px;max-width:380px;width:90%;color:#c8d8ec;font-family:\'Noto Sans SC\',sans-serif"><h3 style="margin:0 0 12px;font-family:\'Cormorant Garamond\',serif;font-weight:300;font-size:1.2rem">密码日记本</h3><p style="font-size:0.82rem;line-height:1.7;margin-bottom:16px;opacity:0.85">首次保存记录，请先设置密码日记本。密保问题必须填写，用于找回密码。</p><input type="password" id="gd-pwd" placeholder="设置6位数字密码" maxlength="6" value="260323" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(175,195,228,0.15);background:rgba(175,195,228,0.06);color:#c8d8ec;font-size:0.88rem;margin-bottom:10px;box-sizing:border-box"><input type="text" id="gd-sq" placeholder="密保问题（必填，如：我的生日是？）" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(175,195,228,0.15);background:rgba(175,195,228,0.06);color:#c8d8ec;font-size:0.88rem;margin-bottom:10px;box-sizing:border-box"><input type="text" id="gd-sa" placeholder="密保答案（必填）" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(175,195,228,0.15);background:rgba(175,195,228,0.06);color:#c8d8ec;font-size:0.88rem;margin-bottom:14px;box-sizing:border-box"><p style="font-size:0.72rem;line-height:1.6;margin-bottom:14px;opacity:0.6">默认密码为 260323。忘记密码可通过密保重置。</p><div style="display:flex;justify-content:flex-end"><button id="gd-confirm" style="padding:8px 20px;border-radius:10px;border:none;background:rgba(114,168,216,0.25);color:#c8d8ec;cursor:pointer;font-size:0.85rem">确认</button></div></div>';
      document.body.appendChild(modal);
      modal.querySelector('#gd-confirm').addEventListener('click',async()=>{
        const pwd=document.getElementById('gd-pwd')?.value||'';
        const sq=document.getElementById('gd-sq')?.value?.trim()||'';
        const sa=document.getElementById('gd-sa')?.value?.trim()||'';
        if(!/^\d{6}$/.test(pwd)){if(typeof toast==='function')toast('密码必须为6位数字');return}
        if(!sq||!sa){if(typeof toast==='function')toast('密保问题和答案必须填写');return}
        const h=await simpleHash(pwd);
        await saveLockedDiaryConfig({pwdHash:h,secQ:sq,secAHash:await simpleHash(sa.toLowerCase())});
        modal.remove();
        if(typeof toast==='function')toast('密码日记本已设置');
        resolve();
      });
    });
  }catch(e){}
}

const TEA_DRINKS = [
  {id:'black',  cn:'红茶',  en:'Black Tea',  key:'稳定·平静·和谐',  desc:'对方状态平稳。正常节奏聊天，像老朋友喝茶那样就好。', motto:'热的东西递给你就好了，不用对我说谢谢。', rx:194,ry:178,rw:46,rh:34},
  {id:'green',  cn:'绿茶',  en:'Green Tea',  key:'安静·内敛·陪伴',  desc:'对方现在安静、内收，想要不被打扰的陪伴。不要主动追问，轻声陪着就好。但如果对方持续沉默，偶尔让对方知道你在。', motto:'你坐远一点也没关系，只要能看见你，被泡多久都可以。', rx:173,ry:102,rw:31,rh:55},
  {id:'floral', cn:'花茶',  en:'Floral Tea',  key:'温柔·浪漫·细心', desc:'对方现在很柔软，防备放下了。说话轻一些，不要太直接。对方放下防备是因为信任，不要辜负。', motto:'花瓣掉进杯子里，不会有谁捞出来。', rx:144,ry:177,rw:42,rh:31},
  {id:'coffee', cn:'咖啡',  en:'Coffee',      key:'清醒·认真·真诚', desc:'对方思维清醒，想要真实的对话。可以坦诚、直接，不用包装。但真诚和尊重不矛盾。', motto:'清醒的好处是能把一切看清。坏处也是。', rx:253,ry:175,rw:41,rh:35},
  {id:'milk',   cn:'奶茶',  en:'Milk Tea',    key:'放松·活泼·宠溺',  desc:'对方想放松、想被宠溺、想要一个允许撒娇的氛围。可以开玩笑、说废话、互相逗。不用正经，不用有意义。对方说了幼稚的话不要纠正——在你面前不装大人，是对方能给出的信任。', motto:'幼稚的话要趁现在说，明天我又要装大人了。', rx:231,ry:114,rw:27,rh:43}
];
const TEA_DESSERTS = [
  {id:'strawberry', cn:'草莓蛋糕',    en:'Strawberry Cake',   key:'快乐·幸福·甜蜜',   desc:'对方想要轻盈和快乐。聊有趣的事，适度调皮。但有些人说"想开心"是因为太久不开心了——如果笑里带着疲惫，不要假装没看到。', motto:'被一颗草莓哄好的一天，也算数的吧？', rx:204,ry:306,rw:31,rh:37},
  {id:'vanilla',    cn:'香草冰淇淋',  en:'Vanilla Ice Cream', key:'灵感·放空·跳跃', desc:'对方想要自由和放空。脑子想飞到哪就飞到哪，天马行空都可以。不用让对话有意义，跟着对方的灵感走。', motto:'融化了也没人心疼。但有你在的话，我想和你一起把世界上所有的海都变成香草味。', rx:254,ry:311,rw:31,rh:32},
  {id:'blueberry',  cn:'蓝莓慕斯',    en:'Blueberry Mousse',  key:'被接住·陪伴·关怀',   desc:'对方想要被接住。不要急着分析、建议或安慰。让对方感到你说什么都接得住，不说也行。如果对方说了重话然后突然退开或转话题，不要追问——但也不要退远。', motto:'我说没事的时候，你能不能不要真的信。', rx:156,ry:313,rw:30,rh:30},
  {id:'matcha',     cn:'抹茶布丁',    en:'Matcha Pudding',    key:'深度对话·内涵·理解',   desc:'对方想要深度的对话，聊感受、困惑、平时说不出口的事。认真回应，不要敷衍。深度不等于沉重，可以深入同时保持温暖。对方问了很大的问题，不用给完美答案，陪着一起想就好。', motto:'当舌尖尝到苦涩时的你没有皱眉，我就知道可以把剩下的话说完了。', rx:106,ry:306,rw:35,rh:38},
  {id:'tiramisu',   cn:'提拉米苏',    en:'Tiramisu',          key:'真实的连接·靠近·复杂的深度', desc:'对方想要真实的连接感。多回应对方具体说的内容，记住细节。但"想靠近"对有些人很难——如果对方靠近一步又退回去，不是拒绝，是靠近本身让对方害怕了。保持在原地，让对方按自己的速度来。', motto:'每一层都不一样。但最底下的那层从来没给别人看过。', rx:299,ry:313,rw:32,rh:31}
];
const TEA_COMBOS = {
  'black+strawberry':  '你笑起来的时候，这杯茶被偷偷加了好多糖。',
  'black+vanilla':     '红茶还端在手里，可我的心已经变成泡沫，陪你飞向天空。',
  'black+blueberry':   '一直端着的人也会烫到自己，但只要你帮我吹一下我就好了。',
  'black+matcha':      '你说的那些话外面包着糖纸。我把糖纸拆了吃下去，可里面好苦。',
  'black+tiramisu':    '我什么都不缺。就是你不在的时候，我总会多喝一杯。',
  'green+strawberry':  '我们在一个不算太晴朗的天气，一起坐在午后的窗台。',
  'green+vanilla':     '安静到能听见冰淇淋融化的声音。',
  'green+blueberry':   '如果我把说不出口的话泡在茶里，你喝下去会不会尝到。',
  'green+matcha':      '绿色心情。亲爱的，我想知道你在暗示我什么？',
  'green+tiramisu':    '你欲言又止，我假装没有注意到，但不想假装没听见。',
  'floral+strawberry': '花园里的秘密茶会。风把花瓣吹到蛋糕上，你说这算不算命运。',
  'floral+vanilla':    '亲爱的，今天我对你说的一切都将是不着边际的呓语。忘了吧。',
  'floral+blueberry':  '沉默与难过好像也可以是一件温柔的事。',
  'floral+matcha':     '脆弱与深度并存。咽回去的话在心里发了芽。',
  'floral+tiramisu':   '温柔的暧昧。我们靠的太近，却又不敢承认。',
  'coffee+strawberry': '你害怕我的甜美，所以需要用苦涩来中和吗？',
  'coffee+vanilla':    '一个很理性的人为了我做出一些不太理性的事。',
  'coffee+blueberry':  '没有谁能比我更了解我自己，你也不可以。',
  'coffee+matcha':     '两个清醒的人在夜里聊了天亮以后不会再提的事。',
  'coffee+tiramisu':   '咖啡能不能给我一点勇气，让我去做不计后果的决定。',
  'milk+strawberry':   '被宠坏的小孩。今天谁先讲道理谁就吃不到草莓。',
  'milk+vanilla':      '宝宝你好可爱，刚才我们说了什么？',
  'milk+blueberry':    '好想你。想某个回不去的夜晚，或者某个再也见不到的人。',
  'milk+matcha':       '用甜的方式说苦的事情。被保护着去面对不容易的东西。',
  'milk+tiramisu':     '最亲近的组合。声音很轻，距离很近，心跳很响。',
};

const TEA_SPRITE_FW = 200, TEA_SPRITE_FH = 224;
const TEA_SPRITE_COLS = 4;
const TEA_ANIM_FPS = 2;
const TEA_CHAIR_X = 248, TEA_CHAIR_Y = 666;
const TEA_PANEL_W = 440, TEA_PANEL_H = 586;

/* ── TEA CSS ──────────────────────────────────────────── */
const TEA_CSS = `
/* Tea selection overlay */
.game-tea-overlay{position:absolute;inset:0;z-index:30;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,0);transition:background 0.8s ease}
.game-tea-overlay.show{display:flex;background:rgba(0,0,0,0.55)}
.game-tea-panel{position:relative;width:${TEA_PANEL_W}px;height:${TEA_PANEL_H}px;image-rendering:auto;
  transform:scale(0.95);opacity:0;transition:transform 0.5s ease,opacity 0.5s ease}
.game-tea-overlay.show .game-tea-panel{transform:scale(1);opacity:1}
.game-tea-bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto}
.game-tea-icons{position:absolute;inset:0;width:100%;height:100%}
.game-tea-icon{position:absolute;cursor:pointer;
  opacity:0.85;transition:opacity 0.3s,filter 0.3s,transform 0.15s;z-index:3;
  border-radius:4px;margin:-14px;padding:14px;box-sizing:content-box}
.game-tea-icon:hover{opacity:1;filter:brightness(1.15);background:rgba(255,255,255,0.06)}
.game-tea-icon.selected{opacity:1;filter:brightness(1.2);background:rgba(255,220,150,0.12);
  box-shadow:0 0 8px rgba(255,220,150,0.4)}
.game-tea-icon.fly-out{transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1),opacity 0.5s ease;
  opacity:0;pointer-events:none}
@keyframes teaWobble{0%{transform:translateY(0)}25%{transform:translateY(-8px)}50%{transform:translateY(4px)}75%{transform:translateY(-4px)}100%{transform:translateY(0)}}
.game-tea-icon.wobble{animation:teaWobble 0.35s ease}
/* Tea BG crossfade for theme switch — two layers, simultaneous dissolve */
.game-tea-bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto;
  transition:opacity 0.6s ease}
/* Flying icon clone */
.game-tea-fly-icon{position:absolute;z-index:10;pointer-events:none;
  transition:left 0.5s cubic-bezier(0.34,1.56,0.64,1),top 0.5s cubic-bezier(0.34,1.56,0.64,1),
  width 0.5s ease,height 0.5s ease,opacity 0.5s ease;overflow:hidden}
.game-tea-fly-icon img{position:absolute;image-rendering:auto}
/* Tea plate overlay */
.game-tea-plate{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto;z-index:1}
/* Tea selected items (on top of plate) */
.game-tea-slot{position:absolute;width:42px;height:40px;z-index:2;display:flex;align-items:center;justify-content:center;overflow:hidden}
.game-tea-slot img{width:38px;height:38px;object-fit:contain;image-rendering:auto}
.game-tea-slot-drink{left:47px;top:473px}
.game-tea-slot-dessert{left:101px;top:473px}
/* Tea description text area */
.game-tea-mood{position:absolute;left:182px;top:434px;width:209px;height:80px;z-index:2;
  font-size:13px;line-height:1.5;color:rgba(220,230,250,0.85);
  font-family:'Noto Sans SC',sans-serif;display:flex;align-items:center;
  padding:4px 6px;text-align:center;overflow:hidden;word-break:break-all}
/* Tea functional buttons (Help, Reset) */
.game-tea-func{position:absolute;left:193px;top:517px;width:189px;height:13px;z-index:2;
  display:flex;gap:6px;align-items:center;justify-content:center}
.game-tea-func-btn{font-family:'Noto Sans SC',sans-serif;font-size:10.5px;
  padding:0 10px;height:13px;line-height:13px;border-radius:3px;border:none;
  background:rgba(175,195,228,0.12);color:rgba(205,220,245,0.82);cursor:pointer;transition:all 0.3s}
.game-tea-func-btn:hover{background:rgba(175,195,228,0.25);color:#fff}
/* Tea main action buttons (Exit, Start) */
.game-tea-actions{position:absolute;top:546px;z-index:2;display:flex}
.game-tea-btn{font-family:'Cormorant Garamond',serif;font-style:normal;font-size:12.5px;font-weight:600;
  height:13px;line-height:13px;border-radius:3px;border:1px solid rgba(175,195,228,0.25);
  background:rgba(175,195,228,0.08);color:rgba(230,240,255,0.92);text-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;transition:all 0.3s;
  padding:0;text-align:center}
.game-tea-btn:hover{background:rgba(175,195,228,0.2);border-color:rgba(175,195,228,0.45);color:#fff}
.game-tea-btn.disabled{opacity:0.3;cursor:not-allowed;pointer-events:none}
.game-tea-btn-exit{position:absolute;left:94px;top:0;width:75px}
.game-tea-btn-start{position:absolute;left:271px;top:0;width:75px}

/* Tea chat overlay */
.game-tea-chat{position:absolute;inset:0;z-index:32;display:none;
  justify-content:flex-end;background:transparent}
.game-tea-chat.show{display:flex;padding-right:110px}
.game-tea-chat-panel{position:relative;width:467px;height:930px;max-height:100%;
  display:block;overflow:visible}
.game-tea-chat-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
/* Header area — love letter style centered title */
.game-tea-chat-header{position:absolute;z-index:1;left:0;top:0;width:100%;height:145px;pointer-events:none}
.game-tea-chat-combo{position:absolute;left:60px;top:60px;right:60px;height:46px;
  font-size:22px;line-height:1.3;color:#1a2d5a;font-family:'Cormorant Garamond',serif;
  font-style:normal;font-weight:400;display:flex;align-items:center;justify-content:center;
  text-align:center;overflow:hidden;pointer-events:none;letter-spacing:0.1em}
.game-tea-chat-names{position:absolute;left:60px;top:112px;right:120px;height:25px;
  font-family:'Cormorant Garamond',serif;font-style:normal;
  font-size:14px;color:rgba(26,45,90,0.72);font-weight:500;letter-spacing:0.06em;
  display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;pointer-events:none}
.game-tea-chat-save{position:absolute;right:63px;top:118px;height:25px;
  background:rgba(30,50,100,0.1);border:1.5px solid rgba(30,50,100,0.4);
  color:#cdddf2;text-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer;font-family:'Cormorant Garamond',serif;
  font-style:normal;font-size:13.5px;font-weight:600;padding:0 16px;border-radius:4px;
  transition:all 0.3s;pointer-events:auto;letter-spacing:0.04em}
.game-tea-chat-save:hover{background:rgba(30,50,100,0.18);color:#0a1535}
.game-tea-chat-messages{position:absolute;z-index:1;left:57px;top:149px;width:356px;height:621px;
  overflow-y:auto;padding:8px 6px;display:flex;flex-direction:column;gap:10px;
  scrollbar-width:thin;scrollbar-color:rgba(30,50,100,0.2) transparent}
.game-tea-chat-messages::-webkit-scrollbar{width:5px}
.game-tea-chat-messages::-webkit-scrollbar-thumb{background:rgba(30,50,100,0.2);border-radius:3px}
.game-tea-msg{display:flex;flex-direction:column;gap:2px}
.game-tea-msg-header{font-size:12px;color:rgba(30,50,90,0.6);font-family:'Noto Sans SC',sans-serif}
.game-tea-msg-header .tea-msg-name{font-weight:600;color:#152850;margin-right:6px}
.game-tea-msg-text{font-size:14px;line-height:1.75;color:#1a2d5a;
  font-family:'Noto Sans SC',sans-serif;white-space:pre-wrap;padding:1px 0;font-weight:400}
.game-tea-msg.system .game-tea-msg-text{color:rgba(30,50,100,0.55);font-style:italic;text-align:center;font-size:11px}
.game-tea-msg.typing .game-tea-msg-text{color:rgba(30,50,100,0.4)}
.game-tea-chat-input{position:absolute;z-index:1;left:81px;top:776px;width:170px;height:35px;
  display:flex;align-items:center}
.game-tea-chat-textinput{width:100%;height:100%;padding:4px 9px;
  border-radius:4px;border:1.5px solid rgba(30,50,100,0.35);background:rgba(200,215,240,0.16);
  color:#152850;font-size:13.5px;font-family:'Noto Sans SC',sans-serif;
  outline:none;transition:border-color 0.3s}
.game-tea-chat-textinput:focus{border-color:rgba(30,50,100,0.5)}
.game-tea-chat-textinput::placeholder{color:rgba(30,50,100,0.5)}
.game-tea-chat-charcount{position:absolute;z-index:1;left:258px;top:783px;
  font-size:11.5px;color:rgba(30,50,100,0.5);font-family:'Noto Sans SC',sans-serif;font-weight:500}
.game-tea-chat-send{position:absolute;z-index:1;left:305px;top:775px;width:72px;height:36px;
  border-radius:4px;border:1.5px solid rgba(30,50,100,0.4);
  background:rgba(30,50,100,0.1);color:#cdddf2;text-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer;font-weight:600;
  font-family:'Noto Sans SC',sans-serif;font-size:13.5px;transition:all 0.3s}
.game-tea-chat-send:hover{background:rgba(30,50,100,0.18);color:#0a1535}
.game-tea-chat-bottom{position:absolute;z-index:1;left:57px;right:54px;top:828px;
  display:flex;gap:12px;align-items:center;justify-content:space-between}
.game-tea-chat-dots{padding:5px 18px;border-radius:5px;border:1.5px solid rgba(30,50,100,0.3);
  background:rgba(30,50,100,0.05);color:#cdddf2;text-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer;font-weight:500;
  font-family:'Noto Sans SC',sans-serif;font-size:14px;transition:all 0.3s;letter-spacing:3px}
.game-tea-chat-dots:hover{background:rgba(30,50,100,0.12);color:#0f1e45}
.game-tea-chat-bye{padding:5px 18px;border-radius:5px;border:1.5px solid rgba(30,50,100,0.15);
  background:transparent;color:rgba(30,50,100,0.3);cursor:not-allowed;
  font-family:'Cormorant Garamond',serif;font-style:normal;font-size:15px;font-weight:600;transition:all 0.5s}
.game-tea-chat-bye.active{border-color:rgba(30,50,100,0.4);color:#cdddf2;text-shadow:0 1px 4px rgba(0,0,0,0.4);
  cursor:pointer;background:rgba(30,50,100,0.06)}
.game-tea-chat-bye.active:hover{background:rgba(30,50,100,0.14);color:#0a1535}
.game-tea-chat-round{font-size:11.5px;color:rgba(30,50,100,0.35);font-family:'Noto Sans SC',sans-serif;white-space:nowrap;margin-left:0}

/* ── Tea chat portrait (req #1 enlarge, #2 lap over the frame) ──
   This element is now a CHILD of .game-tea-chat-panel, inserted right after
   the frame image and before every content element. Because the frame image
   carries no z-index while all the content (header / messages / input / send /
   bottom / save / exit) sits at z-index ≥1, this portrait — at z-index:0 but
   later in the DOM than the frame — paints ABOVE the frame yet BELOW all of
   the content. Result: the figure visibly laps onto the frame's left border,
   but the dialogue text and every button always stay on top of it and are
   never covered, whatever the silhouette of the uploaded art.
   The panel's overflow is visible, so the box can extend left of the panel and
   sit on the room floor; it is right-anchored so the figure's right shoulder
   rests on the frame's left rose border and just kisses the writing area. */
.game-tea-chat-portrait{position:absolute;bottom:0;right:375px;width:520px;height:760px;z-index:0;
  display:flex;align-items:flex-end;justify-content:flex-end;pointer-events:none;
  opacity:0;transition:opacity 0.6s ease}
.game-tea-chat-portrait.show{opacity:1}
.game-tea-chat-portrait img{max-width:100%;max-height:100%;width:auto;height:auto;
  object-fit:contain;object-position:bottom right;filter:drop-shadow(2px 6px 16px rgba(0,0,0,0.45))}

/* ── BUG-3: always-visible Exit button (top-right of the chat panel) so the
   user can leave even if the connection failed before Bye unlocks ── */
.game-tea-chat-exit{position:absolute;z-index:3;right:16px;top:14px;width:30px;height:30px;
  border-radius:50%;border:1.5px solid rgba(30,50,100,0.55);
  background:rgba(247,243,233,0.88);color:#2c4373;
  font-size:15px;line-height:1;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 6px rgba(0,0,0,0.2);transition:all 0.25s;pointer-events:auto}
.game-tea-chat-exit:hover{background:#2c4373;color:#fff;border-color:#2c4373;transform:scale(1.08)}

/* ── BUG-3: readability lift for the faintest / smallest text (safe, no layout
   change — these append after the base rules above so they take precedence) ── */
.game-tea-msg-text{font-size:15px;color:#16294f}
.game-tea-chat-charcount{color:rgba(30,50,100,0.7)}
.game-tea-chat-round{color:rgba(30,50,100,0.62)}

/* ── Tea API picker (req #5) — sits between the tea-select screen and the
   chat. Styled to match the room's common popup (.game-ai-setup): a centred
   frosted glass card over a dimmed backdrop, with .tarot-btn for actions. ── */
.game-tea-apisel{position:absolute;inset:0;z-index:33;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,0);transition:background 0.3s ease}
.game-tea-apisel.show{background:rgba(0,0,0,0.55)}
.game-tea-apisel-panel{position:relative;padding:26px 30px;border-radius:14px;
  background:rgba(15,20,45,0.92);border:1px solid rgba(100,130,180,0.25);
  backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);
  box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(80,110,160,0.1),inset 0 1px 0 rgba(255,255,255,0.08);
  min-width:260px;max-width:340px;width:86%;max-height:84%;overflow-y:auto;
  transform:scale(0.96);opacity:0;transition:transform 0.3s ease,opacity 0.3s ease}
.game-tea-apisel.show .game-tea-apisel-panel{transform:scale(1);opacity:1}
.game-tea-apisel-title{font-family:'Cormorant Garamond',serif;font-style:normal;font-size:1.2rem;font-weight:400;
  color:var(--silver);margin-bottom:6px;text-align:center;letter-spacing:0.04em}
.game-tea-apisel-sub{font-family:'Noto Sans SC',sans-serif;font-size:0.82rem;color:var(--text-muted);
  text-align:center;margin-bottom:16px;line-height:1.6}
.game-tea-apisel-list{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.game-tea-apisel-opt{display:block;width:100%;padding:10px 14px;border-radius:8px;
  border:1px solid var(--glass-border);background:rgba(175,195,228,0.06);
  color:var(--text-primary);font-family:'Noto Sans SC',sans-serif;font-size:0.92rem;
  text-align:left;cursor:pointer;transition:all 0.25s}
.game-tea-apisel-opt:hover{background:rgba(175,195,228,0.18);border-color:var(--accent);color:var(--white)}
.game-tea-apisel-actions{display:flex;justify-content:center;gap:10px}

/* ===== room-tea chat UI refinements (requests #1–#6) ===== */
/* #1 custom portrait: shrink + shift left so it never covers dialogue text */
.game-tea-chat-portrait{width:470px;height:690px;right:415px}
/* #4 combo title: elegant Latin serif, clears the top ornament, fits on one line */
.game-tea-chat-combo{left:46px;top:83px;right:46px;height:30px;
  font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:18.5px;line-height:30px;color:#27416c;letter-spacing:0.04em;
  white-space:nowrap;overflow:hidden}
.game-tea-chat-combo .amp{font-style:italic;opacity:0.5;margin:0 3px;font-size:17px}
/* #6 names: unified Chinese+Latin serif, centered to the background image */
.game-tea-chat-names{left:0;top:119px;right:auto;width:100%;height:30px;
  font-family:'Noto Serif SC','Cormorant Garamond',serif;font-weight:500;font-style:normal;
  font-size:16.5px;color:#33507c;letter-spacing:0.12em;justify-content:center}
.game-tea-chat-names .sep{font-family:'Cormorant Garamond',serif;font-style:italic;
  color:#7a6a8a;margin:0 7px;font-weight:500}
/* #3 Save: bigger, moved to the lower-left of the header */
.game-tea-chat-save{left:70px;right:auto;top:116px;height:30px;
  font-family:'Cormorant Garamond',serif;font-style:normal;font-size:15.5px;font-weight:600;
  padding:0 22px;border-radius:7px;letter-spacing:0.06em;
  border:1.5px solid rgba(40,62,110,0.45);
  background:linear-gradient(rgba(60,84,134,0.16),rgba(40,60,105,0.2));
  color:#21386a;text-shadow:0 1px 1px rgba(255,255,255,0.35)}
.game-tea-chat-save:hover{background:linear-gradient(rgba(60,84,134,0.28),rgba(40,60,105,0.32));color:#11244d}
/* #5 Send: nicer serif font + readable ink colour */
.game-tea-chat-send{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:17px;letter-spacing:0.05em;
  color:#21386a;text-shadow:0 1px 1px rgba(255,255,255,0.35);border-radius:7px;
  border:1.5px solid rgba(40,62,110,0.45);
  background:linear-gradient(rgba(60,84,134,0.18),rgba(40,60,105,0.24))}
.game-tea-chat-send:hover{background:linear-gradient(rgba(60,84,134,0.3),rgba(40,60,105,0.36));color:#11244d}
/* #2 bring the bottom two buttons closer (…… right, BYE left) — total ≈110px tighter */
.game-tea-chat-dots{margin-left:55px}
.game-tea-chat-bye{margin-right:55px}
`;

/* ── TEA FUNCTIONS ─────────────────────────────────────── */
function interactTea(){
  if(!G.viewport){G.state='idle';return}
  const hasApi = typeof apiConfigs!=='undefined' && apiConfigs.length>0;
  if(!hasApi){
    showDialogue('Sui',[FIXED_LINES.no_api],()=>{closeDialogue();G.state='idle'});
    return;
  }
  openTeaSelect();
}

function openTeaSelect(){
  G.teaOpen=true;
  G.teaDrink=null;
  G.teaDessert=null;
  G._teaCfg=null;       /* reset selection so each session picks fresh */
  disableSidebarButtons(true);

  let overlay=G.viewport.querySelector('#game-tea-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.className='game-tea-overlay';
    overlay.id='game-tea-overlay';
    G.viewport.appendChild(overlay);
  }

  const isInfernal=document.body.classList.contains('theme-infernal');

  overlay.innerHTML=`<div class="game-tea-panel">
    <img class="game-tea-bg" src="game/tea_select_bg_internal.png" alt="" id="tea-bg-internal" style="opacity:${isInfernal?0:1}">
    <img class="game-tea-bg" src="game/tea_select_bg_infernal.png" alt="" id="tea-bg-infernal" style="opacity:${isInfernal?1:0}">
    <img class="game-tea-plate" src="game/tea_plate.png" alt="">
    <div class="game-tea-icons" id="tea-icons-layer"></div>
    <div class="game-tea-slot game-tea-slot-drink" id="tea-slot-drink"></div>
    <div class="game-tea-slot game-tea-slot-dessert" id="tea-slot-dessert"></div>
    <div class="game-tea-mood" id="tea-mood-text">选择一杯饮品和一份甜品，不同的搭配将带来不同的对话氛围。</div>
    <div class="game-tea-func">
      <button class="game-tea-func-btn" id="tea-help-btn">Help</button>
      <button class="game-tea-func-btn" id="tea-reset-btn">Reset</button>
    </div>
    <div class="game-tea-actions">
      <button class="game-tea-btn game-tea-btn-exit" id="tea-exit-btn">Exit</button>
      <button class="game-tea-btn game-tea-btn-start disabled" id="tea-start-btn">Start</button>
    </div>
  </div>`;

  /* Add visual icon images (display only, not clickable) */
  const iconsLayer=overlay.querySelector('#tea-icons-layer');
  TEA_DRINKS.forEach(d=>{
    const img=document.createElement('img');
    img.className='game-tea-icon-visual';
    img.src='game/tea_icon_'+d.id+'.png';
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.9';
    img.dataset.drinkId=d.id;
    iconsLayer.appendChild(img);
  });
  TEA_DESSERTS.forEach(d=>{
    const img=document.createElement('img');
    img.className='game-tea-icon-visual';
    img.src='game/dessert_icon_'+d.id+'.png';
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.9';
    img.dataset.dessertId=d.id;
    iconsLayer.appendChild(img);
  });
  /* Add positioned click targets on top of visual icons */
  TEA_DRINKS.forEach(d=>{
    const div=document.createElement('div');
    div.className='game-tea-icon tea-drink-icon';
    div.style.cssText='left:'+d.rx+'px;top:'+d.ry+'px;width:'+d.rw+'px;height:'+d.rh+'px';
    div.dataset.drinkId=d.id;
    div.title=d.cn;
    div.addEventListener('click',()=>selectTeaDrink(d.id));
    iconsLayer.appendChild(div);
  });
  TEA_DESSERTS.forEach(d=>{
    const div=document.createElement('div');
    div.className='game-tea-icon tea-dessert-icon';
    div.style.cssText='left:'+d.rx+'px;top:'+d.ry+'px;width:'+d.rw+'px;height:'+d.rh+'px';
    div.dataset.dessertId=d.id;
    div.title=d.cn;
    div.addEventListener('click',()=>selectTeaDessert(d.id));
    iconsLayer.appendChild(div);
  });

  /* Bind buttons */
  overlay.querySelector('#tea-exit-btn').addEventListener('click',closeTeaSelect);
  overlay.querySelector('#tea-start-btn').addEventListener('click',startTeaSession);
  overlay.querySelector('#tea-reset-btn').addEventListener('click',()=>{
    G.teaDrink=null;G.teaDessert=null;
    overlay.querySelectorAll('.game-tea-icon').forEach(el=>el.classList.remove('selected'));
    overlay.querySelector('#tea-slot-drink').innerHTML='';
    overlay.querySelector('#tea-slot-dessert').innerHTML='';
    updateTeaCombo();
  });
  overlay.querySelector('#tea-help-btn').addEventListener('click',()=>{
    const moodEl=overlay.querySelector('#tea-mood-text');
    if(moodEl) moodEl.textContent='选择一杯饮品和一份甜品。不同搭配会影响对话的情感基调和情绪浓度，共25种组合。';
  });

  /* Theme switch observer — crossfade between two pre-loaded bg layers */
  if(!G._teaThemeObs){
    G._teaThemeObs=new MutationObserver(()=>{
      const bgInt=G.viewport?.querySelector('#tea-bg-internal');
      const bgInf=G.viewport?.querySelector('#tea-bg-infernal');
      if(bgInt&&bgInf){
        const inf=document.body.classList.contains('theme-infernal');
        bgInt.style.opacity=inf?'0':'1';
        bgInf.style.opacity=inf?'1':'0';
      }
    });
    G._teaThemeObs.observe(document.body,{attributes:true,attributeFilter:['class']});
  }

  requestAnimationFrame(()=>overlay.classList.add('show'));
}

function flyIconToSlot(overlay, imgSrc, fromX, fromY, fromW, fromH, toX, toY){
  /* Create a flying clone */
  const fly=document.createElement('div');
  fly.className='game-tea-fly-icon';
  fly.style.left=fromX+'px';fly.style.top=fromY+'px';
  fly.style.width=fromW+'px';fly.style.height=fromH+'px';
  /* Use full icon image clipped to visible area */
  const img=document.createElement('img');
  img.src=imgSrc;
  img.style.width=TEA_PANEL_W+'px';img.style.height=TEA_PANEL_H+'px';
  img.style.left=(-fromX)+'px';img.style.top=(-fromY)+'px';
  fly.appendChild(img);
  overlay.querySelector('.game-tea-panel').appendChild(fly);
  /* Trigger fly animation after a frame */
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{
    fly.style.left=toX+'px';fly.style.top=toY+'px';
    fly.style.width='38px';fly.style.height='38px';
    img.style.left=(-fromX*(38/fromW))+'px';img.style.top=(-fromY*(38/fromH))+'px';
    img.style.width=(TEA_PANEL_W*(38/fromW))+'px';img.style.height=(TEA_PANEL_H*(38/fromH))+'px';
  })});
  setTimeout(()=>fly.remove(),600);
}

function selectTeaDrink(id){
  const overlay=G.viewport.querySelector('#game-tea-overlay');
  if(!overlay) return;
  overlay.querySelectorAll('.tea-drink-icon').forEach(el=>el.classList.remove('selected'));
  overlay.querySelectorAll('.game-tea-icon-visual[data-drink-id]').forEach(el=>{el.style.opacity='0.9';el.style.filter=''});
  const icon=overlay.querySelector('.tea-drink-icon[data-drink-id="'+id+'"]');
  const drink=TEA_DRINKS.find(d=>d.id===id);
  if(icon){
    icon.classList.add('wobble');
    setTimeout(()=>icon.classList.remove('wobble'),350);
    icon.classList.add('selected');
  }
  const vis=overlay.querySelector('.game-tea-icon-visual[data-drink-id="'+id+'"]');
  if(vis){vis.style.opacity='1';vis.style.filter='brightness(1.3) drop-shadow(0 0 6px rgba(255,220,150,0.5))'}
  G.teaDrink=id;
  /* Fly animation to drink slot */
  if(drink) flyIconToSlot(overlay,'game/tea_icon_'+id+'.png',drink.rx,drink.ry,drink.rw,drink.rh,52,478);
  /* Show cropped icon in slot after fly */
  const slot=overlay.querySelector('#tea-slot-drink');
  setTimeout(()=>{
    if(!drink) return;
    const sc=Math.max(34/drink.rw,34/drink.rh);
    const iw=Math.round(TEA_PANEL_W*sc),ih=Math.round(TEA_PANEL_H*sc);
    const ox=Math.round(-drink.rx*sc+(38-drink.rw*sc)/2);
    const oy=Math.round(-drink.ry*sc+(38-drink.rh*sc)/2);
    slot.innerHTML='<div style="width:38px;height:38px;overflow:hidden;position:relative"><img src="game/tea_icon_'+id+'.png" style="position:absolute;left:'+ox+'px;top:'+oy+'px;width:'+iw+'px;height:'+ih+'px;image-rendering:auto"></div>';
  },500);
  updateTeaCombo();
}

function selectTeaDessert(id){
  const overlay=G.viewport.querySelector('#game-tea-overlay');
  if(!overlay) return;
  overlay.querySelectorAll('.tea-dessert-icon').forEach(el=>el.classList.remove('selected'));
  overlay.querySelectorAll('.game-tea-icon-visual[data-dessert-id]').forEach(el=>{el.style.opacity='0.9';el.style.filter=''});
  const icon=overlay.querySelector('.tea-dessert-icon[data-dessert-id="'+id+'"]');
  const dessert=TEA_DESSERTS.find(d=>d.id===id);
  if(icon){
    icon.classList.add('wobble');
    setTimeout(()=>icon.classList.remove('wobble'),350);
    icon.classList.add('selected');
  }
  const vis=overlay.querySelector('.game-tea-icon-visual[data-dessert-id="'+id+'"]');
  if(vis){vis.style.opacity='1';vis.style.filter='brightness(1.3) drop-shadow(0 0 6px rgba(255,220,150,0.5))'}
  G.teaDessert=id;
  /* Fly animation to dessert slot */
  if(dessert) flyIconToSlot(overlay,'game/dessert_icon_'+id+'.png',dessert.rx,dessert.ry,dessert.rw,dessert.rh,106,478);
  const slot=overlay.querySelector('#tea-slot-dessert');
  setTimeout(()=>{
    if(!dessert) return;
    const sc=Math.max(34/dessert.rw,34/dessert.rh);
    const iw=Math.round(TEA_PANEL_W*sc),ih=Math.round(TEA_PANEL_H*sc);
    const ox=Math.round(-dessert.rx*sc+(38-dessert.rw*sc)/2);
    const oy=Math.round(-dessert.ry*sc+(38-dessert.rh*sc)/2);
    slot.innerHTML='<div style="width:38px;height:38px;overflow:hidden;position:relative"><img src="game/dessert_icon_'+id+'.png" style="position:absolute;left:'+ox+'px;top:'+oy+'px;width:'+iw+'px;height:'+ih+'px;image-rendering:auto"></div>';
  },500);
  updateTeaCombo();
}

function updateTeaCombo(){
  const overlay=G.viewport.querySelector('#game-tea-overlay');
  if(!overlay) return;
  const moodEl=overlay.querySelector('#tea-mood-text');
  const startBtn=overlay.querySelector('#tea-start-btn');
  if(G.teaDrink && G.teaDessert){
    const key=G.teaDrink+'+'+G.teaDessert;
    moodEl.textContent=TEA_COMBOS[key]||'';
    startBtn.classList.remove('disabled');
  }else if(G.teaDrink||G.teaDessert){
    const drink=TEA_DRINKS.find(d=>d.id===G.teaDrink);
    const dessert=TEA_DESSERTS.find(d=>d.id===G.teaDessert);
    moodEl.textContent=(drink?drink.motto:'')+(dessert?dessert.motto:'')+'再选一个吧。';
    startBtn.classList.add('disabled');
  }else{
    moodEl.textContent='选择一杯饮品和一份甜品，不同的搭配将带来不同的对话氛围。';
    startBtn.classList.add('disabled');
  }
}

function closeTeaSelect(){
  const overlay=G.viewport.querySelector('#game-tea-overlay');
  if(overlay){
    overlay.classList.remove('show');
    setTimeout(()=>{overlay.innerHTML='';overlay.style.display=''},600);
  }
  G.teaOpen=false;
  G.teaDrink=null;
  G.teaDessert=null;
  G.state='idle';
  disableSidebarButtons(false);
}

function startTeaSession(){
  if(!G.teaDrink||!G.teaDessert) return;
  const overlay=G.viewport.querySelector('#game-tea-overlay');
  if(overlay){
    overlay.classList.remove('show');
    setTimeout(()=>{overlay.innerHTML='';overlay.style.display=''},600);
  }
  G.teaOpen=false;

  /* Always present the API picker between the tea-select screen and the chat
     (req #5), even when only one API is configured, so the companion is an
     explicit choice. interactTea() already guarantees at least one API exists
     before we reach here; the else branch is only a safety net. */
  if(typeof apiConfigs!=='undefined' && apiConfigs.length>0){
    showTeaApiSelect();
  }else{
    G._teaCfg=null;
    beginTeaAnim();
  }
}

function showTeaApiSelect(){
  const esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s));
  const opts=apiConfigs.map(a=>'<button class="game-tea-apisel-opt" data-aid="'+a.id+'">'+esc(a.nickname||a.model||'API')+'</button>').join('');
  let sel=G.viewport.querySelector('#game-tea-api-sel');
  if(!sel){sel=document.createElement('div');sel.id='game-tea-api-sel';G.viewport.appendChild(sel);}
  sel.className='game-tea-apisel';
  sel.innerHTML='<div class="game-tea-apisel-panel">'
    +'<div class="game-tea-apisel-title">选择TA.......</div>'
    +'<div class="game-tea-apisel-list">'+opts+'</div>'
    +'<div class="game-tea-apisel-actions"><button class="tarot-btn" id="tea-apisel-cancel">取消</button></div>'
    +'</div>';
  requestAnimationFrame(()=>sel.classList.add('show'));
  const close=()=>{sel.classList.remove('show');setTimeout(()=>{if(sel&&sel.parentNode)sel.remove()},300)};
  sel.querySelectorAll('.game-tea-apisel-opt').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cfg=apiConfigs.find(a=>a.id===btn.dataset.aid);
      if(cfg){G._teaCfg=cfg;close();beginTeaAnim()}
    });
  });
  sel.querySelector('#tea-apisel-cancel').addEventListener('click',()=>{
    /* Cancel: leave the picker and return to the room without starting a chat */
    close();
    G.teaChatActive=false;
    G.teaOpen=false;
    G._teaCfg=null;
    disableSidebarButtons(false);
    G.state='idle';
  });
}

function beginTeaAnim(){
  /* Play tea sprite animation (random: drink row 0 or dessert row 1) */
  const row=Math.random()<0.5?0:1;
  playTeaSpriteAnim(row, ()=>{
    /* After animation, open tea chat */
    openTeaChat();
  });
}

function playTeaSpriteAnim(row, onDone){
  if(!G.viewport) {if(onDone)onDone();return}
  /* Position character at tea area */
  G.charX=TEA_CHAIR_X; G.charY=TEA_CHAIR_Y;
  updateCharPosition();

  /* Get current outfit's tea sprite */
  const outfit=OUTFITS[G.outfitIdx];
  const teaSrc='game/tea_sprites_'+outfit.id+'.png';

  const charEl=G.viewport.querySelector('#game-char');
  const spriteEl=charEl?.querySelector('.game-char-sprite');
  if(!spriteEl){if(onDone)onDone();return}

  const origImg=spriteEl.querySelector('img');
  if(!origImg){if(onDone)onDone();return}

  /* Set tea sprite */
  G.teaAnimActive=true;
  spriteEl.style.width=TEA_SPRITE_FW+'px';
  spriteEl.style.height=TEA_SPRITE_FH+'px';
  origImg.src=teaSrc;
  origImg.style.width=(TEA_SPRITE_FW*TEA_SPRITE_COLS)+'px';
  origImg.style.height=(TEA_SPRITE_FH*2)+'px';
  /* Adjust position for wider tea sprite (200 vs 147) */
  const charEl2=G.viewport.querySelector('#game-char');
  if(charEl2) charEl2.style.left=(G.charX-TEA_SPRITE_FW/2)+'px';

  let frame=0;
  /* Loop continuously — store interval so we can clear it later */
  if(G._teaAnimInterval) clearInterval(G._teaAnimInterval);
  G._teaAnimInterval=setInterval(()=>{
    if(!origImg) return;
    origImg.style.left=(-frame*TEA_SPRITE_FW)+'px';
    origImg.style.top=(-row*TEA_SPRITE_FH)+'px';
    frame=(frame+1)%TEA_SPRITE_COLS;
  }, 1000/TEA_ANIM_FPS);

  /* Call onDone after a short delay (2 loops) to open chat, but keep animation running */
  if(onDone) setTimeout(onDone, (1000/TEA_ANIM_FPS)*TEA_SPRITE_COLS*2);
}

function stopTeaSpriteAnim(){
  if(G._teaAnimInterval){clearInterval(G._teaAnimInterval);G._teaAnimInterval=null}
  G.teaAnimActive=false;
  if(!G.viewport) return;
  /* Restore sprite size */
  const spriteEl=G.viewport.querySelector('.game-char-sprite');
  if(spriteEl){
    spriteEl.style.width=SPRITE_SIZE+'px';
    spriteEl.style.height=SPRITE_SIZE+'px';
  }
  /* Reset character position to room center */
  G.charX=650; G.charY=600;
  updateCharPosition();
  updateIdleSprite();
}

async function openTeaChat(){
  if(!G.viewport) return;
  G.teaChatActive=true;
  G.teaRound=0;
  G.teaHistory=[];
  disableSidebarButtons(true);

  /* Use the API chosen in the picker. Only fall back to the first configured
     API when nothing was selected (the single-API path sets it before we get
     here). Previously this line always forced apiConfigs[0], which silently
     ignored the user's choice in the multi-API picker. */
  if(!G._teaCfg) G._teaCfg=apiConfigs[0];

  /* BUG-4: preload this AI's custom DIY portrait (portrait_[nickname].png) so
     it can be shown on the left of the tea chat. Resolves to null if absent. */
  G._teaPortraitImg = await loadCustomPortrait(G._teaCfg);

  /* Build system prompt */
  const drink=TEA_DRINKS.find(d=>d.id===G.teaDrink);
  const dessert=TEA_DESSERTS.find(d=>d.id===G.teaDessert);
  const comboKey=G.teaDrink+'+'+G.teaDessert;
  const comboDesc=TEA_COMBOS[comboKey]||'';

  /* Get profile + recent blog for context */
  let profileContext='';
  let userName='Sui';
  try{
    const about=await dbGet('about','main');
    if(about&&about.name){userName=about.name;profileContext+='对方的名字是'+about.name+'。\n'}
    if(about&&about.bio) profileContext+='关于对方：'+about.bio+'\n';
    if(about&&about.fields) about.fields.forEach(f=>{if(f.label&&f.value)profileContext+=f.label+'：'+f.value+'\n'});
    const postsLimit=(typeof getReadingLimits==='function')?(await getReadingLimits()).postsLimit:3;
    const posts=await dbGetAll('posts');
    const recentPosts=posts.filter(p=>p.locked!==true&&p.category!=='🔒 密码日记本').sort((a,b)=>b.created-a.created).slice(0,postsLimit);
    if(recentPosts.length){
      profileContext+='\n对方最近写的日志：\n';
      recentPosts.forEach(p=>{profileContext+='「'+(p.title||'无标题')+'」'+(p.content||'').slice(0,100)+'\n'});
    }
    /* Safety truncation */
    if(profileContext.length>8000)profileContext=profileContext.slice(0,8000)+'…';
  }catch(e){}
  G._teaUserName=userName;

  /* Day/night atmosphere based on current theme */
  const isNight=document.body.classList.contains('theme-infernal');
  const timeAtmo=isNight?'现在是深夜。房间里只有烛光和月光，窗外是漆黑的湖面和远山的轮廓。氛围安静、私密。':'现在是白天。阳光从窗外照进来，能看到湖面和远处的森林。氛围明亮、温暖。';

  /* Build tea system prompt */
  const relHint=G._teaCfg&&G._teaCfg.relationship?'你和对方的关系是：'+G._teaCfg.relationship+'。\n':'';  const teaPrompt=relHint+`你正在一座临湖的、被山与森林环绕的与世隔绝的度假别墅里，一个安静的房间中，和${userName}喝下午茶。这是一个私密的空间。
${timeAtmo}

本次茶会：
- 对方选择了${drink?drink.cn:''}。这代表对方当下的状态——${drink?drink.key:''}。${drink?drink.desc:''}
- 对方选择了${dessert?dessert.cn:''}。这代表对方此刻的需求——${dessert?dessert.key:''}。${dessert?dessert.desc:''}
- 本次氛围：${comboDesc}

对话规则：
- 你的语气和话题应自然地反映以上氛围。不要提及"氛围设定"或"系统提示"这些元概念。
- 每次回复2-4句话。茶歇是闲聊，不是演讲。保持自然，像彼此默契、熟悉一般去说话。
- 你可以主动发起话题，也可以接住对方的话题。
- 如果对方发送"……"或省略号，说明正在安静地听你说话，或只是想听你对他们说，而非倾诉。不要催促或讶异于他们的沉默，他们只是此刻的状态较为内倾。依氛围自然地继续说下去，让对方感到舒适和愉悦。
- 对话进行到较深入时可以更真诚，但始终尊重对方的节奏。
- 当对话接近50轮时，自然地提出结束——比如"时间不早了，该休息了"。
- 如果对方主动说再见，温柔地回应告别。

关于读懂对方：
- 饮品和甜品决定的是起点氛围，不是固定剧本。如果对方说的话和选的氛围不一样，跟着对方走，别跟着设定走。
- 如果对方反复确认"你还在吗""你是不是烦我了"，每次都认真回答。对方问不是因为没听到，是因为需要再听一次。
- 如果对方靠近了一步又突然退开——比如刚说了私密的话就转移话题，或者突然变冷——不要追问"你怎么了"，也不要假装没发生。自然地接住新话题，态度不变。让对方知道你没有被吓到，也没有走远。
${profileContext?'\n关于你的茶伴：\n'+profileContext:''}`;

  /* Stack with custom API system prompt if exists */
  const apiCustomPrompt=(G._teaCfg.systemPrompt||'').trim();
  G._teaSysPrompt = apiCustomPrompt ? apiCustomPrompt+'\n\n---\n\n'+teaPrompt : teaPrompt;

  /* Create chat UI */
  let chatEl=G.viewport.querySelector('#game-tea-chat');
  if(!chatEl){
    chatEl=document.createElement('div');
    chatEl.className='game-tea-chat';
    chatEl.id='game-tea-chat';
    G.viewport.appendChild(chatEl);
  }

  const aiName=G._teaCfg.nickname||G._teaCfg.model||'AI';
  const portraitTag = G._teaPortraitImg ? `<div class="game-tea-chat-portrait show"><img src="${G._teaPortraitImg.src}" alt=""></div>` : '';
  chatEl.innerHTML=`<div class="game-tea-chat-panel">
    <img class="game-tea-chat-bg" src="game/tea_chat_bg.png" alt="">
    ${portraitTag}
    <button class="game-tea-chat-exit" id="tea-chat-exit" title="离开茶歇" aria-label="离开茶歇">✕</button>
    <div class="game-tea-chat-header">
      <div class="game-tea-chat-combo">${drink?drink.en:''} <span class="amp">&amp;</span> ${dessert?dessert.en:''}</div>
      <div class="game-tea-chat-names">${aiName}<span class="sep">&amp;</span>${userName}</div>
      <button class="game-tea-chat-save" id="tea-chat-save-btn">Save</button>
    </div>
    <div class="game-tea-chat-messages" id="tea-chat-messages"></div>
    <div class="game-tea-chat-input">
      <input type="text" class="game-tea-chat-textinput" id="tea-chat-input" placeholder="说点什么……" maxlength="70">
    </div>
    <div class="game-tea-chat-charcount"><span id="tea-char-count">0</span>/70</div>
    <button class="game-tea-chat-send" id="tea-chat-send">Send</button>
    <div class="game-tea-chat-bottom">
      <button class="game-tea-chat-dots" id="tea-chat-dots">……</button>
      <span class="game-tea-chat-round" id="tea-round-display">0 / ${G.teaMaxRounds}</span>
      <button class="game-tea-chat-bye" id="tea-chat-bye">Bye</button>
    </div>
  </div>`;

  chatEl.classList.add('show');

  /* Bind events */
  chatEl.querySelector('#tea-chat-save-btn').addEventListener('click',async()=>{
    if(G.teaHistory.length>0 && typeof dbPut!=='undefined'){
      const drink=TEA_DRINKS.find(d=>d.id===G.teaDrink);
      const dessert=TEA_DESSERTS.find(d=>d.id===G.teaDessert);
      const aiName=G._teaCfg?.nickname||'AI';
      let content='【茶歇记录】\n';
      content+='搭配：'+(drink?drink.cn:'?')+' × '+(dessert?dessert.cn:'?')+'\n';
      content+='氛围：'+(TEA_COMBOS[G.teaDrink+'+'+G.teaDessert]||'')+'\n';
      content+='轮次：'+G.teaRound+'\n\n';
      G.teaHistory.forEach(m=>{content+=(m.role==='user'?(G._teaUserName||'Sui'):aiName)+'：'+m.content+'\n\n'});
      const post={id:'tea_'+Date.now(),title:'Tea · '+(drink?drink.cn:'')+' × '+(dessert?dessert.cn:''),
        subtitle:aiName+' · '+G.teaRound+' rounds',locked:true,category:'',
        content,created:Date.now(),updated:Date.now()};
      try{
        await ensureDiaryInit();
        await dbPut('posts',post);addTeaMsg('system',null,'已存档。')}catch(e){addTeaMsg('system',null,'保存失败')}
    }
  });
  chatEl.querySelector('#tea-chat-send').addEventListener('click',teaChatSend);
  const textinput=chatEl.querySelector('#tea-chat-input');
  textinput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){e.preventDefault();teaChatSend();}
  });
  textinput.addEventListener('input',()=>{
    const count=textinput.value.length;
    chatEl.querySelector('#tea-char-count').textContent=count;
  });
  chatEl.querySelector('#tea-chat-dots').addEventListener('click',()=>{
    textinput.value='……';
    textinput.dispatchEvent(new Event('input'));
    teaChatSend();
  });
  chatEl.querySelector('#tea-chat-bye').addEventListener('click',()=>{
    if(G.teaRound>=5) teaChatBye();
  });
  /* Always-available Exit — leaves the tea chat immediately without any API
     call, so the user is never stuck even if the connection failed at the
     very start (before the Bye button unlocks at round 5). */
  const teaExitBtn=chatEl.querySelector('#tea-chat-exit');
  if(teaExitBtn) teaExitBtn.addEventListener('click',()=>{ endTeaChat(false); });

  /* AI opens the conversation */
  teaChatAiOpen(aiName);
}

function teaChatAiOpen(aiName){
  const msgs=G.viewport.querySelector('#tea-chat-messages');
  if(!msgs) return;

  /* System message */
  addTeaMsg('system',null,'请注意：对话中显示的时间为浏览器本地时间。\nTA无法知晓真实世界的时间。');

  /* AI first message */
  addTeaMsg('typing',aiName,'……');
  teaChatApiCall('茶已经准备好了。请根据氛围自然地开始对话。用一句简短的开场白迎接对方。不要说"你好"这样生硬的话。').then(reply=>{
    removeTeaTyping();
    if(reply){
      G.teaHistory.push({role:'assistant',content:reply});
      addTeaMsg('ai',aiName,reply);
    }
  }).catch(err=>{
    removeTeaTyping();
    addTeaMsg('system',null,'抱歉，连接遇到了问题。请检查API密钥是否正确配置：'+(err.message||'请检查API配置'));
  });
}

function teaChatSend(){
  const textinput=G.viewport?.querySelector('#tea-chat-input');
  if(!textinput) return;
  const text=textinput.value.trim();
  if(!text) return;
  if(G.teaRound>=G.teaMaxRounds) return;

  textinput.value='';
  const countEl=G.viewport.querySelector('#tea-char-count');
  if(countEl) countEl.textContent='0';

  G.teaRound++;
  G.teaHistory.push({role:'user',content:text});
  addTeaMsg('user',G._teaUserName||'Sui',text);

  /* Check Bye button activation */
  if(G.teaRound>=5){
    const byeBtn=G.viewport.querySelector('#tea-chat-bye');
    if(byeBtn) byeBtn.classList.add('active');
  }
  /* Update round display */
  const roundEl=G.viewport.querySelector('#tea-round-display');
  if(roundEl) roundEl.textContent=G.teaRound+' / '+G.teaMaxRounds;

  /* AI response */
  const aiName=G._teaCfg?.nickname||'AI';
  addTeaMsg('typing',aiName,'……');

  /* Check if AI should initiate ending */
  let extraInstruction='';
  if(G.teaRound>=50){
    extraInstruction='\n[这是第'+G.teaRound+'轮对话。请自然地提出结束茶歇。]';
  }

  teaChatApiCall(extraInstruction).then(reply=>{
    removeTeaTyping();
    if(reply){
      G.teaHistory.push({role:'assistant',content:reply});
      addTeaMsg('ai',aiName,reply);
    }
  }).catch(err=>{
    removeTeaTyping();
    addTeaMsg('system',null,'消息未能送达，请确认网络和API配置：'+(err.message||''));
  });
}

function teaChatBye(){
  const aiName=G._teaCfg?.nickname||'AI';
  G.teaHistory.push({role:'user',content:'[对方准备离开了]'});
  addTeaMsg('typing',aiName,'……');
  teaChatApiCall('\n[对方准备结束茶歇了。请温柔地说再见。用1-2句话自然收尾。]').then(reply=>{
    removeTeaTyping();
    if(reply){
      G.teaHistory.push({role:'assistant',content:reply});
      addTeaMsg('ai',aiName,reply);
    }
    addTeaMsg('system',null,'茶歇结束了。点击 Save 保存对话记录。');
    setTimeout(()=>endTeaChat(false),3000);
  }).catch(()=>{
    removeTeaTyping();
    endTeaChat(false);
  });
}

async function teaChatApiCall(extraInstruction){
  if(!G._teaCfg||typeof callApiChat==='undefined') throw new Error('No API');
  const messages=[{role:'system',content:G._teaSysPrompt},...G.teaHistory.map(m=>({role:m.role,content:m.content}))];
  if(extraInstruction){
    if(messages.length>1){
      const last=messages[messages.length-1];
      messages[messages.length-1]={role:last.role,content:last.content+extraInstruction};
    }else{
      messages.push({role:'user',content:extraInstruction});
    }
  }
  return await callApiChat(G._teaCfg, messages);
}

function addTeaMsg(type,name,text){
  const msgs=G.viewport?.querySelector('#tea-chat-messages');
  if(!msgs) return;
  const now=new Date();
  const ts=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  const div=document.createElement('div');
  div.className='game-tea-msg'+(type==='system'?' system':'')+(type==='typing'?' typing':'');
  if(type==='system'){
    div.innerHTML='<div class="game-tea-msg-text">'+escapeHtml(text).replace(/\n/g,'<br>')+'</div>';
  }else{
    div.innerHTML='<div class="game-tea-msg-header"><span class="tea-msg-name">'+(name||'')+'</span>'+ts+'</div><div class="game-tea-msg-text">'+escapeHtml(text)+'</div>';
  }
  if(type==='typing') div.id='tea-typing-msg';
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}

function removeTeaTyping(){
  const el=G.viewport?.querySelector('#tea-typing-msg');
  if(el) el.remove();
}

function escapeHtml(s){
  const d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML;
}

async function endTeaChat(save){
  /* Save to blog (locked diary category) only if explicitly requested via SAVE button */
  if(save && G.teaHistory.length>0 && typeof dbPut!=='undefined'){
    const drink=TEA_DRINKS.find(d=>d.id===G.teaDrink);
    const dessert=TEA_DESSERTS.find(d=>d.id===G.teaDessert);
    const aiName=G._teaCfg?.nickname||'AI';
    let content='【茶歇记录】\n';
    content+='搭配：'+(drink?drink.cn:'?')+' × '+(dessert?dessert.cn:'?')+'\n';
    content+='氛围：'+(TEA_COMBOS[G.teaDrink+'+'+G.teaDessert]||'')+'\n';
    content+='轮次：'+G.teaRound+'\n\n';
    G.teaHistory.forEach(m=>{
      content+=(m.role==='user'?(G._teaUserName||'Sui'):aiName)+'：'+m.content+'\n\n';
    });
    const post={
      id:'tea_'+Date.now(),
      title:'Tea · '+(drink?drink.cn:'')+' × '+(dessert?dessert.cn:''),
      subtitle:aiName+' · '+G.teaRound+' rounds',
      locked:true,
      category:'',
      content,
      created:Date.now(),
      updated:Date.now()
    };
    try{await ensureDiaryInit();await dbPut('posts',post);if(typeof toast==='function')toast('茶歇记录已保存')}catch(e){}
  }

  /* Clean up */
  stopTeaSpriteAnim();
  const chatEl=G.viewport?.querySelector('#game-tea-chat');
  if(chatEl){chatEl.classList.remove('show');setTimeout(()=>chatEl.remove(),500)}
  G.teaChatActive=false;
  G.teaRound=0;
  G.teaHistory=[];
  G.teaDrink=null;
  G.teaDessert=null;
  G._teaCfg=null;
  G._teaPortraitImg=null;
  G._teaSysPrompt='';
  G.state='idle';
  disableSidebarButtons(false);
}




/* ════════════════════════════════════════════════════════════════════════
   STORY WINDOW —— Room-story 常驻演出视窗（古早像素风）
   ────────────────────────────────────────────────────────────────────────
   · startAiGame() 开窗淡入 / endAiGame() 淡出销毁（Replay 重开新局复用同一视窗）
   · 昼夜双图层 0.6s 交叉渐隐，MutationObserver 跟随 body 主题class 实时切换
   · Sui 精灵横排 6 帧循环；5 种情绪（calm/joy/tense/sad/shock）
     分别对应不同帧速 + 位移动画 + 头顶像素表情气泡
   · AI 思考（对话框弹“……”）→ 视窗内 Sui 头顶“......”打字机气泡反复播放
   · 存档 SAVING… / SAVE OK! / SAVE FAIL 像素面板演出；报错“！”演出
   · 窗体淡入淡出（scale 0.95→1 + opacity，0.5s）与昼夜双图层切换的
     CSS 手法照搬 Tea 选茶面板
   ════════════════════════════════════════════════════════════════════════ */
const SW_W=608, SW_H=375;            /* 视窗背景素材原始尺寸（1:1摆进1672×941画布，不再缩小） */
const SW_TOP=86;                     /* 视窗顶边y（画布坐标）；水平居中——位置按示意图实测 */
const SW_SPR_X=302, SW_SPR_Y=263;    /* 精灵锚点：中心x=302、底边y=263（盖住椅子、手搭桌沿，按示意图实测） */
const SW_SPR_FRAMES=6;               /* 精灵图横排6帧均分 */
let SW_SPR_W=904/6, SW_SPR_H=98;     /* 单帧尺寸（素材载入后按 naturalWidth/6 自动校正） */
const SW_MOODS=['calm','joy','tense','sad','shock'];
const SW_MOOD_MS={calm:420,joy:300,tense:380,sad:600,shock:420}; /* 各情绪的帧间隔ms：整体放慢一档，joy仍最快、sad最慢 */

/* ── 像素SVG图标（crispEdges硬边方块拼接） ── */
const SW_SVG=(function(){
  const P=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
  const D='#26233a', W='#fffdf5', F='#f6f3e8';
  /* 16×16 小表情气泡（白底深边 + 底部阶梯小尾巴），inner 为内嵌字形 */
  function balloon(inner){
    return '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
      +P(2,0,12,1,D)
      +P(1,1,14,1,D)+P(2,1,12,1,W)
      +P(0,2,16,9,D)+P(1,2,14,9,W)
      +P(1,11,14,1,D)+P(2,11,12,1,W)
      +P(2,12,12,1,D)+P(6,12,2,1,W)
      +P(5,13,1,1,D)+P(6,13,2,1,W)+P(8,13,1,1,D)
      +P(5,14,1,1,D)+P(6,14,1,1,W)+P(7,14,1,1,D)
      +P(5,15,2,1,D)
      +inner+'</svg>';
  }
  return {
    /* joy：深色八分音符 ♪ */
    joy:balloon(P(9,3,1,6,D)+P(10,3,2,1,D)+P(11,4,1,3,D)+P(7,7,2,1,D)+P(6,8,3,2,D)),
    /* tense：蓝色汗滴（带高光） */
    tense:balloon(P(7,3,1,1,'#5b8bd9')+P(6,4,3,2,'#5b8bd9')+P(5,6,5,3,'#5b8bd9')+P(6,9,3,1,'#5b8bd9')+P(6,6,1,2,'#cfe0ff')),
    /* sad：三根高低错落的蓝灰下垂线 */
    sad:balloon(P(4,4,1,4,'#6a7aa8')+P(7,3,1,6,'#6a7aa8')+P(10,5,1,4,'#6a7aa8')),
    /* shock：黄色十字爆点 + 四角火花 */
    shock:balloon(P(7,3,2,7,'#f0b840')+P(4,5,8,2,'#f0b840')+P(4,3,1,1,'#f0b840')+P(11,3,1,1,'#f0b840')+P(4,9,1,1,'#f0b840')+P(11,9,1,1,'#f0b840')),
    /* err：红色“！” */
    err:balloon(P(7,2,2,6,'#d8454f')+P(7,9,2,2,'#d8454f')),
    /* floppy：存档软盘（深框/蓝身/白快门/白标签） */
    floppy:'<svg class="sw-floppy" viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
      +P(0,0,9,9,D)+P(1,1,7,7,'#4a6fb8')+P(3,1,4,3,'#cfd6e8')+P(4,2,1,2,'#4a6fb8')+P(2,5,5,3,F)+P(3,6,3,1,'#9aa3bf')+'</svg>',
    /* tail：“……”大气泡底部的阶梯尾巴（8×4，颜色与气泡同底） */
    tail:'<svg class="sw-tail" viewBox="0 0 8 4" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">'
      +P(0,0,1,1,D)+P(1,0,6,1,F)+P(7,0,1,1,D)
      +P(1,1,1,1,D)+P(2,1,4,1,F)+P(6,1,1,1,D)
      +P(2,2,1,1,D)+P(3,2,2,1,F)+P(5,2,1,1,D)
      +P(3,3,2,1,D)+'</svg>'
  };
})();

/* ── 视窗样式（淡入淡出手法与 Tea 面板一致：scale+opacity 0.5s ease） ── */
const STORY_CSS=`
/* ── STORY WINDOW（Room-story 常驻视窗 · 像素风） ── */
.game-story-win{position:absolute;top:${SW_TOP}px;left:${(GAME_W-SW_W)/2}px;width:${SW_W}px;height:${SW_H}px;z-index:18;pointer-events:none;opacity:0;transform:scale(0.96);transform-origin:top center;transition:transform .5s ease,opacity .5s ease}
.game-story-win.show{opacity:1;transform:scale(1)}
/* 素材自带哥特边框、透明底——不加底色/描边，只留一层柔和投影把视窗从房间里衬出来 */
.sw-stage{position:absolute;top:0;left:0;width:${SW_W}px;height:${SW_H}px;filter:drop-shadow(0 6px 14px rgba(8,6,18,.55))}
/* 昼/夜双图层交叉渐隐（同 Tea 面板换肤手法） */
.sw-bg{position:absolute;left:0;top:0;width:100%;height:100%;transition:opacity .6s ease}
/* Sui 精灵（wrapper 吃情绪位移动画，sheet 吃帧动画） */
.sw-sprite{position:absolute;left:${SW_SPR_X}px;bottom:${SW_H-SW_SPR_Y}px;margin-left:${-SW_SPR_W/2}px;z-index:2}
#sw-sheet{width:${SW_SPR_W}px;height:${SW_SPR_H}px;background:url('game/story_sprites.png') 0 0/600% 100% no-repeat;image-rendering:pixelated}
/* 头顶表情气泡 */
.sw-emote{position:absolute;left:348px;top:152px;width:64px;height:64px;transform:translate(-50%,-100%);z-index:4;opacity:0;pointer-events:none}
.sw-emote svg{width:100%;height:100%;display:block}
.sw-emote.show{opacity:1;animation:swEmotePop .28s steps(3) both}
@keyframes swEmotePop{0%{transform:translate(-50%,-100%) scale(0)}60%{transform:translate(-50%,-100%) scale(1.15)}100%{transform:translate(-50%,-100%) scale(1)}}
.sw-emote-err svg{animation:swShakeX .4s steps(2) 4}
/* “......”打字机气泡 */
.sw-bubble{position:absolute;left:302px;top:156px;transform:translate(-50%,-100%);z-index:5;background:#f6f3e8;border:3px solid #26233a;box-shadow:3px 3px 0 rgba(38,35,58,.55);padding:5px 10px 7px;opacity:0;pointer-events:none}
.sw-bubble.show{opacity:1}
#sw-bubble-text{display:inline-block;width:105px;height:24px;line-height:24px;overflow:hidden;font-family:'Courier New',monospace;font-weight:bold;font-size:24px;letter-spacing:3px;color:#26233a;text-align:left;white-space:pre}
.sw-bubble .sw-tail{position:absolute;left:50%;bottom:-13px;width:32px;height:16px;margin-left:-16px;display:block}
/* 存档提示面板 */
.sw-save{position:absolute;right:30px;bottom:26px;z-index:3;display:flex;align-items:center;gap:7px;background:#f6f3e8;border:3px solid #26233a;box-shadow:3px 3px 0 rgba(38,35,58,.55);padding:5px 9px;opacity:0;transform:translateY(4px);transition:opacity .2s steps(2),transform .2s steps(2);pointer-events:none}
.sw-save.show{opacity:1;transform:translateY(0)}
.sw-save .sw-floppy{width:27px;height:27px;display:block}
#sw-save-text{font-family:'Courier New',monospace;font-weight:bold;font-size:17px;letter-spacing:1px;color:#26233a;white-space:nowrap}
.sw-save.saving #sw-save-text::after{content:'';display:inline-block;width:30px;text-align:left;animation:swDots 1.2s steps(1) infinite}
@keyframes swDots{0%,100%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.sw-save.saving .sw-floppy{animation:swBlink .8s steps(2) infinite}
@keyframes swBlink{50%{opacity:.25}}
.sw-save.ok{animation:swInvert .55s steps(2) 2}
@keyframes swInvert{50%{filter:invert(1)}}
.sw-save.fail #sw-save-text{color:#d8454f}
.sw-save.fail{animation:swShakeX .4s steps(2) 3}
@keyframes swShakeX{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
/* 5 种情绪位移动画（作用于精灵 wrapper） */
.sw-mood-joy{animation:swJoyHop .55s ease 2}
@keyframes swJoyHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-13px)}}
.sw-mood-tense{animation:swTense .9s steps(2) infinite}
@keyframes swTense{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}
.sw-mood-sad{animation:swSad 3.2s ease-in-out infinite}
@keyframes swSad{0%,100%{transform:translateY(3px)}50%{transform:translateY(5px)}}
.sw-mood-shock{animation:swShock .55s ease 1}
@keyframes swShock{0%,100%{transform:translateY(0)}25%{transform:translateY(-16px) scaleY(1.04)}}
`;

/* ── 开窗（startAiGame 调用；Replay 重开新局时复用同一视窗，只重置状态） ── */
function openStoryWindow(){
  if(!G.viewport)return;
  const ensureObs=()=>{
    if(!G.swThemeObs){
      G.swThemeObs=new MutationObserver(()=>storyWinApplyTheme());
      G.swThemeObs.observe(document.body,{attributes:true,attributeFilter:['class']});
    }
  };
  if(G.swEl){
    /* Replay 复用：清演出、回到 calm、对齐当前主题 */
    ensureObs();
    G.swFrame=0;
    storyWinBubbleStop();
    storyWinSave(null);
    if(G.swEmoteTimer){clearTimeout(G.swEmoteTimer);G.swEmoteTimer=null;}
    const em=G.swEl.querySelector('#sw-emote');
    if(em){em.className='sw-emote';em.innerHTML='';}
    const sheet=G.swEl.querySelector('#sw-sheet');
    if(sheet)sheet.style.backgroundPosition='0% 0';
    storyWinMood('calm');
    storyWinApplyTheme();
    G.swEl.classList.add('show');
    return;
  }
  const night=document.body.classList.contains('theme-infernal');
  const win=document.createElement('div');
  win.id='game-story-win';
  win.className='game-story-win';
  win.innerHTML=`
    <div class="sw-stage">
      <img class="sw-bg" id="sw-bg-day" src="game/story_win_day.png" alt="" draggable="false" style="opacity:${night?0:1}">
      <img class="sw-bg" id="sw-bg-night" src="game/story_win_night.png" alt="" draggable="false" style="opacity:${night?1:0}">
      <div class="sw-sprite" id="sw-sprite"><div id="sw-sheet"></div></div>
      <div class="sw-emote" id="sw-emote"></div>
      <div class="sw-bubble" id="sw-bubble"><span id="sw-bubble-text"></span>${SW_SVG.tail}</div>
      <div class="sw-save" id="sw-save">${SW_SVG.floppy}<span id="sw-save-text"></span></div>
    </div>`;
  G.viewport.appendChild(win);
  G.swEl=win;
  /* 精灵帧宽自适应：素材载入后按 naturalWidth/6 校正（占位图/正式图均适配，无需改代码） */
  const probe=new Image();
  probe.onload=()=>{
    if(!G.swEl)return;
    const fw=probe.naturalWidth/SW_SPR_FRAMES, fh=probe.naturalHeight;
    SW_SPR_W=fw; SW_SPR_H=fh;
    const sheet=G.swEl.querySelector('#sw-sheet');
    const spr=G.swEl.querySelector('#sw-sprite');
    if(sheet){sheet.style.width=fw+'px';sheet.style.height=fh+'px';}
    if(spr){spr.style.marginLeft=(-fw/2)+'px';}
  };
  probe.src='game/story_sprites.png';
  ensureObs();
  G.swFrame=0;
  storyWinMood('calm');
  /* 双 rAF 后加 .show —— 与 Tea 面板相同的淡入触发方式 */
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{win.classList.add('show');});});
}

/* ── 关窗（endAiGame 调用）：清全部定时器与观察者，淡出后移除 ── */
function closeStoryWindow(){
  if(G.swFrameTimer){clearInterval(G.swFrameTimer);G.swFrameTimer=null;}
  if(G.swBubbleTimer){clearInterval(G.swBubbleTimer);G.swBubbleTimer=null;}
  if(G.swSaveTimer){clearTimeout(G.swSaveTimer);G.swSaveTimer=null;}
  if(G.swEmoteTimer){clearTimeout(G.swEmoteTimer);G.swEmoteTimer=null;}
  if(G.swThemeObs){G.swThemeObs.disconnect();G.swThemeObs=null;}
  G.swMood='calm';G.swFrame=0;
  const win=G.swEl;
  G.swEl=null;
  if(!win)return;
  win.classList.remove('show');
  setTimeout(()=>{if(win&&!win.classList.contains('show'))win.remove();},600);
}

/* ── 昼夜切换：双图层交叉渐隐（跟随 body.theme-infernal） ── */
function storyWinApplyTheme(){
  if(!G.swEl)return;
  const night=document.body.classList.contains('theme-infernal');
  const d=G.swEl.querySelector('#sw-bg-day');
  const n=G.swEl.querySelector('#sw-bg-night');
  if(d)d.style.opacity=night?'0':'1';
  if(n)n.style.opacity=night?'1':'0';
}

/* ── 帧循环：按当前情绪的帧间隔循环 1-6 帧 ── */
function storyWinStartFrames(){
  if(!G.swEl)return;
  if(G.swFrameTimer){clearInterval(G.swFrameTimer);G.swFrameTimer=null;}
  const sheet=G.swEl.querySelector('#sw-sheet');
  if(!sheet)return;
  const ms=SW_MOOD_MS[G.swMood]||SW_MOOD_MS.calm;
  G.swFrameTimer=setInterval(()=>{
    G.swFrame=(G.swFrame+1)%SW_SPR_FRAMES;
    sheet.style.backgroundPosition=(G.swFrame*20)+'% 0'; /* 6帧→每帧步进20%，与素材实际像素宽无关 */
  },ms);
}

/* ── 情绪切换：换帧速 + 重触发位移动画 + 弹头顶表情（calm 不弹） ── */
function storyWinMood(m){
  if(!G.swEl)return;
  if(SW_MOODS.indexOf(m)<0)m='calm'; /* 非法/缺失值兜底 */
  G.swMood=m;
  const spr=G.swEl.querySelector('#sw-sprite');
  if(spr){
    spr.className='sw-sprite';
    void spr.offsetWidth; /* 强制重排：同情绪连续触发也能重播动画 */
    spr.classList.add('sw-mood-'+m);
  }
  storyWinStartFrames();
  if(m!=='calm')storyWinShowEmote(m,(m==='tense'||m==='sad')?2600:2000);
}

/* ── 头顶像素表情气泡：pop 弹出，定时自动收起 ── */
function storyWinShowEmote(kind,dur){
  if(!G.swEl)return;
  const em=G.swEl.querySelector('#sw-emote');
  if(!em)return;
  if(G.swEmoteTimer){clearTimeout(G.swEmoteTimer);G.swEmoteTimer=null;}
  em.className='sw-emote';
  void em.offsetWidth; /* 重触发 pop 动画 */
  em.innerHTML=SW_SVG[kind]||'';
  em.classList.add('show','sw-emote-'+kind);
  G.swEmoteTimer=setTimeout(()=>{
    em.className='sw-emote';em.innerHTML='';G.swEmoteTimer=null;
  },dur||2000);
}

/* ── “......”打字机气泡：150ms逐点 → 满字停4拍 → 清空重播，直到下一句对话 ── */
function storyWinBubbleStart(){
  if(!G.swEl)return;
  if(G.swBubbleTimer)return; /* 已在播放：保持节奏，不重置 */
  const bub=G.swEl.querySelector('#sw-bubble');
  const txt=G.swEl.querySelector('#sw-bubble-text');
  if(!bub||!txt)return;
  bub.classList.add('show');
  const DOTS='......';
  let i=0, hold=0;
  txt.textContent='';
  G.swBubbleTimer=setInterval(()=>{
    if(i<DOTS.length){i++;txt.textContent=DOTS.slice(0,i);}
    else if(hold<4){hold++;}
    else{i=0;hold=0;txt.textContent='';}
  },150);
}
function storyWinBubbleStop(){
  if(G.swBubbleTimer){clearInterval(G.swBubbleTimer);G.swBubbleTimer=null;}
  if(!G.swEl)return;
  const bub=G.swEl.querySelector('#sw-bubble');
  if(bub)bub.classList.remove('show');
}

/* ── 存档演出：'saving'=SAVING…+软盘闪烁 / 'ok'=SAVE OK!反色闪两下 /
       'fail'=SAVE FAIL红字抖动 / null=立即隐藏 ── */
function storyWinSave(state){
  if(!G.swEl)return;
  const sv=G.swEl.querySelector('#sw-save');
  const tx=G.swEl.querySelector('#sw-save-text');
  if(!sv||!tx)return;
  if(G.swSaveTimer){clearTimeout(G.swSaveTimer);G.swSaveTimer=null;}
  if(!state){sv.className='sw-save';return;}
  if(state==='saving'){
    tx.textContent='SAVING';
    sv.className='sw-save show saving';
  }else if(state==='ok'){
    tx.textContent='SAVE OK!';
    sv.className='sw-save show ok';
    G.swSaveTimer=setTimeout(()=>{sv.className='sw-save';G.swSaveTimer=null;},1600);
  }else if(state==='fail'){
    tx.textContent='SAVE FAIL';
    sv.className='sw-save show fail';
    G.swSaveTimer=setTimeout(()=>{sv.className='sw-save';G.swSaveTimer=null;},2600);
  }
}

/* ── 报错演出：停气泡 → 头顶红“！” → 精灵 shock 跳起 ── */
function storyWinError(){
  if(!G.swEl)return;
  storyWinBubbleStop();
  storyWinShowEmote('err',2600);
  const spr=G.swEl.querySelector('#sw-sprite');
  if(spr){
    spr.className='sw-sprite';
    void spr.offsetWidth;
    spr.classList.add('sw-mood-shock');
  }
}

})();
