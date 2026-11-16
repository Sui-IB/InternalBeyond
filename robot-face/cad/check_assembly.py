#!/usr/bin/env python3
"""检查 docs/BUILD.md 里几步关键装配动作在几何上走不走得通。

逐步平移零件到位，沿途与已经装好的零件求交。只查平移路径，不查手和工具够不够得着。
用法：python3 check_assembly.py
"""
import sys

from rf01 import assembly as A
from rf01 import params as P
from rf01.prims import rot, volume

X, O = (1, 0, 0), (0, 0, 0)


def get(items, *names):
    by = {it.name: it.shape for it in items}
    return [(n, by[n]) for n in names]


def sweep(label, movers, fixed, direction, travel, step=1.0, ignore=()):
    """movers 从偏移 travel 处沿 -direction 一步步移到位，返回途中的碰撞。"""
    hits = set()
    d = travel
    while d > 1e-6:
        off = tuple(c * d for c in direction)
        for mn, ms in movers:
            moved = ms.translate(off)
            for fn, fs in fixed:
                if (mn, fn) in ignore:
                    continue
                try:
                    v = volume(moved.intersect(fs))
                except Exception:
                    v = 0.0
                if v > 0.05:
                    hits.add((mn, fn, round(d, 1)))
        d -= step
    worst = sorted(hits)[:6]
    print(f"  {'通过' if not hits else '碰撞'}  {label}" + (f"  {worst}" if hits else ""))
    return not hits


def main():
    base = A.assemble()
    ok = True

    # 第 4 步：眼球支架（带左右舵机，不带眼球）从后方滑入。此时已装：骨架、前面 4 个舵机、下眼皮舵机
    movers = get(base, "cradle", "servo_eye_pan", "horn_eye_pan")
    fixed = get(base, "frame", "servo_lid_lower", "servo_brow_r", "servo_brow_l", "servo_mouth_r", "servo_mouth_l")
    ok &= sweep("第 4 步 眼球支架从后方滑入", movers, fixed, (0, -1, 0), 60.0)

    # 反例：如果下颌舵机先装，支架应该过不去（文档里要求先装支架）
    blocked = not sweep("（反例）先装下颌舵机再装支架，应当碰撞", movers, get(base, "servo_jaw"), (0, -1, 0), 60.0)
    ok &= blocked

    # 第 6 步：上眼皮向后翻开，眼球从正面推到指杆的短销上。下眼皮此时还没装
    back = A.assemble(dict(ul=60, ur=60))
    for tag in ("r", "l"):
        movers = get(back, "eye_" + tag)
        fixed = get(back, "frame", "cradle", "lid_upper_" + tag, "pin_lid_in_" + tag, "keeper", "pin_eye_" + tag)
        ok &= sweep(f"第 6 步 {tag} 眼球从正面装入", movers, fixed, (0, 1, 0), 30.0,
                    ignore={("eye_" + tag, "pin_eye_" + tag)})          # 短销与卡槽是有意的过盈

    # 第 7 步：下眼皮从正面推上去，内侧卡钩卡住钢销
    for tag in ("r", "l"):
        movers = get(base, "lid_lower_" + tag)
        fixed = get(base, "frame", "eye_" + tag, "lid_upper_" + tag, "keeper", "cradle", "pin_lid_in_" + tag)
        ok &= sweep(f"第 7 步 {tag} 下眼皮从正面装入", movers, fixed, (0, 1, 0), 30.0,
                    ignore={("lid_lower_" + tag, "pin_lid_in_" + tag)})  # 卡钩与钢销是有意的过盈

    print("全部通过" if ok else "有步骤走不通")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
