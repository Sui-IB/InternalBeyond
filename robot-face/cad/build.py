#!/usr/bin/env python3
"""生成 RF-01 的全部输出：打印用 STL、装配 STEP、连杆行程表、干涉检查报告。

用法：  pip install cadquery   然后   python3 build.py [--no-check]
输出在 out/ 下。改尺寸请编辑 rf01/params.py。
"""
import json
import os
import sys
import time

import cadquery as cq

from rf01 import assembly as A
from rf01 import params as P
from rf01 import parts as Q
from rf01.prims import rot, volume

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
X, O = (1, 0, 0), (0, 0, 0)

# 名称: (建模函数, 数量, 打印摆放说明, 摆放变换)
flat_front_down = lambda s: rot(s, O, X, -90)      # 前表面朝下
flat_front_up = lambda s: rot(s, O, X, 90)         # 前表面朝上
flip = lambda s: rot(s, O, (0, 1, 0), 180)         # 倒扣
PRINTED = {
    "frame":         (Q.frame, 1, "前板正面贴平台，后部结构朝上；后横梁和颈座需要支撑", flat_front_down),
    "teeth_upper":   (Q.teeth_upper, 1, "牙面朝上", flat_front_up),
    "cradle":        (Q.cradle, 1, "倒扣，顶面贴平台", flip),
    "eye_cup":       (lambda: Q.eye_cup(1), 2, "虹膜面朝下，后摆臂需要支撑；建议光固化", flat_front_down),
    "lid_upper_r":   (lambda: Q.upper_lid(1), 1, "建议光固化；FDM 需要支撑", None),
    "lid_upper_l":   (lambda: Q.upper_lid(-1), 1, "建议光固化；FDM 需要支撑", None),
    "lid_lower_r":   (lambda: Q.lower_lid(1), 1, "建议光固化；FDM 需要支撑", None),
    "lid_lower_l":   (lambda: Q.lower_lid(-1), 1, "建议光固化；FDM 需要支撑", None),
    "keeper":        (Q.keeper, 1, "平放", flat_front_up),
    "brow_lever_r":  (lambda: Q.brow_lever(1), 1, "磁铁孔朝上平放", flat_front_up),
    "brow_lever_l":  (lambda: Q.brow_lever(-1), 1, "磁铁孔朝上平放", flat_front_up),
    "mouth_lever_r": (lambda: Q.mouth_lever(1), 1, "磁铁孔朝上平放", flat_front_up),
    "mouth_lever_l": (lambda: Q.mouth_lever(-1), 1, "磁铁孔朝上平放", flat_front_up),
    "pan_arm":       (Q.pan_arm, 1, "平放", None),
    "jaw":           (Q.jaw, 1, "下巴底面贴平台，两条臂需要支撑", None),
    "stand":         (Q.stand, 1, "底板贴平台", None),
}

C, W = P.UPPER_CLOSE_DEG, P.UPPER_WIDE_DEG
CHECK_POSES = {
    "中立": {},
    "左上看+睁大+微笑+张嘴": dict(pan=25, tilt=15, ul=W, ur=W, ll=0, bl=22, br=22, ml=25, mr=25, jaw=11),
    "右下看+闭眼+皱眉+撇嘴": dict(pan=-25, tilt=-15, ul=C, ur=C, ll=25, bl=-22, br=-22, ml=-25, mr=-25, jaw=0),
    "左下看+左眼眨": dict(pan=25, tilt=-15, ul=C, ur=W, ll=25, bl=-22, br=22, ml=25, mr=-25, jaw=11),
    "右上看+右眼眨": dict(pan=-25, tilt=15, ul=W, ur=C, ll=0, bl=22, br=-22, ml=-25, mr=25, jaw=5),
    "上看+闭眼+张嘴": dict(pan=0, tilt=15, ul=C, ur=C, ll=25, jaw=11),
    "下看+睁大": dict(pan=0, tilt=-15, ul=W, ur=W, ll=0),
    "半程 A": dict(pan=12, tilt=8, ul=-35, ur=-35, ll=12, bl=10, br=10, ml=12, mr=12, jaw=6),
    "半程 B": dict(pan=-12, tilt=-8, ul=-50, ur=-20, ll=20, bl=-10, br=-10, ml=-12, mr=-12, jaw=3),
}


