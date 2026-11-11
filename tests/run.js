#!/usr/bin/env node
/* =========================================================================
   FIT KIT — chạy toàn bộ kiểm thử Node thuần (không cần npm install)
     node tests/run.js                 chạy tất cả (exit 1 nếu có test fail)
     node tests/run.js --known-ok      lỗi ĐÃ GHI NHẬN (test có mã BUG-xx) không làm exit 1
     node tests/run.js --only video    chỉ chạy suite có tên file chứa "video"
     node tests/run.js --verbose       in thêm stack + danh sách tham khảo (info)
   Kết quả chi tiết ghi vào tests/last-run.json
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { runSuite } = require("./lib/framework");

const args = process.argv.slice(2);
const KNOWN_OK = args.includes("--known-ok");
const VERBOSE = args.includes("--verbose") || args.includes("-v");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? String(args[onlyIdx+1] || "") : "";

const C = process.stdout.isTTY && !process.env.NO_COLOR
  ? { g:s=>`\x1b[32m${s}\x1b[0m`, r:s=>`\x1b[31m${s}\x1b[0m`, y:s=>`\x1b[33m${s}\x1b[0m`, d:s=>`\x1b[2m${s}\x1b[0m`, b:s=>`\x1b[1m${s}\x1b[0m` }
  : { g:s=>s, r:s=>s, y:s=>s, d:s=>s, b:s=>s };

const stray = [];
process.on("unhandledRejection", e=> stray.push(e && e.stack || String(e)));

(async ()=>{
  const dir = path.join(__dirname, "suites");
  const files = fs.readdirSync(dir).filter(f=> f.endsWith(".test.js") && (!ONLY || f.includes(ONLY))).sort();
  const t0 = Date.now();
  const suites = [];
  for(const f of files){
    const suite = require(path.join(dir, f)); suite.file = f;
    process.stdout.write(C.b(`\n▶ ${suite.name}`) + C.d(`  (${f})`) + "\n");
    const res = await runSuite(suite);
    if(res.defineError){ console.log(C.r(`  ✗ Lỗi khi khởi tạo suite: ${res.defineError.stack || res.defineError}`)); }
    for(const r of res.results){
      const tag = r.bug ? C.y(` [${r.bug}${r.severity?" · "+r.severity:""}]`) : "";
      if(r.status === "pass") console.log(`  ${C.g("✓")} ${r.name}${r.bug ? C.d(` [${r.bug} — đã hết lỗi?]`) : ""} ${C.d(r.ms+"ms")}`);
      else {
        console.log(`  ${C.r("✗")} ${r.name}${tag}`);
        console.log(C.d("      " + String(r.error).split("\n").join("\n      ")));
        if(VERBOSE && r.stack) console.log(C.d("      " + r.stack.split("\n").slice(1).join("\n      ")));
      }
    }
    if(VERBOSE) for(const inf of res.infos){ console.log(C.d(`  ℹ ${inf.title}`)); inf.lines.forEach(l=> console.log(C.d("      " + l))); }
    suites.push(res);
  }
  const all = suites.flatMap(s=> s.results);
  const pass = all.filter(r=> r.status === "pass").length;
  const fail = all.filter(r=> r.status === "fail");
  const knownFail = fail.filter(r=> r.bug);
  const newFail = fail.filter(r=> !r.bug);
  const defineErrors = suites.filter(s=> s.defineError).length;
  const bugs = [...new Set(knownFail.map(r=> r.bug))].sort();

  console.log("\n" + C.b("Tổng kết"));
  for(const s of suites){
    const p = s.results.filter(r=> r.status==="pass").length, f = s.results.length - p;
    console.log(`  ${(f ? C.r : C.g)(`${p}/${s.results.length}`)}  ${s.name}`);
  }
  console.log(`\n  ${all.length} test · ${C.g(pass + " pass")} · ${fail.length ? C.r(fail.length + " fail") : "0 fail"}` +
    ` (${knownFail.length} tái hiện lỗi đã ghi nhận: ${bugs.join(", ") || "—"}; ${newFail.length} lỗi khác)` + C.d(` · ${((Date.now()-t0)/1000).toFixed(1)}s`));
  if(stray.length) console.log(C.y(`  ⚠ ${stray.length} promise bị reject không bắt (xem last-run.json)`));

  const out = { at: new Date().toISOString(), node: process.version, total: all.length, pass, fail: fail.length,
    knownBugsFailing: bugs, newFailures: newFail.map(r=> r.name), strayRejections: stray.slice(0, 20),
    suites: suites.map(s=> ({ name:s.name, area:s.area, file:s.file, defineError: s.defineError ? String(s.defineError.stack||s.defineError) : null,
      results: s.results, infos: s.infos })) };
  try{ fs.writeFileSync(path.join(__dirname, "last-run.json"), JSON.stringify(out, null, 1)); }catch(e){}

  const failing = KNOWN_OK ? newFail.length + defineErrors : fail.length + defineErrors;
  process.exit(failing ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(2); });
