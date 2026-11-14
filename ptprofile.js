/* =========================================================================
   TapEasy — Trang hồ sơ PT (phong cách "hero" thể thao: chữ lớn, số đếm tăng,
   ảnh tràn màn hình có lớp kính mờ, thẻ kính).  3 phần cuộn theo trang:
   1. Ảnh PT + khu vực + tên hiện ra kiểu "tốc độ"
   2. Thành tích: số học viên / buổi đã dạy / năm kinh nghiệm (đếm tăng)
   3. Thương hiệu + chuyên môn + thẻ liên hệ / buổi tới
   Nạp SAU coach.js, TRƯỚC pt.js.
   ========================================================================= */

let ppCtx = { ptId:null, cid:null, profile:null };

/* Bật cuộn theo trang chỉ khi đang ở màn hồ sơ PT */
const _gotoBeforePP = goto;
goto = function(screen){
  const sc = $("#app-scroll");
  sc.classList.toggle("snap", screen==="ptprofile");
  _gotoBeforePP(screen);
};

function ppSplitLines(text, maxFirst){
  const words = String(text||"").trim().split(/\s+/).filter(Boolean);
  if(words.length<=1) return [words[0]||"", ""];
  const cut = Math.max(1, Math.min(words.length-1, maxFirst || Math.ceil(words.length/2)));
  return [words.slice(0,cut).join(" "), words.slice(cut).join(" ")];
}

async function openPTProfile(ptId, cid){
  ppCtx = { ptId, cid: cid || null, profile:null, reopen: ()=> openPTProfile(ptId, cid) };
  goto("ptprofile");
  $("#pp-content").innerHTML = `<div class="pp-loading"><div class="spinner"></div></div>`;
  try{
    // App Store 1.2: hồ sơ người mình đã chặn được ẩn (chỉ hiện khối "Bạn đã chặn…" + Bỏ chặn)
    if(typeof FKBlock !== "undefined" && cloud.user && ptId !== cloud.user.uid){
      await FKBlock.ready();
      if(FKBlock.is(ptId)){ const c = cid && typeof ptData !== "undefined" ? ptData.asStudent.find(x=> x.id === cid) : null; ppBlockedView(ptId, (c && c.ptName) || "PT"); return; }
    }
    const raw = await cloud.getUser(ptId);
    if(!raw) throw new Error("Không tìm thấy hồ sơ PT.");
    // QP-10 / QS-17 (fix-pt): KHÔNG dùng SĐT trong hồ sơ công khai users/{uid} — chỉ SĐT PT chủ động chia sẻ vào form của học viên đang kết nối
    const pr = Object.assign({}, raw, { phone: ppPhoneFor(ptId, cid) });
    ppCtx.profile = pr;
    renderPTProfile(pr);
  }catch(e){
    $("#pp-content").innerHTML = `<div class="pp-loading"><p class="small-note">${escapeHtml(e.message)}</p><button class="btn btn-outline" onclick="goto('coach')">Quay lại</button></div>`;
  }
}

