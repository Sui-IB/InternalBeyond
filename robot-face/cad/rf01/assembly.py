"""装配、连杆求解与干涉检查。

姿态用「度」表示（不是 rig.json 里的无量纲 pose）：
  pan  眼球左右，+ 看向机器人左侧（-X）       tilt 眼球上下，+ 向上
  ul/ur 左/右上眼皮相对睁眼的转角，闭眼为负（UPPER_CLOSE_DEG）
  ll   下眼皮抬起角                       bl/br 眉毛，+ 内端上抬
  jaw  下颌张开角                         ml/mr 嘴角，+ 微笑
"""
import math
from dataclasses import dataclass, field
from . import params as P
from . import parts as Q
from .prims import cyl, rot, rot_pt, volume

X, Y, Z, O = (1, 0, 0), (0, 1, 0), (0, 0, 1), (0, 0, 0)
SIDES = ((1, "r"), (-1, "l"))        # +X 是机器人右侧
NEUTRAL = dict(pan=0, tilt=0, ul=0, ur=0, ll=0, bl=0, br=0, jaw=0, ml=0, mr=0)

COLORS = dict(frame="#c9ced6", cradle="#e8853a", eye="#f4f4f0", lid="#2fa39a", lever="#e2b93b", jaw="#7d8ca3",
              servo="#27407a", horn="#fafafa", pin="#c0392b", rod="#c0392b", stand="#4a4f57", iris="#3a7bd5", pupil="#111418")


@dataclass
class Item:
    name: str
    shape: object
    kind: str
    printed: bool = False
    skip: tuple = field(default_factory=tuple)      # 不与这些零件做干涉检查（如连杆与其两端）


_cache = {}


def part(name, fn):
    if name not in _cache:
        _cache[name] = fn()
    return _cache[name]


# ---------------------------------------------------------------- 连杆
def _dist(a, b):
    return math.dist(a, b)


def _upper_tip(side, deg):
    return rot_pt(Q.upper_arm_tip_world(side), (P.EX * side, 0, 0), X, deg)


def _lower_tip(deg):
    return rot_pt(Q.lower_arm_tip_world(), O, X, deg)


def _tilt_lug(deg):
    return rot_pt((P.TILT_LUG["x"], P.TILT_LUG["y"], 0), O, X, deg)


def _jaw_crank(deg):
    return rot_pt(Q.jaw_crank_world(), (0, *P.JAW_PIVOT), X, -deg)


LINKS = {   # 名称: (舵机, 输出端连接点函数, 设计中点角, 行程下限, 行程上限)
    "lid_upper_l": ("lid_upper_l", lambda d: _upper_tip(-1, d), (P.UPPER_CLOSE_DEG + P.UPPER_WIDE_DEG) / 2,
                    P.UPPER_CLOSE_DEG, P.UPPER_WIDE_DEG),
    "lid_upper_r": ("lid_upper_r", lambda d: _upper_tip(1, d), (P.UPPER_CLOSE_DEG + P.UPPER_WIDE_DEG) / 2,
                    P.UPPER_CLOSE_DEG, P.UPPER_WIDE_DEG),
    "lid_lower": ("lid_lower", _lower_tip, P.LOWER_RAISE_DEG / 2, 0.0, P.LOWER_RAISE_DEG),
    "eye_tilt": ("eye_tilt", _tilt_lug, 0.0, -P.EYE_TILT_MAX, P.EYE_TILT_MAX),
    "jaw": ("jaw", _jaw_crank, P.JAW_OPEN_DEG / 2, 0.0, P.JAW_OPEN_DEG),
}


def rod_length(link):
    servo, fn, mid, _, _ = LINKS[link]
    return _dist(Q.horn_tip(servo, 0.0), fn(mid))


def solve_horn(link, out_deg):
    """给定输出端角度，求舵盘相对设计中点的转角（度）。无解时返回 None。"""
    servo, fn, mid, _, _ = LINKS[link]
    L, target = rod_length(link), fn(out_deg)
    f = lambda a: _dist(Q.horn_tip(servo, a), target) - L
    best, prev = None, None
    for i in range(-900, 901):          # 0.1° 步长扫描过零点，取离 0 最近的根
        a = i / 10.0
        v = f(a)
        if prev is not None and (v == 0 or (v > 0) != (prev[1] > 0)):
            a0, v0 = prev
            root = a0 + (a - a0) * (0 - v0) / (v - v0) if v != v0 else a
            if best is None or abs(root) < abs(best):
                best = root
        prev = (a, v)
    return best


