"""RF-01 零件建模。所有零件都直接建在世界坐标的「中立姿态」位置上。"""
import math
from . import params as P
from .params import SERVO as SV
from .prims import bx, cyl, sphere, prism_yz, prism_xz, wedge_x, bar_yz, bar_xz, place, wp, to_world

EAR_X0 = -SV.shaft_off - (SV.ear_span - SV.body_l) / 2
EAR_X1 = SV.body_l - SV.shaft_off + (SV.ear_span - SV.body_l) / 2


# ---------------------------------------------------------------- 舵机
def servo_local(horn_deg=None, horn_r=10.0):
    w = SV.body_w / 2
    body = bx(-SV.shaft_off, SV.body_l - SV.shaft_off, -w, w, -SV.case_h, 0)
    ears = bx(EAR_X0, EAR_X1, -w, w, SV.seat_z, -SV.ear_drop)
    s = body.union(ears).union(cyl((0, 0, 0), (0, 0, SV.boss_h), 2.3))
    horn = None
    if horn_deg is not None:
        t = math.radians(horn_deg)
        z0, z1 = SV.horn_z, SV.horn_z + SV.horn_t
        tip = (horn_r * math.cos(t), horn_r * math.sin(t))
        # 舵盘臂：XY 平面内的圆头直条
        L = horn_r
        nx, ny = -math.sin(t) * SV.horn_w / 2, math.cos(t) * SV.horn_w / 2
        import cadquery as cq
        pts = [(nx, ny), (tip[0] + nx, tip[1] + ny), (tip[0] - nx, tip[1] - ny), (-nx, -ny)]
        horn = (cq.Workplane("XY").workplane(offset=z0).polyline(pts).close().extrude(z1 - z0)
                .union(cyl((0, 0, z0), (0, 0, z1), SV.horn_w / 2 + 0.6))
                .union(cyl((tip[0], tip[1], z0), (tip[0], tip[1], z1), SV.horn_w / 2)))
    return s, horn


def servo_keepout_local():
    """骨架上要挖掉的体积：壳体窗口 + 安装耳以上的空间 + 两个自攻螺丝底孔。"""
    f, w = SV.fit, SV.body_w / 2 + SV.fit
    k = bx(-SV.shaft_off - f, SV.body_l - SV.shaft_off + f, -w, w, -SV.case_h - 1.0, 6.0)
    k = k.union(bx(EAR_X0 - f, EAR_X1 + f, -w, w, SV.seat_z, 6.0))
    for x in (EAR_X0 + 2.0, EAR_X1 - 2.0):
        k = k.union(cyl((x, 0, SV.seat_z - 6.0), (x, 0, SV.seat_z + 0.1), SV.screw_d / 2))
    return k


def servo_world(name):
    sp = P.SERVO_POSE[name]
    body, horn = servo_local(sp["horn"], P.HORN_R.get(name, 10.0))
    body = wp(place(body, sp["S"], sp["z"], sp["x"]))
    horn = wp(place(horn, sp["S"], sp["z"], sp["x"])) if horn is not None else None
    return body, horn


def servo_keepout(name):
    sp = P.SERVO_POSE[name]
    return wp(place(servo_keepout_local(), sp["S"], sp["z"], sp["x"]))


def horn_tip(name, extra_deg=0.0):
    """舵盘连杆孔在世界坐标的位置（舵盘在中立角再转 extra_deg）。"""
    sp = P.SERVO_POSE[name]
    t = math.radians(sp["horn"] + extra_deg)
    r = P.HORN_R[name]
    return to_world((r * math.cos(t), r * math.sin(t), SV.horn_z + SV.horn_t / 2), sp["S"], sp["z"], sp["x"])


