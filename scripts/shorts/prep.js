#!/usr/bin/env node
/* TapEasy Shorts — series.json (+ thời lượng lời đọc thật build/voice/<id>/segs.json) → kế hoạch dựng mỗi short.
   Ra: build/plans/<id>.json + <id>.js (window.__PLAN__) + <id>.srt, build/plans/index.json.
   Lời TTS dài làm short > 44,6 s → tăng tempo đọc (≤ 1,15, áp ở audio.py) thay vì cắt lời.
     node scripts/shorts/prep.js [--ids a,b] [--max 44.6]
*/
"use strict";
const fs = require("fs"), path = require("path");
const HERE = __dirname, BUILD = path.join(HERE, "build"), OUT = path.join(BUILD, "plans");
const E = require("./engine.js");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

function planFor(series, id, maxDur){
  const segP = path.join(BUILD, "voice", id, "segs.json");
  let durs = {};
  if(fs.existsSync(segP)){ try{ durs = JSON.parse(fs.readFileSync(segP, "utf8")).durs || {}; }catch(e){ console.warn("! segs.json hỏng:", id); } }
  let P = E.plan(series, id, durs);
  if(P.duration > maxDur && P.voice){
    const V = Object.keys(durs).filter(k => k !== "tempo").reduce((a, k) => a + Number(durs[k] || 0), 0);
    const tempo = Math.min(1.15, V / Math.max(1, V - (P.duration - maxDur)));
    const d2 = { tempo:Math.round(tempo * 1000) / 1000 };
    Object.keys(durs).forEach(k => { if(k !== "tempo") d2[k] = Number(durs[k]) / d2.tempo; });
    P = E.plan(series, id, d2);
    console.log(`  ${id}: lời dài → tempo ${d2.tempo} → ${P.duration}s`);
  }
  return P;
}

function main(){
  const series = JSON.parse(fs.readFileSync(path.join(HERE, "series.json"), "utf8"));
  const want = String(arg("--ids", "") || "").split(",").map(s => s.trim()).filter(Boolean);
  const ids = series.shorts.map(s => s.id).filter(id => !want.length || want.includes(id));
  const bad = want.filter(id => !series.shorts.some(s => s.id === id));
  if(bad.length){ console.error("Không có short:", bad.join(", ")); process.exit(2); }
  const maxDur = Number(arg("--max", 44.6));
  fs.mkdirSync(OUT, { recursive:true });
  const index = [];
  for(const id of ids){
    const P = planFor(series, id, maxDur);
    fs.writeFileSync(path.join(OUT, id + ".json"), JSON.stringify(P, null, 1));
    fs.writeFileSync(path.join(OUT, id + ".js"), "window.__PLAN__=" + JSON.stringify(P) + ";\n");
    fs.writeFileSync(path.join(OUT, id + ".srt"), E.srt(P));
    const S = series.shorts.find(s => s.id === id);
    index.push({ id, n:S.n, title:S.title, duration:P.duration, voice:P.voice, tempo:P.tempo, beats:P.beats.length, maxGap:E.maxGap(P), end:+(P.end.t1 - P.end.t0).toFixed(2) });
    console.log(`${String(S.n).padStart(2)} ${id.padEnd(20)} ${P.duration.toFixed(1).padStart(5)} s · ${P.beats.length} nhịp · lời ${P.voice ? "TTS" : "ước tính"} · quãng tĩnh dài nhất ${E.maxGap(P)} s`);
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
}
main();
