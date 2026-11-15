/* =========================================================================
   TapEasy — BẢNG QUẢN TRỊ · MỤC "PHÂN TÍCH" (admin-analytics.js) · docs/ANALYTICS-ADMIN.md
   Nạp sau admin.js + pulse.js. Quyền: analytics.view (vai trò Phân tích / Quản trị…); xuất CSV cần data.export.
   Nguồn: pulse.js ghi nhãn đếm ẨN DANH → Firestore (presence, activity). Đếm theo nhãn qua Cloud Function adminAnalytics.
   Chế độ demo: đọc số liệu mô phỏng trên máy (FKPulse.demoStore()).

   Có gì:  1) Đang trực tuyến (cập nhật trực tiếp): theo nền tảng, màn hình, khách / đã đăng nhập
           2) Hôm nay · tuần · tháng: DAU, người mới, WAU, MAU, độ gắn bó DAU/MAU
           3) Biểu đồ 30 ngày (người dùng hoạt động + người mới)
           4) Giữ chân D1 / D7 / D30 theo nhóm ngày đầu
           5) Phễu kích hoạt của người mới (7 ngày) + nguồn người mới
           6) Tính năng được dùng (7 ngày), nền tảng, ngôn ngữ
           7) Nhận định tự động (đọc số như một chuyên viên phân tích) + xuất CSV
   API test: window.TE_ADMIN_ANALYTICS = { wanted(now), build(counts, now), insights(model), online(list, now), fetch(), LABELS }
   ========================================================================= */
