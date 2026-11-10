/* =========================================================================
   FIT KIT v2 — Khởi động app, Đăng nhập / Vai trò, Trang chủ, Tài khoản,
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
saveState = function(){ _saveStateV1(); nativeNotif.syncSoon(); };

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
  const back = `<button class="icon-btn" data-auth="welcome" style="margin-bottom:6px;"><span class="material-symbols-rounded">arrow_back</span></button>`;

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
        <div class="wl-hero-bg" style="background-image:url('${IMG.heroWorkout3}')"></div>
        <div class="wl-hero-shade"></div>
        <div class="wl-speed"><i></i><i></i><i></i><i></i><i></i></div>
        <nav class="wl-nav">
          <div class="wl-brand wl-in-left">FIT<b>KIT</b></div>
          <button class="wl-burger wl-in-right" id="wl-menu-btn" aria-label="Menu"><i></i><i></i><i></i></button>
        </nav>
        <div class="wl-hero-body">
          <h1 class="wl-head">
            <span class="l1">Tập đúng</span>
            <span class="l2">Tiến bộ</span>
            <span class="l3">Thật sự</span>
          </h1>
          <p class="wl-sub">Giáo án cá nhân, dinh dưỡng, giấc ngủ và kết nối PT ↔ học viên — trong một app.</p>
          <button class="wl-cta" id="wl-start" aria-label="Bắt đầu ngay">
            <svg viewBox="0 0 264 64" aria-hidden="true">
              <rect x="0" y="0" width="264" height="64" rx="32" fill="#FF7A45"/>
              <circle cx="232" cy="32" r="26" fill="#061A24"/>
              <g class="wl-arrow" transform-origin="232 32"><path d="M220 32 H244 M236 24 L244 32 L236 40" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
            </svg>
            <span>Bắt đầu ngay</span>
          </button>
          <button class="wl-link" data-auth="login">Đã có tài khoản? <b>Đăng nhập</b></button>
        </div>
        <div class="wl-scroll-cue"><span></span></div>
      </section>

      <!-- 2. GIỚI THIỆU -->
      <section class="wl-info">
        <div class="wl-rev wl-from-left">
          <div class="wl-tag">FIT KIT</div>
          <div class="wl-tag-sub">luyện tập có khoa học<br>đồng hành cùng PT</div>
        </div>
        <div class="wl-map wl-rev">
          <svg viewBox="0 0 300 160" class="wl-routes" aria-hidden="true">
            ${routes.map((d,i)=>`<path id="wlr${i}" d="${d}" class="wl-route" style="--i:${i}"/>`).join("")}
            ${routes.map((d,i)=>`<polygon points="0,-4 8,0 0,4" class="wl-runner"><animateMotion dur="${3.2+i*0.4}s" repeatCount="indefinite" rotate="auto" begin="${1.2+i*0.3}s"><mpath href="#wlr${i}"/></animateMotion></polygon>`).join("")}
            ${stops.map(([x,y,t],i)=>`<g class="wl-stop" style="--i:${i}"><circle cx="${x}" cy="${y}" r="8" fill="#5EE6C7"/><circle cx="${x}" cy="${y}" r="3" fill="#061A24"/><text x="${x}" y="${y+ (y>100?20:-13)}" text-anchor="middle">${t}</text></g>`).join("")}
          </svg>
          <div class="wl-bubble" style="left:30%;top:46%;--d:2.6s"><span class="material-symbols-rounded">fitness_center</span></div>
          <div class="wl-bubble" style="left:63%;top:36%;--d:3.1s"><span class="material-symbols-rounded">restaurant</span></div>
          <div class="wl-bubble" style="left:6%;top:56%;--d:2.9s"><span class="material-symbols-rounded">bedtime</span></div>
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
          <button class="wl-pill gold wl-rev wl-from-bottom" style="--d:.05s" data-auth="signup">Tạo tài khoản</button>
          <button class="wl-pill ghost wl-rev wl-from-bottom" style="--d:.12s" data-auth="login">Đăng nhập</button>
          <button class="wl-pill ghost wl-rev wl-from-bottom" style="--d:.19s" id="auth-guest">Dùng ngay, không cần tài khoản</button>
        </div>
        ${demoNote}
        <div class="wl-foot">
          <div>
            <a class="wl-foot-link" id="wl-privacy">Chính sách bảo mật</a>
            <a class="wl-foot-link" id="wl-credits">Nguồn dữ liệu &amp; bản quyền</a>
          </div>
          <button class="wl-round" id="wl-top" aria-label="Lên đầu trang"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="#061A24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <p class="wl-copy">© 2026 FIT KIT. All rights reserved.</p>
      </section>

      <div class="wl-menu" id="wl-menu">
        <button class="wl-menu-close" id="wl-menu-close" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button>
        <button data-auth="signup" style="--i:0">Tạo tài khoản</button>
        <button data-auth="login" style="--i:1">Đăng nhập</button>
        <button id="wl-menu-guest" style="--i:2">Dùng ngay</button>
        <button id="wl-menu-privacy" style="--i:3">Chính sách bảo mật</button>
      </div>
    </div>`;
    const guest = ()=>{ state.authDone = true; saveState(); finishBoot(); };
    $("#auth-guest").addEventListener("click", guest);
    $("#wl-menu-guest").addEventListener("click", guest);
    $("#wl-start").addEventListener("click", ()=> showAuth("signup"));
    $("#wl-menu-btn").addEventListener("click", ()=>{ $("#auth").scrollTop = 0; $("#wl-menu").classList.add("open"); });
    $("#wl-menu-close").addEventListener("click", ()=> $("#wl-menu").classList.remove("open"));
    $("#wl-menu-privacy").addEventListener("click", ()=>{ $("#wl-menu").classList.remove("open"); openPrivacySheet(); });
    $("#wl-privacy").addEventListener("click", openPrivacySheet);
    $("#wl-credits").addEventListener("click", openCreditsSheet);
    $("#wl-top").addEventListener("click", ()=> $("#auth").scrollTo({ top:0, behavior:"smooth" }));
    // Hiệu ứng xuất hiện khi cuộn tới (chạy 1 lần), có hẹn giờ an toàn
    const reveal = ()=>{
      const box = $("#auth"); if(!box) return;
      const h = box.clientHeight;
      $$("#wl .wl-rev:not(.in)").forEach(el=>{
        const r = el.getBoundingClientRect(), top = r.top - box.getBoundingClientRect().top;
        if(top < h - 50){ el.classList.add("in"); setTimeout(()=> el.classList.add("done"), 2000); }
      });
    };
    $("#auth").onscroll = ()=> requestAnimationFrame(reveal);
    $("#auth").scrollTop = 0;
    setTimeout(reveal, 60);
    setTimeout(()=>{ const w=$("#wl"); if(w) w.classList.add("ready"); }, 30);
    if(typeof mountWelcomeVideo==="function") mountWelcomeVideo();
  }

  else if(view==="login"){
    body.innerHTML = `<div class="auth-form">${back}
      <h2 class="onboard-hero">Đăng nhập</h2>
      <p class="onboard-sub">Chào mừng bạn quay lại FIT KIT.</p>
      <div class="auth-social">
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
      <p class="onboard-sub">Nhập email đã đăng ký, FIT KIT sẽ gửi link đặt lại mật khẩu.</p>
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
      <p class="onboard-sub">Bạn dùng FIT KIT để làm gì? (Đổi lại được trong Hồ sơ)</p>
      ${roles.map(r=>`
        <div class="role-card ${r.soon?'soon':''}" data-role="${r.id}">
          <span class="material-symbols-rounded">${r.icon}</span>
          <div><div class="name">${r.title}${r.soon?' <span class="soon-badge">Sắp ra mắt</span>':''}</div><div class="sub">${r.desc}</div></div>
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
function hideAuth(){ $("#auth").classList.remove("open"); }

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
  }
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
  recomputeProfile(); saveState();
  renderAll();
  if(target==="coach_if_open"){ const cur = $(".screen.active"); target = cur && cur.id==="screen-coach" ? "coach" : (state._pendingJoin ? "coach" : "home"); }
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

function renderHomeScreen(){
  const el = $("#home-content"); if(!el) return;
  const p = state.profile;
  const now = new Date();
  const dk = todayDayKey(), plan = getActivePlan(), day = plan && plan.days[dk];
  const log = state.workoutLog[todayStr()];
  const doneCount = log ? (log.completedExerciseIds||[]).length : 0;
  const finished = state.finishedDates.includes(todayStr());
  const dayPct = day && day.items.length ? (finished ? 1 : doneCount/day.items.length) : 0;

  const food = getDayFoodLog(); let kcal = 0; Object.values(food).forEach(l=> l.forEach(i=> kcal += i.kcal));
  const water = state.waterLog[todayStr()] || 0;
  const waterGoal = p.waterTargetOverride != null ? p.waterTargetOverride : fmt1((p.weight||65) * 0.035);
  const sl = state.sleepLog[todayStr()] || state.sleepLog[dateStrOffset(-1)];
  const sleepGoal = p.sleepGoalHours || 8;
  const streak = calcStreak();

  // Dải 7 ngày (Thứ 2 → Chủ nhật tuần này)
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  const week = Array.from({length:7}, (_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); const ds=todayStr(d);
    const k = todayDayKey(d), pd = plan && plan.days[k];
    return { ds, k, n:d.getDate(), done: state.finishedDates.includes(ds), rest: !(pd && pd.items.length), today: ds===todayStr(), past: ds<todayStr() }; });
  const weekDone = week.filter(w=>w.done).length, weekPlanned = week.filter(w=>!w.rest).length;

  const ptSoon = [...(state.coachUpcoming||[])].filter(u=> sessStart(u) > new Date(now.getTime()-2*3600000)).slice(0,3);
  const events = nextReminderEvents(3);
  const isPT = !!(cloud.profile && cloud.profile.isPT);
  const first = escapeHtml((p.name||(cloud.user&&cloud.user.name)||"bạn").trim().split(" ").slice(-1)[0]);
  const hour = now.getHours();
  const hello = hour<11 ? "Chào buổi sáng" : hour<14 ? "Chào buổi trưa" : hour<18 ? "Chào buổi chiều" : "Chào buổi tối";

  el.innerHTML = `
    <div class="home-greet">
      <div>
        <div class="small-note" style="text-transform:uppercase;letter-spacing:1px;">${now.getDay()===0?"Chủ nhật":"Thứ "+(now.getDay()+1)}, ${pad2(now.getDate())}/${pad2(now.getMonth()+1)}</div>
        <h2 style="font-size:28px;margin-top:4px;">${hello},<br><span style="color:rgba(255,255,255,.72)">${first}</span></h2>
      </div>
      <div class="streak-chip" onclick="goto('workout')"><span class="material-symbols-rounded">local_fire_department</span><b>${streak}</b><small>ngày</small></div>
    </div>

    <div class="week-strip">
      ${week.map(w=>`<div class="wd ${w.today?'today':''} ${w.done?'done':''} ${w.rest?'rest':''} ${w.past&&!w.done&&!w.rest?'miss':''}">
        <small>${w.k==="CN"?"CN":w.k}</small><b>${w.n}</b><i>${w.done?'<span class="material-symbols-rounded">check</span>':''}</i></div>`).join("")}
    </div>
    <p class="small-note" style="margin:-4px 2px 2px;">Tuần này: <b style="color:var(--text)">${weekDone}/${weekPlanned}</b> buổi đã tập</p>

    <div class="home-hero" style="background-image:url('${IMG.heroWorkout1}')">
      <div class="home-hero-body">
        <div class="hero-eyebrow">Buổi hôm nay · ${DAY_LABELS[dk]}</div>
        ${day && day.items.length ? `
          <div class="headline" style="font-size:26px;line-height:1.05;">${escapeHtml(day.title)}</div>
          <div class="hero-meta">
            <span><span class="material-symbols-rounded">fitness_center</span>${day.items.length} bài</span>
            <span><span class="material-symbols-rounded">schedule</span>~${day.duration||30} phút</span>
            <span><span class="material-symbols-rounded">bolt</span>${day.intensity||"Vừa"}</span>
          </div>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="goto('workout')"><span class="material-symbols-rounded">play_arrow</span>${finished?"Xem lại buổi tập":doneCount?"Tập tiếp":"Bắt đầu tập"}</button>
        ` : `
          <div class="headline" style="font-size:26px;">Ngày nghỉ ngơi</div>
          <div class="small-note" style="margin-top:6px;max-width:80%;">Phục hồi cũng là tập luyện. Đi bộ nhẹ, giãn cơ, ngủ đủ giấc.</div>
          <button class="btn btn-outline" style="margin-top:14px;" onclick="goto('workout')">Xem lịch tuần</button>
        `}
      </div>
      ${day && day.items.length ? `<div class="home-hero-ring">${ringSVG(dayPct, 78, 8, "#fff")}<div><b>${Math.round(dayPct*100)}%</b><small>${doneCount}/${day.items.length}</small></div></div>` : ""}
    </div>

    <div class="metric-grid">
      <div class="metric" onclick="goto('nutrition')">
        <div class="metric-ring">${ringSVG(p.goalKcal? kcal/p.goalKcal:0, 52, 6, "#FF7A45")}<span class="material-symbols-rounded">local_fire_department</span></div>
        <b>${Math.round(kcal)}</b><small>/ ${p.goalKcal||0} kcal</small>
      </div>
      <div class="metric" onclick="goto('nutrition')">
        <div class="metric-ring">${ringSVG(waterGoal? water/waterGoal:0, 52, 6, "#5EE6C7")}<span class="material-symbols-rounded" style="color:#9AF1DD">water_drop</span></div>
        <b>${fmt1(water)}L</b><small>/ ${waterGoal}L nước</small>
      </div>
      <div class="metric" onclick="goto('sleep')">
        <div class="metric-ring">${ringSVG(sl? sl.hours/sleepGoal:0, 52, 6, "#9AF1DD")}<span class="material-symbols-rounded" style="color:#9AF1DD">bedtime</span></div>
        <b>${sl ? fmt1(sl.hours)+"h" : "--"}</b><small>/ ${sleepGoal}h ngủ</small>
      </div>
    </div>

    ${ptSoon.length ? `
    <div class="section-title"><h3>Buổi với PT</h3><a onclick="goto('coach')">Xem tất cả</a></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ptSoon.map(u=>`
        <div class="list-item" style="cursor:pointer;" onclick="openClientForm('${u.cid}','${u.role}','today')">
          <div class="date-chip"><b>${u.time}</b><small>${relDay(u.date)}</small></div>
          <div class="info"><div class="name">${escapeHtml(u.title||"Buổi tập")}</div><div class="meta">${u.role==="pt"?"Học viên":"PT"}: ${escapeHtml(u.who)} · ${u.mode==="online"?"Online":"Tại phòng tập"}</div></div>
          <span class="material-symbols-rounded" style="color:var(--text-dim);font-size:18px;">chevron_right</span>
        </div>`).join("")}
    </div>` : ""}

    <div class="section-title"><h3>Bạn muốn làm gì?</h3></div>
    <div class="entry-grid">
      <div class="entry-tile" onclick="goto('workout')"><span class="ic" style="--c:#FF7A45"><span class="material-symbols-rounded">fitness_center</span></span><b>Tập cá nhân</b><small>Giáo án &amp; lịch tập</small></div>
      <div class="entry-tile" onclick="goto('coach')"><span class="ic" style="--c:#5EE6C7"><span class="material-symbols-rounded">groups</span></span><b>${isPT ? "Tôi là PT" : "PT của tôi"}</b><small>${isPT ? "Quản lý học viên" : "Nhập mã PT"}</small></div>
      <div class="entry-tile" onclick="openFindPTSoon()"><span class="ic" style="--c:#FFB08A"><span class="material-symbols-rounded">travel_explore</span></span><b>Tìm PT</b><small class="soon-badge">Sắp ra mắt</small></div>
    </div>
    <div class="quick-row">
      <button onclick="openTemplateBrowser()"><span class="material-symbols-rounded">school</span>Giáo án mẫu</button>
      <button onclick="goto('progress')"><span class="material-symbols-rounded">insights</span>Tiến độ</button>
      <button onclick="openExLib()"><span class="material-symbols-rounded">library_books</span>Bài tập</button>
      <button onclick="goto('sleep')"><span class="material-symbols-rounded">bedtime</span>Giấc ngủ</button>
    </div>

    <div class="card">
      <div class="card-title" style="justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded">notifications_active</span>Nhắc nhở tiếp theo</span>
        <a onclick="goto('reminders')" style="font-size:11px;color:var(--primary-soft);text-transform:uppercase;font-weight:700;">Cài đặt</a>
      </div>
      ${events.length ? events.map(e=>`
        <div class="link-row"><div class="left"><span class="material-symbols-rounded">${e.icon}</span><div><div class="name">${escapeHtml(e.text)}</div><div class="sub">${hhmm(e.at)} · ${relDay(todayStr(e.at))}</div></div></div></div>
      `).join("") : `<p class="small-note">${state.reminders.master ? "Chưa có nhắc nhở nào trong 7 ngày tới." : "Nhắc nhở đang tắt — bật để FIT KIT nhắc giờ tập, giờ ăn, giờ ngủ."}</p>
        ${state.reminders.master ? "" : `<button class="btn btn-soft btn-sm" style="margin-top:10px;" onclick="goto('reminders')">Bật nhắc nhở</button>`}`}
    </div>
  `;
}

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
      <p class="small-note">Bạn đang dùng FIT KIT không cần tài khoản. Đăng nhập để kết nối với PT hoặc quản lý học viên.</p>
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
    <p class="small-note" style="text-align:center;margin-top:8px;">FIT KIT v${APP_VERSION}</p>
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
    <p class="small-note">Thao tác này <b>không thể hoàn tác</b>. FIT KIT sẽ xoá vĩnh viễn:</p>
    <ul style="padding-left:18px;margin:8px 0;font-size:13px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
      <li>Tài khoản đăng nhập và hồ sơ của bạn trên máy chủ</li>
      <li>Toàn bộ form học viên bạn tạo (nếu là PT), kèm buổi tập và ghi chú</li>
      <li>Liên kết của bạn với PT (nếu là học viên)</li>
    </ul>
    <p class="small-note">Dữ liệu tập cá nhân trên máy này vẫn giữ — xoá bằng "Đặt lại toàn bộ dữ liệu" nếu muốn.</p>
    ${cloud.isSocialUser ? `<p class="small-note" style="margin-top:12px;">Bạn đăng nhập bằng ${cloud.profile.provider==="facebook"?"Facebook":"Google"} — app sẽ hỏi xác nhận lại tài khoản đó.</p>` : `<div class="field" style="margin-top:12px;"><label>Nhập mật khẩu để xác nhận</label><input type="password" id="del-pw" placeholder="••••••"></div>`}
    <p class="auth-err" id="del-err"></p>
    <button class="btn btn-primary btn-block" id="del-go" style="margin-top:10px;">Xoá vĩnh viễn tài khoản</button>
  `);
  $("#del-go").addEventListener("click", async ()=>{
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
      if(b.dataset.social==="google") await cloud.signInWithGoogle(); else await cloud.signInWithFacebook();
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
      <p><b>Dữ liệu lưu trên máy bạn:</b> hồ sơ cơ thể, giáo án, nhật ký ăn uống, giấc ngủ, video và ảnh tiến trình. Không gửi lên máy chủ FIT KIT.</p>
      <p><b>Dữ liệu lưu trên máy chủ (chỉ khi bạn tạo tài khoản):</b> email, tên hiển thị, và nội dung form PT ↔ học viên (lịch buổi tập, bài tập được giao, ghi chú, phản hồi). Chỉ PT và học viên của chính form đó xem được.</p>
      <p><b>Video minh hoạ:</b> khi bạn tìm video, từ khoá tìm kiếm (tên bài tập) được gửi tới Pexels/Pixabay để lấy danh sách video. Không gửi thông tin cá nhân.</p>
      <p><b>Phân tích ảnh bằng AI:</b> chỉ chạy khi bạn tự nhập API key của nhà cung cấp AI. Ảnh được gửi thẳng từ máy bạn tới nhà cung cấp đó.</p>
      <p><b>Không quảng cáo, không bán dữ liệu.</b> FIT KIT không chia sẻ dữ liệu của bạn cho bên thứ ba để quảng cáo.</p>
      <p><b>Xoá dữ liệu:</b> Hồ sơ → Tài khoản → Xoá tài khoản (xoá dữ liệu trên máy chủ); Hồ sơ → Đặt lại toàn bộ dữ liệu (xoá dữ liệu trên máy).</p>
      <p><b>Lưu ý sức khoẻ:</b> số liệu calo, BMR, TDEE chỉ mang tính ước lượng, không thay thế tư vấn y tế.</p>
    </div>
  `);
}

function openCreditsSheet(){
  openSheet(`
    <div class="sheet-header"><h3>Nguồn dữ liệu &amp; bản quyền</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="policy-text">
      <p><b>Thư viện 800+ bài tập:</b> free-exercise-db của yuhonas (github.com/yuhonas/free-exercise-db), giấy phép Unlicense (Public Domain).</p>
      <p><b>Ảnh minh hoạ:</b> Pexels (pexels.com), theo Pexels License — dùng thương mại miễn phí.</p>
      <p><b>Video hướng dẫn bài tập:</b> Exercise video by Your Move (ymove.app/exercise-api) — 25 video miễn phí, dùng thương mại có ghi nguồn. Video từ wger.de (tác giả ghi dưới mỗi video), giấy phép CC BY-SA 4.0, FIT KIT đã nén lại; bản nén phát hành cùng giấy phép CC BY-SA 4.0.</p>
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
async function appBoot(){
  if("serviceWorker" in navigator && !isNative()) navigator.serviceWorker.register("sw.js").catch(()=>{});
  state.selectedDay = todayDayKey();
  ensureReminderDefaults();
  ensurePlans();
  $("#auth").classList.add("open");
  $("#auth-body").innerHTML = `<div class="splash"><div class="logo-big">FIT KIT</div><div class="spinner"></div></div>`;
  await cloud.init();
  cloud.onAuth(()=>{ coachTab = null; ptData = EMPTY_PT(); refreshCoachData(true); renderAccountCard(); });
  if(!state.authDone){ showAuth("welcome"); return; }
  if(cloud.isLoggedIn() && !(cloud.profile && cloud.profile.mainRole)){ showAuth("role"); return; }
  finishBoot();
  refreshCoachData(true);
  nativeNotif.syncSoon();
}
appBoot();
