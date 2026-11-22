#!/usr/bin/env node
/* =========================================================================
   TapEasy — KIỂM TRA ẢNH BÌA BÀI TẬP (fkThumb trong exdb.js)
     node scripts/thumb-audit.js                      in tóm tắt, exit 1 nếu có lỗi
     node scripts/thumb-audit.js --out <thư mục>      ghi audit.md + audit.json (+ contact sheet nếu có ImageMagick)
     node scripts/thumb-audit.js --write-svg          (tái) tạo assets/ex-thumbs/<dụng cụ>.svg từ fkThumb.ICONS
   Kiểm:
     · mỗi bài chuẩn (data.js + templates.js) → nguồn ảnh bìa: ex3d (khung 3D của chính bài) | exdb (ảnh free-exercise-db của
       chính bài) | neutral (ô minh hoạ dụng cụ, không có người)
     · bảng FK_EX3D_SLUGS khớp media/ex3d/index.json, file .jpg tồn tại; id exdb tồn tại (EXDB_VI)
     · trong cùng nhóm cơ (MUSCLE_GROUPS_UI của library.js) không có 2 bài khác nhau dùng chung 1 ảnh người tập
     · toàn bộ ~870 bài free-exercise-db + bài chuẩn: không 2 bài khác id dùng chung 1 ảnh (trừ cùng id = cùng động tác)
     · không còn ảnh nhóm cơ cũ (IMG.muscle_* / Pexels / people-ai) làm ảnh bìa bài
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : "";
const WRITE_SVG = args.includes("--write-svg");

function load(){
  const ctx = { console, setTimeout: ()=>0, clearTimeout(){}, setInterval: ()=>0, localStorage:{ getItem(){ return null; }, setItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = ["data.js", "templates.js", "exdb.js", "exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"];
  for(const f of files){
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    try{ vm.runInContext(src + "\n;this.EXERCISES = typeof EXERCISES !== 'undefined' ? EXERCISES : this.EXERCISES;", ctx, { filename: f }); }
    catch(e){ if(f === "templates.js" && ctx.EXERCISES) continue; throw e; }
  }
  /* nhóm cơ của thư viện (library.js) */
  const lib = fs.readFileSync(path.join(ROOT, "library.js"), "utf8");
  const m = lib.match(/const MUSCLE_GROUPS_UI = (\[[\s\S]*?\n\]);/);
  ctx.MUSCLE_GROUPS_UI = vm.runInContext("(" + m[1] + ")", ctx);
  return ctx;
}

function groupsOf(G, e){
  const parts = String(e.muscle || "").split("/").map(s=> s.trim());
  return G.MUSCLE_GROUPS_UI.filter(g=> (g.vi || []).some(v=> parts.includes(v))).map(g=> g.id);
}

