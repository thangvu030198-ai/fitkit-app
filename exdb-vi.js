/* =========================================================================
   TapEasy — Việt hoá thư viện 800+ bài tập (free-exercise-db)
   - Dữ liệu dịch: exdb-vi-1.js, exdb-vi-2.js, exdb-vi-3.js
       EXDB_VI["<id>"] = { n: "Tên tiếng Việt (English)", g: "Hướng dẫn tiếng Việt" }
   - File này: ghi đè các hàm hiển thị của exdb.js / library.js để
       • hiện tên Việt (kèm tên gốc tiếng Anh ở dòng phụ),
       • hiện hướng dẫn Việt (bản gốc tiếng Anh vẫn xem được, bấm để mở),
       • tìm kiếm khớp tên Việt có dấu / KHÔNG dấu, tên Anh, id, nhóm cơ, dụng cụ,
         và vài cách gọi quen thuộc ở phòng gym (hít đất, hít xà, tạ tay, gánh…).
   - Không đổi id / dữ liệu gốc → video (video.js, freevideos.js) vẫn tìm theo tên Anh.
   Nạp SAU pt.js (thứ tự với exdb-vi-*.js không quan trọng).
   - Nạp lười (fkLazy, HANDOFF vòng 2): dữ liệu exdb-vi-1..3.js (và cả file này) có thể nạp sau qua fkLazy.load('exdbvi').
       • Mọi chỗ cần EXDB_VI chờ viReady() (= exdbViReady() của exdb.js → fkLazy.load('exdbvi'); chưa có fkLazy → xong ngay).
       • Khoá tìm kiếm (_keyCache) tự làm mới khi số bản dịch thay đổi (dữ liệu tới muộn).
       • File này nạp muộn (sau khi Thư viện đã dựng) → tự dựng lại phần 800+ bài (mục 6) và vẽ lại màn đang mở (mục 8).
   ========================================================================= */
var EXDB_VI = window.EXDB_VI = window.EXDB_VI || {};

