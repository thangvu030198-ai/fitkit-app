"""
HYROX Race Map v2 — Blender scene builder + xuất glb cho app (TapEasy).

Chạy (CI / dòng lệnh):
    blender --background --factory-startup --python-exit-code 1 \
        --python build_scene_v2.py -- --out build/hyrox3d [--render preview|none] [--res 540]
        [--samples 24] [--engine cycles|eevee] [--gpu] [--no-blend]
Chạy trong Blender (máy anh Thắng, Blender 4.2 → 5.x):
    tab Scripting → Open build_scene_v2.py → Run Script
    (không có tham số → xuất vào thư mục "hyrox_out" cạnh file .blend / script, không render).
Kiểm phần toán học thuần (không cần Blender):
    python3 build_scene_v2.py --selftest

Cấu trúc file:
  1) LÕI PYTHON THUẦN (không import bpy): đường đua, lấy mẫu theo độ dài cung, hình học
     (lathe/capsule/hộp vát/torus/ống), bộ xương + IK chân 2 khớp, các tư thế/hoạt ảnh,
     lịch chạy cho video xem trước, camera bám, JSON cho app. → kiểm được bằng python3.
  2) PHẦN BLENDER (bpy import trong hàm): vật liệu, mesh, armature, action, NLA,
     xuất glb an toàn giữa các phiên bản, render xem trước.

Quy ước toạ độ (Blender, Z lên): nhân vật nhìn về −Y (giống chuẩn Blender/Mixamo),
bên TRÁI nhân vật là +X. glTF (Y lên): (x, y, z)_gl = (x, z, −y)_blender → nhân vật nhìn +Z.

Timeline xem trước (30 fps): marker START, S1..S8 (tới trạm), S1_DONE..S8_DONE (xong trạm), FINISH.
"""
import math
import json
import os
import sys
import argparse

# =============================================================================
# 0. HẰNG SỐ
# =============================================================================
FPS = 30
TEAL = (0.32, 0.62, 0.60)

PATH_W = 1.5          # bề rộng đường
PATH_H = 0.28         # độ dày đường
ROAD_R = 0.07         # bán kính bo cạnh đường
PAD_R = 1.2           # bán kính bục trạm
PAD_TOP = 0.025       # mặt bục cao hơn mặt đường
PAD_SHIFT = 0.55      # tâm bục lệch sang phải đường
WORK_X = 0.95         # vị trí tập: lệch phải so với tim đường
APPROACH = 1.8        # quãng (m) để rẽ dần vào / ra vị trí tập
START_S = 0.9         # vị trí vạch xuất phát (m tính từ đầu đường)

STATIONS = [
    ("01", "SKIERG", "1000 M", "Work_SkiErg"),
    ("02", "SLED PUSH", "50 M", "Work_SledPush"),
    ("03", "SLED PULL", "50 M", "Work_SledPull"),
    ("04", "BURPEE BROAD JUMPS", "80 M", "Work_Burpee"),
    ("05", "ROWING", "1000 M", "Work_Row"),
    ("06", "FARMERS CARRY", "200 M", "Work_Farmers"),
    ("07", "SANDBAG LUNGES", "100 M", "Work_Lunge"),
    ("08", "WALL BALLS", "100 REPS", "Work_WallBall"),
]
STATION_F = [0.075 + i * 0.112 for i in range(8)]
FINISH_F = 0.975

CTRL = [(-5.8, 11.5), (-1.0, 11.6), (3.8, 11.0), (5.6, 9.0), (4.0, 7.0),
        (0.0, 6.4), (-4.2, 5.6), (-5.6, 3.4), (-3.6, 1.4), (0.5, 0.8),
        (4.4, -0.2), (5.6, -2.6), (3.6, -4.6), (-0.4, -5.2), (-4.4, -6.2),
        (-5.6, -8.6), (-3.4, -10.6), (1.0, -11.2), (6.0, -11.4)]

LABEL_POS = [(-2.5, 9.1), (2.0, 9.1), (0.5, 4.1), (-3.1, 2.9),
             (-0.4, -1.8), (1.2, -3.2), (-1.9, -7.4), (1.5, -8.8)]

# ---- hoạt ảnh chạy -----------------------------------------------------------
RUN_CYCLE = 20                 # frame / chu kỳ (2 bước) @30fps = 0.667 s
STRIDE = 1.50                  # quãng đường (m) nhân vật đi được sau 1 chu kỳ Run — app dùng để đồng bộ tốc độ
RUN_BETA = 0.34                # tỉ lệ thời gian chân chạm đất trong chu kỳ
RUN_G_LAND = 0.20              # chân tiếp đất trước hông bao xa (m)
RUN_HIP_BASE = -0.068          # hạ hông khi chạy
RUN_BOB = 0.022                # biên độ nhấp nhô
RUN_LIFT = 0.26                # nhấc gót khi đưa chân
RUN_PMAX = 32.0                # độ kiễng mũi chân khi đạp (độ)
RUN_PLAND = -6.0               # mũi chân hếch khi tiếp đất

# ---- lịch video xem trước ----------------------------------------------------
PREVIEW_RUN_SPEED = 4.6        # m/s trong video xem trước
WORK_FRAMES = 54               # dừng ở trạm (video xem trước)
IDLE0 = 24
CELEB_FRAMES = 72
BLEND = 8                      # frame hoà trộn NLA
EASE_FRAC = 0.22               # tỉ lệ thời gian tăng/giảm tốc mỗi đoạn

ACTION_NAMES = ["Run", "Idle", "Celebrate"] + [s[3] for s in STATIONS]
PROPS_FOR_ACTION = {
    "Work_Row": ["Prop_RowHandle"],
    "Work_Farmers": ["Prop_KB_L", "Prop_KB_R"],
    "Work_Lunge": ["Prop_Sandbag"],
    "Work_WallBall": ["Prop_WallBall"],
}
# vật liệu (màu tuyến tính, không texture) — dùng chung cho Blender và export_pure.py
MATS = {
    "Concrete": dict(color=(0.62, 0.60, 0.57), rough=0.78),
    "Pad": dict(color=(0.50, 0.49, 0.47), rough=0.7),
    "Lane": dict(color=(0.88, 0.88, 0.86), rough=0.55, emit=(1, 1, 1), strength=0.12),
    "Teal": dict(color=TEAL, rough=0.35, emit=TEAL, strength=1.2),
    "DarkMetal": dict(color=(0.03, 0.03, 0.035), rough=0.35, metal=0.8),
    "Steel": dict(color=(0.55, 0.56, 0.58), rough=0.25, metal=1.0),
    "Rubber": dict(color=(0.015, 0.015, 0.015), rough=0.6),
    "Sandbag": dict(color=(0.10, 0.07, 0.05), rough=0.85),
    "Rope": dict(color=(0.60, 0.50, 0.30), rough=0.9),
    "CheckWhite": dict(color=(0.85, 0.85, 0.85), rough=0.6),
    "CheckBlack": dict(color=(0.01, 0.01, 0.01), rough=0.6),
    "Ring": dict(color=(0.05, 0.05, 0.05), rough=0.3, emit=TEAL, strength=0.0),
    "Skin": dict(color=(0.78, 0.78, 0.80), rough=0.45),
    "Shirt": dict(color=(0.045, 0.05, 0.055), rough=0.55),
    "Shorts": dict(color=(0.015, 0.015, 0.017), rough=0.6),
    "Shoe": dict(color=(0.86, 0.87, 0.88), rough=0.4),
    "Sole": dict(color=(0.04, 0.04, 0.04), rough=0.7),
    "Hair": dict(color=(0.02, 0.018, 0.016), rough=0.6),
    # chỉ dùng khi render
    "Floor": dict(color=(0.012, 0.012, 0.013), rough=0.9),
    "TextWhite": dict(color=(0.9, 0.9, 0.9), rough=0.5, emit=(1, 1, 1), strength=0.6),
    "TextTeal": dict(color=TEAL, rough=0.4, emit=TEAL, strength=0.9),
}

SAMPLE_SPLITS = [  # giây — split mẫu cho "Phát lại" (run, trạm, run, trạm, ...)
    270, 245, 285, 175, 295, 265, 300, 290, 305, 255, 300, 125, 310, 265, 300, 335]

# =============================================================================
# 1. TOÁN CƠ BẢN
# =============================================================================


def clamp(x, a, b):
    return a if x < a else b if x > b else x


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smootherstep(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)


def wrap_pi(a):
    while a > math.pi:
        a -= 2 * math.pi
    while a < -math.pi:
        a += 2 * math.pi
    return a


def v_add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def v_sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def v_mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def v_dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def v_cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def v_len(a):
    return math.sqrt(v_dot(a, a))


def v_norm(a):
    l = v_len(a)
    return (a[0] / l, a[1] / l, a[2] / l) if l > 1e-12 else (0.0, 0.0, 1.0)


# ---- ma trận 4x4 (list hàng) -------------------------------------------------
def m_id():
    return [[1.0, 0, 0, 0], [0, 1.0, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]


def m_mul(*ms):
    r = ms[0]
    for b in ms[1:]:
        a = r
        r = [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
    return r


def m_T(x, y, z):
    m = m_id()
    m[0][3], m[1][3], m[2][3] = x, y, z
    return m


def m_S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return [[x, 0, 0, 0], [0, y, 0, 0], [0, 0, z, 0], [0, 0, 0, 1.0]]


def m_Rx(a):
    c, s = math.cos(a), math.sin(a)
    return [[1.0, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1.0]]


def m_Ry(a):
    c, s = math.cos(a), math.sin(a)
    return [[c, 0, s, 0], [0, 1.0, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1.0]]


def m_Rz(a):
    c, s = math.cos(a), math.sin(a)
    return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1.0, 0], [0, 0, 0, 1.0]]


def m_align_z(d):
    """ma trận quay đưa trục +Z về hướng d"""
    z = v_norm(d)
    a = (1.0, 0.0, 0.0) if abs(z[0]) < 0.9 else (0.0, 1.0, 0.0)
    x = v_norm(v_cross(a, z))
    y = v_cross(z, x)
    return [[x[0], y[0], z[0], 0], [x[1], y[1], z[1], 0], [x[2], y[2], z[2], 0], [0, 0, 0, 1.0]]


def m_apply(m, p):
    x, y, z = p
    return (m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
            m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
            m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3])


def m3_inv_T(m):
    """(M3^-1)^T để biến đổi pháp tuyến"""
    a, b, c = m[0][0], m[0][1], m[0][2]
    d, e, f = m[1][0], m[1][1], m[1][2]
    g, h, i = m[2][0], m[2][1], m[2][2]
    A, B, C = (e * i - f * h), -(d * i - f * g), (d * h - e * g)
    D, E, F = -(b * i - c * h), (a * i - c * g), -(a * h - b * g)
    G, H, I = (b * f - c * e), -(a * f - c * d), (a * e - b * d)
    det = a * A + b * B + c * C
    if abs(det) < 1e-15:
        det = 1e-15
    # inverse = adj^T / det ; inverse^T = cofactor / det
    return [[A / det, B / det, C / det], [D / det, E / det, F / det], [G / det, H / det, I / det]]


def m_apply_n(m, n):
    it = m3_inv_T(m)
    return v_norm((it[0][0] * n[0] + it[0][1] * n[1] + it[0][2] * n[2],
                   it[1][0] * n[0] + it[1][1] * n[1] + it[1][2] * n[2],
                   it[2][0] * n[0] + it[2][1] * n[1] + it[2][2] * n[2]))


# ---- ma trận quay 3x3 + quaternion (cho FK / xuất thuần) ---------------------
def r3_euler(rx, ry, rz):
    """Euler XYZ kiểu Blender: R = Rz @ Ry @ Rx"""
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    return r3_mul(Rz, r3_mul(Ry, Rx))


def r3_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def r3_vec(m, v):
    return (m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2])


def r3_T(m):
    return [[m[j][i] for j in range(3)] for i in range(3)]


def q_mul(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw)


def q_euler(rx, ry, rz):
    """quaternion (w,x,y,z) của Euler XYZ (Rz@Ry@Rx)"""
    qx = (math.cos(rx / 2), math.sin(rx / 2), 0.0, 0.0)
    qy = (math.cos(ry / 2), 0.0, math.sin(ry / 2), 0.0)
    qz = (math.cos(rz / 2), 0.0, 0.0, math.sin(rz / 2))
    return q_mul(qz, q_mul(qy, qx))


def to_gl(p):
    """Blender Z-up → glTF Y-up"""
    return (p[0], p[2], -p[1])


def q_to_gl(q):
    return (q[0], q[1], q[3], -q[2])


# =============================================================================
# 2. ĐƯỜNG ĐUA (Catmull-Rom hướng tâm, tham số độ dài cung)
# =============================================================================


def catmull_rom(pts, per_seg=64, alpha=0.5):
    P = [(2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1])] + list(pts) + \
        [(2 * pts[-1][0] - pts[-2][0], 2 * pts[-1][1] - pts[-2][1])]

    def tj(ti, a, b):
        return ti + max(math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha, 1e-6)

    def lp(a, b, ta, tb, t):
        w = (t - ta) / (tb - ta) if tb - ta > 1e-12 else 0.0
        return (a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w)

    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = tj(t0, p0, p1)
        t2 = tj(t1, p1, p2)
        t3 = tj(t2, p2, p3)
        n = per_seg if i < len(P) - 3 else per_seg + 1
        for k in range(n):
            t = t1 + (t2 - t1) * k / per_seg
            A1 = lp(p0, p1, t0, t1, t)
            A2 = lp(p1, p2, t1, t2, t)
            A3 = lp(p2, p3, t2, t3, t)
            B1 = lp(A1, A2, t0, t2, t)
            B2 = lp(A2, A3, t1, t3, t)
            out.append(lp(B1, B2, t1, t2, t))
    return out