/* App Store 1.2 (vòng 2 fix-pt): khối thay hồ sơ của người đã chặn — dùng chung cho hồ sơ PT thật & niêm yết Tìm PT (findpt.js) */
function ppBlockedView(uid, name, onBack, onUnblocked){
  const el = $("#pp-content"); if(!el) return;
  const ctx = ppCtx || {};
  onBack = onBack || ctx.back || (()=> ctx.cid ? openClientForm(ctx.cid, "student", "info") : goto("coach"));
  onUnblocked = onUnblocked || ctx.reopen;
  const blkHTML = typeof FKBlock !== "undefined" ? FKBlock.blockedHTML(uid, name, "Hồ sơ, tin nhắn và yêu cầu của người này được ẩn với bạn.") : "";   // tự escape (coach.js)
  el.innerHTML = `<div class="pp-loading pp-blocked">${blkHTML}
    <button type="button" class="btn btn-ghost btn-sm" id="pp-blk-back"><span class="material-symbols-rounded">arrow_back</span>Quay lại</button></div>`;
  const b = $("#pp-blk-back"); if(b) b.addEventListener("click", ()=> typeof onBack === "function" ? onBack() : goto("coach"));
  /* R3-CLOUD-10: mỗi lần vẽ khối "đã chặn" trước đây gắn THÊM 1 trình nghe fk:blocks-changed (chỉ tự gỡ khi sự kiện bắn) → xem N hồ sơ đã chặn
     = N trình nghe treo, lúc bỏ chặn gọi onUnblocked N lần. Giờ luôn gỡ trình nghe của lần vẽ trước. */
  try{ if(ppBlockedView._h) document.removeEventListener("fk:blocks-changed", ppBlockedView._h); }catch(e){}
  const h = ()=>{ document.removeEventListener("fk:blocks-changed", h); if(ppBlockedView._h === h) ppBlockedView._h = null; try{ const a = $(".screen.active"); if(a && a.id === "screen-ptprofile" && typeof FKBlock !== "undefined" && !FKBlock.is(uid) && typeof onUnblocked === "function") onUnblocked(); }catch(e){} };
  try{ document.addEventListener("fk:blocks-changed", h); ppBlockedView._h = h; }catch(e){}
}

/* Chặn ngay trên hồ sơ đang mở → thay bằng khối "Bạn đã chặn…" */
try{ document.addEventListener("fk:blocks-changed", ()=>{
  try{
    const a = $(".screen.active"); if(!a || a.id !== "screen-ptprofile") return;
    const id = ppCtx && ppCtx.ptId; if(!id || typeof FKBlock === "undefined" || !FKBlock.is(id) || document.querySelector("#pp-content .pp-blocked")) return;
    ppBlockedView(id, (ppCtx.profile && (ppCtx.profile.brandName || ppCtx.profile.name)) || "PT");
  }catch(e){}
}); }catch(e){}

