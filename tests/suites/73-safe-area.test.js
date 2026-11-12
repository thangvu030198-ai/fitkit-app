/* =========================================================================
   App FIT màn hình điện thoại (13/11/2026) — vùng an toàn tai thỏ / dynamic island / thanh home.
   Chạy riêng: node tests/run.js --only safe-area
   - meta viewport có viewport-fit=cover
   - :root định nghĩa --sat/--sab/--sal/--sar = env(safe-area-inset-*, 0px)
   - các lớp chính (app-shell, sheet + header + nút đóng, bottom nav, toast, onboarding, sàng lọc, đăng nhập, màn chào)
     dùng vùng an toàn; sheet cao tối đa calc(100dvh − safe-top − 12px); lề chữ ngang ≥ 16 px
   - tính bố cục (CSS thắng cuối cùng) ở 390×844, 375×667 (iPhone SE), 430×932 với vùng an toàn thật của máy
   Đo pixel thật trong Chromium: scripts/intro-video/director.js (TI.safeAudit) khi chụp video — docs/INTRO-VIDEO.md.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const strip = s=> s.replace(/\/\*[\s\S]*?\*\//g, "");

/** khai báo `prop` thắng cuối cùng của đúng selector (khớp nguyên văn) trong css — bỏ qua @media/@supports lồng */
function lastDecl(css, selector, prop){
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(?:^|[}\\n])\\s*" + esc + "\\s*\\{([^{}]*)\\}", "g");
  let val = null;
  for(const m of strip(css).matchAll(re)){
    for(const d of m[1].matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi)) if(d[1].toLowerCase() === prop) val = d[2].trim();
  }
  return val;
}
/** tính biểu thức CSS độ dài (px, %, dvh, var(--sa*), min/max/calc) ra px */
function evalLen(expr, env){
  let e = String(expr).replace(/!important/, "").trim();
  e = e.replace(/var\(\s*(--[a-z-]+)\s*(?:,[^()]*)?\)/gi, (m, v)=> String(env.vars[v] != null ? env.vars[v] : 0) + "px");
  e = e.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*)?\)/gi, (m, k)=> env.inset[k] + "px");
  e = e.replace(/([\d.]+)dvh/g, (m, n)=> `(${n}*${env.H}/100)`).replace(/([\d.]+)vh/g, (m, n)=> `(${n}*${env.H}/100)`)
       .replace(/([\d.]+)%/g, (m, n)=> `(${n}*${env.base}/100)`).replace(/([\d.]+)px/g, "$1")
       .replace(/\bmin\(/g, "Math.min(").replace(/\bmax\(/g, "Math.max(").replace(/\bcalc\(/g, "(");
  if(!/^[\d\s.+\-*/(),Mathminax]*$/.test(e)) throw new Error("không tính được: " + expr + " → " + e);
  return Function("return (" + e + ")")();
}
const DEVICES = [
  { name:"iPhone 14/15 Pro 390×844", W:390, H:844, inset:{ top:59, bottom:34, left:0, right:0 } },
  { name:"iPhone 12/13 390×844",     W:390, H:844, inset:{ top:47, bottom:34, left:0, right:0 } },
  { name:"iPhone SE 375×667",        W:375, H:667, inset:{ top:20, bottom:0,  left:0, right:0 } },
  { name:"iPhone Pro Max 430×932",   W:430, H:932, inset:{ top:59, bottom:34, left:0, right:0 } },
];
/** tách giá trị shorthand theo khoảng trắng ở cấp ngoài cùng (giữ nguyên min()/calc() lồng nhau) */
function splitTop(v){ const out = []; let depth = 0, cur = ""; for(const ch of String(v).trim()){ if(ch === "(") depth++; if(ch === ")") depth--; if(/\s/.test(ch) && !depth){ if(cur) out.push(cur); cur = ""; } else cur += ch; } if(cur) out.push(cur); return out; }
const envOf = d=> ({ H:d.H, base:d.H, inset:d.inset, vars:{ "--sat":d.inset.top, "--sab":d.inset.bottom, "--sal":d.inset.left, "--sar":d.inset.right, "--fk-gutter":16, "--nav-h":76, "--topbar-h":56 } });

module.exports = {
  name: "App fit màn hình điện thoại — vùng an toàn (safe-area)",
  area: "index.html · style.css · health-safety.css",
  async define(t){
    const html = read("index.html"), style = read("style.css"), hs = read("health-safety.css");

    t.test("index.html: meta viewport width=device-width + viewport-fit=cover", ()=>{
      const m = /<meta\s+name="viewport"\s+content="([^"]+)"/i.exec(html);
      assert.ok(m, "thiếu meta viewport");
      assert.match(m[1], /width=device-width/);
      assert.match(m[1], /viewport-fit=cover/, "thiếu viewport-fit=cover → env(safe-area-inset-*) = 0 trên iPhone");
    });

    t.test(":root có --sat/--sab/--sal/--sar = env(safe-area-inset-*, 0px) (có fallback)", ()=>{
      for(const [v, k] of [["--sat", "top"], ["--sab", "bottom"], ["--sal", "left"], ["--sar", "right"]]){
        const d = lastDecl(style, ":root", v);
        assert.ok(d, ":root thiếu " + v);
        assert.match(d, new RegExp("env\\(\\s*safe-area-inset-" + k + "\\s*,\\s*0px\\s*\\)"), v + " phải là env(safe-area-inset-" + k + ", 0px)");
      }
      assert.ok(lastDecl(style, ":root", "--fk-safe"), ":root thiếu --fk-safe (director.js dùng để nhận bản app đã fit)");
    });

    t.test("Lớp chính dùng vùng an toàn: app-shell, sheet, header sheet, bottom nav, toast, onboarding, đăng nhập, sàng lọc, màn chào", ()=>{
      const need = [
        ["#app-shell", "padding-top", /var\(--sat\)/],
        [".sheet", "max-height", /100dvh\s*-\s*var\(--sat\)\s*-\s*12px/],
        [".sheet", "padding", /var\(--sab\)/],
        [".sheet > .sheet-header", "position", /sticky/],
        [".bottom-nav", "margin-bottom", /var\(--sab\)/],
        ["#toast", "bottom", /var\(--sab\)/],
        ["#onboarding", "padding", /var\(--sat\)[\s\S]*var\(--sab\)/],
        ["#auth:not(.wl-mode)", "padding", /var\(--sat\)[\s\S]*var\(--sab\)/],
      ];
      for(const [sel, prop, re] of need){
        const v = lastDecl(style, sel, prop);
        assert.ok(v, `style.css: ${sel} thiếu ${prop}`);
        assert.match(v, re, `style.css: ${sel} { ${prop}: ${v} } chưa chừa vùng an toàn`);
      }
      assert.match(lastDecl(hs, "#hs-overlay", "padding") || "", /var\(--sat[\s\S]*var\(--sab/, "#hs-overlay (sàng lọc sức khoẻ) phải chừa trên + dưới");
      assert.match(lastDecl(style, ".wl-nav", "padding") || "", /env\(safe-area-inset-top\)/, "màn chào: .wl-nav phải chừa safe-top");
      assert.match(lastDecl(style, ".wl-start", "padding") || "", /env\(safe-area-inset-bottom\)/, "màn chào: .wl-start phải chừa safe-bottom");
    });

    t.test("Lề chữ ngang ≥ 16 px: sheet, header sheet, nội dung, topbar, bước onboarding", ()=>{
      const env = envOf(DEVICES[0]);
      const horiz = (sel, file)=>{
        const p = lastDecl(file || style, sel, "padding"); assert.ok(p, sel + " thiếu padding");
        const parts = splitTop(p); const r = parts[1] || parts[0], l = parts[3] || r;
        return Math.min(evalLen(r, env), evalLen(l, env));
      };
      for(const sel of [".sheet", ".sheet > .sheet-header", ".content", ".onboard-step"]) assert.ok(horiz(sel) >= 16, sel + " lề ngang < 16 px");
      assert.ok(evalLen(lastDecl(style, ".topbar", "padding-left"), env) >= 16, ".topbar lề trái < 16 px");
      assert.ok(evalLen(lastDecl(style, ".topbar", "padding-right"), env) >= 16, ".topbar lề phải < 16 px");
    });

    for(const d of DEVICES){
      t.test("Bố cục " + d.name + ": sheet dưới dynamic island ≥ 12 px, dock + toast trên thanh home", ()=>{
        const env = envOf(d);
        const maxH = evalLen(lastDecl(style, ".sheet", "max-height"), env);
        const sheetTop = d.H - maxH;
        assert.ok(sheetTop >= d.inset.top + 12 - 0.01, `sheet cao nhất ${maxH.toFixed(0)} px → mép trên y=${sheetTop.toFixed(0)} < ${d.inset.top + 12}`);
        const pad = splitTop(lastDecl(style, ".sheet", "padding"));
        assert.ok(evalLen(pad[2] || pad[0], env) >= d.inset.bottom + 16, "đáy sheet chưa chừa thanh home + 16 px");
        const navMb = evalLen(lastDecl(style, ".bottom-nav", "margin-bottom"), env);
        assert.ok(navMb >= d.inset.bottom && navMb >= 10, `dock cách đáy ${navMb} px < thanh home ${d.inset.bottom}`);
        const toastB = evalLen(lastDecl(style, "#toast", "bottom"), env);
        assert.ok(toastB >= 64 + navMb, `toast (đáy ${toastB} px) đè dock`);
        const shellTop = evalLen(lastDecl(style, "#app-shell", "padding-top"), env);
        assert.equal(shellTop, d.inset.top, "topbar phải bắt đầu ngay dưới vùng an toàn trên");
      });
    }
  }
};