class Path2D:
    def __init__(self, ctrl=CTRL, per_seg=64):
        self.pts = catmull_rom(ctrl, per_seg)
        self.cum = [0.0]
        for a, b in zip(self.pts, self.pts[1:]):
            self.cum.append(self.cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        self.L = self.cum[-1]

    def pos(self, s):
        s = clamp(s, 0.0, self.L)
        lo, hi = 0, len(self.cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        seg = self.cum[hi] - self.cum[lo] or 1e-9
        t = (s - self.cum[lo]) / seg
        a, b = self.pts[lo], self.pts[hi]
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    def tan(self, s, e=0.2):
        a = self.pos(max(0.0, s - e))
        b = self.pos(min(self.L, s + e))
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1e-9
        return (dx / l, dy / l)

    def right(self, s):
        t = self.tan(s)
        return (t[1], -t[0])

    def heading(self, s):
        t = self.tan(s)
        return math.atan2(t[1], t[0])

    def curvature(self, s, e=0.3):
        return wrap_pi(self.heading(s + e) - self.heading(s - e)) / (2 * e)


def station_s(path):
    return [f * path.L for f in STATION_F]


def lateral(path, s, st_s=None):
    """độ lệch phải của gốc nhân vật (rẽ vào vị trí tập ở mỗi trạm)"""
    st_s = st_s if st_s is not None else station_s(path)
    w = 0.0
    for sk in st_s:
        d = abs(s - sk)
        if d < APPROACH:
            w = max(w, smootherstep(1.0 - d / APPROACH))
    return WORK_X * w


def root_xy(path, s, st_s=None):
    p = path.pos(s)
    r = path.right(s)
    lat = lateral(path, s, st_s)
    return (p[0] + r[0] * lat, p[1] + r[1] * lat)


def station_frame(path, k):
    """ma trận khung trạm k: gốc = vị trí tập, +Y = chiều đường, +X = bên phải"""
    sk = STATION_F[k] * path.L
    p = path.pos(sk)
    r = path.right(sk)
    th = path.heading(sk)
    w = (p[0] + r[0] * WORK_X, p[1] + r[1] * WORK_X, 0.0)
    return m_mul(m_T(*w), m_Rz(th - math.pi / 2)), w, th


# =============================================================================
# 3. HÌNH HỌC THUẦN (đỉnh + pháp tuyến + mặt), gom theo vật liệu
# =============================================================================


def newell(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


class Geo:
    """lưới tam giác/tứ giác + pháp tuyến từng đỉnh; mỗi mặt có tên vật liệu; mỗi đỉnh có nhóm xương"""

    def __init__(self):
        self.v, self.n, self.f, self.fm, self.vg, self.uv = [], [], [], [], [], None

    def add(self, prim, mat, xf=None, group=None):
        V, N, F = prim
        base = len(self.v)
        for p, nm in zip(V, N):
            self.v.append(m_apply(xf, p) if xf else tuple(p))
            self.n.append(m_apply_n(xf, nm) if xf else tuple(nm))
            self.vg.append(group)
        for face in F:
            idx = [base + i for i in face]
            pts = [self.v[i] for i in idx]
            fn = newell(pts)
            if v_len(fn) > 1e-14:
                avg = (sum(self.n[i][0] for i in idx), sum(self.n[i][1] for i in idx), sum(self.n[i][2] for i in idx))
                if v_dot(fn, avg) < 0:
                    idx = idx[::-1]
            self.f.append(tuple(idx))
            self.fm.append(mat)
        return self

    def extend(self, other):
        base = len(self.v)
        self.v += other.v
        self.n += other.n
        self.vg += other.vg
        self.f += [tuple(base + i for i in f) for f in other.f]
        self.fm += other.fm
        return self

    def tris(self):
        return sum(len(f) - 2 for f in self.f)


def flat_polys(polys, center=None):
    """các đa giác phẳng, đỉnh riêng từng mặt; nếu có center thì quay mặt ra xa center"""
    V, N, F = [], [], []
    for poly in polys:
        n = newell(poly)
        if center is not None:
            c = (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly), sum(p[2] for p in poly) / len(poly))
            if v_dot(n, v_sub(c, center)) < 0:
                poly = poly[::-1]
                n = v_mul(n, -1)
        n = v_norm(n)
        base = len(V)
        for p in poly:
            V.append(tuple(p))
            N.append(n)
        F.append(tuple(range(base, base + len(poly))))
    return V, N, F


def cbox(hx, hy, hz, c=0.0):
    """hộp tâm gốc, nửa kích thước hx,hy,hz, vát cạnh c"""
    if c <= 1e-6:
        P = lambda sx, sy, sz: (sx * hx, sy * hy, sz * hz)
        polys = [[P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
                 [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)],
                 [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)],
                 [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)],
                 [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)],
                 [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)]]
        return flat_polys(polys, (0, 0, 0))
    c = min(c, hx * 0.49, hy * 0.49, hz * 0.49)
    ax, ay, az = hx - c, hy - c, hz - c

    def X(sx, sy, sz):
        return (sx * hx, sy * ay, sz * az)

    def Y(sx, sy, sz):
        return (sx * ax, sy * hy, sz * az)

    def Z(sx, sy, sz):
        return (sx * ax, sy * ay, sz * hz)

    polys = []
    S = (-1, 1)
    for sx in S:
        polys.append([X(sx, -1, -1), X(sx, 1, -1), X(sx, 1, 1), X(sx, -1, 1)])
    for sy in S:
        polys.append([Y(-1, sy, -1), Y(1, sy, -1), Y(1, sy, 1), Y(-1, sy, 1)])
    for sz in S:
        polys.append([Z(-1, -1, sz), Z(1, -1, sz), Z(1, 1, sz), Z(-1, 1, sz)])
    for sy in S:            # cạnh song song X
        for sz in S:
            polys.append([Y(-1, sy, sz), Y(1, sy, sz), Z(1, sy, sz), Z(-1, sy, sz)])
    for sx in S:            # cạnh song song Y
        for sz in S:
            polys.append([X(sx, -1, sz), X(sx, 1, sz), Z(sx, 1, sz), Z(sx, -1, sz)])
    for sx in S:            # cạnh song song Z
        for sy in S:
            polys.append([X(sx, sy, -1), X(sx, sy, 1), Y(sx, sy, 1), Y(sx, sy, -1)])
    for sx in S:            # góc
        for sy in S:
            for sz in S:
                polys.append([X(sx, sy, sz), Y(sx, sy, sz), Z(sx, sy, sz)])
    return flat_polys(polys, (0, 0, 0))


def _seg_n(a, b):
    dr, dz = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dr, dz) or 1e-9
    return (dz / l, -dr / l)


def lathe(groups, n=24, a0=0.0):
    """xoay biên dạng quanh Z. groups = danh sách nhóm điểm (r, z) hoặc (r, z, nr, nz);
    mỗi nhóm là một dải bo mượt riêng (đỉnh nhân đôi ở ranh giới → cạnh sắc).
    Thứ tự điểm: đáy-trong → ra ngoài → lên → vào trong ở đỉnh (mặt hướng ra ngoài)."""
    V, N, F = [], [], []
    for g in groups:
        pts = [(p[0], p[1]) for p in g]
        rings = []
        for i, p in enumerate(g):
            if len(p) >= 4:
                nr, nz = p[2], p[3]
            elif p[0] < 1e-9:
                dr = (pts[1][0] - pts[0][0]) if i == 0 else (pts[i][0] - pts[i - 1][0])
                nr, nz = 0.0, (-1.0 if dr > 0 else 1.0)
            else:
                acc = [0.0, 0.0]
                if i > 0:
                    s = _seg_n(pts[i - 1], pts[i])
                    acc[0] += s[0]
                    acc[1] += s[1]
                if i < len(pts) - 1:
                    s = _seg_n(pts[i], pts[i + 1])
                    acc[0] += s[0]
                    acc[1] += s[1]
                l = math.hypot(*acc) or 1e-9
                nr, nz = acc[0] / l, acc[1] / l
            r, z = pts[i]
            if r < 1e-9:
                V.append((0.0, 0.0, z))
                N.append((0.0, 0.0, 1.0 if nz >= 0 else -1.0))
                rings.append([len(V) - 1] * n)
            else:
                ring = []
                for k in range(n):
                    a = a0 + 2 * math.pi * k / n
                    ca, sa = math.cos(a), math.sin(a)
                    V.append((r * ca, r * sa, z))
                    N.append((nr * ca, nr * sa, nz))
                    ring.append(len(V) - 1)
                rings.append(ring)
        for j in range(len(rings) - 1):
            A, B = rings[j], rings[j + 1]
            for k in range(n):
                q = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]]
                face = []
                for idx in q:
                    if not face or face[-1] != idx:
                        face.append(idx)
                if len(face) > 1 and face[0] == face[-1]:
                    face.pop()
                if len(face) >= 3:
                    F.append(tuple(face))
    return V, N, F


def arc_pts(cr, cz, rad, a_from, a_to, steps):
    """điểm cung tròn trong mặt (r,z) kèm pháp tuyến hướng ra"""
    out = []
    for i in range(steps + 1):
        a = math.radians(a_from + (a_to - a_from) * i / steps)
        out.append((cr + rad * math.cos(a), cz + rad * math.sin(a), math.cos(a), math.sin(a)))
    return out


def cylinder(r, h, n=24, bevel=0.0, bottom=True, top=True, bev_steps=2):
    g = []
    if bottom:
        g.append([(0.0, 0.0), (r, 0.0)])
    if bevel > 0:
        g.append([(r, 0.0, 1, 0), (r, h - bevel, 1, 0)] + arc_pts(r - bevel, h - bevel, bevel, 0, 90, bev_steps)[1:] +
                 ([(0.0, h, 0, 1)] if top else []))
    else:
        g.append([(r, 0.0), (r, h)])
        if top:
            g.append([(r, h), (0.0, h)])
    return lathe(g, n)


def disc_beveled(r, t, n=32, b=0.012):
    """đĩa tạ/bánh xe: bo cả 2 mép"""
    prof = [(0.0, 0.0, 0, -1), (r - b, 0.0, 0, -1)] + arc_pts(r - b, b, b, -90, 0, 2)[1:] + \
        arc_pts(r - b, t - b, b, 0, 90, 2) + [(0.0, t, 0, 1)]
    return lathe([prof], n)


def sphere(r, nu=16, nv=8):
    prof = [(r * math.cos(-math.pi / 2 + math.pi * k / nv), r * math.sin(-math.pi / 2 + math.pi * k / nv),
             math.cos(-math.pi / 2 + math.pi * k / nv), math.sin(-math.pi / 2 + math.pi * k / nv)) for k in range(nv + 1)]
    prof[0] = (0.0, -r, 0, -1)
    prof[-1] = (0.0, r, 0, 1)
    return lathe([prof], nu)


def capsule_prim(L, r0, r1, n=10, hr=3):
    prof = []
    for k in range(hr + 1):
        a = -math.pi / 2 + (math.pi / 2) * k / hr
        prof.append((r0 * math.cos(a), r0 * math.sin(a), math.cos(a), math.sin(a)))
    for k in range(hr + 1):
        a = (math.pi / 2) * k / hr
        prof.append((r1 * math.cos(a), L + r1 * math.sin(a), math.cos(a), math.sin(a)))
    prof[0] = (0.0, -r0, 0, -1)
    prof[-1] = (0.0, L + r1, 0, 1)
    del prof[hr + 1]  # bỏ điểm xích đạo trùng nếu r0≈r1? giữ 1 điểm nối
    return lathe([prof], n)


def capsule(p0, p1, r0, r1, n=10, hr=3):
    d = v_sub(p1, p0)
    return capsule_prim(v_len(d), r0, r1, n, hr), m_mul(m_T(*p0), m_align_z(d))


def cone(r, h, n=16):
    return lathe([[(0.0, 0.0), (r, 0.0)], [(r, 0.0), (0.0, h)]], n)


def torus(R, r, nu=48, nv=8, u0=0.0, u1=None):
    """torus quanh Z (vòng lớn nằm trong mặt XY); u0..u1 = cung mở (không nắp)"""
    closed = u1 is None
    u1 = 2 * math.pi if closed else u1
    cols = nu if closed else nu + 1
    V, N, F = [], [], []
    for i in range(cols):
        u = u0 + (u1 - u0) * i / nu
        cu, su = math.cos(u), math.sin(u)
        for j in range(nv):
            v = 2 * math.pi * j / nv
            cv, sv = math.cos(v), math.sin(v)
            V.append(((R + r * cv) * cu, (R + r * cv) * su, r * sv))
            N.append((cv * cu, cv * su, sv))
    for i in range(nu):
        i2 = (i + 1) % cols if closed else i + 1
        for j in range(nv):
            j2 = (j + 1) % nv
            F.append((i * nv + j, i2 * nv + j, i2 * nv + j2, i * nv + j2))
    return V, N, F


