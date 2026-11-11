#!/usr/bin/env node
/* =========================================================================
   Đo độ phủ mã của app khi chạy bộ test (dùng V8 coverage có sẵn trong Node,
   không cần c8/istanbul):   node tests/coverage.js
   → in bảng % dòng & % hàm đã chạy cho từng file JS của app, ghi tests/coverage.json
   Ghi chú: mỗi test tạo vm context riêng nên 1 file được nạp nhiều lần — kết quả
   được gộp (1 dòng/hàm tính là "đã chạy" nếu chạy ở bất kỳ context nào).
   ========================================================================= */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { scriptOrder, APP_DIR } = require("./lib/harness");

const covDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitkit-cov-"));
const r = spawnSync(process.execPath, [path.join(__dirname, "run.js"), "--known-ok"], { env: Object.assign({}, process.env, { NODE_V8_COVERAGE: covDir, NO_COLOR: "1" }), encoding: "utf8" });
const summary = (r.stdout || "").split("\n").filter(l=> /test ·/.test(l)).join("\n");

const files = scriptOrder();
const byUrl = {};
for(const f of fs.readdirSync(covDir)){
  const j = JSON.parse(fs.readFileSync(path.join(covDir, f), "utf8"));
  for(const s of j.result){
    const m = s.url.match(/\/FitKit\/([^/]+\.js)$/);
    if(!m || !files.includes(m[1])) continue;
    (byUrl[m[1]] = byUrl[m[1]] || []).push(s.functions);
  }
}
const rows = [];
for(const file of files){
  const src = fs.readFileSync(path.join(APP_DIR, file), "utf8");
  const lines = src.split("\n"); const starts = []; let acc = 0; for(const l of lines){ starts.push(acc); acc += l.length + 1; }
  const covered = new Uint8Array(src.length);   // OR qua mọi lần nạp
  const fnSeen = new Map();                      // "start:end" → đã gọi?
  for(const fns of (byUrl[file] || [])){
    const cnt = new Int32Array(src.length).fill(-1);
    // range ngoài trước, range trong (block) sau → ghi đè
    const ranges = fns.flatMap(fn=> fn.ranges.map((rg, i)=> ({ ...rg, fn: i === 0 ? fn : null })))
      .sort((a, b)=> a.startOffset - b.startOffset || b.endOffset - a.endOffset);
    for(const rg of ranges){
      for(let i = rg.startOffset; i < Math.min(rg.endOffset, src.length); i++) cnt[i] = rg.count;
      if(rg.fn && rg.fn.functionName !== "" ){ const k = rg.startOffset + ":" + rg.endOffset; fnSeen.set(k, (fnSeen.get(k) || false) || rg.count > 0); }
      else if(rg.fn && rg.startOffset > 0){ const k = rg.startOffset + ":" + rg.endOffset; fnSeen.set(k, (fnSeen.get(k) || false) || rg.count > 0); }
    }
    for(let i = 0; i < src.length; i++) if(cnt[i] > 0) covered[i] = 1;
  }
  let code = 0, hit = 0;
  lines.forEach((l, i)=>{
    const t = l.trim();
    if(!t || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || /^[\]\)\}];?,?$/.test(t)) return;
    code++;
    const s0 = starts[i] + l.indexOf(t[0]);
    let any = false; for(let k = s0; k < starts[i] + l.length; k++){ if(covered[k]){ any = true; break; } }
    if(any) hit++;
  });
  const fnTotal = fnSeen.size, fnHit = [...fnSeen.values()].filter(Boolean).length;
  rows.push({ file, lines: code, linePct: code ? +(hit/code*100).toFixed(1) : 0, functions: fnTotal, fnPct: fnTotal ? +(fnHit/fnTotal*100).toFixed(1) : 0 });
}
const tot = rows.reduce((a, x)=> ({ l: a.l + x.lines, h: a.h + x.lines*x.linePct/100 }), { l:0, h:0 });
console.log(summary.trim());
console.log("\nFile".padEnd(22) + "Dòng mã".padStart(9) + "% dòng".padStart(9) + "Hàm".padStart(7) + "% hàm".padStart(8));
rows.forEach(x=> console.log(x.file.padEnd(21) + String(x.lines).padStart(9) + (x.linePct + "%").padStart(9) + String(x.functions).padStart(7) + (x.fnPct + "%").padStart(8)));
console.log("TỔNG".padEnd(21) + String(tot.l).padStart(9) + ((tot.h/tot.l*100).toFixed(1) + "%").padStart(9));
fs.writeFileSync(path.join(__dirname, "coverage.json"), JSON.stringify({ at: new Date().toISOString(), rows, totalLinePct: +(tot.h/tot.l*100).toFixed(1) }, null, 1));
fs.rmSync(covDir, { recursive: true, force: true });
