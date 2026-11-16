"""RF-01 全部尺寸参数（单位 mm、度）。

改这里的数再运行 build.py 即可重新生成全部零件。标注「待实测」的数来自常见规格，
不同批次的舵机差别很大，打印前请用卡尺量你手上的舵机并改掉。
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Servo:
    """3.7 g 级微型舵机外形（GH-S37D 一类）。局部坐标：输出轴为 +Z，轴心在壳体顶面上为原点，
    壳体长边沿 +X（轴心离近端 shaft_off）。"""
    body_l: float = 20.2      # 壳体长
    body_w: float = 8.8       # 壳体宽
    case_h: float = 17.5      # 壳体顶面到底面（待实测）
    ear_span: float = 28.0    # 安装耳总长（待实测）
    ear_t: float = 1.2        # 安装耳厚（待实测）
    ear_drop: float = 4.5     # 壳体顶面到安装耳上表面（待实测）
    shaft_off: float = 5.0    # 轴心到壳体近端（待实测）
    boss_h: float = 3.2       # 输出轴凸台高
    horn_t: float = 1.5       # 舵盘臂厚
    horn_w: float = 4.0       # 舵盘臂宽
    fit: float = 0.2          # 安装窗单边间隙
    screw_d: float = 1.2      # 安装耳自攻螺丝底孔

    @property
    def seat_z(self) -> float:          # 安装耳下表面（贴在安装面上）
        return -(self.ear_drop + self.ear_t)

    @property
    def horn_z(self) -> float:          # 舵盘臂下表面
        return self.boss_h


SERVO = Servo()

# ---- 眼睛 ----
EYE_R = 10.0            # 眼球半径（Ø20）
IPD = 46.0              # 瞳距
EX = IPD / 2
EYE_WALL = 1.4
EYE_BACK_CUT = -4.5     # 眼球后部开口平面（y）
IRIS_D = 11.0           # 虹膜贴片/玻璃眼片凹槽直径
EYE_PIN_HALF = 4.2      # 眼球竖直短销（Ø1.6×8.4）伸出指杆上下的半长
EYE_YAW_MAX = 25.0      # 眼球左右机械行程（±度）
EYE_TILT_MAX = 15.0     # 眼球上下机械行程（±度）
YAW_CRANK = 15.0        # 眼球后摆臂与舵盘的曲柄半径（平行四边形，二者必须相等）

# ---- 眼皮（角度：在 YZ 平面内从正前方 +Y 向上 +Z 量）----
LID_GAP = 0.6
UPPER_R_IN = EYE_R + LID_GAP            # 10.6
UPPER_R_OUT = UPPER_R_IN + 1.0          # 11.6
LOWER_R_IN = UPPER_R_OUT + 0.2          # 11.8（下眼皮在上眼皮外侧，闭眼时可重叠）
LOWER_R_OUT = LOWER_R_IN + 1.0          # 12.8
UPPER_OPEN_EDGE = 45.0                  # 睁眼时上眼皮前缘角度
UPPER_BACK_EDGE = 125.0
UPPER_CLOSE_DEG = -71.0                 # pose=1（闭眼）相对睁眼的转角
UPPER_WIDE_DEG = 15.0                   # pose=-0.3（睁大）
LOWER_REST_EDGE = -28.0                 # 下眼皮上缘角度
LOWER_BACK_EDGE = -85.0
LOWER_RAISE_DEG = 25.0                  # pose=1
LID_ARM_R = 8.0                         # 上眼皮驱动臂半径
LOWER_ARM = (-8.0, -3.3)                # 下眼皮驱动臂末端 (y, z)
TAB_T = 1.0                             # 眼皮转轴耳片厚
OPENING_R = 13.6                        # 前板眼窝开孔半径

# ---- 前板与骨架 ----
PLATE_T = 3.0
PLATE_HALF_W = 40.0
PLATE_TOP = 34.0
PLATE_TAPER_Z = -14.0
PLATE_BOTTOM = -49.0
PLATE_BOTTOM_HALF_W = 28.9
WEB_HALF_W = 9.8                        # 鼻梁加厚块半宽
WEB_BACK = -4.5
SLOT_HALF_W = 5.0                       # 鼻梁中缝（眼球支架中臂穿过）
PIN_D = 2.0                             # 眼皮内侧转轴销（Ø2×6，左右各一根）
TRUNNION_D = 2.6                        # 眼球支架俯仰短轴直径（与支架一体打印）
TRUNNION_X = 6.1                        # 短轴端面位置（±）

# ---- 舵机位置：S = 轴心在壳体顶面的点，z = 出轴方向，x = 壳体长边方向 ----
SERVO_POSE = {
    "brow_r":      dict(S=(28.0, 8.7, 21.5),   z=(0, 1, 0),  x=(-1, 0, 0), horn=0),
    "brow_l":      dict(S=(-28.0, 8.7, 21.5),  z=(0, 1, 0),  x=(1, 0, 0),  horn=0),
    "mouth_r":     dict(S=(10.0, 8.7, -38.5),  z=(0, 1, 0),  x=(1, 0, 0),  horn=43),
    "mouth_l":     dict(S=(-10.0, 8.7, -38.5), z=(0, 1, 0),  x=(-1, 0, 0), horn=-43),
    "lid_upper_r": dict(S=(32.5, -18.0, 21.0), z=(1, 0, 0),  x=(0, -1, 0), horn=180),
    "lid_upper_l": dict(S=(-32.5, -18.0, 21.0), z=(-1, 0, 0), x=(0, -1, 0), horn=180),
    "lid_lower":   dict(S=(13.2, -13.0, -27.0), z=(-1, 0, 0), x=(0, -1, 0), horn=180),
    "eye_tilt":    dict(S=(-23.0, -28.0, -27.0), z=(-1, 0, 0), x=(0, -1, 0), horn=180),
    "jaw":         dict(S=(40.0, -33.0, -4.0), z=(1, 0, 0),  x=(0, -1, 0), horn=180),
    # 眼球左右舵机装在眼球支架上，随支架一起俯仰
    "eye_pan":     dict(S=(0.0, -27.0, -6.2),  z=(0, 0, -1), x=(0, -1, 0), horn=180),
}
HORN_R = {            # 各舵盘用到的孔位半径（到轴心）
    "eye_pan": YAW_CRANK, "eye_tilt": 8.0, "lid_upper_l": 10.0, "lid_upper_r": 10.0,
    "lid_lower": 5.0, "jaw": 4.5,
}

# ---- 眼球支架 ----
FINGER_HALF_W = 2.2
FINGER_HALF_H = 2.0
CROSSBAR_Y = (-17.5, -13.5)
CROSSBAR_HALF_L = 28.0
TILT_LUG = dict(x=-27.0, y=-20.0)       # 俯仰推杆连接点（曲柄半径 20）

# ---- 眉毛 / 嘴角 ----
BROW_Z = 21.5
BROW_INNER_X = 7.0
BROW_MAX_DEG = 22.0
MOUTH_CORNER = (17.5, -45.5)            # 嘴角垫片中心 (x, z)
MOUTH_MAX_DEG = 25.0

# ---- 下颌 ----
JAW_PIVOT = (-45.0, -18.0)              # (y, z)
JAW_OPEN_DEG = 11.0
JAW_CRANK_Y = -27.0
JAW_ARM_X = (35.0, 37.5)
CHIN = dict(y=(4.0, 11.0), z=(-58.0, -50.0))
TEETH_HALF_W = 14.0

# ---- 侧梁 / 底板 / 支架鳍片 ----
RAIL_X = (31.8, 34.3)
FLOOR_Z = (-38.5, -36.0)
REAR_Y = -54.0
NECK = dict(y=-32.0, r=9.0, socket_d=10.2, post_d=10.0)