function audit(G){
  const T = G.fkThumb, E = G.EXERCISES;
  const errors = [], warns = [];
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "media/ex3d/index.json"), "utf8"));
  /* 1) bảng 3D khớp index.json */
  const fromIdx = {}; idx.forEach(x=>{ if((x.ids || []).length) fromIdx[x.slug] = x.ids; });
  if(JSON.stringify(fromIdx) !== JSON.stringify(T.EX3D)) errors.push("FK_EX3D_SLUGS (exdb.js) lệch media/ex3d/index.json — chạy lại bảng");
  Object.entries(T.EX3D_CORE).forEach(([k, slug])=>{ const x = idx.find(i=> i.slug === slug); if(!x || !(x.core || []).includes(k)) errors.push(`FK_EX3D_CORE.${k} → ${slug} không khớp index.json`); });
  idx.forEach(x=>{ (x.core || []).forEach(k=>{ if(T.EX3D_CORE[k] !== x.slug) errors.push(`index.json core ${k} → ${x.slug} chưa có trong FK_EX3D_CORE`); }); });
  const exdbIds = new Set(Object.keys(G.EXDB_VI || {}));
  /* 2) từng bài chuẩn */
  const rows = Object.keys(E).map(k=>{
    const e = E[k], t = T.forKey(k);
    if(!(k in T.MAP)) errors.push(`Bài ${k} chưa có trong FK_THUMB_EXDB (thêm id exdb hoặc null)`);
    if(T.MAP[k] && exdbIds.size && !exdbIds.has(T.MAP[k])) errors.push(`Bài ${k}: id exdb "${T.MAP[k]}" không tồn tại`);
    if(t.kind === "ex3d" && !fs.existsSync(path.join(ROOT, "media/ex3d", t.ref + ".jpg"))) errors.push(`Bài ${k}: thiếu media/ex3d/${t.ref}.jpg`);
    if(t.kind === "neutral" && !fs.existsSync(path.join(ROOT, t.src))) (WRITE_SVG ? warns : errors).push(`Thiếu ${t.src}`);
    if(/pexels|people-ai|exercise-ai/.test(e.img || "")) errors.push(`Bài ${k} còn ảnh nhóm cơ cũ: ${e.img}`);
    if(e.img !== t.src) errors.push(`EXERCISES.${k}.img chưa đổi sang ảnh đúng bài`);
    return { key: k, name: e.name, muscle: e.muscle, equipment: e.equipment, groups: groupsOf(G, e), kind: t.kind, src: t.src, ref: t.ref, exdb: T.MAP[k] || "", abbr: t.abbr || "", equip: t.equip || "" };
  });
  /* 3) trùng ảnh người tập trong cùng nhóm */
  const dupGroup = [];
  G.MUSCLE_GROUPS_UI.forEach(g=>{
    const by = {};
    rows.filter(r=> r.groups.includes(g.id) && r.kind !== "neutral").forEach(r=>{ (by[r.src] = by[r.src] || []).push(r.key); });
    Object.entries(by).forEach(([src, ks])=>{ if(ks.length > 1){ dupGroup.push({ group: g.label, src, keys: ks }); errors.push(`Nhóm ${g.label}: ${ks.join(", ")} dùng chung ${src}`); } });
  });
  /* 4) toàn thư viện: bài chuẩn + mọi bài exdb */
  const all = {};
  rows.filter(r=> r.kind !== "neutral").forEach(r=> (all[r.src] = all[r.src] || []).push("fk:" + r.key + (r.exdb ? "=" + r.exdb : "")));
  const exRows = [...exdbIds].map(id=>{ const t = T.forExdb(id); (all[t.src] = all[t.src] || []).push("db:" + id); return { id, kind: t.kind, src: t.src }; });
  const dupAll = Object.entries(all).filter(([, v])=> v.length > 1).map(([src, v])=> ({ src, who: v }));
  dupAll.forEach(d=>{
    const ids = new Set(d.who.map(w=> w.replace(/^fk:[^=]*=?/, "").replace(/^db:/, "")).filter(Boolean));
    if(ids.size > 1) errors.push(`Ảnh ${d.src} dùng cho nhiều bài khác nhau: ${d.who.join(", ")}`);
    else warns.push(`Cùng động tác (cùng id) dùng chung ảnh: ${d.who.join(", ")}`);
  });
  const count = k=> rows.filter(r=> r.kind === k).length;
  const exCount = k=> exRows.filter(r=> r.kind === k).length;
  return { rows, exRows, dupGroup, dupAll, errors, warns,
    summary: { builtin: rows.length, ex3d: count("ex3d"), exdb: count("exdb"), neutral: count("neutral"),
      exdbRows: exRows.length, exdbRowsEx3d: exCount("ex3d"), exdbRowsExdb: exCount("exdb"), exdbRowsNeutral: exCount("neutral") } };
}

