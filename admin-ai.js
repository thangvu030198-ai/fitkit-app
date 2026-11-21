/* =========================================================================
   TapEasy — BẢNG QUẢN TRỊ · MỤC "TRỢ LÝ AI" (admin-ai.js) · 16/11/2026 · docs/AI-COACH.md
   Nạp sau admin.js. Quyền: settings.view (xem) · settings.edit (sửa, quét model, thử).
   Mọi thao tác đi qua Cloud Function adminAiConfig — KHOÁ API chỉ gửi lên một chiều, máy chủ không bao giờ trả lại
   (chỉ hiện 4 ký tự cuối). Không lưu khoá vào localStorage / state.

   Có gì:  1) Trạng thái: bật/tắt, model đang dùng, lượt gọi + token 7 ngày
           2) Kết nối: URL gốc (API tương thích OpenAI) + khoá API
           3) QUÉT TOÀN BỘ MODEL của nhà cung cấp (GET /models) → nhóm theo hãng, gắn nhãn gợi ý, lọc nhanh
              → chọn model Chính / Dự phòng / Lập kế hoạch · Thử từng model (độ trễ + câu trả lời mẫu)
           4) Hành vi: độ sáng tạo, độ dài trả lời, giới hạn lượt / người / ngày, ghi chú thêm cho AI
   API test: window.TE_ADMIN_AI = { family(id), kind(id), group(list), tags(id), register() }
   ========================================================================= */
