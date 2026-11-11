/* =========================================================================
   FIT KIT tests — nạp app vào vm context (đúng thứ tự <script> của index.html)
   createApp(opts) → { ctx, ev(expr), call(fn, ...args), dom, fetchLog, setNow(date),
                       flushTimers(), dispose(), loadErrors, consoleLog }
   - localStorage: Map trong bộ nhớ (riêng mỗi app)
   - fetch giả: trả fixture cho media/wger|extra/index.json; URL khác → 404;
     giá trị fixture "__404__" → HTTP 404, "__offline__" → fetch ném TypeError (mất mạng)
   - Đồng hồ giả: setNow("2026-11-11T09:00") → mọi `new Date()` / Date.now() trong app
   - Timer: setTimeout ≤ 1000 ms chạy thật (đã theo dõi để huỷ), > 1000 ms và
     setInterval được GIỮ LẠI (không tự chạy) → test xác định, không treo tiến trình
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { makeDom } = require("./dom");

const APP_DIR = path.resolve(__dirname, "..", "..");
const FIX_DIR = path.resolve(__dirname, "..", "fixtures");

function scriptOrder(){
  const html = fs.readFileSync(path.join(APP_DIR, "index.html"), "utf8");
  return [...html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g)]
    .map(m=> m[1]).filter(s=> !/^https?:/i.test(s));
}

function makeStorage(seed){
  const m = new Map(Object.entries(seed || {}));
  return {
    getItem(k){ k = String(k); return m.has(k) ? m.get(k) : null; },
    setItem(k, v){ m.set(String(k), String(v)); },
    removeItem(k){ m.delete(String(k)); },
    clear(){ m.clear(); },
    key(i){ return [...m.keys()][i] ?? null; },
    get length(){ return m.size; },
    _map: m,
  };
}

const DEFAULT_FIXTURES = {
  "media/wger/index.json": "wger-index.json",
  "media/extra/index.json": "extra-index.json",
};

function makeFetch(fetchLog, fixtures){
  return async function fakeFetch(url){
    url = String(url && url.url || url);
    fetchLog.push(url);
    const hit = Object.keys(fixtures).find(k=> url.split("?")[0].endsWith(k));
    if(hit && fixtures[hit] === "__offline__") throw new TypeError("Failed to fetch");      // mất mạng
    if(hit && fixtures[hit] !== "__404__"){
      const body = fs.readFileSync(path.join(FIX_DIR, fixtures[hit]), "utf8");
      return { ok:true, status:200, url, headers:{ get(){ return "application/json"; } },
        json: async ()=> JSON.parse(body), text: async ()=> body, blob: async ()=> ({ size: body.length }) };
    }
    return { ok:false, status:404, url, headers:{ get(){ return null; } },
      json: async ()=> { throw new Error("404 " + url); }, text: async ()=> "", blob: async ()=> ({ size:0 }) };
  };
}

/** Tạo state đã onboard + authDone để appBoot() đi thẳng vào app chính */
function seededState(extra){
  return Object.assign({
    onboarded: true, authDone: true,
    profile: { name:"Tester", gender:"male", age:28, height:172, weight:70, activity:"moderate", goal:"gain", autoTargets:true },
  }, extra || {});
}