# ---------------------------------------------------------------- 眼球
def eye_cup(side):
    cx, R = P.EX * side, P.EYE_R
    c = (cx, 0, 0)
    shell = sphere(c, R).cut(sphere(c, R - P.EYE_WALL))
    plug = sphere(c, R - 0.01).intersect(bx(cx - R, cx + R, 6.0, R, -R, R))        # 前部实心，给虹膜凹槽留肉
    s = shell.union(plug).cut(bx(cx - R - 1, cx + R + 1, -R - 1, P.EYE_BACK_CUT, -R - 1, R + 1))
    for sz in (1, -1):                                                              # 竖直销的上下凸台
        s = s.union(cyl((cx, 0, sz * (P.FINGER_HALF_H + 0.4)), (cx, 0, sz * (R - 0.5)), 2.0))
    # 竖直短销预先压在支架指杆上；眼球从正面推上去，凸台上向后开口的卡槽卡住短销
    s = s.cut(cyl((cx, 0, -P.EYE_PIN_HALF - 0.4), (cx, 0, P.EYE_PIN_HALF + 0.4), 0.85))
    s = s.cut(bx(cx - 0.72, cx + 0.72, -3.0, 0, -P.EYE_PIN_HALF - 0.4, P.EYE_PIN_HALF + 0.4))
    iris_y = math.sqrt(R * R - (P.IRIS_D / 2) ** 2)
    s = s.cut(cyl((cx, iris_y, 0), (cx, R + 1, 0), P.IRIS_D / 2))                   # 虹膜凹槽
    tab = bx(cx - 2.5, cx + 2.5, -(P.YAW_CRANK + 2.5), -3.0, -8.9, -7.4)            # 后摆臂（在眼球下方，避开上眼皮）
    tab = tab.cut(cyl((cx, -P.YAW_CRANK, -9.5), (cx, -P.YAW_CRANK, -7.0), 0.6))
    return s.union(tab)


# ---------------------------------------------------------------- 眼球支架（随俯仰整体转动）
def cradle():
    fw, fh = P.FINGER_HALF_W, P.FINGER_HALF_H
    y0, y1 = P.CROSSBAR_Y
    s = bx(-P.CROSSBAR_HALF_L, P.CROSSBAR_HALF_L, y0, y1, -fh, fh)
    for side in (1, -1):
        cx = P.EX * side
        s = s.union(bx(cx - fw, cx + fw, y0, 0, -fh, fh)).union(cyl((cx, 0, -fh), (cx, 0, fh), fw))
    s = s.union(bx(-4.7, 4.7, y0, 0, -2.5, 2.5)).union(cyl((-4.7, 0, 0), (4.7, 0, 0), 2.5))   # 中臂
    s = s.union(cyl((-P.TRUNNION_X, 0, 0), (P.TRUNNION_X, 0, 0), P.TRUNNION_D / 2))                # 俯仰短轴
    s = s.union(bx(-7, 7, -47.5, y0 + 0.5, -0.5, fh))                                        # 左右舵机托板
    lx = P.TILT_LUG["x"]
    s = s.union(bx(lx - 1.0, lx + 1.0, P.TILT_LUG["y"] - 2.5, y1, -fh, fh))                    # 俯仰推杆耳
    s = s.cut(servo_keepout("eye_pan"))
    s = s.cut(bx(-30, 30, -50, 5, fh, 5))                                                      # 顶面削平，方便倒扣打印
    for side in (1, -1):
        s = s.cut(cyl((P.EX * side, 0, -fh - 1), (P.EX * side, 0, fh + 1), 0.78))      # 竖直短销压入孔
    s = s.cut(cyl((lx - 2, P.TILT_LUG["y"], 0), (lx + 2, P.TILT_LUG["y"], 0), 0.6))
    return s


# ---------------------------------------------------------------- 眼皮
def _upper_arm_tip():
    mid = (P.UPPER_CLOSE_DEG + P.UPPER_WIDE_DEG) / 2          # 行程中点时驱动臂水平朝后
    a = math.radians(180 - mid)
    return (P.LID_ARM_R * math.cos(a), P.LID_ARM_R * math.sin(a))


def upper_lid(side):
    """上眼皮（睁眼姿态）。side=+1 为 +X 一侧，即机器人右眼。"""
    cx = P.EX * side
    c = (cx, 0, 0)
    s = sphere(c, P.UPPER_R_OUT).cut(sphere(c, P.UPPER_R_IN))
    s = s.intersect(wedge_x(P.UPPER_OPEN_EDGE, P.UPPER_BACK_EDGE, cx - 13, cx + 13))
    xo = sorted((cx + side * P.UPPER_R_IN, cx + side * (P.UPPER_R_IN + P.TAB_T)))
    xi = sorted((cx - side * P.UPPER_R_IN, cx - side * (P.UPPER_R_IN + P.TAB_T)))
    for x0, x1 in (xo, xi):
        s = s.union(cyl((x0, 0, 0), (x1, 0, 0), 3.0))
    tip = _upper_arm_tip()
    s = s.union(bar_yz((0, 0), tip, 3.0, xo[0], xo[1]))
    s = s.cut(cyl((cx - 13, 0, 0), (cx + 13, 0, 0), 1.1))
    s = s.cut(cyl((xo[0] - 1, tip[0], tip[1]), (xo[1] + 1, tip[0], tip[1]), 0.6))
    return s