(function(G){
"use strict";
if(G.TE_ADMIN_ANALYTICS && G.TE_ADMIN_ANALYTICS.__v) return;
const CL = ()=>{ try{ if(typeof cloud !== "undefined" && cloud) return cloud; }catch(e){} return G.cloud || null; };   // cloud.js khai báo `const cloud` (không gắn vào window)

const DAY_MS = 86400000, TZ_MS = 7 * 3600000, ONLINE_MS = 150000;
const PLATS = ["web", "android", "ios"], LANGS = ["vi", "en"];
const FEATURES = ["onboard", "signup", "plan", "workout", "meal", "recipe", "pt", "community", "shop", "events", "share"];
const SOURCES = ["direct", "facebook", "tiktok", "instagram", "youtube", "zalo", "google", "store", "other"];
const FUNNEL = ["onboard", "workout", "signup"];     // tạo tài khoản là bước tuỳ chọn → đặt cuối, không tính vào "bước rơi nhiều nhất"
const LABELS = {
  feat: { onboard:"Hoàn tất khảo sát ban đầu", signup:"Tạo tài khoản", plan:"Tạo / thêm giáo án", workout:"Tập luyện", meal:"Ghi bữa ăn", recipe:"Xem công thức",
    pt:"Xem / liên hệ PT", community:"Cộng đồng", shop:"Gian hàng", events:"Sự kiện", share:"Chia sẻ" },
  src: { direct:"Vào thẳng (gõ link, mở lại)", facebook:"Facebook", tiktok:"TikTok", instagram:"Instagram", youtube:"YouTube", zalo:"Zalo", google:"Tìm kiếm", store:"Cửa hàng ứng dụng", other:"Nguồn khác" },
  plat: { web:"Web", android:"Android", ios:"iOS" }, lang: { vi:"Tiếng Việt", en:"English" },
  scr: { home:"Trang chủ", workout:"Tập luyện", nutrition:"Dinh dưỡng", coach:"Huấn luyện viên", profile:"Hồ sơ", plans:"Giáo án", progress:"Tiến độ", library:"Thư viện bài tập",
    community:"Cộng đồng", shop:"Gian hàng", events:"Sự kiện", findpt:"Tìm PT", reminders:"Nhắc nhở", welcome:"Màn chào", auth:"Đăng nhập", onboarding:"Khảo sát ban đầu" },
};

const esc = s=> String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const nf = n=> (Number(n) || 0).toLocaleString("vi-VN");
const pct = (a, b)=> b > 0 ? Math.round(a / b * 1000) / 10 : null;
const pc = v=> v == null ? "—" : (String(v).replace(".", ",") + "%");
const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
const card = (title, inner, extra)=> `<section class="adm-card">${title ? `<div class="adm-ch"><h3>${title}</h3>${extra || ""}</div>` : ""}${inner}</section>`;
const dayOf = t=> new Date(t + TZ_MS).toISOString().slice(0, 10);
const addDays = (d, n)=> new Date(Date.parse(d + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const weekOf = d=>{ const x = new Date(d + "T00:00:00Z"); return addDays(d, -((x.getUTCDay() + 6) % 7)); };
const prevMonth = m=>{ const y = +m.slice(0, 4), mo = +m.slice(5, 7); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };
const fd = d=> `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const can = p=>{ try{ return !!(G.TE_RBAC && G.TE_RBAC.can(p)); }catch(e){ return false; } };
const isFb = ()=>{ try{ return CL() && CL().mode === "firebase"; }catch(e){ return false; } };

/* ---------------- 1. Nhãn cần đếm + dựng mô hình (hàm thuần) ---------------- */
function frame(now){
  const today = dayOf(now), days = Array.from({ length: 30 }, (_, i)=> addDays(today, i - 29));
  const last7 = days.slice(-7), week = weekOf(today), month = today.slice(0, 7);
  return { today, days, last7, week, prevWeek: addDays(week, -7), month, prevMonth: prevMonth(month),
    c1: Array.from({ length: 7 }, (_, i)=> addDays(today, -8 + i)),       // nhóm đã qua trọn ngày thứ 1
    c7: Array.from({ length: 7 }, (_, i)=> addDays(today, -14 + i)),      // … trọn ngày thứ 7
    c30: Array.from({ length: 7 }, (_, i)=> addDays(today, -37 + i)) };   // … trọn ngày thứ 30
}
function wanted(now){
  const F = frame(now == null ? Date.now() : now), t = [];
  F.days.forEach(d=> t.push(`d:${d}`, `n:${d}`));
  PLATS.forEach(p=> t.push(`d:${F.today}|p:${p}`, `m:${F.month}|p:${p}`));
  LANGS.forEach(l=> t.push(`d:${F.today}|l:${l}`));
  t.push(`d:${F.today}|a:1`, `d:${F.today}|ret`, `w:${F.week}`, `w:${F.prevWeek}`, `m:${F.month}`, `m:${F.prevMonth}`);
  F.last7.forEach(d=>{ FEATURES.forEach(f=> t.push(`d:${d}|f:${f}`)); FUNNEL.forEach(f=> t.push(`n:${d}|f:${f}`)); SOURCES.forEach(s=> t.push(`n:${d}|s:${s}`)); });
  F.c1.forEach(c=> t.push(`r:${c}>1`)); F.c7.forEach(c=> t.push(`r:${c}>7`));
  F.c30.forEach(c=> t.push(`n:${c}`, `r:${c}>30`));
  return t.filter((x, i)=> t.indexOf(x) === i);
}
function build(counts, now){
  now = now == null ? Date.now() : now; counts = counts || {};
  const F = frame(now), c = k=> Number(counts[k]) || 0, sum = a=> a.reduce((x, y)=> x + y, 0);
  const days = F.days.map(d=> ({ day: d, dau: c(`d:${d}`), nu: c(`n:${d}`) }));
  const dauToday = c(`d:${F.today}`), dauYest = days[28].dau;
  const avg7 = sum(days.slice(-8, -1).map(x=> x.dau)) / 7, avgPrev7 = sum(days.slice(-15, -8).map(x=> x.dau)) / 7;   // 7 ngày TRỌN gần nhất (không tính hôm nay)
  const mau = c(`m:${F.month}`), mauPrev = c(`m:${F.prevMonth}`), dom = +F.today.slice(8, 10);
  const stickBase = dom >= 7 ? mau : (mauPrev || mau);
  const ret = (cohorts, n)=>{ const base = sum(cohorts.map(x=> c(`n:${x}`))), back = sum(cohorts.map(x=> c(`r:${x}>${n}`))); return { base, back, rate: pct(back, base) }; };
  const new7 = sum(F.last7.map(d=> c(`n:${d}`)));
  const M = {
    at: now, today: F.today, days, total30: sum(days.map(x=> x.dau)),
    t: { dau: dauToday, yest: dauYest, nu: c(`n:${F.today}`), ret: c(`d:${F.today}|ret`), signed: c(`d:${F.today}|a:1`),
      plat: PLATS.map(p=> ({ k: p, n: c(`d:${F.today}|p:${p}`) })), lang: LANGS.map(l=> ({ k: l, n: c(`d:${F.today}|l:${l}`) })) },
    wau: { cur: c(`w:${F.week}`), prev: c(`w:${F.prevWeek}`) }, mau: { cur: mau, prev: mauPrev, plat: PLATS.map(p=> ({ k: p, n: c(`m:${F.month}|p:${p}`) })) },
    avg7: Math.round(avg7 * 10) / 10, avgPrev7: Math.round(avgPrev7 * 10) / 10, stick: stickBase >= avg7 ? pct(avg7, stickBase) : null,   // tháng mới có ít dữ liệu hơn trung bình ngày → chưa tính được
    features: FEATURES.map(f=> ({ k: f, n: sum(F.last7.map(d=> c(`d:${d}|f:${f}`))) })).sort((a, b)=> b.n - a.n),
    active7: sum(F.last7.map(d=> c(`d:${d}`))),
    funnel: [{ k: "open", n: new7 }].concat(FUNNEL.map(f=> ({ k: f, n: Math.min(new7, sum(F.last7.map(d=> c(`n:${d}|f:${f}`)))) }))),
    sources: SOURCES.map(s=> ({ k: s, n: sum(F.last7.map(d=> c(`n:${d}|s:${s}`))) })).filter(x=> x.n > 0).sort((a, b)=> b.n - a.n),
    ret: { d1: ret(F.c1, 1), d7: ret(F.c7, 7), d30: ret(F.c30, 30) },
    cohorts: F.c1.concat([addDays(F.today, -1)]).slice(-8).map(d=> ({ day: d, size: c(`n:${d}`), d1: d <= addDays(F.today, -2) ? c(`r:${d}>1`) : null })),
  };
  M.insights = insights(M);
  return M;
}

/* ---------------- 2. Nhận định tự động ---------------- */
const MIN_BASE = 20;      // dưới mức này: mẫu quá nhỏ, không kết luận
function insights(M){
  const out = [], add = (tone, text)=> out.push({ tone, text });
  if(!M.total30){ add("info", "Chưa có dữ liệu sử dụng. Số liệu bắt đầu ghi từ khi bản app này được phát hành — hãy quay lại sau vài ngày."); return out; }
  if(M.avgPrev7 >= 5){
    const ch = Math.round((M.avg7 - M.avgPrev7) / M.avgPrev7 * 100);
    if(ch >= 10) add("good", `Người dùng hoạt động mỗi ngày tăng ${ch}% so với 7 ngày trước đó (trung bình ${String(M.avg7).replace(".", ",")} người/ngày).`);
    else if(ch <= -10) add("warn", `Người dùng hoạt động mỗi ngày giảm ${Math.abs(ch)}% so với 7 ngày trước đó. Xem lại nguồn người mới và thông báo nhắc tập.`);
    else add("info", `Lượng người dùng hoạt động ổn định (thay đổi ${ch >= 0 ? "+" : ""}${ch}% so với 7 ngày trước đó).`);
  }
  if(M.stick != null && M.mau.cur >= MIN_BASE){
    if(M.stick < 10) add("warn", `Độ gắn bó ${pc(M.stick)}: phần lớn người dùng chỉ mở app vài lần trong tháng. Ưu tiên nhắc lịch tập, chuỗi ngày và nội dung mới hằng tuần.`);
    else if(M.stick < 20) add("info", `Độ gắn bó ${pc(M.stick)} ở mức trung bình. Mốc thường được coi là tốt với app thói quen là từ 20% trở lên.`);
    else add("good", `Độ gắn bó ${pc(M.stick)}: người dùng quay lại đều — nền tốt để mở rộng kênh thu hút.`);
  }
  const r1 = M.ret.d1, r7 = M.ret.d7;
  if(r1.base >= MIN_BASE){
    if(r1.rate < 25) add("warn", `Giữ chân ngày 1 chỉ ${pc(r1.rate)} (${nf(r1.back)}/${nf(r1.base)} người mới quay lại hôm sau). Điểm cần sửa trước tiên là trải nghiệm ngày đầu: rút ngắn khảo sát, đưa buổi tập đầu ra ngay.`);
    else add("good", `Giữ chân ngày 1 đạt ${pc(r1.rate)} (${nf(r1.back)}/${nf(r1.base)}).`);
  }
  if(r7.base >= MIN_BASE){
    if(r7.rate < 10) add("warn", `Giữ chân ngày 7 là ${pc(r7.rate)}. Người mới chưa hình thành thói quen trong tuần đầu — cân nhắc kế hoạch 7 ngày đầu và nhắc đúng giờ tập.`);
    else add("good", `Giữ chân ngày 7 đạt ${pc(r7.rate)}.`);
  }
  const fn = M.funnel;
  if(fn[0].n >= MIN_BASE){
    let worst = null;
    for(let i = 1; i <= 2; i++){ const prev = fn[i - 1].n; if(prev > 0){ const drop = 1 - fn[i].n / prev; if(!worst || drop > worst.drop) worst = { i, drop }; } }
    if(worst && worst.drop >= .4) add("warn", `Rơi nhiều nhất ở bước “${funnelLabel(fn[worst.i].k)}”: mất ${Math.round(worst.drop * 100)}% người mới so với bước trước. Đây là bước nên tối ưu trước.`);
  } else if(fn[0].n > 0) add("info", `Mới có ${nf(fn[0].n)} người mới trong 7 ngày — mẫu còn nhỏ, các tỉ lệ dưới đây chỉ để tham khảo.`);
  if(M.sources.length && fn[0].n >= MIN_BASE){
    const top = M.sources[0], share = Math.round(top.n / fn[0].n * 100);
    add("info", `Nguồn người mới lớn nhất: ${LABELS.src[top.k] || top.k} (${share}%).${share >= 70 ? " Phụ thuộc nhiều vào một kênh — nên thử thêm kênh thứ hai." : ""}`);
  }
  if(M.t.dau >= MIN_BASE){
    const g = Math.round((1 - M.t.signed / M.t.dau) * 100);
    if(g >= 60) add("info", `${g}% người dùng hôm nay chưa đăng nhập. Dữ liệu của họ chỉ nằm trên máy — nên gợi ý tạo tài khoản sau buổi tập đầu để không mất tiến độ.`);
  }
  const used = M.features.filter(f=> f.n > 0);
  if(used.length >= 3 && M.active7 >= MIN_BASE){
    const low = M.features.filter(f=> ["community", "shop", "events", "pt"].includes(f.k) && f.n / M.active7 < .03).map(f=> LABELS.feat[f.k]);
    if(low.length) add("info", `Ít người chạm tới: ${low.join(", ")} (dưới 3% lượt người dùng/ngày). Cân nhắc đưa lối vào lên Trang chủ hoặc tạm ẩn để giao diện gọn hơn.`);
  }
  if(!out.length) add("info", "Chưa đủ dữ liệu để rút ra nhận định (cần khoảng 20 người dùng trở lên cho mỗi chỉ số).");
  return out;
}
const funnelLabel = k=> k === "open" ? "Mở app lần đầu" : ({ onboard:"Hoàn tất khảo sát", workout:"Bắt đầu buổi tập", signup:"Tạo tài khoản (tuỳ chọn)" }[k] || k);

/* ---------------- 3. Đọc dữ liệu ---------------- */
let _cache = null;
async function fetchModel(force){
  const now = Date.now();
  if(!force && _cache && now - _cache.at < 5 * 60000) return _cache;
  const tags = wanted(now);
  let counts = {};
  if(isFb()){
    const r = await CL().fn("adminAnalytics", { tags });
    counts = (r && r.counts) || {};
  } else {
    const act = (G.FKPulse && G.FKPulse.demoStore().activity) || {};
    const docs = Object.keys(act).map(k=> act[k].t || []);
    tags.forEach(t=>{ counts[t] = docs.filter(d=> d.indexOf(t) >= 0).length; });
  }
  return (_cache = build(counts, now));
}
/** Danh sách presence → tổng hợp "đang trực tuyến" */
function online(list, now){
  now = now == null ? Date.now() : now;
  const on = (list || []).filter(x=> x && now - (Number(x.ts) || 0) <= ONLINE_MS);
  const tally = key=>{ const m = {}; on.forEach(x=>{ const k = String(x[key] == null ? "" : x[key]).slice(0, 24) || "khac"; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(k=> ({ k, n: m[k] })).sort((a, b)=> b.n - a.n); };
  return { n: on.length, signed: on.filter(x=> x.a === true).length, plat: tally("p"), scr: tally("s").slice(0, 8), lang: tally("l") };
}

/* ---------------- 4. Vẽ ---------------- */
const delta = (cur, prev)=>{ if(!prev) return ""; const ch = Math.round((cur - prev) / prev * 100); return `<em class="adm-dl ${ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch > 0 ? "▲" : ch < 0 ? "▼" : "•"} ${Math.abs(ch)}%</em>`; };
const kpi = (label, val, sub, tone)=> `<div class="adm-kpi ${tone || ""}"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
function hbars(rows, total, labelOf){
  const max = Math.max(1, ...rows.map(r=> r.n));
  return rows.length ? `<ul class="adm-hbars">${rows.map(r=> `<li><span>${esc(labelOf(r.k))}</span><i><u style="width:${(r.n / max * 100).toFixed(1)}%"></u></i><b>${nf(r.n)}${total ? ` <small>${pc(pct(r.n, total))}</small>` : ""}</b></li>`).join("")}</ul>` : `<p class="adm-empty">Chưa có dữ liệu.</p>`;
}
function chart30(days){
  const max = Math.max(1, ...days.map(d=> d.dau)), w = 100 / days.length;
  const bars = days.map((d, i)=>{
    const h = Math.max(d.dau ? 1.5 : .5, d.dau / max * 36), hn = d.dau ? Math.min(h, d.nu / max * 36) : 0, x = (i * w + w * .16).toFixed(2), bw = (w * .68).toFixed(2);
    return `<g><title>${esc(fd(d.day))}: ${d.dau} hoạt động, ${d.nu} mới</title><rect class="a" x="${x}" y="${(38 - h).toFixed(2)}" width="${bw}" height="${h.toFixed(2)}" rx=".8"></rect>${hn > 0 ? `<rect class="n" x="${x}" y="${(38 - hn).toFixed(2)}" width="${bw}" height="${hn.toFixed(2)}" rx=".8"></rect>` : ""}</g>`;
  }).join("");
  return `<svg class="adm-bars adm-bars2" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Người dùng hoạt động 30 ngày">${bars}</svg>
    <div class="adm-bars-x"><span>${esc(fd(days[0].day))}</span><span class="adm-lg"><i class="a"></i>Hoạt động <i class="n"></i>Trong đó người mới</span><span>${esc(fd(days[days.length - 1].day))}</span></div>`;
}
function liveHtml(o, updatedAt){
  const chips = (rows, map)=> rows.map(r=> `<span class="adm-chip">${esc(map[r.k] || r.k)} · <b>${nf(r.n)}</b></span>`).join("");
  return `<div class="adm-live-top"><div class="adm-live-n"><i class="adm-dot${o.n ? " on" : ""}"></i><b>${nf(o.n)}</b><span>người đang dùng app</span></div>
      <div class="adm-live-sub"><span>${nf(o.signed)} đã đăng nhập</span><span>${nf(o.n - o.signed)} khách</span><small>Cập nhật ${esc(new Date(updatedAt).toLocaleTimeString("vi-VN"))}</small></div></div>
    ${o.n ? `<div class="adm-live-grid"><div><h4>Nền tảng</h4><div class="adm-chips">${chips(o.plat, LABELS.plat)}</div></div>
      <div><h4>Đang ở màn hình</h4>${hbars(o.scr, o.n, k=> LABELS.scr[k] || k)}</div></div>` : `<p class="adm-empty">Hiện chưa có ai đang mở app.</p>`}`;
}
function modelHtml(M){
  const t = M.t, guest = Math.max(0, t.dau - t.signed);
  const kp = [
    kpi("Hoạt động hôm nay", nf(t.dau), `Hôm qua ${nf(t.yest)}`),
    kpi("Người mới hôm nay", nf(t.nu), `${nf(t.ret)} người quay lại`),
    kpi("Tuần này", nf(M.wau.cur), `Tuần trước ${nf(M.wau.prev)}`),
    kpi("Tháng này", nf(M.mau.cur), `Tháng trước ${nf(M.mau.prev)}`),
    kpi("Trung bình 7 ngày", String(M.avg7).replace(".", ","), `người/ngày ${delta(M.avg7, M.avgPrev7)}`),
    kpi("Độ gắn bó", pc(M.stick), "trung bình ngày ÷ người dùng tháng"),
  ].join("");
  const fn = M.funnel, top = fn[0].n;
  const funnel = top ? `<ol class="adm-funnel">${fn.map((s, i)=> `<li><div><span>${esc(funnelLabel(s.k))}</span><b>${nf(s.n)} <small>${pc(pct(s.n, top))}</small></b></div><i><u style="width:${Math.max(2, s.n / top * 100).toFixed(1)}%"></u></i>${i && fn[i - 1].n ? `<em>${s.k === "signup" ? "so với người mới: " + pc(pct(s.n, top)) : s.n >= fn[i - 1].n ? "giữ đủ" : "−" + Math.round((1 - s.n / fn[i - 1].n) * 100) + "% so với bước trước"}</em>` : ""}</li>`).join("")}</ol>` : `<p class="adm-empty">Chưa có người mới trong 7 ngày qua.</p>`;
  const R = M.ret, retBox = (lbl, r)=> `<div class="adm-ret"><span>${lbl}</span><b>${r.base ? pc(r.rate) : "—"}</b><small>${r.base ? `${nf(r.back)} / ${nf(r.base)} người` : "chưa đủ ngày"}</small></div>`;
  const coh = `<div class="adm-table adm-coh"><div class="adm-tr adm-th"><span>Ngày đầu dùng</span><span>Người mới</span><span>Quay lại hôm sau</span></div>${M.cohorts.map(c=> `<div class="adm-tr"><span>${esc(fd(c.day))}</span><span>${nf(c.size)}</span><span>${c.d1 == null ? "chưa trọn ngày" : c.size ? `${nf(c.d1)} · ${pc(pct(c.d1, c.size))}` : "—"}</span></div>`).join("")}</div>`;
  const ins = `<ul class="adm-ins">${M.insights.map(i=> `<li class="${esc(i.tone)}">${ic(i.tone === "warn" ? "adm_flag" : i.tone === "good" ? "check" : "adm_chart")}<span>${esc(i.text)}</span></li>`).join("")}</ul>`;
  return `<div class="adm-kpis">${kp}</div>
    ${card(`${ic("adm_chart")}Nhận định`, ins)}
    ${card(`${ic("adm_chart")}Người dùng hoạt động 30 ngày`, chart30(M.days))}
    <div class="adm-grid2">
      ${card(`${ic("adm_users")}Giữ chân người mới`, `<div class="adm-rets">${retBox("Ngày 1", R.d1)}${retBox("Ngày 7", R.d7)}${retBox("Ngày 30", R.d30)}</div>${coh}<p class="adm-sub">Tỉ lệ người mới mở lại app đúng 1, 7, 30 ngày sau ngày đầu tiên. Tính trên các nhóm đã qua trọn ngày đó.</p>`)}
      ${card(`${ic("adm_flag")}Phễu kích hoạt · người mới 7 ngày`, `${funnel}<p class="adm-sub">Các bước người mới làm được ngay trong ngày đầu tiên. Tạo tài khoản là tuỳ chọn nên được đếm riêng.</p>`)}
    </div>
    <div class="adm-grid2">
      ${card(`${ic("adm_dash")}Tính năng được dùng · 7 ngày`, `${hbars(M.features.filter(f=> f.n > 0), M.active7, k=> LABELS.feat[k] || k)}<p class="adm-sub">Số lượt người dùng/ngày có chạm vào tính năng; phần trăm so với ${nf(M.active7)} lượt hoạt động trong 7 ngày.</p>`)}
      ${card(`${ic("adm_bcast")}Nguồn người mới · 7 ngày`, hbars(M.sources, top, k=> LABELS.src[k] || k) + `<p class="adm-sub">Gắn <code>?utm_source=tiktok</code> (facebook, zalo, youtube…) vào link chia sẻ để phân biệt chính xác từng kênh.</p>`)}
    </div>
    <div class="adm-grid2">
      ${card(`${ic("adm_dash")}Nền tảng`, `<h4 class="adm-h4">Hôm nay</h4>${hbars(t.plat.filter(p=> p.n > 0), t.dau, k=> LABELS.plat[k])}<h4 class="adm-h4">Tháng này</h4>${hbars(M.mau.plat.filter(p=> p.n > 0), M.mau.cur, k=> LABELS.plat[k])}`)}
      ${card(`${ic("adm_users")}Người dùng hôm nay`, `${hbars([{ k:"signed", n: t.signed }, { k:"guest", n: guest }].filter(x=> x.n > 0), t.dau, k=> k === "signed" ? "Đã đăng nhập" : "Khách (chưa đăng nhập)")}<h4 class="adm-h4">Ngôn ngữ</h4>${hbars(t.lang.filter(l=> l.n > 0), t.dau, k=> LABELS.lang[k])}`)}
    </div>
    <p class="adm-note">${ic("adm_lock")}Số liệu ẩn danh: mỗi thiết bị một mã ngẫu nhiên, không gắn tài khoản, email hay địa chỉ IP. Ngày tính theo giờ Việt Nam. Người đã từ chối thống kê hoặc bật “Không theo dõi” trên trình duyệt không được đếm, nên con số thực tế có thể cao hơn. Một người dùng hai thiết bị được đếm là hai.</p>`;
}

function csv(M){
  const cell = v=>{ let s = String(v == null ? "" : v); if(/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [["Ngày", "Người dùng hoạt động", "Người mới"]].concat(M.days.map(d=> [d.day, d.dau, d.nu]));
  return "﻿" + rows.map(r=> r.map(cell).join(",")).join("\r\n");
}
function download(name, text){
  try{ if(G.TapEv && G.TapEv.downloadFile){ G.TapEv.downloadFile(name, text, "text/csv;charset=utf-8"); return true; } }catch(e){}
  try{ const b = new Blob([text], { type:"text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500); return true; }catch(e){ return false; }
}

/* ---------------- 5. Trực tuyến: nghe Firestore (hoặc đọc demo) ---------------- */
let _live = null;
function stopLive(){ if(_live){ try{ _live.unsub && _live.unsub(); }catch(e){} clearInterval(_live.timer); _live = null; } }
function startLive(box){
  stopLive();
  const L = _live = { list: [], unsub: null, timer: null, err: null, at: Date.now() };
  const paint = ()=>{
    if(!box.isConnected){ stopLive(); return; }                      // đã rời mục Phân tích / đóng bảng quản trị
    if(!isFb()){ const p = (G.FKPulse && G.FKPulse.demoStore().presence) || {}; L.list = Object.keys(p).map(k=> p[k]); L.at = Date.now(); }
    box.innerHTML = L.err ? `<p class="adm-empty">Không đọc được danh sách trực tuyến: ${esc(L.err)}</p>` : liveHtml(online(L.list, Date.now()), L.at);
  };
  const subscribe = ()=>{
    try{ L.unsub && L.unsub(); }catch(e){}
    if(!isFb()) return;
    try{
      const since = new Date(Date.now() - 10 * 60000);
      L.unsub = G.firebase.firestore().collection("presence").where("ts", ">", since).limit(2000).onSnapshot(snap=>{
        L.list = snap.docs.map(d=>{ const x = d.data() || {}; return { ts: x.ts && x.ts.toMillis ? x.ts.toMillis() : Date.now(), p: x.p, s: x.s, l: x.l, a: x.a }; });
        L.at = Date.now(); L.err = null; paint();
      }, e=>{ L.err = (e && e.code === "permission-denied") ? "phiên quản trị đã hết hạn — đăng nhập lại bảng quản trị." : (e && e.message || "lỗi mạng"); paint(); });
    }catch(e){ L.err = e && e.message || "lỗi"; }
  };
  subscribe(); paint();
  let ticks = 0;
  L.timer = setInterval(()=>{ ticks++; if(ticks % 60 === 0) subscribe(); paint(); }, 10000);   // 10 giây vẽ lại; 10 phút đăng ký lại (dời mốc thời gian)
}
/** Dọn presence cũ hơn 2 ngày (tối đa 300 tài liệu / lần mở) — giữ bộ sưu tập nhỏ */
async function sweep(){
  if(!isFb()) return 0;
  try{
    const db = G.firebase.firestore(), snap = await db.collection("presence").where("ts", "<", new Date(Date.now() - 2 * DAY_MS)).limit(300).get();
    if(snap.empty) return 0;
    const b = db.batch(); snap.docs.forEach(d=> b.delete(d.ref)); await b.commit(); return snap.size;
  }catch(e){ return 0; }
}

async function render(el){
  el.innerHTML = `<div class="adm-hello"><div><h2>Phân tích</h2><p><span>Ai đang dùng app, họ đến từ đâu, có quay lại không và dùng tính năng nào.</span></p></div>
      <div class="adm-acts"><button class="adm-btn sm" data-an="reload">${ic("adm_log")}Làm mới</button>${can("data.export") ? `<button class="adm-btn sm" data-an="csv">${ic("adm_down")}Xuất CSV 30 ngày</button>` : ""}</div></div>
    ${card(`${ic("adm_users")}Đang trực tuyến`, `<div class="adm-live" data-an-live><p class="adm-empty">Đang kết nối…</p></div>`)}
    <div data-an-body><p class="adm-empty">Đang tải số liệu…</p></div>`;
  const body = el.querySelector("[data-an-body]");
  startLive(el.querySelector("[data-an-live]"));
  const load = async force=>{
    try{ const M = await fetchModel(force); if(body.isConnected) body.innerHTML = modelHtml(M); return M; }
    catch(e){ if(body.isConnected) body.innerHTML = `<p class="adm-empty">Không tải được số liệu: ${esc(e && e.message || "lỗi")}. ${isFb() ? "Nếu vừa cập nhật app, hãy chạy lại workflow Firebase để triển khai hàm adminAnalytics." : ""}</p>`; return null; }
  };
  el.querySelector(".adm-acts").addEventListener("click", async ev=>{      // gắn vào phần tử vẽ lại mỗi lần → không cộng dồn trình nghe
    const b = ev.target.closest && ev.target.closest("[data-an]"); if(!b) return;
    if(b.dataset.an === "reload"){ b.disabled = true; await load(true); b.disabled = false; }
    if(b.dataset.an === "csv" && can("data.export")){
      const M = await load(false); if(!M) return;
      download(`tapeasy-hoat-dong-${M.today}.csv`, csv(M));
      try{ G.cloudAdmin && G.cloudAdmin.appendAudit && G.cloudAdmin.appendAudit({ action:"data.export", target:{ type:"csv", id:"analytics" }, details:{ what:"analytics.daily", rows: M.days.length } }).catch(()=>{}); }catch(e){}
    }
  });
  await load(false);
  sweep();
}

function register(){
  try{ if(G.TE_ADMIN && G.TE_ADMIN.registerSection){ G.TE_ADMIN.registerSection({ id:"analytics", title:"Phân tích", icon:"adm_chart", order:15, perms:["analytics.view"], render }); return true; } }catch(e){}
  return false;
}
G.TE_ADMIN_ANALYTICS = { __v: 1, wanted, build, insights, online, fetch: fetchModel, frame, modelHtml, liveHtml, csv, register, LABELS, FEATURES, SOURCES, ONLINE_MS, stopLive };
register();
})(typeof window !== "undefined" ? window : globalThis);