def tube(points, radius, n=8, caps=True):
    """ống tròn dọc polyline 3D (khung vận chuyển song song)"""
    V, N, F = [], [], []
    m = len(points)
    tans = []
    for i in range(m):
        a = points[max(0, i - 1)]
        b = points[min(m - 1, i + 1)]
        tans.append(v_norm(v_sub(b, a)))
    ref = (0.0, 0.0, 1.0) if abs(tans[0][2]) < 0.9 else (1.0, 0.0, 0.0)
    u = v_norm(v_cross(ref, tans[0]))
    rings = []
    for i in range(m):
        t = tans[i]
        u = v_norm(v_sub(u, v_mul(t, v_dot(u, t))))
        w = v_cross(t, u)
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            d = v_add(v_mul(u, math.cos(a)), v_mul(w, math.sin(a)))
            V.append(v_add(points[i], v_mul(d, radius)))
            N.append(d)
            ring.append(len(V) - 1)
        rings.append(ring)
    for i in range(m - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(n):
            F.append((A[k], B[k], B[(k + 1) % n], A[(k + 1) % n]))
    if caps:
        for i, sgn in ((0, -1.0), (m - 1, 1.0)):
            t = v_mul(tans[i], sgn)
            base = len(V)
            for k in rings[i]:
                V.append(V[k])
                N.append(t)
            F.append(tuple(range(base, base + n)))
    return V, N, F


def ground_strip(pairs, z):
    """dải phẳng trên mặt đất từ danh sách (trái, phải) 2D"""
    V, N, F = [], [], []
    for a, b in pairs:
        V += [(a[0], a[1], z), (b[0], b[1], z)]
        N += [(0, 0, 1.0), (0, 0, 1.0)]
    for i in range(len(pairs) - 1):
        F.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return V, N, F


# =============================================================================
# 4. DỰNG BẢN ĐỒ (đường, vạch kẻ, bục, thiết bị, cổng) — thuần Python
# =============================================================================


def road_rings(path, max_turn_deg=4.0, max_step=0.9):
    ss = [0.0]
    last_h = path.heading(0.0)
    s = 0.0
    while s < path.L:
        s = min(path.L, s + 0.1)
        h = path.heading(s)
        if abs(math.degrees(wrap_pi(h - last_h))) >= max_turn_deg or s - ss[-1] >= max_step or s >= path.L:
            ss.append(s)
            last_h = h
    return ss


def road_profile():
    """(u ngang, z, nu, nz) từ mép trái-đáy → mặt → mép phải-đáy (u âm = trái)"""
    w, r, H = PATH_W / 2, ROAD_R, PATH_H
    prof = [(-w, -H, -1, 0), (-w, -r, -1, 0)]
    prof += [(p[0], p[1], p[2], p[3]) for p in arc_pts(-w + r, -r, r, 180, 90, 3)[1:]]
    prof += [(p[0], p[1], p[2], p[3]) for p in arc_pts(w - r, -r, r, 90, 0, 3)]
    prof += [(w, -H, 1, 0)]
    return prof


def build_road(path):
    ss = road_rings(path)
    prof = road_profile()
    V, N, F = [], [], []
    for s in ss:
        p = path.pos(s)
        r = path.right(s)  # u dương = phải
        for (u, z, nu, nz) in prof:
            V.append((p[0] + r[0] * u, p[1] + r[1] * u, z))
            N.append((r[0] * nu, r[1] * nu, nz))
    m = len(prof)
    for i in range(len(ss) - 1):
        for j in range(m - 1):
            F.append((i * m + j, i * m + j + 1, (i + 1) * m + j + 1, (i + 1) * m + j))
    caps = []
    for i, sgn in ((0, -1.0), (len(ss) - 1, 1.0)):
        caps.append([V[i * m + j] for j in range(m)])
    road = (V, N, F)
    cap = flat_polys(caps)
    # nắp: hướng ra ngoài theo tiếp tuyến
    capV, capN, capF = cap
    t0 = path.tan(0.0)
    t1 = path.tan(path.L)
    nfix = []
    for k, face in enumerate(capF):
        want = (-t0[0], -t0[1], 0.0) if k == 0 else (t1[0], t1[1], 0.0)
        for idx in face:
            nfix.append(idx)
            capN[idx] = want
    return road, (capV, capN, capF), ss


def build_lines(path, st_s):
    """vạch viền làn (liền) + vạch giữa đứt đoạn, bỏ qua vùng bục trạm / cổng"""
    edge_u, edge_w = PATH_W / 2 - 0.13, 0.045
    ss = road_rings(path, 3.0, 0.6)
    parts = []
    for side in (-1, 1):
        pairs = []
        for s in ss:
            p, r = path.pos(s), path.right(s)
            u0, u1 = side * edge_u - edge_w / 2, side * edge_u + edge_w / 2
            pairs.append(((p[0] + r[0] * u0, p[1] + r[1] * u0), (p[0] + r[0] * u1, p[1] + r[1] * u1)))
        parts.append(ground_strip(pairs, 0.004))
    dash, gap, cw = 0.45, 0.40, 0.06
    s = START_S + 0.6
    finish_s = FINISH_F * path.L
    while s + dash < path.L - 0.4:
        near = any(abs(s + dash / 2 - sk) < PAD_R + 0.35 for sk in st_s) or abs(s + dash / 2 - finish_s) < 0.8
        if not near:
            pairs = []
            for k in range(3):
                q = s + dash * k / 2
                p, r = path.pos(q), path.right(q)
                pairs.append(((p[0] - r[0] * cw / 2, p[1] - r[1] * cw / 2), (p[0] + r[0] * cw / 2, p[1] + r[1] * cw / 2)))
            parts.append(ground_strip(pairs, 0.004))
        s += dash + gap
    return parts


def pad_prim():
    R, top, b = PAD_R, PAD_TOP, 0.05
    prof = [(R, -PATH_H, 1, 0), (R, top - b, 1, 0)] + arc_pts(R - b, top - b, b, 0, 90, 3)[1:] + [(0.0, top, 0, 1)]
    return lathe([prof], 40)


def ring_prim():
    return torus(PAD_R + 0.012, 0.045, 64, 6)


# ---- thiết bị (toạ độ khung trạm: gốc = vị trí tập, +Y trước mặt, +X phải) ----


def eq_sled(G, xf, poles=False, hook=False):
    S = lambda *m: m_mul(xf, *m)
    for sx in (-0.24, 0.24):
        G.add(cbox(0.03, 0.40, 0.03, 0.01), "Steel", S(m_T(sx, 0, 0.03)))
        G.add(tube([(sx, 0.38, 0.03), (sx, 0.46, 0.05), (sx, 0.50, 0.12)], 0.028, 8), "Steel", xf)
    G.add(cbox(0.28, 0.36, 0.025, 0.012), "DarkMetal", S(m_T(0, 0, 0.085)))
    G.add(cylinder(0.03, 0.42, 12, bottom=False), "Steel", S(m_T(0, 0, 0.11)))
    for i, z in enumerate((0.11, 0.158, 0.206)):
        G.add(disc_beveled(0.25, 0.044, 24), "Rubber", S(m_T(0, 0, z)))
    G.add(torus(0.235, 0.008, 28, 4), "Teal", S(m_T(0, 0, 0.251)))
    if poles:
        for sx in (-0.22, 0.22):
            G.add(tube([(sx, -0.30, 0.10), (sx, -0.36, 0.55), (sx, -0.42, 1.02)], 0.022, 10), "Steel", xf)
            G.add(tube([(sx, -0.385, 0.74), (sx, -0.42, 1.0)], 0.030, 10), "Rubber", xf)
    if hook:
        G.add(torus(0.045, 0.01, 16, 6), "Steel", S(m_T(0, -0.40, 0.12), m_Rx(math.pi / 2)))


def eq_kettlebell(G, xf, r=0.12):
    S = lambda *m: m_mul(xf, *m)
    prof = [(0.0, 0.0, 0, -1), (r * 0.55, 0.0, 0, -1)]
    for k in range(1, 8):
        a = -math.pi / 2 + math.radians(28) + (math.pi - math.radians(40)) * k / 8
        prof.append((r * math.cos(a), r + r * math.sin(a), math.cos(a), math.sin(a)))
    prof.append((0.0, 2 * r - 0.004, 0, 1))
    G.add(lathe([prof], 16), "DarkMetal", S(m_T(0, 0, 0.0)))
    G.add(torus(r * 0.62, r * 0.13, 16, 6, math.radians(-10), math.radians(190)), "DarkMetal",
          S(m_T(0, 0, 1.75 * r), m_Rx(math.pi / 2)))


def eq_sandbag(G, xf, mat="Sandbag"):
    S = lambda *m: m_mul(xf, *m)
    prim, m0 = capsule((-0.25, 0, 0), (0.25, 0, 0), 0.10, 0.10, 12, 3)
    G.add(prim, mat, S(m0))
    for x in (-0.12, 0.12):
        G.add(torus(0.104, 0.008, 16, 4), "Rubber", S(m_T(x, 0, 0), m_Ry(math.pi / 2)))
        G.add(torus(0.05, 0.011, 10, 5, 0, math.pi), "Rubber", S(m_T(x, 0, 0.09), m_Rx(math.pi / 2)))


def build_equipment(G, k, xf):
    S = lambda *m: m_mul(xf, *m)
    if k == 0:  # SkiErg
        G.add(cbox(0.32, 0.30, 0.02, 0.01), "DarkMetal", S(m_T(0, 0.02, 0.02)))
        G.add(cbox(0.28, 0.22, 0.035, 0.015), "DarkMetal", S(m_T(0, 0.64, 0.035)))
        G.add(cbox(0.06, 0.055, 0.97, 0.015), "DarkMetal", S(m_T(0, 0.72, 1.0)))
        G.add(disc_beveled(0.19, 0.12, 32, 0.02), "Rubber", S(m_T(-0.06, 0.66, 0.55), m_Ry(math.pi / 2)))
        G.add(torus(0.19, 0.012, 32, 5), "Teal", S(m_T(0.0, 0.66, 0.55), m_Ry(math.pi / 2)))
        G.add(cbox(0.15, 0.12, 0.05, 0.015), "DarkMetal", S(m_T(0, 0.64, 1.95)))
        for sx in (-0.10, 0.10):
            G.add(disc_beveled(0.045, 0.03, 12, 0.006), "Steel", S(m_T(sx - 0.015, 0.53, 1.92), m_Ry(math.pi / 2)))
            G.add(tube([(sx, 0.50, 1.90), (sx * 1.15, 0.46, 1.62), (sx * 1.2, 0.44, 1.48)], 0.007, 6, False), "Rubber", xf)
            G.add(cylinder(0.02, 0.13, 10, 0.006), "Rubber", S(m_T(sx * 1.2, 0.44, 1.35)))
        G.add(cbox(0.09, 0.03, 0.07, 0.01), "DarkMetal", S(m_T(0, 0.62, 1.66)))
        G.add(cbox(0.07, 0.004, 0.05), "Teal", S(m_T(0, 0.588, 1.66)))
    elif k == 1:  # Sled push
        eq_sled(G, S(m_T(0, 0.86, 0)), poles=True)
    elif k == 2:  # Sled pull + dây
        eq_sled(G, S(m_T(0, 1.18, 0), m_Rz(math.pi)), hook=True)
        rope = [(0, 0.78, 0.12), (0.0, 0.66, 0.03), (0.02, 0.45, 0.018), (0.06, 0.15, 0.018), (0.02, -0.12, 0.018),
                (-0.15, -0.30, 0.018)]
        G.add(tube(rope, 0.018, 6), "Rope", xf)
        for i, z in enumerate((0.018, 0.05)):
            G.add(torus(0.15 - 0.02 * i, 0.018, 20, 5), "Rope", S(m_T(-0.26, -0.40, z)))
    elif k == 3:  # Burpee broad jump: vạch + cọc
        for i in range(5):
            G.add(cbox(0.32, 0.018, 0.004), "Teal", S(m_T(0, 0.28 + i * 0.18, PAD_TOP + 0.004)))
        for sx in (-0.42, 0.42):
            G.add(cone(0.06, 0.16, 14), "Teal", S(m_T(sx, 1.0, PAD_TOP)))
            G.add(cone(0.06, 0.16, 14), "Teal", S(m_T(sx, 0.28, PAD_TOP)))
    elif k == 4:  # Rower
        G.add(cbox(0.045, 0.80, 0.03, 0.01), "Steel", S(m_T(0, 0.0, 0.22)))
        G.add(cbox(0.20, 0.04, 0.10, 0.015), "DarkMetal", S(m_T(0, -0.78, 0.10)))
        G.add(cbox(0.25, 0.08, 0.05, 0.015), "DarkMetal", S(m_T(0, 0.88, 0.05)))
        G.add(cbox(0.05, 0.13, 0.06, 0.015), "DarkMetal", S(m_T(0, 0.72, 0.26)))
        G.add(disc_beveled(0.26, 0.16, 36, 0.03), "DarkMetal", S(m_T(-0.08, 0.88, 0.34), m_Ry(math.pi / 2)))
        G.add(torus(0.26, 0.012, 36, 5), "Teal", S(m_T(0.0, 0.88, 0.34), m_Ry(math.pi / 2)))
        G.add(cbox(0.11, 0.12, 0.03, 0.012), "Rubber", S(m_T(0, -0.05, 0.285)))
        for sx in (-0.08, 0.08):
            G.add(cbox(0.05, 0.11, 0.01, 0.004), "Rubber", S(m_T(sx, 0.52, 0.17), m_Rx(math.radians(50))))
        G.add(tube([(0, 0.82, 0.52), (0, 0.70, 0.70), (0, 0.63, 0.78)], 0.014, 8), "Steel", xf)
        G.add(cbox(0.08, 0.02, 0.06, 0.008), "DarkMetal", S(m_T(0, 0.61, 0.80)))
        G.add(cbox(0.065, 0.004, 0.045), "Teal", S(m_T(0, 0.588, 0.80)))
    elif k == 5:  # Farmers carry: 2 tạ ấm dự phòng + vạch
        for sx in (-0.26, 0.26):
            eq_kettlebell(G, S(m_T(sx, 0.70, PAD_TOP)))
        for y in (0.35, 1.0):
            G.add(cbox(0.36, 0.015, 0.004), "Lane", S(m_T(0, y, PAD_TOP + 0.004)))
    elif k == 6:  # Sandbag lunges: vạch bước + bao cát dự phòng
        for i in range(4):
            sx = -0.18 if i % 2 == 0 else 0.18
            G.add(cbox(0.08, 0.015, 0.004), "Teal", S(m_T(sx, 0.30 + i * 0.22, PAD_TOP + 0.004)))
        eq_sandbag(G, S(m_T(0.45, 0.75, PAD_TOP + 0.10), m_Rz(math.radians(70))))
    elif k == 7:  # Wall ball
        for sx in (-0.48, 0.48):
            G.add(cbox(0.04, 0.04, 1.25, 0.012), "DarkMetal", S(m_T(sx, 0.92, 1.25)))
            G.add(cbox(0.06, 0.25, 0.02, 0.01), "DarkMetal", S(m_T(sx, 0.92, 0.02)))
        G.add(cbox(0.43, 0.03, 1.0, 0.015), "DarkMetal", S(m_T(0, 0.92, 1.35)))
        G.add(cbox(0.42, 0.006, 0.02), "Teal", S(m_T(0, 0.885, 2.20)))
        G.add(torus(0.22, 0.022, 40, 6), "Teal", S(m_T(0, 0.882, 2.20), m_Rx(math.pi / 2)))
        G.add(sphere(0.13, 16, 8), "Rubber", S(m_T(0.36, 0.50, PAD_TOP + 0.13)))
        G.add(torus(0.131, 0.01, 20, 4), "Teal", S(m_T(0.36, 0.50, PAD_TOP + 0.13)))


def build_gate(G, path, s, kind):
    p, r, th = path.pos(s), path.right(s), path.heading(s)
    xf = m_mul(m_T(p[0], p[1], 0), m_Rz(th - math.pi / 2))
    S = lambda *m: m_mul(xf, *m)
    hw = PATH_W / 2 + 0.14
    for sx in (-hw, hw):
        G.add(cylinder(0.05, 2.25, 14, 0.01), "Steel", S(m_T(sx, 0, 0)))
        G.add(cbox(0.12, 0.12, 0.03, 0.01), "DarkMetal", S(m_T(sx, 0, 0.03)))
    if kind == "start":
        G.add(cbox(hw + 0.05, 0.04, 0.16, 0.02), "Teal", S(m_T(0, 0, 2.14)))
        G.add(cbox(PATH_W / 2 - 0.02, 0.05, 0.004), "Lane", S(m_T(0, 0, 0.004)))
    else:
        n = 12
        w = 2 * (hw + 0.05) / n
        for i in range(n):
            for j in range(2):
                G.add(cbox(w / 2, 0.035, 0.08), "CheckWhite" if (i + j) % 2 == 0 else "CheckBlack",
                      S(m_T(-hw - 0.05 + w * (i + 0.5), 0, 2.06 + j * 0.16)))
        cols, rows = 8, 2
        sq = PATH_W / cols
        for rr in range(rows):
            for c in range(cols):
                G.add(cbox(sq / 2, sq / 2, 0.004), "CheckWhite" if (rr + c) % 2 == 0 else "CheckBlack",
                      S(m_T(-PATH_W / 2 + sq * (c + 0.5), (rr - 0.5) * sq + 0.5, 0.006)))
        # cờ caro bay (sóng sin tĩnh) trên cột bên phải
        px, py = hw + 0.55, 0.7
        G.add(cylinder(0.025, 2.6, 10, 0.006), "Steel", S(m_T(px, py, 0)))
        nx, ny = 6, 4
        fw, fh = 0.75, 0.48
        polys_w, polys_b = [], []
        for i in range(nx):
            for j in range(ny):
                def pt(a, b):
                    x = a / nx * fw
                    return (px + x, py + 0.05 * math.sin(x * 7.0) * (x / fw + 0.2), 2.55 - b / ny * fh)
                poly = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]
                (polys_w if (i + j) % 2 == 0 else polys_b).append(poly)
        for polys, mat in ((polys_w, "CheckWhite"), (polys_b, "CheckBlack")):
            V, N, F = flat_polys(polys)
            # mặt sau
            V2, N2, F2 = flat_polys([p[::-1] for p in polys])
            off = len(V)
            V += V2
            N += N2
            F += [tuple(off + i for i in f) for f in F2]
            G.add((V, N, F), mat, xf)


def build_map_geo(path):
    """→ (geo_static, ring_prim, ring_positions, info)"""
    G = Geo()
    st_s = station_s(path)
    road, cap, ss = build_road(path)
    G.add(road, "Concrete")
    G.add(cap, "Concrete")
    for part in build_lines(path, st_s):
        G.add(part, "Lane")
    pad = pad_prim()
    ring_pos = []
    pad_centers = []
    for k in range(8):
        xf, w, th = station_frame(path, k)
        pc = m_apply(xf, (-(WORK_X - PAD_SHIFT), 0, 0))
        pad_centers.append(pc)
        G.add(pad, "Pad", m_T(pc[0], pc[1], 0))
        ring_pos.append((pc[0], pc[1], PAD_TOP + 0.006))
        build_equipment(G, k, xf)
    build_gate(G, path, START_S, "start")
    build_gate(G, path, FINISH_F * path.L, "finish")
    return G, ring_prim(), ring_pos, {"pad_centers": pad_centers, "road_rings": len(ss)}


# =============================================================================
# 5. NHÂN VẬT: bộ xương + lưới bo tròn (skin cứng theo xương) + đạo cụ
# =============================================================================
BONES = [  # tên (kiểu Mixamo, bỏ tiền tố "mixamorig:"), cha, đầu, đuôi
    ("Hips", None, (0, 0, 0.86), (0, 0, 0.98)),
    ("Spine", "Hips", (0, 0, 0.98), (0, 0, 1.12)),
    ("Spine1", "Spine", (0, 0, 1.12), (0, 0, 1.29)),
    ("Neck", "Spine1", (0, 0, 1.29), (0, 0, 1.39)),
    ("Head", "Neck", (0, 0, 1.39), (0, 0, 1.62)),
]
for _side, _sx in (("Left", 1.0), ("Right", -1.0)):
    BONES += [
        (_side + "UpLeg", "Hips", (_sx * 0.09, 0, 0.82), (_sx * 0.09, 0, 0.44)),
        (_side + "Leg", _side + "UpLeg", (_sx * 0.09, 0, 0.44), (_sx * 0.09, 0, 0.075)),
        (_side + "Foot", _side + "Leg", (_sx * 0.09, 0, 0.075), (_sx * 0.09, -0.13, 0.02)),
        (_side + "Arm", "Spine1", (_sx * 0.20, 0, 1.265), (_sx * 0.215, 0, 0.995)),
        (_side + "ForeArm", _side + "Arm", (_sx * 0.215, 0, 0.995), (_sx * 0.225, 0, 0.755)),
        (_side + "Hand", _side + "ForeArm", (_sx * 0.225, 0, 0.755), (_sx * 0.228, 0, 0.675)),
    ]