def upper_arm_tip_world(side):
    y, z = _upper_arm_tip()
    return (P.EX * side + side * (P.UPPER_R_IN + P.TAB_T / 2), y, z)


BRIDGE_A = math.radians(-52.0)
BRIDGE_YZ = (13.6 * math.cos(BRIDGE_A), 13.6 * math.sin(BRIDGE_A))


def lower_lid(side):
    """下眼皮（放松姿态）。左右两件用一根 Ø2 钢丝（连桥）穿过筋上的孔相连，由一个舵机驱动。
    side=+1（机器人右眼）的内侧耳片带驱动臂。"""
    cx = P.EX * side
    c = (cx, 0, 0)
    s = sphere(c, P.LOWER_R_OUT).cut(sphere(c, P.LOWER_R_IN))
    s = s.intersect(wedge_x(P.LOWER_BACK_EDGE, P.LOWER_REST_EDGE, cx - 14, cx + 14))
    for sg in (1, -1):
        x0, x1 = sorted((cx + sg * P.LOWER_R_IN, cx + sg * P.LOWER_R_OUT))
        # 上眼皮耳片所在的那一层要让开转轴附近，否则两片眼皮的耳片会咬在一起
        xa, xb = sorted((cx + sg * (P.UPPER_R_IN - 0.1), cx + sg * (P.LOWER_R_IN - 0.01)))
        s = s.cut(cyl((xa, 0, 0), (xb, 0, 0), 3.4))
        s = s.union(cyl((x0, 0, 0), (x1, 0, 0), 3.0))
    by, bz = BRIDGE_YZ
    rib = cyl((side * 14.5, by, bz), (side * 17.5, by, bz), 3.2).cut(sphere(c, P.LOWER_R_IN))
    s = s.union(rib).cut(cyl((side * 14, by, bz), (side * 18, by, bz), 1.03))        # 连桥钢丝孔
    x0, x1 = sorted((cx - side * P.LOWER_R_OUT, cx - side * P.LOWER_R_IN))               # 内侧耳片
    if side > 0:                                                                     # 驱动臂从耳片下缘向后伸，让开卡槽
        s = s.union(bar_yz((0, -2.5), P.LOWER_ARM, 2.4, x0, x1))
        s = s.cut(cyl((x0 - 1, P.LOWER_ARM[0], P.LOWER_ARM[1]), (x1 + 1, P.LOWER_ARM[0], P.LOWER_ARM[1]), 0.6))
    s = s.cut(cyl((cx - 14, 0, 0), (cx + 14, 0, 0), 1.1))
    # 内侧耳片做成向后开口的卡钩：眼球装好之后，下眼皮从正面推上去卡住已经装好的钢销
    return s.cut(bx(x0 - 0.1, x1 + 0.1, -3.6, 0, -0.9, 0.9))


def lower_arm_tip_world():
    return ((P.EX - P.LOWER_R_OUT + P.EX - P.LOWER_R_IN) / 2, P.LOWER_ARM[0], P.LOWER_ARM[1])


# ---------------------------------------------------------------- 骨架
def _rail(side):
    x0, x1 = sorted((side * P.RAIL_X[0], side * P.RAIL_X[1]))
    pts = [(0, -30), (0, -15), (-21, -15), (-21, 3), (P.REAR_Y, 3), (P.REAR_Y, P.FLOOR_Z[0]),
           (-10, P.FLOOR_Z[0]), (-10, -30)]
    return prism_yz(pts, x0, x1)