def export_parts():
    os.makedirs(os.path.join(OUT, "stl"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "step"), exist_ok=True)
    rows = []
    for name, (fn, qty, note, xf) in PRINTED.items():
        s = fn()
        v = s.val()
        assert v.isValid() and len(s.solids().vals()) == 1, f"{name} 不是单个有效实体"
        cq.exporters.export(s, os.path.join(OUT, "step", name + ".step"))
        ps = xf(s) if xf else s
        bb = ps.val().BoundingBox()
        ps = ps.translate((-(bb.xmin + bb.xmax) / 2, -(bb.ymin + bb.ymax) / 2, -bb.zmin))   # 落到打印平台上
        cq.exporters.export(ps, os.path.join(OUT, "stl", name + ".stl"), tolerance=0.04, angularTolerance=0.2)
        bb = ps.val().BoundingBox()
        rows.append(dict(name=name, qty=qty, volume_cm3=round(volume(s) / 1000, 2),
                         size_mm=[round(bb.xlen, 1), round(bb.ylen, 1), round(bb.zlen, 1)], print=note))
        print(f"  {name:14s} ×{qty}  {rows[-1]['volume_cm3']:6.2f} cm³  {rows[-1]['size_mm']}")
    return rows


def export_assembly():
    asm = cq.Assembly(name="RF-01")
    for it in A.assemble():
        asm.add(it.shape, name=it.name, color=cq.Color(*[int(A.COLORS[it.kind][i:i + 2], 16) / 255 for i in (1, 3, 5)]))
    asm.export(os.path.join(OUT, "step", "rf01_assembly.step"))


def linkage_table():
    out = {}
    for link, (servo, fn, mid, lo, hi) in A.LINKS.items():
        rows = []
        n = 8
        for i in range(n + 1):
            d = lo + (hi - lo) * i / n
            h = A.solve_horn(link, d)
            assert h is not None, f"{link} 在 {d}° 无解"
            rows.append(dict(output_deg=round(d, 1), horn_deg=round(h, 1),
                             transmission_deg=round(A.transmission_angle(link, d), 0)))
        out[link] = dict(rod_length_mm=round(A.rod_length(link), 2), horn_radius_mm=P.HORN_R[servo], table=rows,
                         horn_deg_at_pose0=round(A.solve_horn(link, 0.0), 1))
        worst = min(r["transmission_deg"] for r in rows)
        print(f"  {link:12s} 连杆 {out[link]['rod_length_mm']:5.2f} mm  舵盘 {rows[0]['horn_deg']:+.1f}°…{rows[-1]['horn_deg']:+.1f}°"
              f"  最差传动角 {worst:.0f}°")
        assert worst >= 30, f"{link} 传动角过小"
    return out


def check():
    report, total = {}, 0
    for name, pose in CHECK_POSES.items():
        t = time.time()
        hits = A.interferences(A.assemble(pose))
        report[name] = dict(pose=pose, hits=hits)
        total += len(hits)
        print(f"  {name:22s} {len(hits)} 处干涉 {hits if hits else ''} ({time.time() - t:.0f}s)")
    return report, total


def main():
    os.makedirs(OUT, exist_ok=True)
    print("== 导出零件 ==")
    parts = export_parts()
    print("== 连杆行程 ==")
    links = linkage_table()
    report, total = {}, None
    if "--no-check" not in sys.argv:
        print("== 干涉检查 ==")
        report, total = check()
    print("== 导出装配 STEP ==")
    export_assembly()
    json.dump(dict(parts=parts, linkage=links, interference=report, interference_total=total),
              open(os.path.join(OUT, "report.json"), "w"), ensure_ascii=False, indent=1)
    print(f"完成。干涉总数：{total}")
    return 0 if not total else 1


if __name__ == "__main__":
    sys.exit(main())
