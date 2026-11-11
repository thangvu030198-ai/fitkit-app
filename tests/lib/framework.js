/* =========================================================================
   FIT KIT tests — khung chạy test tối giản (không thư viện ngoài)
   suite file export: { name, area, async define(t) }  — trong define():
     t.test(tên, async fn, { bug:"BUG-07", timeout })   đăng ký test
     t.info(tiêu đề, [dòng…])                           ghi danh sách tham khảo vào báo cáo
     t.app(opts)                                         tạo app mới (tự dispose khi suite xong)
   Test gắn `bug` là test tái hiện lỗi thật đã biết: khi FAIL vẫn tính là fail;
   chạy `node tests/run.js --known-ok` để không làm đỏ CI vì các lỗi đã ghi nhận.
   ========================================================================= */
"use strict";
const assert = require("assert/strict");
const { createApp } = require("./harness");

function withTimeout(p, ms, label){
  let t; const to = new Promise((_, rej)=>{ t = setTimeout(()=> rej(new Error(`Quá thời gian ${ms} ms: ${label}`)), ms); });
  return Promise.race([Promise.resolve(p).finally(()=> clearTimeout(t)), to]);
}

async function runSuite(suite, opts={}){
  const tests = [], infos = [], apps = [];
  const t = {
    test(name, fn, meta={}){ tests.push({ name, fn, meta }); },
    info(title, lines){ infos.push({ title, lines: [].concat(lines || []) }); },
    async app(o){ const a = await createApp(o); apps.push(a); return a; },
    assert,
  };
  const out = { name: suite.name, area: suite.area || suite.name, file: suite.file, results: [], infos, defineError: null };
  try{ await suite.define(t); }
  catch(e){ out.defineError = e; }
  for(const tc of tests){
    const t0 = Date.now(); let status = "pass", error = null;
    try{ await withTimeout(tc.fn(), tc.meta.timeout || 15000, tc.name); }
    catch(e){ status = "fail"; error = e; }
    out.results.push({ name: tc.name, status, ms: Date.now() - t0, bug: tc.meta.bug || null, severity: tc.meta.severity || null,
      error: error ? (error.message || String(error)) : null, stack: error && error.stack ? String(error.stack).split("\n").slice(0, 6).join("\n") : null });
  }
  apps.forEach(a=> a.dispose());
  return out;
}

/* ---- tiện ích so sánh ---- */
function approx(actual, expected, tol, msg){
  if(!(Math.abs(actual - expected) <= tol)) throw new assert.AssertionError({ message: `${msg || "approx"}: ${actual} ≉ ${expected} (±${tol})`, actual, expected });
}
/** Gom nhiều vi phạm rồi ném 1 lỗi duy nhất (liệt kê tối đa n dòng) */
function expectNone(list, title, n=12){
  if(list.length) throw new assert.AssertionError({ message: `${title}: ${list.length} vi phạm\n      - ` + list.slice(0, n).join("\n      - ") + (list.length > n ? `\n      … (+${list.length-n})` : "") });
}

module.exports = { runSuite, approx, expectNone, assert };