def transmission_angle(link, out_deg):
    """连杆与舵盘臂的夹角（度）。越接近 90 越好，低于 30 容易卡死。"""
    servo, fn, _, _, _ = LINKS[link]
    a = solve_horn(link, out_deg)
    if a is None:
        return None
    S = P.SERVO_POSE[servo]["S"]
    tip, tgt = Q.horn_tip(servo, a), fn(out_deg)
    zd = P.SERVO_POSE[servo]["z"]
    arm = [tip[i] - S[i] for i in range(3)]
    k = sum(arm[i] * zd[i] for i in range(3))
    arm = [arm[i] - k * zd[i] for i in range(3)]            # 投影到舵盘平面
    rod = [tgt[i] - tip[i] for i in range(3)]
    k = sum(rod[i] * zd[i] for i in range(3))
    rod = [rod[i] - k * zd[i] for i in range(3)]
    out = [fn(out_deg)[i] - fn(out_deg + 0.01)[i] for i in range(3)]      # 输出端运动方向

    def acute(u, v):
        c = sum(u[i] * v[i] for i in range(3)) / (math.hypot(*u) * math.hypot(*v))
        ang = math.degrees(math.acos(max(-1, min(1, c))))
        return min(ang, 180 - ang)

    # 连杆与舵盘臂夹角、连杆与输出端运动方向的余角，取较差的一个
    return min(acute(arm, rod), 90 - acute(out, rod))


# ---------------------------------------------------------------- 装配
def _servo_items(name, horn_extra=0.0, xform=lambda s: s):
    body, horn = part("servo:" + name, lambda: Q.servo_world(name))
    items = [Item("servo_" + name, xform(body), "servo")]
    if horn is not None:
        sp = P.SERVO_POSE[name]
        items.append(Item("horn_" + name, xform(rot(horn, sp["S"], sp["z"], horn_extra)), "horn"))
    return items


