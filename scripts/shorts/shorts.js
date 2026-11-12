/* =========================================================================
   TapEasy Shorts — bộ dựng khung 1080×1920: mỗi khung = render(t) THUẦN (không Date.now / random / fetch khi vẽ).
   Dữ liệu: window.__PLAN__ (prep.js → build/plans/<id>.js, tính bởi engine.js) + window.__MANIFEST__ (ảnh app đã chụp).
   API cho render.py: __ready, __render(t), __probe() (hộp chữ cho QA), __cover(), __blurSamples(t), __cuts().
   ?id=<short>&t=12.3 xem 1 khung · &play=1 phát thử · &cover=1 ảnh bìa.
   Không hiện URL nào: CTA duy nhất là QR cộng đồng Zalo ở thẻ kết.
   ========================================================================= */
(function(){
"use strict";
const ROOT = typeof window !== "undefined" ? window : globalThis;
const E = ROOT.ShortsEngine;

function makeComposer(opts){
const P = opts.plan, MAN = opts.manifest || { shots:{} }, stage = opts.stage;
const W = 1080, H = 1920, Z = E.ZONES, VZ = Z.vis;
const FPS = P.fps || 30;
const RES = opts.res || {};
const appSrc = p => (RES.app || "build/app/") + p;
const imgSrc = key => {
  if(!key) return "";
  const [kind, id] = String(key).split(":");
  if(kind === "people") return (RES.assets || "build/assets/") + "people/" + id + ".webp";
  if(kind === "food") return (RES.assets || "build/assets/") + "food/" + id + ".webp";
  return key;
};

/* ---------------- tiện ích ---------------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eOutCubic = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const eInCubic = x => Math.pow(clamp(x, 0, 1), 3);
const eIO = x => { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => clamp((t - a) / d, 0, 1);
function spring(x, k, c){ if(x <= 0) return 0; const w = Math.sqrt(k), z = c / (2 * w); if(z >= 1) return 1 - (1 + w * x) * Math.exp(-w * x);
  const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + z * w / wd * Math.sin(wd * x)); }
function el(tag, cls, parent, txt){ const e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; if(parent) parent.appendChild(e); return e; }
function put(e, x, y, w, h){ e.style.left = x + "px"; e.style.top = y + "px"; if(w != null) e.style.width = w + "px"; if(h != null) e.style.height = h + "px"; return e; }
function show(e, on){ if(!e) return; const v = on ? "" : "none"; if(e.style.display !== v) e.style.display = v; e.__vis = !!on; }
function op(e, o){ e.style.opacity = String(Math.round(clamp(o, 0, 1) * 1000) / 1000); e.__op = o; }
function tf(e, s){ if(e.style.transform !== s) e.style.transform = s; }
const pending = new Set();
function img(src, cls, parent){
  const i = el("img", cls, parent); i.decoding = "sync"; i.alt = "";
  if(src){ i.src = src; pending.add(i); i.onerror = () => { i.style.visibility = "hidden"; i.__bad = true; }; }
  return i;
}
function setSrc(i, src){ if(i.__src === src) return; i.__src = src; i.src = src; pending.add(i); }
const num = (v, dec) => E.fmtNum(v, dec || 0);
const tq = (e, name) => { e.setAttribute("data-qa", name); return e; };

/* ---------------- dựng khung tĩnh ---------------- */
stage.innerHTML = "";
const bg = el("div", "bg", stage);
el("div", "base", bg);
const blobs = [["#33D6C9", 620, 820, -140], ["#02BCB3", 520, 1140, 1180], ["#FF7A45", 380, 760, 1500]].map(([c, s, x, y]) => {
  const b = el("div", "blob", bg); b.style.background = c; put(b, x - s / 2, y - s / 2, s, s); b.__x = x - s / 2; b.__y = y - s / 2; return b; });
el("div", "grid", bg);
const bgKeys = Array.from(new Set([P.bg].concat(P.beats.map(b => b.bg)).filter(Boolean)));
const bgImgs = {}; bgKeys.forEach(k => { const i = img(imgSrc(k), "ph", bg); show(i, false); bgImgs[k] = i; });
el("div", "tint", bg);

const vis = put(el("div", "vis", stage), VZ.x, VZ.y, VZ.w, VZ.h);
const headBox = put(el("div", "head", stage), Z.head.x, Z.head.y, Z.head.w, Z.head.h);
const kick = put(el("div", "kick", stage), Z.kicker.x, Z.kicker.y);
const logo = el("span", "logo", kick); logo.innerHTML = "Tap<b>Easy</b>"; el("span", "bar", kick); tq(el("span", "", kick, P.kicker || ""), "kicker");
const capBox = put(el("div", "cap", stage), Z.cap.x, Z.cap.y, Z.cap.w, Z.cap.h);
const srcBox = put(el("div", "src", stage), Z.src.x, Z.src.y, Z.src.w, Z.src.h);
const srcLines = [P.sources, P.disclaimer].filter(Boolean);
srcLines.forEach((s, i) => tq(el("div", "", srcBox, s), "src" + i));
if(srcLines.length === 1) srcBox.style.top = (Z.src.y + 24) + "px";
const flash = el("div", "flash", stage);
const endL = el("div", "end", stage);
const progBar = el("div", "prog", stage); const progI = el("i", "", progBar);
P.beats.slice(1).concat([{ t0:P.end.t0 }]).forEach(b => { const m = el("b", "", progBar); m.style.left = (b.t0 / P.duration * W).toFixed(1) + "px"; });
const grain = el("div", "grain", stage);
el("div", "vign", stage);

/* hạt nhiễu: 4 ô 256×256 sinh 1 lần bằng PRNG có hạt giống (tất định) */
const grainTiles = [];
(function(){
  try{
    let seed = 20261113; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for(let k = 0; k < 4; k++){
      const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext && c.getContext("2d"); if(!g) break;
      const d = g.createImageData(256, 256);
      for(let i = 0; i < d.data.length; i += 4){ const v = Math.floor(rnd() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); grainTiles.push("url(" + c.toDataURL("image/png") + ")");
    }
  }catch(e){}
})();

/* ---------------- tiêu đề theo nhịp ---------------- */
const heads = P.beats.map(b => {
  const box = el("div", "", headBox); show(box, false);
  const size = b.hsize; const words = [];
  b.h.forEach((line, li) => {
    const ln = tq(el("div", "ln" + (li === b.acc ? " acc" : ""), box), "head");
    String(line).split(/\s+/).filter(Boolean).forEach((w, wi) => {
      const s = el("span", "w", ln, w); s.style.fontSize = size + "px";
      if(wi) ln.appendChild(document.createTextNode(" "));
      words.push(s);
    });
  });
  return { box, words };
});

/* ---------------- phụ đề karaoke ---------------- */
const caps = P.chunks.filter(c => !c.hidden).map(c => {
  const box = el("div", "", capBox); show(box, false);
  const ws = [];
  c.lines.forEach(line => {
    const l = el("div", "cl", box); const pl = tq(el("span", "pl", l), "cap");
    line.forEach((w, i) => { if(i) pl.appendChild(document.createTextNode(" ")); const s = el("span", "cw", pl, w.w); ws.push({ s, t0:w.t0, t1:w.t1 }); });
  });
  return { c, box, ws };
});

/* ---------------- các mảnh hình (piece) ---------------- */
const CARD = { x:20, y:14, w:880, h:728 };               // toạ độ trong .vis (vis.x = 40) → chữ trong x 60…940
const pieces = [];
P.beats.forEach(b => b.pieces.forEach(p => { const node = build(p, b); node.root.className += " piece"; vis.appendChild(node.root); show(node.root, false); pieces.push({ p, b, node }); }));

function glassCard(root){ return put(el("div", "glass", root), CARD.x, CARD.y, CARD.w, CARD.h); }
function cardTitle(root, text, y){ if(!text) return null; return tq(put(el("div", "ctitle", root, text), CARD.x + 52, CARD.y + (y || 46)), "card"); }

function build(p, b){
  const root = el("div", "");
  const N = { root, upd: () => {} };
  const k = p.k;
  if(k === "img"){
    const box = el("div", "pimg", root); const i = img(imgSrc(p.src), "", box); el("div", "shade", box); el("div", "rim", box);
    N.upd = lt => { tf(i, `scale(${(1.04 + 0.05 * clamp(lt / Math.max(1, p.t1 - p.t0), 0, 1)).toFixed(4)}) translateY(${(-10 * lt).toFixed(1)}px)`); };
  }
  else if(k === "duo"){
    const tiles = [p.a, p.b].map((d, j) => {
      const t = put(el("div", "glass", root), 20 + j * 452, 150, 428, 460);
      const a = tq(put(el("div", "big", t, d.t), 0, 120, 428), "card"); a.style.textAlign = "center"; a.style.fontSize = "150px"; if(j) a.style.color = "#FF7A45";
      const s = tq(put(el("div", "lbl", t, d.s), 0, 300, 428), "card"); s.style.textAlign = "center"; s.style.fontSize = "40px";
      return t;
    });
    N.upd = (lt, t) => tiles.forEach((tl, j) => { const q = spring(t - p.steps[j], 170, 18); op(tl, clamp(q * 1.5, 0, 1)); tf(tl, `translateY(${((1 - q) * 120).toFixed(1)}px) scale(${(0.9 + 0.1 * q).toFixed(4)})`); });
  }
  else if(k === "formula"){
    glassCard(root); cardTitle(root, p.title);
    const rows = p.lines.map((s, j) => { const r = tq(put(el("div", "row fline", root), 96, 150 + j * 130), "card"); el("i", "hl", r); r.appendChild(document.createTextNode(s)); return r; });
    N.upd = (lt, t) => rows.forEach((r, j) => { const q = eOutExpo(prog(t, p.steps[j], 0.45)); op(r, q); tf(r, `translateX(${((1 - q) * -60).toFixed(1)}px)`);
      const cur = t >= p.steps[j] && (j === rows.length - 1 || t < p.steps[j + 1]); r.firstChild.style.opacity = cur ? "1" : "0.25"; });
  }
  else if(k === "calc"){
    glassCard(root); cardTitle(root, p.title);
    const rows = p.rows.map((rw, j) => { const r = tq(put(el("div", "row crow", root), 76, 130 + j * 96, 768), "card"); r.appendChild(document.createTextNode(rw[0])); el("span", "r", r, rw[1]); return r; });
    const sep = put(el("div", "sep", root), 76, 130 + p.rows.length * 96 + 6, 768);
    let tot = null, tv = null;
    if(p.total){ tot = tq(put(el("div", "row ctotal", root), 76, 130 + p.rows.length * 96 + 40), "card"); el("span", "l", tot, p.total.l); if(p.total.pre) el("span", "", tot, p.total.pre); tv = el("span", "", tot, "0"); if(p.total.suf) el("span", "", tot, p.total.suf); }
    N.upd = (lt, t) => {
      rows.forEach((r, j) => { const q = eOutExpo(prog(t, p.steps[j], 0.4)); op(r, q); tf(r, `translateY(${((1 - q) * 30).toFixed(1)}px)`); });
      if(tot){ const s = p.steps[p.steps.length - 1]; const q = eOutCubic(prog(t, s, 0.9)); op(tot, prog(t, s, 0.2)); op(sep, prog(t, s - 0.1, 0.2)); tv.textContent = num(p.total.v * q, 0); tf(tot, `scale(${(0.9 + 0.1 * spring(t - s, 260, 20)).toFixed(4)})`); }
    };
  }
  else if(k === "bars"){
    glassCard(root); cardTitle(root, p.title);
    const n = p.rows.length, gap = Math.min(128, (CARD.h - 190) / n);
    const rows = p.rows.map((rw, j) => {
      const y = 140 + j * gap;
      const l = tq(put(el("div", "row blab", root), 72, y), "card"); l.textContent = rw[0];
      const bar = put(el("div", "bar" + (j === p.hi ? "" : (p.hi === -1 ? "" : " dim")), root), 72, y + 46, 776, Math.min(46, gap - 58));
      const fill = el("i", "", bar);
      const v = tq(put(el("div", "row bval", root), 600, y - 6, 248), "card");
      return { l, bar, fill, v, val:rw[1] };
    });
    if(p.note) tq(put(el("div", "note", root), 72, CARD.y + CARD.h - 66), "card").textContent = p.note;
    const fmt = (v) => (p.fmt || "{v}").replace("{v}", num(v, p.dec || 0));
    N.upd = (lt, t) => rows.forEach((r, j) => { const q = eOutCubic(prog(t, p.steps[j], 0.7)); const a = prog(t, p.steps[j], 0.2);
      op(r.l, a); op(r.bar, a); op(r.v, a); r.fill.style.width = (q * clamp(r.val / (p.max || 1), 0, 1) * 100).toFixed(2) + "%"; r.v.textContent = fmt(r.val * q); });
  }
  else if(k === "stat"){
    glassCard(root);
    const big = tq(put(el("div", "row big" + (p.warn ? " warn" : ""), root), 64, 170, 792), "card"); big.style.textAlign = "center"; big.style.fontSize = "250px";
    if(p.pre) el("span", "pre", big, p.pre); const v = el("span", "", big, "0"); if(p.suf) el("span", "suf", big, p.suf);
    const lb = tq(put(el("div", "row lbl", root), 64, 470, 792, null), "card"); lb.style.textAlign = "center"; lb.textContent = p.label || ""; if([...lb.textContent].length > 28) lb.style.fontSize = "36px";
    const sb = p.sub ? tq(put(el("div", "row sub", root), 64, 548, 792), "card") : null; if(sb){ sb.style.textAlign = "center"; sb.textContent = p.sub; }
    N.upd = (lt, t) => { const s = p.steps[0]; const q = eOutCubic(prog(t, s - 0.15, 0.95)); v.textContent = num(p.v * q, p.dec || 0);
      tf(big, `scale(${(0.82 + 0.18 * spring(t - s + 0.15, 200, 16)).toFixed(4)})`); op(big, prog(t, s - 0.2, 0.15)); op(lb, prog(t, s + 0.15, 0.3)); if(sb) op(sb, prog(t, s + 0.35, 0.3)); };
  }
  else if(k === "compare"){
    glassCard(root); cardTitle(root, p.title);
    const rows = p.rows.map((rw, j) => { const c = put(el("div", "cmp" + (j === p.rows.length - 1 ? " hi" : ""), root), 60, 140 + j * 210, 800, 180);
      tq(put(el("div", "a", c, rw[0]), 40, 30), "card"); const bb = tq(put(el("div", "b", c, rw[1]), 40, 96, 720), "card"); bb.style.textAlign = "left"; return c; });
    const nt = p.note ? tq(put(el("div", "note", root, p.note), 72, 140 + p.rows.length * 210 + 20), "card") : null;
    N.upd = (lt, t) => { rows.forEach((r, j) => { const q = spring(t - p.steps[j], 220, 22); op(r, clamp(q * 1.4, 0, 1)); tf(r, `translateX(${((1 - q) * (j % 2 ? 140 : -140)).toFixed(1)}px)`); });
      if(nt) op(nt, prog(t, p.steps[p.steps.length - 1] + 0.3, 0.3)); };
  }
  else if(k === "list"){
    glassCard(root); cardTitle(root, p.title);
    const rows = p.items.map((s, j) => { const r = tq(put(el("div", "row li", root), 72, 150 + j * 170, 776), "card"); el("span", "n", r, String(j + 1));
      const tx = el("div", "", r, s); tx.style.marginLeft = "92px"; tx.style.whiteSpace = "normal"; r.style.whiteSpace = "normal"; return r; });
    N.upd = (lt, t) => rows.forEach((r, j) => { const q = eOutExpo(prog(t, p.steps[j], 0.45)); op(r, q); tf(r, `translateY(${((1 - q) * 40).toFixed(1)}px)`); });
  }
  else if(k === "week"){
    glassCard(root); cardTitle(root, p.title);
    const days = p.days.map((d, j) => { const c = put(el("div", "day", root), 60, 112 + j * 86, 800, 74); tq(el("div", "d", c, d[0]), "card"); tq(el("div", "t", c, d[1]), "card"); c.__type = d[2]; return c; });
    days.forEach(c => { c.querySelector(".d").style.top = "16px"; c.querySelector(".t").style.top = "16px"; });
    N.upd = (lt, t) => days.forEach((c, j) => { const q = eOutExpo(prog(t, p.steps[0] + j * 0.06, 0.4)); op(c, q); tf(c, `translateX(${((1 - q) * 80).toFixed(1)}px)`);
      const on = t >= p.steps[1]; const cls = "day" + (on && c.__type === "a" ? " a" : on && c.__type === "c" ? " c" : ""); if(c.className !== cls) c.className = cls; });
  }
  else if(k === "food"){
    const n = p.items.length;
    const size = n === 1 ? 400 : n === 2 ? 340 : n === 3 ? 250 : 220;
    const pos = n === 1 ? [[460, 280]] : n === 2 ? [[230, 260], [690, 260]] : n === 3 ? [[230, 150], [690, 150], [460, 480]] : [[250, 140], [670, 140], [250, 480], [670, 480]];
    const items = p.items.map((it, j) => {
      const [cx, cy] = pos[j] || pos[0];
      const f = put(el("div", "food", root), cx - size / 2, cy - size / 2, size, size + 140);
      const pl = put(el("div", "plate", f), 0, 0, size, size); img(imgSrc("food:" + it.id), "", pl);
      const ft = tq(put(el("div", "ft", f, it.t), -20, size + 10, size + 40), "card"); ft.style.whiteSpace = "normal"; ft.style.fontSize = (n >= 3 ? 30 : 34) + "px";
      if(it.v){ tq(put(el("div", "fv", f, it.v), -20, size + 86, size + 40), "card"); }
      return f;
    });
    N.upd = (lt, t) => items.forEach((f, j) => { const q = spring(t - p.steps[j], 240, 16); op(f, clamp(q * 2, 0, 1)); tf(f, `scale(${(0.6 + 0.4 * q).toFixed(4)}) rotate(${((1 - q) * (j % 2 ? 8 : -8)).toFixed(2)}deg)`); });
  }
  else if(k === "myth"){
    glassCard(root);
    const q1 = tq(put(el("div", "row claim", root), 70, 140, 780), "card"); q1.style.whiteSpace = "normal"; q1.textContent = "“" + p.claim + "”";
    const st = tq(put(el("div", "stamp" + (p.verdict === "?" ? " q" : ""), root, p.verdict), 0, 0), "card");
    st.style.left = (p.verdict === "?" ? 380 : 250) + "px"; st.style.top = "420px";
    N.upd = (lt, t) => { op(q1, prog(t, p.steps[0], 0.3)); const s = p.steps[1]; const q = spring(t - s, 300, 18);
      op(st, prog(t, s, 0.08)); tf(st, `rotate(${p.verdict === "?" ? 0 : -8}deg) scale(${(2.2 - 1.2 * q).toFixed(4)})`); };
  }
  else if(k === "chart"){
    glassCard(root); cardTitle(root, p.title);
    const col = p.color === "coral" ? "#FF7A45" : "#33D6C9";
    const gx = 80, gy = 150, gw = 760, gh = 380; const pts = p.pts, lo = Math.min(...pts), hi = Math.max(...pts), pad = (hi - lo) * 0.15 || 1;
    const X = i => gx + gw * i / (pts.length - 1), Y = v => gy + gh - gh * (v - lo + pad) / (hi - lo + 2 * pad);
    let d = "", len = 0; pts.forEach((v, i) => { d += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; if(i) len += Math.hypot(X(i) - X(i - 1), Y(v) - Y(pts[i - 1])); });
    const grid = [0, 1, 2, 3].map(i => `<line x1="${gx}" x2="${gx + gw}" y1="${gy + gh * i / 3}" y2="${gy + gh * i / 3}" stroke="rgba(255,255,255,.08)" stroke-width="2"/>`).join("");
    const wk = [0, 4, 8, 12].map(i => `<text x="${X(i)}" y="${gy + gh + 44}" fill="rgba(245,247,243,.55)" font-size="26" font-family="JetBrains Mono, monospace" text-anchor="middle">T${i}</text>`).join("");
    const box = el("div", "chart", root);
    box.innerHTML = `<svg width="920" height="756" viewBox="0 0 920 756">${grid}${wk}<path class="area" d="${d}L${X(pts.length - 1)} ${gy + gh} L${gx} ${gy + gh} Z" fill="${col}" opacity="0"/><path class="ln" d="${d}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${len.toFixed(1)}"/><circle class="dot" r="14" fill="#fff" stroke="${col}" stroke-width="6" cx="${X(0)}" cy="${Y(pts[0])}"/></svg>`;
    const ln = box.querySelector(".ln"), area = box.querySelector(".area"), dot = box.querySelector(".dot");
    const a0 = tq(put(el("div", "row kv", root), 80, 590), "card"); el("small", "", a0, "TUẦN 0"); const av = el("span", "", a0, num(pts[0], p.dec));
    const a1 = tq(put(el("div", "row kv", root), 520, 590, 320), "card"); a1.style.textAlign = "right"; el("small", "", a1, "TUẦN 12"); const bv = el("span", "", a1, num(pts[0], p.dec));
    if(p.unit) [a0, a1].forEach(a => el("span", "", a, " " + p.unit));
    const bd = tq(put(el("div", "badge" + (p.color === "coral" ? " cor" : ""), root, p.badge || "Số liệu minh hoạ"), 0, 0), "card"); bd.style.right = "64px"; bd.style.left = "auto"; bd.style.top = "52px";
    N.upd = (lt, t) => {
      const q = eIO(prog(t, p.steps[0], Math.max(0.6, p.steps[1] - p.steps[0] + 0.3)));
      ln.setAttribute("stroke-dashoffset", (len * (1 - q)).toFixed(1)); area.setAttribute("opacity", (0.12 * q).toFixed(3));
      const fi = q * (pts.length - 1), i0 = Math.floor(fi), fr = fi - i0, i1 = Math.min(pts.length - 1, i0 + 1);
      const cv = lerp(pts[i0], pts[i1], fr); dot.setAttribute("cx", lerp(X(i0), X(i1), fr).toFixed(1)); dot.setAttribute("cy", Y(cv).toFixed(1));
      bv.textContent = num(cv, p.dec); op(a1, prog(t, p.steps[0], 0.3)); op(a0, prog(t, p.steps[0] - 0.2, 0.3));
    };
  }
  else if(k === "beforeafter"){
    glassCard(root); cardTitle(root, p.title);
    const hd = tq(put(el("div", "row note", root), 380, 120, 470), "card"); hd.textContent = (p.a || "") + "  →  " + (p.b || ""); hd.style.textAlign = "right";
    const mx = Math.max(...p.rows.map(r => r[2]));
    const rows = p.rows.map((rw, j) => { const y = 190 + j * 180;
      const l = tq(put(el("div", "row blab", root), 72, y), "card"); l.textContent = rw[0];
      const bar = put(el("div", "bar", root), 72, y + 52, 776, 50); const ghost = el("i", "", bar); ghost.style.background = "rgba(255,122,69,.55)"; const fill = el("i", "", bar);
      const v = tq(put(el("div", "row bval", root), 520, y - 8, 328), "card");
      return { l, bar, ghost, fill, v, a:rw[1], b:rw[2] }; });
    N.upd = (lt, t) => rows.forEach((r, j) => { const s = p.steps[j]; const a = prog(t, s, 0.2), q = eOutCubic(prog(t, s + 0.25, 0.9));
      op(r.l, a); op(r.bar, a); op(r.v, a); r.ghost.style.width = (r.a / mx * 100).toFixed(2) + "%"; const cur = lerp(r.a, r.b, q);
      r.fill.style.width = (cur / mx * 100 * (q > 0 ? 1 : 0)).toFixed(2) + "%"; r.v.textContent = num(r.a, 0) + " → " + num(cur, 0) + " " + (p.unit || ""); });
  }
  else if(k === "heat"){
    glassCard(root); cardTitle(root, p.title);
    const weeks = p.weeks || 12, per = p.per || 3, miss = new Set(p.miss || []), cw = 54, gap = 12, gx = 460 - (weeks * (cw + gap) - gap) / 2, gy = 150;
    const cells = []; for(let w = 0; w < weeks; w++) for(let d = 0; d < per; d++){ const c = put(el("div", "cell", root), gx + w * (cw + gap), gy + d * (cw + gap), cw, cw); cells.push({ c, i:w * per + d }); }
    const tot = weeks * per - miss.size;
    const cnt = tq(put(el("div", "row big", root), 64, gy + per * (cw + gap) + 40, 792), "card"); cnt.style.textAlign = "center"; cnt.style.fontSize = "180px"; const cv = el("span", "", cnt, "0"); el("span", "suf", cnt, " buổi");
    N.upd = (lt, t) => { const q = eIO(prog(t, p.steps[0], Math.max(0.5, p.steps[2] - p.steps[0])));
      let on = 0; cells.forEach(({ c, i }) => { const lit = !miss.has(i) && i < q * weeks * per; const cls = "cell" + (lit ? " on" : ""); if(c.className !== cls) c.className = cls; if(lit) on++; });
      cv.textContent = String(on); op(cnt, prog(t, p.steps[0], 0.2)); void tot; };
  }
  else if(k === "phone" || k === "themes"){
    const ph = buildPhone(root);
    const shots = k === "themes" ? p.shots : [p.shot];
    const layers = shots.map(id => shotLayer(ph.scr, id, p));
    let chip = null;
    if(k === "themes"){ chip = tq(put(el("div", "tchip", root, ""), 0, 30), "card"); }
    const tapEl = p.tap ? el("div", "tap", ph.scr) : null;
    N.upd = (lt, t) => {
      const dur = p.t1 - p.t0;
      let idx = 0; if(k === "themes"){ for(let j = 0; j < p.steps.length; j++) if(t >= p.steps[j] - 0.25) idx = j; }
      layers.forEach((L, j) => { show(L.box, j === idx || (k === "themes" && j === idx - 1 && t < p.steps[idx] - 0.05));
        if(j === idx){ L.box.style.zIndex = "2"; const q = k === "themes" ? eOutCubic(prog(t, p.steps[idx] - 0.25, 0.3)) : 1; op(L.box, q); L.upd(lt, dur, t); } else L.box.style.zIndex = "1"; });
      if(chip){ chip.textContent = (p.names || [])[idx] || ""; const q = spring(t - (p.steps[idx] - 0.25), 300, 20); tf(chip, `scale(${(0.7 + 0.3 * q).toFixed(4)})`); op(chip, clamp(q * 2, 0, 1));
        chip.style.left = (480 - Math.min(760, 26 * [...chip.textContent].length + 60) / 2) + "px"; }
      // khung phone: trôi nhẹ + phóng vào vùng focus
      const L = layers[idx]; const f = L.focus;
      let s = 0.843, fx = 0, fy = 0;
      if(f){ const q = eIO(prog(lt, 0.35, 0.55));
        s = 0.843 * Math.exp(Math.log(f[4]) * q);                       // phóng theo thang log (cảm nhận đều)
        const cx = 17 + f[0] + f[2] / 2 - 212, cy = 17 + f[1] + f[3] / 2 - 439;
        fx = -cx * s * q * 0.85; fy = -cy * s * q * 0.85; }
      const drift = Math.sin((t + p.j) * 0.9) * 0.6;
      tf(ph.rig, `translate(${(460 - 212 + fx).toFixed(1)}px, ${(378 - 439 + fy).toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${(drift * 0.4).toFixed(3)}deg)`);
      if(tapEl){ const tp = L.tapAt; if(tp){ tapEl.style.left = tp[0] + "px"; tapEl.style.top = tp[1] + "px"; const tc = p.t0 + dur * 0.55; const g = Math.exp(-Math.pow((t - tc) / 0.18, 2)); op(tapEl, g); tf(tapEl, `scale(${(0.6 + 0.8 * prog(t, tc - 0.2, 0.5)).toFixed(3)})`); } else op(tapEl, 0); }
    };
  }
  else if(k === "watch"){
    const w = put(el("div", "watch", root), 240, 40, 440, 680);
    put(el("div", "band", w), 110, 0, 220, 170); put(el("div", "band", w), 110, 560, 220, 170);
    el("div", "case", w); el("div", "crown", w);
    const scr = el("div", "wscr", w);
    const L = watchFace(scr, p.mode);
    N.upd = (lt, t) => { const q = spring(t - p.t0, 170, 20); tf(w, `translateY(${((1 - q) * 80).toFixed(1)}px) rotate(${(-6 + 4 * q + Math.sin(t * 1.1) * 0.6).toFixed(3)}deg) scale(${(0.92 + 0.08 * q).toFixed(4)})`); L(lt, t); };
  }
  return N;
}

function watchFace(scr, mode){
  const L = (y, cls, txt) => { const e = tq(put(el("div", "wl " + cls, scr, txt), 0, y), "card"); e.style.width = "324px"; return e; };
  if(mode === "logo"){ const a = L(140, "w2", ""); a.innerHTML = "Tap<span style=\"color:#02BCB3\">Easy</span>"; a.style.fontSize = "74px"; L(240, "w3", "SẮP RA MẮT"); return (lt) => op(a, prog(lt, 0.2, 0.4)); }
  if(mode === "run"){
    const map = el("div", "", scr); map.innerHTML = `<svg width="324" height="170" viewBox="0 0 324 170"><path class="rt" d="M40 140 C 80 40, 140 160, 180 80 S 270 30, 290 60" fill="none" stroke="#33D6C9" stroke-width="8" stroke-linecap="round" stroke-dasharray="420" stroke-dashoffset="420"/></svg>`;
    put(map, 0, 40); const rt = map.querySelector(".rt");
    L(214, "w1", "CHẠY BỘ · KM 3"); const d = L(256, "w2", "3,42"); L(350, "w3", "5:12 /km");
    return (lt) => { rt.setAttribute("stroke-dashoffset", (420 * (1 - eIO(prog(lt, 0.2, 1.8)))).toFixed(1)); d.textContent = num(2.6 + 0.82 * eOutCubic(prog(lt, 0.2, 2)), 2); };
  }
  if(mode === "hyrox"){ L(70, "w1", "HYROX · TRẠM 3/8"); const tm = L(120, "w2", "04:12"); L(230, "w3", "CHẶNG CHẠY 4/8"); L(280, "w3", "1 KM × 8");
    return (lt) => { const s = 252 + Math.floor(lt * 3); tm.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }; }
  if(mode === "health"){ L(70, "w1", "NHỊP TIM · VÙNG 3"); const hr = L(120, "w2", "128"); L(220, "w3", "bpm"); L(280, "w1", "GIẤC NGỦ 7 GIỜ 20");
    return (lt) => { hr.textContent = String(124 + Math.round(4 * Math.sin(lt * 2.2))); }; }
  L(110, "w1", "ĐÃ LƯU VÀO"); const a = L(160, "w2", ""); a.innerHTML = "Tap<span style=\"color:#02BCB3\">Easy</span>"; a.style.fontSize = "70px"; L(260, "w3", "45 phút · 6,1 km");
  return () => {};
}

/* ---------------- điện thoại + lớp ảnh app ---------------- */
function buildPhone(parent){
  const rig = el("div", "rig", parent); const ph = el("div", "phone", rig);
  el("div", "frame", ph); el("div", "bezel", ph);
  const scr = el("div", "screen", ph); el("div", "island", ph); el("div", "home", ph); el("div", "sheen", ph);
  return { rig, ph, scr };
}
function statusSvg(col){
  return `<svg viewBox="0 0 390 59" width="390" height="59"><g fill="${col}"><text x="60" y="34" font-family="Inter Tight, Inter, sans-serif" font-weight="700" font-size="17" text-anchor="middle">9:41</text>
  <rect x="284" y="29" width="3.2" height="5" rx="1"/><rect x="289.2" y="26.5" width="3.2" height="7.5" rx="1"/><rect x="294.4" y="24" width="3.2" height="10" rx="1"/><rect x="299.6" y="21.5" width="3.2" height="12.5" rx="1"/>
  <rect x="336" y="22.5" width="25" height="12" rx="3.6" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width="1.2"/><rect x="338" y="24.5" width="19" height="8" rx="2"/></g></svg>`;
}
function shotLayer(scr, id, p){
  const d = MAN.shots && MAN.shots[id];
  const box = put(el("div", "abs", scr), 0, 0, 390, 844);
  const L = { box, upd: () => {}, focus:null, tapAt:null };
  if(!d){ const ph = el("div", "ph", box); el("b", "", ph).innerHTML = "Tap<span style=\"color:#02BCB3\">Easy</span>"; return L; }
  const base = put(img(appSrc(d.base), "", box), 0, 0, 390, 844);
  const st = el("div", "abs", box); st.innerHTML = statusSvg(d.light ? "#0b0f14" : "#ffffff"); st.style.zIndex = "3";
  // focus: [x,y,w,h,scale] hoặc tên đích trong manifest.targets
  const tgt = n => { const r = d.targets && d.targets[n]; if(!r) return null; const sc = d.scroller || { x:0, y:0 };
    const y = r.doc ? sc.y + r.y - (d.scrollTop || 0) : r.y; return [r.x, clamp(y, 60, 760), r.w, r.h]; };
  if(Array.isArray(p.focus)) L.focus = p.focus;
  else if(typeof p.focus === "string"){ const r = tgt(p.focus); if(r) L.focus = [r[0], Math.max(60, r[1] - 40), Math.max(240, r[2]), Math.max(160, r[3] + 80), 1.4]; }
  if(Array.isArray(p.tap)) L.tapAt = p.tap; else if(typeof p.tap === "string"){ const r = tgt(p.tap); if(r) L.tapAt = [r[0] + r[2] / 2, r[1] + r[3] / 2]; }
  // chuỗi khung (seq) — hồ sơ PT đếm số
  if(p.seq && d.seq && d.seq.count){
    const sq = put(img("", "", box), 0, 0, 390, 844); sq.style.zIndex = "2";
    L.upd = (lt) => { const k = clamp(Math.floor(lt * d.seq.fps), 0, d.seq.count - 1); setSrc(sq, appSrc(d.seq.pattern.replace("%03d", String(k).padStart(3, "0")))); };
    return L;
  }
  // cuộn: ghép các dải (strips) của vùng cuộn
  const strips = (d.strips || []).filter(s => s && s.src);
  if(p.scroll && strips.length && d.scroller){
    const sc = d.scroller; const clip = put(el("div", "clip", box), sc.x, sc.y, sc.w, sc.h); clip.style.zIndex = "1";
    const ims = strips.map(s => { const i = put(img(appSrc(s.src), "", clip), 0, 0, sc.w, sc.h); i.__y = s.y; return i; });
    const maxY = Math.min(p.scroll, strips[strips.length - 1].y);
    L.upd = (lt, dur) => { const y = maxY * eIO(prog(lt, 0.3, Math.max(0.4, dur - 0.7)));
      ims.forEach(i => { const off = i.__y - y; show(i, off > -sc.h && off < sc.h); i.style.top = off.toFixed(1) + "px"; }); };
  }
  void base;
  return L;
}

/* ---------------- thẻ kết ---------------- */
const endBg = el("div", "eb", endL);
const eTitle = tq(put(el("div", "ttl", endL), Z.head.x, Z.head.y + 6, Z.head.w), "end-title");
(function(){ const words = String(P.end.title).split(" "); const cut = Math.ceil(words.length / 2); eTitle.innerHTML = words.slice(0, cut).join(" ") + "<br><span class=\"acc\">" + words.slice(cut).join(" ") + "</span>"; })();
const QR = 470;
const qrBox = put(el("div", "qr", endL), 500 - QR / 2, 560, QR, QR); const qrImg = img((RES.assets || "build/assets/") + "qr.jpg", "", qrBox);
const eSub = tq(put(el("div", "es", endL, P.end.sub), Z.cap.x, Z.cap.y - 200 + 10, Z.cap.w), "end-sub");
eSub.style.top = (560 + QR + 40) + "px";
const eChips = tq(put(el("div", "chips", endL, "MIỄN PHÍ · TIẾNG VIỆT · KHÔNG QUẢNG CÁO"), Z.cap.x, 560 + QR + 110, Z.cap.w), "end-chips");
const eKick = put(el("div", "kick", endL), Z.kicker.x, Z.kicker.y); const lg2 = el("span", "logo", eKick); lg2.innerHTML = "Tap<b>Easy</b>"; el("span", "bar", eKick); tq(el("span", "", eKick, "CỘNG ĐỒNG"), "kicker");
void qrImg; void endBg;

/* ---------------- render(t) ---------------- */
let lastT = -1;
function render(t){
  t = Math.max(0, Math.min(t, P.duration - 1e-4)); lastT = t;
  const inEnd = t >= P.end.t0;
  const b = E.beatAt(P, t) || P.beats[P.beats.length - 1];
  // tiến độ + hạt nhiễu
  progI.style.width = (t / P.duration * W).toFixed(1) + "px";
  if(grainTiles.length){ const fi = Math.floor(t * FPS / 2); grain.style.backgroundImage = grainTiles[fi % grainTiles.length]; grain.style.backgroundPosition = `${(fi * 37) % 256}px ${(fi * 71) % 256}px`; }
  blobs.forEach((bl, i) => { bl.style.left = (bl.__x + Math.sin(t * 0.35 + i * 2) * 60).toFixed(1) + "px"; bl.style.top = (bl.__y + Math.cos(t * 0.3 + i) * 50).toFixed(1) + "px"; });
  // nền ảnh: hoà dần giữa các nhịp
  const curBg = inEnd ? "" : b.bg; const prevB = P.beats[b.i - 1]; const prevBg = prevB ? prevB.bg : "";
  const xf = prevB && prevBg !== curBg ? eIO(prog(t, b.t0, 0.5)) : 1;
  Object.keys(bgImgs).forEach(k => { const i = bgImgs[k]; let o = 0; if(k === curBg) o = xf; else if(k === prevBg && xf < 1) o = 1 - xf;
    show(i, o > 0.001); if(o > 0.001){ op(i, o * 0.95); tf(i, `scale(${(1.06 + 0.04 * Math.sin(t * 0.12)).toFixed(4)}) translateY(${(-8 * Math.sin(t * 0.2)).toFixed(1)}px)`); } });
  // nhấn (punch) theo mốc gần nhất
  const pu = E.punchAt(P, t);
  const amp = pu.type === "hook" ? 0.06 : pu.type === "cut" ? 0.03 : pu.type === "step" ? 0.016 : pu.type === "punch" ? 0.02 : 0;
  const punch = 1 + amp * Math.exp(-pu.dt / 0.14);
  const drift = pu.type === "punch" ? Math.sin(pu.dt * 1.2) * 6 : 0;
  tf(vis, `translateY(${drift.toFixed(1)}px) scale(${punch.toFixed(4)})`);
  op(flash, pu.type === "hook" || pu.type === "cut" ? 0.18 * Math.exp(-pu.dt / 0.08) : 0);
  // các mảnh hình: mảnh hiện tại vào (zoom-through / trượt), mảnh trước ra trong 0,16 s
  const cur = pieces.find(x => t >= x.p.t0 && t < x.p.t1) || pieces[pieces.length - 1];
  const ci = pieces.indexOf(cur), prevP = pieces[ci - 1];
  pieces.forEach(x => { if(x !== cur && x !== prevP) show(x.node.root, false); });
  if(!inEnd){
    const lt = t - cur.p.t0, kind = (cur.b.i + cur.p.j) % 3;
    show(cur.node.root, true);
    const ein = ci === 0 ? eOutExpo(prog(t, 0, 0.35)) : eOutExpo(prog(lt, 0, 0.36));
    if(kind === 1 && ci > 0) tf(cur.node.root, `translateX(${((1 - ein) * 920).toFixed(1)}px)`);
    else if(kind === 2 && ci > 0) tf(cur.node.root, `translateY(${((1 - ein) * 700).toFixed(1)}px) scale(${(0.94 + 0.06 * ein).toFixed(4)})`);
    else tf(cur.node.root, `scale(${(0.86 + 0.14 * ein).toFixed(4)})`);
    cur.node.root.style.filter = ein < 0.999 && kind === 0 ? `blur(${((1 - ein) * 14).toFixed(2)}px)` : "none";
    op(cur.node.root, ci === 0 ? ein : clamp(ein * 1.6, 0, 1));
    cur.node.upd(lt, t);
    if(prevP){ const ex = prog(lt, 0, 0.16); if(ex < 1){ show(prevP.node.root, true); prevP.node.upd(t - prevP.p.t0, t);
        if(kind === 1) tf(prevP.node.root, `translateX(${(-ex * 920).toFixed(1)}px)`); else if(kind === 2) tf(prevP.node.root, `translateY(${(-ex * 400).toFixed(1)}px) scale(${(1 - 0.1 * ex).toFixed(4)})`);
        else { tf(prevP.node.root, `scale(${(1 + 0.12 * eInCubic(ex)).toFixed(4)})`); prevP.node.root.style.filter = `blur(${(ex * 12).toFixed(2)}px)`; }
        op(prevP.node.root, 1 - ex); } else show(prevP.node.root, false); }
  } else pieces.forEach(x => show(x.node.root, false));
  // tiêu đề: chữ trồi lên từng từ; rời đi 0,12 s trước nhịp sau (không chồng nhau)
  heads.forEach((h, i) => {
    const B = P.beats[i]; const on = !inEnd && t >= B.t0 - (i ? 0.0 : 1) && t < B.t1;
    show(h.box, on); if(!on) return;
    const lt = t - B.t0, out = i < P.beats.length - 1 ? prog(t, B.t1 - 0.12, 0.12) : prog(t, P.end.t0 - 0.12, 0.12);
    h.words.forEach((w, j) => { const st = (i === 0 ? 0 : 0.05) + j * (i === 0 ? 0.05 : 0.065); const q = i === 0 ? eOutExpo(prog(lt, st, 0.3)) : spring(lt - st, 260, 26);
      const y = (1 - q) * 110 + out * -60; tf(w, `translateY(${y.toFixed(1)}%) scale(${(i === 0 ? 0.94 + 0.06 * q : 1).toFixed(4)})`); op(w, clamp(q * 1.3, 0, 1) * (1 - out)); });
  });
  op(kick, inEnd ? 0 : prog(t, 0.05, 0.25)); show(kick, !inEnd);
  // phụ đề karaoke
  caps.forEach(C => {
    const on = !inEnd && t >= C.c.t0 && t < C.c.t1; show(C.box, on); if(!on) return;
    const q = eOutCubic(prog(t, C.c.t0, 0.12)); tf(C.box, `translateY(${((1 - q) * 18).toFixed(1)}px)`); op(C.box, q);
    C.ws.forEach(w => { const cls = "cw" + (t >= w.t0 && t < w.t1 ? " now" : t < w.t0 ? " fut" : ""); if(w.s.className !== cls) w.s.className = cls;
      const pop = t >= w.t0 ? Math.exp(-(t - w.t0) / 0.12) : 0; tf(w.s, `scale(${(1 + 0.07 * pop).toFixed(4)})`); });
  });
  // nguồn
  const srcOn = !inEnd && srcLines.length && t >= Math.min(1.6, P.beats[0].t1);
  show(srcBox, srcOn); if(srcOn) op(srcBox, prog(t, Math.min(1.6, P.beats[0].t1), 0.3) * (1 - prog(t, P.end.t0 - 0.2, 0.2)));
  // thẻ kết: loang tròn từ giữa (0,35 s), rồi đứng yên cho quét QR
  show(endL, inEnd);
  if(inEnd){ const lt = t - P.end.t0; const r = eOutCubic(prog(lt, 0, 0.35)) * Math.hypot(W, H) * 0.6 * 1.05;
    endL.style.clipPath = r >= Math.hypot(W, H) * 0.6 ? "none" : `circle(${r.toFixed(1)}px at 500px 800px)`;
    const q = spring(lt - 0.1, 200, 22); tf(qrBox, `scale(${(0.8 + 0.2 * q).toFixed(4)})`); op(qrBox, clamp(q * 2, 0, 1));
    op(eTitle, prog(lt, 0.15, 0.25)); tf(eTitle, `translateY(${((1 - eOutExpo(prog(lt, 0.15, 0.4))) * 40).toFixed(1)}px)`);
    op(eSub, prog(lt, 0.35, 0.25)); op(eChips, prog(lt, 0.5, 0.25)); }
}

function settle(){
  const list = Array.from(pending); pending.clear();
  return Promise.all(list.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => true);
}
/* hộp chữ đang hiện (cho qa.py): chỉ phần tử data-qa thấy được, độ mờ hiệu dụng ≥ 0,5 */
function probe(){
  const out = [];
  const effOp = e => { let o = 1; for(let n = e; n && n !== stage; n = n.parentNode){ if(n.style && n.style.display === "none") return 0; if(n.__op != null) o *= n.__op; } return o; };
  const all = stage.querySelectorAll ? stage.querySelectorAll("[data-qa]") : [];
  Array.from(all).forEach(e => {
    const o = effOp(e); if(o < 0.5) return;
    const r = e.getBoundingClientRect(); if(r.width < 2 || r.height < 2) return;
    let lines = 0; try{ if(e.getAttribute("data-qa") === "head" || e.getAttribute("data-qa") === "cap") lines = e.scrollWidth > e.clientWidth + 2 ? 99 : 1; }catch(x){}
    out.push({ qa:e.getAttribute("data-qa"), text:(e.textContent || "").slice(0, 60), x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height), lines, op:Math.round(o * 100) / 100 });
  });
  const capLines = caps.filter(C => C.box.__vis).map(C => C.c.lines.length);
  return { t:lastT, items:out, capLines };
}
/* ảnh bìa: ảnh nền + tiêu đề bìa lớn + số tập */
function cover(){
  render(Math.min(P.beats[0].t1 - 0.05, 1.2));
  [vis, headBox, capBox, srcBox, kick, progBar, flash].forEach(e => show(e, false));
  const cv = el("div", "cover", stage);
  const n = put(el("div", "cv-n", cv, String(P.n).padStart(2, "0")), 560, 300); void n;
  const tag = tq(put(el("div", "cv-tag", cv, (P.kicker || "").replace(/\s*·\s*\d+$/, "")), 80, 640), "cover");
  const ttl = tq(put(el("div", "cv-ttl", cv), 80, 720, 860), "cover");
  const words = String(P.cover || P.title).split(" "); const cut = Math.ceil(words.length * 0.55);
  ttl.innerHTML = words.slice(0, cut).join(" ") + " <span class=\"acc\">" + words.slice(cut).join(" ") + "</span>";
  const brand = put(el("div", "kick", cv), 80, 1240); const lg = el("span", "logo", brand); lg.innerHTML = "Tap<b>Easy</b>"; el("span", "bar", brand); el("span", "", brand, "TẬP ĐÚNG · TIẾN BỘ THẬT");
  // co chữ nếu tràn 2 dòng rưỡi
  try{ let fs = 112; while(ttl.getBoundingClientRect().height > 470 && fs > 70){ fs -= 6; ttl.style.fontSize = fs + "px"; } }catch(e){}
  return settle();
}
/* nhoè chuyển động: chỉ các khung đang chuyển cảnh nhanh (zoom-through/trượt), không qua mốc cắt */
function blurSamples(t){ for(const x of pieces){ const d = t - x.p.t0; if(x.p.t0 > 0 && d >= 0 && d < 0.2) return 3; } return 1; }
function cuts(){ return pieces.map(x => x.p.t0).filter(x => x > 0).concat([P.end.t0]); }

const ready = (async () => {
  try{ if(document.fonts && document.fonts.load){ await Promise.all(["800 58px 'Inter Tight'", "700 40px 'Inter Tight'", "800 120px 'Barlow Condensed'", "500 22px Inter", "700 28px 'JetBrains Mono'"].map(f => document.fonts.load(f, "Tiếng Việt ệ 0123").catch(() => {}))); await document.fonts.ready; } }catch(e){}
  // co tiêu đề nếu đo được rộng hơn vùng (font thật khác ước tính)
  try{ heads.forEach(h => { show(h.box, true); let guard = 0; while(guard++ < 12 && h.box.getBoundingClientRect && Math.max(...Array.from(h.box.children).map(c => c.scrollWidth || 0)) > Z.head.w){ h.words.forEach(w => { w.style.fontSize = (parseFloat(w.style.fontSize) * 0.94).toFixed(1) + "px"; }); } show(h.box, false); }); }catch(e){}
  render(0); await settle();
  return { W, H, duration:P.duration, id:P.id, shots:Object.keys(MAN.shots || {}).length, voice:P.voice };
})();
return { render, settle, ready, probe, cover, blurSamples, cuts, duration:P.duration };
}

ROOT.__makeShortsComposer = makeComposer;
if(ROOT.__NO_AUTO || typeof document === "undefined" || !ROOT.__PLAN__) return;
const Q = new URLSearchParams(location.search);
const comp = makeComposer({ stage: document.getElementById("stage"), plan: ROOT.__PLAN__, manifest: ROOT.__MANIFEST__ });
ROOT.__render = async t => { comp.render(t); await comp.settle(); return true; };
ROOT.__probe = comp.probe; ROOT.__cover = comp.cover; ROOT.__blurSamples = comp.blurSamples; ROOT.__cuts = comp.cuts;
ROOT.__duration = comp.duration; ROOT.__ready = comp.ready;
if(Q.get("cover")) comp.ready.then(() => comp.cover());
else if(Q.get("t") != null) comp.ready.then(() => ROOT.__render(+Q.get("t")));
else if(Q.get("play")){ const t0 = performance.now(); comp.ready.then(() => { const loop = () => { comp.render(((performance.now() - t0) / 1000) % comp.duration); requestAnimationFrame(loop); }; loop(); }); }
})();
