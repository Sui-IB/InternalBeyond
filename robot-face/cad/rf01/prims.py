"""几何小工具：轴对齐方块、任意方向圆柱、球、棱柱、绕 X 轴的扇形楔。"""
import math
import cadquery as cq
from cadquery import Vector


def wp(shape):
    return cq.Workplane("XY").newObject([shape])


def bx(x0, x1, y0, y1, z0, z1):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    return wp(cq.Solid.makeBox(x1 - x0, y1 - y0, z1 - z0, Vector(x0, y0, z0)))


def cyl(p0, p1, r):
    a, b = Vector(*p0), Vector(*p1)
    d = b - a
    return wp(cq.Solid.makeCylinder(r, d.Length, a, d.normalized()))


def sphere(c, r):
    return wp(cq.Solid.makeSphere(r, Vector(*c), Vector(0, 0, 1), -90, 90, 360))


def prism_yz(pts, x0, x1):
    """(y, z) 多边形沿 X 从 x0 拉伸到 x1。"""
    x0, x1 = sorted((x0, x1))
    pl = cq.Plane(origin=(x0, 0, 0), xDir=(0, 1, 0), normal=(1, 0, 0))
    return cq.Workplane(pl).polyline(pts).close().extrude(x1 - x0)


def prism_xz(pts, y0, y1):
    """(x, z) 多边形沿 Y 从 y0 拉伸到 y1。"""
    y0, y1 = sorted((y0, y1))
    pl = cq.Plane(origin=(0, y1, 0), xDir=(1, 0, 0), normal=(0, -1, 0))
    return cq.Workplane(pl).polyline(pts).close().extrude(y1 - y0)


def wedge_x(a0, a1, x0, x1, r=60.0, centre=(0.0, 0.0)):
    """绕 X 轴的扇形楔：YZ 平面内角度从 a0 到 a1（度，自 +Y 向 +Z 量），沿 X 从 x0 到 x1。"""
    n = max(2, int(abs(a1 - a0) / 15) + 1)
    cy, cz = centre
    pts = [(cy, cz)] + [
        (cy + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
         cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
        for i in range(n + 1)
    ]
    return prism_yz(pts, x0, x1)


def bar_yz(p, q, w, x0, x1):
    """YZ 平面内从 p 到 q、宽 w 的直条（两端圆头），沿 X 厚 x0..x1。"""
    (py, pz), (qy, qz) = p, q
    L = math.hypot(qy - py, qz - pz)
    ny, nz = -(qz - pz) / L * w / 2, (qy - py) / L * w / 2
    body = prism_yz([(py + ny, pz + nz), (qy + ny, qz + nz), (qy - ny, qz - nz), (py - ny, pz - nz)], x0, x1)
    return body.union(cyl((x0, py, pz), (x1, py, pz), w / 2)).union(cyl((x0, qy, qz), (x1, qy, qz), w / 2))


def bar_xz(p, q, w, y0, y1):
    """XZ 平面内从 p 到 q、宽 w 的直条（两端圆头），沿 Y 厚 y0..y1。"""
    (px, pz), (qx, qz) = p, q
    L = math.hypot(qx - px, qz - pz)
    nx, nz = -(qz - pz) / L * w / 2, (qx - px) / L * w / 2
    body = prism_xz([(px + nx, pz + nz), (qx + nx, qz + nz), (qx - nx, qz - nz), (px - nx, pz - nz)], y0, y1)
    return body.union(cyl((px, y0, pz), (px, y1, pz), w / 2)).union(cyl((qx, y0, qz), (qx, y1, qz), w / 2))


def rot(shape, p, axis, deg):
    """绕过点 p、方向 axis 的轴按右手定则旋转 deg 度。"""
    if abs(deg) < 1e-9:
        return shape
    q = (p[0] + axis[0], p[1] + axis[1], p[2] + axis[2])
    return shape.rotate(p, q, deg)


def rot_pt(pt, p, axis, deg):
    v = Vector(*pt) - Vector(*p)
    k = Vector(*axis).normalized()
    t = math.radians(deg)
    r = v * math.cos(t) + k.cross(v) * math.sin(t) + k * (k.dot(v) * (1 - math.cos(t)))
    r = r + Vector(*p)
    return (r.x, r.y, r.z)


def place(shape, S, zdir, xdir):
    """把局部坐标（原点、+Z 出轴、+X 长边）放到世界坐标。"""
    pl = cq.Plane(origin=S, xDir=xdir, normal=zdir)
    return shape.val().moved(pl.location) if isinstance(shape, cq.Workplane) else shape.moved(pl.location)


def to_world(pt, S, zdir, xdir):
    pl = cq.Plane(origin=S, xDir=xdir, normal=zdir)
    v = pl.toWorldCoords(pt)
    return (v.x, v.y, v.z)


def volume(shape):
    try:
        return shape.val().Volume()
    except Exception:
        return sum(s.Volume() for s in shape.vals())
