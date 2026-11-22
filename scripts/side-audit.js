#!/usr/bin/env node
/* 22/11/2026 — RÀ KIỂU TẬP HAI BÊN / TỪNG BÊN cho MỌI bài (chạy offline)
   node scripts/side-audit.js [--out dir]
   Nạp data.js + templates.js (bài lõi, giáo án mẫu) + exdb-vi-*.js (876 bài thư viện) + exercise-side.js trong vm,
   phân loại từng bài "uni" | "either" | "bi" kèm lý do → side.csv + summary.md (mặc định in tóm tắt ra màn hình).
   Bài thư viện: dụng cụ suy từ tên tiếng Anh / id (file exercises.json gốc không có sẵn offline) — app khi chạy dùng dụng cụ thật. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const arg = (k, d)=>{ const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "");

const ctx = { console, Map, Set, JSON, Math, Date, Object, Array, String, Number, RegExp, Error };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (f, extra)=> vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8") + (extra || ""), ctx, { filename: f });
load("data.js", "\n;globalThis.EXERCISES = EXERCISES;");
try{ load("templates.js"); }catch(e){ /* phần EXERCISES đã chạy */ }
["exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"].forEach(f=> load(f));
load("exercise-side.js");
const E = ctx.EXERCISES, VI = ctx.EXDB_VI || {}, S = ctx.FKSide;