(function(){
  "use strict";
  const has = name => typeof window[name] === "function";
  /* fkLazy: chờ dữ liệu exdb-vi-1..3.js — await (window.fkLazy ? fkLazy.load('exdbvi') : Promise.resolve()) */
  const viReady = () => (typeof exdbViReady === "function") ? exdbViReady()
    : ((window.fkLazy && typeof window.fkLazy.load === "function") ? window.fkLazy.load('exdbvi') : Promise.resolve());
  const viCount = () => { try{ return Object.keys(EXDB_VI).length; }catch(e){ return 0; } };

  /* ---------- 1. Tiện ích chuỗi ---------- */
  function viFold(s){
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  const VI_MARK = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const isAscii = s => /^[\x20-\x7E]*$/.test(s);

  /* Cách gọi quen ở phòng gym → từ dùng trong tên bài (đã bỏ dấu) */
  const VI_ALIAS = [
    [/\bhit dat\b/g, "chong day"], [/\bhit xa\b/g, "keo xa"], [/\bxa don\b/g, "keo xa"],
    [/\bta tay\b/g, "dumbbell"], [/\bta dia\b/g, "dia ta"], [/\bganh ta\b/g, "squat"], [/\bganh dui\b/g, "squat"], [/\bganh\b/g, "squat"],
    [/\bdung len ngoi xuong\b/g, "squat"], [/\bbap tay sau\b/g, "tay sau"], [/\bbap tay truoc\b/g, "tay truoc"], [/\bbap tay\b/g, "tay truoc"],
    [/\bday dui\b/g, "dap dui"], [/\bchay bo\b/g, "chay"], [/\blung xo\b/g, "xo"], [/\bcuon ta\b/g, "cuon"], [/\bcuon tay\b/g, "cuon"],
    [/\bbung duoi\b/g, "gap bung nguoc"], [/\bbay nguc\b/g, "ep nguc"], [/\bvai giua\b/g, "dang tay sang ngang"],
  ];
  function foldQuery(q){
    let s = viFold(q);
    VI_ALIAS.forEach(([re, rep]) => { s = s.replace(re, rep); });
    return s.replace(/\s+/g, " ").trim();
  }

  /* ---------- 2. Tra cứu bản Việt ---------- */
  function viOf(ex){ return (ex && EXDB_VI[ex.id]) || null; }
  function viName(ex){ const v = viOf(ex); return (v && v.n) || (ex && ex.name) || ""; }
  function viGuide(ex){ const v = viOf(ex); return (v && v.g) || ""; }
  /* Tên lưu vào giáo án: "Tên Việt (English gốc)" — giữ tiếng Anh để video.js/freevideos.js
     vẫn tìm đúng video, đồng nhất với quy ước tên bài chuẩn TapEasy. */
  function viStoredName(ex){
    const v = viOf(ex); if(!v || !v.n) return ex.name;
    const n = v.n, en = ex.name;
    const m = n.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const base = m ? m[1].trim() : n, paren = m ? m[2] : "";
    if(viFold(base) === viFold(en)) return paren && !isAscii(paren) ? n : en;
    if(m && !isAscii(paren)) return `${base} – ${paren} (${en})`;
    return `${base} (${en})`;
  }
  function viSteps(text){
    const parts = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    return parts.map(s => s.trim()).filter(Boolean);
  }

  /* ---------- 3. Tìm kiếm có xếp hạng ---------- */
  let _keyCache = new WeakMap(), _keyN = -1;
  /* Dữ liệu dịch nạp lười tới sau khi đã tính khoá (tên Anh) → bỏ khoá cũ. Gọi 1 lần mỗi lượt tìm (viRank / bảng chọn bài). */
  function keyFresh(){ const n = viCount(); if(n !== _keyN){ _keyCache = new WeakMap(); _keyN = n; } }
  function searchKeyOf(ex){
    let k = _keyCache.get(ex); if(k) return k;
    const muscleVi = (typeof exdbMuscleVi === "function") ? exdbMuscleVi(ex) : "";
    const eqVi = (typeof EXDB_EQUIP_VI !== "undefined" && EXDB_EQUIP_VI[ex.equipment]) || "";
    const vi = viFold(viName(ex)), en = viFold(ex.name);
    const all = [vi, en, viFold(String(ex.id || "").replace(/_/g, " ")), viFold(muscleVi), viFold(eqVi),
      viFold(ex.equipment || ""), viFold((ex.primaryMuscles || []).join(" ")), viFold(ex.category || "")].join(" ");
    k = { vi, en, all, compact: all.replace(/ /g, "") };
    _keyCache.set(ex, k); return k;
  }
  function itemKeyOf(x){
    if(x && x.ex) return searchKeyOf(x.ex);
    let k = _keyCache.get(x); if(k) return k;
    const vi = viFold(x.name), all = [vi, viFold(x.sub), viFold(x.muscleVi), viFold(x.equip)].join(" ");
    k = { vi, en: vi, all, compact: all.replace(/ /g, "") };
    _keyCache.set(x, k); return k;
  }
  /* Điểm khớp (0 = không khớp). So khớp theo ĐẦU TỪ (gõ "ta" không dính "tay").
     Cụm từ ở đầu tên > cụm từ trong tên > đủ mọi từ trong tên > đủ mọi từ trong khoá phụ. */
  const wordHas = (s, t) => (" " + s).includes(" " + t);
  function scoreKey(k, q){
    if(!q) return 1;
    const toks = q.split(" ").filter(Boolean);
    const inAll = s => toks.every(t => wordHas(s, t));
    let s = 0;
    if(k.vi.startsWith(q)) s = 100; else if(wordHas(k.vi, q)) s = 85;
    if(k.en.startsWith(q)) s = Math.max(s, 95); else if(wordHas(k.en, q)) s = Math.max(s, 85);
    if(!s && inAll(k.vi)) s = 60;
    if(!s && inAll(k.en)) s = 55;
    if(!s && inAll(k.all)) s = 30;
    if(!s && q.length >= 4 && k.compact.includes(q.replace(/ /g, ""))) s = 20;   // "pushup" ↔ "push up"
    return s;
  }
  /* Bài phổ biến được đẩy lên đầu khi điểm khớp ngang nhau */
  const POPULAR = new Set(["Barbell_Bench_Press_-_Medium_Grip","Dumbbell_Bench_Press","Incline_Dumbbell_Press","Barbell_Incline_Bench_Press_-_Medium_Grip",
    "Pushups","Pullups","Chin-Up","Barbell_Squat","Barbell_Full_Squat","Goblet_Squat","Bodyweight_Squat","Barbell_Deadlift","Romanian_Deadlift","Sumo_Deadlift",
    "Wide-Grip_Lat_Pulldown","Seated_Cable_Rows","Bent_Over_Barbell_Row","One-Arm_Dumbbell_Row","Dumbbell_Shoulder_Press","Standing_Military_Press",
    "Side_Lateral_Raise","Face_Pull","Barbell_Curl","Dumbbell_Bicep_Curl","Hammer_Curls","Triceps_Pushdown","Triceps_Pushdown_-_Rope_Attachment",
    "Dips_-_Triceps_Version","Leg_Press","Leg_Extensions","Lying_Leg_Curls","Seated_Leg_Curl","Barbell_Hip_Thrust","Butt_Lift_Bridge","Plank","Crunches",
    "Hanging_Leg_Raise","Standing_Calf_Raises","Dumbbell_Lunges","Split_Squat_with_Dumbbells","Cable_Crossover","Dumbbell_Flyes","Butterfly",
    "EZ-Bar_Skullcrusher","Russian_Twist","Mountain_Climbers","Rope_Jumping","One-Arm_Kettlebell_Swings","Hack_Squat","Front_Barbell_Squat"]);
  function bonusOf(x, rawLower){
    const ex = x && (x.ex || (x.id && x.instructions ? x : null));
    let b = 0;
    if(ex && POPULAR.has(ex.id)) b += 12;
    if(ex && viGuide(ex)) b += 3;
    if(x && x.src === "fitkit") b += 16;                 // bài chuẩn TapEasy (đã Việt hoá, có video) lên trước
    // Gõ có dấu (VD "tạ đơn") → ưu tiên tên khớp đúng dấu, phân biệt "tạ đơn" / "tạ đòn"
    if(rawLower && VI_MARK.test(rawLower)){
      const nm = String(ex ? viName(ex) : (x && x.name) || "").normalize("NFC").toLowerCase();
      if(nm.includes(rawLower)) b += 15;
    }
    return b;
  }
  const LV = { beginner:0, intermediate:1, expert:2 };
  const lv = x => (x && LV[x.level] != null) ? LV[x.level] : 1;
  const dispName = x => String((x && x.instructions && !x.ex) ? viName(x) : (x && x.name) || "");
  function viRank(list, rawQ, keyFn){
    const q = foldQuery(rawQ);
    if(!q) return list.slice();
    keyFresh();
    const rawLower = String(rawQ || "").normalize("NFC").toLowerCase().trim();
    return list.map(x => { const s = scoreKey(keyFn(x), q); return { x, s: s ? s + bonusOf(x, rawLower) : 0 }; }).filter(o => o.s > 0)
      .sort((a, b) => (b.s - a.s)
        || ((a.x.src === "fitkit" ? 0 : 1) - (b.x.src === "fitkit" ? 0 : 1))
        || (lv(a.x) - lv(b.x))
        || (dispName(a.x).length - dispName(b.x).length))
      .map(o => o.x);
  }

  /* ---------- 4. Khung "Hướng dẫn" trong sheet chi tiết ---------- */
  function guideHTML(ex){
    const g = viGuide(ex), en = ex.instructions || [];
    const enBox = en.length ? `
      <details class="exvi-en" style="margin-top:8px;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:0 12px;">
        <summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:13px;color:var(--text-dim);">Xem bản gốc tiếng Anh</summary>
        <ol style="padding:0 0 10px 18px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--text-muted);">${en.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      </details>` : "";
    if(!g) return null;
    return `<div class="card-title exvi-title" style="font-size:13px;margin-top:14px;">Hướng dẫn kỹ thuật</div>
      <ol class="ld-steps exvi-steps" style="padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--text-muted);line-height:1.55;">
        ${viSteps(g).map(s => `<li>${escapeHtml(s)}</li>`).join("")}
      </ol>${enBox}
      <p class="small-note" style="margin-top:6px;font-size:12px;">Dừng ngay nếu đau nhói ở khớp. Người mới nên tập với tạ nhẹ và có người hướng dẫn.</p>`;
  }
  /* Sửa sheet vừa mở (của exdb.js hoặc library.js): tiêu đề Việt + hướng dẫn Việt */
  function patchDetailSheet(ex){
    const root = document.getElementById("sheet-content"); if(!root || !ex) return;
    const v = viOf(ex); if(!v) return;
    const h3 = root.querySelector(".sheet-header h3");
    if(h3 && v.n){
      h3.textContent = v.n;
      if(!root.querySelector(".exvi-en-name")){
        const sub = document.createElement("div");
        sub.className = "small-note exvi-en-name";
        sub.style.cssText = "margin:-4px 0 8px;font-size:12px;opacity:.75;";
        sub.textContent = ex.name;
        h3.closest(".sheet-header").insertAdjacentElement("afterend", sub);
      }
    }
    const title = Array.from(root.querySelectorAll(".card-title")).find(el => /tiếng Anh/i.test(el.textContent));
    if(!title) return;
    const ol = title.nextElementSibling && title.nextElementSibling.tagName === "OL" ? title.nextElementSibling : null;
    const html = guideHTML(ex);
    if(!html){ title.textContent = "Hướng dẫn (tiếng Anh — đang được Việt hoá)"; return; }
    const wrap = document.createElement("div"); wrap.className = "exvi-guide"; wrap.innerHTML = html;
    title.replaceWith(wrap);
    if(ol) ol.remove();
  }

  /* ---------- 5. Ghi đè exdb.js ---------- */
  if(has("exdbToItem")){
    const _exdbToItem = exdbToItem;
    exdbToItem = function(ex){
      const it = _exdbToItem.apply(this, arguments);
      try{
        const v = viOf(ex);
        if(v && v.n) it.name = viStoredName(ex);
        if(v && v.g) it.guide = v.g;
      }catch(e){ console.warn("[exdb-vi] exdbToItem", e); }
      return it;
    };
  }

  if(has("openExDbDetail")){
    const _openExDbDetail = openExDbDetail;          // đã gồm lớp video của video.js
    openExDbDetail = function(ex, onBack){
      const r = _openExDbDetail.apply(this, arguments);
      try{ patchDetailSheet(ex); }catch(e){ console.warn("[exdb-vi] openExDbDetail", e); }
      /* bản dịch chưa nạp (fkLazy) → nạp xong thì Việt hoá sheet nếu vẫn đang mở đúng bài này */
      if(ex && !viOf(ex) && !viCount()) viReady().then(() => {
        const h3 = document.querySelector("#sheet-content .sheet-header h3");
        if(h3 && h3.textContent === ex.name) try{ patchDetailSheet(ex); }catch(e){}
      }, () => {});
      return r;
    };
  }

  /* Bảng chọn bài (dùng ở: thêm bài vào giáo án, PT soạn buổi tập) — viết lại để tìm được tiếng Việt */
  if(has("openExDbPicker")){
    const _openExDbPickerOrig = openExDbPicker;
    openExDbPicker = function(onPick, opts){
      opts = opts || {};
      try{ return viOpenExDbPicker(onPick, opts); }
      catch(e){ console.warn("[exdb-vi] picker → bản gốc", e); return _openExDbPickerOrig(onPick, opts); }
    };
  }
  function viOpenExDbPicker(onPick, opts){
    let filter = opts._filter || "all", q = opts._q || "", picked = opts._picked || [];
    openSheet(`
      <div class="sheet-header"><h3>Thư viện 800+ bài tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
      <div class="search-box" style="margin-bottom:10px;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span><input type="text" id="exdb-q" value="${escapeHtml(q)}" placeholder="Tìm tên Việt hoặc Anh — VD: đẩy ngực, keo xa, curl" autocomplete="off"></div>
      <div class="chip-row" id="exdb-filters" style="flex-wrap:nowrap;overflow-x:auto;margin-bottom:10px;padding-bottom:4px;">
        ${EXDB_FILTERS.map(f => `<button class="pill ${f.id === filter ? "active" : ""}" data-exf="${f.id}" style="flex-shrink:0;">${f.label}</button>`).join("")}
      </div>
      <div id="exdb-list" style="max-height:48vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
        <p class="empty-hint">Đang tải thư viện bài tập...</p>
      </div>
      ${opts.multi ? `<button class="btn btn-primary btn-block" id="exdb-done" style="margin-top:12px;">Thêm ${picked.length} bài đã chọn</button>` : ""}
      <p class="small-note" style="margin-top:8px;text-align:center;">Dữ liệu: free-exercise-db (Public Domain) · Việt hoá: TapEasy</p>
    `);
    const renderList = (all) => {
      const box = $("#exdb-list"); if(!box) return;
      const base = all.filter(ex => exdbMatches(ex, filter));
      const rows = (q.trim() ? viRank(base, q, searchKeyOf) : base).slice(0, 80);
      box.innerHTML = rows.map(ex => {
        const sel = picked.some(p => p.exDbId === ex.id);
        const vn = viName(ex), showEn = vn !== ex.name;
        return `<div class="list-item" data-exdb="${escapeHtml(ex.id)}" style="cursor:pointer;${sel ? "border-color:var(--primary);" : ""}">
          <img class="thumb" src="${exdbImg(ex)}" loading="lazy" alt="" style="object-fit:cover;background:#fff;" onerror="this.style.visibility='hidden'">
          <div class="info"><div class="name">${escapeHtml(vn)}</div>
            <div class="meta">${escapeHtml(exdbMuscleVi(ex))} · ${escapeHtml(EXDB_EQUIP_VI[ex.equipment] || ex.equipment || "—")} · ${EXDB_LEVEL_VI[ex.level] || ""}</div>
            ${showEn ? `<div class="meta" style="opacity:.7;font-size:12px;">${escapeHtml(ex.name)}</div>` : ""}</div>
          <span class="material-symbols-rounded" data-exdb-info="${escapeHtml(ex.id)}" role="button" aria-label="Xem hướng dẫn" style="color:var(--text-dim);padding:10px;">info</span>
          <span class="material-symbols-rounded" style="color:${sel ? "var(--primary)" : "var(--text-dim)"};">${sel ? "check_circle" : "add_circle"}</span>
        </div>`;
      }).join("") || `<p class="empty-hint">Không tìm thấy bài phù hợp. Thử từ khác, VD: "nguc", "squat", "keo".</p>`;
      $$("[data-exdb-info]", box).forEach(el => el.addEventListener("click", (e) => {
        e.stopPropagation();
        const ex = all.find(x => x.id === el.dataset.exdbInfo);
        openExDbDetail(ex, () => openExDbPicker(onPick, Object.assign({}, opts, { _picked: picked, _filter: filter, _q: q })));
      }));
      $$("[data-exdb]", box).forEach(el => el.addEventListener("click", () => {
        const ex = all.find(x => x.id === el.dataset.exdb);
        const item = exdbToItem(ex);
        if(!opts.multi){ closeSheet(); onPick(item); return; }
        const i = picked.findIndex(p => p.exDbId === ex.id);
        if(i >= 0) picked.splice(i, 1); else picked.push(item);
        const done = $("#exdb-done"); if(done) done.textContent = `Thêm ${picked.length} bài đã chọn`;
        renderList(all);
      }));
    };
    /* fkLazy: chờ cả 800+ bài lẫn bản Việt hoá; bản Việt lỗi → vẫn chọn được (tên gốc) + nút "Thử lại" */
    let viFail = false;
    Promise.all([exdbLoad(), viReady().catch(e => { viFail = true; console.warn("[exdb-vi] exdbvi", e); })]).then(([all]) => {
      keyFresh();
      if(viFail){
        const lb = $("#exdb-list");
        if(lb) lb.insertAdjacentHTML("beforebegin", `<p class="small-note exdb-vi-err" role="status" style="margin:0 0 8px;">Chưa tải được tên tiếng Việt — đang hiện tên gốc. <button type="button" class="btn btn-outline btn-sm" id="exdb-vi-retry">Thử lại</button></p>`);
        const rb = $("#exdb-vi-retry");
        if(rb) rb.addEventListener("click", () => openExDbPicker(onPick, Object.assign({}, opts, { _picked: picked, _filter: filter, _q: q })));
      }
      renderList(all);
      const qi = $("#exdb-q"); let t;
      if(qi) qi.addEventListener("input", e => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => { q = v; renderList(all); }, 120); });
      $$("[data-exf]").forEach(b => b.addEventListener("click", () => {
        filter = b.dataset.exf; $$("[data-exf]").forEach(x => x.classList.toggle("active", x === b)); renderList(all);
      }));
      if(opts.multi){ const done = $("#exdb-done"); if(done) done.addEventListener("click", () => {
        if(!picked.length){ toast("Chưa chọn bài nào", "error"); return; }
        closeSheet(); onPick(picked);
      }); }
    }).catch(err => {
      const el = $("#exdb-list"); if(el) el.innerHTML = `<p class="empty-hint">${escapeHtml(err.message)}</p>`;
    });
  }

  /* ---------- 6. Ghi đè library.js (màn Thư viện theo nhóm cơ) ---------- */
  if(has("libExdbItem")){
    const _libExdbItem = libExdbItem;
    libExdbItem = function(ex){
      const it = _libExdbItem.apply(this, arguments);
      try{
        const v = viOf(ex);
        if(v && v.n){ it.nameEn = ex.name; it.name = v.n; it.sub = [ex.name, it.muscleVi].filter(Boolean).join(" · "); }
        if(v && v.g) it.guide = v.g;
      }catch(e){ console.warn("[exdb-vi] libExdbItem", e); }
      return it;
    };
    // Nếu thư viện đã được dựng trước khi file này nạp → dựng lại phần 800+ bài
    try{
      if(typeof _libAll !== "undefined" && _libAll && typeof _exdbCache !== "undefined" && Array.isArray(_exdbCache)){
        const db = _exdbCache.map(libExdbItem);
        _libAll.db = typeof libDedupe === "function" ? libDedupe(_libAll.builtin, db) : db;
        if(typeof _libGroupCache !== "undefined") _libGroupCache = {};
      }
    }catch(e){}
  }

  if(has("openLibDetail")){
    const _openLibDetail = openLibDetail;
    openLibDetail = function(key){
      const x = has("libFind") ? libFind(key) : null;
      if(!x || x.src !== "exdb" || !x.nameEn) return _openLibDetail.apply(this, arguments);
      const vn = x.name;
      x.name = x.nameEn;                              // video.js tìm video theo tên gốc tiếng Anh như trước
      let r;
      try{ r = _openLibDetail.apply(this, arguments); } finally { x.name = vn; }
      try{ patchDetailSheet(x.ex); }catch(e){ console.warn("[exdb-vi] openLibDetail", e); }
      return r;
    };
  }

  /* Danh sách khi tìm kiếm: chạy bản gốc rồi thay phần danh sách bằng kết quả xếp hạng (khớp không dấu) */
  function libRowHTML(x){
    return `<div class="list-item exlib-row" data-ex="${escapeHtml(x.key)}">
      ${x.img ? `<img class="thumb" src="${escapeHtml(x.img)}" loading="lazy" alt="" onerror="this.style.visibility='hidden'">` : `<div class="thumb ex-num"><span class="material-symbols-rounded">fitness_center</span></div>`}
      <div class="info"><div class="name">${escapeHtml(x.name)}</div><div class="meta">${escapeHtml(x.sub)}</div>
        <div class="exlib-tags">${x.src === "fitkit" ? `<span class="tg fk">Bài chuẩn</span>` : ""}<span class="tg">${EXDB_LEVEL_VI[x.level] || "Mới tập"}</span></div></div>
      <button class="nu-mini" data-add="${escapeHtml(x.key)}" aria-label="Thêm vào giáo án"><span class="material-symbols-rounded">add</span></button>
    </div>`;
  }
  function patchExLibSearch(){
    const el = document.getElementById("exlib-content"); if(!el || typeof exLib === "undefined") return;
    /* library.js (bản hiệu năng) đã tự xếp hạng qua exdbVi.rank + exdbVi.itemKeyOf và vẽ lười → không vẽ lại danh sách lần 2 */
    if(typeof libQueryList === "function") return;
    const qi = document.getElementById("exlib-q");
    if(qi && !exLib.group) qi.placeholder = "Tìm tên Việt/Anh: đẩy ngực, day nguc, squat…";
    const rawQ = String(exLib.q || "").trim();
    const listEl = el.querySelector(".exlib-list");
    if(!rawQ || !listEl) return;
    const g = (typeof MUSCLE_GROUPS_UI !== "undefined") ? MUSCLE_GROUPS_UI.find(m => m.id === exLib.group) : null;
    const list = viRank(libItems(exLib.group).filter(libFilterOk), rawQ, itemKeyOf);
    listEl.innerHTML = list.slice(0, exLib.limit).map(libRowHTML).join("")
      || `<p class="empty-hint">Không có bài phù hợp. Thử bỏ dấu hoặc dùng tên tiếng Anh (VD: "bench", "curl").</p>`;
    const note = listEl.previousElementSibling;
    if(note && note.classList.contains("small-note"))
      note.innerHTML = `${list.length} bài${g ? ` · nhóm ${escapeHtml(g.label.toLowerCase())}` : ""} · khớp "${escapeHtml(rawQ)}"`;
    const oldMore = document.getElementById("exlib-more"); if(oldMore) oldMore.remove();
    if(list.length > exLib.limit){
      const more = document.createElement("button");
      more.className = "btn btn-outline btn-block"; more.id = "exlib-more";
      more.textContent = `Xem thêm ${Math.min(40, list.length - exLib.limit)} bài`;
      more.addEventListener("click", () => { exLib.limit += 40; renderExLib(); });
      listEl.insertAdjacentElement("afterend", more);
    }
    $$("[data-ex]", listEl).forEach(r => r.addEventListener("click", e => { if(e.target.closest("[data-add]")) return; openLibDetail(r.dataset.ex); }));
    $$("[data-add]", listEl).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openAddToPlan(b.dataset.add); }));
  }
  if(has("renderExLib")){
    const _renderExLib = renderExLib;
    renderExLib = async function(){
      const r = await _renderExLib.apply(this, arguments);
      try{ patchExLibSearch(); }catch(e){ console.warn("[exdb-vi] renderExLib", e); }
      return r;
    };
  }

  /* ---------- 7. Bài 800+ đã thêm vào giáo án từ trước: hiện hướng dẫn Việt ----------
     Chỉ thay phần hướng dẫn khi đang là tiếng Anh; KHÔNG đổi tên (tên dùng làm khoá lịch sử tạ). */
  let _metaKick = false;
  if(has("getExerciseMeta")){
    const _getExerciseMeta = getExerciseMeta;
    getExerciseMeta = function(item){
      const m = _getExerciseMeta.apply(this, arguments);
      try{
        const id = item && item.custom && item.custom.exDbId;
        if(id && !EXDB_VI[id] && !_metaKick){ _metaKick = true; viReady().catch(() => { _metaKick = false; }); }   // fkLazy: nạp sẵn cho lần vẽ sau
        const g = id && EXDB_VI[id] && EXDB_VI[id].g;
        if(g && m && (!m.guide || !VI_MARK.test(m.guide))) m.guide = g;
      }catch(e){}
      return m;
    };
  }

  /* ---------- 8. API nhỏ cho module khác + vẽ lại nếu màn đang mở ---------- */
  window.exdbVi = { name: viName, guide: viGuide, storedName: viStoredName, fold: viFold, rank: viRank, keyOf: searchKeyOf, itemKeyOf, ready: viReady,
    stats(){ const v = Object.values(EXDB_VI); return { names: v.filter(e => e.n).length, guides: v.filter(e => e.g).length }; } };
  try{
    const sc = document.getElementById("screen-exlib");
    if(sc && sc.classList.contains("active") && has("renderExLib")) renderExLib();
  }catch(e){}
})();
