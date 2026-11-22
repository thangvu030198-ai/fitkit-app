"""
Xuất hyrox_map.glb / hyrox_runner.glb / hyrox_path.json bằng PYTHON THUẦN (không cần Blender).

Dùng lại toàn bộ lõi của build_scene_v2.py (đường, hình học, bộ xương, tư thế/IK, hoạt ảnh),
chỉ thay phần Blender bằng một bộ ghi glTF 2.0 nhỏ. Mục đích:
  1) kiểm thử viewer.html / app khi chưa chạy được Blender;
  2) dự phòng trong workflow nếu bước Blender lỗi (app vẫn có tài sản dùng được).
Khác bản Blender: không bo/áp modifier (không cần), khớp xương nghỉ không xoay (rest = khung nhân vật),
hoạt ảnh lấy mẫu mỗi khung (LINEAR). Tên node / clip / vật liệu giống bản Blender.

    python3 export_pure.py --out build/hyrox3d_pure
"""
import argparse
import json
import math
import os
import struct
import sys
from array import array

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_scene_v2 as B  # noqa: E402


class GLTF:
    def __init__(self, generator):
        self.j = {"asset": {"version": "2.0", "generator": generator}, "scene": 0, "scenes": [{"nodes": []}],
                  "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
        self.bin = bytearray()
        self.mat_idx = {}
        self.ext = set()

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            bv["target"] = target
        self.j["bufferViews"].append(bv)
        return len(self.j["bufferViews"]) - 1

    def accessor(self, flat, comp, typ, count, target=None, minmax=False, normalized=False):
        code = {"f": 5126, "H": 5123, "I": 5125, "B": 5121}[comp]
        data = array(comp, flat)
        if sys.byteorder != "little":
            data.byteswap()
        acc = {"bufferView": self._view(data.tobytes(), target), "componentType": code, "count": count, "type": typ}
        if normalized:
            acc["normalized"] = True
        if minmax:
            n = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[typ]
            acc["min"] = [min(flat[i::n]) for i in range(n)]
            acc["max"] = [max(flat[i::n]) for i in range(n)]
        self.j["accessors"].append(acc)
        return len(self.j["accessors"]) - 1

    def material(self, name):
        if name in self.mat_idx:
            return self.mat_idx[name]
        d = B.MATS[name]
        m = {"name": name, "pbrMetallicRoughness": {"baseColorFactor": list(d["color"]) + [1.0],
                                                   "metallicFactor": d.get("metal", 0.0),
                                                   "roughnessFactor": d["rough"]}}
        if d.get("emit") is not None and d.get("strength", 0) > 0:
            s = d["strength"]
            m["emissiveFactor"] = [c * min(s, 1.0) for c in d["emit"]]
            if s > 1.0:
                m["extensions"] = {"KHR_materials_emissive_strength": {"emissiveStrength": s}}
                self.ext.add("KHR_materials_emissive_strength")
        self.j["materials"].append(m)
        self.mat_idx[name] = len(self.j["materials"]) - 1
        return self.mat_idx[name]

    def mesh(self, name, geo, origin=(0.0, 0.0, 0.0), skin_joints=None):
        """geo (Blender Z-up) → mesh glTF (Y-up), 1 primitive / vật liệu"""
        prims = []
        mats = []
        for m in geo.fm:
            if m not in mats:
                mats.append(m)
        for mname in mats:
            remap, P, N, J, W, I = {}, [], [], [], [], []
            for f, fm in zip(geo.f, geo.fm):
                if fm != mname:
                    continue
                ids = []
                for vi in f:
                    if vi not in remap:
                        remap[vi] = len(remap)
                        p = B.to_gl(B.v_sub(geo.v[vi], origin))
                        n = B.to_gl(geo.n[vi])
                        P += p
                        N += n
                        if skin_joints is not None:
                            J += [skin_joints[geo.vg[vi]], 0, 0, 0]
                            W += [1.0, 0.0, 0.0, 0.0]
                    ids.append(remap[vi])
                for k in range(1, len(ids) - 1):
                    I += [ids[0], ids[k], ids[k + 1]]
            cnt = len(remap)
            attrs = {"POSITION": self.accessor(P, "f", "VEC3", cnt, 34962, minmax=True),
                     "NORMAL": self.accessor(N, "f", "VEC3", cnt, 34962)}
            if skin_joints is not None:
                attrs["JOINTS_0"] = self.accessor(J, "B", "VEC4", cnt, 34962)
                attrs["WEIGHTS_0"] = self.accessor(W, "f", "VEC4", cnt, 34962)
            comp = "H" if cnt < 65535 else "I"
            prims.append({"attributes": attrs, "indices": self.accessor(I, comp, "SCALAR", len(I), 34963),
                          "material": self.material(mname)})
        self.j["meshes"].append({"name": name, "primitives": prims})
        return len(self.j["meshes"]) - 1

    def node(self, d, root=False):
        self.j["nodes"].append(d)
        idx = len(self.j["nodes"]) - 1
        if root:
            self.j["scenes"][0]["nodes"].append(idx)
        return idx

    def write(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j["buffers"] = [{"byteLength": len(self.bin)}]
        if self.ext:
            self.j["extensionsUsed"] = sorted(self.ext)
        for k in ("animations", "skins"):
            if k in self.j and not self.j[k]:
                del self.j[k]
        js = json.dumps(self.j, separators=(",", ":")).encode("utf-8")
        while len(js) % 4:
            js += b" "
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(js), 0x4E4F534A))
            fh.write(js)
            fh.write(struct.pack("<II", len(self.bin), 0x004E4942))
            fh.write(self.bin)
        return total