/* bài nằm trong giáo án mẫu (templates.js / data.js) + số lần xuất hiện */
const used = {};
const src = fs.readFileSync(path.join(ROOT, "templates.js"), "utf8") + fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
for(const m of src.matchAll(/exerciseId\s*:\s*"([A-Za-z0-9_]+)"|R\("([a-z0-9_]+)"/g)){ const k = m[1] || m[2]; used[k] = (used[k] || 0) + 1; }
/* bài trong bảng đổi dụng cụ (plan-tools.js) */
const ptSrc = fs.readFileSync(path.join(ROOT, "plan-tools.js"), "utf8");
const inPT = new Set([...ptSrc.matchAll(/\["([A-Za-z0-9_\-]+)",\s*"(barbell|dumbbell|smith|machine|cable|body)"/g)].map(m=> m[1]));
const EQ_VI = { barbell:"Thanh đòn", dumbbell:"Tạ đơn", smith:"Máy Smith", machine:"Máy", cable:"Cáp", body:"Trọng lượng cơ thể" };
const ptEq = {}; for(const m of ptSrc.matchAll(/\["([A-Za-z0-9_\-]+)",\s*"(barbell|dumbbell|smith|machine|cable|body)"/g)) ptEq[m[1]] = EQ_VI[m[2]];

function exdbEquip(id, en){
  const s = (id.replace(/[_-]+/g, " ") + " " + en).toLowerCase();
  if(/\bsmith\b|multipress/.test(s)) return "Máy Smith";
  if(/kettlebell/.test(s)) return "Tạ ấm";
  if(/\bdumbbells?\b|\bdb\b/.test(s)) return "Tạ đơn";
  if(/\bbarbell\b|\bez\b|e z bar|curl bar|trap bar/.test(s)) return "Thanh đòn";
  if(/\bcable\b|\bpulley\b|\brope\b(?!.*jump)/.test(s)) return "Cáp";
  if(/\bbands?\b/.test(s)) return "Dây kháng lực";
  if(/\bmachine\b|\bleverage\b|\blever\b|leg press|leg extension|leg curl|pec deck|butterfly|abductor|adductor|calf press|hack squat|seated calf/.test(s)) return "Máy";
  return "";
}
const splitName = n=>{ const m = String(n || "").match(/^(.*?)\s*\(([^()]*)\)\s*$/); return m ? [m[1], m[2]] : [String(n || ""), ""]; };

const rows = [];
for(const [id, e] of Object.entries(E)){
  const [vi, en] = splitName(e.name);
  const r = S.fkExerciseSideWhy({ name: e.name, muscle: e.muscle, equipment: e.equipment }, { exerciseId: id });
  rows.push({ id, scope: used[id] ? "giáo án mẫu" : "bài lõi", uses: used[id] || 0, vi, en, eq: e.equipment, side: r.side, why: r.why, src: r.src,
    kind: S.fkSideKindOf({ name: e.name, muscle: e.muscle }) });
}
for(const [id, v] of Object.entries(VI)){
  const [vi, en0] = splitName(v.n); const en = en0 || id.replace(/_/g, " ");
  const eq = ptEq[id] || exdbEquip(id, en);
  const r = S.fkExerciseSideWhy({ name: v.n, nameEn: en, equipment: eq }, { custom: { exDbId: id } });
  rows.push({ id, scope: inPT.has(id) ? "thư viện · đổi dụng cụ" : "thư viện 800+", uses: 0, vi, en, eq: eq || "(không rõ)", side: r.side, why: r.why, src: r.src,
    kind: S.fkSideKindOf({ name: v.n + " " + en }) });
}
const order = { "giáo án mẫu":0, "bài lõi":1, "thư viện · đổi dụng cụ":2, "thư viện 800+":3 };
rows.sort((a, b)=> order[a.scope] - order[b.scope] || b.uses - a.uses || a.id.localeCompare(b.id));
const LBL = { uni:"Từng bên (uni)", either:"Hai kiểu (either)", bi:"Hai bên (bi)" };
const q = s=> `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
const csv = "﻿" + ["id,pham_vi,so_lan_trong_giao_an,ten_vi,ten_en,dung_cu,nhom,tay_chan,nguon_phan_loai,ly_do"]
  .concat(rows.map(r=> [r.id, r.scope, r.uses, r.vi, r.en, r.eq, r.side, r.kind === "leg" ? "chân" : "tay", r.src === "core" ? "bảng id (duyệt tay)" : r.src === "override" ? "chỉnh tay" : "luật", r.why].map(q).join(","))).join("\n");

const cnt = (list, s)=> list.filter(r=> r.side === s).length;
const groups = [["Giáo án mẫu", rows.filter(r=> r.scope === "giáo án mẫu")], ["Bài lõi (không trong giáo án mẫu)", rows.filter(r=> r.scope === "bài lõi")],
  ["Thư viện — bảng đổi dụng cụ", rows.filter(r=> r.scope === "thư viện · đổi dụng cụ")], ["Thư viện 800+", rows.filter(r=> r.scope === "thư viện 800+")]];
let md = `# Kiểu tập hai bên / từng bên — rà toàn bộ bài (${new Date().toISOString().slice(0, 10)})\n\n`;
md += `Tổng ${rows.length} bài · **từng bên ${cnt(rows, "uni")}** · **hai kiểu ${cnt(rows, "either")}** · **hai bên ${cnt(rows, "bi")}**\n\n`;
md += `| Phạm vi | Số bài | Từng bên | Hai kiểu | Hai bên |\n|---|---:|---:|---:|---:|\n` + groups.map(([n, L])=> `| ${n} | ${L.length} | ${cnt(L, "uni")} | ${cnt(L, "either")} | ${cnt(L, "bi")} |`).join("\n") + "\n\n";
md += `Ý nghĩa: **uni** = luôn từng bên → màn tập mặc định ghi T/P (có liên kết "Ghi gộp" nếu muốn) · **either** = có bộ chọn "Hai tay | Từng tay" (bài chân: "Hai chân | Từng chân"), nhớ lựa chọn theo từng bài · **bi** = không có bộ chọn.\n\n`;
md += `Bài thư viện: dụng cụ suy từ tên tiếng Anh (khi chạy, app dùng dụng cụ thật của bài). Muốn đổi nhóm của bài nào: sửa bảng \`CORE\` (bài lõi) hoặc \`X\` (bài thư viện) trong exercise-side.js.\n\n`;
const tbl = L=> `| id | Tên | Dụng cụ | Nhóm | Lý do |\n|---|---|---|---|---|\n` + L.map(r=> `| ${r.id} | ${r.vi}${r.en ? " (" + r.en + ")" : ""} | ${r.eq} | ${r.side} | ${r.why} |`).join("\n") + "\n\n";
md += `## Giáo án mẫu + bài lõi (duyệt tay từng bài)\n\n` + tbl(rows.filter(r=> r.scope === "giáo án mẫu" || r.scope === "bài lõi"));
md += `## Thư viện — bài trong bảng đổi dụng cụ\n\n` + tbl(rows.filter(r=> r.scope === "thư viện · đổi dụng cụ"));
for(const s of ["uni", "either"]){ const L = rows.filter(r=> r.scope === "thư viện 800+" && r.side === s); md += `## Thư viện 800+ — ${LBL[s]}: ${L.length} bài\n\n` + tbl(L); }
md += `## Thư viện 800+ — Hai bên (bi): ${cnt(groups[3][1], "bi")} bài\n\nXem đầy đủ trong side.csv.\n`;

if(OUT){ fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "side.csv"), csv); fs.writeFileSync(path.join(OUT, "summary.md"), md); }
console.log(`Tổng ${rows.length}: uni ${cnt(rows, "uni")} · either ${cnt(rows, "either")} · bi ${cnt(rows, "bi")}`);
groups.forEach(([n, L])=> console.log(`  ${n}: ${L.length} — uni ${cnt(L, "uni")} · either ${cnt(L, "either")} · bi ${cnt(L, "bi")}`));
if(process.argv.includes("--dump")) rows.forEach(r=> console.log([r.side, r.id, r.eq, r.kind, r.why].join(" | ")));