def frame():
    hw, bw = P.PLATE_HALF_W, P.PLATE_BOTTOM_HALF_W
    plate = prism_xz([(hw, P.PLATE_TOP), (hw, P.PLATE_TAPER_Z), (bw, P.PLATE_BOTTOM), (-bw, P.PLATE_BOTTOM),
                      (-hw, P.PLATE_TAPER_Z), (-hw, P.PLATE_TOP)], 0, P.PLATE_T)
    s = plate
    s = s.union(bx(-P.WEB_HALF_W, P.WEB_HALF_W, P.WEB_BACK, 0.1, -14, 14))          # 鼻梁加厚块
    s = s.union(bx(-4.2, 4.2, -10, 0.1, P.FLOOR_Z[0], -20))                          # 鼻中脊
    s = s.union(bx(-P.RAIL_X[1], P.RAIL_X[1], P.REAR_Y, -10, *P.FLOOR_Z))            # 底板（上颚）
    s = s.union(bx(-P.RAIL_X[1], P.RAIL_X[1], P.REAR_Y, P.REAR_Y + 3, P.FLOOR_Z[0], -30))   # 后横梁
    for side in (1, -1):
        s = s.union(_rail(side))
        xa, xb = sorted((side * 10, side * 34))
        s = s.union(bx(xa, xb, -38.5, 0.1, 28, 30.5))                                # 顶部横条
        xa, xb = sorted((side * 24.3, side * 26.8))
        s = s.union(bx(xa, xb, -38.5, -9.2, 14.3, 28.1))                             # 上眼皮舵机鳍片
    s = s.union(bx(18.9, 21.4, -34.0, -9.3, -36.1, -20))                             # 下眼皮舵机鳍片
    s = s.union(bx(18.9, 21.4, -9.4, 0.1, -33.5, -20))                               # ……前伸到前板（嘴角舵机上方）
    s = s.union(bx(-17.3, -14.8, -48.5, -18, -36.1, -20))                            # 俯仰舵机鳍片
    ny = P.NECK["y"]
    s = s.union(cyl((0, ny, -52), (0, ny, P.FLOOR_Z[0] + 0.1), P.NECK["r"]))        # 颈座

    for side in (1, -1):
        s = s.cut(cyl((P.EX * side, -1, 0), (P.EX * side, P.PLATE_T + 1, 0), P.OPENING_R))   # 眼窝
        s = s.cut(cyl((side * 36.0, 0, 0), (side * 41.0, 0, 0), 0.85))                         # 眼皮外侧转轴螺丝孔
        yj, zj = P.JAW_PIVOT
        s = s.cut(cyl((side * 30, yj, zj), (side * 36, yj, zj), 1.0))                          # 下颌转轴孔
    s = s.cut(bx(-P.SLOT_HALF_W, P.SLOT_HALF_W, P.WEB_BACK - 0.1, P.PLATE_T + 0.1, -5.5, 5.5))  # 鼻梁中缝
    s = s.cut(cyl((-13, 0, 0), (13, 0, 0), P.PIN_D / 2))                                         # 主轴销孔
    g = P.TRUNNION_D / 2 + 0.05
    for side in (1, -1):                                                                          # 俯仰短轴导槽（向后开口）
        xa, xb = sorted((side * (P.SLOT_HALF_W - 0.01), side * (P.TRUNNION_X + 0.4)))
        s = s.cut(bx(xa, xb, P.WEB_BACK - 0.1, 0, -g, g)).cut(cyl((xa, 0, 0), (xb, 0, 0), g))
    for z in (9.5, -9.5):
        s = s.cut(cyl((0, P.WEB_BACK - 0.1, z), (0, 0.5, z), 0.6))                                # 压板自攻螺丝底孔
    for name in ("brow_l", "brow_r", "mouth_l", "mouth_r", "lid_upper_l", "lid_upper_r",
                 "lid_lower", "eye_tilt", "jaw"):
        s = s.cut(servo_keepout(name))
    s = s.cut(cyl((0, ny, -53), (0, ny, -40), P.NECK["socket_d"] / 2))
    s = s.cut(bx(-10.15, 10.15, -0.1, P.PLATE_T + 0.1, -45.95, -44.05))                 # 上牙板插槽
    return s


def teeth_upper():
    """上牙板：单独打印，舌片插进前板的插槽后点胶。"""
    return bx(-P.TEETH_HALF_W, P.TEETH_HALF_W, P.PLATE_T, 10, -46, -43.5).union(bx(-10, 10, 0, P.PLATE_T + 0.1, -45.8, -44.2))


# ---------------------------------------------------------------- 眉毛 / 嘴角摆臂
LEVER_Y = (8.7 + SV.boss_h + SV.horn_t, 8.7 + SV.boss_h + SV.horn_t + 2.0)


def brow_lever(side):
    y0, y1 = LEVER_Y
    px, pz = 28.0 * side, P.BROW_Z
    s = cyl((px, y0, pz), (px, y1, pz), 3.6).union(bar_xz((px, pz), (P.BROW_INNER_X * side, pz), 3.2, y0, y1))
    s = s.cut(cyl((px, y0 - 1, pz), (px, y1 + 1, pz), 0.9))
    for x in (P.BROW_INNER_X * side, 17.5 * side):                     # 皮肤磁吸点 Ø3×1
        s = s.cut(cyl((x, y1 - 1.0, pz), (x, y1 + 1, pz), 1.55))
    return s