/* SĐT hiển thị trên hồ sơ PT thật: của chính mình (lưu riêng trên máy) hoặc clients.ptPhone của form mình đang kết nối */
function ppPhoneFor(ptId, cid){
  try{
    if(cloud.user && cloud.user.uid === ptId){ const S = cloud.social || {}; return typeof S.myPhone === "function" ? String(S.myPhone() || "") : ""; }
    const list = (typeof ptData !== "undefined" && ptData && ptData.asStudent) || [];
    const c = list.find(x=> x && x.ptId === ptId && (!cid || x.id === cid) && cloud.user && x.studentUid === cloud.user.uid);
    return c && c.ptPhone ? String(c.ptPhone).slice(0, 20) : "";
  }catch(e){ return ""; }
}
/* QP-08 (fix-pt): nhãn nguồn số liệu công khai — chỉ "TapEasy xác nhận" khi máy chủ ghi (stats.verified); còn lại ghi rõ "PT tự khai" */
function ppStatsSrc(st){
  st = st || {};
  if(st.seed) return "Số liệu minh hoạ";
  if(st.verified) return "TapEasy xác nhận từ buổi PT đã dạy";
  if(st.src === "app") return "Đếm từ form có học viên thật · PT tự đồng bộ";
  return "PT tự khai — chưa đối chiếu";
}
function renderPTProfile(pr){
  const el = $("#pp-content");
  const h = $("#app-scroll").clientHeight;
  $("#screen-ptprofile").style.setProperty("--pp-h", h + "px");

  const name = pr.name || "PT";
  const [n1, n2] = ppSplitLines(name, name.trim().split(/\s+/).length>2 ? name.trim().split(/\s+/).length-1 : 1);
  const areaParts = String(pr.area||"").split(",").map(s=>s.trim()).filter(Boolean);
  const [a1, a2] = areaParts.length>=2 ? [areaParts[0], areaParts.slice(1).join(", ")] : ppSplitLines(pr.area || "Huấn luyện viên cá nhân");
  const brand = pr.brandName || name;
  const specs = String(pr.specialty||"").split(/[,;·]/).map(s=>s.trim()).filter(Boolean);
  const mainSpec = specs[0] || "Huấn luyện cá nhân";
  const st = pr.stats || {};
  const isMe = cloud.user && cloud.user.uid===pr.uid;
  const ini = name.trim().split(/\s+/).map(w=>w[0]).slice(-2).join("").toUpperCase();
  const nx = ppCtx.cid ? nextSessionOf(ppCtx.cid) : null;

  el.innerHTML = `
    <div class="pp-bg"></div>

    <div class="pp-nav">
      <button class="pp-btn pp-light" id="pp-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button>
      <div class="pp-logo">Tap<b>Easy</b></div>
      <button class="pp-btn pp-glass" id="pp-share" aria-label="Chia sẻ"><i></i><i></i></button>
    </div>

    <!-- 1. HERO -->
    <section class="pp-sec pp-hero">
      <div class="pp-loc anim up d3">
        <div class="pp-label">${pr.area ? "Khu vực" : "Chuyên môn"} <span class="material-symbols-rounded">location_on</span></div>
        <div class="pp-title">${escapeHtml(a1)}${a2?`<br>${escapeHtml(a2)}`:""}</div>
      </div>
      <div class="pp-photo">
        ${pr.photo
          ? `<img src="${attrUrl(pr.photo, {noBlob:true})}" class="anim scale d5" alt="">`
          : `<div class="pp-mono anim scale d5"><span>${escapeHtml(ini)}</span></div>`}
        <div class="pp-photo-blur"></div>
      </div>
      <div class="pp-hero-bottom">
        ${specs.length ? `<div class="pp-chips anim up d7">${specs.slice(0,3).map(s=>`<span>${escapeHtml(s)}</span>`).join("")}</div>` : ""}
        <div class="pp-name anim speed d8">${escapeHtml(n1)}${n2?`<br>${escapeHtml(n2)}`:""}</div>
      </div>
      <div class="pp-scroll-hint anim fade d12"><span class="material-symbols-rounded">chevron_right</span></div>
    </section>

    <!-- 2. THÀNH TÍCH -->
    <section class="pp-sec pp-stats">
      <div class="pp-loc anim up d4">
        <div class="pp-label">Đang huấn luyện tại <span class="material-symbols-rounded">location_on</span></div>
        <div class="pp-title sm">${escapeHtml(brand)}</div>
      </div>
      <div class="pp-ring anim scale d6">
        <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="86"/><circle cx="100" cy="100" r="62"/><circle cx="100" cy="100" r="38"/><path d="M100 14 A86 86 0 0 1 186 100"/></svg>
        <span class="material-symbols-rounded">fitness_center</span>
      </div>
      <div class="pp-numbers anim up d8">
        <div class="pp-label">Thành tích huấn luyện <span class="material-symbols-rounded">military_tech</span></div>
        <div class="pp-num-row"><span class="pp-num grad" data-count="${Math.max(0, Number(st.students)||0)}" data-delay="800">0</span><small>học viên</small></div>
        <div class="pp-num-row"><span class="pp-num grad" data-count="${Math.max(0, Number(st.sessions)||0)}" data-delay="1000">0</span><small>buổi đã dạy</small></div>
        <div class="pp-num-row"><span class="pp-num gold" data-count="${Math.max(0, Number(pr.years)||0)}" data-delay="1200">0</span><small>năm kinh nghiệm</small></div>
        <small class="fp-src pp-src">${escapeHtml(ppStatsSrc(st))}</small>
      </div>
    </section>

    <!-- 3. THƯƠNG HIỆU -->
    <section class="pp-sec pp-brand">
      <div class="pp-brand-top anim up d3">
        <div class="pp-label">Thương hiệu <span class="material-symbols-rounded">storefront</span></div>
        <div class="pp-title">${escapeHtml(ppSplitLines(brand)[0])}${ppSplitLines(brand)[1]?`<br>${escapeHtml(ppSplitLines(brand)[1])}`:""}</div>
      </div>
      <div class="pp-spec anim up d5">
        <div class="pp-label"><span class="material-symbols-rounded">bolt</span> Chuyên môn chính</div>
        <div class="pp-spec-big">${escapeHtml(mainSpec)}</div>
        ${pr.bio ? `<p class="pp-bio">${escapeHtml(pr.bio)}</p>` : ""}
      </div>
      <div class="pp-cards anim up d9">
        <div class="pp-card" id="pp-card-contact">
          <div class="pp-label">Liên hệ <span class="material-symbols-rounded">call</span></div>
          <div class="pp-card-sub">${pr.phone ? escapeHtml(pr.phone) : "Chưa cập nhật"}</div>
          <div class="pp-card-big">${pr.phone ? "Gọi" : "—"}</div>
        </div>
        <div class="pp-card" id="pp-card-next">
          <div class="pp-label">${nx ? "Buổi tới" : "Học viên"} <span class="material-symbols-rounded">${nx ? "event" : "groups"}</span></div>
          <div class="pp-card-sub">${nx ? `${escapeHtml(relDay(nx.date))} · ${escapeHtml(nx.title||"Buổi tập")}` : "đang theo tập"}</div>
          <div class="pp-card-big ${nx?"gold":""}">${nx ? escapeHtml(nx.time||"--") : Math.max(0, Number(st.students)||0)}</div>
        </div>
      </div>
      <div class="pp-cta anim up d10">
        ${ppCtx.cid ? `<button class="btn btn-primary btn-block" id="pp-open-form"><span class="material-symbols-rounded">play_arrow</span>Vào form tập với PT</button>` : ""}
        ${isMe ? `<button class="btn btn-outline btn-block" id="pp-edit"><span class="material-symbols-rounded">edit</span>Sửa hồ sơ PT</button>` : ""}
        ${!isMe && pr.uid && cloud.isLoggedIn() && typeof FKBlock !== "undefined" ? FKBlock.btnHTML(pr.uid, brand, "Hồ sơ PT", "btn btn-ghost btn-sm btn-block pp-blockbtn") : ""}
      </div>
    </section>
  `;

  $("#pp-back").addEventListener("click", ()=> ppCtx.cid && !isMe ? openClientForm(ppCtx.cid, "student", "info") : goto("coach"));
  $("#pp-share").addEventListener("click", ()=> shareText(`${brand} trên TapEasy PT`, `${name} — ${mainSpec}${pr.area?` · ${pr.area}`:""}${pr.phone?` · ${pr.phone}`:""}. Tập cùng mình trên app TapEasy nhé!`));
  const fm = $("#pp-open-form"); if(fm) fm.addEventListener("click", ()=> openClientForm(ppCtx.cid, "student", "today"));
  const ed = $("#pp-edit"); if(ed) ed.addEventListener("click", ()=> openBrandSheet(()=> openPTProfile(pr.uid)));
  if(pr.phone) $("#pp-card-contact").addEventListener("click", ()=>{ const tel = String(pr.phone).replace(/[^\d+]/g,""); if(tel) window.location.href = "tel:"+tel; });
  if(nx) $("#pp-card-next").addEventListener("click", ()=> openClientForm(ppCtx.cid, "student", "today"));

  // Hiệu ứng: chạy khi từng phần cuộn vào màn hình
  setTimeout(ppReveal, 30);
}

