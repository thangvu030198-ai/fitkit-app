/* =========================================================================
   TapEasy v2 — Khởi động app, Đăng nhập / Vai trò, Trang chủ, Tài khoản,
   Thông báo native (Capacitor). Nạp SAU app.js và coach.js.
   ========================================================================= */

const APP_VERSION = "2.0.0";
const WD_SHORT = ["CN","T2","T3","T4","T5","T6","T7"];

/* Bổ sung trường state mới cho bản v2 (không phá dữ liệu cũ) */
state.authDone = state.authDone || false;
state.coachSeen = state.coachSeen || {};          // { clientId: timestamp đã xem ghi chú }
state.coachPrefs = Object.assign({ remind:true }, state.coachPrefs || {});
state.coachUpcoming = state.coachUpcoming || [];  // cache buổi PT sắp tới để nhắc khi offline

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH NGÀY GIỜ
   --------------------------------------------------------------------- */
function parseDay(d){ const [y,m,dd]=String(d).split("-").map(Number); return new Date(y,(m||1)-1,dd||1); }
function fmtDay(d){ const x=parseDay(d); return `${WD_SHORT[x.getDay()]}, ${pad2(x.getDate())}/${pad2(x.getMonth()+1)}`; }
function relDay(d){
  const diff = Math.round((parseDay(d) - parseDay(todayStr()))/86400000);
  if(diff===0) return "Hôm nay"; if(diff===1) return "Ngày mai"; if(diff===-1) return "Hôm qua";
  return fmtDay(d);
}
function sessStart(s){ const x=parseDay(s.date); const [h,m]=(s.time||"00:00").split(":").map(Number); x.setHours(h||0,m||0,0,0); return x; }
function addDays(d, n){ const x=parseDay(d); x.setDate(x.getDate()+n); return todayStr(x); }
function hhmm(dt){ return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`; }
function isNative(){ try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }catch(e){ return false; } }

/* ---------------------------------------------------------------------
   1. THÔNG BÁO NATIVE (Capacitor Local Notifications)
      Trên điện thoại (app cài từ store) lịch nhắc được giao cho hệ điều hành
      → vẫn nhắc đúng giờ kể cả khi app đã đóng.
      Trên web: dùng vòng lặp kiểm tra trong app (app.js + bên dưới).
   --------------------------------------------------------------------- */
const nativeNotif = {
  plugin(){ return isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; },
  available(){ return !!this.plugin(); },
  async requestPermission(){
    const p = this.plugin(); if(!p) return false;
    try{ const r = await p.requestPermissions(); return r.display==="granted"; }catch(e){ return false; }
  },
  _timer: null,
  syncSoon(){ clearTimeout(this._timer); this._timer = setTimeout(()=> this.sync(), 800); },
  async sync(){
    const p = this.plugin(); if(!p) return;
    try{
      const perm = await p.checkPermissions();
      if(perm.display!=="granted") return;
      const pending = await p.getPending();
      if(pending.notifications.length) await p.cancel({ notifications: pending.notifications.map(n=>({ id:n.id })) });
      const list = [];
      const r = state.reminders;
      const WEEKDAY = { CN:1, T2:2, T3:3, T4:4, T5:5, T6:6, T7:7 };
      if(r.master){
        DAY_KEYS.forEach((k,i)=>{
          const w = r.workout[k]; const day = getActivePlan() && getActivePlan().days[k];
          if(w && w.enabled && day && day.items.length){
            const [h,m] = w.time.split(":").map(Number);
            list.push({ id: 1000+i, title:"Đến giờ tập luyện!", body:`Hôm nay: ${day.title}`, schedule:{ on:{ weekday: WEEKDAY[k], hour:h, minute:m }, allowWhileIdle:true } });
          }
        });
        MEAL_TYPES.forEach((mt,i)=>{
          const x = r.meal[mt.id];
          if(x && x.enabled){ const [h,m]=x.time.split(":").map(Number);
            list.push({ id: 1100+i, title:"Đến giờ ăn!", body:`Đừng quên ${mt.label.toLowerCase()} và ghi vào nhật ký nhé.`, schedule:{ on:{ hour:h, minute:m }, allowWhileIdle:true } }); }
        });
        if(r.bedtimeEnabled){ const [h,m]=(r.bedtimeTime||"22:30").split(":").map(Number);
          list.push({ id:1200, title:"Đến giờ ngủ!", body:"Tắt thiết bị điện tử và chuẩn bị cho giấc ngủ chất lượng.", schedule:{ on:{ hour:h, minute:m }, allowWhileIdle:true } }); }
      }
      if(state.coachPrefs.remind){
        state.coachUpcoming.slice(0,60).forEach((u,i)=>{
          const at = new Date(sessStart(u).getTime() - (u.before||60)*60000);
          if(at > new Date()) list.push({ id: 2000+i, title:"Sắp đến buổi tập với PT", body:`${u.time} ${relDay(u.date)} · ${u.who}${u.title?" — "+u.title:""}`, schedule:{ at, allowWhileIdle:true } });
        });
      }
      if(list.length) await p.schedule({ notifications: list });
    }catch(e){ console.warn("Không lên lịch thông báo được:", e); }
  },
};

/* Mỗi lần lưu state → lên lịch lại thông báo native (có debounce) */
const _saveStateV1 = saveState;
saveState = function(){ const ok = _saveStateV1(); try{ nativeNotif.syncSoon(); }catch(e){} return ok; };   // QC-11: giữ giá trị trả về (false = chưa lưu được)

/* Nhắc buổi PT khi app đang mở (web + native) */
function checkCoachReminders(){
  if(!state.coachPrefs.remind) return;
  const nowMin = hhmm(new Date()), today = todayStr();
  state.coachUpcoming.forEach(u=>{
    const at = new Date(sessStart(u).getTime() - (u.before||60)*60000);
    if(todayStr(at)!==today || hhmm(at)!==nowMin) return;
    const key = `coach_${u.sid}_${today}_${nowMin}`;
    if(state._firedKeys[key]) return;
    state._firedKeys[key] = true;
    const body = `${u.time} ${relDay(u.date)} · ${u.who}${u.title?" — "+u.title:""}`;
    if(!isNative() && "Notification" in window && Notification.permission==="granted"){ try{ new Notification("Sắp đến buổi tập với PT", { body }); }catch(e){} }
    toast(body, "notifications_active");
    _saveStateV1();
  });
}
setInterval(checkCoachReminders, 15000);

/* ---------------------------------------------------------------------
   2. ĐĂNG NHẬP / ĐĂNG KÝ / CHỌN VAI TRÒ (lớp phủ #auth)
   --------------------------------------------------------------------- */
function showAuth(view){
  $("#auth").classList.add("open");
  $("#auth").onscroll = null; $("#auth").scrollTop = 0;
  $("#auth").classList.toggle("wl-mode", view==="welcome");
  const body = $("#auth-body");
  const demoNote = cloud.mode==="demo"
    ? `<p class="small-note auth-demo"><span class="material-symbols-rounded" style="font-size:14px;">science</span> Bản thử nghiệm: tài khoản chỉ lưu trên máy này.</p>` : "";
  const back = `<div class="auth-top"><button class="icon-btn" data-auth="welcome" style="margin-bottom:6px;" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button><img class="auth-logo" src="assets/brand/logo-wordmark-light.svg" alt="TapEasy" data-no-fallback onerror="this.onerror=null;this.outerHTML='<span class=&quot;brand-text&quot;>Tap<b>Easy</b></span>'"></div>`;

  if(view==="welcome"){
    const routes = [
      "M24 34 C60 0,104 58,140 22",
      "M140 22 C188 -6,236 78,268 52",
      "M268 52 C304 104,236 96,204 132",
      "M204 132 C152 168,98 92,58 124",
    ];
    const stops = [[24,34,"Giáo án"],[140,22,"Lịch tập"],[268,52,"Dinh dưỡng"],[204,132,"Giấc ngủ"],[58,124,"Tiến độ"]];
    body.innerHTML = `
    <div class="wl" id="wl">
      <!-- 1. HERO -->
      <section class="wl-hero">
        <div class="wl-hero-bg" style="background-image:url('${attrUrl(welcomePoster())}')"></div>
        <div class="wl-hero-shade"></div>
        <div class="wl-speed"><i></i><i></i><i></i><i></i><i></i></div>
        <nav class="wl-nav">
          <div class="wl-brand wl-in-left"><img class="wl-brand-img" src="assets/brand/logo-wordmark-light.svg" alt="TapEasy" data-no-fallback onerror="this.onerror=null;this.outerHTML='<span class=&quot;brand-text wl-brand-text&quot;>Tap<b>Easy</b></span>'"></div>
          <button class="wl-burger wl-in-right" id="wl-menu-btn" aria-label="Menu"><i></i><i></i><i></i></button>
        </nav>
        <div class="wl-hero-body">
          <h1 class="wl-head">
            <span class="l1">Tập đúng</span>
            <span class="l2">Tiến bộ</span>
            <span class="l3">Thật sự</span>
          </h1>
          <p class="wl-sub">Giáo án cá nhân, dinh dưỡng, giấc ngủ và kết nối PT ↔ học viên — trong một app.</p>
          <button class="wl-cta" id="wl-start" aria-label="Bắt đầu ngay — dùng thử không cần tài khoản">
            <svg viewBox="0 0 264 64" aria-hidden="true">
              <rect x="0" y="0" width="264" height="64" rx="32" fill="#FF7A45"/>
              <circle cx="232" cy="32" r="26" fill="#061A24"/>
              <g class="wl-arrow" transform-origin="232 32"><path d="M220 32 H244 M236 24 L244 32 L236 40" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
            </svg>
            <span>Bắt đầu ngay</span>
          </button>
          <p class="wl-sub wl-cta-note" style="margin-top:8px;">Miễn phí · không cần tài khoản</p>
          <button class="wl-link" data-auth="login">Đã có tài khoản? <b>Đăng nhập</b></button>
          <button class="wl-link" data-auth="signup">PT hoặc cần kết nối PT? <b>Tạo tài khoản</b></button>
        </div>
        <div class="wl-scroll-cue"><span></span></div>
      </section>

      <!-- 2. GIỚI THIỆU -->
      <section class="wl-info">
        <div class="wl-rev wl-from-left">
          <div class="wl-tag"><img class="wl-tag-mark" src="assets/brand/logo-mark.svg" alt="" aria-hidden="true" data-no-fallback onerror="this.onerror=null;this.remove()">TapEasy</div>
          <div class="wl-tag-sub">luyện tập có khoa học<br>đồng hành cùng PT</div>
        </div>
        <div class="wl-map wl-rev">
          <svg viewBox="0 0 300 160" class="wl-routes" aria-hidden="true">
            ${routes.map((d,i)=>`<path id="wlr${i}" d="${d}" pathLength="1" class="wl-route" style="--i:${i}"/>`).join("")}
            ${stops.map(([x,y,t],i)=>`<g class="wl-stop" style="--i:${i}"><text x="${x}" y="${y+ (y>100?24:-17)}" text-anchor="middle">${t}</text></g>`).join("")}
          </svg>
          ${stops.map(([x,y,t],i)=>`<div class="wl-node" style="left:${(x/300*100).toFixed(2)}%;top:${((y+5)/170*100).toFixed(2)}%;--i:${i}" aria-hidden="true"><span class="material-symbols-rounded">${["menu_book","calendar_month","restaurant","bedtime","trending_up"][i]}</span></div>`).join("")}
        </div>
        <div class="wl-stats">
          <div class="wl-stat wl-rev wl-from-left"><b>800+</b><span>bài tập có<br>hình minh hoạ<br>và hướng dẫn</span></div>
          <div class="wl-stat wl-rev wl-from-right" style="margin-left:clamp(40px,12vw,90px)"><b>7</b><span>mục quản lý<br>PT ↔ học viên<br>trong một form</span></div>
        </div>
      </section>

      <!-- 3. BẮT ĐẦU -->
      <section class="wl-start" id="wl-end">
        <div class="wl-rev wl-from-bottom">
          <div class="wl-tag" style="color:#fff">BẮT ĐẦU <span style="color:#5EE6C7">NGAY</span></div>
          <p class="wl-muted">Miễn phí. Tập cá nhân không cần tài khoản — tài khoản dùng để kết nối với PT hoặc quản lý học viên.</p>
        </div>
        <div class="wl-actions">
          <button class="wl-pill gold wl-rev wl-from-bottom" style="--d:.05s" id="auth-guest">Dùng ngay, không cần tài khoản</button>
          <button class="wl-pill ghost wl-rev wl-from-bottom" style="--d:.12s" data-auth="signup">Tạo tài khoản</button>
          <button class="wl-pill ghost wl-rev wl-from-bottom" style="--d:.19s" data-auth="login">Đăng nhập</button>
        </div>
        ${demoNote}
        <div class="wl-foot">
          <div>
            <a class="wl-foot-link" id="wl-privacy">Chính sách bảo mật</a>
            <a class="wl-foot-link" id="wl-credits">Nguồn dữ liệu &amp; bản quyền</a>
          </div>
          <button class="wl-round" id="wl-top" aria-label="Lên đầu trang"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="#061A24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <p class="wl-copy">© 2026 TapEasy. All rights reserved.</p>
      </section>

      <div class="wl-menu" id="wl-menu">
        <button class="wl-menu-close" id="wl-menu-close" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button>
        <button id="wl-menu-guest" style="--i:0">Dùng ngay</button>
        <button data-auth="signup" style="--i:1">Tạo tài khoản</button>
        <button data-auth="login" style="--i:2">Đăng nhập</button>
        <button id="wl-menu-privacy" style="--i:3">Chính sách bảo mật</button>
      </div>
    </div>`;
    const guest = ()=>{ state.authDone = true; saveState(); finishBoot(); };
    $("#auth-guest").addEventListener("click", guest);
    $("#wl-menu-guest").addEventListener("click", guest);
    // QU-13: CTA lớn = dùng thử ngay (vào onboarding, không cần tài khoản); đăng ký là lựa chọn phụ (link bên dưới / cuối trang)
    $("#wl-start").addEventListener("click", guest);
    $("#wl-menu-btn").addEventListener("click", ()=>{ $("#auth").scrollTop = 0; $("#wl-menu").classList.add("open"); });
    $("#wl-menu-close").addEventListener("click", ()=> $("#wl-menu").classList.remove("open"));
    $("#wl-menu-privacy").addEventListener("click", ()=>{ $("#wl-menu").classList.remove("open"); openPrivacySheet(); });
    $("#wl-privacy").addEventListener("click", openPrivacySheet);
    $("#wl-credits").addEventListener("click", openCreditsSheet);
    $("#wl-top").addEventListener("click", ()=> $("#auth").scrollTo({ top:0, behavior:"smooth" }));
    // Hiệu ứng xuất hiện khi cuộn tới (chạy 1 lần), có hẹn giờ an toàn
    // 12/11 v2: bản đồ vẽ trọn ~1,5 s rồi khoá .done; giảm chuyển động → hiện đủ ngay. Bỏ mũi tên chạy SMIL (.wl-runner):
    // trước giờ begin nó nằm ở góc (0,0) thành "chấm lạ" và bị dừng giữa đường sau 14 s. wlMapFinish() = hiện đủ tức thì (chụp màn hình tự động).
    const reduce = (()=>{ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } })();
    const reveal = ()=>{
      const box = $("#auth"); if(!box) return;
      const h = box.clientHeight;
      $$("#wl .wl-rev:not(.in)").forEach(el=>{
        const r = el.getBoundingClientRect(), top = r.top - box.getBoundingClientRect().top;
        if(top < h - 50){ el.classList.add("in"); if(reduce) el.classList.add("done"); else setTimeout(()=> el.classList.add("done"), el.classList.contains("wl-map") ? 1700 : 2000); }
      });
    };
    window.wlMapFinish = ()=>{ $$("#wl .wl-rev").forEach(el=> el.classList.add("in", "done")); return !!$("#wl .wl-map.done"); };
    $("#auth").onscroll = ()=> requestAnimationFrame(reveal);
    $("#auth").scrollTop = 0;
    setTimeout(reveal, 60);
    setTimeout(()=>{ const w=$("#wl"); if(w) w.classList.add("ready"); }, 30);
    scheduleWelcomeVideo();   // QU-04: không gọi API video lúc mở; chỉ video đã biết, gắn lúc rảnh
  }

  else if(view==="login"){
    body.innerHTML = `<div class="auth-form">${back}
      <h2 class="onboard-hero">Đăng nhập</h2>
      <p class="onboard-sub">Chào mừng bạn quay lại TapEasy.</p>
      <div class="auth-social">
        <button class="btn-social apple" type="button" data-social="apple"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.98c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.75-.96 2.79 1.01.08 2.05-.52 2.68-1.27z"/></svg>Tiếp tục với Apple</button>
        <button class="btn-social google" type="button" data-social="google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Tiếp tục với Google</button>
        <button class="btn-social facebook" type="button" data-social="facebook"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>Tiếp tục với Facebook</button>
        <div class="auth-or"><span>hoặc dùng email</span></div>
      </div>
      <div class="field"><label>Email</label><input type="email" id="au-email" autocomplete="email" placeholder="ban@email.com"></div>
      <div class="field"><label>Mật khẩu</label><input type="password" id="au-pw" autocomplete="current-password" placeholder="••••••"></div>
      <p class="auth-err" id="au-err"></p>
      <button class="btn btn-primary btn-block" id="au-submit">Đăng nhập</button>
      <button class="btn btn-ghost btn-block" data-auth="forgot">Quên mật khẩu?</button>
      <button class="btn btn-ghost btn-block" data-auth="signup">Chưa có tài khoản? Đăng ký</button>
      ${demoNote}</div>`;
    const submit = async ()=>{
      setAuthBusy(true);
      try{ await cloud.signIn($("#au-email").value, $("#au-pw").value); postAuthRoute(); }
      catch(e){ $("#au-err").textContent = e.message; }
      finally{ setAuthBusy(false); }
    };
    $("#au-submit").addEventListener("click", submit);
    $("#au-pw").addEventListener("keydown", e=>{ if(e.key==="Enter") submit(); });
    bindSocialButtons();
  }

  else if(view==="signup"){
    body.innerHTML = `<div class="auth-form">${back}
      <h2 class="onboard-hero">Tạo tài khoản</h2>
      <p class="onboard-sub">Miễn phí. Dùng để kết nối với PT hoặc quản lý học viên.</p>
      <div class="auth-social">
        <button class="btn-social apple" type="button" data-social="apple"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.98c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.75-.96 2.79 1.01.08 2.05-.52 2.68-1.27z"/></svg>Đăng ký với Apple</button>
        <button class="btn-social google" type="button" data-social="google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Đăng ký với Google</button>
        <button class="btn-social facebook" type="button" data-social="facebook"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>Đăng ký với Facebook</button>
        <div class="auth-or"><span>hoặc dùng email</span></div>
      </div>
      <div class="field"><label>Tên hiển thị</label><input type="text" id="au-name" autocomplete="name" placeholder="VD: Thắng"></div>
      <div class="field"><label>Email</label><input type="email" id="au-email" autocomplete="email" placeholder="ban@email.com"></div>
      <div class="field"><label>Mật khẩu (ít nhất 6 ký tự)</label><input type="password" id="au-pw" autocomplete="new-password" placeholder="••••••"></div>
      <label class="auth-check"><input type="checkbox" id="au-agree"> <span>Tôi đồng ý với <a id="au-privacy">Điều khoản &amp; Chính sách bảo mật</a></span></label>
      <p class="auth-err" id="au-err"></p>
      <button class="btn btn-primary btn-block" id="au-submit">Tạo tài khoản</button>
      <button class="btn btn-ghost btn-block" data-auth="login">Đã có tài khoản? Đăng nhập</button>
      ${demoNote}</div>`;
    $("#au-privacy").addEventListener("click", (e)=>{ e.preventDefault(); openPrivacySheet(); });
    bindSocialButtons(true);
    $("#au-submit").addEventListener("click", async ()=>{
      const name = $("#au-name").value.trim();
      if(!name){ $("#au-err").textContent = "Vui lòng nhập tên hiển thị."; return; }
      if(!$("#au-agree").checked){ $("#au-err").textContent = "Bạn cần đồng ý với Điều khoản & Chính sách bảo mật."; return; }
      setAuthBusy(true);
      try{
        await cloud.signUp($("#au-email").value, $("#au-pw").value, name);
        if(!state.profile.name){ state.profile.name = name; }
        postAuthRoute();
      }catch(e){ $("#au-err").textContent = e.message; }
      finally{ setAuthBusy(false); }
    });
  }

  else if(view==="forgot"){
    body.innerHTML = `<div class="auth-form"><button class="icon-btn" data-auth="login" style="margin-bottom:6px;"><span class="material-symbols-rounded">arrow_back</span></button>
      <h2 class="onboard-hero">Quên mật khẩu</h2>
      <p class="onboard-sub">Nhập email đã đăng ký, TapEasy sẽ gửi link đặt lại mật khẩu.</p>
      <div class="field"><label>Email</label><input type="email" id="au-email" placeholder="ban@email.com"></div>
      <p class="auth-err" id="au-err"></p>
      <button class="btn btn-primary btn-block" id="au-submit">Gửi link đặt lại</button>
      ${cloud.mode==="demo" ? `<p class="small-note">Bản thử nghiệm không gửi email thật.</p>` : ""}</div>`;
    $("#au-submit").addEventListener("click", async ()=>{
      setAuthBusy(true);
      try{ await cloud.resetPassword($("#au-email").value); toast("Đã gửi email đặt lại mật khẩu", "mail"); showAuth("login"); }
      catch(e){ $("#au-err").textContent = e.message; }
      finally{ setAuthBusy(false); }
    });
  }

  else if(view==="role"){
    const name = (cloud.user && cloud.user.name) || "bạn";
    const roles = [
      { id:"self", icon:"fitness_center", title:"Tập luyện cá nhân", desc:"Giáo án, lịch tập, dinh dưỡng, giấc ngủ, tiến độ của riêng bạn." },
      { id:"student", icon:"person_add", title:"Tôi có PT", desc:"Nhập mã 6 ký tự PT gửi để xem buổi tập PT giao và phản hồi." },
      { id:"pt", icon:"sports", title:"Tôi là PT", desc:"Quản lý học viên, thời khoá biểu, giao bài, nhắc nhở hai chiều." },
      { id:"find", icon:"travel_explore", title:"Tìm & Book PT", desc:"Sắp ra mắt.", soon:true },
    ];
    body.innerHTML = `<div class="auth-form">
      <h2 class="onboard-hero">Chào ${escapeHtml(name)}!</h2>
      <p class="onboard-sub">Bạn dùng TapEasy để làm gì? (Đổi lại được trong Hồ sơ)</p>
      ${roles.map(r=>`
        <div class="role-card ${r.soon?'soon':''}" data-role="${r.id}" role="button" tabindex="0" data-fk-key aria-label="${escapeHtml(r.title + (r.soon ? " (sắp ra mắt)" : "") + ": " + r.desc)}">
          <span class="material-symbols-rounded" aria-hidden="true">${r.icon}</span>
          <div><div class="name">${escapeHtml(r.title)}${r.soon?' <span class="soon-badge">Sắp ra mắt</span>':''}</div><div class="sub">${escapeHtml(r.desc)}</div></div>
        </div>`).join("")}
      </div>`;
    $$("[data-role]").forEach(el=> el.addEventListener("click", ()=> pickRole(el.dataset.role)));
  }

  $$("[data-auth]", body).forEach(el=> el.addEventListener("click", ()=> showAuth(el.dataset.auth)));
}
function setAuthBusy(b){
  const btn = $("#au-submit"); if(!btn) return;
  btn.disabled = b; btn.style.opacity = b ? .6 : 1;
}
/* QT-12: rời màn chào → dừng hẳn video nền (pause + bỏ nguồn) để không giải mã ngầm, tốn pin/4G, gây giật khi cuộn.
   Mở lại màn chào thì showAuth("welcome") gắn lại video (mountWelcomeVideo). */
function stopAuthVideos(){
  try{
    const box = document.getElementById("auth");
    const vids = box && box.querySelectorAll ? [...box.querySelectorAll("video")] : [];
    vids.forEach(v=>{
      try{ v.pause(); }catch(e){}
      try{ v.removeAttribute("src"); [...(v.querySelectorAll ? v.querySelectorAll("source") : [])].forEach(s=> s.removeAttribute("src")); v.load && v.load(); }catch(e){}
    });
  }catch(e){}
}
function hideAuth(){ $("#auth").classList.remove("open"); stopAuthVideos(); }
/* QU-04: màn chào lần đầu KHÔNG gọi API tìm video (Pixabay/Pexels — khoá lộ ở client, thêm request + giải mã video lúc TTI).
   Nền = ảnh tĩnh nhỏ (poster ~720 px). Video nền chỉ gắn khi chủ app đã gán SẴN 1 URL cố định lúc build
   (MEDIA_CONFIG.welcomeVideo = link .mp4 hoặc file cục bộ, không phải "auto") và chỉ sau khi màn chào vẽ xong (lúc rảnh);
   video.js vẫn tự bỏ qua khi giảm chuyển động / tiết kiệm dữ liệu (QU-34). */
function welcomePoster(){
  try{ const p = typeof MEDIA_CONFIG !== "undefined" && MEDIA_CONFIG && MEDIA_CONFIG.welcomePoster; if(p) return p; }catch(e){}
  const u = (typeof IMG !== "undefined" && IMG && IMG.heroWorkout3) || "";
  return /images\.pexels\.com/.test(u) ? u.replace(/([?&]w=)\d+/, "$1720") : u;
}
function welcomeVideoFixedSrc(){
  try{
    const v = typeof MEDIA_CONFIG !== "undefined" && MEDIA_CONFIG ? MEDIA_CONFIG.welcomeVideo : "";
    if(typeof v !== "string" || !v.trim() || v.trim() === "auto") return "";
    return safeUrl(v, { noBlob:true }) || "";
  }catch(e){ return ""; }
}
function scheduleWelcomeVideo(){
  if(typeof mountWelcomeVideo !== "function" || !welcomeVideoFixedSrc()) return false;
  fkIdle(()=>{ try{ const a = $("#auth"); if(a && a.classList.contains("open")) mountWelcomeVideo(); }catch(e){} }, 2500);
  return true;
}
/* QU-02: chạy việc phụ lúc trình duyệt rảnh (requestIdleCallback, hạn chót `ms`); không có rIC → setTimeout. Chạy đúng 1 lần. */
function fkIdle(fn, ms){
  let done = false;
  const run = ()=>{ if(done) return; done = true; try{ fn(); }catch(e){ try{ console.warn("[idle]", e); }catch(_){} } };
  try{ if(typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: ms || 1500 }); }catch(e){}
  setTimeout(run, ms || 1500);
}
/* Nhường luồng 1 nhịp (task mới) — trình duyệt kịp vẽ khung đầu / nhận chạm trước khi chạy tiếp */
function fkYield(){
  try{ if(typeof scheduler !== "undefined" && scheduler && typeof scheduler.yield === "function") return scheduler.yield(); }catch(e){}
  return new Promise(r=> setTimeout(r, 0));
}

async function pickRole(role){
  if(role==="find"){ toast("Tìm & Book PT sẽ có ở bản cập nhật tiếp theo", "schedule"); return; }
  try{
    const isPT = role==="pt" || !!(cloud.profile && cloud.profile.isPT);
    await cloud.updateMyProfile({ mainRole: role, isPT });
  }catch(e){ toast(e.message, "error"); return; }
  state.authDone = true;
  if(!state.profile.name && cloud.user) state.profile.name = cloud.user.name;
  if(role==="pt" && !state.onboarded){
    // PT vào thẳng khu quản lý học viên; chỉ số cơ thể cập nhật sau trong Hồ sơ
    state.onboarded = true; recomputeProfile(); ensurePlans();
    if(typeof fkApplyDefaultPlan === "function") fkApplyDefaultPlan();   // QT-05: không gán giáo án 6 buổi mặc định
    if(!state.startDate) state.startDate = todayStr();
  }
  // QU-15: chọn "Tôi là PT" → mở thẳng dashboard PT (tab Học viên của tôi), không giữ tab "PT của tôi" cũ
  if(role==="pt"){ try{ coachTab = "clients"; }catch(e){} }
  if(role==="student") state._pendingJoin = true;
  saveState();
  finishBoot(role==="pt" ? "coach" : null);
}

/* Sau khi đăng nhập/đăng ký thành công */
function postAuthRoute(){
  state.authDone = true; saveState();
  refreshCoachData(true);
  if(cloud.isLoggedIn() && !(cloud.profile && cloud.profile.mainRole)){ showAuth("role"); return; }
  finishBoot("coach_if_open");
}

/* Vào app chính */
function finishBoot(target){
  hideAuth();
  if(!state.onboarded){ openOnboarding(false); return; }
  /* QU-02: chỉ ghi khi hồ sơ tính lại THẬT SỰ đổi, và ghi thẳng (_saveStateV1 = bản lưu gốc) — không kích hoạt các lớp bọc
     saveState của module (đồng bộ cloud, kiểm thành tích, lịch thông báo) ngay lúc khởi động; appBoot tự lên lịch thông báo sau. */
  const _prof0 = JSON.stringify(state.profile || {});
  recomputeProfile();
  if(JSON.stringify(state.profile || {}) !== _prof0) _saveStateV1();
  if(target==="coach_if_open"){ const cur = $(".screen.active"); target = cur && cur.id==="screen-coach" ? "coach" : (state._pendingJoin ? "coach" : "home"); }
  // QU-02: không renderAll() trước — goto() vẽ đúng màn đích 1 lần; các màn khác vẽ lười khi vào
  goto(target || "home");
  if(state._pendingJoin){ delete state._pendingJoin; saveState(); setTimeout(openJoinSheet, 300); }
}
/* Gọi từ app.js khi onboarding lần đầu xong */
function afterFirstOnboarding(){
  if(state._pendingJoin){ delete state._pendingJoin; saveState(); goto("coach"); setTimeout(openJoinSheet, 300); }
  else goto("home");
}

/* ---------------------------------------------------------------------
   3. TRANG CHỦ
   --------------------------------------------------------------------- */
function nextReminderEvents(limit=3){
  const out = [], now = new Date();
  const r = state.reminders;
  for(let d=0; d<7; d++){
    const date = new Date(); date.setDate(date.getDate()+d);
    const ds = todayStr(date), dk = todayDayKey(date);
    const at = t=>{ const x=parseDay(ds); const [h,m]=t.split(":").map(Number); x.setHours(h,m,0,0); return x; };
    if(r.master){
      const w = r.workout[dk], day = getActivePlan().days[dk];
      if(w && w.enabled && day.items.length) out.push({ at: at(w.time), icon:"fitness_center", text:`Tập: ${day.title}` });
      MEAL_TYPES.forEach(mt=>{ const x=r.meal[mt.id]; if(x && x.enabled) out.push({ at: at(x.time), icon: mt.icon, text: mt.label }); });
      if(r.bedtimeEnabled) out.push({ at: at(r.bedtimeTime||"22:30"), icon:"bedtime", text:"Đi ngủ" });
    }
  }
  if(state.coachPrefs.remind) state.coachUpcoming.forEach(u=> out.push({ at: sessStart(u), icon:"groups", text:`Buổi PT · ${u.who}` }));
  return out.filter(e=> e.at > now).sort((a,b)=> a.at-b.at).slice(0, limit);
}

function ringSVG(pct, size=64, stroke=7, color="var(--primary)"){
  const r = (size-stroke)/2, c = 2*Math.PI*r, off = c*(1-Math.max(0,Math.min(1,pct)));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
}

/* ---------------------------------------------------------------------
   3a. TRANG CHỦ — hàng "Khám phá" + sắp xếp khối (vòng tích hợp 2)
   Mỗi module trước đây tự chèn 1 thẻ lớn vào Trang chủ → màn đầu dài, trùng lối vào.
   Quy tắc mới (docs/INTEGRATION-LOG.md · Vòng 2):
     • Màn đầu ≤ ~6 khối: Chào · 1 cảnh báo · Tuần · Buổi hôm nay · Chỉ số · Khám phá
       (+ "Buổi với PT" khi có lịch — việc có giờ hẹn luôn đứng trước khám phá).
     • Lối vào "khám phá" (tính năng mới, không gắn với số liệu cá nhân hôm nay) = 1 ô trong
       hàng cuộn ngang "Khám phá": teHomeExplore.add({ id, title, sub, icon, onClick, priority, color, badge, when }).
       priority: số LỚN đứng TRƯỚC (0–100, mặc định 50). Cùng id → thay thế (module thật thay ô tạm).
     • Thẻ mang tiến độ cá nhân (thi đua đang tham gia, vé, quà, cấp độ, tổng kết tuần) ở dưới màn đầu.
     • Module mới có thể tự khai báo vùng bằng thuộc tính data-home-zone="alert|primary|personal|bottom|explore"
       trên phần tử gốc chèn vào #home-content ("explore" = ẩn thẻ vì đã có ô Khám phá).
   --------------------------------------------------------------------- */
try{ if(typeof FK_LINE === "object" && FK_LINE && !FK_LINE.explore) FK_LINE.explore = "c:12,12,9.5|M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"; }catch(e){}

const teHomeExplore = (function(){
  const items = new Map();
  let seq = 0, pending = false;
  const val = (v, d)=>{ try{ return typeof v === "function" ? v() : v; }catch(e){ return d; } };
  const safeIcon = n=> String(n || "explore").replace(/[^a-z0-9_]/gi, "") || "explore";
  const safeColor = c=> /^(#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\)|rgba?\([0-9.,\s%]+\))$/i.test(String(c||"")) ? String(c) : "";
  const later = fn=> (typeof queueMicrotask === "function" ? queueMicrotask(fn) : Promise.resolve().then(fn));
  function add(def){
    if(!def || def.id == null || !def.title) return api;
    const id = String(def.id), prev = items.get(id);
    const pr = Number(def.priority);
    items.set(id, Object.assign({}, def, { id, priority: Number.isFinite(pr) ? pr : 50, _seq: prev ? prev._seq : ++seq }));
    refresh();
    return api;
  }
  function remove(id){ if(items.delete(String(id))) refresh(); return api; }
  function list(){
    return [...items.values()].filter(it=> it.when == null || val(it.when, false))
      .sort((a, b)=> b.priority - a.priority || a._seq - b._seq);
  }
  function tileHTML(it){
    const sub = val(it.sub, ""), badge = val(it.badge, ""), color = safeColor(val(it.color, ""));
    return `<button type="button" class="te-xp" role="listitem" data-xid="${escapeHtml(it.id)}"${color ? ` style="--c:${color}"` : ""}>
      <span class="te-xp-ic"><span class="material-symbols-rounded">${safeIcon(val(it.icon, "explore"))}</span></span>
      <b>${escapeHtml(val(it.title, ""))}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}
      ${badge !== "" && badge != null && badge !== 0 ? `<i class="te-xp-badge">${escapeHtml(String(badge))}</i>` : ""}</button>`;
  }
  function inner(){
    const L = list();
    return `<div class="te-explore-head"><h3>Khám phá</h3><small>${L.length} mục</small></div>
      <div class="te-explore-row" role="list">${L.map(tileHTML).join("")}</div>`;
  }
  function sig(){ return list().map(it=> [it.id, val(it.title,""), val(it.sub,""), val(it.badge,""), val(it.icon,""), val(it.color,"")].join("~")).join("|"); }
  function html(){ return `<section class="te-explore" id="te-explore" aria-label="Khám phá" data-sig="${escapeHtml(sig())}">${inner()}</section>`; }
  function refresh(){ if(pending) return; pending = true; later(()=>{ pending = false; try{ teHomeLayout(); }catch(e){ try{ console.warn("[home] layout", e); }catch(_){} } }); }
  function open(id){ const it = items.get(String(id)); if(!it || typeof it.onClick !== "function") return false; try{ it.onClick(); }catch(e){ try{ toast(e.message || "Có lỗi, thử lại nhé", "error"); }catch(_){} } return true; }
  const api = { add, remove, list, html, inner, sig, refresh, open,
    has: id=> items.has(String(id)),
    shown: id=> list().some(it=> it.id === String(id)) };   // ô đang hiển thị (điều kiện when thoả)
  return api;
})();
try{ window.teHomeExplore = teHomeExplore; }catch(e){}

/* Ô mặc định + ô "cầu nối" cho module đã có (module tự add cùng id sẽ thay thế)
   Vòng tích hợp 3 — hàng Khám phá gọn 7 ô, theo 2 nhóm:
     • Kết nối (tính năng mới, người dùng chưa biết): Tìm PT 98 · Cộng đồng 95 · Sự kiện 92 · Kho kiến thức 86 (kb.js) · Cửa hàng 84 (GLOSSARY §8.1)
     • Giáo án: Giáo án riêng 70 · Giáo án mẫu 60
   Bỏ ô "Tiến độ" và "Bài tập" (đã có ở menu ☰ → Tập luyện và màn Tập luyện) — tránh hàng cuộn quá dài. */
(function(){
  const month = ()=> new Date().getMonth() + 1;
  teHomeExplore
    .add({ id:"findpt", title:"Tìm PT", sub:"PT gần bạn · giá · đánh giá", icon:"travel_explore", color:"#FFB08A", priority:98, onClick: ()=> openFindPTSoon() })
    .add({ id:"community", title:"Cộng đồng", sub:"Giáo án chia sẻ của PT & bạn tập", icon:"public", color:"#33D6C9", priority:95,
           when: ()=> typeof TECommunity !== "undefined", onClick: ()=> goto("community") })
    .add({ id:"events", title:"Sự kiện", sub: ()=> `Thử thách T${month()} · gặp mặt · quà`, icon:"te_trophy", color:"#FFC46B", priority:92,
           when: ()=> typeof TapEv !== "undefined" && typeof TapEv.open === "function", onClick: ()=> TapEv.open("challenges") })
    .add({ id:"shop", title:"Cửa hàng", sub:"Áo, bình, phụ kiện", icon:"storefront", color:"#FF7A45", priority:84,
           when: ()=> typeof TapShop !== "undefined" && (typeof TapShop.open === "function" || (typeof TapEv !== "undefined" && typeof TapEv.open === "function")),
           onClick: ()=> typeof TapShop.open === "function" ? TapShop.open() : TapEv.open("shop") })   // Cửa hàng (toàn màn) hoặc tab cũ trong Sự kiện
    .add({ id:"builder", title:"Giáo án riêng", icon:"auto_awesome", color:"#FFB08A", priority:70,
           sub: ()=>{ const pl = getActivePlan(); return pl && pl.fromBuilder ? "Đang dùng · tạo lại" : "6 câu hỏi · ~1 phút"; },
           when: ()=> typeof openProgramBuilder === "function", onClick: ()=> openProgramBuilder() })
    .add({ id:"templates", title:"Giáo án mẫu", sub:"PPL, full body, giảm mỡ…", icon:"school", color:"#5EE6C7", priority:60, onClick: ()=> openTemplateBrowser() });
})();

/* Bấm ô Khám phá (uỷ quyền 1 lần — sống qua mọi lần vẽ lại) */
try{ document.addEventListener("click", e=>{
  const b = e.target && e.target.closest ? e.target.closest("#te-explore [data-xid]") : null;
  if(b){ e.preventDefault(); teHomeExplore.open(b.getAttribute("data-xid")); }
}); }catch(e){}

/* Sắp xếp khối con trực tiếp của #home-content — chạy sau mỗi lần vẽ (microtask) và khi module chèn thẻ muộn.
   Chỉ di chuyển phần tử lệch chỗ (không vẽ lại) → giữ nguyên trình nghe sự kiện của module. */
function teHomeLayout(){
  const el = document.getElementById("home-content");
  if(!el || !el.children || !el.children.length) return;
  // 1. hàng Khám phá: thêm nếu thiếu, cập nhật nếu danh sách ô đổi
  let xp = el.querySelector("#te-explore");
  const sg = teHomeExplore.sig();
  if(!xp){
    const w = document.createElement("div"); w.innerHTML = teHomeExplore.html().trim(); xp = w.firstElementChild;
    if(xp) el.appendChild(xp);
  } else if(xp.getAttribute("data-sig") !== sg){
    xp.setAttribute("data-sig", sg); xp.innerHTML = teHomeExplore.inner();
  }
  // 2. phân vùng
  const kids = [...el.children];
  const never = !((state.finishedDates || []).length) && !Object.values(state.workoutLog || {}).some(l=> l && l.finishedAt);
  const has = (n, sel)=>{ try{ return !!n.querySelector(sel); }catch(e){ return false; } };
  const is = (n, sel)=>{ try{ return n.matches(sel); }catch(e){ return false; } };
  const alerts = [];
  const zone = new Map();
  kids.forEach((n, i)=>{
    const z = (n.getAttribute && n.getAttribute("data-home-zone")) || "";
    let v;
    if(z === "explore") v = 99;
    else if(z === "alert"){ alerts.push({ n, p:70, i }); v = 1; }
    else if(z === "primary") v = 5.5;
    else if(z === "personal") v = 7;
    else if(z === "bottom") v = 10;
    else if(is(n, ".home-greet")) v = 0;
    else if(is(n, ".hs-home.urgent")){ alerts.push({ n, p:100, i }); v = 1; }
    else if(is(n, ".ach-comeback")){ if(never) v = 7.5; else { alerts.push({ n, p:80, i }); v = 1; } }
    else if(is(n, ".hs-home")){ alerts.push({ n, p:60, i }); v = 1; }
    else if(is(n, ".week-strip, .week-note")) v = 2;
    else if(is(n, ".home-hero")) v = 3;
    else if(is(n, ".metric-grid")) v = 4;
    else if(is(n, ".home-pt")) v = 5;
    else if(n === xp) v = 6;
    else if(is(n, ".te-home")){
      // Thẻ Sự kiện: giữ khi có tiến độ cá nhân (đang thi đua / vé / quà); chỉ là lời mời → đã có ô "Thi đua tháng"
      const personal = has(n, ".te-hc-row, .te-gift-banner, [data-te='checkin'], [data-te='ticket']");
      const promoOnly = !personal && has(n, ".te-hc-promo, [data-te='ev']") && teHomeExplore.shown("events");
      v = promoOnly ? 99 : 7;
    }
    else if(is(n, ".pb-home-card")) v = teHomeExplore.shown("builder") ? 99 : 8.5;
    else if(is(n, ".cm-home, #cm-home")) v = teHomeExplore.shown("community") ? 99 : 8.5;
    else if(is(n, ".ach-weekcard")) v = 8;
    else if(is(n, ".ach-mini")) v = 8.2;
    else if(is(n, ".home-reminders")) v = 10;
    else v = 9;                                   // khối chưa biết (module sau): trên Nhắc nhở, giữ thứ tự gốc
    zone.set(n, v);
  });
  // chỉ 1 cảnh báo ở màn đầu (ưu tiên cao nhất); cảnh báo còn lại xuống dưới thẻ cá nhân
  alerts.sort((a, b)=> b.p - a.p || a.i - b.i);
  alerts.forEach((a, k)=> zone.set(a.n, k === 0 ? 1 : 7.6));
  // 3. ẩn thẻ trùng (đã gộp vào Khám phá) — không xoá để module không chèn lại
  kids.forEach(n=>{ const merged = zone.get(n) === 99; if(n.classList && n.classList.contains("te-merged") !== merged) n.classList.toggle("te-merged", merged); });
  // 4. sắp xếp ổn định theo vùng, chỉ di chuyển phần tử lệch chỗ
  const want = kids.map((n, i)=> ({ n, i, z: zone.get(n) })).sort((a, b)=> a.z - b.z || a.i - b.i).map(x=> x.n);
  for(let i = 0; i < want.length; i++){
    const cur = el.children[i];
    if(cur !== want[i]) el.insertBefore(want[i], cur || null);   // DOM thật: insertBefore tự chuyển chỗ phần tử
  }
}
/* Module chèn thẻ muộn (sau khi tải dữ liệu) → sắp lại; nạp xong mọi script → cập nhật ô Khám phá của module */
try{
  const hc = document.getElementById("home-content");
  if(hc && typeof MutationObserver === "function") new MutationObserver(()=> teHomeExplore.refresh()).observe(hc, { childList:true });
  window.addEventListener("load", ()=> teHomeExplore.refresh());
}catch(e){}

function renderHomeScreen(){
  const el = $("#home-content"); if(!el) return;
  const p = state.profile;
  const now = new Date();
  const dk = todayDayKey(), plan = getActivePlan(), day = plan && plan.days && plan.days[dk];
  const fin = Array.isArray(state.finishedDates) ? state.finishedDates : [];
  const log0 = state.workoutLog[todayStr()];
  const log = log0 && (!log0.dayKey || log0.dayKey === dk) ? log0 : null;     // buổi bù ngày khác không tính vào buổi hôm nay
  const doneCount = log ? (log.completedExerciseIds||[]).length : 0;
  const finished = fin.includes(todayStr()) && !!log;
  const dayItems = day && Array.isArray(day.items) ? day.items : [];
  const dayPct = dayItems.length ? (finished ? 1 : Math.min(1, doneCount/dayItems.length)) : 0;

  const food = getDayFoodLog(); let kcal = 0; Object.values(food).forEach(l=> (Array.isArray(l) ? l : []).forEach(i=> kcal += Number(i && i.kcal) || 0));
  /* integrator (FIX-nutrition vòng 2 #1): "Ẩn số calo" (nuHideKcal — tiền sử RLĂU) → ô "Bữa đã ghi n/4" thay cho "Calo hôm nay" */
  const hideK = fkHideKcal();
  const mealTypes = typeof MEAL_TYPES !== "undefined" && Array.isArray(MEAL_TYPES) && MEAL_TYPES.length ? MEAL_TYPES : [{id:"breakfast"},{id:"lunch"},{id:"dinner"},{id:"snack"}];
  const mealsT = mealTypes.length, mealsN = mealTypes.filter(mt=> Array.isArray(food[mt.id]) && food[mt.id].length > 0).length;
  const water = Number(state.waterLog[todayStr()]) || 0;
  const waterGoal = typeof waterTargetL === "function" ? waterTargetL(p) : (p.waterTargetOverride != null ? p.waterTargetOverride : fmt1((p.weight||65) * 0.035));
  const vn = n=> typeof fmtVN === "function" ? fmtVN(n) : String(n);
  const sl = state.sleepLog[todayStr()] || state.sleepLog[dateStrOffset(-1)];
  const sleepGoal = p.sleepGoalHours || 8;
  const streak = calcStreak();

  // Dải 7 ngày (Thứ 2 → Chủ nhật tuần này). QU-20/QT-20: ngày trước khi bắt đầu dùng app / bắt đầu giáo án không bị chấm
  // "bỏ lỡ" và không tính vào chỉ tiêu tuần; ngày đã tập bù ở ngày khác (QT-04) cũng không tính bỏ lỡ.
  const startDs = typeof fkPlanStartDate === "function" ? fkPlanStartDate() : "";
  const covered = typeof fkCoveredDates === "function" ? fkCoveredDates() : new Set();
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  const week = Array.from({length:7}, (_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=todayStr(d);
    const k = todayDayKey(d), pd = plan && plan.days && plan.days[k];
    const before = !!startDs && ds < startDs;
    return { ds, k, n:d.getDate(), done: fin.includes(ds), rest: !(pd && Array.isArray(pd.items) && pd.items.length), today: ds===todayStr(), past: ds<todayStr(), before, covered: covered.has(ds) }; });
  const weekDone = week.filter(w=>w.done).length, weekPlanned = week.filter(w=>!w.rest && (!w.before || w.done)).length;

  const ptSoon = [...(state.coachUpcoming||[])].filter(u=> sessStart(u) > new Date(now.getTime()-2*3600000)).slice(0,3);
  const events = nextReminderEvents(3);
  const first = escapeHtml((p.name||(cloud.user&&cloud.user.name)||"bạn").trim().split(" ").slice(-1)[0]);
  const hour = now.getHours();
  const hello = hour<11 ? "Chào buổi sáng" : hour<14 ? "Chào buổi trưa" : hour<18 ? "Chào buổi chiều" : "Chào buổi tối";

  el.innerHTML = `
    <div class="home-greet">
      <div>
        <div class="small-note" style="text-transform:uppercase;letter-spacing:1px;">${now.getDay()===0?"Chủ nhật":"Thứ "+(now.getDay()+1)}, ${pad2(now.getDate())}/${pad2(now.getMonth()+1)}</div>
        <h2 style="font-size:28px;margin-top:4px;">${hello},<br><span style="color:rgba(255,255,255,.72)">${first}</span></h2>
      </div>
      <div class="streak-chip" onclick="goto('workout')" role="button" tabindex="0" data-fk-key aria-label="Chuỗi ${streak} ngày tập — mở Tập luyện"><span class="material-symbols-rounded" aria-hidden="true">local_fire_department</span><b>${streak}</b><small>ngày</small></div>
    </div>

    <div class="week-strip">
      ${week.map(w=>`<div class="wd ${w.today?'today':''} ${w.done?'done':''} ${w.rest?'rest':''} ${w.past&&!w.done&&!w.rest&&!w.before&&!w.covered?'miss':''}">
        <small>${w.k==="CN"?"CN":w.k}</small><b>${w.n}</b><i>${w.done?'<span class="material-symbols-rounded">check</span>':''}</i></div>`).join("")}
    </div>
    <p class="small-note week-note" style="margin:-4px 2px 2px;">Tuần này: <b style="color:var(--text)">${weekDone}/${weekPlanned}</b> buổi đã tập</p>

    <div class="home-hero" style="background-image:url('${attrUrl(IMG.heroWorkout1)}')">
      <div class="home-hero-body">
        <div class="hero-eyebrow">Buổi hôm nay · ${escapeHtml(DAY_LABELS[dk] || dk)}</div>
        ${dayItems.length ? `
          <div class="headline" style="font-size:26px;line-height:1.05;">${escapeHtml(day.title)}</div>
          <div class="hero-meta">
            <span><span class="material-symbols-rounded">fitness_center</span>${dayItems.length} bài</span>
            <span><span class="material-symbols-rounded">schedule</span>~${escapeHtml(String(Number(day.duration)||30))} phút</span>
            <span><span class="material-symbols-rounded">bolt</span>${escapeHtml(day.intensity||"Vừa")}</span>
          </div>
          ${finished
            ? `<button class="btn btn-primary" style="margin-top:14px;" data-home-act="view"><span class="material-symbols-rounded">play_arrow</span>Xem lại buổi tập</button>`
            : `<button class="btn btn-primary" style="margin-top:14px;" data-home-act="start" id="home-start-session"><span class="material-symbols-rounded">play_arrow</span>${doneCount?"Tập tiếp":"Bắt đầu tập"}</button>
               <button class="btn btn-ghost btn-sm" style="margin-top:8px;" data-home-act="view">Xem buổi hôm nay</button>`}
        ` : `
          <div class="headline" style="font-size:26px;">Ngày nghỉ ngơi</div>
          <div class="small-note" style="margin-top:6px;max-width:80%;">Phục hồi cũng là tập luyện. Đi bộ nhẹ, giãn cơ, ngủ đủ giấc.</div>
          <button class="btn btn-outline" style="margin-top:14px;" onclick="goto('workout')">Xem lịch tuần</button>
        `}
      </div>
      ${dayItems.length ? `<div class="home-hero-ring">${ringSVG(dayPct, 78, 8, "#fff")}<div><b>${Math.round(dayPct*100)}%</b><small>${Math.min(doneCount, dayItems.length)}/${dayItems.length}</small></div></div>` : ""}
    </div>

    <div class="metric-grid">
      ${hideK ? `<div class="metric" onclick="goto('nutrition')" role="button" tabindex="0" data-fk-key data-kcal-hidden aria-label="Bữa ăn đã ghi hôm nay: ${mealsN} trên ${mealsT} — mở Dinh dưỡng">
        <div class="metric-ring">${ringSVG(mealsN/mealsT, 52, 6, "#FF7A45")}<span class="material-symbols-rounded">restaurant</span></div>
        <b>${mealsN}/${mealsT}</b><small>bữa đã ghi</small>
      </div>` : `<div class="metric" onclick="goto('nutrition')" role="button" tabindex="0" data-fk-key aria-label="Calo hôm nay ${Math.round(kcal)} trên ${Number(p.goalKcal)||0} kcal — mở Dinh dưỡng">
        <div class="metric-ring">${ringSVG(p.goalKcal? kcal/p.goalKcal:0, 52, 6, "#FF7A45")}<span class="material-symbols-rounded">local_fire_department</span></div>
        <b>${Math.round(kcal)}</b><small>/ ${Number(p.goalKcal)||0} kcal</small>
      </div>`}
      <div class="metric" onclick="goto('nutrition')" role="button" tabindex="0" data-fk-key aria-label="Nước uống ${vn(fmt1(water))} lít — mở Dinh dưỡng">
        <div class="metric-ring">${ringSVG(waterGoal? water/waterGoal:0, 52, 6, "#5EE6C7")}<span class="material-symbols-rounded" style="color:#9AF1DD">water_drop</span></div>
        <b>${vn(fmt1(water))} L</b><small>${waterGoal == null ? "theo bác sĩ" : `/ ${vn(waterGoal)} L nước`}</small>
      </div>
      <div class="metric" onclick="goto('sleep')" role="button" tabindex="0" data-fk-key aria-label="Giấc ngủ — mở màn Giấc ngủ">
        <div class="metric-ring">${ringSVG(sl? sl.hours/sleepGoal:0, 52, 6, "#9AF1DD")}<span class="material-symbols-rounded" style="color:#9AF1DD">bedtime</span></div>
        <b>${sl ? vn(fmt1(sl.hours))+"h" : "--"}</b><small>/ ${escapeHtml(String(sleepGoal))}h ngủ</small>
      </div>
    </div>

    ${ptSoon.length ? `
    <div class="home-pt">
    <div class="section-title"><h3>Buổi với PT</h3><a onclick="goto('coach')">Xem tất cả</a></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
      ${ptSoon.map(u=>`
        <div class="list-item home-pt-row" style="cursor:pointer;" role="button" tabindex="0" data-fk-key data-pt-cid="${escapeHtml(String(u.cid||""))}" data-pt-role="${u.role==="pt"?"pt":"student"}">
          <div class="date-chip"><b>${escapeHtml(u.time||"")}</b><small>${escapeHtml(relDay(u.date))}</small></div>
          <div class="info"><div class="name">${escapeHtml(u.title||"Buổi tập")}</div><div class="meta">${u.role==="pt"?"Học viên":"PT"}: ${escapeHtml(u.who)} · ${u.mode==="online"?"Online":"Tại phòng tập"}</div></div>
          <span class="material-symbols-rounded" style="color:var(--text-dim);font-size:18px;">chevron_right</span>
        </div>`).join("")}
    </div>
    </div>` : ""}

    ${teHomeExplore.html()}

    <div class="card home-reminders">
      <div class="card-title" style="justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded">notifications_active</span>Nhắc nhở tiếp theo</span>
        <a onclick="goto('reminders')" style="font-size:12px;color:var(--primary-soft);font-weight:700;">Cài đặt</a>
      </div>
      ${events.length ? events.map(e=>`
        <div class="link-row"><div class="left"><span class="material-symbols-rounded">${e.icon}</span><div><div class="name">${escapeHtml(e.text)}</div><div class="sub">${hhmm(e.at)} · ${relDay(todayStr(e.at))}</div></div></div></div>
      `).join("") : `<p class="small-note">${state.reminders.master ? "Chưa có nhắc nhở nào trong 7 ngày tới." : "Nhắc nhở đang tắt — bật để TapEasy nhắc giờ tập, giờ ăn, giờ ngủ."}</p>
        ${state.reminders.master ? "" : `<button class="btn btn-soft btn-sm" style="margin-top:10px;" onclick="goto('reminders')">Bật nhắc nhở</button>`}`}
    </div>
  `;
  teHomeExplore.refresh();   // sắp xếp lại SAU khi mọi module (bọc renderHomeScreen) đã chèn thẻ — chạy ở microtask
}
/* Trang chủ — uỷ quyền 1 lần (sống qua mọi lần vẽ lại):
   QU-14: "Bắt đầu tập" bắt đầu NGAY buổi hôm nay (startSession — qua mọi lớp bọc: sàng lọc sức khoẻ, training-pro…);
          "Xem buổi hôm nay" / "Xem lại buổi tập" mở màn Tập luyện.
   QS-02: hàng "Buổi với PT" mở form qua data-* (đã escape) thay cho onclick chèn id thô. */
function homeStartToday(){
  const dk = todayDayKey();
  state.selectedDay = dk;
  if(typeof startSession === "function") startSession(dk); else goto("workout");
}
try{ document.addEventListener("click", e=>{
  const t = e.target && e.target.closest ? e.target : null; if(!t) return;
  const a = t.closest("#home-content [data-home-act]");
  if(a){ e.preventDefault(); if(a.getAttribute("data-home-act") === "start") homeStartToday(); else { state.selectedDay = todayDayKey(); goto("workout"); } return; }
  const r = t.closest("#home-content [data-pt-cid]");
  if(r && typeof openClientForm === "function"){ e.preventDefault(); openClientForm(r.getAttribute("data-pt-cid"), r.getAttribute("data-pt-role") === "pt" ? "pt" : "student", "today"); }
}); }catch(e){}

function openFindPTSoon(){
  openSheet(`
    <div class="sheet-header"><h3>Tìm &amp; Book PT</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <span class="material-symbols-rounded" style="font-size:48px;color:var(--primary);">travel_explore</span>
    <p style="margin-top:10px;">Tính năng tìm PT theo khu vực, xem hồ sơ thương hiệu và đặt lịch đang được phát triển cho bản cập nhật tiếp theo.</p>
    <p class="small-note" style="margin-top:8px;">Trong lúc chờ: nếu bạn đã có PT, hãy xin PT mã 6 ký tự rồi vào mục <b>PT</b> → <b>Nhập mã PT</b>.</p>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="closeSheet();goto('coach');">Đến mục PT</button>
  `);
}

/* ---------------------------------------------------------------------
   4. TÀI KHOẢN TRONG HỒ SƠ
   --------------------------------------------------------------------- */
const _renderProfileV1 = renderProfileScreen;
renderProfileScreen = function(){ _renderProfileV1(); renderAccountCard(); };

function renderAccountCard(){
  const card = $("#profile-account-card"); if(!card) return;
  // Đồng bộ Google Drive dùng đăng nhập Google trên web — Google chặn trong app native
  const driveBtn = $("#btn-open-drive"); if(driveBtn) driveBtn.style.display = isNative() ? "none" : "";
  const u = cloud.user, pr = cloud.profile || {};
  const modeNote = cloud.mode==="demo" ? `<p class="small-note" style="margin-top:6px;color:var(--warn);">Bản thử nghiệm — dữ liệu PT/học viên chỉ lưu trên máy này.</p>` : "";
  card.innerHTML = `
    <div class="card-title"><span class="material-symbols-rounded">badge</span>Tài khoản</div>
    ${u ? `
      <div class="link-row"><div class="left"><span class="material-symbols-rounded">account_circle</span><div><div class="name">${escapeHtml(u.name)}</div><div class="sub">${escapeHtml(u.email||"")}</div></div></div>
        ${pr.isPT ? `<span class="badge-pro">PT</span>` : ""}</div>
      <div class="link-row"><div class="left"><span class="material-symbols-rounded">sports</span><div><div class="name">Chế độ PT</div><div class="sub">Quản lý học viên, giao bài, thời khoá biểu</div></div></div>
        <div class="toggle ${pr.isPT?'on':''}" id="acc-pt-toggle"></div></div>
      <div class="link-row" id="acc-logout" style="cursor:pointer;"><div class="left"><span class="material-symbols-rounded">logout</span><div class="name">Đăng xuất</div></div></div>
      <div class="link-row" id="acc-delete" style="cursor:pointer;"><div class="left"><span class="material-symbols-rounded" style="color:var(--primary);">person_remove</span><div class="name" style="color:var(--primary-soft);">Xoá tài khoản</div></div></div>
    ` : `
      <p class="small-note">Bạn đang dùng TapEasy không cần tài khoản. Đăng nhập để kết nối với PT hoặc quản lý học viên.</p>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-primary btn-block btn-sm" onclick="showAuth('signup')">Tạo tài khoản</button>
        <button class="btn btn-outline btn-block btn-sm" onclick="showAuth('login')">Đăng nhập</button>
      </div>
    `}
    ${modeNote}
    <div class="divider" style="margin:10px 0;"></div>
    <div class="link-row" onclick="openPrivacySheet()" style="cursor:pointer;"><div class="left"><span class="material-symbols-rounded">shield</span><div class="name">Chính sách bảo mật</div></div><span class="material-symbols-rounded">chevron_right</span></div>
    <div class="link-row" onclick="openMediaSettings()" style="cursor:pointer;"><div class="left"><span class="material-symbols-rounded">video_library</span><div><div class="name">Nguồn video minh hoạ</div><div class="sub">${hasVideoSource() ? "Đã kết nối Pexels / Pixabay" : "Chưa kết nối — chạm để thêm API key"}</div></div></div><span class="material-symbols-rounded">chevron_right</span></div>
    <div class="link-row" onclick="openCreditsSheet()" style="cursor:pointer;"><div class="left"><span class="material-symbols-rounded">copyright</span><div class="name">Nguồn dữ liệu &amp; bản quyền</div></div><span class="material-symbols-rounded">chevron_right</span></div>
    <p class="small-note" style="text-align:center;margin-top:8px;">TapEasy v${APP_VERSION}</p>
  `;
  if(!u) return;
  $("#acc-pt-toggle").addEventListener("click", async ()=>{
    try{ await cloud.updateMyProfile({ isPT: !pr.isPT }); renderAccountCard(); renderHomeScreen(); toast(pr.isPT ? "Đã bật chế độ PT" : "Đã tắt chế độ PT"); }
    catch(e){ toast(e.message, "error"); }
  });
  $("#acc-logout").addEventListener("click", ()=>{
    confirmDialog("Đăng xuất?", "Dữ liệu tập cá nhân vẫn giữ trên máy. Bạn cần đăng nhập lại để dùng phần PT.", async ()=>{
      await cloud.signOut(); resetCoachData(); renderAll(); toast("Đã đăng xuất", "logout");
    }, "Đăng xuất", "logout");
  });
  $("#acc-delete").addEventListener("click", openDeleteAccountSheet);
}

function openDeleteAccountSheet(){
  openSheet(`
    <div class="sheet-header"><h3>Xoá tài khoản</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">Thao tác này <b>không thể hoàn tác</b>. TapEasy sẽ xoá vĩnh viễn:</p>
    <ul style="padding-left:18px;margin:8px 0;font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
      <li>Tài khoản đăng nhập và hồ sơ của bạn trên máy chủ</li>
      <li>Toàn bộ form học viên bạn tạo (nếu là PT), kèm buổi tập và ghi chú</li>
      <li>Liên kết của bạn với PT (nếu là học viên)</li>
      ${cloud.profile && cloud.profile.provider === "apple" ? `<li>Quyền "Đăng nhập với Apple" của TapEasy (app sẽ thu hồi token Apple)</li>` : ""}
    </ul>
    <p class="small-note">Dữ liệu tập cá nhân trên máy này vẫn giữ — xoá bằng "Đặt lại toàn bộ dữ liệu" nếu muốn.</p>
    ${cloud.isSocialUser ? `<p class="small-note" style="margin-top:12px;">Bạn đăng nhập bằng ${({facebook:"Facebook",apple:"Apple",google:"Google"})[cloud.profile.provider]||"Google"} — app sẽ hỏi xác nhận lại tài khoản đó.</p>` : `<div class="field" style="margin-top:12px;"><label>Nhập mật khẩu để xác nhận</label><input type="password" id="del-pw" placeholder="••••••"></div>`}
    <p class="auth-err" id="del-err"></p>
    <button class="btn btn-primary btn-block" id="del-go" style="margin-top:10px;">Xoá vĩnh viễn tài khoản</button>
  `);
  // RBAC (docs/INTEGRATION-admin.md §6.6): Chủ sở hữu phải chuyển nhượng quyền trước — xoá tài khoản Owner sẽ để app không còn Owner
  const isOwner = ()=>{ try{ return !!(window.TE_RBAC && typeof TE_RBAC.role === "function" && TE_RBAC.role() === "owner"); }catch(e){ return false; } };
  if(isOwner()) $("#del-err").textContent = "Bạn đang là Chủ sở hữu ứng dụng — vào Bảng quản trị → Đội ngũ → Chuyển nhượng trước khi xoá tài khoản.";
  $("#del-go").addEventListener("click", async ()=>{
    if(isOwner()){ $("#del-err").textContent = "Bạn là Chủ sở hữu — chuyển nhượng quyền trong Bảng quản trị trước khi xoá tài khoản."; return; }
    const btn = $("#del-go"); btn.disabled = true; btn.textContent = "Đang xoá...";
    try{
      await cloud.deleteAccount(($("#del-pw")||{}).value || "");
      closeSheet(); resetCoachData(); renderAll(); toast("Đã xoá tài khoản", "delete");
    }catch(e){ $("#del-err").textContent = e.message; btn.disabled=false; btn.textContent="Xoá vĩnh viễn tài khoản"; }
  });
}

/* Nút Google / Facebook trên màn đăng nhập & đăng ký */
function bindSocialButtons(needAgree){
  $$("[data-social]").forEach(b=> b.addEventListener("click", async ()=>{
    const err = $("#au-err");
    if(needAgree && $("#au-agree") && !$("#au-agree").checked){ err.textContent = "Bạn cần đồng ý với Điều khoản & Chính sách bảo mật."; return; }
    setAuthBusy(true); err.textContent = "";
    try{
      const k = b.dataset.social;
      if(k==="google") await cloud.signInWithGoogle(); else if(k==="apple") await cloud.signInWithApple(); else await cloud.signInWithFacebook();
      const p = cloud.profile; if(p && p.name && !state.profile.name) state.profile.name = p.name;
      postAuthRoute();
    }catch(e){ err.textContent = e.message; }
    finally{ setAuthBusy(false); }
  }));
}

function openPrivacySheet(){
  openSheet(`
    <div class="sheet-header"><h3>Chính sách bảo mật</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="policy-text">
      <p><b>Dữ liệu lưu trên máy bạn:</b> hồ sơ cơ thể, giáo án, nhật ký ăn uống, giấc ngủ, video và ảnh tiến độ. Không gửi lên máy chủ TapEasy.</p>
      <p><b>Dữ liệu lưu trên máy chủ (chỉ khi bạn tạo tài khoản):</b> email, tên hiển thị, và nội dung form PT ↔ học viên (lịch buổi tập, bài tập được giao, ghi chú, phản hồi). Chỉ PT và học viên của chính form đó xem được.</p>
      <p><b>Video minh hoạ:</b> khi bạn tìm video, từ khoá tìm kiếm (tên bài tập) được gửi tới Pexels/Pixabay để lấy danh sách video. Không gửi thông tin cá nhân.</p>
      <p><b>Phân tích ảnh bằng AI:</b> chỉ chạy khi bạn tự nhập API key của nhà cung cấp AI. Ảnh được gửi thẳng từ máy bạn tới nhà cung cấp đó.</p>
      <p><b>Không quảng cáo, không bán dữ liệu.</b> TapEasy không chia sẻ dữ liệu của bạn cho bên thứ ba để quảng cáo.</p>
      <p><b>Xoá dữ liệu:</b> Hồ sơ → Tài khoản → Xoá tài khoản (xoá dữ liệu trên máy chủ); Hồ sơ → Đặt lại toàn bộ dữ liệu (xoá dữ liệu trên máy).</p>
      <p><b>Lưu ý sức khoẻ:</b> số liệu calo, năng lượng nghỉ (BMR), năng lượng cả ngày (TDEE) chỉ mang tính ước lượng, không thay thế tư vấn y tế.</p>
    </div>
  `);
}

function openCreditsSheet(){
  openSheet(`
    <div class="sheet-header"><h3>Nguồn dữ liệu &amp; bản quyền</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="policy-text">
      <p><b>Thư viện 800+ bài tập:</b> free-exercise-db của yuhonas (github.com/yuhonas/free-exercise-db), giấy phép Unlicense (Public Domain).</p>
      <p><b>Ảnh minh hoạ:</b> Pexels (pexels.com), theo Pexels License — dùng thương mại miễn phí.</p>
      <p><b>Video hướng dẫn bài tập:</b> Exercise video by Your Move (ymove.app/exercise-api) — 25 video miễn phí, dùng thương mại có ghi nguồn. Video từ wger.de (tác giả ghi dưới mỗi video), giấy phép CC BY-SA 4.0, TapEasy đã nén lại; bản nén phát hành cùng giấy phép CC BY-SA 4.0.</p>
      <p><b>Video tham khảo:</b> Videos provided by Pexels (pexels.com) và Pixabay (pixabay.com), theo Pexels License / Pixabay Content License. Tên tác giả hiển thị dưới mỗi video.</p>
      <p><b>Video bài tập bổ sung:</b> Pexels (Pexels License) và Wikimedia Commons — tác giả Taco Fleur (CC BY-SA 4.0), FitnessScape (CC BY 3.0), U.S. Army (public domain). Đã cắt ngắn và nén lại; tên tác giả & giấy phép hiển thị dưới mỗi video.</p>
      <p><b>Giá trị dinh dưỡng:</b> tham khảo USDA FoodData Central (dữ liệu công khai của Chính phủ Hoa Kỳ).</p>
      <p><b>Công thức khoa học:</b> Mifflin-St Jeor (1990), khuyến nghị đạm ISSN (2017), khuyến nghị giấc ngủ National Sleep Foundation &amp; CDC.</p>
      <p><b>Biểu tượng:</b> Font Awesome 4.7 của Dave Gandy (SIL Open Font License 1.1).</p>
      <p><b>Phông chữ:</b> Oswald &amp; Hanken Grotesk (SIL Open Font License).</p>
    </div>
  `);
}

/* ---------------------------------------------------------------------
   5. KHỞI ĐỘNG
   --------------------------------------------------------------------- */
/* QU-02: appBoot vẽ ĐÚNG 1 màn (Trang chủ) rồi nhường luồng; việc phụ (đồng bộ PT, lịch thông báo native, service worker,
   lưu hồ sơ tính lại) chạy sau khung đầu / lúc rảnh. Giữ tên + chữ ký hàm (module khác có thể bọc). */
async function appBoot(){
  if("serviceWorker" in navigator && !isNative()) fkIdle(()=>{ try{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){} }, 4000);
  state.selectedDay = todayDayKey();
  ensureReminderDefaults();
  ensurePlans();
  $("#auth").classList.add("open");
  $("#auth-body").innerHTML = `<div class="splash"><div class="splash-brand"><img class="splash-logo on-dark" src="assets/brand/logo-lockup-light.svg" alt="TapEasy" data-no-fallback onerror="this.onerror=null;this.outerHTML='<div class=&quot;logo-big&quot;>Tap<b>Easy</b></div>'"><img class="splash-logo on-light" src="assets/brand/logo-lockup-dark.svg" alt="" aria-hidden="true" data-no-fallback onerror="this.onerror=null;this.remove()"></div><div class="spinner"></div></div>`;
  await cloud.init();
  cloud.onAuth(()=>{ coachTab = null; ptData = EMPTY_PT(); refreshCoachData(true); renderAccountCard(); });
  if(!state.authDone){ showAuth("welcome"); return; }
  if(cloud.isLoggedIn() && !(cloud.profile && cloud.profile.mainRole)){ showAuth("role"); return; }
  finishBoot();
  await fkYield();                 // QU-02: Trang chủ đã vẽ → nhường luồng (trình duyệt vẽ khung đầu, nhận chạm) rồi mới đồng bộ
  refreshCoachData(true);
  fkIdle(()=> nativeNotif.syncSoon(), 3000);
}
appBoot();
