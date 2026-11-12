#!/usr/bin/env node
/* TapEasy Shorts — kiểm offline KHÔNG cần mạng/trình duyệt (chạy được trong sandbox):
   series.json hợp lệ, thời lượng 15–45 s (ước tính lời 2,4 từ/s và cả khi có segs.json thật), hook ≤ 1,5 s, thẻ kết ≥ 2 s,
   quãng hình đứng yên ≤ 2,5 s, phụ đề ≤ 2 dòng, vùng chữ nằm trong vùng an toàn TikTok và không chồng nhau,
   số liệu BMR/TDEE khớp Mifflin–St Jeor, không URL/GitHub trên khung, rồi dựng render(t) MỌI khung (bước --step) bằng DOM giả,
   kiểm tính thuần (vẽ lại cùng t → giống hệt).
     node scripts/shorts/smoke_node.js [--step 0.2] [--ids a,b] [--quick]
*/
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const HERE = __dirname, BUILD = path.join(HERE, "build");
const E = require("./engine.js");
const { Node, DOC } = require("./_dom_fake.js");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const QUICK = argv.includes("--quick");
const read = f => fs.readFileSync(f, "utf8");
let fails = 0;
const say = (ok, msg) => { if(!ok) fails++; console.log((ok ? "ok    " : "LỖI   ") + msg); };

const series = JSON.parse(read(path.join(HERE, "series.json")));
const want = String(arg("--ids", "")).split(",").filter(Boolean);
const shorts = series.shorts.filter(s => !want.length || want.includes(s.id));