(function(G){
"use strict";
if(G.TE_ADMIN_AI && G.TE_ADMIN_AI.__v) return;
const CL = ()=>{ try{ if(typeof cloud !== "undefined" && cloud) return cloud; }catch(e){} return G.cloud || null; };
const esc = s=> String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const nf = n=> (Number(n) || 0).toLocaleString("vi-VN");
const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
const card = (title, inner, extra)=> `<section class="adm-card">${title ? `<div class="adm-ch"><h3>${title}</h3>${extra || ""}</div>` : ""}${inner}</section>`;
const can = p=>{ try{ return !!(G.TE_RBAC && G.TE_RBAC.can(p)); }catch(e){ return false; } };
const isFb = ()=>{ try{ return CL() && CL().mode === "firebase"; }catch(e){ return false; } };
const tip = (m, i)=>{ try{ if(typeof toast === "function") toast(m, i || "check_circle"); }catch(e){} };

/* ---------------- phân loại model (hàm thuần) ---------------- */
const FAMILIES = [
  ["deepseek", "DeepSeek", /deepseek/i], ["openai", "OpenAI (GPT)", /(^|[\/:-])(gpt|chatgpt|o[1345](-|$)|davinci|babbage)|openai/i], ["claude", "Anthropic (Claude)", /claude|anthropic/i],
  ["gemini", "Google (Gemini)", /gemini|gemma|palm|google/i], ["qwen", "Alibaba (Qwen)", /qwen|qwq|tongyi/i], ["grok", "xAI (Grok)", /grok|xai/i],
  ["llama", "Meta (Llama)", /llama|meta/i], ["mistral", "Mistral", /mistral|mixtral|codestral|pixtral/i], ["glm", "Zhipu (GLM)", /glm|zhipu|chatglm/i],
  ["moonshot", "Moonshot (Kimi)", /moonshot|kimi/i], ["doubao", "ByteDance (Doubao)", /doubao|skylark/i], ["minimax", "MiniMax", /minimax|abab/i], ["yi", "01.AI (Yi)", /(^|[\/-])yi-/i],
];
function family(id){ const f = FAMILIES.find(x=> x[2].test(id)); return f ? f[0] : "other"; }
/** chat = dùng được cho trợ lý; other = ảnh / giọng nói / embedding… (không dùng cho chat) */
function kind(id){
  return /embed|whisper|tts|speech|audio|dall-?e|image|imagen|flux|stable-?diffusion|sdxl|midjourney|video|sora|veo|kling|rerank|moderation|ocr|suno|music|realtime|transcri/i.test(id) ? "other" : "chat";
}
function tags(id){
  const t = [];
  if(/reason|think|(^|[\/-])r1|(^|[\/:-])o[1345](-|$)|qwq/i.test(id)) t.push(["reason", "Suy luận — chậm & tốn hơn, hợp lập kế hoạch"]);
  if(/mini|flash|lite|haiku|nano|small|turbo|8b|deepseek-chat|deepseek-v3/i.test(id) && !/reason|think/i.test(id)) t.push(["cheap", "Nhanh & rẻ — hợp trò chuyện"]);
  if(/vision|vl|4o|gemini|claude-3|claude-(sonnet|opus|haiku)|pixtral/i.test(id)) t.push(["vision", "Đọc được ảnh"]);
  if(/preview|exp|beta|latest/i.test(id)) t.push(["preview", "Bản thử — có thể đổi / bị gỡ"]);
  return t;
}
function group(list){
  const by = {};
  (Array.isArray(list) ? list : []).forEach(id=>{ const k = kind(id) === "other" ? "_other" : family(id); (by[k] = by[k] || []).push(id); });
  const order = FAMILIES.map(f=> f[0]).concat(["other", "_other"]);
  return order.filter(k=> by[k]).map(k=> ({ id: k, label: k === "_other" ? "Không dùng cho trò chuyện (ảnh, giọng nói, embedding…)" : k === "other" ? "Hãng khác" : FAMILIES.find(f=> f[0] === k)[1], models: by[k].slice().sort((a, b)=> a.localeCompare(b)) }));
}

/* ---------------- giao diện ---------------- */
const CSS = `
.adm-ai-models{ max-height:440px; overflow-y:auto; border:1px solid var(--a-line); border-radius:12px; }
.adm-ai-g{ padding:8px 12px; font-size:12.5px; font-weight:600; color:var(--a-muted); background:rgba(255,255,255,.05); position:sticky; top:0; text-transform:uppercase; letter-spacing:.04em; }
.adm-ai-m{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; border-top:1px solid var(--a-line); font-size:13.5px; }
.adm-ai-m code{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; overflow-wrap:anywhere; flex:1 1 220px; min-width:0; }
.adm-ai-m .adm-chip{ font-size:11px; padding:2px 7px; } .adm-ai-m .adm-chip.cheap{ color:var(--a-mint); } .adm-ai-m .adm-chip.reason{ color:#FFC44C; }
.adm-ai-m .acts{ display:flex; gap:4px; flex-wrap:wrap; } .adm-ai-m .acts .adm-btn{ min-height:32px; padding:0 9px; font-size:12px; }
.adm-ai-m.sel{ background:rgba(var(--a-mint-rgb),.08); }
.adm-ai-st{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; } .adm-ai-st .adm-chip b{ margin-left:4px; }
.adm-ai-test{ margin-top:10px; padding:12px; border-radius:12px; border:1px solid var(--a-line); font-size:13.5px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; }
.adm-ai-test.bad{ border-color:rgba(var(--a-coral-rgb),.5); }
.adm-ai-use{ display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-top:8px; } .adm-ai-use div{ text-align:center; padding:8px 2px; border-radius:10px; background:rgba(255,255,255,.05); font-size:12px; }
.adm-ai-use b{ display:block; font-size:16px; font-variant-numeric:tabular-nums; } .adm-ai-use small{ color:var(--a-dim); }
.adm-f textarea.adm-ai-x{ min-height:90px; }
`;
function css(){ if(document.getElementById("adm-ai-css")) return; const s = document.createElement("style"); s.id = "adm-ai-css"; s.textContent = CSS; document.head.appendChild(s); }
const call = (op, extra)=> CL().fn("adminAiConfig", Object.assign({ op }, extra || {}));
let M = { models: null, filter: "", showOther: false };

function modelsHtml(cfg, ed){
  if(!M.models) return `<p class="adm-empty">Chưa quét. Nhập URL gốc + khoá rồi bấm <b>Quét toàn bộ model</b> — app sẽ liệt kê mọi model mà khoá của bạn dùng được.</p>`;
  const f = M.filter.trim().toLowerCase();
  const gs = group(M.models.filter(id=> !f || id.toLowerCase().indexOf(f) >= 0)).filter(g=> M.showOther || g.id !== "_other");
  if(!gs.length) return `<p class="adm-empty">Không có model khớp "${esc(M.filter)}".</p>`;
  return `<div class="adm-ai-models">${gs.map(g=> `<div class="adm-ai-g">${esc(g.label)} · ${g.models.length}</div>` + g.models.map(id=>{
    const role = id === cfg.model ? "Chính" : id === cfg.planModel ? "Lập kế hoạch" : id === cfg.fallback ? "Dự phòng" : "";
    return `<div class="adm-ai-m ${role ? "sel" : ""}"><code>${esc(id)}</code>${role ? `<span class="adm-chip add"><b>${role}</b></span>` : ""}${tags(id).map(([k, l])=> `<span class="adm-chip ${k}" title="${esc(l)}">${esc(l.split(" — ")[0])}</span>`).join("")}
      ${ed && g.id !== "_other" ? `<span class="acts"><button class="adm-btn sm" data-ai="pick:model:${esc(id)}">Chính</button><button class="adm-btn sm ghost" data-ai="pick:fallback:${esc(id)}">Dự phòng</button><button class="adm-btn sm ghost" data-ai="pick:planModel:${esc(id)}">Kế hoạch</button><button class="adm-btn sm ghost" data-ai="test:${esc(id)}">Thử</button></span>` : ""}</div>`; }).join("")).join("")}</div>`;
}
async function render(el){
  css();
  if(!isFb()){ el.innerHTML = `<div class="adm-hello"><div><h2>Trợ lý AI</h2><p><span>Quản lý nhà cung cấp AI cho chatbot tư vấn trong app.</span></p></div></div>
    ${card(ic("adm_lock") + esc("Cần máy chủ thật"), `<p class="adm-note">${ic("adm_help")}Bản dùng thử không có máy chủ nên không lưu được khoá API. Trong app, Trợ lý vẫn chạy bằng bộ luật và kho kiến thức trên máy. Hãy mở bảng quản trị trên bản đã nối Firebase (tapeasy.app).</p>`)}`; return; }
  el.innerHTML = `<p class="adm-empty">Đang tải cấu hình AI…</p>`;
  let R;
  try{ R = await call("get"); }
  catch(e){ el.innerHTML = `<div class="adm-hello"><div><h2>Trợ lý AI</h2></div></div><p class="adm-empty">Không tải được cấu hình: ${esc(e && e.message || "lỗi")}. Nếu vừa cập nhật app, hãy chạy lại workflow Firebase để triển khai hàm <code>adminAiConfig</code>.</p>`; return; }
  const ed = !!R.canEdit && can("settings.edit");
  let cfg = Object.assign({}, R.config), keySet = !!R.keySet, keyTail = R.keyTail || "";
  const ro = ed ? "" : "readonly";
  const paint = ()=>{
    const today = (R.usage || [])[0] || {};
    const ready = cfg.enabled && cfg.baseUrl && cfg.model && keySet;
    el.innerHTML = `<div class="adm-hello"><div><h2>Trợ lý AI</h2><p><span>Chatbot tư vấn tập luyện · ăn uống · ngủ nghỉ · sức khoẻ trong app. Dùng bất kỳ nhà cung cấp nào có API tương thích OpenAI.</span></p></div>
        <div class="adm-acts"><button class="adm-btn sm" data-ai="reload">${ic("adm_log")}Làm mới</button></div></div>
      ${card(`${ic("adm_chart")}Trạng thái`, `<div class="adm-ai-st">
          <span class="adm-chip ${ready ? "add" : "rm"}">${ready ? "Đang BẬT cho người dùng" : cfg.enabled ? "Bật nhưng thiếu cấu hình" : "Đang TẮT — app dùng bộ luật trên máy"}</span>
          <span class="adm-chip">Khoá API:<b>${keySet ? "đã lưu " + esc(keyTail) : "chưa có"}</b></span>
          <span class="adm-chip">Model chính:<b>${esc(cfg.model || "—")}</b></span>${cfg.planModel ? `<span class="adm-chip">Kế hoạch:<b>${esc(cfg.planModel)}</b></span>` : ""}${cfg.fallback ? `<span class="adm-chip">Dự phòng:<b>${esc(cfg.fallback)}</b></span>` : ""}
          <span class="adm-chip">Hôm nay:<b>${nf(today.calls)} lượt</b></span></div>
        <div class="adm-ai-use">${(R.usage || []).slice().reverse().map(u=> `<div><small>${esc(u.day.slice(8, 10) + "/" + u.day.slice(5, 7))}</small><b>${nf(u.calls)}</b><small>${nf(Math.round((u.tin + u.tout) / 1000))}k token${u.errs ? ` · ${u.errs} lỗi` : ""}</small></div>`).join("")}</div>
        <p class="adm-dim" style="margin-top:8px;">Số lượt gọi và token (vào + ra) 7 ngày gần nhất. Chi phí thật xem trên trang của nhà cung cấp.</p>`)}
      ${card(`${ic("adm_lock")}Kết nối nhà cung cấp`, `
        <p class="adm-note">${ic("adm_lock")}Khoá API được lưu trên máy chủ và <b>không bao giờ hiển thị lại</b> (chỉ thấy 4 ký tự cuối). Đừng dán khoá vào chat, ghi chú hay ảnh chụp màn hình; nghi lộ thì tạo khoá mới ở nhà cung cấp rồi dán lại vào đây.</p>
        <div class="adm-row wrap">
          <div class="adm-f" style="flex:2 1 300px;"><label for="adm-ai-url">URL gốc (base URL — thường kết thúc bằng /v1)</label><input id="adm-ai-url" type="url" inputmode="url" maxlength="200" autocomplete="off" spellcheck="false" placeholder="https://tên-miền-nhà-cung-cấp/v1" value="${esc(cfg.baseUrl || "")}" ${ro}></div>
          <div class="adm-f" style="flex:2 1 300px;"><label for="adm-ai-key">Khoá API ${keySet ? `(đã lưu ${esc(keyTail)} — để trống nếu không đổi)` : ""}</label><input id="adm-ai-key" type="password" maxlength="400" autocomplete="new-password" spellcheck="false" placeholder="${keySet ? "••••••••" : "Dán khoá API vào đây"}" ${ro}></div>
        </div>
        ${ed ? `<div class="adm-row wrap" style="margin-top:10px;"><button class="adm-btn pri" data-ai="scan">${ic("adm_chart")}Quét toàn bộ model</button><button class="adm-btn" data-ai="save-conn">Lưu kết nối</button>${keySet ? `<button class="adm-btn ghost" data-ai="clear-key">Xoá khoá đã lưu</button>` : ""}</div>` : `<p class="adm-dim">${ic("adm_lock")}Chỉ xem.</p>`}`)}
      ${card(`${ic("adm_book")}Model`, `
        <div class="adm-row wrap"><div class="adm-f"><label for="adm-ai-m1">Model chính (trò chuyện)</label><input id="adm-ai-m1" maxlength="100" spellcheck="false" autocomplete="off" value="${esc(cfg.model || "")}" ${ro} placeholder="VD: deepseek-chat"></div>
          <div class="adm-f"><label for="adm-ai-m3">Model lập kế hoạch (để trống = dùng model chính)</label><input id="adm-ai-m3" maxlength="100" spellcheck="false" autocomplete="off" value="${esc(cfg.planModel || "")}" ${ro}></div>
          <div class="adm-f"><label for="adm-ai-m4">Model đọc ảnh — chụp món ăn, phiếu InBody (để trống = model chính; model phải đọc được ảnh)</label><input id="adm-ai-m4" maxlength="100" spellcheck="false" autocomplete="off" value="${esc(cfg.visionModel || "")}" ${ro}></div>
          <div class="adm-f"><label for="adm-ai-m2">Model dự phòng (khi model chính lỗi)</label><input id="adm-ai-m2" maxlength="100" spellcheck="false" autocomplete="off" value="${esc(cfg.fallback || "")}" ${ro}></div></div>
        <p class="adm-dim" style="margin:8px 0;">Gợi ý tối ưu chi phí: trò chuyện dùng model <b>nhanh & rẻ</b>; lập kế hoạch có thể dùng model mạnh hơn (hoặc để trống); dự phòng chọn model của <b>hãng khác</b> để không sập cùng lúc. Bấm <b>Thử</b> để xem tốc độ và giọng trả lời trước khi chọn.</p>
        <div class="adm-row wrap" style="margin-bottom:8px;"><div class="adm-f"><label for="adm-ai-flt">Lọc danh sách đã quét${M.models ? ` (${M.models.length} model)` : ""}</label><input id="adm-ai-flt" maxlength="40" spellcheck="false" placeholder="VD: deepseek, gpt, flash…" value="${esc(M.filter)}"></div>
          <label class="adm-sw" style="flex:1 1 220px;"><input type="checkbox" id="adm-ai-oth" ${M.showOther ? "checked" : ""}><span><b>Hiện cả model không dùng cho chat</b><small>ảnh, giọng nói, embedding…</small></span></label></div>
        <div data-ai-models>${modelsHtml(cfg, ed)}</div><div data-ai-test></div>`)}
      ${card(`${ic("adm_gear")}Hành vi & giới hạn`, `
        <div class="adm-row wrap">
          <div class="adm-f"><label for="adm-ai-t">Độ sáng tạo (0 = chắc chắn · 1 = bay bổng)</label><input id="adm-ai-t" type="number" min="0" max="1.5" step="0.1" value="${esc(cfg.temperature)}" ${ro}></div>
          <div class="adm-f"><label for="adm-ai-mt">Độ dài tối đa mỗi câu trả lời (token)</label><input id="adm-ai-mt" type="number" min="200" max="4000" step="50" value="${esc(cfg.maxTokens)}" ${ro}></div>
          <div class="adm-f"><label for="adm-ai-pt">Độ dài tối đa khi lập kế hoạch (token)</label><input id="adm-ai-pt" type="number" min="800" max="8000" step="100" value="${esc(cfg.planMaxTokens)}" ${ro}></div>
          <div class="adm-f"><label for="adm-ai-lim">Lượt AI tối đa / người / ngày (chung mọi tính năng AI: hỏi AI, soạn giáo án, chụp món, đọc InBody — mỗi lần = 1 lượt)</label><input id="adm-ai-lim" type="number" min="1" max="500" value="${esc(cfg.dailyLimit)}" ${ro}></div></div>
        <div class="adm-f" style="margin-top:10px;"><label for="adm-ai-x">Ghi chú thêm cho AI (tuỳ chọn, ≤ 1.500 ký tự) — VD giọng điệu, chương trình khuyến mãi, điều cần nhấn mạnh. Quy tắc an toàn y tế luôn được giữ nguyên.</label><textarea id="adm-ai-x" class="adm-ai-x" maxlength="1500" ${ro}>${esc(cfg.extra || "")}</textarea></div>
        <label class="adm-sw" style="margin-top:12px;"><input type="checkbox" id="adm-ai-on" ${cfg.enabled ? "checked" : ""} ${ed ? "" : "disabled"}><span><b>Bật Trợ lý AI cho người dùng đã đăng nhập</b><small>Tắt → app vẫn tư vấn bằng bộ luật và kho kiến thức trên máy (không tốn phí).</small></span></label>
        ${ed ? `<button class="adm-btn pri" data-ai="save" style="margin-top:12px;">Lưu cấu hình</button>` : ""}
        ${cfg.updatedAt ? `<p class="adm-dim">Cập nhật lần cuối ${esc(new Date(cfg.updatedAt).toLocaleString("vi-VN"))}</p>` : ""}`)}`;
  };
  const val = id=>{ const x = document.getElementById(id); return x ? String(x.value || "").trim() : ""; };
  const collect = ()=> ({ baseUrl: val("adm-ai-url"), model: val("adm-ai-m1"), fallback: val("adm-ai-m2"), planModel: val("adm-ai-m3"), visionModel: val("adm-ai-m4"), temperature: Number(val("adm-ai-t")), maxTokens: Number(val("adm-ai-mt")),
    planMaxTokens: Number(val("adm-ai-pt")), dailyLimit: Number(val("adm-ai-lim")), extra: val("adm-ai-x"), enabled: !!(document.getElementById("adm-ai-on") || {}).checked });
  const keep = ()=>{ const c = collect(); ["baseUrl", "model", "fallback", "planModel", "visionModel", "extra", "enabled"].forEach(k=> cfg[k] = c[k]); ["temperature", "maxTokens", "planMaxTokens", "dailyLimit"].forEach(k=>{ if(Number.isFinite(c[k])) cfg[k] = c[k]; }); };
  const saveCfg = async (btn, opts)=>{
    opts = opts || {};
    const apiKey = val("adm-ai-key"); const body = { config: opts.connOnly ? { baseUrl: val("adm-ai-url") } : collect() };
    if(apiKey) body.apiKey = apiKey; if(opts.clearKey) body.clearKey = true;
    if(btn) btn.disabled = true;
    try{ const r = await call("set", body); cfg = Object.assign({}, r.config); keySet = !!r.keySet; keyTail = r.keyTail || ""; tip(opts.clearKey ? "Đã xoá khoá" : "Đã lưu cấu hình AI"); paint(); }
    catch(e){ tip(e && e.message || "Chưa lưu được", "error"); if(btn) btn.disabled = false; }
  };
  paint();
  try{ if(el.__aiAc) el.__aiAc.abort(); }catch(e){}                       // vẽ lại cùng phần tử → gỡ trình nghe cũ, không cộng dồn
  const ac = el.__aiAc = (typeof AbortController === "function" ? new AbortController() : null), sig = ac ? { signal: ac.signal } : undefined;
  el.addEventListener("input", ev=>{
    const t = ev.target;
    if(t && t.id === "adm-ai-flt"){ M.filter = t.value; const box = el.querySelector("[data-ai-models]"); if(box){ keep(); box.innerHTML = modelsHtml(cfg, ed); } }
  }, sig);
  el.addEventListener("change", ev=>{ const t = ev.target; if(t && t.id === "adm-ai-oth"){ M.showOther = t.checked; const box = el.querySelector("[data-ai-models]"); if(box){ keep(); box.innerHTML = modelsHtml(cfg, ed); } } }, sig);
  el.addEventListener("click", async ev=>{
    const b = ev.target.closest && ev.target.closest("[data-ai]"); if(!b) return;
    const parts = b.dataset.ai.split(":"), act = parts[0];
    if(act === "reload"){ M.models = null; return render(el); }
    if(!ed) return;
    if(act === "save") return saveCfg(b);
    if(act === "save-conn") return saveCfg(b, { connOnly: true });
    if(act === "clear-key"){ if(confirm("Xoá khoá API đã lưu? Trợ lý AI sẽ tắt cho tới khi bạn dán khoá mới.")){ const on = document.getElementById("adm-ai-on"); if(on) on.checked = false; await saveCfg(b, { clearKey: true }); } return; }
    if(act === "scan"){
      b.disabled = true; const old = b.innerHTML; b.textContent = "Đang quét…";
      const extra = {}; const u = val("adm-ai-url"), k = val("adm-ai-key"); if(u) extra.baseUrl = u; if(k) extra.apiKey = k;
      try{ const r = await call("models", extra); keep(); M.models = r.models || []; M.filter = ""; tip(`Đã quét được ${M.models.length} model`);
        const box = el.querySelector("[data-ai-models]"); if(box) box.innerHTML = modelsHtml(cfg, ed); const fl = document.getElementById("adm-ai-flt"); if(fl) fl.value = "";
        if(box && box.scrollIntoView) box.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      catch(e){ tip(e && e.message || "Không quét được", "error"); }
      b.disabled = false; b.innerHTML = old; return;
    }
    if(act === "pick"){
      const field = parts[1], id = parts.slice(2).join(":"); const map = { model: "adm-ai-m1", fallback: "adm-ai-m2", planModel: "adm-ai-m3" };
      const inp = document.getElementById(map[field]); if(inp) inp.value = id; keep();
      const box = el.querySelector("[data-ai-models]"); if(box){ const top = (box.querySelector(".adm-ai-models") || {}).scrollTop || 0; box.innerHTML = modelsHtml(cfg, ed); const l = box.querySelector(".adm-ai-models"); if(l) l.scrollTop = top; }
      tip(`Đã chọn ${id} — nhớ bấm Lưu cấu hình`, "info"); return;
    }
    if(act === "test"){
      const id = parts.slice(1).join(":"), out = el.querySelector("[data-ai-test]"); if(!out) return;
      out.innerHTML = `<div class="adm-ai-test">Đang thử <b>${esc(id)}</b>…</div>`; b.disabled = true;
      const extra = { model: id }; const u = val("adm-ai-url"), k = val("adm-ai-key"); if(u) extra.baseUrl = u; if(k) extra.apiKey = k;
      try{ const r = await call("test", extra);
        out.innerHTML = r.ok ? `<div class="adm-ai-test"><b>${esc(r.model)}</b> · ${nf(r.ms)} ms · ${nf(r.usage.tin)} + ${nf(r.usage.tout)} token\n${esc(r.reply || "(trả rỗng)")}</div>` : `<div class="adm-ai-test bad"><b>${esc(r.model)}</b> lỗi sau ${nf(r.ms)} ms\n${esc(r.error || "")}</div>`; }
      catch(e){ out.innerHTML = `<div class="adm-ai-test bad">${esc(e && e.message || "Không thử được")}</div>`; }
      b.disabled = false; return;
    }
  }, sig);
}

function register(){
  try{ if(G.TE_ADMIN && G.TE_ADMIN.registerSection){ G.TE_ADMIN.registerSection({ id:"ai", title:"Trợ lý AI", icon:"adm_help", order:93, perms:["settings.view","settings.edit"], render }); return true; } }catch(e){}
  return false;
}
G.TE_ADMIN_AI = { __v: 1, family, kind, tags, group, modelsHtml, register, FAMILIES };
register();
})(typeof window !== "undefined" ? window : globalThis);
