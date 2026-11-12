#!/usr/bin/env python3
"""TapEasy intro — trang xem thử TỰ CHỨA (không cần server/mạng): nhiều khung compose.js dựng song song trong 1 trang
HTML + bảng đo khít (window probe) + góc màn phóng to. Dùng khi máy không có Playwright: mở file trong trình duyệt bất kỳ.

  python3 scripts/intro-video/preview_fit.py --fmt v --times 18.9,31.13,32.9 --out build/preview/v.html
  python3 scripts/intro-video/preview_fit.py --fmt v --corners 31.13,45.6 --out build/preview/corners.html
Ảnh app nhúng data-URI (thu về 1x, JPEG q72) chỉ cho các chương có mặt ở các mốc đã chọn; nền ảnh/clip bỏ qua.
"""
import argparse, base64, io, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")


def data_uri(path, w=None, q=72):
    from PIL import Image
    ext = os.path.splitext(path)[1].lower()
    if ext == ".svg":
        return "data:image/svg+xml;base64," + base64.b64encode(open(path, "rb").read()).decode()
    im = Image.open(path)
    if w and im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO()
    if ext == ".png" and im.mode == "RGBA":
        im.save(b, "PNG", optimize=True); mt = "png"
    else:
        im.convert("RGB").save(b, "JPEG", quality=q); mt = "jpeg"
    return f"data:image/{mt};base64," + base64.b64encode(b.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fmt", default="v")
    ap.add_argument("--times", default="")
    ap.add_argument("--corners", default="", help="mốc cần phóng 4 góc màn")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--thumb", type=float, default=0)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    W, H = (540, 960) if a.fmt == "v" else (960, 540)
    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    man = json.load(open(os.path.join(BUILD, "manifest.json"), encoding="utf-8"))
    times = [float(x) for x in a.times.split(",") if x]
    corners = [float(x) for x in a.corners.split(",") if x]
    allt = times + corners
    chs = set()
    for t in allt:
        for i, c in enumerate(tl["chapters"]):
            if c["t0"] - 1 <= t <= c["t1"] + 1:
                chs.add(i); chs.add(max(0, i - 1))
    need = {s["id"] for i in chs for s in tl["chapters"][i]["shots"]}
    D = {}
    shots = {}
    for sid, d in man["shots"].items():
        if sid not in need: continue
        shots[sid] = d
        D["build/" + d["base"]] = data_uri(os.path.join(BUILD, d["base"]), 390)
        for st in d.get("strips", []):
            D["build/" + st["src"]] = data_uri(os.path.join(BUILD, st["src"]), 390)
    man2 = dict(man); man2["shots"] = shots; man2["clip"] = None; man2["bg"] = {}
    for rel in ["assets/icon-192.png", "assets/brand/logo-wordmark-light.svg"]:
        D["../../" + rel] = data_uri(os.path.join(REPO, rel))
    if os.path.exists(os.path.join(BUILD, "qr-card.png")):
        D["build/qr-card.png"] = data_uri(os.path.join(BUILD, "qr-card.png"))
    css = open(os.path.join(HERE, "compose.css"), encoding="utf-8").read()
    js = open(os.path.join(HERE, "compose.js"), encoding="utf-8").read()
    sc = a.thumb or (0.30 if a.fmt == "v" else 0.36)
    cells = [{"t": t, "kind": "full"} for t in times] + [{"t": t, "kind": "corner", "c": k} for t in corners for k in range(4)]
    html = f"""<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>TapEasy intro — xem thử khít</title>
<style>{css}
html,body{{overflow:auto;background:#111;color:#eee;font:12px/1.35 system-ui,sans-serif}}
#rep{{padding:6px 8px;white-space:pre-wrap;font:11px/1.35 ui-monospace,monospace;color:#9f9}}
#grid{{display:flex;flex-wrap:wrap;gap:6px;padding:6px}}
.cell{{position:relative;overflow:hidden;background:#000;outline:1px solid #333}}
.cell .lab{{position:absolute;left:3px;top:2px;z-index:99;color:#ffd25a;font:600 11px system-ui;text-shadow:0 1px 2px #000}}
.cell .inner{{position:absolute;left:0;top:0;transform-origin:0 0}}
</style></head><body><div id="rep">đang dựng…</div><div id="grid"></div>
<script>window.__NO_AUTO=true;window.__TIMELINE__={json.dumps(tl, ensure_ascii=False)};window.__MANIFEST__={json.dumps(man2, ensure_ascii=False)};
const DATA={json.dumps(D)};</script>
<script>{js}</script>
<script>
(async()=>{{
const W={W},H={H},SC={sc},CELLS={json.dumps(cells)};
const grid=document.getElementById("grid"),rep=document.getElementById("rep");
const rows=[];let worst=0;
for(const c of CELLS){{
  const cell=document.createElement("div");cell.className="cell";grid.appendChild(cell);
  const inner=document.createElement("div");inner.className="inner";cell.appendChild(inner);
  const st=document.createElement("div");inner.appendChild(st);
  const lab=document.createElement("div");lab.className="lab";cell.appendChild(lab);
  const comp=window.__makeComposer({{stage:st,w:W,h:H,resolve:p=>DATA[p]||p}});
  await comp.ready; comp.render(c.t); await comp.settle(); comp.render(c.t); await comp.settle();
  const pr=comp.probe();
  if(c.kind==="full"){{
    cell.style.width=(W*SC)+"px";cell.style.height=(H*SC)+"px";inner.style.transform="scale("+SC+")";
    lab.textContent=c.t.toFixed(2)+"s";
    pr.forEach(p=>{{const e=Math.max(0,...p.shots.filter(s=>s.settled).map(s=>s.err));worst=Math.max(worst,e);
      rows.push(c.t.toFixed(2)+"s "+p.ch.padEnd(9)+" ảnh↔màn "+e.toFixed(2)+"px · tỉ lệ ảnh "+Math.max(0,...p.shots.map(s=>s.arErr||0)).toFixed(4)+
      " · island "+p.islandTop.toFixed(1)+"–"+p.islandBottom.toFixed(1)+" tâm "+p.islandCx.toFixed(2)+" · status "+p.statusH+" · home "+p.homeGap.toFixed(1)+" · kính "+p.glassErr.toFixed(2)+
      " · safe "+p.safe.top+"/"+p.safe.bottom+(p.qr?" · QR "+JSON.stringify(p.qr):""));}});
  }} else {{
    const p=pr[0]; if(!p) continue; const s=p.scr, Z=4, box=150;
    const pts=[[s.x,s.y],[s.x+s.w,s.y],[s.x,s.y+s.h],[s.x+s.w,s.y+s.h]][c.c];
    const ox=pts[0]+(c.c%2? -box/Z+8 : -8), oy=pts[1]+(c.c<2? -8 : -box/Z+8);
    cell.style.width=box+"px";cell.style.height=box+"px";
    inner.style.transform="scale("+Z+") translate("+(-ox)+"px,"+(-oy)+"px)";
    lab.textContent=c.t.toFixed(2)+"s "+["TL","TR","BL","BR"][c.c];
  }}
}}
rep.textContent="khít ảnh app ↔ màn mockup: lệch lớn nhất "+worst.toFixed(2)+"px ("+(worst<=1?"ĐẠT":"TRƯỢT")+")\\n"+rows.join("\\n");
console.log(rep.textContent);
}})();
</script></body></html>"""
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, "w", encoding="utf-8").write(html)
    print(a.out, f"{len(html) / 1e6:.1f} MB", len(cells), "ô")


if __name__ == "__main__":
    main()
