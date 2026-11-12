/* =========================================================================
   TapEasy — kiểm thử icon biến hình (morph-icons.js) trong trình duyệt thật, với thư viện GIẢ
   (window.Morphicons.createMorph mô phỏng: đặt d ban đầu, morphTo nội suy qua requestAnimationFrame).
   python3 scripts/build-single-html.py _test/morph.html --offline --test tests/browser/t_morph.js
   Lần đầu: ghi state đã onboard vào localStorage rồi tải lại. Kết quả: document.title = "PASS x/y ERR n", window.__results.
   ========================================================================= */
(function(){
  const KEY = "fitkit_state_v1";
  if(!localStorage.getItem(KEY)){
    localStorage.setItem(KEY, JSON.stringify({ onboarded:true, authDone:true, hsDismissed:true,
      profile:{ name:"Tester", gender:"male", age:28, height:172, weight:70, activity:"moderate", goal:"gain", autoTargets:true } }));
    location.reload(); return;
  }
  const results = window.__results = [];
  const ok = (name, cond, info)=> results.push({ name, pass: !!cond, info: info || "" });
  const sleep = ms=> new Promise(r=> setTimeout(r, ms));
  const errs = ()=> (window.__errs || []).filter(e=> !/Failed to load resource|net::ERR|gsi\/client|jszip|ResizeObserver loop|morphicons\.min\.js/i.test(e));
  const calls = window.__mcalls = [];
  window.Morphicons = { createMorph(el, icon, o){
    let cur = icon; el.setAttribute("d", icon); const rec = { init: icon, to: [] }; calls.push(rec);
    return { morphTo(i, s){ rec.to.push(i); requestAnimationFrame(()=>{ el.setAttribute("d", i); cur = i; }); }, set(i){ el.setAttribute("d", i); cur = i; },
      seek(){}, progress: 1, destroy(){ rec.destroyed = true; } };
  } };
  const icName = el=> { const s = el && el.querySelector(".material-symbols-rounded"); return s ? s.dataset.ic : null; };
  const pathD = el=> { const p = el && el.querySelector("svg.fk-mi path"); return p ? p.getAttribute("d") : null; };

  (async ()=>{
    await sleep(800);
    try{ if(typeof closeSheet === "function") closeSheet(); }catch(e){}
    await sleep(300);
    ok("fkMorph sẵn sàng (thư viện giả)", window.fkMorph && fkMorph.ready());

    // 1. menu
    const mb = document.querySelector("#screen-home .btn-menu-trigger") || document.querySelector(".screen.active .btn-menu-trigger") || document.getElementById("btn-menu");
    mb.click(); await sleep(250);
    ok("Menu: ☰ → ✕", icName(mb) === "close" && pathD(mb) === fkMorph.d("close"), icName(mb) + " " + pathD(mb));
    ok("Menu: aria-label Đóng menu", mb.getAttribute("aria-label") === "Đóng menu");
    closeSheet(); await sleep(250);
    ok("Menu: ✕ → ☰ khi đóng", icName(mb) === "menu" && pathD(mb) === fkMorph.d("menu"), icName(mb));
    ok("Menu: aria-label khôi phục", mb.getAttribute("aria-label") === "Mở menu", mb.getAttribute("aria-label"));

    // 2. tab dưới
    const nb = document.querySelector('.bottom-nav .nav-item[data-goto="nutrition"]');
    const n0 = calls.length; nb.click(); await sleep(250);
    ok("Tab dưới: nảy từ dạng nhỏ", calls.length > n0 && calls[n0].init === fkMorph.d("_s:restaurant") && calls[n0].to[0] === fkMorph.d("restaurant"));

    // 3. Dinh dưỡng: thêm món → '+' thành ✓ (ghi trực tiếp vào nhật ký rồi vẽ lại như các luồng thêm món)
    await sleep(200);
    const addBtn = document.querySelector('.nu-mini[data-add-meal]');
    if(addBtn){
      const meal = addBtn.getAttribute("data-add-meal");
      const c0 = calls.length;
      getDayFoodLog()[meal].push({ name:"Phở bò", grams:350, kcal:420, protein:25, carbs:50, fat:12 }); saveState(); renderNutritionScreen();
      await sleep(300);
      const b2 = document.querySelector(`.nu-mini[data-add-meal="${meal}"]`);
      ok("Thêm món: '+' → ✓", calls.slice(c0).some(c=> c.init === fkMorph.d("add") && c.to[0] === fkMorph.d("check")) && icName(b2) === "check", icName(b2));
      await sleep(1700);
      ok("Thêm món: ✓ → '+' sau 1,5 s", icName(document.querySelector(`.nu-mini[data-add-meal="${meal}"]`)) === "add");
      // chevron bữa ăn
      const tg = document.querySelector(`.nu-mini[data-toggle-meal="${meal}"]`);
      if(tg){ const c1 = calls.length; tg.click(); await sleep(250);
        ok("Bữa ăn: chevron biến hình khi mở/thu", calls.slice(c1).some(c=> c.init === fkMorph.d("chevron_left") && c.to[0] === fkMorph.d("chevron_right"))); }
    } else ok("Dinh dưỡng: có nút + bữa ăn", false);

    // 4. mắt mật khẩu: sheet có ô mật khẩu
    openSheet('<div class="field"><label>Mật khẩu</label><input type="password" id="t-pw"></div>');
    await sleep(250);
    const eye = document.querySelector("#sheet-content .fk-pw-eye"), pw = document.getElementById("t-pw");
    ok("Mật khẩu: có nút mắt 44px", eye && eye.offsetWidth >= 44 && eye.offsetHeight >= 44, eye && eye.offsetWidth);
    if(eye){ eye.click(); await sleep(100);
      ok("Mật khẩu: hiện chữ + icon mắt gạch + aria", pw.type === "text" && icName(eye) === "visibility_off" && eye.getAttribute("aria-label") === "Ẩn mật khẩu");
      eye.click(); await sleep(100); ok("Mật khẩu: ẩn lại", pw.type === "password" && icName(eye) === "visibility"); }
    closeSheet(); await sleep(250);

    // 5. theme sáng ↔ tối
    goto("profile"); try{ renderProfileScreen(); }catch(e){} await sleep(300);
    const lightOpt = document.querySelector('[data-fk-theme="light"]') || [...document.querySelectorAll("[data-fk-theme]")].find(b=> fkTheme.isLight && fkTheme.isLight(b.dataset.fkTheme));
    if(lightOpt){ const c2 = calls.length; lightOpt.click(); await sleep(300);
      ok("Theme: trăng → mặt trời", calls.slice(c2).some(c=> c.init === fkMorph.d("dark_mode") && c.to[0] === fkMorph.d("light_mode")));
      const dk = document.querySelector('[data-fk-theme="dark"]') || document.querySelector('[data-fk-theme="default"]'); if(dk){ dk.click(); await sleep(300); }
    } else ok("Theme: có lựa chọn sáng", false);

    // 6. buổi tập: tick hiệp + nút tạm dừng nghỉ
    goto("workout"); try{ renderWorkoutScreen(); }catch(e){} await sleep(300);
    const st = document.getElementById("btn-start-session");
    if(st){ st.click(); await sleep(600);
      const hs = document.getElementById("hs-pre-go") || document.getElementById("ach-pre-go"); if(hs){ hs.click(); await sleep(500); }
      const sc = document.querySelector("#sheet-content .set-check");
      if(sc){ const c3 = calls.length; sc.click(); await sleep(400);
        ok("Tick hiệp: vòng → ✓", calls.slice(c3).some(c=> c.init === fkMorph.d("_ring") && c.to[0] === fkMorph.d("check")));
        const rp = document.getElementById("fk-rest-pause"), rest = document.getElementById("set-rest");
        ok("Nghỉ: có nút tạm dừng", !!rp && rest && !rest.hidden, rest && rest.hidden);
        if(rp){ const n1 = document.getElementById("rest-num").textContent; rp.click(); await sleep(2200);
          ok("Nghỉ: tạm dừng → đồng hồ đứng + icon phát", document.getElementById("rest-num").textContent === n1 && icName(rp) === "play_arrow" && rp.getAttribute("aria-label") === "Tiếp tục đếm nghỉ");
          rp.click(); await sleep(1300);
          ok("Nghỉ: tiếp tục → đếm lại + icon tạm dừng", Number(document.getElementById("rest-num").textContent) < Number(n1) && icName(rp) === "pause"); }
      } else ok("Buổi tập: có ô tick hiệp", false, "");
      try{ closeSheet(); }catch(e){}
    } else ok("Buổi tập: có nút Bắt đầu", false);
    await sleep(300);

    // 7. reduced motion giả lập: tắt → đổi tức thì
    fkMorph.disabled = true; const c4 = calls.length;
    const tmp = document.createElement("button"); tmp.innerHTML = '<span class="material-symbols-rounded">menu</span>'; document.body.appendChild(tmp); await sleep(50);
    ok("Tắt biến hình → đổi tức thì", fkMorph(tmp, "close") === false && calls.length === c4 && icName(tmp) === "close");
    tmp.remove(); fkMorph.disabled = false;

    const e = errs();
    ok("Không lỗi JS", e.length === 0, e.join(" | ").slice(0, 400));
    const pass = results.filter(r=> r.pass).length;
    document.title = `PASS ${pass}/${results.length} ERR ${e.length}`;
  })().catch(err=>{ ok("ném lỗi", false, err && err.stack); document.title = "FAIL " + (err && err.message); });
})();