/* ---- ô trung tính dạng file SVG (dùng ở nơi chỉ nhận URL ảnh: meta.img) ---- */
function neutralSVG(T, kind, abbr, hue, flat){
  const h = hue == null ? (T.KIND_HUE[kind] || 190) : hue;
  const p = T.ICONS[kind] || T.ICONS.other;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},42%,32%)"/><stop offset="1" stop-color="hsl(${h},48%,15%)"/></linearGradient></defs>` +
    (flat ? `<rect width="160" height="160" fill="hsl(${h},45%,24%)"/>` : `<rect width="160" height="160" fill="url(#g)"/>`) +
    `<g transform="translate(44 ${abbr ? 30 : 44}) scale(3)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></g>` +
    (abbr ? `<text x="80" y="134" fill="#fff" font-family="DejaVu Sans, Inter, sans-serif" font-weight="700" font-size="20" text-anchor="middle" letter-spacing="1">${abbr}</text>` : "") +
    `</svg>\n`;
}
function writeSvgs(T){
  const dir = path.join(ROOT, T.NEUTRAL_DIR);
  fs.mkdirSync(dir, { recursive: true });
  Object.keys(T.ICONS).forEach(k=> fs.writeFileSync(path.join(dir, k + ".svg"), neutralSVG(T, k, "")));
  return Object.keys(T.ICONS).length;
}

function hasIM(){ try{ cp.execSync("montage -version", { stdio: "ignore" }); return true; }catch(e){ return false; } }
function contactSheet(G, res, groupId, file){
  const T = G.fkThumb;
  const g = G.MUSCLE_GROUPS_UI.find(x=> x.id === groupId);
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "thumb-"));
  const items = res.rows.filter(r=> r.groups.includes(groupId));
  const tiles = [];
  items.forEach((r, i)=>{
    const out = path.join(tmp, String(i).padStart(3, "0") + ".png");
    const short = String(r.name).replace(/\s*\(([^()]*)\)\s*$/, "\n($1)");
    const label = `${short}\n[${r.kind}${r.kind === "neutral" ? "" : ": " + r.ref}]`.replace(/"/g, "'");
    if(r.kind === "ex3d"){
      cp.execFileSync("convert", [path.join(ROOT, "media/ex3d", r.ref + ".jpg"), "-resize", "320x180", "-background", "white", "-gravity", "center", "-extent", "320x180", out]);
    }else if(r.kind === "neutral"){
      const svg = path.join(tmp, i + ".svg"); fs.writeFileSync(svg, neutralSVG(T, r.equip, r.abbr, T.neutral({ equipment: r.equipment, muscle: r.muscle, name: r.name }).hue, true));
      cp.execFileSync("convert", ["-background", "none", svg, "-resize", "180x180", "-background", "white", "-gravity", "center", "-extent", "320x180", out]);
    }else{
      cp.execFileSync("convert", ["-size", "320x180", "xc:#eef3f6", "-font", "DejaVu-Sans", "-gravity", "center", "-fill", "#345", "-pointsize", "15", "-annotate", "0",
        "free-exercise-db\n" + r.exdb + "/0.jpg\n(ảnh từ xa — Public Domain)", out]);
    }
    tiles.push({ out, label });
  });
  if(!tiles.length) return false;
  const margs = ["-font", "DejaVu-Sans", "-pointsize", "12"];
  tiles.forEach(t=> margs.push("-label", t.label, t.out));
  margs.push("-tile", "5x", "-geometry", "320x180+8+8", "-title", `Nhóm ${g.label} — ảnh bìa ${tiles.length} bài chuẩn`, file);
  cp.execFileSync("montage", margs);
  fs.rmSync(tmp, { recursive: true, force: true });
  return true;
}

