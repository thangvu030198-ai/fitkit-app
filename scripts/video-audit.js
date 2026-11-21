#!/usr/bin/env node
/* 21/11/2026 — RÀ ÁNH XẠ VIDEO ↔ BÀI TẬP (chạy offline, không gọi mạng)
   node scripts/video-audit.js [--fv path/freevideos.js] [--ex3d path/index.json] [--out dir] [--json]
   - Nạp data.js + templates.js (EXERCISES) + exdb-vi-*.js (876 bài thư viện) + freevideos.js trong vm,
     index video: tests/fixtures/wger-index.json, tests/fixtures/extra-index.json, media/ex3d/index.json.
   - Với mỗi bài: video được chọn (bài trong giáo án: tên "Việt (English)" + dụng cụ; bài thư viện: tên tiếng Anh + dụng cụ).
   - Đánh dấu NGHI SAI khi thuộc tính quan trọng của bài và của clip khác nhau: một tay/hai tay, quỳ/ngồi/đứng/nằm,
     ròng rọc cao/thấp, dụng cụ, hoặc từ khoá chính của bài không có trong tên clip.
   - Ghi audit.md + audit.csv vào --out (mặc định: in ra màn hình). */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const arg = (k, d)=>{ const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FV = path.resolve(arg("--fv", path.join(ROOT, "freevideos.js")));
const EX3D = path.resolve(arg("--ex3d", path.join(ROOT, "media/ex3d/index.json")));
const OUT = arg("--out", "");

function makeCtx(){
  const files = {
    "media/wger/index.json": path.join(ROOT, "tests/fixtures/wger-index.json"),
    "media/extra/index.json": path.join(ROOT, "tests/fixtures/extra-index.json"),
    "media/ex3d/index.json": EX3D,
  };
  const ctx = { console, setTimeout, clearTimeout, Promise, Map, Set, JSON, Math, Date, Object, Array, String, Number, RegExp, Error };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.navigator = { onLine: true };
  ctx.fetch = async url=>{
    const k = Object.keys(files).find(k=> String(url).endsWith(k));
    if(!k) return { ok: false, status: 404, json: async()=> null };
    const body = fs.readFileSync(files[k], "utf8");
    return { ok: true, status: 200, json: async()=> JSON.parse(body) };
  };
  vm.createContext(ctx);
  const load = (f, extra)=> vm.runInContext(fs.readFileSync(f, "utf8") + (extra || ""), ctx, { filename: f });
  load(path.join(ROOT, "data.js"), "\n;globalThis.EXERCISES = EXERCISES;");
  try{ load(path.join(ROOT, "templates.js")); }catch(e){ /* templates.js có thể cần DOM — phần EXERCISES đã chạy trước */ }
  ["exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"].forEach(f=> load(path.join(ROOT, f)));
  load(FV, "\n;globalThis.__fv = { findFreeExerciseVideos, fvTokens, FV_CORE_EXDB, YMOVE_FREE };");
  return ctx;
}

/* ---- thuộc tính để so (độc lập với freevideos.js — để bắt cả lỗi của chính logic khớp) ---- */
function attrs(text){
  const s = " " + String(text || "").toLowerCase().replace(/[_\-,/()]+/g, " ") + " ";
  const a = {};
  if(/\b(one|single) (arm|leg|hand)|\bone armed\b|\bunilateral\b|một tay|một chân|\b1 tay\b|\b1 chân\b|\bsingle\b/.test(s)) a.side = "uni";
  else if(/\balternat|luân phiên/.test(s)) a.side = "alt";
  if(/\bkneeling\b|\bquỳ\b/.test(s)) a.post = "kneel";
  else if(/\b(seated|sitting)\b|\bngồi\b/.test(s)) a.post = "seat";
  else if(/\b(lying|laying|prone|supine)\b/.test(s)) a.post = "lie";
  else if(/\bstanding\b/.test(s)) a.post = "stand";
  if(/high pulley|high cable|cáp cao|ròng rọc cao/.test(s)) a.pull = "high";
  else if(/low pulley|low cable|cáp thấp|ròng rọc thấp/.test(s)) a.pull = "low";
  if(/\bincline\b/.test(s)) a.ang = "inc"; else if(/\bdecline\b/.test(s)) a.ang = "dec";
  return a;
}
const EQ = [["barbell", /\bbarbell\b|\bbb\b|thanh đòn|tạ đòn|\be ?z\b|ez bar|curl bar/], ["dumbbell", /\bdumbbells?\b|\bdb\b|tạ đơn/], ["cable", /\bcable\b|\bpulley\b|cáp|ròng rọc/],
  ["smith", /\bsmith\b|multipress/], ["machine", /\bmachine\b|\blever(age)?\b|\bmáy\b/], ["kettlebell", /kettlebell|tạ ấm/], ["band", /\bbands?\b|dây kháng/]];
function equipOf(text){ const s = String(text || "").toLowerCase(); return EQ.filter(([, re])=> re.test(s)).map(([k])=> k); }
function suspicious(exName, exEquip, clip){
  const why = [];
  const a = attrs(exName), b = attrs(clip.name);
  if((a.side === "uni") !== (b.side === "uni")) why.push(`một tay/chân: bài=${a.side === "uni" ? "một bên" : "hai bên"} · clip=${b.side === "uni" ? "một bên" : "hai bên"}`);
  if((a.post || b.post) && a.post !== b.post && (a.post === "kneel" || b.post === "kneel" || (a.post && b.post))) why.push(`tư thế: bài=${a.post || "?"} · clip=${b.post || "?"}`);
  if(a.pull && b.pull && a.pull !== b.pull) why.push(`ròng rọc: bài=${a.pull} · clip=${b.pull}`);
  if((a.ang || b.ang) && a.ang !== b.ang && !clip.ex3dId) why.push(`góc ghế: bài=${a.ang || "phẳng"} · clip=${b.ang || "phẳng"}`);
  const ea = equipOf(exName + " " + (exEquip || "")), eb = equipOf(clip.name + " " + (clip.equip || ""));
  if(ea.length && eb.length && !eb.some(e=> ea.includes(e)) && !(eb.includes("machine") && ea.includes("smith"))) why.push(`dụng cụ: bài=${ea.join("/")} · clip=${eb.join("/")}`);
  return why;
}
const EXDB_EQ_VI = { barbell: "Tạ đòn", dumbbell: "Tạ đơn", cable: "Cáp", machine: "Máy", smith: "Máy", kettlebell: "Tạ ấm", band: "Dây kháng lực" };
function exdbEquip(idEn, vi){ const e = equipOf(idEn.replace(/_/g, " ") + " " + (vi || "")); return e.length ? EXDB_EQ_VI[e[0]] : ""; }

async function run(){
  const ctx = makeCtx();
  const F = ctx.__fv, E = ctx.EXERCISES, VI = ctx.EXDB_VI || {};
  const tplIds = new Set();
  try{ const src = fs.readFileSync(path.join(ROOT, "templates.js"), "utf8"); for(const m of src.matchAll(/TPL_R\("([a-z0-9]+)"/g)) tplIds.add(m[1]); }catch(e){}
  const rows = [];
  const pick = async meta=>{ const r = await F.findFreeExerciseVideos(meta); return r[0] || null; };
  const clipOf = (v, meta)=> v ? { provider: v.provider, name: v.name, equip: v.equip || "", ex3dId: v.ex3d && meta && meta.exDbId && v.ids.includes(meta.exDbId) } : null;
  for(const id of Object.keys(E)){
    const m = E[id]; const v = clipOf(await pick(m), m);
    rows.push({ scope: tplIds.has(id) ? "giáo án mẫu" : "bài lõi", id, name: m.name, equip: m.equipment || "", clip: v, why: v ? suspicious(m.name, m.equipment, v) : [] });
  }
  for(const id of Object.keys(VI)){
    const en = id.replace(/_/g, " ").replace(/\s+-\s+/g, " - ");
    const vi = VI[id] && VI[id].n || en;
    const eq = exdbEquip(id, vi);
    const stored = /\([^()]*[A-Za-z][^()]*\)\s*$/.test(vi) ? vi : `${vi} (${en})`;
    const metaPlan = { name: stored, equipment: eq, exDbId: id };              // bài thư viện đã thêm vào giáo án / đang tập
    const metaLib = { name: en, equipment: eq };                               // mở chi tiết trong Thư viện (tên tiếng Anh)
    const v1 = clipOf(await pick(metaPlan), metaPlan), v2 = clipOf(await pick(metaLib), metaLib);
    const v = v1 || v2;
    const why = v ? suspicious(en + " " + vi, eq, v) : [];
    if(v2 && (!v1 || v2.name !== v1.name)){ const w2 = suspicious(en + " " + vi, eq, v2); if(w2.length) why.push("(thư viện) " + v2.name + ": " + w2.join("; ")); }
    rows.push({ scope: "thư viện 800+", id, name: stored, equip: eq, clip: v, why });
  }
  return rows;
}

function toCsv(rows){
  const q = s=> `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  return ["scope,id,ten_bai,dung_cu,nguon_clip,ten_clip,nghi_sai,ly_do"].concat(rows.map(r=> [r.scope, r.id, r.name, r.equip, r.clip ? r.clip.provider : "", r.clip ? r.clip.name : "", r.why.length ? "CÓ" : "", r.why.join(" | ")].map(q).join(","))).join("\n");
}

if(require.main === module){
  run().then(rows=>{
    const withClip = rows.filter(r=> r.clip), sus = rows.filter(r=> r.why.length);
    if(process.argv.includes("--json")){ process.stdout.write(JSON.stringify(rows)); return; }
    const line = r=> `| ${r.scope} | \`${r.id}\` | ${r.name} | ${r.clip ? r.clip.provider + " · " + r.clip.name : "—"} | ${r.why.join("; ")} |`;
    const md = [`# Rà ánh xạ video ↔ bài tập (${new Date().toISOString().slice(0, 10)})`, "",
      `- Freevideos: \`${path.relative(ROOT, FV)}\` · ex3d: \`${path.relative(ROOT, EX3D)}\``,
      `- Tổng ${rows.length} bài · có clip ${withClip.length} · nghi sai ${sus.length}`, "",
      "## Nghi sai", "", "| Phạm vi | id | Bài | Clip được gán | Lý do |", "|---|---|---|---|---|", ...sus.map(line), "",
      "## Mọi bài có clip", "", "| Phạm vi | id | Bài | Clip được gán | Lý do |", "|---|---|---|---|---|", ...withClip.map(line)].join("\n");
    if(OUT){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "audit.md"), md); fs.writeFileSync(path.join(OUT, "audit.csv"), "﻿" + toCsv(rows)); }
    console.log(`Tổng ${rows.length} · có clip ${withClip.length} · nghi sai ${sus.length}`);
    sus.forEach(r=> console.log(" !", r.scope, r.id, "→", r.clip.provider, r.clip.name, "::", r.why.join("; ")));
  }).catch(e=>{ console.error(e); process.exit(1); });
}
module.exports = { run, attrs, suspicious };