async function createApp(opts={}){
  const dom = makeDom();
  const fetchLog = [], consoleLog = [], loadErrors = [], asyncErrors = [];
  const held = [];                  // timer bị giữ (delay > 1000 ms, setInterval)
  const live = new Set();           // timer thật đang chạy
  let seq = 0;
  const storageSeed = Object.assign({}, opts.storage || {});
  if(opts.state !== false) storageSeed["fitkit_state_v1"] = storageSeed["fitkit_state_v1"] || JSON.stringify(seededState(opts.state));
  const localStorage = makeStorage(storageSeed);
  const fixtures = Object.assign({}, DEFAULT_FIXTURES, opts.fixtures || {});   // sửa được lúc chạy (giả lập mất/có mạng)
  const sessionStorage = makeStorage();

  const sandbox = {
    console: {
      log: (...a)=> consoleLog.push(["log", a.map(String).join(" ")]),
      info: (...a)=> consoleLog.push(["info", a.map(String).join(" ")]),
      warn: (...a)=> consoleLog.push(["warn", a.map(String).join(" ")]),
      error: (...a)=> consoleLog.push(["error", a.map(x=> x && x.stack || String(x)).join(" ")]),
      debug(){}, table(){}, group(){}, groupEnd(){}, time(){}, timeEnd(){},
    },
    document: dom, localStorage, sessionStorage,
    fetch: makeFetch(fetchLog, fixtures),
    navigator: { userAgent:"node-test", language:"vi-VN", languages:["vi-VN"], onLine:true, vibrate(){ return true; },
      clipboard:{ writeText: async ()=>{} }, share: undefined, maxTouchPoints:0, platform:"node" },
    location: { href:"https://test.local/fitkit/index.html", origin:"https://test.local", protocol:"https:", host:"test.local",
      hostname:"test.local", pathname:"/fitkit/index.html", search:"", hash:"", reload(){}, replace(){}, assign(){} },
    history: { pushState(){}, replaceState(){}, back(){}, state:null, length:1 },
    screen: { width:390, height:844 }, innerWidth:390, innerHeight:844, devicePixelRatio:2,
    alert(){}, prompt(){ return null; }, confirm(){ return sandbox.__confirmAnswer !== false; },
    scrollTo(){}, open(){ return null; }, print(){}, matchMedia(){ return { matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }; },
    getComputedStyle(){ return { display:"block", getPropertyValue(){ return ""; } }; },
    requestAnimationFrame(){ return 0; }, cancelAnimationFrame(){},
    requestIdleCallback(){ return 0; }, cancelIdleCallback(){},
    MutationObserver: class { observe(){} disconnect(){} takeRecords(){ return []; } },
    IntersectionObserver: class { observe(){} unobserve(){} disconnect(){} },
    ResizeObserver: class { observe(){} unobserve(){} disconnect(){} },
    Event: class { constructor(t, o){ this.type = t; Object.assign(this, o||{}); } preventDefault(){} stopPropagation(){} },
    CustomEvent: class { constructor(t, o){ this.type = t; this.detail = o && o.detail; } preventDefault(){} stopPropagation(){} },
    FileReader: class { readAsDataURL(){ setTimeout(()=>{ this.result = "data:,"; this.onload && this.onload(); }, 0); } readAsText(){ setTimeout(()=>{ this.result = ""; this.onload && this.onload(); }, 0); } readAsArrayBuffer(){ setTimeout(()=>{ this.result = new ArrayBuffer(0); this.onload && this.onload(); }, 0); } },
    Image: class { constructor(){ this.onload = null; this.onerror = null; } set src(v){ this._src = v; } get src(){ return this._src; } },
    Blob: typeof Blob !== "undefined" ? Blob : class {},
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, structuredClone,
    crypto: require("crypto").webcrypto,
    indexedDB: { open(){ return {}; }, deleteDatabase(){ return {}; } },   // request không bao giờ xong → không lỗi
    performance: { now: ()=> Number(process.hrtime.bigint() / 1000000n) },
    queueMicrotask,
    __confirmAnswer: true,
  };
  sandbox.HTMLElement = dom.Element; sandbox.Element = dom.Element; sandbox.Node = dom.Element;
  sandbox.HTMLVideoElement = dom.Element; sandbox.HTMLImageElement = dom.Element;

  // ---- Timer: theo dõi được, không giữ tiến trình sống ----
  sandbox.setTimeout = (fn, ms, ...a)=>{
    const id = ++seq;
    if(typeof fn !== "function") return id;
    if((ms||0) > 1000){ held.push({ id, fn, a, kind:"timeout", ms }); return id; }
    const h = setTimeout(()=>{ live.delete(h); try{ fn(...a); }catch(e){ asyncErrors.push(e); } }, ms||0);
    h._fkId = id; live.add(h); return id;
  };
  sandbox.clearTimeout = id=>{
    for(const h of live) if(h._fkId === id){ clearTimeout(h); live.delete(h); }
    const i = held.findIndex(x=> x.id === id); if(i >= 0) held.splice(i, 1);
  };
  sandbox.setInterval = (fn, ms, ...a)=>{ const id = ++seq; held.push({ id, fn, a, kind:"interval", ms }); return id; };
  sandbox.clearInterval = sandbox.clearTimeout;

  const ctx = vm.createContext(sandbox, { name:"fitkit-app" });
  vm.runInContext(`
    var window = globalThis, self = globalThis, top = globalThis, parent = globalThis;
    window.addEventListener = function(t, fn){ (globalThis.__winListeners = globalThis.__winListeners || {})[t] = ((globalThis.__winListeners||{})[t]||[]).concat(fn); };
    window.removeEventListener = function(){};
    window.dispatchEvent = function(){ return true; };
    /* Đồng hồ giả: __fkNow = null → giờ thật */
    (function(){
      const RealDate = Date;
      globalThis.__fkNow = null;
      class FKDate extends RealDate {
        constructor(...a){ if(a.length === 0) super(globalThis.__fkNow == null ? RealDate.now() : globalThis.__fkNow); else super(...a); }
        static now(){ return globalThis.__fkNow == null ? RealDate.now() : globalThis.__fkNow; }
      }
      FKDate.parse = RealDate.parse; FKDate.UTC = RealDate.UTC;
      globalThis.Date = FKDate;
    })();
  `, ctx, { filename: "harness-prelude.js" });

  const order = opts.scripts || scriptOrder();
  for(const file of order){
    const full = path.join(APP_DIR, file);
    let code;
    try{ code = fs.readFileSync(full, "utf8"); }catch(e){ loadErrors.push({ file, error: e }); continue; }
    try{ new vm.Script(code, { filename: full }).runInContext(ctx); }
    catch(e){ loadErrors.push({ file, error: e }); }
  }
  // chờ appBoot() (async) và các fetch ban đầu xong
  await new Promise(r=> setTimeout(r, opts.settleMs ?? 30));

  const api = {
    ctx, dom, fetchLog, consoleLog, loadErrors, asyncErrors, held, localStorage, order, fixtures,
    ev(expr){ return vm.runInContext(expr, ctx); },
    /** như ev() nhưng trả bản sao JSON thuần (so sánh deepEqual được, không dính prototype của vm) */
    evj(expr){ const s = vm.runInContext(`JSON.stringify(${expr})`, ctx); return s === undefined ? undefined : JSON.parse(s); },
    run(code, filename){ return vm.runInContext(code, ctx, { filename: filename || "test-snippet.js" }); },
    call(name, ...args){ const fn = vm.runInContext(name, ctx); return fn(...args); },
    /** đặt giờ giả: chuỗi "YYYY-MM-DDTHH:mm" (giờ địa phương) hoặc số ms; null = giờ thật */
    setNow(d){ ctx.__fkNow = d == null ? null : (typeof d === "number" ? d : new Date(d).getTime()); },
    /** chạy các timer đang bị giữ (1 lượt) */
    flushTimers(kind){
      const list = held.filter(h=> !kind || h.kind === kind);
      list.forEach(h=>{ if(h.kind === "timeout"){ const i = held.indexOf(h); if(i>=0) held.splice(i,1); } try{ h.fn(...h.a); }catch(e){ asyncErrors.push(e); } });
      return list.length;
    },
    lastHtml(id){ const el = dom.registry.get(id); return el ? el.innerHTML : ""; },
    async settle(ms=0){ await new Promise(r=> setTimeout(r, ms)); },
    dispose(){ for(const h of live) clearTimeout(h); live.clear(); held.length = 0; },
  };
  return api;
}

module.exports = { createApp, scriptOrder, APP_DIR, FIX_DIR, seededState };