BONE = {b[0]: b for b in BONES}
THIGH = 0.38
SHIN = 0.365
ANKLE_H = 0.075
FOOT_BALL = 0.11   # cổ chân → khớp ngón (m, phía trước)
FOOT_HEEL = 0.05   # cổ chân → gót (phía sau)


def body_parts():
    """(xương, hình, tham số, vật liệu)"""
    P = [
        ("Hips", "ell", ((0, 0, 0.875), (0.150, 0.105, 0.105)), "Shorts"),
        ("Spine", "ell", ((0, 0.005, 1.03), (0.135, 0.095, 0.115)), "Shirt"),
        ("Spine1", "ell", ((0, 0.0, 1.19), (0.170, 0.105, 0.125)), "Shirt"),
        ("Spine1", "band", ((0, 0.0, 1.165), (0.176, 0.112), 0.03), "Teal"),
        ("Neck", "cap", ((0, 0, 1.28), (0, 0, 1.42), 0.048, 0.045), "Skin"),
        ("Head", "ell", ((0, -0.008, 1.515), (0.092, 0.102, 0.115)), "Skin"),
        ("Head", "ell", ((0, 0.014, 1.552), (0.095, 0.098, 0.088)), "Hair"),
    ]
    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        P += [
            ("Spine1", "sph", ((sx * 0.185, 0, 1.255), 0.062), "Shirt"),
            (side + "UpLeg", "cap", ((sx * 0.09, 0, 0.80), (sx * 0.09, 0, 0.46), 0.072, 0.055), "Skin"),
            (side + "UpLeg", "cap", ((sx * 0.092, 0, 0.845), (sx * 0.092, 0, 0.665), 0.083, 0.075), "Shorts"),
            (side + "Leg", "cap", ((sx * 0.09, 0, 0.44), (sx * 0.09, 0, 0.10), 0.052, 0.036), "Skin"),
            (side + "Foot", "ell", ((sx * 0.09, -0.035, 0.052), (0.050, 0.115, 0.046)), "Shoe"),
            (side + "Foot", "box", ((sx * 0.09, -0.035, 0.012), (0.049, 0.112, 0.012), 0.008), "Sole"),
            (side + "Arm", "cap", ((sx * 0.20, 0, 1.27), (sx * 0.207, 0, 1.15), 0.062, 0.058), "Shirt"),
            (side + "Arm", "cap", ((sx * 0.20, 0, 1.25), (sx * 0.215, 0, 1.0), 0.047, 0.040), "Skin"),
            (side + "ForeArm", "cap", ((sx * 0.215, 0, 0.995), (sx * 0.225, 0, 0.77), 0.040, 0.032), "Skin"),
            (side + "ForeArm", "band", ((sx * 0.224, 0, 0.79), (0.036, 0.036), 0.03), "Teal"),
            (side + "Hand", "ell", ((sx * 0.227, 0, 0.712), (0.028, 0.040, 0.050)), "Skin"),
        ]
    return P


def build_runner_geo():
    G = Geo()
    for bone, kind, a, mat in body_parts():
        if kind == "ell":
            c, r = a
            G.add(sphere(1.0, 12, 7), mat, m_mul(m_T(*c), m_S(*r)), bone)
        elif kind == "sph":
            c, r = a
            G.add(sphere(r, 10, 6), mat, m_T(*c), bone)
        elif kind == "cap":
            p0, p1, r0, r1 = a
            prim, xf = capsule(p0, p1, r0, r1, 10, 3)
            G.add(prim, mat, xf, bone)
        elif kind == "band":
            c, (rx, ry), h = a
            prof = [(0.97, -h / 2, 0.6, -0.8), (1.0, 0.0, 1, 0), (0.97, h / 2, 0.6, 0.8)]
            G.add(lathe([prof], 14), mat, m_mul(m_T(*c), m_S(rx, ry, 1.0)), bone)
        elif kind == "box":
            c, h, ch = a
            G.add(cbox(h[0], h[1], h[2], ch), mat, m_T(*c), bone)
    return G


# =============================================================================
# 6. TƯ THẾ → GÓC XƯƠNG (IK chân 2 khớp) + FK để kiểm
# =============================================================================
# Quy ước tham số tư thế (độ / mét, mặc định 0):
#   hip_side (trái +), hip_fwd (trước +), hip_up       — dời xương Hips
#   pel_pitch (cúi +), pel_roll (nghiêng trái +), pel_yaw (xoay trái +)  — xoay Hips
#   sp_*, ch_* (Spine, Spine1), neck_pitch, head_pitch/yaw/roll
#   {L,R}_ff, _fz, _fp, _fs : mục tiêu cổ chân (trước, cao, góc mũi chân xuống +, lệch ra ngoài)
#   {L,R}_sh : góc cánh tay so với phương thẳng đứng THẾ GIỚI (đưa trước +, 180 = giơ thẳng)
#   {L,R}_abd (dang ra +), _tw (xoay trong +), _el (gập khuỷu +), _wr (gập cổ tay +)
PARAMS = ["hip_side", "hip_fwd", "hip_up", "pel_pitch", "pel_roll", "pel_yaw", "sp_pitch", "sp_roll", "sp_yaw",
          "ch_pitch", "ch_roll", "ch_yaw", "neck_pitch", "head_pitch", "head_yaw", "head_roll"]
for _s in "LR":
    PARAMS += [_s + "_ff", _s + "_fz", _s + "_fp", _s + "_fs", _s + "_sh", _s + "_abd", _s + "_tw", _s + "_el", _s + "_wr"]
BASE_POSE = {k: 0.0 for k in PARAMS}
BASE_POSE.update({"L_fz": ANKLE_H, "R_fz": ANKLE_H, "L_sh": 4, "R_sh": 4, "L_abd": 5, "R_abd": 5, "L_el": 12, "R_el": 12})

IK_STATS = {"clamped": 0, "solves": 0}


def _leg_ik(hip_f, hip_z, tgt_f, tgt_z):
    a, b = THIGH, SHIN
    dx, dz = tgt_f - hip_f, hip_z - tgt_z
    d = math.hypot(dx, dz)
    IK_STATS["solves"] += 1
    dmax = (a + b) * 0.9995
    if d > dmax:
        IK_STATS["clamped"] += 1
        d = dmax
    d = max(d, abs(a - b) + 1e-3)
    al = math.atan2(dx, dz)
    g1 = math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1))
    g2 = math.acos(clamp((b * b + d * d - a * a) / (2 * b * d), -1, 1))
    return al + g1, al - g2  # góc đùi, góc cẳng (so với phương thẳng đứng xuống, trước +)


def q_arm(flex_rot, abd_rot, tw_rot):
    """cánh tay: xoay dọc trục (Z) trước, rồi dang (Y), rồi gập/đưa trước (X): R = Rx·Ry·Rz"""
    qx = (math.cos(flex_rot / 2), math.sin(flex_rot / 2), 0.0, 0.0)
    qy = (math.cos(abd_rot / 2), 0.0, math.sin(abd_rot / 2), 0.0)
    qz = (math.cos(tw_rot / 2), 0.0, 0.0, math.sin(tw_rot / 2))
    return q_mul(qx, q_mul(qy, qz))


def tiptoe(p_deg):
    """độ cao cổ chân khi kiễng gót p độ, khớp ngón chạm đất"""
    return _foot_track(0.0, p_deg, "ball")[1]


def solve_pose(P):
    """→ (rot: {xương: quaternion (w,x,y,z) quay quanh trục khung nhân vật, tương đối cha}, hips_offset)"""
    R = math.radians
    rot = {}
    off = (P["hip_side"], -P["hip_fwd"], P["hip_up"])
    pel = (R(P["pel_pitch"]), R(P["pel_roll"]), R(P["pel_yaw"]))
    rot["Hips"] = q_euler(*pel)
    sp = (R(P["sp_pitch"]), R(P["sp_roll"]), R(P["sp_yaw"]))
    ch = (R(P["ch_pitch"]), R(P["ch_roll"]), R(P["ch_yaw"]))
    rot["Spine"] = q_euler(*sp)
    rot["Spine1"] = q_euler(*ch)
    rot["Neck"] = q_euler(R(P["neck_pitch"]), 0.0, 0.0)
    rot["Head"] = q_euler(R(P["head_pitch"]), R(P["head_roll"]), R(P["head_yaw"]))
    pitch_sum = pel[0] + sp[0] + ch[0]
    Rh = r3_euler(*pel)
    hips_head = v_add(BONE["Hips"][2], off)
    for s, side, sgn in (("L", "Left", 1.0), ("R", "Right", -1.0)):
        hip_rest = BONE[side + "UpLeg"][2]
        hj = v_add(hips_head, r3_vec(Rh, v_sub(hip_rest, BONE["Hips"][2])))
        hip_f, hip_z = -hj[1], hj[2]
        phi_t, phi_s = _leg_ik(hip_f, hip_z, P[s + "_ff"], P[s + "_fz"])
        tgt_x = sgn * (abs(hip_rest[0]) + P[s + "_fs"])
        lat_out = (tgt_x - hj[0]) * sgn
        ab = math.atan2(lat_out, max(0.05, hip_z - P[s + "_fz"]))
        rot[side + "UpLeg"] = q_euler(-phi_t - pel[0], -sgn * ab - pel[1], 0.0)
        rot[side + "Leg"] = q_euler(phi_t - phi_s, 0.0, 0.0)
        rot[side + "Foot"] = q_euler(R(P[s + "_fp"]) + phi_s, sgn * ab, 0.0)
        sh = R(P[s + "_sh"])
        rot[side + "Arm"] = q_arm(-(sh + pitch_sum), -sgn * R(P[s + "_abd"]), -sgn * R(P[s + "_tw"]))
        rot[side + "ForeArm"] = q_euler(-R(P[s + "_el"]), 0.0, 0.0)
        rot[side + "Hand"] = q_euler(-R(P[s + "_wr"]), 0.0, 0.0)
    return rot, off


def q_to_r3(q):
    w, x, y, z = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def fk(rot, off):
    """→ (đầu xương thế giới, ma trận quay thế giới) theo đúng cách Blender ghép pose"""
    head, wR = {}, {}
    for name, parent, h, t in BONES:
        Rl = q_to_r3(rot.get(name, (1.0, 0.0, 0.0, 0.0)))
        if parent is None:
            head[name] = v_add(h, off)
            wR[name] = Rl
        else:
            ph = BONE[parent][2]
            head[name] = v_add(head[parent], r3_vec(wR[parent], v_sub(h, ph)))
            wR[name] = r3_mul(wR[parent], Rl)
    return head, wR


def foot_points(head, wR, side):
    fh = BONE[side + "Foot"][2]
    pts = {}
    for nm, p in (("heel", (fh[0], FOOT_HEEL, 0.0)), ("ball", (fh[0], -FOOT_BALL, 0.0)), ("toe", (fh[0], -0.15, 0.005))):
        pts[nm] = v_add(head[side + "Foot"], r3_vec(wR[side + "Foot"], v_sub(p, fh)))
    return pts


def bone_point(head, wR, bone, p_rest):
    return v_add(head[bone], r3_vec(wR[bone], v_sub(p_rest, BONE[bone][2])))


# ---- nội suy khoá tư thế (Hermite tuần hoàn, kẹp ở cực trị = auto-clamped) ---------


def interp_keys(keys, N, frame, base=None):
    """keys: [(frame, {param: value}, tension)] ; vòng lặp chu kỳ N (khung N ≡ khung 0)"""
    base = dict(BASE_POSE if base is None else base)
    full = []
    for fr, d, *rest in keys:
        p = dict(base)
        p.update(d)
        full.append((float(fr), p, rest[0] if rest else 1.0))
    full.sort(key=lambda x: x[0])
    n = len(full)
    t = frame % N
    i = n - 1
    for j in range(n):
        if full[j][0] <= t:
            i = j
    j = (i + 1) % n
    t0 = full[i][0]
    t1 = full[j][0] + (N if j <= i else 0)
    if t < t0:
        t += N
    dt = max(t1 - t0, 1e-6)
    u = (t - t0) / dt

    def tang(k, key):
        kp, kn = (k - 1) % n, (k + 1) % n
        tp = full[kp][0] - (N if kp >= k else 0)
        tn = full[kn][0] + (N if kn <= k else 0)
        tk = full[k][0]
        pv, cv, nv = full[kp][1][key], full[k][1][key], full[kn][1][key]
        d0 = (cv - pv) / max(tk - tp, 1e-6)
        d1 = (nv - cv) / max(tn - tk, 1e-6)
        if d0 * d1 <= 0:
            return 0.0
        return 0.5 * (d0 + d1) * full[k][2]

    h00 = 2 * u ** 3 - 3 * u ** 2 + 1
    h10 = u ** 3 - 2 * u ** 2 + u
    h01 = -2 * u ** 3 + 3 * u ** 2
    h11 = u ** 3 - u ** 2
    out = {}
    for key in PARAMS:
        p0, p1 = full[i][1][key], full[j][1][key]
        out[key] = h00 * p0 + h10 * dt * tang(i, key) + h01 * p1 + h11 * dt * tang(j, key)
    return out


# ---- chu kỳ chạy (quỹ đạo bàn chân → IK, chân trụ không trượt) ---------------------


def _foot_track(g, pitch_deg, pivot):
    """vị trí cổ chân khi điểm tì (gót/khớp ngón) trên mặt đất; g = hình chiếu cổ chân khi bàn chân phẳng"""
    p = math.radians(pitch_deg)
    if pivot == "ball":
        C, c = g + FOOT_BALL, (FOOT_BALL, -ANKLE_H)
    else:
        C, c = g - FOOT_HEEL, (-FOOT_HEEL, -ANKLE_H)
    rf = c[0] * math.cos(p) + c[1] * math.sin(p)
    rz = -c[0] * math.sin(p) + c[1] * math.cos(p)
    return C - rf, 0.0 - rz


def run_foot(ph):
    """ph: pha của 1 chân (0 = tiếp đất). → (f, z, pitch)"""
    b = RUN_BETA
    D = STRIDE * b
    if ph < b:
        tau = ph / b
        g = RUN_G_LAND - D * tau
        if tau < 0.18:
            p = RUN_PLAND * (1 - smoothstep(tau / 0.18))
            f, z = _foot_track(g, p, "heel")
        elif tau > 0.55:
            p = RUN_PMAX * smoothstep((tau - 0.55) / 0.45)
            f, z = _foot_track(g, p, "ball")
        else:
            p = 0.0
            f, z = g, ANKLE_H
        return f, z, p
    s = (ph - b) / (1 - b)
    f0, z0, p0 = run_foot(b - 1e-9)
    f1, z1, p1 = run_foot(0.0)
    m = -STRIDE * (1 - b)
    h00 = 2 * s ** 3 - 3 * s ** 2 + 1
    h10 = s ** 3 - 2 * s ** 2 + s
    h01 = -2 * s ** 3 + 3 * s ** 2
    h11 = s ** 3 - s ** 2
    f = h00 * f0 + h10 * m + h01 * f1 + h11 * m
    bump = math.sin(math.pi * (s ** 0.8)) ** 2
    z = lerp(z0, z1, smoothstep(s)) + RUN_LIFT * bump
    p = lerp(p0, p1, smootherstep(s)) + 18.0 * math.sin(math.pi * s) ** 2 * (1 - s)
    return f, z, p


