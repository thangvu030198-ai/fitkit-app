/* =========================================================================
   TapEasy — kiểm thử TÍCH HỢP trong trình duyệt thật (chèn vào bản 1 file bởi
   scripts/build-single-html.py … --test tests/browser/t_integrated.js)
   Chạy trong ngữ cảnh trình duyệt RIÊNG (localStorage trống) → đi từ màn chào:
   Dùng ngay → onboarding 5 bước → sàng lọc sức khoẻ "Để sau" → mọi màn chính →
   menu → sheet của 10 module → (vòng 2) Khám phá, Cộng đồng, PT Connect, Sự kiện, Gian hàng → buổi tập → đổi theme Sáng → kiểm tra không lỗi JS,
   không còn chữ "FIT KIT", logo TapEasy đúng đường dẫn.
   (vòng 3) Menu ☰ nhóm theo khu vực · đăng nhập quản trị demo bằng MÃ KHỞI TẠO → bảng điều khiển · Tìm PT (tìm, lọc, hồ sơ, buổi thử → đánh giá) ·
   Kho kiến thức (tìm không dấu, đọc bài) · Sự kiện đăng có ẢNH (chặn khi thiếu) · Gian hàng: thêm giỏ → mã giảm giá → checkout 3 bước.
   ?shots=1 → tại mỗi điểm chụp đặt window.__paused = "<tên>" và chờ trình điều khiển (Playwright) chụp rồi xoá cờ.
   Kết quả: document.title = "PASS x/y ERR n", window.__results, bảng nhỏ ở đáy trang.
   ?stop=<bước> dừng lại ở bước đó để chụp màn hình (welcome|home|home2|workout|nutrition|coach|profile|menu|community|admin|findpt|kb|events|shop|light)
   ========================================================================= */