def export_map(path, out):
    G, ring_p, ring_pos, info = B.build_map_geo(path)
    g = GLTF("TapEasy export_pure.py (map)")
    g.node({"name": "Map_Static", "mesh": g.mesh("Map_Static", G)}, root=True)
    rg = B.Geo().add(ring_p, "Ring", B.m_S(1, 1, 0.4))
    rm = g.mesh("StatusRing", rg)
    for k, p in enumerate(ring_pos):
        g.node({"name": "StatusRing_%02d" % (k + 1), "mesh": rm, "translation": list(B.to_gl(p))}, root=True)
    for k in range(8):
        xf, w, th = B.station_frame(path, k)
        g.node({"name": "Anchor_S%02d" % (k + 1), "translation": list(B.to_gl(w))}, root=True)
    for nm, s in (("Anchor_Start", B.START_S), ("Anchor_Finish", B.FINISH_F * path.L)):
        p = path.pos(s)
        g.node({"name": nm, "translation": list(B.to_gl((p[0], p[1], 0)))}, root=True)
    return g.write(os.path.join(out, "hyrox_map.glb")), G.tris() + rg.tris()


def export_runner(out):
    g = GLTF("TapEasy export_pure.py (runner)")
    g.j["skins"], g.j["animations"] = [], []
    rig = g.node({"name": "RunnerRig", "children": []}, root=True)
    jidx = {}
    for name, parent, h, t in B.BONES:
        ph = B.BONE[parent][2] if parent else (0.0, 0.0, 0.0)
        n = g.node({"name": name, "translation": list(B.to_gl(B.v_sub(h, ph))), "children": []})
        jidx[name] = n
        if parent:
            g.j["nodes"][jidx[parent]]["children"].append(n)
        else:
            g.j["nodes"][rig]["children"].append(n)
    order = [b[0] for b in B.BONES]
    joint_of = {name: i for i, name in enumerate(order)}
    RG = B.build_runner_geo()
    body_mesh = g.mesh("RunnerBody", RG, skin_joints=joint_of)
    ibm = []
    for name in order:
        hx, hy, hz = B.to_gl(B.BONE[name][2])
        ibm += [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -hx, -hy, -hz, 1]
    skin = {"joints": [jidx[n] for n in order], "skeleton": jidx["Hips"],
            "inverseBindMatrices": g.accessor(ibm, "f", "MAT4", len(order))}
    g.j["skins"].append(skin)
    body = g.node({"name": "RunnerBody", "mesh": body_mesh, "skin": 0})
    g.j["nodes"][rig]["children"].append(body)
    for pname, spec in B.prop_specs().items():
        pg = B.build_prop_geo(spec)
        pm = g.mesh(pname, pg, origin=B.BONE[spec["bone"]][2])
        pn = g.node({"name": pname, "mesh": pm})
        g.j["nodes"][jidx[spec["bone"]]]["children"].append(pn)
    for n in g.j["nodes"]:
        if "children" in n and not n["children"]:
            del n["children"]
    hips_rest = B.to_gl(B.BONE["Hips"][2])
    for aname in B.ACTION_NAMES:
        N, frames = B.action_frames(aname)
        times = [f / B.FPS for f in range(N + 1)]
        t_acc = g.accessor(times, "f", "SCALAR", len(times), minmax=True)
        rots = {n: [] for n in order}
        trans = []
        prev = {}
        for P in frames:
            rot, off = B.solve_pose(P)
            for n in order:
                q = B.q_to_gl(rot[n])
                if n in prev and sum(a * b for a, b in zip(prev[n], q)) < 0:
                    q = tuple(-c for c in q)
                prev[n] = q
                w, x, y, z = q
                rots[n] += [x, y, z, w]
            trans += list(B.v_add(hips_rest, B.to_gl(off)))
        samplers, channels = [], []
        for n in order:
            samplers.append({"input": t_acc, "output": g.accessor(rots[n], "f", "VEC4", len(times)),
                             "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": jidx[n], "path": "rotation"}})
        samplers.append({"input": t_acc, "output": g.accessor(trans, "f", "VEC3", len(times)), "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": jidx["Hips"], "path": "translation"}})
        g.j["animations"].append({"name": aname, "samplers": samplers, "channels": channels})
    return g.write(os.path.join(out, "hyrox_runner.glb")), RG.tris()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="build/hyrox3d_pure")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    path = B.Path2D()
    mb, mt = export_map(path, a.out)
    rb, rt = export_runner(a.out)
    js = B.build_path_json(path)
    js["generator"] = "scripts/hyrox3d/export_pure.py"
    with open(os.path.join(a.out, "hyrox_path.json"), "w", encoding="utf-8") as fh:
        json.dump(js, fh, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps({"hyrox_map.glb": {"bytes": mb, "tris": mt}, "hyrox_runner.glb": {"bytes": rb, "tris": rt},
                      "map_info": B.glb_info(os.path.join(a.out, "hyrox_map.glb")),
                      "runner_info": B.glb_info(os.path.join(a.out, "hyrox_runner.glb"))}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