def mouth_lever(side):
    y0, y1 = LEVER_Y
    px, pz = 10.0 * side, -38.5
    cx, cz = P.MOUTH_CORNER[0] * side, P.MOUTH_CORNER[1]
    s = cyl((px, y0, pz), (px, y1, pz), 3.6).union(bar_xz((px, pz), (cx, cz), 3.2, y0, y1))
    s = s.union(cyl((cx, y0, cz), (cx, y1, cz), 3.2))
    s = s.cut(cyl((px, y0 - 1, pz), (px, y1 + 1, pz), 0.9))
    s = s.cut(cyl((cx, y1 - 1.0, cz), (cx, y1 + 1, cz), 1.55))
    return s


# ---------------------------------------------------------------- 下颌
def jaw_crank_point():
    py, pz = P.JAW_PIVOT
    ey, ez = 6.0, -54.0
    y = P.JAW_CRANK_Y
    return (y, pz + (ez - pz) * (y - py) / (ey - py))


def jaw():
    py, pz = P.JAW_PIVOT
    s = bx(-P.JAW_ARM_X[1], P.JAW_ARM_X[1], P.CHIN["y"][0], P.CHIN["y"][1], *P.CHIN["z"])
    s = s.union(bx(-P.TEETH_HALF_W, P.TEETH_HALF_W, P.CHIN["y"][0], 10, P.CHIN["z"][1] - 0.1, -47))   # 下牙
    for side in (1, -1):
        x0, x1 = sorted((side * P.JAW_ARM_X[0], side * P.JAW_ARM_X[1]))
        s = s.union(bar_yz((py, pz), (6.0, -54.0), 5.0, x0, x1))
    cy, cz = jaw_crank_point()
    s = s.union(cyl((P.JAW_ARM_X[1] - 0.1, cy, cz), (43.0, cy, cz), 2.2))                               # 推杆凸台
    s = s.cut(cyl((39.0, cy, cz), (44.0, cy, cz), 0.6))
    s = s.cut(cyl((-40, py, pz), (40, py, pz), 1.05))
    s = s.cut(cyl((0, P.CHIN["y"][1] - 1.0, -54), (0, P.CHIN["y"][1] + 1, -54), 1.55))                  # 下巴磁吸点
    return s


def jaw_crank_world():
    cy, cz = jaw_crank_point()
    return (42.5, cy, cz)


# ---------------------------------------------------------------- 支座（颈部模块之前的临时底座）
def stand():
    ny = P.NECK["y"]
    s = cyl((0, ny, -95), (0, ny, -40.5), P.NECK["post_d"] / 2)
    s = s.union(bx(-45, 45, -80, 20, -99, -95))
    s = s.union(cyl((0, ny, -95), (0, ny, -85), 9.0))
    return s.cut(cyl((0, ny, -100), (0, ny, -60), 2.5))        # 走线孔


# ---------------------------------------------------------------- 眼球左右舵机的加长摆臂
def pan_arm():
    """孔距 = YAW_CRANK 的平摆臂。原装舵盘孔距不够时，把它用螺丝/胶固定在原装舵盘上。"""
    r = P.YAW_CRANK
    s = cyl((0, 0, 0), (0, 0, 2.0), 3.6).union(bar_xz((0, 0), (r, 0), 4.0, 0, 2.0).rotate((0, 0, 0), (1, 0, 0), 90))
    s = s.cut(cyl((0, 0, -1), (0, 0, 3), 0.9)).cut(cyl((r, 0, -1), (r, 0, 3), 0.6))
    for x in (4.0, 7.0):
        s = s.cut(cyl((x, 0, -1), (x, 0, 3), 0.5))
    return s


# ---------------------------------------------------------------- 俯仰短轴压板
def keeper():
    """把眼球支架的短轴压在导槽底部的小压板，用两颗自攻螺丝固定在鼻梁背面。"""
    y0, y1 = P.WEB_BACK - 1.5, P.WEB_BACK
    s = bx(-P.WEB_HALF_W, P.WEB_HALF_W, y0, y1, -12, 12).cut(bx(-5.2, 5.2, y0 - 1, y1 + 1, -7, 7))
    g = P.TRUNNION_D / 2
    for side in (1, -1):
        xa, xb = sorted((side * (P.SLOT_HALF_W + 0.2), side * (P.TRUNNION_X + 0.2)))
        s = s.union(bx(xa, xb, y1 - 0.1, -(g + 0.15), -(g - 0.1), g - 0.1))                      # 伸进导槽的压舌
    for z in (9.5, -9.5):
        s = s.cut(cyl((0, y0 - 1, z), (0, y1 + 1, z), 0.9))
    return s