/* QP-23 (fix-pt): IntersectionObserver thay cho bộ nghe "scroll" (trước: đọc offsetTop mỗi khung → 19 fps ở CPU 4×).
   Thêm 1 "cọc mốc" ở đầu trang để bật nền kính cho thanh trên khi đã cuộn (QP-19: logo / nút back không đè chữ). */
let ppIO = null, ppNavIO = null;
function ppShow(sec){
  if(sec.classList.contains("in")) return;
  sec.classList.add("in");
  sec.querySelectorAll("[data-count]").forEach(ppCountUp);
  // An toàn: nếu máy tắt/hoãn hiệu ứng, vẫn hiện đủ nội dung sau 2,5 giây
  setTimeout(()=> sec.classList.add("done"), 2500);
}
function ppReveal(){
  if(!$("#screen-ptprofile").classList.contains("active")) return;
  const sc = $("#app-scroll"), secs = $$("#pp-content .pp-sec");
  try{ if(ppIO) ppIO.disconnect(); if(ppNavIO) ppNavIO.disconnect(); }catch(e){}
  ppIO = ppNavIO = null;
  if(typeof IntersectionObserver !== "function"){ secs.forEach(ppShow); return; }
  ppIO = new IntersectionObserver(ents=> ents.forEach(en=>{ if(en.isIntersecting){ ppShow(en.target); ppIO && ppIO.unobserve(en.target); } }),
    { root: sc, rootMargin:"-20% 0px -20% 0px", threshold:0 });
  secs.forEach(s=> ppIO.observe(s));
  if(secs[0]) ppShow(secs[0]);
  const nav = $("#pp-content .pp-nav"), hero = $("#pp-content .pp-hero");
  if(nav && hero){
    let mark = $("#pp-content .pp-top-mark");
    if(!mark){ mark = document.createElement("div"); mark.className = "pp-top-mark"; mark.setAttribute("aria-hidden", "true"); mark.style.cssText = "position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;"; hero.style.position = hero.style.position || "relative"; hero.prepend(mark); }
    ppNavIO = new IntersectionObserver(ents=> ents.forEach(en=> nav.classList.toggle("fp-scrolled", !en.isIntersecting)), { root: sc, threshold:0 });
    ppNavIO.observe(mark);
  }
}