/* ---------- 1. kịch bản & bố cục ---------- */
function staticChecks(){
  const ids = series.shorts.map(s => s.id);
  say(series.shorts.length === 14 && new Set(ids).size === 14 && ids.every(id => /^[a-z0-9-]+$/.test(id)), `14 short, id duy nhất (${ids.length})`);
  const S = E.SAFE, Wd = E.W, Hd = E.H;
  const inSafe = z => z.x >= S.left && z.x + z.w <= Wd - S.right && z.y >= S.top && z.y + z.h <= Hd - S.bottom;
  ["kicker", "head", "card", "cap", "src"].forEach(k => say(inSafe(E.ZONES[k]), `vùng chữ "${k}" trong vùng an toàn (${JSON.stringify(E.ZONES[k])})`));
  const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const keys = ["kicker", "head", "card", "cap", "src"]; let o = 0;
  keys.forEach((a, i) => keys.slice(i + 1).forEach(b => { if(ov(E.ZONES[a], E.ZONES[b])){ o++; console.log(`      chồng: ${a} × ${b}`); } }));
  say(!o, "các vùng chữ không chồng nhau");
  const blob = read(path.join(HERE, "series.json")) + read(path.join(HERE, "shorts.js")) + read(path.join(HERE, "engine.js"));
  say(!/github/i.test(blob) && !/https?:\/\//i.test(read(path.join(HERE, "series.json")) + read(path.join(HERE, "shorts.js"))), "không URL/GitHub trong kịch bản & bộ dựng");
  say(!/sk-[A-Za-z0-9]{16,}/.test(blob), "không có khoá API");
  // TDEE
  const t = series.shorts.find(s => s.id === "bmr-tdee"), ex = t && t.example;
  const bmr = ex && E.mifflin(ex), td = ex && E.tdee(bmr, ex.activity);
  say(ex && bmr === ex.bmr && td === ex.tdee && Math.round(td * 0.82) === ex.lose && Math.round(td * 1.12) === ex.gain,
      `BMR/TDEE ví dụ khớp Mifflin–St Jeor + PAL app: BMR ${bmr}, TDEE ${td}, giảm mỡ ${Math.round(td * .82)}, tăng cơ ${Math.round(td * 1.12)}`);
  const txt = JSON.stringify(t);
  say(/1\.645/.test(txt) && /2\.550/.test(txt) && /2091/.test(txt) && /2856/.test(txt), "số trong kịch bản TDEE = kết quả tính");
}

function shortChecks(s){
  const P = E.plan(series, s.id);
  const bad = [];
  if(!(P.duration >= 15 && P.duration <= 45)) bad.push(`thời lượng ${P.duration}`);
  if(P.end.t1 - P.end.t0 < 2) bad.push("thẻ kết < 2 s");
  if(!(Array.isArray(s.hook) && s.hook.length && P.hook.t_full <= 1.5 && P.beats[0].t0 === 0 && JSON.stringify(P.beats[0].h) === JSON.stringify(s.hook))) bad.push("hook");
  if(E.maxGap(P) > E.MAX_GAP) bad.push(`quãng tĩnh ${E.maxGap(P)} s`);
  P.chunks.filter(c => !c.hidden).forEach(c => { if(c.lines.length > 2) bad.push("phụ đề > 2 dòng: " + c.text); c.lines.forEach(l => { if(l.map(w => w.w).join(" ").length > E.CAP.maxChars) bad.push("dòng phụ đề dài: " + c.text); }); });
  for(let i = 1; i < P.chunks.length; i++) if(P.chunks[i].t0 < P.chunks[i - 1].t1 - 1e-6 && !P.chunks[i].hidden) bad.push("phụ đề chồng thời gian");
  P.beats.forEach(b => { if(b.h.length > 2) bad.push("tiêu đề > 2 dòng"); b.h.forEach(l => { if([...l].length * b.hsize * E.HEAD.charW > E.ZONES.head.w + 1) bad.push("tiêu đề rộng: " + l); });
    b.pieces.forEach(p => { if(p.t1 - p.t0 < 0.6) bad.push(`mảnh hình quá ngắn ${p.k} ${(p.t1 - p.t0).toFixed(2)}s`); }); });
  [s.sources, s.disclaimer].filter(Boolean).forEach(x => { if(x.length > 78) bad.push("dòng nguồn dài: " + x); });
  if(!(Array.isArray(s.hashtags) && s.hashtags.length >= 5 && s.hashtags.length <= 8 && s.hashtags.every(h => /^#[\p{L}\p{N}_]+$/u.test(h)))) bad.push("hashtag");
  if(!s.caption || !s.cover || !s.title) bad.push("thiếu caption/cover/title");
  // lời đọc ~2,4 từ/s (ước tính) — cũng kiểm có segs.json thật
  const segP = path.join(BUILD, "voice", s.id, "segs.json");
  if(fs.existsSync(segP)){ const P2 = E.plan(series, s.id, JSON.parse(read(segP)).durs || {}); if(P2.duration > 45 * 1.15) bad.push(`với lời thật ${P2.duration}s`); }
  say(!bad.length, `${String(s.n).padStart(2)} ${s.id.padEnd(20)} ${P.duration.toFixed(1)} s · ${P.beats.length} nhịp · ${P.chunks.length} cụm phụ đề · tĩnh ≤ ${E.maxGap(P)} s` + (bad.length ? " → " + bad.join("; ") : ""));
  return P;
}

/* ---------- 2. dựng render(t) bằng DOM giả ---------- */
const src = read(path.join(HERE, "shorts.js"));
const manP = path.join(BUILD, "app", "manifest.json");
const MAN = fs.existsSync(manP) ? JSON.parse(read(manP)) : { shots:{} };
async function renderAll(P){
  const stage = new Node("div"); stage.attrs.id = "stage"; DOC.body.appendChild(stage);
  const win = { document:DOC, __NO_AUTO:true, ShortsEngine:E, location:{ search:"" }, URLSearchParams, performance, console, setTimeout, Promise, Math, JSON, Number, String, Array, Object, Set, Map, parseFloat, parseInt, isNaN };
  win.window = win; win.self = win; win.globalThis = win; vm.createContext(win);
  vm.runInContext(src, win, { filename:"shorts.js" });
  const comp = win.__makeShortsComposer({ stage, plan:P, manifest:MAN });
  await comp.ready;
  const step = Number(arg("--step", QUICK ? 0.5 : 0.2));
  let n = 0, err = null;
  for(let t = 0; t <= P.duration; t += step){ try{ comp.render(+t.toFixed(4)); n++; }catch(e){ err = `t=${t.toFixed(2)}: ${String(e.stack).split("\n").slice(0, 3).join(" | ")}`; break; } }
  const hidden = e => { for(let x = e; x && x !== stage; x = x.parentNode){ if(x.style.display === "none") return true; } return false; };
  const snap = () => JSON.stringify(stage._all().filter(e => !hidden(e)).map(e => [e.className, e.style.cssText, e.childNodes.length === 1 && e.childNodes[0].nodeType === 3 ? e.textContent : ""]));
  let pure = true;
  for(const t of [0.3, P.beats[Math.min(2, P.beats.length - 1)].t0 + 0.7, P.end.t0 + 1.0]){
    comp.render(t); const a = snap(); comp.render(Math.max(0, t - 5.3)); comp.render(t + 3); comp.render(t); const b = snap(); if(a !== b) pure = false;
  }
  let pr = null; try{ comp.render(P.beats[1].t0 + 1); pr = comp.probe(); }catch(e){ err = err || "probe: " + e.message; }
  stage.remove();
  say(!err && pure && pr, `   ${P.id}: render(t) ${n} khung, thuần${pure ? "" : " — KHÔNG"}${err ? " → " + err : ""}`);
}

(async () => {
  staticChecks();
  const plans = shorts.map(shortChecks);
  // chủ đề bắt buộc
  const T = series.shorts.map(s => s.title.toLowerCase()).join(" | ");
  const need = [/bmr.*tdee/, /tăng cơ.*giảm mỡ|giảm mỡ.*tăng cơ/, /giấc ngủ/, /calo/, /protein/, /pt/, /giao diện/, /thực đơn/, /ghi hiệp|kg × lần/, /12 tuần/, /tập bụng/, /sắp ra mắt/];
  say(need.every(r => r.test(T)), "đủ chủ đề bắt buộc (BMR/TDEE, tăng cơ vs giảm mỡ, ngủ, calo, protein, 4 demo app, hành trình 12 tuần, phá bẫy, sắp ra mắt)");
  say(series.shorts.filter(s => s.pillar === "app-demo").length >= 3 && series.shorts.filter(s => s.pillar === "hanh-trinh" && s.illustrative).length >= 1, "≥ 3 demo app, ≥ 1 hành trình (ghi rõ minh hoạ)");
  for(const P of plans) await renderAll(P);
  console.log(fails ? `\n${fails} lỗi` : "\nTẤT CẢ ĐẠT");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
