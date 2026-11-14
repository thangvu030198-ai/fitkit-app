/* TapEasy — kiểm auto-fit trên trình duyệt thật (Playwright MCP: browser_run_code filename=scripts/fit-audit.js).
   Đặt window.__FIT = {lang:"vi"|"en", vps:[[w,h],…]} trước khi chạy (mặc định vi, 4 cỡ). Trả danh sách màn bị tràn ngang. */
async (page) => {
  const cfg = await page.evaluate(() => window.__FIT || {});
  const VPS = cfg.vps || [[320, 568], [360, 800], [390, 844], [430, 932]];
  const SCREENS = [["home", "goto('home')"], ["workout", "goto('workout')"], ["nutrition", "goto('nutrition')"], ["coach", "goto('coach')"], ["profile", "goto('profile')"],
    ["plans", "goto('plans')"], ["progress", "goto('progress')"], ["library", "goto('library')"], ["community", "TECommunity.open()"], ["events", "TapEv.open('events')"],
    ["kb", "TEKB.open()"], ["findpt", "TE_FINDPT.open()"], ["shop", "TapShop.open()"], ["admin", "TE_ADMIN.open()"]];
  const out = [];
  await page.evaluate(l => FK_I18N.setLang(l), cfg.lang || "vi"); await page.waitForTimeout(1200);
  for (const [w, h] of VPS) {
    await page.setViewportSize({ width: w, height: h });
    for (const [name, code] of SCREENS) {
      const err = await page.evaluate(c => { try { if (window.closeSheet) closeSheet(); try { TapShop.close(); } catch (_) { } try { TE_ADMIN.close(); } catch (_) { } (0, eval)(c); return null; } catch (e) { return String(e).slice(0, 80); } }, code);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const W = window.innerWidth, bad = [];
        const vis = el => { const s = getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05; };
        document.querySelectorAll("body *").forEach(el => {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 4) return;
          if (r.right > W + 2 && r.left < W && vis(el)) {
            let p = el.parentElement, clipped = false;
            while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.getBoundingClientRect().right <= W + 2) { clipped = true; break; } p = p.parentElement; }
            if (!clipped) bad.push((String(el.className || el.tagName)).slice(0, 36) + "@" + Math.round(r.right));
          }
        });
        return { sx: document.documentElement.scrollWidth > W + 1, n: bad.length, bad: bad.slice(0, 3).join(" | ") };
      });
      if (err || r.sx || r.n) out.push([w, name, err || "", r.sx ? "SCROLL-X" : "", r.n, r.bad].join(" ; "));
    }
  }
  return (cfg.lang || "vi") + ": " + (out.join("\n") || "KHÔNG TRÀN");
}