(function(){
  const results = window.__results = [];
  const Q = new URLSearchParams(location.search);
  const STOP = Q.get("stop") || "";
  const sleep = ms => new Promise(r=> setTimeout(r, ms));
  const errs = ()=> (window.__errs || []).filter(e=> !/Failed to load resource|net::ERR|gsi\/client|jszip|ResizeObserver loop/i.test(e));
  let errBase = 0;
  function ok(name, cond, info){ results.push({ name, pass: !!cond, info: info || "" }); }
  function step(name, fn){ return (async ()=>{
    const before = errs().length;
    try{ await fn(); }catch(e){ ok(name + " (ném lỗi)", false, e && e.message); }
    const after = errs();
    if(after.length > before) ok(name + " — không lỗi JS", false, after.slice(before).join(" | ").slice(0, 300));
  })(); }
  const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const text = ()=> document.body.innerText || "";
  const click = el => { if(el){ el.click(); return true; } return false; };
  const $q = sel=> document.querySelector(sel), $a = sel=> Array.from(document.querySelectorAll(sel));
  async function waitFor(fn, ms){ const t0 = Date.now(); while(Date.now() - t0 < (ms || 6000)){ try{ const v = fn(); if(v) return v; }catch(e){} await sleep(60); } return null; }
  const SHOTS = Q.get("shots") === "1";
  async function shot(name){ if(!SHOTS) return; window.__paused = name; await waitFor(()=> window.__paused !== name, 20000); }

  function panel(){
    const p = results.filter(r=> r.pass).length, f = results.length - p;
    document.title = `${f ? "FAIL" : "PASS"} ${p}/${results.length} ERR ${errs().length}`;
    let box = document.getElementById("__tres");
    if(!box){ box = document.createElement("div"); box.id = "__tres";
      box.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:34vh;overflow:auto;background:rgba(0,0,0,.86);color:#fff;font:12px/1.35 monospace;padding:6px 8px;pointer-events:none";
      document.body.appendChild(box); }
    box.innerHTML = `<b>${document.title}</b><br>` + results.filter(r=> !r.pass).map(r=> `✗ ${r.name} ${r.info ? "— " + String(r.info).replace(/</g,"&lt;") : ""}`).join("<br>")
      + (errs().length ? "<br>JS: " + errs().slice(0, 6).map(e=> String(e).replace(/</g,"&lt;")).join("<br>") : "");
    if(STOP) box.style.display = "none";
  }

  async function run(){
    await sleep(1200);
    errBase = errs().length;
    ok("Khởi động không lỗi JS (mọi module)", errBase === 0, errs().join(" | ").slice(0, 300));
    const MODS = ["FKAch","FKHealth","PB","NutriPro","FKTP","PTP","exdbVi","fkTheme",
      /* vòng 2 */ "TEConnect","TECommunity","cloudEvents","TapEv","TapShop","teHomeExplore",
      /* vòng 3 */ "TE_RBAC","cloudAdmin","TE_ADMIN","TE_FINDPT","TEKB","TapMedia"];
    const typeOf = k=>{ try{ return (new Function("return typeof " + k))(); }catch(e){ return "undefined"; } };   // const toàn cục không nằm trên window
    ok("Đủ 22 module (vòng 1 + PT Connect, Cộng đồng, Sự kiện, Gian hàng + Quản trị, Tìm PT, Kho kiến thức, ảnh/clip sự kiện)", MODS.every(k=> typeOf(k) === "object") && typeof fkEmpty === "function" && typeof openProgramBuilder === "function" && typeof teCan === "function" && !!(cloud && cloud.social),
      MODS.filter(k=> typeOf(k) !== "object").join(","));

    /* 1. Màn chào */
    await step("Màn chào", async ()=>{
      const auth = document.getElementById("auth");
      ok("Màn chào mở (lần đầu)", auth && auth.classList.contains("open"));
      const brand = document.querySelector(".wl-brand img, .wl-brand .brand-text");
      ok("Logo màn chào: <img alt=TapEasy> hoặc chữ TapEasy dự phòng", brand && (brand.alt === "TapEasy" || /TapEasy/.test(brand.textContent)), brand && brand.outerHTML.slice(0, 120));
      ok("Màn chào có chữ TapEasy, không còn FIT KIT", /TapEasy/.test(text()) && !/FIT ?KIT/i.test(text()));
    });
    if(STOP === "welcome") return;

    /* 2. Dùng ngay → onboarding */
    await step("Onboarding", async ()=>{
      click(document.getElementById("auth-guest")); await sleep(500);
      const ob = document.getElementById("onboarding");
      ok("Dùng ngay → onboarding hiện", vis(ob) || (ob && ob.classList.contains("open")));
      const set = (id, v)=>{ const el = document.getElementById(id); if(el){ el.value = v; el.dispatchEvent(new Event("input", { bubbles:true })); el.dispatchEvent(new Event("change", { bubbles:true })); } };
      set("in-name", "Thử Nghiệm");
      const next = ()=> click(document.getElementById("onboard-next"));
      next(); await sleep(250);
      click(document.querySelector('[data-field="gender"][data-value="male"]')); set("in-age", "28"); next(); await sleep(250);
      set("in-height", "172"); set("in-weight", "70"); next(); await sleep(250);
      click(document.querySelector('[data-field="activity"]')); next(); await sleep(250);
      click(document.querySelector('[data-field="goal"][data-value="gain"]') || document.querySelector('[data-field="goal"]')); next(); await sleep(700);
      // health-safety: sàng lọc hiện trước khi hoàn tất → "Để sau"
      const skip = document.getElementById("hs-skip");
      ok("Sàng lọc sức khoẻ hiện sau onboarding (health-safety)", !!skip);
      if(skip){ click(skip); await sleep(600); }
      const home = document.getElementById("screen-home");
      ok("Vào Trang chủ sau onboarding", home && home.classList.contains("active"), document.querySelector(".screen.active") && document.querySelector(".screen.active").id);
    });

    /* 3. Mọi màn chính */
    const screens = ["home","workout","nutrition","coach","profile","plans","library","progress","exlib","sleep","reminders"];
    for(const s of screens){
      await step("Màn " + s, async ()=>{
        goto(s); await sleep(s === "exlib" || s === "nutrition" ? 900 : 350);
        const el = document.getElementById("screen-" + s);
        ok(`goto('${s}') → màn hiện`, el && el.classList.contains("active"));
      });
      if(STOP === s) return;
    }
    await step("Nội dung màn", async ()=>{
      goto("home"); await sleep(400);
      ok("Trang chủ: logo topbar TapEasy", !!document.querySelector('#screen-home .topbar img[alt="TapEasy"], #screen-home .topbar .brand-text'));
      /* vòng 2: thẻ lối vào của module gộp vào hàng "Khám phá"; màn đầu ≤ ~6 khối */
      const hc = document.getElementById("home-content");
      const xp = document.getElementById("te-explore");
      ok("Trang chủ: hàng Khám phá (teHomeExplore) hiện", vis(xp));
      const xids = [...document.querySelectorAll("#te-explore [data-xid]")].map(b=> b.getAttribute("data-xid"));
      ok("Khám phá (vòng 3) gọn 7 ô: Tìm PT · Cộng đồng · Sự kiện · Kho kiến thức · Gian hàng · Giáo án riêng · Giáo án mẫu", xids.join(",") === "findpt,community,events,kb,shop,builder,templates", xids.join(","));
      ok("Khám phá: tên ô Tìm PT / Kho kiến thức / Sự kiện / Gian hàng", ["Tìm PT","Cộng đồng","Sự kiện","Kho kiến thức","Gian hàng"].every(t=> [...document.querySelectorAll("#te-explore [data-xid] b")].some(b=> b.textContent.trim() === t)));
      ok("Khám phá: cuộn ngang (không xuống dòng)", xp && getComputedStyle(xp.querySelector(".te-explore-row")).overflowX === "auto" && xp.querySelector(".te-explore-row").scrollWidth > xp.querySelector(".te-explore-row").clientWidth);
      const minTap = Math.min(...[...document.querySelectorAll("#te-explore [data-xid]")].map(b=> Math.min(b.offsetWidth, b.offsetHeight)));
      ok("Khám phá: vùng chạm ≥ 44 px", minTap >= 44, String(minTap));
      ok("Thẻ trùng đã gộp: Tạo giáo án riêng + Cộng đồng không hiện thành thẻ lớn", ![...hc.querySelectorAll(".pb-home-card, #cm-home")].some(vis));
      ok("Trang chủ: không còn lưới 'Bạn muốn làm gì?' + hàng lối tắt cũ", !hc.querySelector(".entry-grid, .quick-row"));
      ok("Trang chủ: thẻ Cấp độ (achievements) vẫn có, dưới hàng Khám phá", !!hc.querySelector(".ach-mini") && (xp.compareDocumentPosition(hc.querySelector(".ach-mini")) & Node.DOCUMENT_POSITION_FOLLOWING));
      const kids = [...hc.children].filter(vis);
      const idx = sel=> kids.findIndex(n=> n.matches(sel));
      ok("Thứ tự: Chào → Tuần → Buổi hôm nay → Chỉ số → Khám phá", idx(".home-greet") === 0 && idx(".home-greet") < idx(".week-strip") && idx(".week-strip") < idx(".home-hero") && idx(".home-hero") < idx(".metric-grid") && idx(".metric-grid") < idx("#te-explore"),
        kids.map(n=> (n.className||n.id||n.tagName).toString().split(" ")[0]).join(" > "));
      const before = kids.slice(0, idx("#te-explore") + 1).filter(n=> !n.matches(".week-note"));
      ok("Màn đầu: ≤ 6 khối trước & gồm hàng Khám phá", before.length <= 6, before.map(n=> (n.className||n.id).toString().split(" ")[0]).join(" > "));
      const ring = hc.querySelector('.metric-ring circle[stroke="#5EE6C7" i]');
      ok("Theme Mặc định: html.fk-themed + mã mint cứng hiển thị teal thương hiệu (#33D6C9)", document.documentElement.classList.contains("fk-themed") && (!ring || getComputedStyle(ring).stroke === "rgb(51, 214, 201)"), ring && getComputedStyle(ring).stroke);
      goto("nutrition"); await sleep(900);
      ok("Dinh dưỡng: thẻ thực đơn nutrition-pro", !!document.querySelector("#screen-nutrition .nu-plan, #screen-nutrition [class*='np-']"));
      goto("profile"); await sleep(400);
      ok("Hồ sơ: thẻ Giao diện (themes) + Sức khoẻ (health-safety) + Thành tích", !!document.querySelector("#screen-profile [class*='fk-theme'], #screen-profile [class*='theme']") && /Sức khoẻ/.test(document.getElementById("screen-profile").innerText) && /Thành tích/.test(document.getElementById("screen-profile").innerText));
      goto("coach"); await sleep(500);
      ok("Khu PT: tiêu đề TapEasy PT", /TapEasy PT/.test(document.querySelector("#screen-coach .topbar").innerText));
    });
    if(STOP === "home2"){ goto("home"); return; }
    goto("home"); await sleep(300); await shot("home");

    /* 4. Menu */
    await step("Menu", async ()=>{
      goto("home"); await sleep(300);
      click(document.querySelector("#screen-home .btn-menu-trigger")); await sleep(400);
      const sh = document.getElementById("sheet-content");
      ok("Menu ☰ mở, có logo TapEasy + lối vào module", sh && /Tạo giáo án riêng/.test(sh.innerText) && /Thành tích/.test(sh.innerText) && /Sức khoẻ/.test(sh.innerText) && !!sh.querySelector('img[alt="TapEasy"], .brand-text'));
      ok("Menu ☰: Cộng đồng + Sự kiện + Gian hàng", sh && /Cộng đồng/.test(sh.innerText) && /Sự kiện/.test(sh.innerText) && /Gian hàng/.test(sh.innerText), sh && sh.innerText.slice(0, 300));
      await sleep(300);   // community.js / findpt.js chèn dòng ở setTimeout 0
      const heads = $a("#sheet-content .te-mgroup-h").map(h=> h.textContent.trim());
      ok("Menu ☰ nhóm theo khu vực: Tập luyện → Dinh dưỡng → Kết nối PT → Cộng đồng & Sự kiện → Kiến thức → Cửa hàng", heads.join("|") === "Tập luyện|Dinh dưỡng|Kết nối PT|Cộng đồng & Sự kiện|Kiến thức|Cửa hàng", heads.join("|"));
      ok("Menu ☰: chưa có quyền → KHÔNG có nhóm Quản trị", !$q('#sheet-content .te-mgroup[data-g="admin"]') && !/Bảng quản trị/.test(sh.innerText));
      const inG = (g, re)=> { const b = $q(`#sheet-content .te-mgroup[data-g="${g}"]`); return !!b && re.test(b.innerText); };
      ok("Menu: Tìm PT ∈ Kết nối PT, Cộng đồng ∈ Cộng đồng & Sự kiện, Kho kiến thức ∈ Kiến thức, Gian hàng ∈ Cửa hàng, Giấc ngủ ∈ Dinh dưỡng",
        inG("pt", /Tìm PT/) && inG("pt", /TapEasy PT/) && inG("social", /Cộng đồng/) && inG("social", /Sự kiện/) && inG("kb", /Kho kiến thức/) && inG("shop", /Gian hàng/) && inG("nutri", /Giấc ngủ/) && inG("train", /Tạo giáo án riêng/));
      ok("Menu: không còn dòng lạc ngoài nhóm", !$a("#sheet-content [data-te-menu] > .link-row").length);
      const rowH = Math.min(...$a("#sheet-content .te-mgroup .link-row").map(r=> r.offsetHeight));
      ok("Menu: dòng ≥ 44 px", rowH >= 44, String(rowH));
      await shot("menu");
      if(STOP !== "menu") closeSheet();
      await sleep(250);
    });
    if(STOP === "menu") return;

    /* 5. Sheet của module */
    const sheets = [
      ["Thành tích", ()=> FKAch.open()], ["Tổng kết tuần", ()=> FKAch.openWeekly("last")], ["Tạo giáo án riêng", ()=> openProgramBuilder()],
      ["Giáo án mẫu", ()=> openTemplateBrowser()], ["Đi chợ tuần", ()=> NutriPro.ui.openShoppingList()], ["Nhật ký buổi", ()=> FKTP.openLogSheet()],
      ["Sức khoẻ & an toàn", ()=> openHealthSafety()], ["Thêm món", ()=> openAddFood("lunch")], ["Lịch PT tổng hợp", ()=> PTP.openCalendar()],
      ["Thư viện + tìm 'day nguc'", async ()=>{ goto("exlib"); await sleep(600); const i = document.querySelector("#screen-exlib input"); if(i){ i.value = "day nguc"; i.dispatchEvent(new Event("input", { bubbles:true })); } await sleep(900); }],
    ];
    for(const [n, fn] of sheets){
      await step("Sheet " + n, async ()=>{
        await fn(); await sleep(450);
        ok(`Mở "${n}"`, true);
        const hs = document.getElementById("hs-skip"); if(hs && vis(hs)) click(hs);
        try{ closeSheet(); }catch(e){}
        if(document.getElementById("screen-achieve") && document.getElementById("screen-achieve").classList.contains("active")) goto("home");
        await sleep(200);
      });
    }

    /* 5b. Module vòng 2: Cộng đồng · PT Connect · Sự kiện · Gian hàng */
    await step("Cộng đồng", async ()=>{
      goto("home"); await sleep(300);
      click(document.querySelector('#te-explore [data-xid="community"]')); await sleep(700);
      const sc = document.getElementById("screen-community");
      ok("Ô Khám phá 'Cộng đồng' → màn Cộng đồng", sc && sc.classList.contains("active"));
      ok("Cộng đồng: có routine mẫu TapEasy Team", sc && /TapEasy Team/.test(sc.innerText), sc && sc.innerText.slice(0, 160));
      const seed = (cloud.social.seeds || [])[0];
      if(seed){ TECommunity.openDetail(seed.id); await sleep(500);
        ok("Cộng đồng: mở chi tiết routine (sheet)", /Sao chép|Sao chép vào tuần/i.test(document.getElementById("sheet-content").innerText));
        try{ closeSheet(); }catch(e){} await sleep(250); }
      if(STOP === "community") return;
      if(typeof fkHandleBack === "function") fkHandleBack(); await sleep(300);
    });
    if(STOP === "community") return;
    await step("PT Connect", async ()=>{
      // tài khoản demo (localStorage của ngữ cảnh riêng) để vào luồng PT ↔ học viên
      if(!cloud.isLoggedIn()){ await cloud.signUp("thu.nghiem@tapeasy.vn", "matkhau1", "Thử Nghiệm"); await cloud.updateMyProfile({ mainRole:"member" }); }
      goto("coach"); await sleep(700);
      ok("PT Connect cài vào màn PT", TEConnect.installed === true && document.getElementById("screen-coach").classList.contains("active"));
      openJoinSheet(); await sleep(400);
      const sh = document.getElementById("sheet-content");
      ok("Kết nối PT: sheet nhập mã / QR (pt-connect)", !!document.getElementById("jn-code") && /Nhập mã PT|Kết nối PT/.test(sh.innerText), sh.innerText.slice(0, 120));
      const inp = document.getElementById("jn-code"); if(inp){ inp.value = "ZZZZZZ"; click(document.getElementById("jn-go")); await sleep(500); }
      ok("Mã sai → báo lỗi tiếng Việt, không vỡ", !!document.getElementById("jn-err") && document.getElementById("jn-err").textContent.length > 5, document.getElementById("jn-err") && document.getElementById("jn-err").textContent);
      try{ closeSheet(); }catch(e){} await sleep(250);
      if(STOP === "coach2") return;
    });
    if(STOP === "coach2") return;
    /* 5c. Vòng 3 — QUẢN TRỊ: đăng nhập demo bằng mã khởi tạo → bảng điều khiển */
    await step("Quản trị", async ()=>{
      ok("Chưa vào phiên quản trị → teCan = false, state.isAdmin không bật được", !teCan("events.manage") && (state.isAdmin = true, !state.isAdmin));
      TE_ADMIN.open(); await waitFor(()=> $q("#adm-b-code"), 5000);
      ok("Mở bảng quản trị khi chưa có vai trò → màn Khởi tạo Chủ sở hữu (mã + mật khẩu)", !!$q("#adm-b-code") && !!$q("#adm-l-pw"));
      $q("#adm-b-code").value = "SAI-MA-0000"; $q("#adm-l-pw").value = "matkhau1"; click($q('[data-adm="bootstrap"]')); await sleep(700);
      ok("Sai mã khởi tạo → bị từ chối, chưa có vai trò", !TE_RBAC.role() && !$q("#adm-root .adm-shell"));
      $q("#adm-b-code").value = cloudAdmin.demoBootCode(); /* fix-security QS-16: mã demo ngẫu nhiên riêng máy */ $q("#adm-l-pw").value = "matkhau1"; click($q('[data-adm="bootstrap"]'));
      await waitFor(()=> $q("#adm-root .adm-shell"), 6000); await sleep(500);
      ok("Đúng mã (docs/RBAC.md §5) → Chủ sở hữu, vào bảng điều khiển", TE_RBAC.role() === "owner" && TE_RBAC.active() && !!$q("#adm-root .adm-shell"), TE_RBAC.role());
      const nav = $a("#adm-root .adm-nav-i").map(b=> b.textContent.trim());
      ok("Bảng điều khiển Owner: ≥ 10 mục (Người dùng, Đội ngũ, Kiểm duyệt, Nhật ký…)", nav.length >= 10, nav.join(" · "));
      ok("Mục của module tự đăng ký: Tìm PT · đánh giá", nav.some(t=> /Tìm PT/.test(t)), nav.join(" · "));
      ok("Tổng quan có số liệu", ($q("#adm-body") || {}).innerText && $q("#adm-body").innerText.length > 40);
      await shot("admin");
      for(const id of ["users", "team", "audit"]){
        const b = $q(`#adm-root .adm-nav-i[data-id="${id}"]`); if(!b){ ok("Mục quản trị " + id, false, "không thấy"); continue; }
        click(b); await sleep(600);
        ok("Mở mục quản trị: " + b.textContent.trim(), b.classList.contains("on") || /on/.test($q(`#adm-root .adm-nav-i[data-id="${id}"]`).className), $q("#adm-body").innerText.slice(0, 80));
      }
      ok("Nhật ký kiểm toán toàn vẹn (chuỗi băm khớp)", /chuỗi băm khớp|Toàn vẹn/i.test($q("#adm-body").innerText), $q("#adm-body").innerText.slice(0, 160));
      TE_ADMIN.close(); await sleep(300);
      ok("Đóng bảng quản trị → về app", !TE_ADMIN.isOpen());
      ok("teCan theo vai trò: Owner có events.manage + kb.publish", teCan("events.manage") && teCan("kb.publish"));
      // Menu: giờ có nhóm Quản trị
      goto("home"); await sleep(250); click($q("#screen-home .btn-menu-trigger")); await sleep(450);
      const adm = $q('#sheet-content .te-mgroup[data-g="admin"]');
      ok("Menu ☰: có vai trò → nhóm Quản trị (cuối) với 'Bảng quản trị'", !!adm && /Bảng quản trị/.test(adm.innerText) && adm === $a("#sheet-content .te-mgroup").pop());
      closeSheet(); await sleep(200);
    });
    if(STOP === "admin") return;

    /* 5d. Vòng 3 — TÌM PT: ô Khám phá → album → tìm, lọc → hồ sơ → buổi thử → đánh giá */
    await step("Tìm PT", async ()=>{
      const F = TE_FINDPT, P = cloud.ptdir, L = P.logic;
      const cards = ()=> $a("#fp-album .fp-card[data-fp-open]");
      goto("home"); await sleep(300);
      click($q('#te-explore [data-xid="findpt"]'));
      await waitFor(()=> $q("#screen-findpt.active") && cards().length, 6000);
      const n0 = cards().length;
      ok("Ô Khám phá 'Tìm PT' → album PT công khai (≥ 20 thẻ minh hoạ)", !!$q("#screen-findpt.active") && n0 >= 20, n0);
      const inp = $q("#fp-q"); inp.value = "cau giay"; inp.dispatchEvent(new Event("input", { bubbles:true }));
      await waitFor(()=> cards().length === 1, 2500);
      ok("Tìm không dấu 'cau giay' → 1 PT (Khang)", cards().length === 1 && /Khang/.test(cards()[0].textContent), cards().length);
      click($q("[data-fp='clearq']")); await sleep(200);
      click($q('[data-fp-quick="female"]')); await sleep(200);
      const nf = L.filterListings(F._C.list, Object.assign({}, P.data.DEFAULT_FILTER, { gender:"female" })).length;
      ok("Lọc nhanh 'PT nữ' khớp logic", cards().length === nf && nf > 0, cards().length + "/" + nf);
      click($q('[data-fp-quick="female"]')); await sleep(200);
      click($q("[data-fp='filters']")); await waitFor(()=> $q("#ff-prov"), 2000);
      const sel = $q("#ff-prov"); sel.value = "hn"; sel.dispatchEvent(new Event("change", { bubbles:true })); await sleep(120);
      const mx = $q("#ff-pmax"); if(mx){ mx.value = 600000; mx.dispatchEvent(new Event("input", { bubbles:true })); }
      const expect = L.filterListings(F._C.list, Object.assign({}, P.data.DEFAULT_FILTER, { prov:"hn", priceMax: mx ? 600000 : 0 })).length;
      ok("Bộ lọc: nút áp dụng đếm trực tiếp 'Xem N PT'", new RegExp("Xem " + expect + " PT").test($q("#ff-apply").textContent), $q("#ff-apply").textContent + " / " + expect);
      click($q("#ff-apply")); await sleep(300);
      ok("Áp dụng khu vực Hà Nội + giá ≤ 600k → khớp logic", cards().length === expect, cards().length + "/" + expect);
      await shot("findpt");
      F.state().f = JSON.parse(JSON.stringify(P.data.DEFAULT_FILTER)); F.render(); await sleep(200);
      const lid = "seed_khang";
      click(cards().find(c=> c.dataset.fpOpen === lid));
      await waitFor(()=> $q("#screen-ptprofile.active") && $q("#fp-rv-box .fp-rvsum"), 6000);
      ok("Mở hồ sơ PT (F1 hero) + bảng giá + đánh giá", !!$q("#screen-ptprofile.active") && /Khang/.test(($q(".pp-name") || {}).textContent || "") && !!$q("#fp-sec-rv"), ($q(".pp-name") || {}).textContent);
      const before = (await P.get(lid)).ratingCount;
      click($q('.fp-ppdock [data-fpx="trial"]')); await waitFor(()=> $q('[data-tr="send"]'), 2500);
      ok("Đặt buổi thử: sheet 14 ngày", $a("[data-tr-d]").length === 14);
      click($q('[data-tr="send"]')); await sleep(400);
      await waitFor(async()=> false, 1000);
      await F.openMyRequests(); await waitFor(()=> $q('[data-mr="simulate"]'), 4000);
      click($q('[data-mr="simulate"]')); await waitFor(()=> $q('[data-mr="review"]'), 3000);
      closeSheet(); await sleep(200);
      const el = await P.eligibility(lid);
      ok("Buổi thử đã diễn ra → đủ điều kiện đánh giá ('Đã tập buổi thử')", el.ok && el.basis && el.basis.type === "trial", JSON.stringify(el));
      await F.openListing(lid, { from:"findpt" }); await waitFor(()=> $q('.fp-rvcta [data-fprv="write"]'), 5000);
      click($q('.fp-rvcta [data-fprv="write"]')); await waitFor(()=> $q("#rc-text"), 2500);
      click($q('[data-rs="stars"][data-v="5"]')); await sleep(40);
      $q("#rc-text").value = "Buổi thử rất kỹ: kiểm tra squat, gập hông và giải thích rõ vì sao chọn từng bài <b>tập</b>.";
      if($q("#rc-ok")) $q("#rc-ok").checked = true;
      click($q('[data-rc="send"]'));
      await waitFor(()=> !$q("#sheet-backdrop").classList.contains("open"), 5000); await sleep(400);
      const mine = (await P.reviews(lid)).find(r=> r.uid === cloud.user.uid);
      ok("Đánh giá đăng công khai, số đánh giá +1", !!mine && mine.stars === 5 && (await P.get(lid)).ratingCount === before + 1, JSON.stringify({ before, now: (await P.get(lid)).ratingCount }));
      ok("Nội dung đánh giá được escape (không chèn thẻ <b>)", !$a(".fp-rvlist b").some(b=> b.textContent === "tập") && /<b>tập<\/b>/.test(($q(".fp-rvlist") || {}).textContent || ""));
      if(typeof fkHandleBack === "function"){ fkHandleBack(); await sleep(300); fkHandleBack(); await sleep(300); }
      if(!$q("#screen-home.active")) goto("home");
    });
    if(STOP === "findpt") return;

    /* 5e. Vòng 3 — KHO KIẾN THỨC: ô Khám phá → kho → tìm không dấu → đọc bài */
    await step("Kho kiến thức", async ()=>{
      goto("home"); await sleep(300);
      click($q('#te-explore [data-xid="kb"]')); await waitFor(()=> $q("#screen-kb.active") && $q("#kb-q"), 4000);
      ok("Ô 'Kho kiến thức' → màn kho, có 'Kiến thức hôm nay' đầu trang", !!$q("#screen-kb.active") && /Kiến thức hôm nay/.test($q("#screen-kb").innerText));
      const inp = $q("#kb-q"); inp.focus(); inp.value = "dau goi"; inp.dispatchEvent(new Event("input", { bubbles:true }));
      await waitFor(()=> $q("#kb-results .kb-card"), 3000); await sleep(200);
      const first = $q("#kb-results .kb-card");
      ok("Tìm không dấu 'dau goi' → bài Đau gối đầu tiên + tô sáng", first && first.dataset.kbOpen === "ph-dau-goi" && !!$q("#kb-results mark"), first && first.dataset.kbOpen);
      await shot("kb");
      click(first); await waitFor(()=> TEKB.ui.view === "article", 3000); await sleep(300);
      ok("Mở bài: trang đọc có mục lục / nguồn", TEKB.ui.view === "article" && /Nguồn|Tài liệu/i.test($q("#screen-kb").innerText));
      ok("Owner (kb.edit) thấy nút Sửa bài", !!$q('#screen-kb [data-kb-act="edit"]'));
      if(typeof fkHandleBack === "function"){ fkHandleBack(); await sleep(250); fkHandleBack(); await sleep(250); }
      if(!$q("#screen-home.active")) goto("home");
    });
    if(STOP === "kb") return;

    await step("Sự kiện", async ()=>{
      goto("home"); await sleep(300);
      click(document.querySelector('#te-explore [data-xid="events"]')); await sleep(900);
      const se = document.getElementById("screen-events");
      ok("Ô Khám phá 'Sự kiện' → màn Sự kiện", se && se.classList.contains("active"));
      ok("Sự kiện: tab Thi đua có thử thách tháng này", se && /thử thách|Thi đua/i.test(se.innerText));
      TapEv.open("events"); await sleep(600);
      ok("Sự kiện: tab Offline có sự kiện (thẻ có ảnh bìa)", /Đăng ký|Miễn phí|chỗ/i.test(se.innerText) && !!se.querySelector(".te-ev .tm-img, .te-ev img, .te-ev .tm-cover"), se.innerText.slice(0, 160));
      TapEv.open("gifts"); await sleep(400);
      ok("Sự kiện: tab Quà / điểm", /điểm|Points|Quà/i.test(se.innerText));
      if(STOP === "events") return;
    });
    if(STOP === "events") return;

    /* 5f. Vòng 3 — Sự kiện ĐĂNG CÓ ẢNH (bắt buộc ảnh/clip + mô tả ≥ 80 ký tự) */
    await step("Đăng sự kiện có ảnh", async ()=>{
      const A = TapEv._ACT, T = TapEv;
      T.open("admin"); await sleep(900);
      ok("Owner: tab Quản trị của Sự kiện (công cụ theo vai trò)", !!$q("#te-admin") && /bắt buộc có ít nhất 1 ảnh hoặc 1 video/.test($q("#te-admin").textContent));
      const n0 = (await cloudEvents.listEvents()).length;
      A["a-ev-edit"](""); await waitFor(()=> $q("#ef-title"), 2500);
      $q("#ef-title").value = "Chạy tích hợp vòng 3"; $q("#ef-venue").value = "Công viên Yên Sở"; $q("#ef-desc").value = "Chạy nhẹ 5 km."; $q("#ef-desc").dispatchEvent(new Event("input", { bubbles:true }));
      click($q("#ef-go")); await sleep(500);
      const errsF = $a("#ef-errs li").map(li=> li.textContent);
      ok("Thiếu ảnh + mô tả ngắn → chặn, báo lỗi tiếng Việt, không lưu", errsF.some(t=> /ít nhất 1 ảnh hoặc 1 video/.test(t)) && errsF.some(t=> /80 ký tự/.test(t)) && (await cloudEvents.listEvents()).length === n0, errsF.join(" | "));
      const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 800; const cx = cv.getContext("2d");
      const g = cx.createLinearGradient(0, 0, 1200, 800); g.addColorStop(0, "#FF7A45"); g.addColorStop(1, "#114650"); cx.fillStyle = g; cx.fillRect(0, 0, 1200, 800);
      const blob = await new Promise(r=> cv.toBlob(r, "image/png"));
      const dt = new DataTransfer(); dt.items.add(new File([blob], "anh-su-kien.png", { type:"image/png" }));
      const fin = $q('#sheet-content [data-tm-in="image"]'); fin.files = dt.files; fin.dispatchEvent(new Event("change", { bubbles:true }));
      await waitFor(()=> $a("#sheet-content .tm-tile:not(.busy)").length === 1, 15000);
      ok("Thêm ảnh → 1 ô ảnh bìa (nén trên máy)", $a("#sheet-content .tm-tile").length === 1);
      $q("#ef-desc").value = "Chạy nhẹ 5 km quanh hồ Yên Sở, khởi động 10 phút, chia nhóm tốc độ, giãn cơ cuối buổi. Có nước uống và y tế đi kèm.";
      $q("#ef-desc").dispatchEvent(new Event("input", { bubbles:true }));
      click($q("#ef-go"));
      await waitFor(()=> T.cache.events.some(e=> e.title === "Chạy tích hợp vòng 3"), 15000);
      const ne = T.cache.events.find(e=> e.title === "Chạy tích hợp vòng 3");
      ok("Lưu sự kiện có ảnh (idb:) + ghi nhật ký kiểm toán", !!ne && ne.media.length === 1 && /^idb:/.test(ne.media[0].src), ne && JSON.stringify(ne.media.map(m=> m.src)));
      const audit = await cloudAdmin.listAudit({});
      ok("Nhật ký kiểm toán có event.save", audit.some(a=> /^event\./.test(a.action)), audit.slice(0, 5).map(a=> a.action).join(","));
      T.open("events"); await sleep(500);
      await waitFor(()=> { const c = $a("#te-body .te-ev").find(c=> /Chạy tích hợp vòng 3/.test(c.textContent)); return c && /^blob:/.test((c.querySelector(".tm-img") || {}).src || ""); }, 6000);
      const card = $a("#te-body .te-ev").find(c=> /Chạy tích hợp vòng 3/.test(c.textContent));
      ok("Thẻ sự kiện mới hiện ảnh bìa từ máy (blob:)", !!card && /^blob:/.test((card.querySelector(".tm-img") || {}).src || ""));
      await shot("events");
      if(typeof fkHandleBack === "function") fkHandleBack(); await sleep(300);
    });

    /* 5g. Gian hàng: thêm giỏ → mã giảm giá (Bảng quản trị) → checkout 3 bước */
    await step("Gian hàng", async ()=>{
      const S = TapShop, UI = S._ui;
      await cloudAdmin.saveVoucher({ code:"VONG3GIAM", kind:"amount", value:20000, min:100000, uses:50, exp:"2099-12-31", title:"Giảm 20.000 ₫ (vòng 3)" });
      goto("home"); await sleep(300);
      click($q('#te-explore [data-xid="shop"]')); await waitFor(()=> $q("#tsx") && !$q("#tsx").hidden && $a(".tsx-tile").length, 6000);
      const store = $q("#tsx");
      ok("Ô Khám phá 'Gian hàng' → TapEasy Store có sản phẩm + giá", !!store && !store.hidden && /\d{1,3}(\.\d{3})+\s*(₫|đ)/.test(store.innerText), store && store.innerText.slice(0, 120));
      await waitFor(()=> S._S.loaded, 5000);
      S.openProduct("p_tee"); await sleep(400);
      click($q('.tsx-sw [data-v="teal"]')); await sleep(150); click($q('.tsx-sz [data-v="L"]')); await sleep(150);
      click($q('[data-sx="add"]')); await sleep(450);
      ok("Thêm vào giỏ → ngăn kéo giỏ hàng, 1 sản phẩm", UI.layer === "cart" && state.tapShop.cart.length === 1 && state.tapShop.cart[0].key === "p_tee|teal|L", JSON.stringify(state.tapShop.cart));
      const pim = $q(".tsx-drawer .tsx-line-im img");
      if(pim) await waitFor(()=> pim.complete, 3000);
      ok("Giỏ: ảnh sản phẩm thật (WebP) hiển thị được", !!pim && pim.naturalWidth > 0, pim ? pim.getAttribute("src").slice(0, 40) : "SVG dự phòng");
      const vin = $q("#tsx-vcode");
      ok("Giỏ có ô nhập mã giảm giá (mã do quản trị tạo)", !!vin);
      if(vin){ vin.value = "vong3giam"; click($q('[data-sx="vcode"]')); await sleep(500); }
      const disc = $q(".tsx-drawer .tsx-sum .minus dd");
      ok("Áp mã VONG3GIAM → giảm 20.000 ₫", !!disc && disc.textContent.replace(/\D/g, "") === "20000", disc && disc.textContent);
      await shot("cart");
      click($q('.tsx-drawer [data-sx="checkout"]')); await sleep(400);
      ok("Checkout bước 1: Giao hàng", UI.view === "checkout" && !!$q("#te-a-prov"));
      $q("#te-a-name").value = "Thử Nghiệm"; $q("#te-a-phone").value = "0912345678"; $q("#te-a-prov").value = "Hà Nội";
      $q("#te-a-ward").value = "Phường Hoàn Kiếm"; $q("#te-a-street").value = "12 Hàng Bông";
      click($q('[data-sx="ship"][data-id="standard"]')); await sleep(100);
      click($q('[data-sx="ck-next"]')); await sleep(300);
      ok("Bước 2: Thanh toán (COD / chuyển khoản / VietQR)", Number(UI.params.step) === 2 && $a('[data-sx="pay"]').length === 3);
      click($q('[data-sx="pay"][data-id="cod"]')); await sleep(100); click($q('[data-sx="ck-next"]')); await sleep(300);
      ok("Bước 3: Xác nhận", Number(UI.params.step) === 3 && !!$q("#tsx-place"));
      click($q("#tsx-place")); await waitFor(()=> UI.view === "done", 6000); await sleep(300);
      const orders = await cloudEvents.myOrders();
      ok("Đặt hàng → màn hoàn tất, đơn có giảm giá 20.000 ₫, giỏ trống", UI.view === "done" && orders.length >= 1 && orders[0].discount === 20000 && !state.tapShop.cart.length, JSON.stringify(orders[0] && { d: orders[0].discount, t: orders[0].total }));
      await shot("shop-done");
      try{ if(S.close) S.close(); }catch(e){} await sleep(300);
      if(store && !store.hidden && typeof fkHandleBack === "function"){ fkHandleBack(); await sleep(200); }
      if(!document.getElementById("screen-home").classList.contains("active")) goto("home");
      ok("Thoát cửa hàng về app", !$q("#tsx") || $q("#tsx").hidden);
    });
    if(STOP === "shop") return;

    /* 6. Buổi tập */
    await step("Buổi tập", async ()=>{
      goto("workout"); await sleep(400);
      const dk = DAY_KEYS.find(k=> (getActivePlan().days[k].items||[]).length);
      if(dk){ state.selectedDay = dk; startSession(dk); await sleep(600);
        ok("Bắt đầu buổi tập (training-pro + health-safety bọc startSession)", typeof session !== "undefined" && !!session);
        try{ closeSheet(); }catch(e){} await sleep(300);
      }
    });

    /* 7. Theme sáng */
    await step("Theme", async ()=>{
      fkTheme.set("light"); goto("home"); await sleep(400);
      ok("Theme Sáng: html.fk-light", document.documentElement.classList.contains("fk-light"));
      const lightLogo = document.querySelector("#screen-home .topbar img.on-light");
      ok("Theme Sáng: topbar dùng logo-wordmark-dark (hoặc chữ dự phòng)", (lightLogo && getComputedStyle(lightLogo).display !== "none") || !!document.querySelector("#screen-home .topbar .brand-text"));
      if(STOP === "light") return;
      fkTheme.set("navy"); await sleep(200);
    });
    if(STOP === "light") return;

    goto("home"); await sleep(300);
    ok("Không còn chữ 'FIT KIT' trên màn hình", !/FIT ?KIT/i.test(document.body.innerText));
    ok("Không lỗi JS trong toàn bộ luồng", errs().length === 0, errs().slice(0, 5).join(" | ").slice(0, 400));
  }

  window.addEventListener("load", ()=>{ run().then(panel, e=>{ ok("runner", false, e.message); panel(); }); });
})();