/* Đếm tăng dần: ease-out bậc 3, 2.2 giây, bắt đầu sau độ trễ */
function ppCountUp(node){
  const target = Number(node.dataset.count)||0, delay = Number(node.dataset.delay)||0, dur = 2200;
  if(node._counted) return; node._counted = true;
  setTimeout(()=>{
    const t0 = performance.now();
    const step = now=>{
      const t = Math.min(1, (now-t0)/dur), v = 1-Math.pow(1-t,3);
      node.textContent = Math.round(target*v).toLocaleString("vi-VN");
      if(t<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(()=>{ node.textContent = target.toLocaleString("vi-VN"); }, dur + 300);
  }, delay);
}

/* Ảnh hồ sơ PT: thu nhỏ còn tối đa 720px, JPEG ~80% để lưu gọn trên máy chủ */
function ppPickPhoto(onDone){
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = ()=>{
    const f = input.files && input.files[0]; if(!f) return;
    const img = new Image();
    img.onload = ()=>{
      const max = 720, k = Math.min(1, max/Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      onDone(c.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = ()=> toast("Không đọc được ảnh này", "error");
    img.src = URL.createObjectURL(f);
  };
  input.click();
}

/* PT đồng bộ số liệu công khai (số học viên, buổi đã dạy) lên hồ sơ.
   QP-08 (fix-pt): chỉ đếm form có HỌC VIÊN THẬT (đang/đã kết nối) + ≥ 1 buổi PT xác nhận; buổi = buổi đã tập của các form đó
   (không còn đếm form trống "khách ảo"). Vẫn là số do máy PT ghi → hiển thị kèm nhãn "PT tự đồng bộ" cho tới khi Function ghi stats.verified. */
function ppRealStats(){
  const forms = (ptData && ptData.asPT) || [], sess = (ptData && ptData.sessions) || {};
  const P = cloud.ptdir && cloud.ptdir.logic;
  if(P && typeof P.statsFrom === "function") return P.statsFrom(forms, sess);
  let students = 0, sessions = 0;
  forms.forEach(c=>{ const ss = sess[c.id] || []; const conf = ss.filter(s=> s && s.status === "done" && (s.completedBy !== "student" || s.ptConfirmedAt || s.proxyLog));
    if(!(c.studentUid || c.linkedOnce) || !conf.length) return; students++; sessions += ss.filter(s=> s && s.status === "done").length; });
  return { students, sessions, src:"app", verified:false };
}
async function ppSyncMyStats(){
  if(!cloud.isLoggedIn() || !(cloud.profile && cloud.profile.isPT)) return;
  const r = ppRealStats(), students = Number(r.students)||0, sessions = Number(r.sessions)||0;
  const cur = cloud.profile.stats || {};
  if(cur.students===students && cur.sessions===sessions && cur.src === "app") return;
  try{ await cloud.updateMyProfile({ stats:{ students, sessions, src:"app", verified:false, updatedAt: Date.now() } }); }catch(e){}
}