def run_params(u):
    P = dict(BASE_POSE)
    b = RUN_BETA
    fL, zL, pL = run_foot(u % 1.0)
    fR, zR, pR = run_foot((u - 0.5) % 1.0)
    P.update({"L_ff": fL, "L_fz": zL, "L_fp": pL, "R_ff": fR, "R_fz": zR, "R_fp": pR})
    c2 = math.cos(4 * math.pi * (u - b / 2))
    c1 = math.cos(2 * math.pi * (u - b / 2))
    P["hip_up"] = RUN_HIP_BASE - RUN_BOB * c2
    P["hip_side"] = 0.012 * c1
    D = STRIDE * b
    w = clamp((fR - fL) / (1.15 * D), -1.2, 1.2)
    yaw = -7.0 * clamp((fL - fR) / D, -1.2, 1.2)
    P["pel_yaw"] = yaw
    P["sp_yaw"] = -0.8 * yaw
    P["ch_yaw"] = -0.8 * yaw
    P["head_yaw"] = 0.6 * yaw
    P["pel_roll"] = -3.0 * c1
    P["ch_roll"] = 1.5 * c1
    P["pel_pitch"] = 4.0
    P["sp_pitch"] = 5.0 + 1.0 * c2
    P["ch_pitch"] = 3.0
    P["neck_pitch"] = -6.0
    P["head_pitch"] = -4.0 - 1.0 * c2
    P["L_sh"] = 10 + 42 * w
    P["R_sh"] = 10 - 42 * w
    P["L_el"] = 84 + 16 * w
    P["R_el"] = 84 - 16 * w
    P["L_abd"] = P["R_abd"] = 9.0
    P["L_tw"] = P["R_tw"] = 12.0
    P["L_wr"] = P["R_wr"] = 8.0
    return P


# ---- các hoạt ảnh tập (khoá tư thế) ------------------------------------------------


def _sym(**kw):
    """L_x = R_x = v cho các khoá viết 'x'"""
    d = {}
    for k, v in kw.items():
        if k in PARAMS:
            d[k] = v
        else:
            d["L_" + k] = v
            d["R_" + k] = v
    return d