function md(res, sheets){
  const s = res.summary;
  const L = [];
  L.push("# Kiểm tra ảnh bìa bài tập (thumb-audit)", "", `Ngày chạy: ${new Date().toISOString()}`, "");
  L.push("## Tóm tắt", "",
    `- Bài chuẩn (data.js + templates.js): **${s.builtin}** → khung 3D của chính bài: **${s.ex3d}** · ảnh free-exercise-db của chính bài: **${s.exdb}** · ô minh hoạ trung tính: **${s.neutral}**`,
    `- Bài free-exercise-db trong thư viện: **${s.exdbRows}** → khung 3D (clip chính của bài): **${s.exdbRowsEx3d}** · ảnh của chính bài: **${s.exdbRowsExdb}** · trung tính: **${s.exdbRowsNeutral}**`,
    `- Trùng ảnh người trong cùng nhóm cơ: **${res.dupGroup.length}** · ảnh dùng cho nhiều bài khác id: **${res.errors.filter(e=> /nhiều bài khác nhau/.test(e)).length}**`,
    `- Lỗi: **${res.errors.length}** · cảnh báo: ${res.warns.length}`, "");
  if(res.errors.length){ L.push("## Lỗi", ""); res.errors.forEach(e=> L.push("- " + e)); L.push(""); }
  if(res.warns.length){ L.push("## Cảnh báo (cùng động tác — chấp nhận)", ""); res.warns.forEach(e=> L.push("- " + e)); L.push(""); }
  if(sheets.length){ L.push("## Contact sheet", ""); sheets.forEach(f=> L.push(`- ${path.basename(f)}`)); L.push(""); }
  L.push("## Bài chuẩn → nguồn ảnh bìa", "", "| Bài | Khoá | Nhóm (thư viện) | Dụng cụ | Nguồn | Tham chiếu |", "|---|---|---|---|---|---|");
  res.rows.forEach(r=> L.push(`| ${r.name} | ${r.key} | ${r.groups.join(", ") || "—"} | ${r.equipment} | ${r.kind} | ${r.kind === "neutral" ? r.src + " (" + r.abbr + ")" : r.ref} |`));
  L.push("", "Nguồn: `ex3d` = poster clip 3D có giấy phép của chủ app (media/ex3d, ghép theo id/core trong index.json) · `exdb` = ảnh free-exercise-db (Unlicense/Public Domain, app đã credit) · `neutral` = ô icon dụng cụ (assets/ex-thumbs), không có hình người.");
  return L.join("\n") + "\n";
}

function main(){
  const G = load();
  if(WRITE_SVG) console.log("Đã ghi " + writeSvgs(G.fkThumb) + " file SVG vào " + G.fkThumb.NEUTRAL_DIR);
  const res = audit(G);
  const s = res.summary;
  console.log(`Bài chuẩn ${s.builtin}: ex3d ${s.ex3d} · exdb ${s.exdb} · trung tính ${s.neutral}`);
  console.log(`Bài exdb ${s.exdbRows}: ex3d ${s.exdbRowsEx3d} · exdb ${s.exdbRowsExdb} · trung tính ${s.exdbRowsNeutral}`);
  console.log(`Trùng trong nhóm: ${res.dupGroup.length} · lỗi ${res.errors.length} · cảnh báo ${res.warns.length}`);
  res.errors.forEach(e=> console.log("  ✗ " + e));
  if(OUT){
    fs.mkdirSync(OUT, { recursive: true });
    const sheets = [];
    if(hasIM()){
      [["quads", "dui-truoc"], ["chest", "nguc"], ["back", "lung"]].forEach(([g, n])=>{
        const f = path.join(OUT, `contact-${n}.jpg`);
        try{ if(contactSheet(G, res, g, f)) sheets.push(f); }catch(e){ console.log("  ⚠ contact sheet " + g + ": " + e.message); }
      });
    } else console.log("  ⚠ không có ImageMagick — bỏ qua contact sheet");
    fs.writeFileSync(path.join(OUT, "audit.md"), md(res, sheets));
    fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify({ summary: res.summary, rows: res.rows, errors: res.errors, warns: res.warns }, null, 1));
    console.log("Báo cáo: " + path.join(OUT, "audit.md"));
  }
  process.exitCode = res.errors.length ? 1 : 0;
}
if(require.main === module) main();
module.exports = { load, audit };