def assemble(pose=None, with_stand=True):
    p = dict(NEUTRAL, **(pose or {}))
    items = [Item("frame", part("frame", Q.frame), "frame", printed=True)]
    if with_stand:
        items.append(Item("stand", part("stand", Q.stand), "stand", printed=True))

    tilt = lambda s: rot(s, O, X, p["tilt"])
    tilt_pt = lambda q: rot_pt(q, O, X, p["tilt"])

    # 眼球支架 + 眼球 + 左右舵机
    items.append(Item("cradle", tilt(part("cradle", Q.cradle)), "cradle", printed=True))
    tabs = []
    for side, tag in SIDES:
        c = (P.EX * side, 0, 0)
        cup = rot(part("eye:" + tag, lambda s=side: Q.eye_cup(s)), c, Z, p["pan"])
        items.append(Item("eye_" + tag, tilt(cup), "eye", printed=True))
        iy = math.sqrt(P.EYE_R ** 2 - (P.IRIS_D / 2) ** 2)
        iris = rot(cyl((c[0], iy + 0.05, 0), (c[0], iy + 0.6, 0), P.IRIS_D / 2 - 0.2), c, Z, p["pan"])
        items.append(Item("iris_" + tag, tilt(iris), "iris", skip=("eye_" + tag,)))
        pupil = rot(cyl((c[0], iy + 0.6, 0), (c[0], iy + 0.75, 0), 2.2), c, Z, p["pan"])
        items.append(Item("pupil_" + tag, tilt(pupil), "pupil", skip=("eye_" + tag, "iris_" + tag)))
        items.append(Item("pin_eye_" + tag, tilt(cyl((c[0], 0, -P.EYE_PIN_HALF), (c[0], 0, P.EYE_PIN_HALF), 0.77)), "pin",
                          skip=("eye_" + tag, "cradle")))
        tabs.append(tilt_pt(rot_pt((c[0], -P.YAW_CRANK, -6.4), c, Z, p["pan"])))
    items += _servo_items("eye_pan", -p["pan"], tilt)     # 出轴朝下：绕 -Z 转 -pan 即与眼球同向
    items.append(Item("rod_tie", cyl(tabs[1], tabs[0], 0.5), "rod", skip=("eye_l", "eye_r", "horn_eye_pan")))

    # 眼皮
    for side, tag, key in ((1, "r", "ur"), (-1, "l", "ul")):
        c = (P.EX * side, 0, 0)
        lid = rot(part("upper:" + tag, lambda s=side: Q.upper_lid(s)), c, X, p[key])
        items.append(Item("lid_upper_" + tag, lid, "lid", printed=True))
        link = "lid_upper_" + tag
        a = solve_horn(link, p[key])
        items += _servo_items(link, a or 0.0)
        items.append(Item("rod_" + link, cyl(Q.horn_tip(link, a or 0.0), _upper_tip(side, p[key]), 0.5), "rod",
                          skip=("horn_" + link, "lid_upper_" + tag)))
        items.append(Item("pin_lid_" + tag, cyl((side * 33.7, 0, 0), (side * 40.0, 0, 0), 0.8), "pin",
                          skip=("frame", "lid_upper_" + tag, "lid_lower_" + tag)))
    for side, tag in SIDES:
        low = rot(part("lower:" + tag, lambda s=side: Q.lower_lid(s)), O, X, p["ll"])
        items.append(Item("lid_lower_" + tag, low, "lid", printed=True))
        items.append(Item("pin_lid_in_" + tag, cyl((side * 6.6, 0, 0), (side * 12.4, 0, 0), 0.98), "pin",
                          skip=("frame", "lid_upper_" + tag, "lid_lower_" + tag)))
    by, bz = Q.BRIDGE_YZ
    b0, b1 = rot_pt((-18.5, by, bz), O, X, p["ll"]), rot_pt((18.5, by, bz), O, X, p["ll"])
    items.append(Item("rod_bridge", cyl(b0, b1, 0.98), "rod", skip=("lid_lower_r", "lid_lower_l")))
    a = solve_horn("lid_lower", p["ll"])
    items += _servo_items("lid_lower", a or 0.0)
    items.append(Item("rod_lid_lower", cyl(Q.horn_tip("lid_lower", a or 0.0), _lower_tip(p["ll"]), 0.5), "rod",
                      skip=("horn_lid_lower", "lid_lower_r")))
    items.append(Item("teeth_upper", part("teeth", Q.teeth_upper), "frame", printed=True, skip=("frame",)))
    items.append(Item("keeper", part("keeper", Q.keeper), "lever", printed=True))

    # 俯仰
    a = solve_horn("eye_tilt", p["tilt"])
    items += _servo_items("eye_tilt", a or 0.0)
    items.append(Item("rod_eye_tilt", cyl(Q.horn_tip("eye_tilt", a or 0.0), _tilt_lug(p["tilt"]), 0.5), "rod",
                      skip=("horn_eye_tilt", "cradle")))

    # 眉毛 / 嘴角（直驱）
    for side, tag in SIDES:
        ang = side * p["b" + tag]            # +X 侧绕 +Y 正转 = 内端上抬
        items += _servo_items("brow_" + tag, ang)
        lv = rot(part("brow:" + tag, lambda s=side: Q.brow_lever(s)), (28.0 * side, 0, P.BROW_Z), Y, ang)
        items.append(Item("brow_lever_" + tag, lv, "lever", printed=True))
        ang = -side * p["m" + tag]
        items += _servo_items("mouth_" + tag, ang)
        lv = rot(part("mouth:" + tag, lambda s=side: Q.mouth_lever(s)), (10.0 * side, 0, -38.5), Y, ang)
        items.append(Item("mouth_lever_" + tag, lv, "lever", printed=True))

    # 下颌
    jp = (0, *P.JAW_PIVOT)
    items.append(Item("jaw", rot(part("jaw", Q.jaw), jp, X, -p["jaw"]), "jaw", printed=True))
    a = solve_horn("jaw", p["jaw"])
    items += _servo_items("jaw", a or 0.0)
    items.append(Item("rod_jaw", cyl(Q.horn_tip("jaw", a or 0.0), _jaw_crank(p["jaw"]), 0.5), "rod",
                      skip=("horn_jaw", "jaw")))
    for side, tag in SIDES:
        items.append(Item("pin_jaw_" + tag, cyl((side * 31.0, *P.JAW_PIVOT), (side * 38.0, *P.JAW_PIVOT), 0.98),
                          "pin", skip=("frame", "jaw")))
    return items


# ---------------------------------------------------------------- 干涉检查
def _bb(shape):
    b = shape.val().BoundingBox()
    return (b.xmin, b.xmax, b.ymin, b.ymax, b.zmin, b.zmax)


def _overlap(a, b, tol=0.0):
    return all(a[2 * i] < b[2 * i + 1] - tol and b[2 * i] < a[2 * i + 1] - tol for i in range(3))


def interferences(items, min_vol=0.02):
    """返回 [(零件A, 零件B, 相交体积 mm³)]。相交体积超过 min_vol 才算。"""
    boxes = [_bb(it.shape) for it in items]
    hits = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i], items[j]
            if b.name in a.skip or a.name in b.skip or not _overlap(boxes[i], boxes[j]):
                continue
            try:
                v = volume(a.shape.intersect(b.shape))
            except Exception:
                v = 0.0
            if v > min_vol:
                hits.append((a.name, b.name, round(v, 2)))
    return hits