def _m(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


def action_specs():
    """{tên: (N khung, [(frame, params, tension)])}"""
    A = {}
    A["Idle"] = (60, [
        (0, _m(_sym(sh=3, el=14, abd=6), {"sp_pitch": 1.0, "hip_up": -0.012, "L_fs": 0.02, "R_fs": 0.02})),
        (30, _m(_sym(sh=5, el=12, abd=9), {"ch_pitch": -2.5, "hip_up": -0.004, "head_pitch": -2.0, "pel_roll": 1.0,
                                            "hip_side": 0.01, "L_fs": 0.02, "R_fs": 0.02})),
    ])
    A["Celebrate"] = (48, [
        (0, _m(_sym(sh=162, abd=28, el=14), {"ch_pitch": -8, "head_pitch": -14, "hip_up": -0.02})),
        (10, _m(_sym(sh=140, abd=30, el=60), {"ch_pitch": 2, "hip_up": -0.10, "pel_pitch": 8})),
        (18, _m(_sym(sh=175, abd=22, el=4, fz=tiptoe(28) + 0.12, fp=28), {"ch_pitch": -10, "head_pitch": -18, "hip_up": 0.10})),
        (26, _m(_sym(sh=150, abd=30, el=40), {"hip_up": -0.09, "pel_pitch": 6})),
        (37, _m(_sym(abd=28), {"L_sh": 150, "R_sh": 168, "L_el": 75, "R_el": 10, "ch_yaw": 8, "head_pitch": -12,
                               "hip_up": -0.02})),
    ])
    A["Work_SkiErg"] = (40, [
        (0, _m(_sym(sh=168, abd=12, el=25, fz=tiptoe(10), fp=10), {"ch_pitch": -5, "head_pitch": -6})),
        (6, _m(_sym(sh=120, abd=14, el=72), {"sp_pitch": 10, "ch_pitch": 5, "hip_up": -0.04})),
        (14, _m(_sym(sh=-12, abd=8, el=10), {"pel_pitch": 22, "sp_pitch": 18, "ch_pitch": 12, "hip_up": -0.15,
                                              "hip_fwd": -0.11, "neck_pitch": -18, "head_pitch": -10}), 0.6),
        (24, _m(_sym(sh=40, abd=10, el=30), {"pel_pitch": 12, "sp_pitch": 12, "ch_pitch": 6, "hip_up": -0.07,
                                              "hip_fwd": -0.05})),
    ])
    lean = {"pel_pitch": 38, "sp_pitch": 12, "ch_pitch": 4, "neck_pitch": -26, "head_pitch": -22, "hip_up": -0.17}
    A["Work_SledPush"] = (24, [
        (0, _m(lean, _sym(sh=70, el=35, abd=12), {"L_ff": 0.24, "L_fz": 0.19, "L_fp": 5, "R_ff": -0.34, "R_fz": tiptoe(38),
                                                   "R_fp": 38})),
        (6, _m(lean, _sym(sh=70, el=38, abd=12), {"hip_up": -0.19, "L_ff": 0.16, "L_fz": ANKLE_H, "L_fp": 0,
                                                   "R_ff": -0.22, "R_fz": tiptoe(30) + 0.06, "R_fp": 30})),
        (12, _m(lean, _sym(sh=70, el=35, abd=12), {"R_ff": 0.24, "R_fz": 0.19, "R_fp": 5, "L_ff": -0.34, "L_fz": tiptoe(38),
                                                    "L_fp": 38})),
        (18, _m(lean, _sym(sh=70, el=38, abd=12), {"hip_up": -0.19, "R_ff": 0.16, "R_fz": ANKLE_H, "R_fp": 0,
                                                    "L_ff": -0.22, "L_fz": tiptoe(30) + 0.06, "L_fp": 30})),
    ])
    pull = {"pel_pitch": -9, "sp_pitch": -4, "hip_up": -0.12, "L_ff": 0.18, "R_ff": -0.20, "R_fp": 8, "L_fs": 0.04,
            "R_fs": 0.04, "neck_pitch": 6}
    A["Work_SledPull"] = (30, [
        (0, _m(pull, {"L_sh": 78, "L_el": 10, "R_sh": -15, "R_el": 100, "ch_yaw": -10, "L_abd": 6, "R_abd": 14})),
        (15, _m(pull, {"R_sh": 78, "R_el": 10, "L_sh": -15, "L_el": 100, "ch_yaw": 10, "R_abd": 6, "L_abd": 14,
                       "hip_up": -0.13})),
    ])
    stand = _sym(sh=4, el=12, abd=5)
    squat = _m(_sym(sh=12, el=0, abd=10), {"hip_up": -0.42, "hip_fwd": -0.04, "pel_pitch": 40, "sp_pitch": 18,
                                           "ch_pitch": 8, "neck_pitch": -20, "head_pitch": -10})
    plank = _m(_sym(sh=0, el=0, abd=8, ff=-0.93, fz=tiptoe(65), fp=65), {"hip_up": -0.44, "hip_fwd": -0.25,
                                                                   "pel_pitch": 66, "neck_pitch": -18,
                                                                   "head_pitch": -12})
    chest = _m(_sym(sh=-25, el=88, abd=20, ff=-0.95, fz=tiptoe(68), fp=68), {"hip_up": -0.60, "hip_fwd": -0.25,
                                                                       "pel_pitch": 72, "neck_pitch": -22,
                                                                       "head_pitch": -12})
    A["Work_Burpee"] = (72, [
        (0, stand, 0.5),
        (8, squat),
        (16, plank, 0.4),
        (23, chest, 0.3),
        (30, plank),
        (38, _m(squat, _sym(ff=0.03))),
        (46, _m(_sym(sh=170, el=8, abd=14, fz=tiptoe(30) + 0.12, fp=30), {"hip_up": 0.11, "pel_pitch": -4, "head_pitch": -10})),
        (54, _m(_sym(sh=40, el=30, abd=10), {"hip_up": -0.16, "pel_pitch": 14, "sp_pitch": 6})),
    ])
    seat = {"hip_up": -0.46, "L_ff": 0.52, "R_ff": 0.52, "L_fz": 0.19, "R_fz": 0.19, "L_fp": -55, "R_fp": -55,
            "L_fs": 0.0, "R_fs": 0.0}
    A["Work_Row"] = (48, [
        (0, _m(seat, _sym(sh=82, el=0, abd=6), {"hip_fwd": 0.12, "pel_pitch": 20, "sp_pitch": 6, "neck_pitch": -8}), 0.5),
        (6, _m(seat, _sym(sh=84, el=0, abd=6), {"hip_fwd": -0.04, "pel_pitch": 16, "sp_pitch": 4})),
        (16, _m(seat, _sym(sh=-40, el=115, abd=14), {"hip_fwd": -0.20, "pel_pitch": -18, "sp_pitch": -6,
                                                      "neck_pitch": 6}), 0.4),
        (23, _m(seat, _sym(sh=55, el=12, abd=8), {"hip_fwd": -0.20, "pel_pitch": -15, "sp_pitch": -5})),
        (31, _m(seat, _sym(sh=78, el=0, abd=6), {"hip_fwd": -0.14, "pel_pitch": 18, "sp_pitch": 6})),
    ])
    carry = _sym(sh=0, abd=11, el=4, wr=0)
    A["Work_Farmers"] = (32, [
        (0, _m(carry, {"L_ff": 0.07, "L_fz": 0.25, "L_fp": 12, "pel_roll": 2.5, "hip_side": -0.015, "ch_pitch": -2,
                       "hip_up": -0.02})),
        (8, _m(carry, {"hip_up": -0.035, "ch_pitch": -2})),
        (16, _m(carry, {"R_ff": 0.07, "R_fz": 0.25, "R_fp": 12, "pel_roll": -2.5, "hip_side": 0.015, "ch_pitch": -2,
                        "hip_up": -0.02})),
        (24, _m(carry, {"hip_up": -0.035, "ch_pitch": -2})),
    ])
    bag = _sym(sh=22, abd=52, el=145, tw=10)
    A["Work_Lunge"] = (64, [
        (0, _m(bag, {"hip_up": -0.01})),
        (8, _m(bag, {"L_ff": 0.24, "L_fz": 0.17, "L_fp": -4, "hip_up": -0.06, "hip_fwd": 0.05})),
        (16, _m(bag, {"L_ff": 0.40, "L_fz": ANKLE_H, "R_ff": -0.40, "R_fz": tiptoe(55), "R_fp": 55, "hip_up": -0.36,
                      "sp_pitch": 4}), 0.5),
        (26, _m(bag, {"L_ff": 0.20, "L_fz": 0.15, "L_fp": 0, "hip_up": -0.06, "hip_fwd": 0.03})),
        (32, _m(bag, {"hip_up": -0.01})),
        (40, _m(bag, {"R_ff": 0.24, "R_fz": 0.17, "R_fp": -4, "hip_up": -0.06, "hip_fwd": 0.05})),
        (48, _m(bag, {"R_ff": 0.40, "R_fz": ANKLE_H, "L_ff": -0.40, "L_fz": tiptoe(55), "L_fp": 55, "hip_up": -0.36,
                      "sp_pitch": 4}), 0.5),
        (58, _m(bag, {"R_ff": 0.20, "R_fz": 0.15, "R_fp": 0, "hip_up": -0.06, "hip_fwd": 0.03})),
    ])
    hold = _sym(sh=32, abd=-14, el=125, tw=18, fs=0.06)
    A["Work_WallBall"] = (40, [
        (0, _m(hold, {"hip_up": -0.02})),
        (10, _m(hold, {"hip_up": -0.40, "hip_fwd": -0.14, "pel_pitch": 28, "sp_pitch": 6, "neck_pitch": -10}), 0.4),
        (18, _m(_sym(sh=168, abd=10, el=10, tw=0, fs=0.06, fz=tiptoe(16), fp=16), {"hip_up": 0.0, "ch_pitch": -8,
                                                                              "head_pitch": -25})),
        (25, _m(_sym(sh=115, abd=0, el=60, tw=10, fs=0.06), {"hip_up": 0.0, "head_pitch": -15})),
        (31, _m(hold, {"hip_up": -0.06})),
    ])
    return A


def action_frames(name):
    """→ (N, [params mỗi khung 0..N])  (khung N ≡ khung 0 → lặp liền mạch)"""
    if name == "Run":
        N = RUN_CYCLE
        return N, [run_params(f / N) for f in range(N + 1)]
    N, keys = action_specs()[name]
    return N, [interp_keys(keys, N, f) for f in range(N + 1)]


def prop_specs():
    """vị trí đạo cụ ở tư thế nghỉ (theo tay ở tư thế khoá đặc trưng) — tính bằng FK"""
    specs = {}
    # tạ ấm: tay cầm ở lòng bàn tay
    for side, sx in (("Left", 1), ("Right", -1)):
        hp = BONE[side + "Hand"][2]
        specs["Prop_KB_" + side[0]] = {"bone": side + "Hand", "kind": "kb", "at": (sx * 0.227, 0.0, 0.70)}
    specs["Prop_Sandbag"] = {"bone": "Spine1", "kind": "sandbag", "at": (0.0, 0.075, 1.33)}
    # bóng wall ball: giữa 2 bàn tay ở tư thế ôm bóng
    N, keys = action_specs()["Work_WallBall"]
    rot, off = solve_pose(interp_keys(keys, N, 0))
    head, wR = fk(rot, off)
    pl = bone_point(head, wR, "LeftHand", (0.227, -0.02, 0.712))
    pr = bone_point(head, wR, "RightHand", (-0.227, -0.02, 0.712))
    mid = v_mul(v_add(pl, pr), 0.5)
    local = r3_vec(r3_T(wR["LeftHand"]), v_sub(mid, head["LeftHand"]))
    specs["Prop_WallBall"] = {"bone": "LeftHand", "kind": "ball", "at": v_add(BONE["LeftHand"][2], local),
                              "hand_gap": v_len(v_sub(pl, pr))}
    # tay kéo máy chèo: thanh ngang giữa 2 tay ở tư thế bắt đầu kéo
    N, keys = action_specs()["Work_Row"]
    rot, off = solve_pose(interp_keys(keys, N, 0))
    head, wR = fk(rot, off)
    pl = bone_point(head, wR, "LeftHand", (0.227, 0, 0.712))
    pr = bone_point(head, wR, "RightHand", (-0.227, 0, 0.712))
    mid = v_mul(v_add(pl, pr), 0.5)
    RT = r3_T(wR["LeftHand"])
    local = r3_vec(RT, v_sub(mid, head["LeftHand"]))
    axis = r3_vec(RT, (1.0, 0.0, 0.0))
    specs["Prop_RowHandle"] = {"bone": "LeftHand", "kind": "bar", "at": v_add(BONE["LeftHand"][2], local), "axis": axis}
    return specs


def build_prop_geo(spec):
    G = Geo()
    at = spec["at"]
    k = spec["kind"]
    if k == "kb":
        eq_kettlebell(G, m_mul(m_T(at[0], at[1], at[2] - 0.235), m_Rz(math.pi / 2)), r=0.10)
    elif k == "sandbag":
        eq_sandbag(G, m_T(*at))
    elif k == "ball":
        G.add(sphere(0.13, 16, 8), "Rubber", m_T(*at))
        G.add(torus(0.131, 0.01, 20, 4), "Teal", m_T(*at))
    elif k == "bar":
        ax = spec["axis"]
        prim, xf = capsule(v_sub(at, v_mul(ax, 0.23)), v_add(at, v_mul(ax, 0.23)), 0.014, 0.014, 8, 1)
        G.add(prim, "Steel", xf)
        for sgn in (-1, 1):
            c0 = v_add(at, v_mul(ax, sgn * 0.12))
            c1 = v_add(at, v_mul(ax, sgn * 0.22))
            prim, xf = capsule(c0, c1, 0.019, 0.019, 8, 1)
            G.add(prim, "Rubber", xf)
    return G


# =============================================================================
# 7. LỊCH CHẠY VIDEO XEM TRƯỚC + CAMERA BÁM (thuần Python)
# =============================================================================


def ease_profile(tau, e=EASE_FRAC):
    """quãng đường chuẩn hoá 0..1 với tăng tốc/giảm tốc dạng (1-cos)/2, giữa đều tốc"""
    tau = clamp(tau, 0.0, 1.0)
    vmax = 1.0 / (1.0 - e)

    def ramp(t):  # tích phân vmax*(1-cos(pi t/e))/2 từ 0..t (t ≤ e)
        return vmax * (t / 2 - e / (2 * math.pi) * math.sin(math.pi * t / e))

    if tau < e:
        return ramp(tau)
    if tau > 1 - e:
        return 1.0 - ramp(1.0 - tau)
    return ramp(e) + vmax * (tau - e)


def build_schedule(path):
    st_s = station_s(path)
    fin_s = FINISH_F * path.L
    segs = []
    markers = []
    fr = 1
    segs.append(("idle", fr, fr + IDLE0, START_S, START_S, -1))
    fr += IDLE0
    markers.append(("START", fr))
    s_prev = START_S
    for k, sk in enumerate(st_s + [fin_s]):
        n = int(round(clamp((sk - s_prev) / PREVIEW_RUN_SPEED * FPS, 45, 84)))
        segs.append(("run", fr, fr + n, s_prev, sk, k))
        fr += n
        if k < 8:
            markers.append(("S%d" % (k + 1), fr))
            segs.append(("work", fr, fr + WORK_FRAMES, sk, sk, k))
            fr += WORK_FRAMES
            markers.append(("S%d_DONE" % (k + 1), fr))
        else:
            markers.append(("FINISH", fr))
        s_prev = sk
    segs.append(("celebrate", fr, fr + CELEB_FRAMES, fin_s, fin_s, 8))
    end = fr + CELEB_FRAMES
    # vị trí trên đường từng khung
    s_at = {}
    for kind, a, b, s0, s1, k in segs:
        for f in range(a, b + 1):
            if kind == "run":
                s_at[f] = s0 + (s1 - s0) * ease_profile((f - a) / float(b - a))
            elif f not in s_at:
                s_at[f] = s0
    frames = list(range(1, end + 1))
    dt = 1.0 / FPS
    xy = [root_xy(path, s_at[f], st_s) for f in frames]
    # khoảng cách cộng dồn thật của gốc (để Run không trượt chân)
    cum = [0.0]
    for a, b in zip(xy, xy[1:]):
        cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    # hướng nhìn (look-ahead) + làm mượt, nghiêng khi vào cua, cúi khi tăng tốc
    heads, banks, pitches, speeds = [], [], [], []
    h_prev = None
    bank = pitch = 0.0
    v_prev = 0.0
    for i, f in enumerate(frames):
        s = s_at[f]
        v = (cum[min(i + 1, len(cum) - 1)] - cum[max(i - 1, 0)]) / (dt * (min(i + 1, len(cum) - 1) - max(i - 1, 0)) or 1)
        if v > 0.05:
            a = root_xy(path, s + 1.1, st_s)
            b = root_xy(path, s - 0.25, st_s)
        else:
            a = root_xy(path, s + 0.6, st_s)
            b = root_xy(path, s - 0.6, st_s)
        tgt = math.atan2(a[1] - b[1], a[0] - b[0])
        if h_prev is None:
            h = tgt
        else:
            h = h_prev + wrap_pi(tgt - h_prev) * (1 - math.exp(-dt / 0.09))
        omega = 0.0 if h_prev is None else (h - h_prev) / dt
        h_prev = h
        acc = (v - v_prev) / dt
        v_prev = v
        bank_t = clamp(0.55 * math.atan(v * omega / 9.81), math.radians(-12), math.radians(12))
        pitch_t = clamp(0.20 * math.atan(acc / 9.81), math.radians(-5), math.radians(6))
        bank += (bank_t - bank) * (1 - math.exp(-dt / 0.12))
        pitch += (pitch_t - pitch) * (1 - math.exp(-dt / 0.15))
        heads.append(h)
        banks.append(bank)
        pitches.append(pitch)
        speeds.append(v)
    # camera bám (lò xo giảm chấn tới hạn), góc 3/4
    OFF = (3.2, -6.4, 5.6)
    cams = []
    cp = ct = None
    cv = tv = (0.0, 0.0, 0.0)
    w = 3.2
    for i, f in enumerate(frames):
        x, y = xy[i]
        hv = (math.cos(heads[i]) * speeds[i] * 0.22, math.sin(heads[i]) * speeds[i] * 0.22, 0.0)
        want_t = v_add((x, y, 0.85), hv)
        want_p = v_add((x, y, 0.0), OFF)
        if cp is None:
            cp, ct = want_p, want_t
        else:
            def spring(p, vel, goal):
                acc_ = v_sub(v_mul(v_sub(goal, p), w * w), v_mul(vel, 2 * w))
                vel = v_add(vel, v_mul(acc_, dt))
                return v_add(p, v_mul(vel, dt)), vel
            cp, cv = spring(cp, cv, want_p)
            ct, tv = spring(ct, tv, want_t)
        cams.append((cp, ct))
    # thời gian dải NLA Run (khung trong action) theo quãng đường thật
    run_time = [cum[i] / STRIDE * RUN_CYCLE for i in range(len(frames))]
    return {
        "segs": segs, "markers": markers, "frames": frames, "end": end, "s": [s_at[f] for f in frames], "xy": xy,
        "cum": cum, "heading": heads, "bank": banks, "pitch": pitches, "speed": speeds, "cams": cams,
        "run_time": run_time,
    }


# =============================================================================
# 8. JSON CHO APP
# =============================================================================


def r6(x):
    return round(x, 4)


def build_path_json(path, map_info=None, n_points=200):
    st_s = station_s(path)
    pts = []
    for i in range(n_points):
        s = path.L * i / (n_points - 1)
        p = path.pos(s)
        pts.append([r6(c) for c in to_gl((p[0], p[1], 0.0))])

    def pinfo(s):
        p, t, r = path.pos(s), path.tan(s), path.right(s)
        return {"s": r6(s), "f": r6(s / path.L), "pos": [r6(c) for c in to_gl((p[0], p[1], 0.0))],
                "tangent": [r6(c) for c in to_gl((t[0], t[1], 0.0))],
                "right": [r6(c) for c in to_gl((r[0], r[1], 0.0))],
                "yaw": r6(math.atan2(t[0], -t[1]))}  # three.js rotation.y để nhân vật (+Z) nhìn theo đường

    stations = []
    for k, (code, name, dist, work) in enumerate(STATIONS):
        d = pinfo(st_s[k])
        xf, wpos, th = station_frame(path, k)
        pc = m_apply(xf, (-(WORK_X - PAD_SHIFT), 0, 0))
        lx, ly = LABEL_POS[k]
        d.update({"id": k + 1, "code": code, "name": name, "dist": dist, "action": work,
                  "work_pos": [r6(c) for c in to_gl(wpos)], "pad_center": [r6(c) for c in to_gl(pc)],
                  "ring_node": "StatusRing_%02d" % (k + 1), "label_anchor": [r6(c) for c in to_gl((lx, ly, 0.4))],
                  "props": PROPS_FOR_ACTION.get(work, [])})
        stations.append(d)
    map_lens = 41.0
    return {
        "version": 2,
        "generator": "scripts/hyrox3d/build_scene_v2.py",
        "units": "met (1 đơn vị Blender); toạ độ glTF Y-up; nhân vật nhìn +Z",
        "fps": FPS,
        "length": r6(path.L),
        "road_width": PATH_W,
        "points": pts,
        "start": pinfo(START_S),
        "stations": stations,
        "finish": pinfo(FINISH_F * path.L),
        "work_offset": WORK_X,
        "approach": APPROACH,
        "stride": STRIDE,
        "run_cycle_frames": RUN_CYCLE,
        "run_cycle_seconds": r6(RUN_CYCLE / FPS),
        "natural_run_speed": r6(STRIDE / (RUN_CYCLE / FPS)),
        "actions": {n: {"frames": action_specs()[n][0] if n != "Run" else RUN_CYCLE, "loop": True} for n in ACTION_NAMES},
        "props": PROPS_FOR_ACTION,
        "rings": ["StatusRing_%02d" % (k + 1) for k in range(8)],
        "camera": {
            "map": {"pos": [r6(c) for c in to_gl((0, -20.5, 29))], "target": [r6(c) for c in to_gl((0, 0.6, 0))],
                    "fov_v_deg": r6(math.degrees(2 * math.atan(18 / map_lens)))},
            "follow_offset": [r6(c) for c in to_gl((3.2, -6.4, 5.6))],
        },
        "sample_splits_s": SAMPLE_SPLITS,
        "colors": {"teal": TEAL},
    }


# =============================================================================
# 9. TỰ KIỂM (python3 build_scene_v2.py --selftest)
# =============================================================================


def selftest(verbose=True):
    rep = {}
    path = Path2D()
    rep["path_length"] = round(path.L, 3)
    min_r = min(1.0 / max(abs(path.curvature(s)), 1e-6) for s in [i * 0.1 for i in range(int(path.L * 10))])
    rep["min_turn_radius"] = round(min_r, 3)
    G, ring, ring_pos, info = build_map_geo(path)
    rep["map_tris"] = G.tris()
    rep["map_verts"] = len(G.v)
    rep["ring_tris"] = len(ring[2]) * 2
    rep["map_materials"] = sorted(set(G.fm))
    R = build_runner_geo()
    rep["runner_tris"] = R.tris()
    rep["runner_verts"] = len(R.v)
    props = prop_specs()
    rep["props_tris"] = {k: build_prop_geo(v).tris() for k, v in props.items()}
    rep["wallball_hand_gap"] = round(props["Prop_WallBall"]["hand_gap"], 3)
    # chu kỳ chạy: chân trụ không trượt
    T = RUN_CYCLE / FPS
    v = STRIDE / T
    IK_STATS["clamped"] = IK_STATS["solves"] = 0
    slip = 0.0
    minz_run = 9.0
    steps = 400
    prev = None
    for i in range(steps + 1):
        u = i / steps
        rot, off = solve_pose(run_params(u))
        head, wR = fk(rot, off)
        cur = {}
        for side, s in (("Left", "L"), ("Right", "R")):
            fp = foot_points(head, wR, side)
            for nm, p in fp.items():
                minz_run = min(minz_run, p[2])
            ph = (u if s == "L" else u - 0.5) % 1.0
            cur[side] = (fp, ph)
        if prev is not None:
            for side in ("Left", "Right"):
                fp, ph = cur[side]
                fpp, _ = prev[side]
                tau = ph / RUN_BETA
                if 0.05 < tau < 0.95:
                    key = "heel" if tau < 0.5 else "ball"
                    dwf = (-fp[key][1]) - (-fpp[key][1])
                    world_v = dwf / (T / steps) + v
                    slip = max(slip, abs(world_v))
        prev = cur
    rep["run_natural_speed"] = round(v, 3)
    rep["run_max_stance_slip_mps"] = round(slip, 3)
    rep["run_min_foot_z"] = round(minz_run, 4)
    rep["run_ik_clamped"] = "%d/%d" % (IK_STATS["clamped"], IK_STATS["solves"])
    # các action: chân không xuyên đất, đầu gối không xuyên đất
    acts = {}
    for name in ACTION_NAMES:
        IK_STATS["clamped"] = IK_STATS["solves"] = 0
        N, frames = action_frames(name)
        mz, knee_z, hand_z = 9.0, 9.0, 9.0
        for P in frames:
            rot, off = solve_pose(P)
            head, wR = fk(rot, off)
            for side in ("Left", "Right"):
                for p in foot_points(head, wR, side).values():
                    mz = min(mz, p[2])
                knee_z = min(knee_z, head[side + "Leg"][2])
                hand_z = min(hand_z, bone_point(head, wR, side + "Hand", BONE[side + "Hand"][3])[2])
        loop_err = max(abs(frames[0][k] - frames[-1][k]) for k in PARAMS)
        acts[name] = {"frames": N, "min_foot_z": round(mz, 3), "min_knee_z": round(knee_z, 3),
                      "min_hand_z": round(hand_z, 3), "ik_clamped": "%d/%d" % (IK_STATS["clamped"], IK_STATS["solves"]),
                      "loop_err": round(loop_err, 6)}
    rep["actions"] = acts
    sch = build_schedule(path)
    rep["timeline_frames"] = sch["end"]
    rep["markers"] = dict(sch["markers"])
    rep["max_speed"] = round(max(sch["speed"]), 2)
    rep["max_bank_deg"] = round(math.degrees(max(abs(b) for b in sch["bank"])), 2)
    js = build_path_json(path)
    rep["json_points"] = len(js["points"])
    rep["json_bytes"] = len(json.dumps(js, separators=(",", ":")))
    if verbose:
        print(json.dumps(rep, indent=1, ensure_ascii=False))
    return rep


# =============================================================================
# 10. PHẦN BLENDER
# =============================================================================
LOG = {"warnings": [], "steps": []}


def warn(msg):
    print("[hyrox3d][WARN]", msg)
    LOG["warnings"].append(str(msg))


def info(msg):
    print("[hyrox3d]", msg)
    LOG["steps"].append(str(msg))


def soft(name, fn, *a, **kw):
    """bước phụ (trang trí): lỗi thì cảnh báo, không dừng xuất glb"""
    try:
        return fn(*a, **kw)
    except Exception as e:  # noqa
        import traceback
        traceback.print_exc()
        warn("%s thất bại: %r" % (name, e))
        return None


def parse_args(argv):
    ap = argparse.ArgumentParser(prog="build_scene_v2.py")
    ap.add_argument("--out", default=None)
    ap.add_argument("--render", default="none", choices=["none", "preview"])
    ap.add_argument("--res", type=int, default=540, help="chiều ngang ảnh dọc 9:16 (540 → 540×960)")
    ap.add_argument("--samples", type=int, default=24)
    ap.add_argument("--engine", default="cycles", choices=["cycles", "eevee"])
    ap.add_argument("--gpu", action="store_true", help="Cycles dùng GPU (OptiX/CUDA/HIP/Metal) nếu có")
    ap.add_argument("--no-blend", action="store_true")
    ap.add_argument("--frames", type=int, default=90, help="số khung video đoạn trạm 4→5")
    ap.add_argument("--selftest", action="store_true")
    return ap.parse_args(argv)


def blender_main(args):
    import bpy  # noqa
    from mathutils import Vector, Matrix, Quaternion, Euler  # noqa

    out = args.out
    if not out:
        sf = str(globals().get("__file__", ""))
        if bpy.data.filepath:
            base = bpy.path.abspath("//")
        elif sf and os.path.isfile(sf):
            base = os.path.dirname(os.path.abspath(sf))
        else:  # chạy từ Text Editor khi chưa lưu .blend → thư mục người dùng (thư mục cài Blender có thể không ghi được)
            base = os.path.join(os.path.expanduser("~"), "Documents") if os.path.isdir(
                os.path.join(os.path.expanduser("~"), "Documents")) else os.path.expanduser("~")
        out = os.path.join(base, "hyrox_out")
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)
    info("Blender %s → %s" % (bpy.app.version_string, out))

    # ------------------------------------------------------------- reset
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        for ob in list(bpy.data.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.armatures, bpy.data.curves,
                     bpy.data.cameras, bpy.data.lights, bpy.data.collections):
            for blk in list(coll):
                try:
                    coll.remove(blk)
                except Exception:
                    pass
    scene = bpy.context.scene
    scene.render.fps = FPS
    try:
        prefs = bpy.context.preferences.edit
        prefs.keyframe_new_interpolation_type = "BEZIER"
        prefs.keyframe_new_handle_type = "AUTO_CLAMPED"
    except Exception as e:
        warn("prefs keyframe: %r" % e)

    path = Path2D()
    st_s = station_s(path)

    # ------------------------------------------------------------- vật liệu
    def principled(m):
        if not m.node_tree:
            return None
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                return n
        return None

    def set_in(node, names, value):
        for nm in names:
            if nm in node.inputs:
                node.inputs[nm].default_value = value
                return node.inputs[nm]
        return None

    def mat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0):
        m = bpy.data.materials.new(name)
        try:
            m.use_nodes = True
        except Exception:
            pass
        m.diffuse_color = (color[0], color[1], color[2], 1.0)
        b = principled(m)
        if b is None:
            warn("không thấy Principled BSDF trong %s" % name)
            return m
        set_in(b, ["Base Color"], (color[0], color[1], color[2], 1.0))
        set_in(b, ["Roughness"], rough)
        set_in(b, ["Metallic"], metal)
        if emit is not None:
            set_in(b, ["Emission Color", "Emission"], (emit[0], emit[1], emit[2], 1.0))
            set_in(b, ["Emission Strength"], strength)
        return m

    def emission_input(m):
        b = principled(m)
        return b.inputs["Emission Strength"] if b and "Emission Strength" in b.inputs else None

    M = {k: mat(k, v["color"], v["rough"], v.get("metal", 0.0), v.get("emit"), v.get("strength", 0.0))
         for k, v in MATS.items()}

    # ------------------------------------------------------------- tiện ích
    def new_coll(name):
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        return c

    C_MAP = new_coll("ExportMap")
    C_RUN = new_coll("ExportRunner")
    C_PREV = new_coll("PreviewOnly")

    def geo_to_mesh(name, geo):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in geo.v], [], [tuple(f) for f in geo.f])
        slots = []
        for m_ in geo.fm:
            if m_ not in slots:
                slots.append(m_)
        for s_ in slots:
            me.materials.append(M[s_])
        idx = [slots.index(m_) for m_ in geo.fm]
        me.polygons.foreach_set("material_index", idx)
        try:
            me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        except Exception:
            try:
                me.shade_smooth()
            except Exception as e:
                warn("shade smooth %s: %r" % (name, e))
        me.update()
        try:
            if hasattr(me, "use_auto_smooth"):
                me.use_auto_smooth = True  # Blender < 4.1
            me.normals_split_custom_set_from_vertices([tuple(n) for n in geo.n])
        except Exception as e:
            warn("custom normals %s: %r (dùng pháp tuyến mượt mặc định)" % (name, e))
        if geo.uv:
            uvl = me.uv_layers.new(name="UVMap")
            for poly in me.polygons:
                for li in poly.loop_indices:
                    uvl.data[li].uv = geo.uv[me.loops[li].vertex_index]
        return me

    def obj(name, data, coll):
        o = bpy.data.objects.new(name, data)
        coll.objects.link(o)
        return o

    # ------------------------------------------------------------- bản đồ tĩnh
    G, ring_p, ring_pos, map_info = build_map_geo(path)
    map_obj = obj("Map_Static", geo_to_mesh("Map_Static", G), C_MAP)
    rg = Geo().add(ring_p, "Ring", m_S(1, 1, 0.4))
    ring_mesh = geo_to_mesh("StatusRing", rg)
    rings = []
    for k, p in enumerate(ring_pos):
        o = obj("StatusRing_%02d" % (k + 1), ring_mesh, C_MAP)
        o.location = p
        rings.append(o)
    anchors = []
    for k in range(8):
        xf, w, th = station_frame(path, k)
        e = obj("Anchor_S%02d" % (k + 1), None, C_MAP)
        e.location = w
        e.rotation_euler = (0, 0, th + math.pi / 2)
        e.empty_display_size = 0.3
        anchors.append(e)
    for nm, s in (("Anchor_Start", START_S), ("Anchor_Finish", FINISH_F * path.L)):
        p = path.pos(s)
        e = obj(nm, None, C_MAP)
        e.location = (p[0], p[1], 0)
        e.rotation_euler = (0, 0, path.heading(s) + math.pi / 2)
        anchors.append(e)
    info("bản đồ: %d tam giác (+ vòng %d tam giác × 8, dùng chung lưới)" % (G.tris(), rg.tris()))

    # ------------------------------------------------------------- nhân vật
    arm_data = bpy.data.armatures.new("RunnerRig")
    arm = obj("RunnerRig", arm_data, C_RUN)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = {}
    for name, parent, h, t in BONES:
        eb = arm_data.edit_bones.new(name)
        eb.head = h
        eb.tail = t
        eb.roll = 0.0
        if parent:
            eb.parent = ebs[parent]
            eb.use_connect = False
        ebs[name] = eb
    bpy.ops.object.mode_set(mode="OBJECT")
    try:
        arm_data.display_type = "OCTAHEDRAL"
        arm.show_in_front = True
    except Exception:
        pass
    REST_Q = {b.name: b.matrix_local.to_quaternion() for b in arm_data.bones}

    RG = build_runner_geo()
    body = obj("RunnerBody", geo_to_mesh("RunnerBody", RG), C_RUN)
    groups = {}
    for name, *_ in BONES:
        groups[name] = body.vertex_groups.new(name=name)
    by_g = {}
    for i, g in enumerate(RG.vg):
        by_g.setdefault(g, []).append(i)
    for g, ids in by_g.items():
        if g in groups:
            groups[g].add(ids, 1.0, "REPLACE")
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    body.parent = arm
    info("nhân vật: %d tam giác, %d xương" % (RG.tris(), len(BONES)))

    bpy.context.view_layer.update()
    props = {}
    for pname, spec in prop_specs().items():
        pg = build_prop_geo(spec)
        po = obj(pname, geo_to_mesh(pname, pg), C_RUN)
        po.parent = arm
        po.parent_type = "BONE"
        po.parent_bone = spec["bone"]
        bpy.context.view_layer.update()
        po.matrix_world = Matrix.Identity(4)
        props[pname] = po
    bpy.context.view_layer.update()

    # ------------------------------------------------------------- action
    def action_fcurves(act):
        fcs = []
        try:
            legacy = act.fcurves  # Blender ≤ 4.x (4.4–4.5: proxy của slot đầu)
            fcs = list(legacy)
        except Exception:
            fcs = []
        if not fcs:
            for layer in getattr(act, "layers", []):
                for strip in layer.strips:
                    for bag in getattr(strip, "channelbags", []):
                        fcs.extend(bag.fcurves)
        return fcs

    ad = arm.animation_data_create()
    actions = {}
    for bn in arm.pose.bones:
        bn.rotation_mode = "QUATERNION"
    for name in ACTION_NAMES:
        N, frames = action_frames(name)
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ad.action = act
        prevq = {}
        for f, P in enumerate(frames):
            rot, off = solve_pose(P)
            for bname, q in rot.items():
                pb = arm.pose.bones[bname]
                qa = Quaternion(q)
                rq = REST_Q[bname]
                ql = rq.inverted() @ qa @ rq
                if bname in prevq and prevq[bname].dot(ql) < 0:
                    ql.negate()
                prevq[bname] = ql.copy()
                pb.rotation_quaternion = ql
                pb.keyframe_insert("rotation_quaternion", frame=f, group=bname)
            hp = arm.pose.bones["Hips"]
            hp.location = REST_Q["Hips"].inverted() @ Vector(off)
            hp.keyframe_insert("location", frame=f, group="Hips")
        try:
            act.use_frame_range = True
            act.frame_start = 0
            act.frame_end = N
            act.use_cyclic = True
        except Exception as e:
            warn("frame range %s: %r" % (name, e))
        for fc in action_fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            if not any(m_.type == "CYCLES" for m_ in fc.modifiers):
                fc.modifiers.new("CYCLES")
            fc.update()
        actions[name] = act
        ad.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    info("đã tạo %d action: %s" % (len(actions), ", ".join(actions)))

    # ------------------------------------------------------------- xuất glb
    def safe_gltf_export(filepath, objects, **kw):
        for o in bpy.context.view_layer.objects:
            try:
                o.select_set(False)
            except Exception:
                pass
        for o in objects:
            o.hide_viewport = False
            o.hide_set(False)
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        op = bpy.ops.export_scene.gltf
        try:
            props_ = op.get_rna_type().properties
        except Exception:
            props_ = None
        args_ = {"filepath": filepath}
        for k, v in kw.items():
            if props_ is not None:
                if k not in props_:
                    info("glTF: bỏ tham số không có ở bản này: %s" % k)
                    continue
                p = props_[k]
                if p.type == "ENUM" and not getattr(p, "is_enum_flag", False):
                    ids = [e.identifier for e in p.enum_items]
                    if ids and v not in ids:
                        info("glTF: %s=%r không hợp lệ (%s) → bỏ" % (k, v, ids))
                        continue
            args_[k] = v
        res = op(**args_)
        info("xuất %s → %s" % (os.path.basename(filepath), res))
        return res

    common = dict(export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                  export_texcoords=False, export_normals=True, export_tangents=False, export_materials="EXPORT",
                  export_image_format="NONE", export_vertex_color="NONE", export_colors=False,
                  export_attributes=False, export_cameras=False, export_lights=False, export_extras=False,
                  export_draco_mesh_compression_enable=False, export_gpu_instances=False)

    map_glb = os.path.join(out, "hyrox_map.glb")
    safe_gltf_export(map_glb, [map_obj] + rings + anchors, export_animations=False, export_skins=False,
                     export_morph=False, **common)

    # đưa từng action xuống NLA (mỗi action 1 track) → exporter ACTIONS xuất đủ
    def push_actions_to_nla():
        for t in list(ad.nla_tracks):
            ad.nla_tracks.remove(t)
        for name, act in actions.items():
            tr = ad.nla_tracks.new()
            tr.name = name
            st = tr.strips.new(name, 0, act)
            try:
                if hasattr(st, "action_slot") and st.action_slot is None and len(act.slots):
                    st.action_slot = act.slots[0]
            except Exception as e:
                warn("slot NLA %s: %r" % (name, e))
        ad.action = None

    push_actions_to_nla()
    runner_glb = os.path.join(out, "hyrox_runner.glb")
    run_objs = [arm, body] + list(props.values())
    rkw = dict(export_animations=True, export_animation_mode="ACTIONS", export_frame_range=False,
               export_force_sampling=True, export_frame_step=1, export_anim_single_armature=True,
               export_reset_pose_bones=True, export_current_frame=False, export_rest_position_armature=True,
               export_def_bones=False, export_optimize_animation_size=True,
               export_optimize_animation_keep_anim_armature=True, export_anim_slide_to_zero=True,
               export_negative_frame="SLIDE", export_bake_animation=False, export_skins=True,
               export_all_influences=False, export_influence_nb=4, export_morph=False, export_nla_strips=True,
               export_hierarchy_flatten_bones=False, export_armature_object_remove=False)
    rkw.update(common)
    safe_gltf_export(runner_glb, run_objs, **rkw)
    ginfo = glb_info(runner_glb)
    info("runner.glb: %s" % ginfo)
    missing = [n for n in ACTION_NAMES if n not in ginfo.get("animations", [])]
    if missing:
        warn("ACTIONS thiếu %s → thử lại chế độ NLA_TRACKS" % missing)
        rkw["export_animation_mode"] = "NLA_TRACKS"
        safe_gltf_export(runner_glb, run_objs, **rkw)
        ginfo = glb_info(runner_glb)
        info("runner.glb (NLA_TRACKS): %s" % ginfo)
        missing = [n for n in ACTION_NAMES if n not in ginfo.get("animations", [])]
        if missing:
            warn("VẪN thiếu animation: %s" % missing)
    LOG["runner_glb"] = ginfo
    LOG["map_glb"] = glb_info(map_glb)

    js = build_path_json(path, map_info)
    with open(os.path.join(out, "hyrox_path.json"), "w", encoding="utf-8") as fh:
        json.dump(js, fh, ensure_ascii=False, separators=(",", ":"))
    info("hyrox_path.json: %d điểm, dài %.2f m" % (len(js["points"]), path.L))

    # =========================================================== XEM TRƯỚC (chỉ render)
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    sch = build_schedule(path)
    mk = dict(sch["markers"])
    scene.frame_start = 1
    scene.frame_end = sch["end"]
    for name, fr in sch["markers"]:
        scene.timeline_markers.new(name, frame=fr)

    # vòng sáng: mỗi trạm 1 vật liệu riêng (liên kết theo object, chỉ sau khi đã xuất glb)
    def setup_rings():
        for k, o in enumerate(rings):
            m = M["Ring"].copy()
            m.name = "Ring_%02d" % (k + 1)
            o.material_slots[0].link = "OBJECT"
            o.material_slots[0].material = m
            em = emission_input(m)
            if em is None:
                continue
            a, d = mk["S%d" % (k + 1)], mk["S%d_DONE" % (k + 1)]
            for fr, val in [(1, 0.0), (a - 6, 0.0), (a, 2.5), (d - 4, 1.5), (d, 9.0), (d + 8, 4.0)]:
                em.default_value = val
                em.keyframe_insert("default_value", frame=max(fr, 1))

    soft("vòng sáng", setup_rings)

    def setup_progress():
        pg = Geo()
        ss = road_rings(path, 2.0, 0.4)
        V, N, F, uv = [], [], [], []
        for s in ss:
            p, r = path.pos(s), path.right(s)
            for u in (-0.08, 0.08):
                V.append((p[0] + r[0] * u, p[1] + r[1] * u, 0.010))
                N.append((0, 0, 1.0))
                uv.append((s / path.L, 0.0 if u < 0 else 1.0))
        for i in range(len(ss) - 1):
            F.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
        pg.add((V, N, F), "Teal")
        pg.uv = uv
        me = geo_to_mesh("ProgressLine", pg)
        m = bpy.data.materials.new("ProgressGlow")
        try:
            m.use_nodes = True
        except Exception:
            pass
        for attr, val in (("blend_method", "HASHED"), ("surface_render_method", "DITHERED")):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
        nt = m.node_tree
        nt.nodes.clear()
        o_ = nt.nodes.new("ShaderNodeOutputMaterial")
        mix = nt.nodes.new("ShaderNodeMixShader")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (TEAL[0], TEAL[1], TEAL[2], 1)
        em.inputs["Strength"].default_value = 4.0
        uvn = nt.nodes.new("ShaderNodeUVMap")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        cmp_ = nt.nodes.new("ShaderNodeMath")
        cmp_.operation = "LESS_THAN"
        prog = nt.nodes.new("ShaderNodeValue")
        prog.name = prog.label = "Progress"
        nt.links.new(uvn.outputs["UV"], sep.inputs[0])
        nt.links.new(sep.outputs["X"], cmp_.inputs[0])
        nt.links.new(prog.outputs[0], cmp_.inputs[1])
        nt.links.new(cmp_.outputs[0], mix.inputs["Fac"])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], o_.inputs["Surface"])
        me.materials.clear()
        me.materials.append(m)
        obj("ProgressLine", me, C_PREV)
        for i, fr in enumerate(sch["frames"]):
            if i % 2 == 0 or i == len(sch["frames"]) - 1:
                prog.outputs[0].default_value = sch["s"][i] / path.L
                prog.outputs[0].keyframe_insert("default_value", frame=fr)

    soft("đường tiến độ", setup_progress)

    # gốc nhân vật đi theo đường
    root = obj("RunnerRoot", None, C_PREV)
    root.empty_display_size = 0.5
    arm.parent = root
    arm.location = (0, 0, 0)
    for i, fr in enumerate(sch["frames"]):
        x, y = sch["xy"][i]
        root.location = (x, y, 0.0)
        root.rotation_euler = (sch["pitch"][i], sch["bank"][i], sch["heading"][i] + math.pi / 2)
        root.keyframe_insert("location", frame=fr)
        root.keyframe_insert("rotation_euler", frame=fr)

    # NLA xem trước: track dưới = Run (đủ ảnh hưởng, thời gian dải theo quãng đường),
    # track trên = Idle/Work/Celebrate hoà trộn vào/ra BLEND khung
    def setup_nla():
        tr_run = ad.nla_tracks.new()
        tr_run.name = "Base_Run"
        tr_top = ad.nla_tracks.new()
        tr_top.name = "Moves"
        hb = BLEND // 2
        for kind, a, b, s0, s1, k in sch["segs"]:
            if kind == "run":
                start, end = a - hb, b + hb
                st = tr_run.strips.new("Run_%d" % k, int(start), actions["Run"])
                st.extrapolation = "NOTHING"
                st.blend_in = st.blend_out = 0
                try:
                    st.use_auto_blend = False
                except Exception:
                    pass
                st.repeat = float(end - start) / RUN_CYCLE
                try:
                    st.use_animated_time = True
                    for f in range(int(start), int(end) + 1):
                        i = clamp(f, 1, sch["end"]) - 1
                        st.strip_time = sch["run_time"][i]
                        st.keyframe_insert("strip_time", frame=f)
                    for fc in st.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"
                except Exception as e:
                    warn("strip_time động không dùng được (%r) → dùng scale cố định" % e)
                    dist = sch["cum"][min(b, sch["end"]) - 1] - sch["cum"][a - 1]
                    cycles = max(dist / STRIDE, 0.5)
                    st.use_animated_time = False
                    st.repeat = cycles
                    st.scale = float(b - a) / (cycles * RUN_CYCLE)
            else:
                name = {"idle": "Idle", "celebrate": "Celebrate"}.get(kind) or STATIONS[k][3]
                act = actions[name]
                start = a if kind == "idle" else a - hb
                end = b + hb if kind != "celebrate" else b
                st = tr_top.strips.new("%s_%d" % (name, k), int(start), act)
                st.repeat = float(end - start) / max(1, int(act.frame_range[1] - act.frame_range[0]))
                try:
                    st.use_auto_blend = False
                except Exception:
                    pass
                st.blend_in = 0 if kind == "idle" else BLEND
                st.blend_out = 0 if kind == "celebrate" else BLEND
                st.extrapolation = "HOLD" if kind in ("idle", "celebrate") else "NOTHING"
            try:
                if hasattr(st, "action_slot") and st.action_slot is None and len(st.action.slots):
                    st.action_slot = st.action.slots[0]
            except Exception:
                pass
        ad.action = None

    soft("NLA xem trước", setup_nla)

    def setup_props_vis():
        hb = BLEND // 2
        for pname, po in props.items():
            po.hide_render = True
            po.hide_viewport = True
            po.keyframe_insert("hide_render", frame=1)
            po.keyframe_insert("hide_viewport", frame=1)
        for k, (code, nm, dist, work) in enumerate(STATIONS):
            for pname in PROPS_FOR_ACTION.get(work, []):
                po = props[pname]
                a, d = mk["S%d" % (k + 1)] - hb, mk["S%d_DONE" % (k + 1)] + hb
                for fr, hid in ((a, False), (d, True)):
                    po.hide_render = hid
                    po.hide_viewport = hid
                    po.keyframe_insert("hide_render", frame=fr)
                    po.keyframe_insert("hide_viewport", frame=fr)
        for po in props.values():
            ad_ = po.animation_data
            if ad_ and ad_.action:
                for fc in action_fcurves(ad_.action):
                    for kp in fc.keyframe_points:
                        kp.interpolation = "CONSTANT"

    soft("hiện/ẩn đạo cụ", setup_props_vis)

    # môi trường, ánh sáng
    def setup_env():
        bpy.ops.mesh.primitive_plane_add(size=90, location=(0, 0, -1.6))
        fl = bpy.context.active_object
        fl.name = "Floor"
        fl.data.materials.append(M["Floor"])
        for c in list(fl.users_collection):
            c.objects.unlink(fl)
        C_PREV.objects.link(fl)
        world = bpy.data.worlds.new("World")
        scene.world = world
        try:
            world.use_nodes = True
        except Exception:
            pass
        bg = world.node_tree.nodes.get("Background") if world.node_tree else None
        if bg:
            bg.inputs[0].default_value = (0.006, 0.007, 0.009, 1)
            bg.inputs[1].default_value = 1.0

        def light(name, kind, loc, rot, energy, size=1.0, color=(1, 1, 1)):
            ld = bpy.data.lights.new(name, kind)
            ld.energy = energy
            ld.color = color
            if kind == "AREA":
                ld.size = size
            elif kind == "SUN":
                ld.angle = math.radians(size)
            elif kind == "SPOT":
                ld.spot_size = math.radians(70)
                ld.spot_blend = 0.6
                ld.shadow_soft_size = size
            o = obj(name, ld, C_PREV)
            o.location = loc
            o.rotation_euler = rot
            return o

        light("KeySun", "SUN", (-6, 6, 22), (math.radians(32), math.radians(-24), math.radians(-20)), 3.2, 6,
              (1, 0.96, 0.9))
        light("KeySpot", "SPOT", (-6, 6, 22), (math.radians(14), math.radians(-14), 0), 5000, 3, (1, 0.97, 0.92))
        light("Fill", "AREA", (8, -14, 10), (math.radians(55), math.radians(30), 0), 600, 10, (0.82, 0.9, 1))
        light("Rim", "AREA", (0, 18, 6), (math.radians(-70), 0, 0), 900, 12)

    soft("môi trường", setup_env)

    def setup_text():
        font = None
        for fp in [os.environ.get("HYROX_FONT", ""), "/tmp/Anton-Regular.ttf",
                   "/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf",
                   "C:/Windows/Fonts/impact.ttf", "/Library/Fonts/Impact.ttf"]:
            if fp and os.path.exists(fp):
                try:
                    font = bpy.data.fonts.load(fp, check_existing=True)
                    break
                except Exception:
                    pass

        def text(body_, size, material, loc, align="LEFT", parent=None, rot=None):
            td = bpy.data.curves.new("txt", "FONT")
            td.body = body_
            td.size = size
            td.align_x = align
            td.align_y = "CENTER"
            td.extrude = 0.008
            if font:
                td.font = font
            o = obj("T_" + body_[:12], td, C_PREV)
            o.data.materials.append(material)
            o.location = loc
            if rot:
                o.rotation_euler = rot
            if parent:
                o.parent = parent
            return o

        cam_rot = Euler((math.radians(35.3), 0, 0), "XYZ")
        mc = bpy.data.objects.get("MapCam")
        if mc:
            bpy.context.view_layer.update()
            cam_rot = mc.matrix_world.to_euler()
        for k, (code, nm, dist, work) in enumerate(STATIONS):
            x, y = LABEL_POS[k]
            g = obj("Label_%s" % code, None, C_PREV)
            g.location = (x, y, 0.4)
            g.rotation_euler = cam_rot
            text(code, 0.9, M["TextTeal"], (0, 0, 0), "RIGHT", g)
            text("RUN 1 KM", 0.3, M["TextWhite"], (0.18, 0.2, 0), "LEFT", g)
            text("%s  %s" % (nm, dist), 0.3, M["TextWhite"], (0.18, -0.22, 0), "LEFT", g)
            # số trên bục (nằm phẳng, phía trái đường)
            sk = st_s[k]
            p, r = path.pos(sk), path.right(sk)
            pc = map_info["pad_centers"][k]
            q = (pc[0] - r[0] * 0.78, pc[1] - r[1] * 0.78, PAD_TOP + 0.004)
            text(code, 0.36, M["TextTeal"], q, "CENTER", None, (0, 0, 0))
        title = obj("Title", None, C_PREV)
        title.location = (0, 15.2, 1.0)
        title.rotation_euler = cam_rot
        text("HYROX RACE", 1.15, M["TextWhite"], (0, 0.55, 0), "CENTER", title)
        text("MAP", 1.0, M["TextTeal"], (0, -0.75, 0), "CENTER", title)

    # camera
    def setup_cams():
        cd = bpy.data.cameras.new("MapCam")
        cd.lens = 41
        cam = obj("MapCam", cd, C_PREV)
        cam.location = (0, -20.5, 29)
        tgt = obj("CamTarget", None, C_PREV)
        tgt.location = (0, 0.6, 0)
        tc = cam.constraints.new("TRACK_TO")
        tc.target = tgt
        tc.track_axis = "TRACK_NEGATIVE_Z"
        tc.up_axis = "UP_Y"
        scene.camera = cam
        fd = bpy.data.cameras.new("FollowCam")
        fd.lens = 34
        fc = obj("FollowCam", fd, C_PREV)
        prev_e = None
        for i, fr in enumerate(sch["frames"]):
            cp, ct = sch["cams"][i]
            fc.location = cp
            q = (Vector(ct) - Vector(cp)).to_track_quat("-Z", "Y")
            e = q.to_euler("XYZ", prev_e) if prev_e is not None else q.to_euler("XYZ")
            prev_e = e
            fc.rotation_euler = e
            fc.keyframe_insert("location", frame=fr)
            fc.keyframe_insert("rotation_euler", frame=fr)
        rd = bpy.data.cameras.new("RunnerCam")
        rd.lens = 50
        obj("RunnerCam", rd, C_PREV)

    soft("camera", setup_cams)
    soft("chữ nhãn", setup_text)

    # render
    def engine_ids():
        try:
            return [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
        except Exception:
            return []

    def setup_render():
        ids = engine_ids()
        if args.engine == "eevee":
            scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in ids else "BLENDER_EEVEE"
            for attr, val in (("taa_render_samples", max(16, args.samples)), ("use_raytracing", True),
                              ("use_gtao", True), ("use_bloom", True)):
                try:
                    setattr(scene.eevee, attr, val)
                except Exception:
                    pass
        else:
            scene.render.engine = "CYCLES"
            cy = scene.cycles
            cy.samples = args.samples
            for attr, val in (("use_adaptive_sampling", True), ("adaptive_threshold", 0.03), ("use_denoising", True),
                              ("denoiser", "OPENIMAGEDENOISE"), ("denoising_input_passes", "RGB_ALBEDO_NORMAL"),
                              ("max_bounces", 4), ("diffuse_bounces", 2), ("glossy_bounces", 2),
                              ("transmission_bounces", 2), ("caustics_reflective", False),
                              ("caustics_refractive", False), ("blur_glossy", 1.0)):
                try:
                    setattr(cy, attr, val)
                except Exception:
                    pass
            cy.device = "CPU"
            if args.gpu:
                try:
                    cp = bpy.context.preferences.addons["cycles"].preferences
                    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
                        try:
                            cp.compute_device_type = kind
                            cp.get_devices()
                            devs = [d for d in cp.devices if d.type == kind]
                            if devs:
                                for d in cp.devices:
                                    d.use = d.type == kind
                                cy.device = "GPU"
                                info("Cycles GPU: %s (%d thiết bị)" % (kind, len(devs)))
                                break
                        except Exception:
                            continue
                except Exception as e:
                    warn("GPU: %r" % e)
        try:
            scene.render.use_persistent_data = True
        except Exception:
            pass
        scene.render.use_motion_blur = True
        try:
            scene.render.motion_blur_shutter = 0.5
        except Exception:
            pass
        try:
            scene.view_settings.view_transform = "AgX"
        except Exception:
            pass
        for look in ("AgX - Medium High Contrast", "AgX - Punchy", "Medium High Contrast", "Punchy"):
            try:
                scene.view_settings.look = look
                break
            except Exception:
                continue
        scene.render.resolution_x = args.res
        scene.render.resolution_y = int(round(args.res * 16 / 9.0 / 2)) * 2
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGB"
        scene.render.film_transparent = False

    soft("thiết lập render", setup_render)
    scene.frame_set(1)

    if not args.no_blend:
        def save_blend():
            try:
                bpy.ops.file.pack_all()
            except Exception:
                pass
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "hyrox_race_map_v2.blend"), copy=True)
            info("đã lưu hyrox_race_map_v2.blend")
        soft("lưu .blend", save_blend)

    if args.render == "preview":
        def render_still(path_, cam, frame, rx=None, ry=None):
            scene.camera = cam
            scene.frame_set(frame)
            ox, oy = scene.render.resolution_x, scene.render.resolution_y
            if rx:
                scene.render.resolution_x, scene.render.resolution_y = rx, ry
            scene.render.filepath = path_
            bpy.ops.render.render(write_still=True)
            scene.render.resolution_x, scene.render.resolution_y = ox, oy

        mapcam = bpy.data.objects.get("MapCam")
        fcam = bpy.data.objects.get("FollowCam")
        rcam = bpy.data.objects.get("RunnerCam")
        soft("preview_map", render_still, os.path.join(out, "preview_map.png"), mapcam, mk["S5"] + 10)

        def render_clip():
            a = mk["S4_DONE"] - 14
            b = min(a + args.frames - 1, mk["S5"] + 30)
            fdir = os.path.join(out, "frames")
            os.makedirs(fdir, exist_ok=True)
            scene.camera = fcam
            fs, fe = scene.frame_start, scene.frame_end
            scene.frame_start, scene.frame_end = a, b
            scene.render.filepath = os.path.join(fdir, "f_")
            bpy.ops.render.render(animation=True)
            scene.frame_start, scene.frame_end = fs, fe
            info("đã render khung %d..%d (FollowCam)" % (a, b))

        soft("clip trạm 4→5", render_clip)

        def render_runner_shots():
            shots = [("Idle", 12)]
            r2 = [s_ for s_ in sch["segs"] if s_[0] == "run"][2]
            shots.append(("Run", (r2[1] + r2[2]) // 2))
            for k in range(8):
                shots.append((STATIONS[k][3], (mk["S%d" % (k + 1)] + mk["S%d_DONE" % (k + 1)]) // 2 + 4))
            shots.append(("Celebrate", mk["FINISH"] + 22))
            for name, fr in shots:
                scene.frame_set(fr)
                bpy.context.view_layer.update()
                mw = root.matrix_world
                cpos = mw @ Vector((1.5, -2.6, 1.35))
                tpos = mw @ Vector((0, 0, 0.78))
                rcam.location = cpos
                rcam.rotation_euler = (tpos - cpos).to_track_quat("-Z", "Y").to_euler()
                render_still(os.path.join(out, "runner_%s.png" % name), rcam, fr, 360, 360)
            info("đã render %d ảnh nhân vật" % len(shots))

        def with_low_samples(fn):
            try:
                old = scene.cycles.samples
                scene.cycles.samples = max(8, args.samples // 2)
            except Exception:
                old = None
            try:
                fn()
            finally:
                if old is not None:
                    scene.cycles.samples = old

        soft("ảnh nhân vật", with_low_samples, render_runner_shots)

    with open(os.path.join(out, "build_log.json"), "w", encoding="utf-8") as fh:
        json.dump(LOG, fh, ensure_ascii=False, indent=1)
    info("XONG. cảnh báo: %d" % len(LOG["warnings"]))


def glb_info(path_):
    """đọc phần JSON của .glb (thuần Python) → số mesh/animation/node, dung lượng"""
    import struct
    try:
        with open(path_, "rb") as fh:
            data = fh.read()
        magic, ver, length = struct.unpack_from("<III", data, 0)
        clen, ctype = struct.unpack_from("<II", data, 12)
        j = json.loads(data[20:20 + clen].decode("utf-8"))
        tris = 0
        for m in j.get("meshes", []):
            for p in m.get("primitives", []):
                if "indices" in p:
                    tris += j["accessors"][p["indices"]]["count"] // 3
        return {"bytes": len(data), "meshes": len(j.get("meshes", [])), "nodes": len(j.get("nodes", [])),
                "materials": len(j.get("materials", [])), "tris": tris,
                "animations": [a.get("name", "") for a in j.get("animations", [])],
                "skins": len(j.get("skins", [])), "extensionsUsed": j.get("extensionsUsed", [])}
    except Exception as e:  # noqa
        return {"error": repr(e)}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [a for a in sys.argv[1:] if a == "--selftest"]
    args = parse_args(argv)
    if args.selftest:
        selftest()
        return
    try:
        import bpy  # noqa
    except ImportError:
        print("Không có bpy: chạy trong Blender, hoặc dùng --selftest / export_pure.py")
        sys.exit(2)
    blender_main(args)


if __name__ == "__main__":
    main()
