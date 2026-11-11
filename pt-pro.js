/* =========================================================================
   TapEasy — PT PRO (pt-pro.js + pt-pro.css)
   Nâng cấp khu PT ↔ Học viên (coach.js), nạp SAU pt.js:
   1. Hồ sơ sức khoẻ học viên: PAR-Q 7 câu, chấn thương/bệnh lý, mục tiêu chi tiết,
      số đo theo ngày + biểu đồ xu hướng SVG, ảnh tiến trình (nén ~600px JPEG)
      → tab "Sức khoẻ" trong form học viên (PT và học viên đều xem/cập nhật)
   2. Cảnh báo cho PT + thẻ "Việc cần làm hôm nay" trên màn PT
   3. Lịch tổng hợp mọi học viên theo ngày/tuần, phát hiện trùng giờ
   4. Giao nguyên giáo án mẫu (PROGRAM_TEMPLATES) → tạo hàng loạt buổi tập
   5. Gói tập & doanh thu: giá gói, thanh toán, gia hạn, công nợ, doanh thu tháng
   6. Tìm kiếm / lọc / sắp xếp danh sách học viên
   Dữ liệu lưu trong client doc: health, measurements, photos, pkg, payments
   (qua cloud.updateClient). Trạng thái giao diện: state.ptPro.
   ========================================================================= */

const PTP = (()=>{
"use strict";

/* ---------------------------------------------------------------------
   0. HẰNG SỐ CHUYÊN MÔN
   --------------------------------------------------------------------- */
const DAY_MS = 86400000;
const MAX_PHOTOS = 12;
const MAX_PHOTO_CHARS = 650000;   // tổng dataURL ảnh / học viên (Firestore giới hạn 1 MiB / doc)

/* PAR-Q (Physical Activity Readiness Questionnaire, bản chuẩn 7 câu — CSEP) */
const PARQ = [
  "Bác sĩ đã từng nói bạn có vấn đề về tim và chỉ nên vận động thể lực theo khuyến nghị của bác sĩ?",
  "Bạn có cảm thấy đau ngực khi vận động thể lực không?",
  "Trong tháng vừa qua, bạn có bị đau ngực cả khi KHÔNG vận động không?",
  "Bạn có từng mất thăng bằng vì chóng mặt, hoặc từng bị ngất (mất ý thức) không?",
  "Bạn có vấn đề về xương hoặc khớp (ví dụ lưng, gối, hông) có thể nặng hơn khi thay đổi mức vận động không?",
  "Bác sĩ có đang kê thuốc cho bạn để điều trị huyết áp hoặc bệnh tim (ví dụ thuốc lợi tiểu) không?",
  "Bạn có biết bất kỳ lý do nào khác khiến bạn không nên vận động thể lực không?",
];

/* Số đo: thứ tự theo phiếu đo; good = hướng thay đổi tốt theo mục tiêu (lose / gain) */
const MEASURES = [
  { k:"weight", label:"Cân nặng", short:"Cân nặng", unit:"kg", min:25, max:300, step:"0.1", good:{ lose:-1, gain:1 } },
  { k:"waist",  label:"Vòng eo",  short:"Eo",   unit:"cm", min:30, max:250, step:"0.5", good:{ lose:-1, gain:0 } },
  { k:"hip",    label:"Vòng mông", short:"Mông", unit:"cm", min:40, max:250, step:"0.5", good:{ lose:-1, gain:1 } },
  { k:"chest",  label:"Vòng ngực", short:"Ngực", unit:"cm", min:40, max:250, step:"0.5", good:{ lose:0, gain:1 } },
  { k:"arm",    label:"Vòng tay",  short:"Tay",  unit:"cm", min:10, max:80,  step:"0.5", good:{ lose:0, gain:1 } },
  { k:"thigh",  label:"Vòng đùi",  short:"Đùi",  unit:"cm", min:20, max:120, step:"0.5", good:{ lose:-1, gain:1 } },
  { k:"fat",    label:"% mỡ cơ thể", short:"% mỡ", unit:"%", min:3, max:70, step:"0.1", good:{ lose:-1, gain:-1 } },
];
const MEASURE_TIPS = "Đo buổi sáng, sau khi đi vệ sinh và trước khi ăn. Eo: ngang rốn, thở ra nhẹ. Mông: chỗ nở nhất. Ngực: ngang núm vú. Tay: giữa bắp tay phải, thả lỏng. Đùi: dưới nếp mông 2–3 cm. Dùng cùng một thước dây, kéo vừa sát da.";
const PHOTO_TIPS = "Chụp cùng giờ (sáng, trước ăn), cùng ánh sáng và trang phục, máy ngang ngực, cách 2–3 m. Đủ 3 góc: trước – nghiêng – sau, 2–4 tuần một lần.";
const POSES = { front:"Mặt trước", side:"Nghiêng", back:"Mặt sau" };

const INJURY_AREAS = ["Cổ","Vai","Khuỷu tay","Cổ tay","Lưng trên","Lưng dưới","Hông","Gối","Cổ chân","Khác"];
const DISEASES = ["Tăng huyết áp","Tiểu đường","Hen suyễn","Tim mạch","Thoát vị đĩa đệm","Loãng xương","Mang thai / sau sinh","Khác"];
const AVOID_HINTS = {
  "Cổ":"Không đặt tạ đè lên cổ, tránh kéo đầu khi gập bụng; giữ cổ trung tính.",
  "Vai":"Tránh đẩy qua đầu, dips, kéo xà sau gáy khi còn đau; ưu tiên tầm vận động không đau và bài xoay ngoài vai.",
  "Khuỷu tay":"Giảm bài duỗi tay sau nặng (skullcrusher), kéo xà tay hẹp; dùng tay cầm trung tính.",
  "Cổ tay":"Dùng tay cầm trung tính, chống đẩy trên tay cầm/nắm tay; quấn cổ tay khi đẩy nặng.",
  "Lưng trên":"Tránh gù lưng khi kéo; ưu tiên bài mở ngực, kéo cáp nhẹ, kiểm soát bả vai.",
  "Lưng dưới":"Tránh gập lưng tròn khi mang tạ, hạn chế deadlift nặng và gập bụng sit-up; ưu tiên bài ổn định lõi (dead bug, bird dog).",
  "Hông":"Hạn chế biên độ gập hông sâu khi đau, tránh xoay hông mạnh có tải.",
  "Gối":"Hạn chế nhảy bật, squat/lunge quá sâu khi đau; tập trong biên độ không đau, tăng tải từ từ.",
  "Cổ chân":"Tránh nhảy dây, bật nhảy; ưu tiên bài trên máy hoặc tư thế ngồi.",
  "Tăng huyết áp":"Không nín thở khi gắng sức (Valsalva), hạn chế tạ rất nặng và tư thế đầu thấp hơn tim lâu; đo huyết áp trước buổi tập.",
  "Tiểu đường":"Kiểm tra đường huyết trước/sau tập, mang theo đồ ngọt hấp thu nhanh, chú ý bàn chân và giày.",
  "Hen suyễn":"Khởi động kỹ 10–15 phút, mang theo thuốc xịt, tránh môi trường lạnh khô, bụi.",
  "Tim mạch":"Chỉ tập theo chỉ định bác sĩ, theo dõi nhịp tim; dừng ngay nếu đau ngực, khó thở, choáng.",
  "Thoát vị đĩa đệm":"Tránh nén cột sống nặng (squat tạ vai nặng) và gập–xoay lưng có tải.",
  "Loãng xương":"Tránh gập lưng tròn có tải và xoay vặn mạnh; ưu tiên bài chịu lực vừa phải, giữ thăng bằng.",
  "Mang thai / sau sinh":"Cần xác nhận của bác sĩ; tránh nằm ngửa lâu sau 3 tháng đầu, kiểm tra tách cơ bụng trước khi tập bụng.",
};
const GOAL_MAIN = ["Giảm mỡ","Tăng cơ","Tăng sức mạnh","Sức bền / thể lực","Cải thiện vóc dáng","Sức khoẻ chung","Phục hồi chấn thương"];
const LEVELS = { beginner:"Mới tập (< 6 tháng)", intermediate:"Trung bình (6–24 tháng)", advanced:"Nâng cao (> 2 năm)" };
const PAY_METHODS = ["Chuyển khoản","Tiền mặt","Ví điện tử (MoMo, ZaloPay…)","Thẻ"];
const PAY_KIND = { new:"Gói mới", renew:"Gia hạn", current:"Gói hiện tại", debt:"Thu nợ" };
const PKG_STATE = { active:"Đang tập", paused:"Tạm nghỉ", ended:"Đã kết thúc" };
const FILTERS = [
  { id:"all", label:"Tất cả" }, { id:"attention", label:"Cần chú ý" }, { id:"active", label:"Đang hoạt động" },
  { id:"low", label:"Sắp hết gói" }, { id:"unlinked", label:"Chưa kết nối" }, { id:"paused", label:"Tạm nghỉ" },
];
const SORTS = [
  { id:"next", label:"Buổi tới gần nhất" }, { id:"attention", label:"Cần chú ý trước" }, { id:"name", label:"Tên A → Z" },
  { id:"remain", label:"Còn ít buổi nhất" }, { id:"recent", label:"Mới cập nhật" },
];
const WD = ["CN","T2","T3","T4","T5","T6","T7"];

/* ---------------------------------------------------------------------
   1. TIỆN ÍCH THUẦN (không phụ thuộc DOM — kiểm thử được bằng Node)
   --------------------------------------------------------------------- */
const pad = n=> String(n).padStart(2,"0");
const dstr = d=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dparse = s=>{ const [y,m,d] = String(s||"").split("-").map(Number); return new Date(y||1970, (m||1)-1, d||1); };
const dadd = (s, n)=>{ const x = dparse(s); x.setDate(x.getDate()+n); return dstr(x); };
const ddiff = (a, b)=> Math.round((dparse(b) - dparse(a))/DAY_MS);     // b − a (ngày)
const isDate = s=> /^\d{4}-\d{2}-\d{2}$/.test(String(s||""));
const ddmm = s=>{ const x = dparse(s); return `${pad(x.getDate())}/${pad(x.getMonth()+1)}`; };
const ddmmyy = s=>{ const x = dparse(s); return `${pad(x.getDate())}/${pad(x.getMonth()+1)}/${x.getFullYear()}`; };
const wdLabel = s=> WD[dparse(s).getDay()];
const mondayOf = s=>{ const x = dparse(s); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return dstr(x); };
const startOf = s=>{ const x = dparse(s.date); const [h,m] = String(s.time||"00:00").split(":").map(Number); x.setHours(h||0, m||0, 0, 0); return x.getTime(); };
const durOf = s=> Math.max(15, Math.min(240, Number(s.duration)||60));
const hm = ms=>{ const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const num = v=>{ if(v===null || v===undefined || v==="") return null; const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const r1 = n=> Math.round(n*10)/10;
const fmtNum = (n, d=1)=> n==null ? "—" : Number(n).toLocaleString("vi-VN", { maximumFractionDigits:d });
const money = n=> `${Math.round(Number(n)||0).toLocaleString("vi-VN")} đ`;
function moneyShort(n){
  n = Math.round(Number(n)||0); const a = Math.abs(n);
  if(a >= 1e9) return `${fmtNum(n/1e9, 2)} tỷ`;
  if(a >= 1e6) return `${fmtNum(n/1e6, 1)} tr`;
  if(a >= 1e3) return `${fmtNum(n/1e3, 0)}k`;
  return `${n} đ`;
}
const norm = s=> String(s||"").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
const rid = p=> `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
const clean = o=> JSON.parse(JSON.stringify(o));     // bỏ undefined trước khi ghi Firestore
const ymOf = s=> String(s||"").slice(0,7);
const ymAdd = (ym, n)=>{ const [y,m] = ym.split("-").map(Number); const d = new Date(y, m-1+n, 1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };

function doneCount(ss){ return (ss||[]).filter(s=> s.status==="done").length; }
/* QP-13 (fix-pt): buổi "vắng / huỷ muộn" bị TRỪ GÓI theo chính sách huỷ PT niêm yết (s.charged); huỷ báo trước / PT huỷ: không trừ */
function chargedCount(ss){ return (ss||[]).filter(s=> s.status==="cancelled" && s.charged===true).length; }
function usedCount(ss){ return doneCount(ss) + chargedCount(ss); }
function remaining(c, ss){ const t = Number(c && c.packageTotal)||0; return t ? t - usedCount(ss) : null; }
/* Chính sách khi học viên vắng: "auto" = theo niêm yết Tìm PT (Linh hoạt → không trừ; Tiêu chuẩn/Chặt → trừ 1 buổi), hoặc PT tự đặt 0 / 1 */
const CANCEL_KINDS = {
  notice: { label:"Huỷ báo trước", note:"không trừ buổi", charge:false },
  late:   { label:"Vắng / huỷ muộn", note:"trừ 1 buổi theo chính sách", charge:true },
  pt:     { label:"PT huỷ / đổi lịch", note:"không trừ, bù buổi", charge:false },
};
function absentChargeDefault(policy, cancelKey){
  if(policy === 0 || policy === "0") return false;
  if(policy === 1 || policy === "1") return true;
  return cancelKey === "moderate" || cancelKey === "strict";
}
function pkgState(c){ return (c && c.pkg && c.pkg.state) || "active"; }

/* Số buổi vắng liên tiếp gần nhất (buổi "Huỷ / vắng"); buổi quá hạn chưa xác nhận không tính */
function absentStreak(ss, now){
  const past = (ss||[]).filter(s=> s.status!=="scheduled" && startOf(s) < now).sort((a,b)=> startOf(b)-startOf(a));
  let n = 0;
  for(const s of past){ if(s.status==="cancelled") n++; else if(s.status==="done") break; }
  return n;
}
function overdueCount(ss, now){ return (ss||[]).filter(s=> s.status==="scheduled" && startOf(s) < now - 3*3600000).length; }
function nextWithin(ss, now, days){
  return (ss||[]).filter(s=> s.status==="scheduled" && startOf(s) >= now - 3600000 && startOf(s) <= now + days*DAY_MS)
    .sort((a,b)=> startOf(a)-startOf(b))[0] || null;
}
function isActive(c, ss, now){
  if(pkgState(c)!=="active") return false;
  return (ss||[]).some(s=>{ const t = startOf(s);
    return (s.status==="done" && t >= now - 30*DAY_MS) || (s.status==="scheduled" && t >= now - 3*3600000 && t <= now + 14*DAY_MS); });
}
function birthday(dob, today){
  if(!isDate(dob)) return null;
  const t = dparse(today), [y,m,d] = dob.split("-").map(Number);
  let next = new Date(t.getFullYear(), m-1, d); if(next < t) next = new Date(t.getFullYear()+1, m-1, d);
  return { days: Math.round((next - t)/DAY_MS), age: next.getFullYear() - y, date: dstr(next) };
}
function ageOf(dob, today){
  if(!isDate(dob)) return null;
  const t = dparse(today), b = dparse(dob);
  let a = t.getFullYear() - b.getFullYear();
  if(t.getMonth() < b.getMonth() || (t.getMonth()===b.getMonth() && t.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
/* QP-05 (fix-pt): xác nhận bác sĩ chỉ do PT ghi — trường riêng clients.parqClearance (học viên không ghi được theo rules hiện có),
   gắn với đúng bộ câu trả lời PAR-Q; health.parq.clearance cũ (ai cũng ghi được) KHÔNG còn làm mất cảnh báo. */
function clearanceValid(p, clr){
  return !!(clr && clr.ok === true && clr.by === "pt" && p && Array.isArray(p.answers) && clr.answers === p.answers.join());
}
function parqStatus(h, today, clr){
  const p = h && h.parq;
  if(!p || !Array.isArray(p.answers) || p.answers.length!==PARQ.length || p.answers.some(a=> a!==true && a!==false)) return { state:"none", yes:0 };
  const yes = p.answers.filter(Boolean).length;
  const stale = isDate(p.date) && today ? ddiff(p.date, today) > 365 : false;
  const legacy = !!(p.clearance && p.clearance.ok);
  return { state: yes ? (clearanceValid(p, clr) ? "cleared" : "refer") : "ok", yes, date:p.date, stale, legacyClearance: yes && legacy && !clearanceValid(p, clr) };
}
function paidIn(c, ym){ return (c.payments||[]).filter(p=> !ym || ymOf(p.date)===ym).reduce((a,p)=> a + (Number(p.amount)||0), 0); }
function outstanding(c){
  const ps = c.payments||[];
  return Math.max(0, ps.reduce((a,p)=> a + (Number(p.price)||0), 0) - ps.reduce((a,p)=> a + (Number(p.amount)||0), 0));
}
function sortedMeasures(c){ return (c.measurements||[]).filter(m=> isDate(m.date)).slice().sort((a,b)=> a.date.localeCompare(b.date)); }
function latestValues(ms){
  const out = {}, first = {};
  ms.forEach(m=> MEASURES.forEach(f=>{ const v = num(m[f.k]); if(v!=null){ out[f.k] = { v, date:m.date }; if(!first[f.k]) first[f.k] = { v, date:m.date }; } }));
  return { last: out, first };
}
function goalDir(h){
  const g = (h && h.goal && h.goal.main) || "";
  if(/Giảm mỡ|vóc dáng/i.test(g)) return "lose";
  if(/Tăng cơ|sức mạnh/i.test(g)) return "gain";
  return null;
}
function bmiInfo(w, hcm){
  if(!w || !hcm) return null;
  const b = w / Math.pow(hcm/100, 2);
  // Ngưỡng WHO cho người châu Á – Thái Bình Dương
  const cls = b < 18.5 ? "Thiếu cân" : b < 23 ? "Bình thường" : b < 25 ? "Thừa cân" : b < 30 ? "Béo phì độ I" : "Béo phì độ II";
  return { v: r1(b), cls, ok: b >= 18.5 && b < 23 };
}
function whrInfo(waist, hip, gender){
  if(!waist || !hip) return null;
  const v = Math.round(waist/hip*100)/100, lim = gender==="female" ? 0.85 : 0.90;   // ngưỡng WHO
  return { v, risk: v >= lim, lim };
}

/* Cảnh báo cho 1 học viên — lv: 3 khẩn, 2 nên làm, 1 gợi ý */
function clientAlerts(c, ss, now, today){
  const A = [], h = c.health || {}, st = pkgState(c);
  const push = (type, lv, icon, text, act, go)=> A.push({ type, lv, icon, text, act, go, key:`${c.id}:${type}` });
  const rem = remaining(c, ss);
  const live = st==="active";
  if(live){
    const streak = absentStreak(ss, now);
    if(streak >= 2) push("absent", 3, "event_busy", `Vắng ${streak} buổi liên tiếp`, "Hỏi thăm", "msg_absent");
    const pk = c.pkg || {};
    let expTxt = "";
    if(isDate(pk.expiry) && (rem === null || rem > 0)){
      const dl = ddiff(today, pk.expiry);
      if(dl < 0) expTxt = `hết hạn từ ${ddmm(pk.expiry)}`;
      else if(dl <= 7) expTxt = dl===0 ? "hết hạn hôm nay" : `hết hạn sau ${dl} ngày`;
    }
    if(rem !== null && rem <= 0) push("pkg_out", 3, "payments", rem < 0 ? `Đã tập vượt gói ${-rem} buổi` : "Đã dùng hết gói", "Gia hạn", "renew");
    else if(rem !== null && rem <= 3) push("pkg_low", 2, "payments", `Gói còn ${rem} buổi${expTxt ? ", "+expTxt : ""}`, "Gia hạn", "renew");
    else if(expTxt) push("pkg_exp", 2, "event", `Gói ${expTxt}`, "Gia hạn", "renew");
    const ov = overdueCount(ss, now);
    if(ov) push("overdue", 2, "schedule", `${ov} buổi quá hạn chưa xác nhận`, "Xác nhận", "tab:schedule");
    if((rem === null || rem > 0) && !nextWithin(ss, now, 7)) push("no_upcoming", 2, "edit_calendar", "Chưa có buổi nào trong 7 ngày tới", "Xếp lịch", "tab:schedule");
  }
  const debt = outstanding(c);
  if(debt > 0) push("debt", 2, "account_balance_wallet", `Còn nợ ${moneyShort(debt)}`, "Thu tiền", "pay");
  const bd = birthday(h.dob, today);
  if(bd && bd.days <= 7) push("birthday", bd.days===0 ? 2 : 1, "cake",
    bd.days===0 ? `Hôm nay sinh nhật (${bd.age} tuổi)` : bd.days===1 ? `Sinh nhật ngày mai (${bd.age} tuổi)` : `Sinh nhật ${wdLabel(bd.date)} ${ddmm(bd.date)}`, "Chúc mừng", "msg_bday");
  const pq = parqStatus(h, today, c.parqClearance);
  if(pq.state==="refer") push("parq", 3, "health_and_safety", `PAR-Q có ${pq.yes} câu "Có" — cần ý kiến bác sĩ`, "Xem", "tab:ptp_health");
  else if(live && pq.state==="none") push("parq_none", 1, "quiz", "Chưa làm PAR-Q sàng lọc", "Làm", "tab:ptp_health");
  else if(live && pq.stale) push("parq_old", 1, "quiz", "PAR-Q đã quá 12 tháng", "Làm lại", "tab:ptp_health");
  if(live){
    const ms = sortedMeasures(c);
    if(!ms.length){ if(!isDate(c.startDate) || ddiff(c.startDate, today) >= 3) push("measure", 1, "straighten", "Chưa có số đo đầu vào", "Đo", "tab:ptp_health"); }
    else { const d = ddiff(ms[ms.length-1].date, today); if(d >= 28) push("measure", 1, "straighten", `${d} ngày chưa đo lại`, "Đo", "tab:ptp_health"); }
  }
  return A.sort((a,b)=> b.lv - a.lv);
}

/* Buổi tập của mọi học viên (PT) trong khoảng thời gian — bỏ buổi huỷ */
function ptItems(clients, sessMap, from, to, withCancelled){
  const out = [];
  (clients||[]).forEach(c=> ((sessMap||{})[c.id]||[]).forEach(s=>{
    if(!withCancelled && s.status==="cancelled") return;
    const st = startOf(s), en = st + durOf(s)*60000;
    if(en <= from || st >= to) return;
    out.push({ key:`${c.id}:${s.id}`, cid:c.id, sid:s.id, name:c.name||"Học viên", s, start:st, end:en });
  }));
  return out.sort((a,b)=> a.start-b.start || a.end-b.end);
}
function findConflicts(items){
  const list = items.filter(i=> i.s.status!=="cancelled").slice().sort((a,b)=> a.start-b.start);
  const pairs = [], keys = new Set();
  for(let i=0; i<list.length; i++) for(let j=i+1; j<list.length && list[j].start < list[i].end; j++){
    pairs.push([list[i], list[j]]); keys.add(list[i].key); keys.add(list[j].key);
  }
  return { pairs, keys };
}
/* Xếp làn cho các khối chồng giờ (lịch ngày) */
function layoutLanes(items){
  const sorted = items.slice().sort((a,b)=> a.start-b.start || a.end-b.end);
  let group = [], groupEnd = -Infinity;
  const flush = ()=>{ const n = group.reduce((m,g)=> Math.max(m, g.lane+1), 1); group.forEach(g=> g.lanes = n); group = []; };
  sorted.forEach(it=>{
    if(it.start >= groupEnd){ flush(); groupEnd = -Infinity; }
    const used = new Set(group.filter(g=> g.end > it.start).map(g=> g.lane));
    let lane = 0; while(used.has(lane)) lane++;
    it.lane = lane; group.push(it); groupEnd = Math.max(groupEnd, it.end);
  });
  flush();
  return sorted;
}

/* Tạo danh sách buổi từ giáo án mẫu
   opts: { start, weeks, time, mode, days:[ "T2",… ], deload, batch } ; exLookup(id) → EXERCISES[id] */
function buildProgramSessions(t, opts, exLookup){
  const out = [];
  if(!t || !t.days) return out;
  const weeks = Math.max(1, Math.min(24, Number(opts.weeks)||1));
  for(let i=0; i<weeks*7; i++){
    const date = dadd(opts.start, i), k = WD[dparse(date).getDay()];
    if(!(opts.days||[]).includes(k)) continue;
    const d = t.days[k];
    if(!d || !d.ex || !d.ex.length) continue;
    const week = Math.floor(i/7) + 1;
    const deload = !!opts.deload && week % 6 === 0;
    out.push({
      date, time: opts.time || "18:00", mode: opts.mode || "offline", status:"scheduled",
      title: d.title + (deload ? " · tuần giảm tải" : ""),
      ptNote: `Giáo án "${t.name}" — tuần ${week}/${weeks}. ` + (deload
        ? "Tuần giảm tải: bớt ~40% số hiệp, giữ mức tạ, ưu tiên kỹ thuật và phục hồi."
        : "Dừng cách thất bại 1–2 lần (RIR 1–2); khi mọi hiệp đạt đỉnh khoảng lần thì tăng tạ nhỏ nhất."),
      duration: Number(d.duration) || 60, seenByStudent:false,
      program: { tplId:t.id, name:t.name, batch:opts.batch, week, weeks },
      exercises: d.ex.map(([id, sets, reps, rest], j)=>{
        const m = (exLookup && exLookup(id)) || {};
        const s2 = deload ? Math.max(1, Math.round((Number(sets)||1)*0.6)) : (Number(sets)||1);
        return { uid:`${opts.batch}_${i}_${j}`, exId:id, name: m.name || id, sets:s2, reps:String(reps), restSec:Number(rest)||0,
          img: m.img || "", guide: m.guide || "", muscle: m.muscle || "", videoUrl:"", done:false };
      }),
    });
  }
  return out;
}
function suggestExpiry(base, sessions){ return dadd(base, Math.ceil((Number(sessions)||0)/2)*7 + 7); }

/* Biểu đồ xu hướng SVG (viewBox 300×150) */
let _gid = 0;
function trendSVG(pts, o){
  o = o || {};
  const W = 300, H = 150, L = 10, R = 14, T = 24, B = 26;
  if(!pts.length) return "";
  const xs = pts.map(p=> dparse(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if(x1 === x0){ x0 -= 3*DAY_MS; x1 += 3*DAY_MS; }
  const vals = pts.map(p=> p.v).concat(o.target!=null ? [o.target] : []);
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  const padY = (y1-y0)*0.18 || Math.max(1, Math.abs(y1)*0.03); y0 -= padY; y1 += padY;
  const X = t=> L + (t-x0)/(x1-x0)*(W-L-R), Y = v=> T + (1-(v-y0)/(y1-y0))*(H-T-B);
  const P = pts.map((p,i)=> [X(xs[i]), Y(p.v)]);
  const line = P.map((p,i)=> `${i?"L":"M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const id = `ptpg${++_gid}`;
  const area = `${line} L${P[P.length-1][0].toFixed(1)} ${H-B} L${P[0][0].toFixed(1)} ${H-B} Z`;
  const grid = [0.25, 0.5, 0.75].map(f=>{ const y = (T + f*(H-T-B)).toFixed(1); return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" class="g"/>`; }).join("");
  const showAll = pts.length <= 6;
  const iMin = pts.reduce((m,p,i)=> p.v < pts[m].v ? i : m, 0), iMax = pts.reduce((m,p,i)=> p.v > pts[m].v ? i : m, 0);
  const labels = P.map((p,i)=>{
    if(!(showAll || i===0 || i===P.length-1 || i===iMin || i===iMax)) return "";
    const x = Math.max(L+12, Math.min(W-R-12, p[0]));
    return `<text x="${x.toFixed(1)}" y="${(p[1]-9).toFixed(1)}" text-anchor="middle" class="v${i===P.length-1?" last":""}">${fmtNum(pts[i].v)}</text>`;
  }).join("");
  const tgt = o.target!=null ? `<line x1="${L}" x2="${W-R}" y1="${Y(o.target).toFixed(1)}" y2="${Y(o.target).toFixed(1)}" class="t"/><text x="${W-R}" y="${(Y(o.target)-5).toFixed(1)}" text-anchor="end" class="tl">Mục tiêu ${fmtNum(o.target)}</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" class="ptp-svg" role="img" aria-label="${o.label||"Biểu đồ"}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5EE6C7" stop-opacity=".38"/><stop offset="1" stop-color="#5EE6C7" stop-opacity="0"/></linearGradient></defs>
    ${grid}${tgt}
    ${pts.length > 1 ? `<path d="${area}" fill="url(#${id})"/><path d="${line}" class="ln"/>` : ""}
    ${P.map((p,i)=> `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i===P.length-1?5:3.5}" class="${i===P.length-1?"dl":"d"}"/>`).join("")}
    ${labels}
    <text x="${L}" y="${H-6}" class="x">${ddmm(pts[0].date)}</text>
    ${pts.length > 1 ? `<text x="${W-R}" y="${H-6}" text-anchor="end" class="x">${ddmm(pts[pts.length-1].date)}</text>` : ""}
  </svg>`;
}

/* ---------------------------------------------------------------------
   2. TRẠNG THÁI GIAO DIỆN + TIỆN ÍCH DOM
   --------------------------------------------------------------------- */
const esc = s=> (typeof escapeHtml==="function" ? escapeHtml(s==null ? "" : s) : String(s==null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const ic = (n, cls)=> `<span class="material-symbols-rounded${cls?" "+cls:""}">${n}</span>`;
const isImg = d=> typeof d==="string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d);
const ui = { metric:"weight", cal:null, asg:null, showLow:false, cmpPose:"front" };

const _ptpFallback = {};
function ptpState(){
  const d = { q:"", filter:"all", sort:"next", done:{}, cal:"day" };
  const host = typeof state!=="undefined" ? state : null;
  let st = host ? host.ptPro : _ptpFallback;
  if(!st || typeof st!=="object"){ st = {}; if(host) host.ptPro = st; }
  Object.keys(d).forEach(k=>{ if(st[k]===undefined || st[k]===null) st[k] = d[k]; });
  if(!FILTERS.some(f=> f.id===st.filter)) st.filter = "all";
  if(!SORTS.some(s=> s.id===st.sort)) st.sort = "next";
  return st;
}
function today(){ return typeof todayStr==="function" ? todayStr() : dstr(new Date()); }
function relD(d){ return typeof relDay==="function" ? relDay(d) : `${wdLabel(d)}, ${ddmm(d)}`; }
function allClients(){ return (typeof ptData!=="undefined") ? [...ptData.asPT, ...ptData.asStudent] : []; }
function findClient(cid){ return allClients().find(c=> c.id===cid) || null; }
function sessOf(cid){ return (typeof ptData!=="undefined" && ptData.sessions[cid]) || []; }
function amPT(){ return !!(cloud.profile && cloud.profile.isPT); }
function roleFor(cid){ return (typeof ptData!=="undefined" && ptData.asPT.some(c=> c.id===cid)) ? "pt" : "student"; }
function patchLocal(doc){
  if(!doc || typeof ptData==="undefined") return;
  [ptData.asPT, ptData.asStudent].forEach(arr=>{ const i = arr.findIndex(x=> x.id===doc.id); if(i >= 0) arr[i] = Object.assign({}, arr[i], doc); });
}
function rerender(){
  const a = document.querySelector(".screen.active");
  if(!a) return;
  if(a.id==="screen-client" && typeof renderClientForm==="function") renderClientForm();
  if(a.id==="screen-coach" && typeof renderCoachScreen==="function") renderCoachScreen(false);
}
function niceErr(e, role){
  if(e && (e.code==="permission-denied" || /quyền/.test(e.message||"")) && role==="student")
    return "Máy chủ chưa cho học viên tự cập nhật hồ sơ sức khoẻ. Nhờ PT cập nhật, hoặc chủ app cập nhật firestore.rules (xem INTEGRATION-pt-pro.md).";
  return (e && e.message) || "Đã có lỗi xảy ra.";
}
/* Đọc bản mới nhất → sửa → ghi các trường thay đổi (giảm ghi đè khi PT & học viên cùng sửa) */
async function mutateClient(cid, fn){
  let fresh = null;
  try{ fresh = await cloud.getClient(cid); }catch(e){}
  const base = clean(fresh || findClient(cid) || {});
  const partial = fn(base);
  if(!partial) return null;
  const saved = await cloud.updateClient(cid, clean(partial));
  patchLocal(saved && saved.id ? saved : Object.assign({ id:cid }, base, partial));
  return saved;
}
async function saveAndRender(cid, fn, okMsg, icon){
  try{ await mutateClient(cid, fn); if(okMsg) toast(okMsg, icon || "check_circle"); rerender(); return true; }
  catch(e){ toast(niceErr(e, roleFor(cid)), "error"); return false; }
}
function ptpSheet(html, keepScroll){
  const sh = document.querySelector(".sheet"), y = sh ? sh.scrollTop : 0;
  openSheet(`<div class="ptp-sheet">${html}</div>`);
  if(sh) sh.scrollTop = keepScroll ? y : 0;
}
const sheetHead = (title, back)=> `<div class="sheet-header"><h3>${title}</h3><button class="icon-btn" ${back?`id="${back}"`:`onclick="closeSheet()"`} aria-label="${back?"Quay lại":"Đóng"}">${ic(back?"arrow_back":"close")}</button></div>`;

/* ---------------------------------------------------------------------
   3. MÀN PT: BẢNG ĐIỀU KHIỂN + VIỆC CẦN LÀM + TÌM/LỌC/SẮP XẾP
   --------------------------------------------------------------------- */
function buildCtx(){
  const now = Date.now(), td = today(), ym = ymOf(td);
  const rows = ptData.asPT.map(c=>{
    const ss = sessOf(c.id), alerts = clientAlerts(c, ss, now, td);
    return { c, ss, alerts, rem: remaining(c, ss), next: nextWithin(ss, now, 3650), active: isActive(c, ss, now),
      lv: alerts.reduce((m,a)=> Math.max(m, a.lv), 0) };
  });
  const revenue = ptData.asPT.reduce((a,c)=> a + paidIn(c, ym), 0);
  const weekItems = ptItems(ptData.asPT, ptData.sessions, dparse(mondayOf(td)).getTime(), dparse(dadd(mondayOf(td), 7)).getTime());
  const soon = findConflicts(ptItems(ptData.asPT, ptData.sessions, now - 3600000, now + 7*DAY_MS));
  return { now, td, ym, rows, revenue, weekCount: weekItems.length, conflicts: soon };
}
function doneToday(){
  const st = ptpState(), td = today();
  Object.keys(st.done).forEach(k=>{ if(k !== td) delete st.done[k]; });
  return st.done[td] = st.done[td] || [];
}

function dashHTML(ctx){
  const month = Number(ctx.ym.slice(5,7));
  const active = ctx.rows.filter(r=> r.active).length;
  const attn = ctx.rows.filter(r=> r.lv >= 2).length;
  const dismissed = doneToday();
  const todays = ptItems(ptData.asPT, ptData.sessions, dparse(ctx.td).getTime(), dparse(dadd(ctx.td,1)).getTime(), true);
  const conflictKeys = ctx.conflicts.keys;
  const todo = [];
  ctx.conflicts.pairs.slice(0, 3).forEach(([a,b])=>{
    const key = `conf:${a.key}|${b.key}`;
    if(!dismissed.includes(key)) todo.push({ key, lv:3, icon:"warning", who:`${a.name} & ${b.name}`, text:`Trùng giờ ${hm(a.start)} ${relD(a.s.date)}`, act:"Xem lịch", go:`cal:${a.s.date}` });
  });
  ctx.rows.forEach(r=> r.alerts.forEach(a=>{ if(!dismissed.includes(a.key)) todo.push(Object.assign({ who:r.c.name, cid:r.c.id }, a)); }));
  todo.sort((a,b)=> b.lv - a.lv);
  const main = todo.filter(t=> t.lv >= 2), low = todo.filter(t=> t.lv < 2);
  const item = t=> `
    <div class="ptp-todo-item lv${t.lv}">
      ${ic(t.icon)}
      <div class="t"><b>${esc(t.who)}</b><small>${esc(t.text)}</small></div>
      <button class="btn btn-soft btn-sm" data-todo-go="${esc(t.go)}" data-cid="${esc(t.cid||"")}">${esc(t.act)}</button>
      <button class="ptp-ib ghost" data-todo-ok="${esc(t.key)}" aria-label="Đánh dấu đã xử lý">${ic("check")}</button>
    </div>`;
  return `
    <div class="stat-grid ptp-kpi">
      <button class="stat-box" data-ptp="revenue"><div class="num">${moneyShort(ctx.revenue)}</div><div class="cap">Doanh thu T${month}</div></button>
      <button class="stat-box" data-ptp-f="active"><div class="num">${active}</div><div class="cap">Đang hoạt động</div></button>
      <button class="stat-box ${attn?"hot":""}" data-ptp-f="attention"><div class="num">${attn}</div><div class="cap">Cần chú ý</div></button>
    </div>
    <div class="ptp-tools">
      <button data-ptp="calendar">${ic("calendar_month")}<b>Lịch tổng hợp</b><small>${ctx.weekCount} buổi tuần này${ctx.conflicts.pairs.length?` · <em>${ctx.conflicts.pairs.length} trùng giờ</em>`:""}</small></button>
      <button data-ptp="assign">${ic("school")}<b>Giao giáo án</b><small>${(typeof PROGRAM_TEMPLATES!=="undefined"?PROGRAM_TEMPLATES.length:0)} mẫu sẵn</small></button>
      <button data-ptp="revenue">${ic("payments")}<b>Gói &amp; doanh thu</b><small>Thanh toán, công nợ</small></button>
    </div>
    <div class="card ptp-todo">
      <div class="card-title">${ic("checklist")}Việc cần làm hôm nay ${main.length+todays.filter(x=>x.s.status==="scheduled").length ? `<span class="ptp-count">${main.length+todays.filter(x=>x.s.status==="scheduled").length}</span>` : ""}</div>
      <div class="ptp-sub">Buổi dạy hôm nay (${todays.length})</div>
      ${todays.length ? todays.map(it=>{ const s = it.s, past = it.start < ctx.now; return `
        <div class="ptp-sess ${conflictKeys.has(it.key)?"conflict":""}">
          <button class="ptp-sess-main" data-open-sess="${esc(it.cid)}:${esc(it.sid)}">
            <div class="date-chip"><b>${esc(s.time||"--:--")}</b><small>${s.mode==="online"?"Online":"Offline"}</small></div>
            <div class="info"><div class="name">${esc(it.name)}</div><div class="meta">${esc(s.title||"Buổi tập")} · ${(s.exercises||[]).length} bài</div></div>
          </button>
          ${s.status==="scheduled" ? `
            <button class="ptp-ib ok" data-sess-done="${esc(it.cid)}:${esc(it.sid)}" aria-label="Đã tập" title="Đã tập">${ic("check")}</button>
            <button class="ptp-ib ptp-absent" data-sess-absent="${esc(it.cid)}:${esc(it.sid)}" aria-label="Vắng" title="Vắng">${ic("event_busy")}</button>`
          : (typeof statusPill==="function" ? statusPill(s) : "")}
          ${past && s.status==="scheduled" ? `<i class="ptp-dot" title="Đã qua giờ"></i>` : ""}
        </div>`; }).join("") : `<p class="small-note">Hôm nay không có buổi dạy.</p>`}
      <div class="ptp-sub">Cần xử lý (${main.length})</div>
      ${main.length ? main.map(item).join("") : `<p class="small-note">Không có việc gấp. Tuyệt vời!</p>`}
      ${low.length ? `<button class="ptp-more" id="ptp-more">${ui.showLow ? "Ẩn" : "Xem"} ${low.length} gợi ý chăm sóc học viên ${ic(ui.showLow?"arrow_upward":"chevron_right")}</button>
        <div id="ptp-low" ${ui.showLow?"":"hidden"}>${low.map(item).join("")}</div>` : ""}
      ${dismissed.length ? `<p class="small-note" style="margin-top:6px;">Đã xử lý hôm nay: ${dismissed.length} việc.</p>` : ""}
    </div>`;
}

function rowsFiltered(ctx){
  const st = ptpState(), q = norm(st.q);
  let rows = ctx.rows.filter(r=>{
    if(q){ const hay = norm([r.c.name, r.c.phone, r.c.goal, r.c.studentEmail, r.c.studentName, r.c.health && r.c.health.goal && r.c.health.goal.main].join(" ")); if(!hay.includes(q)) return false; }
    switch(st.filter){
      case "attention": return r.lv >= 2;
      case "active": return r.active;
      case "low": return r.rem !== null && r.rem <= 3 && pkgState(r.c)==="active";
      case "unlinked": return !r.c.studentUid;
      case "paused": return pkgState(r.c)!=="active";
      default: return true;
    }
  });
  const byName = (a,b)=> String(a.c.name||"").localeCompare(String(b.c.name||""), "vi");
  const cmp = {
    next: (a,b)=> (a.next ? startOf(a.next) : Infinity) - (b.next ? startOf(b.next) : Infinity) || byName(a,b),
    attention: (a,b)=> b.lv - a.lv || b.alerts.length - a.alerts.length || byName(a,b),
    name: byName,
    remain: (a,b)=> (a.rem===null ? 1e9 : a.rem) - (b.rem===null ? 1e9 : b.rem) || byName(a,b),
    recent: (a,b)=> (b.c.updatedAt||0) - (a.c.updatedAt||0),
  }[st.sort] || byName;
  return rows.slice().sort(cmp);
}
function filterCount(ctx, id){
  const st = ptpState(), keep = st.filter; st.filter = id;
  const q = st.q; st.q = "";
  const n = rowsFiltered(ctx).length; st.filter = keep; st.q = q; return n;
}
function filterHTML(ctx){
  const st = ptpState();
  return `
    <div class="ptp-search">${ic("search")}<input id="ptp-q" type="search" placeholder="Tìm tên, SĐT, mục tiêu…" value="${esc(st.q)}" autocomplete="off" aria-label="Tìm học viên"></div>
    <div class="ptp-chips">${FILTERS.map(f=> `<button class="pill ${st.filter===f.id?"active":""}" data-ptp-filter="${f.id}">${f.label} <i>${filterCount(ctx, f.id)}</i></button>`).join("")}</div>
    <div class="ptp-sortrow"><span class="small-note" id="ptp-count"></span>
      <label class="ptp-sort">${ic("sort")}<select id="ptp-sort" aria-label="Sắp xếp">${SORTS.map(s=> `<option value="${s.id}" ${st.sort===s.id?"selected":""}>${s.label}</option>`).join("")}</select></label>
    </div>`;
}
function rowTags(r){
  const tags = [];
  if(pkgState(r.c)!=="active") tags.push(`<span class="ptp-tag">${PKG_STATE[pkgState(r.c)]}</span>`);
  r.alerts.filter(a=> a.lv >= 2).slice(0, 2).forEach(a=> tags.push(`<span class="ptp-tag ${a.lv>=3?"hi":"mid"}">${esc(a.text)}</span>`));
  if(r.rem !== null && r.rem > 3) tags.push(`<span class="ptp-tag ok">Còn ${r.rem} buổi</span>`);
  const conds = ((r.c.health||{}).conditions||[]).filter(x=> x.status!=="recovered");
  if(conds.length) tags.push(`<span class="ptp-tag mid">${ic("healing")}${esc(conds.map(x=> x.name).slice(0,2).join(", "))}</span>`);
  return tags.length ? `<div class="ptp-tags">${tags.join("")}</div>` : "";
}
function renderList(box, ctx){
  const rows = rowsFiltered(ctx);
  const cnt = $("#ptp-count"); if(cnt) cnt.textContent = `${rows.length}/${ctx.rows.length} học viên`;
  if(!ctx.rows.length){ box.innerHTML = `<p class="empty-hint">Chưa có học viên. Bấm "Thêm học viên", app sẽ tạo mã 6 ký tự để gửi cho học viên.</p>`; return; }
  if(!rows.length){ box.innerHTML = `<p class="empty-hint">Không có học viên khớp bộ lọc.</p>`; return; }
  box.innerHTML = rows.map(r=> typeof clientRowHTML==="function" ? clientRowHTML(r.c, "pt")
    : `<div class="list-item client-row" data-open-client="${esc(r.c.id)}" data-role="pt"><div class="avatar-ini">${esc((r.c.name||"?").charAt(0).toUpperCase())}</div><div class="info"><div class="name">${esc(r.c.name)}</div></div></div>`).join("");
  rows.forEach(r=>{
    const el = box.querySelector(`[data-open-client="${r.c.id}"]`); if(!el) return;
    const info = el.querySelector(".info"); if(info) info.insertAdjacentHTML("beforeend", rowTags(r));
    el.addEventListener("click", ()=> openClientForm(r.c.id, "pt"));
  });
}

function enhanceCoach(){
  if(!cloud.isLoggedIn() || !amPT() || typeof ptData==="undefined" || !ptData.loaded) return;
  if(typeof coachTab!=="undefined" && coachTab!=="clients") return;
  const body = $("#coach-tab-body"); if(!body || body.querySelector(".ptp-dash")) return;
  const ctx = buildCtx();
  if(!ui._lc){ ui._lc = 1; loadMyCancel(); }
  const dash = document.createElement("div"); dash.className = "ptp-dash"; dash.innerHTML = dashHTML(ctx);
  const anchor = $(".stat-grid", body);
  if(anchor) anchor.after(dash); else body.prepend(dash);
  bindDash(dash, ctx);
  const add = $("#btn-add-client", body), box = add && add.nextElementSibling;
  if(box && box.tagName==="DIV"){
    const bar = document.createElement("div"); bar.className = "ptp-filter"; bar.innerHTML = filterHTML(ctx);
    box.before(bar); box.classList.add("ptp-list");
    renderList(box, ctx);
    let t = null;
    $("#ptp-q", bar).addEventListener("input", e=>{ ptpState().q = e.target.value; renderList(box, ctx); clearTimeout(t); t = setTimeout(saveState, 600); });
    $("#ptp-sort", bar).addEventListener("change", e=>{ ptpState().sort = e.target.value; saveState(); renderList(box, ctx); });
    $$("[data-ptp-filter]", bar).forEach(b=> b.addEventListener("click", ()=>{
      ptpState().filter = b.dataset.ptpFilter; saveState();
      $$("[data-ptp-filter]", bar).forEach(x=> x.classList.toggle("active", x===b)); renderList(box, ctx);
    }));
  }
}
function setFilter(id){
  ptpState().filter = id; saveState(); renderCoachScreen(false);
  setTimeout(()=>{ const b = $(".ptp-filter"); if(b) b.scrollIntoView({ behavior:"smooth", block:"start" }); }, 60);
}
function bindDash(dash, ctx){
  $$("[data-ptp]", dash).forEach(b=> b.addEventListener("click", ()=>{
    const k = b.dataset.ptp;
    if(k==="calendar"){ ui.cal = null; openCalendar(); }
    if(k==="assign") openAssign(null);
    if(k==="revenue"){ ui.revYm = null; openRevenue(); }
  }));
  $$("[data-ptp-f]", dash).forEach(b=> b.addEventListener("click", ()=> setFilter(b.dataset.ptpF)));
  $$("[data-open-sess]", dash).forEach(b=> b.addEventListener("click", ()=>{ const [cid, sid] = b.dataset.openSess.split(":"); openSessionInForm(cid, sid); }));
  const mark = async (cid, sid, patch, msg)=>{
    try{ await cloud.saveSession(cid, Object.assign({ id:sid }, patch)); toast(msg, "check_circle"); await refreshCoachData(true); }
    catch(e){ toast(e.message, "error"); }
  };
  $$("[data-sess-done]", dash).forEach(b=> b.addEventListener("click", ()=>{ const [cid, sid] = b.dataset.sessDone.split(":");
    mark(cid, sid, { status:"done", completedAt:Date.now(), completedBy:"pt" }, "Đã ghi nhận buổi tập"); }));
  $$("[data-sess-absent]", dash).forEach(b=> b.addEventListener("click", ()=>{ const [cid, sid] = b.dataset.sessAbsent.split(":"); openAbsentSheet(cid, sid); }));
  $$("[data-todo-ok]", dash).forEach(b=> b.addEventListener("click", ()=>{ doneToday().push(b.dataset.todoOk); saveState(); renderCoachScreen(false); }));
  $$("[data-todo-go]", dash).forEach(b=> b.addEventListener("click", ()=> todoGo(b.dataset.todoGo, b.dataset.cid)));
  const more = $("#ptp-more", dash); if(more) more.addEventListener("click", ()=>{ ui.showLow = !ui.showLow; renderCoachScreen(false); });
}
function todoGo(go, cid){
  const c = findClient(cid);
  if(go.startsWith("tab:")) return openClientForm(cid, "pt", go.slice(4));
  if(go.startsWith("cal:")){ ui.cal = { mode:"day", date: go.slice(4) }; return openCalendar(); }
  if(go==="renew") return openRenewSheet(cid);
  if(go==="pay") return openPaySheet(cid);
  if(go==="msg_absent") return openQuickMsg(cid, `Chào ${c ? c.name : "bạn"}, mấy buổi gần đây mình chưa gặp nhau, mọi thứ vẫn ổn chứ? Nếu bận hoặc mệt cứ báo mình để xếp lại lịch cho phù hợp nhé!`);
  if(go==="msg_bday") return openQuickMsg(cid, `Chúc mừng sinh nhật ${c ? c.name : "bạn"}! Chúc bạn tuổi mới thật khoẻ, tập luyện bền bỉ và đạt mọi mục tiêu. Buổi tới mình có món quà nhỏ cho bạn nhé!`);
}
function openQuickMsg(cid, text){
  const c = findClient(cid); if(!c) return;
  ptpSheet(`
    ${sheetHead(`Nhắn ${esc(c.name)}`)}
    <div class="field"><label>Nội dung</label><textarea id="ptp-qm" rows="4">${esc(text)}</textarea></div>
    <p class="small-note ptp-note">Tin nhắn hiện trong mục Ghi chú của học viên và báo chấm đỏ ở mục PT.</p>
    <div class="ptp-row2">
      <button class="btn btn-outline btn-block" id="ptp-qm-open">Mở form</button>
      <button class="btn btn-primary btn-block" id="ptp-qm-send">${ic("send")}Gửi</button>
    </div>`);
  $("#ptp-qm-open").addEventListener("click", ()=>{ closeSheet(); openClientForm(cid, "pt", "notes"); });
  $("#ptp-qm-send").addEventListener("click", async ()=>{
    const t = $("#ptp-qm").value.trim(); if(!t){ toast("Nhập nội dung", "error"); return; }
    const b = $("#ptp-qm-send"); b.disabled = true;
    try{ await cloud.addNote(cid, t, "pt", "reminder"); closeSheet(); toast("Đã gửi", "send"); refreshCoachData(true); }
    catch(e){ toast(e.message, "error"); b.disabled = false; }
  });
}
/* QP-13 (fix-pt): Huỷ / vắng có 3 loại — trừ gói theo chính sách huỷ PT niêm yết (tuỳ chỉnh được) */
async function loadMyCancel(){
  try{
    if(!amPT() || !cloud.ptdir || typeof cloud.ptdir.myListing !== "function") return;
    const l = await cloud.ptdir.myListing(); const st = ptpState(); const k = (l && l.cancel) || "";
    if(st.listCancel !== k){ st.listCancel = k; try{ saveState(); }catch(e){} }
  }catch(e){}
}
function absentPolicyText(st){
  const C = cloud.ptdir && cloud.ptdir.data && cloud.ptdir.data.CANCEL, lab = C && C[st.listCancel] ? C[st.listCancel].label : "";
  const pol = st.absentPolicy == null ? "auto" : String(st.absentPolicy);
  return pol === "1" ? "Luôn trừ 1 buổi khi vắng / huỷ muộn" : pol === "0" ? "Không trừ buổi khi vắng" : `Theo chính sách huỷ đã niêm yết${lab ? ` ("${lab}")` : " (chưa niêm yết → không trừ)"}`;
}
function openAbsentSheet(cid, sid, after){
  const c = findClient(cid), s = sessOf(cid).find(x=> x.id===sid);
  if(!c || !s){ toast("Không tìm thấy buổi tập", "error"); return; }
  if(roleFor(cid) !== "pt"){ toast("Chỉ PT đổi trạng thái buổi tập", "error"); return; }
  const st = ptpState();
  const charge = absentChargeDefault(st.absentPolicy == null ? "auto" : st.absentPolicy, st.listCancel);
  ptpSheet(`
    ${sheetHead("Huỷ / vắng buổi tập")}
    <p class="small-note ptp-note">${esc(c.name)} · ${esc(relD(s.date))} ${esc(s.time||"")} · ${esc(s.title||"Buổi tập")}</p>
    <div class="ptp-absent">${Object.entries(CANCEL_KINDS).map(([k, o])=> `
      <button type="button" class="ptp-dayrow" data-abs="${k}"><span class="t"><b>${esc(o.label)}</b><small>${k==="late" ? (charge ? "Trừ 1 buổi vào gói" : "Không trừ buổi (theo cài đặt hiện tại)") : esc(o.note)}</small></span>${ic("chevron_right")}</button>`).join("")}</div>
    <p class="small-note ptp-note">${ic("info")} ${esc(absentPolicyText(st))}.</p>
    <button type="button" class="btn btn-ghost btn-sm btn-block" id="abs-pol">${ic("tune")}Đổi cách tính khi vắng</button>
    ${s.status !== "scheduled" ? `<p class="small-note ptp-note">Buổi đang ở trạng thái "${s.status==="done" ? "Đã tập" : "Huỷ / vắng"}" — thay đổi sẽ được ghi vào lịch sử buổi.</p>` : ""}`);
  $$("[data-abs]").forEach(b=> b.addEventListener("click", async ()=>{
    const k = b.dataset.abs, ch = k === "late" && charge;
    try{
      await cloud.saveSession(cid, { id:sid, status:"cancelled", cancelKind:k, absent: k === "late", charged: ch, cancelledAt: Date.now() });
      closeSheet(); toast(ch ? "Đã ghi vắng — trừ 1 buổi theo chính sách" : `Đã ghi "${CANCEL_KINDS[k].label}"`, "event_busy");
      if(typeof after === "function") after(); else { try{ if(isPTViewSafe() && cf.cid===cid) await reloadClient(); else await refreshCoachData(true); }catch(e){} }
    }catch(e){ toast(e.message, "error"); }
  }));
  $("#abs-pol").addEventListener("click", ()=>{
    const cur = st.absentPolicy == null ? "auto" : String(st.absentPolicy);
    st.absentPolicy = cur === "auto" ? 1 : cur === "1" ? 0 : null; try{ saveState(); }catch(e){}
    openAbsentSheet(cid, sid, after);
  });
}
function openSessionInForm(cid, sid){
  closeSheet();
  openClientForm(cid, roleFor(cid), "today");
  if(typeof cf!=="undefined"){ cf.focusSid = sid; renderClientForm(); }
}

/* ---------------------------------------------------------------------
   4. LỊCH TỔNG HỢP (ngày / tuần) + TRÙNG GIỜ
   --------------------------------------------------------------------- */
function openCalendar(){
  const st = ptpState();
  if(!ui.cal) ui.cal = { mode: st.cal || "day", date: today() };
  const { mode, date } = ui.cal;
  const from = mode==="day" ? date : mondayOf(date), days = mode==="day" ? 1 : 7;
  const t0 = dparse(from).getTime(), t1 = dparse(dadd(from, days)).getTime();
  const items = ptItems(ptData.asPT, ptData.sessions, t0, t1, true);
  const conf = findConflicts(items);
  const label = mode==="day" ? `${relD(date)}${["Hôm nay","Ngày mai","Hôm qua"].includes(relD(date)) ? " · "+ddmm(date) : ""}` : `${ddmm(from)} – ${ddmm(dadd(from,6))}`;
  ptpSheet(`
    ${sheetHead("Lịch tổng hợp")}
    <div class="seg ptp-seg"><button class="${mode==="day"?"active":""}" data-cal-mode="day">Ngày</button><button class="${mode==="week"?"active":""}" data-cal-mode="week">Tuần</button></div>
    <div class="ptp-calnav">
      <button class="ptp-ib" data-cal-nav="-1" aria-label="Trước">${ic("chevron_left")}</button>
      <div class="lbl"><b>${esc(label)}</b><small>${items.filter(i=> i.s.status!=="cancelled").length} buổi${conf.pairs.length ? ` · <em>${conf.pairs.length} trùng giờ</em>` : ""}</small></div>
      <button class="ptp-ib" data-cal-nav="1" aria-label="Sau">${ic("chevron_right")}</button>
    </div>
    ${(mode==="day" ? date!==today() : mondayOf(date)!==mondayOf(today())) ? `<button class="btn btn-ghost btn-sm ptp-today-btn" data-cal-today>${ic("today")}Về hôm nay</button>` : ""}
    ${conf.pairs.length ? `<div class="ptp-alert">${ic("warning")}<div><b>Phát hiện ${conf.pairs.length} cặp trùng giờ</b>
      ${conf.pairs.slice(0,5).map(([a,b])=> `<small>${mode==="week"?wdLabel(a.s.date)+" ":""}${hm(a.start)}–${hm(a.end)}: ${esc(a.name)} ↔ ${esc(b.name)} (${hm(b.start)})</small>`).join("")}
      <small>Dời một buổi: chạm vào buổi → Sửa buổi.</small></div></div>` : ""}
    <div id="ptp-cal-body">${mode==="day" ? calDayHTML(date, items, conf) : calWeekHTML(from, items, conf)}</div>
  `);
  $$("[data-cal-mode]").forEach(b=> b.addEventListener("click", ()=>{ ui.cal.mode = b.dataset.calMode; st.cal = ui.cal.mode; saveState(); openCalendar(); }));
  $$("[data-cal-nav]").forEach(b=> b.addEventListener("click", ()=>{ ui.cal.date = dadd(ui.cal.date, Number(b.dataset.calNav) * (ui.cal.mode==="day" ? 1 : 7)); openCalendar(); }));
  const tb = $("[data-cal-today]"); if(tb) tb.addEventListener("click", ()=>{ ui.cal.date = today(); openCalendar(); });
  $$("[data-cal-day]").forEach(b=> b.addEventListener("click", ()=>{ ui.cal = { mode:"day", date:b.dataset.calDay }; openCalendar(); }));
  $$("[data-cal-open]").forEach(b=> b.addEventListener("click", ()=>{ const [cid, sid] = b.dataset.calOpen.split(":"); openSessionInForm(cid, sid); }));
  const nowLine = $(".ptp-now"), tl = $(".ptp-tl");
  const nowIn = nowLine && tl && parseFloat(nowLine.style.top) >= 0 && parseFloat(nowLine.style.top) <= tl.offsetHeight;
  const target = nowIn ? nowLine : $(".ptp-blk");
  if(target) setTimeout(()=> target.scrollIntoView({ block:"center" }), 120);
}
function calDayHTML(date, items, conf){
  const HPX = 56;
  const base = dparse(date).getTime();
  const hrs = items.map(i=> [(i.start-base)/3600000, (i.end-base)/3600000]);
  const h0 = Math.max(0, Math.min(6, ...hrs.map(h=> Math.floor(h[0])))), h1 = Math.min(24, Math.max(22, ...hrs.map(h=> Math.ceil(h[1]))));
  const laid = layoutLanes(items);
  const now = Date.now(), showNow = date===today();
  if(!items.length) return `<div class="ptp-empty">${ic("event_available")}<p>Không có buổi nào trong ngày này.</p></div>`;
  return `<div class="ptp-tl" style="height:${(h1-h0)*HPX}px">
    ${Array.from({ length:h1-h0 }, (_,i)=> `<div class="hr" style="top:${i*HPX}px"><span>${pad(h0+i)}:00</span></div>`).join("")}
    ${showNow ? `<div class="ptp-now" style="top:${((now-base)/3600000-h0)*HPX}px"></div>` : ""}
    ${laid.map(it=>{
      const top = ((it.start-base)/3600000 - h0)*HPX, hgt = Math.max(44, Math.min((it.end-it.start)/3600000*HPX, (h1-h0)*HPX - top) - 2);
      const s = it.s, cls = [conf.keys.has(it.key)?"conflict":"", s.status==="done"?"done":"", s.status==="cancelled"?"cancel":""].join(" ");
      return `<button class="ptp-blk ${cls}" data-cal-open="${esc(it.cid)}:${esc(it.sid)}"
        style="top:${top.toFixed(1)}px;height:${hgt.toFixed(1)}px;left:calc(52px + (100% - 56px) * ${it.lane} / ${it.lanes});width:calc((100% - 56px) / ${it.lanes} - 4px)">
        <b>${hm(it.start)} ${esc(it.name)}</b><small>${esc(s.title||"Buổi tập")}${s.status==="done"?" · Đã tập":s.status==="cancelled"?" · Huỷ/vắng":""}</small>
        ${conf.keys.has(it.key) ? ic("warning", "cf") : ""}</button>`; }).join("")}
  </div>`;
}
function calWeekHTML(from, items, conf){
  const td = today();
  const days = Array.from({ length:7 }, (_,i)=> dadd(from, i));
  const by = {}; items.forEach(it=> (by[it.s.date] = by[it.s.date] || []).push(it));
  return `
    <div class="ptp-week">${days.map(d=>{ const l = (by[d]||[]).filter(i=> i.s.status!=="cancelled"); const cf2 = l.some(i=> conf.keys.has(i.key)); return `
      <button class="ptp-wd ${d===td?"today":""}" data-cal-day="${d}"><small>${wdLabel(d)}</small><b>${dparse(d).getDate()}</b><span>${l.length || ""}</span>${cf2 ? `<i class="cf"></i>` : ""}</button>`; }).join("")}</div>
    ${days.filter(d=> by[d]).map(d=> `
      <div class="small-note sched-day">${esc(relD(d))}${["Hôm nay","Ngày mai","Hôm qua"].includes(relD(d)) ? " · "+ddmm(d) : ""}</div>
      ${by[d].map(it=> `
        <button class="list-item ptp-cal-row ${conf.keys.has(it.key)?"conflict":""}" data-cal-open="${esc(it.cid)}:${esc(it.sid)}">
          <div class="date-chip"><b>${hm(it.start)}</b><small>${durOf(it.s)}′</small></div>
          <div class="info"><div class="name">${esc(it.name)}</div><div class="meta">${esc(it.s.title||"Buổi tập")}</div></div>
          ${conf.keys.has(it.key) ? `<span class="ptp-tag hi">${ic("warning")}Trùng</span>` : (typeof statusPill==="function" ? statusPill(it.s) : "")}
        </button>`).join("")}`).join("") || `<div class="ptp-empty">${ic("event_available")}<p>Tuần này chưa có buổi nào.</p></div>`}`;
}

/* ---------------------------------------------------------------------
   5. GIAO NGUYÊN GIÁO ÁN MẪU
   --------------------------------------------------------------------- */
function tplIsCardio(d){ return typeof TPL_CARDIO!=="undefined" && d && d.ex && d.ex.length && d.ex.every(e=> TPL_CARDIO.has(e[0])); }
function tplMatch(t, c){
  const h = (c && c.health) || {}, g = h.gender==="male" ? "nam" : h.gender==="female" ? "nu" : null;
  const lv = h.goal && h.goal.level, per = Number(h.goal && h.goal.daysPerWeek) || 0;
  let s = 0;
  if(g && (t.gender===g || t.gender==="chung")) s += 2;
  if(lv && t.level===lv) s += 2;
  if(per && t.perWeek && t.perWeek <= per) s += 1;
  return s;
}
function openAssign(cid, keepTpl){
  if(typeof PROGRAM_TEMPLATES==="undefined"){ toast("Chưa nạp thư viện giáo án mẫu", "error"); return; }
  if(!ptData.asPT.length){ toast("Hãy thêm học viên trước", "error"); return; }
  const c0 = findClient(cid) || ptData.asPT[0];
  if(!ui.asg || !keepTpl) ui.asg = { cid: c0.id, tplId:null, g:"all", l:"all" };
  const a = ui.asg, c = findClient(a.cid) || c0;
  if(!a.tplId){
    const hG = c.health && c.health.gender;
    if(a.g==="all" && hG) a.g = hG==="male" ? "nam" : hG==="female" ? "nu" : "all";
    const list = PROGRAM_TEMPLATES.filter(t=> (a.g==="all" || t.gender===a.g || t.gender==="chung") && (a.l==="all" || t.level===a.l))
      .map(t=> ({ t, m: tplMatch(t, c) })).sort((x,y)=> y.m - x.m);
    const chip = (k, v, l)=> `<button class="pill ${a[k]===v?"active":""}" data-asg-f="${k}:${v}">${l}</button>`;
    ptpSheet(`
      ${sheetHead("Giao giáo án mẫu")}
      <div class="field"><label>Học viên</label><select id="asg-client">${ptData.asPT.map(x=> `<option value="${esc(x.id)}" ${x.id===c.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div>
      <div class="ptp-chips" style="margin-top:12px;">${chip("g","all","Tất cả")}${chip("g","nam","Nam")}${chip("g","nu","Nữ")}</div>
      <div class="ptp-chips">${chip("l","all","Mọi cấp độ")}${chip("l","beginner","Mới tập")}${chip("l","intermediate","Trung bình")}${chip("l","advanced","Nâng cao")}</div>
      <div class="ptp-tpls">${list.map(({t,m})=> `
        <button class="list-item ptp-tpl" data-asg-tpl="${esc(t.id)}">
          <div class="info"><div class="name">${esc(t.name)} ${m >= 3 ? `<span class="ptp-tag ok">Phù hợp</span>` : ""}</div>
            <div class="meta">${esc((typeof TPL_GENDER!=="undefined"?TPL_GENDER[t.gender]:t.gender)||"")} · ${esc((typeof TPL_LEVEL!=="undefined"?TPL_LEVEL[t.level]:t.level)||"")} · ${t.weeks} tuần · ${t.perWeek} buổi/tuần</div>
            <div class="meta">${esc(t.goal||"")}</div></div>
          ${ic("chevron_right")}
        </button>`).join("") || `<p class="empty-hint">Không có giáo án khớp bộ lọc.</p>`}</div>
    `);
    $("#asg-client").addEventListener("change", e=>{ a.cid = e.target.value; a.g = "all"; openAssign(a.cid, true); });
    $$("[data-asg-f]").forEach(b=> b.addEventListener("click", ()=>{ const [k,v] = b.dataset.asgF.split(":"); a[k] = v; openAssign(a.cid, true); }));
    $$("[data-asg-tpl]").forEach(b=> b.addEventListener("click", ()=>{
      const t = PROGRAM_TEMPLATES.find(x=> x.id===b.dataset.asgTpl); if(!t) return;
      const days = DAY_KEYS.filter(k=> t.days[k] && t.days[k].ex && t.days[k].ex.length && !tplIsCardio(t.days[k]));
      const ss = sessOf(c.id), rem = remaining(c, ss);
      const last = ss.filter(s=> s.time).slice(-1)[0];
      let weeks = Math.min(t.weeks || 8, 12);
      if(rem && rem > 0 && days.length) weeks = Math.max(1, Math.min(t.weeks || 12, Math.floor(rem / days.length)));   // không vượt số buổi còn lại
      Object.assign(a, { tplId:t.id, start: dadd(today(), 1), weeks, time: (last && last.time) || "18:00", mode: (last && last.mode) || "offline", days, deload:true });
      openAssign(a.cid, true);
    }));
    return;
  }
  const t = PROGRAM_TEMPLATES.find(x=> x.id===a.tplId);
  if(!t){ a.tplId = null; return openAssign(a.cid, true); }
  ptpSheet(`
    ${sheetHead(esc(t.name), "asg-back")}
    <p class="small-note ptp-note">Giao cho <b>${esc(c.name)}</b> · ${esc(t.goal||"")}. ${esc(t.desc||"")}</p>
    <div class="field-row" style="margin-top:12px;">
      <div class="field"><label>Ngày bắt đầu</label><input type="date" id="asg-start" value="${esc(a.start)}"></div>
      <div class="field"><label>Giờ tập</label><input type="time" id="asg-time" value="${esc(a.time)}"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Số tuần</label><select id="asg-weeks">${Array.from({ length:16 }, (_,i)=> i+1).map(n=> `<option value="${n}" ${a.weeks==n?"selected":""}>${n} tuần${n===t.weeks?" (chuẩn)":""}</option>`).join("")}</select></div>
      <div class="field"><label>Hình thức</label><select id="asg-mode"><option value="offline" ${a.mode!=="online"?"selected":""}>Tại phòng tập</option><option value="online" ${a.mode==="online"?"selected":""}>Online</option></select></div>
    </div>
    <div class="ptp-sub" style="margin-top:14px;">Ngày tập cùng PT</div>
    <div class="ptp-days">${DAY_KEYS.map(k=>{ const d = t.days[k], has = d && d.ex && d.ex.length, cardio = tplIsCardio(d); return `
      <button class="ptp-dayrow ${a.days.includes(k)?"on":""}" data-asg-day="${k}" ${has?"":"disabled"}>
        <span class="k">${k}</span><span class="t">${has ? esc(d.title) : "Nghỉ"}${cardio ? ` <em>· cardio, HV có thể tự tập</em>` : ""}</span>
        <span class="n">${has ? d.ex.length+" bài" : ""}</span><span class="ck">${ic("check")}</span>
      </button>`; }).join("")}</div>
    <button class="ptp-dayrow ptp-toggle ${a.deload?"on":""}" id="asg-deload"><span class="t">Tự giảm tải mỗi tuần thứ 6 (bớt ~40% số hiệp)</span><span class="ck">${ic("check")}</span></button>
    <div id="asg-preview"></div>
    <p class="auth-err" id="asg-err"></p>
    <button class="btn btn-primary btn-block" id="asg-go" style="margin-top:8px;">${ic("event_available")}Tạo lịch &amp; giao cho học viên</button>
  `);
  const read = ()=>{
    a.start = $("#asg-start").value || a.start; a.time = $("#asg-time").value || a.time;
    a.weeks = Number($("#asg-weeks").value) || a.weeks; a.mode = $("#asg-mode").value;
  };
  const preview = ()=>{
    read();
    const list = buildProgramSessions(t, Object.assign({ batch:"preview" }, a), id=> EXERCISES[id]);
    a._list = list;
    const rem = remaining(c, sessOf(c.id));
    const first = list.length ? list[0].date : null, last = list.length ? list[list.length-1].date : null;
    const exist = first ? ptItems(ptData.asPT, ptData.sessions, dparse(first).getTime(), dparse(dadd(last,1)).getTime()) : [];
    const clashes = [];
    list.forEach(s=>{ const st = startOf(s), en = st + durOf(s)*60000;
      exist.forEach(e=>{ if(e.start < en && st < e.end) clashes.push({ s, e }); }); });
    const box = $("#asg-preview"); if(!box) return;
    box.innerHTML = `
      <div class="ptp-sumbox">
        <div><b>${list.length}</b><small>buổi sẽ tạo</small></div>
        <div><b>${first ? ddmm(first) : "—"}</b><small>bắt đầu</small></div>
        <div><b>${last ? ddmm(last) : "—"}</b><small>kết thúc</small></div>
      </div>
      ${rem !== null && list.length > rem ? `<div class="ptp-alert">${ic("payments")}<div><b>Gói còn ${Math.max(0,rem)} buổi</b><small>Sẽ tạo ${list.length} buổi — nhớ gia hạn gói hoặc giảm số tuần.</small></div></div>` : ""}
      ${clashes.length ? `<div class="ptp-alert">${ic("warning")}<div><b>${clashes.length} buổi trùng giờ với lịch hiện có</b>
        ${clashes.slice(0,4).map(x=> `<small>${wdLabel(x.s.date)} ${ddmm(x.s.date)} ${esc(x.s.time)} ↔ ${esc(x.e.name)} (${hm(x.e.start)})</small>`).join("")}
        <small>Đổi giờ tập hoặc ngày bắt đầu để tránh trùng.</small></div></div>` : (list.length ? `<p class="small-note ptp-ok">${ic("check_circle")}Không trùng giờ với lịch của bạn.</p>` : "")}
      ${list.slice(0,4).map(s=> `<div class="ptp-prev"><span>${wdLabel(s.date)} ${ddmm(s.date)} · ${esc(s.time)}</span><b>${esc(s.title)}</b><small>${s.exercises.length} bài · ~${s.duration}′</small></div>`).join("")}
      ${list.length > 4 ? `<p class="small-note">… và ${list.length-4} buổi nữa.</p>` : ""}`;
    const go = $("#asg-go"); if(go) go.disabled = !list.length;
  };
  ["asg-start","asg-time","asg-weeks","asg-mode"].forEach(id=> $("#"+id).addEventListener("change", preview));
  $$("[data-asg-day]").forEach(b=> b.addEventListener("click", ()=>{
    const k = b.dataset.asgDay; const i = a.days.indexOf(k);
    if(i >= 0) a.days.splice(i,1); else a.days.push(k);
    b.classList.toggle("on", a.days.includes(k)); preview();
  }));
  $("#asg-deload").addEventListener("click", e=>{ a.deload = !a.deload; e.currentTarget.classList.toggle("on", a.deload); preview(); });
  $("#asg-back").addEventListener("click", ()=>{ a.tplId = null; openAssign(a.cid, true); });
  $("#asg-go").addEventListener("click", async ()=>{
    preview();
    const list = a._list || [];
    if(!list.length){ $("#asg-err").textContent = "Chọn ít nhất 1 ngày tập."; return; }
    const btn = $("#asg-go"); btn.disabled = true;
    const batch = rid("b");
    const real = buildProgramSessions(t, Object.assign({}, a, { batch }), id=> EXERCISES[id]);
    let n = 0;
    try{
      for(const s of real){ await cloud.saveSession(c.id, s); n++; btn.textContent = `Đang tạo ${n}/${real.length}…`; }
      try{ await cloud.addNote(c.id, `PT đã giao giáo án "${t.name}": ${real.length} buổi từ ${ddmm(real[0].date)} đến ${ddmm(real[real.length-1].date)}, ${a.time}. Xem trong Thời khoá biểu nhé!`, "pt", "reminder"); }catch(e){}
      closeSheet(); ui.asg = null;
      toast(`Đã giao ${real.length} buổi "${t.name}"`, "event_available");
      const onForm = $("#screen-client").classList.contains("active") && typeof cf!=="undefined" && cf.cid===c.id;
      if(onForm) await reloadClient(); else await refreshCoachData(true);
    }catch(e){
      $("#asg-err").textContent = `${esc(e.message)} (đã tạo ${n}/${real.length} buổi)`; btn.disabled = false; btn.textContent = "Thử lại";
    }
  });
  preview();
}
/* Thẻ "Giáo án đang giao" trong tab Thời khoá biểu + nút gỡ */
function batchesOf(cid){
  const map = {};
  sessOf(cid).forEach(s=>{ const p = s.program; if(!p || !p.batch) return;
    const b = map[p.batch] = map[p.batch] || { batch:p.batch, name:p.name, total:0, left:[], first:s.date, last:s.date };
    b.total++; if(s.status==="scheduled" && startOf(s) > Date.now()) b.left.push(s);
    if(s.date < b.first) b.first = s.date; if(s.date > b.last) b.last = s.date; });
  return Object.values(map).filter(b=> b.left.length);
}
function postSchedule(c){
  if(!isPTViewSafe()) return;
  const nb = $("#sc-new"); if(!nb) return;
  const box = document.createElement("div"); box.className = "ptp-sched";
  const bs = batchesOf(c.id);
  box.innerHTML = `
    <button class="btn btn-outline btn-block" id="ptp-asg-open">${ic("school")}Giao nguyên giáo án mẫu</button>
    ${bs.map(b=> `<div class="card ptp-batch"><div class="card-title">${ic("school")}${esc(b.name||"Giáo án")}</div>
      <p class="small-note ptp-note">${ddmm(b.first)} → ${ddmm(b.last)} · còn ${b.left.length}/${b.total} buổi chưa tập</p>
      <button class="btn btn-ghost btn-sm" data-ptp-unbatch="${esc(b.batch)}">${ic("delete")}Gỡ ${b.left.length} buổi chưa tập</button></div>`).join("")}`;
  nb.after(box);
  $("#ptp-asg-open").addEventListener("click", ()=> openAssign(c.id));
  $$("[data-ptp-unbatch]", box).forEach(b=> b.addEventListener("click", ()=>{
    const bt = bs.find(x=> x.batch===b.dataset.ptpUnbatch); if(!bt) return;
    confirmDialog("Gỡ giáo án?", `Xoá ${bt.left.length} buổi chưa tập của "${esc(bt.name)}". Buổi đã tập vẫn giữ trong lịch sử.`, async ()=>{
      try{ for(const s of bt.left) await cloud.deleteSession(c.id, s.id); await reloadClient(); toast("Đã gỡ các buổi chưa tập"); }
      catch(e){ toast(e.message, "error"); }
    }, "Gỡ", "delete");
  }));
}
function isPTViewSafe(){ return typeof cf!=="undefined" && cf.role==="pt"; }

/* ---------------------------------------------------------------------
   6. GÓI TẬP, THANH TOÁN & DOANH THU
   --------------------------------------------------------------------- */
function renderPkgTab(body, c){
  const ss = sessOf(c.id), done = doneCount(ss), charged = chargedCount(ss), total = Number(c.packageTotal)||0, rem = total ? total - done - charged : null;
  const pk = c.pkg || {}, pays = (c.payments||[]).slice().sort((a,b)=> String(b.date).localeCompare(String(a.date)));
  const paid = pays.reduce((a,p)=> a + (Number(p.amount)||0), 0), debt = outstanding(c);
  const dl = isDate(pk.expiry) ? ddiff(today(), pk.expiry) : null;
  const isPT = isPTViewSafe(), st = pkgState(c);
  body.innerHTML = `
    <div class="card ptp-pkg-hero">
      <div class="hero-eyebrow">Gói hiện tại${st!=="active" ? ` · ${PKG_STATE[st]}` : ""}</div>
      <div class="headline">${esc(pk.name || (total ? `Gói ${total} buổi` : "Chưa có gói"))}</div>
      <div class="ptp-pkg-nums">
        <div><b class="${rem!==null && rem<=3 ? "ptp-warn" : ""}">${rem===null ? "∞" : Math.max(0, rem)}</b><small>buổi còn lại</small></div>
        <div><b>${done}${total ? `<i>/${total}</i>` : ""}</b><small>đã tập${charged ? ` · ${charged} vắng trừ gói` : ""}</small></div>
        <div><b class="${dl!==null && dl<=7 ? "ptp-warn" : ""}">${dl===null ? "—" : dl < 0 ? "Hết" : dl}</b><small>${dl===null ? "chưa đặt hạn" : dl < 0 ? `hạn ${ddmm(pk.expiry)}` : `ngày tới hạn ${ddmm(pk.expiry)}`}</small></div>
      </div>
      ${total ? `<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round((done + charged)/total*100))}%"></div></div>` : ""}
      <div class="ptp-kv"><span>Giá gói gần nhất</span><b>${pk.price ? money(pk.price) : "—"}</b></div>
      <div class="ptp-kv"><span>Tổng đã thanh toán</span><b>${money(paid)}</b></div>
      ${debt ? `<div class="ptp-kv"><span>Còn nợ</span><b class="ptp-warn">${money(debt)}</b></div>` : ""}
      ${pk.price && pk.sessions ? `<div class="ptp-kv"><span>Đơn giá / buổi</span><b>${money(pk.price/pk.sessions)}</b></div>` : ""}
    </div>
    ${isPT ? `
      <button class="btn btn-primary btn-block" id="pk-renew">${ic("autorenew")}${total ? "Gia hạn / mua thêm buổi" : "Tạo gói & ghi nhận thanh toán"}</button>
      <div class="ptp-row2">
        <button class="btn btn-outline btn-block" id="pk-pay">${ic("account_balance_wallet")}Thu tiền</button>
        <button class="btn btn-outline btn-block" id="pk-edit">${ic("edit")}Sửa gói</button>
      </div>` : `<p class="small-note ptp-note">Thông tin gói do PT cập nhật. Liên hệ PT nếu cần gia hạn.</p>`}
    <div class="card">
      <div class="card-title">${ic("receipt_long")}Lịch sử thanh toán (${pays.length})</div>
      ${pays.length ? pays.map(p=> `
        <div class="ptp-pay">
          <div class="l"><b>${money(p.amount)}</b><small>${ddmmyy(p.date)} · ${esc(PAY_KIND[p.kind]||"Thanh toán")}${Number(p.sessions) ? ` · +${Math.round(Number(p.sessions))} buổi` : ""}${Number(p.price) > Number(p.amount) ? ` · giá ${moneyShort(p.price)}` : ""}</small>
            <small>${esc(p.method||"")}${p.note ? " · "+esc(p.note) : ""}</small></div>
          ${isPT ? `<button class="ptp-ib ghost" data-pay-del="${esc(p.id)}" aria-label="Xoá thanh toán">${ic("delete")}</button>` : ""}
        </div>`).join("") : `<p class="small-note">Chưa có thanh toán nào.</p>`}
    </div>`;
  if(!isPT) return;
  $("#pk-renew").addEventListener("click", ()=> openRenewSheet(c.id));
  $("#pk-pay").addEventListener("click", ()=> openPaySheet(c.id));
  $("#pk-edit").addEventListener("click", ()=> openPkgEdit(c.id));
  $$("[data-pay-del]").forEach(b=> b.addEventListener("click", ()=>{
    const p = (c.payments||[]).find(x=> x.id===b.dataset.payDel); if(!p) return;
    const sub = (p.kind==="new" || p.kind==="renew") ? Number(p.sessions)||0 : 0;
    confirmDialog("Xoá thanh toán?", `${money(p.amount)} ngày ${ddmmyy(p.date)}.${sub ? ` Gói sẽ bớt ${sub} buổi đã cộng.` : ""}`, ()=>{
      saveAndRender(c.id, doc=>{
        const out = { payments: (doc.payments||[]).filter(x=> x.id!==p.id) };
        if(sub) out.packageTotal = Math.max(0, (Number(doc.packageTotal)||0) - sub);
        return out;
      }, "Đã xoá thanh toán");
    }, "Xoá", "delete");
  }));
}
function moneyField(id, label, val){
  return `<div class="field"><label>${label}</label><input type="number" inputmode="numeric" min="0" step="10000" id="${id}" value="${val||""}" placeholder="VD: 3600000"><small class="ptp-money" data-for="${id}">${val ? money(val) : ""}</small></div>`;
}
function bindMoney(){ $$(".ptp-money").forEach(s=>{ const inp = $("#"+s.dataset.for); if(inp) inp.addEventListener("input", ()=>{ s.textContent = inp.value ? money(inp.value) : ""; }); }); }

function openRenewSheet(cid){
  const c = findClient(cid); if(!c) return;
  const total = Number(c.packageTotal)||0, firstTime = !(c.payments||[]).length;
  const pk = c.pkg || {}, td = today();
  const base = isDate(pk.expiry) && pk.expiry > td ? pk.expiry : td;
  const presets = [12, 24, 36, 48];
  const legacy = firstTime && total > 0;
  ptpSheet(`
    ${sheetHead(total ? "Gia hạn gói" : "Tạo gói tập")}
    <p class="small-note ptp-note">${esc(c.name)}${total ? ` · đang có ${Math.max(0, remaining(c, sessOf(cid)))} buổi còn lại` : ""}</p>
    ${legacy ? `<button class="ptp-dayrow ptp-toggle on" id="rn-cur"><span class="t">Ghi nhận thanh toán cho gói hiện tại (${total} buổi) — không cộng thêm buổi</span><span class="ck">${ic("check")}</span></button>` : ""}
    <div class="ptp-chips" style="margin-top:10px;">${presets.map(n=> `<button class="pill" data-rn-pre="${n}">${n} buổi</button>`).join("")}</div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Tên gói</label><input id="rn-name" value="${esc(legacy ? (pk.name || `Gói ${total} buổi`) : "")}" placeholder="VD: Gói 24 buổi"></div>
      <div class="field" style="max-width:110px;"><label>Số buổi</label><input type="number" inputmode="numeric" min="0" id="rn-sess" value="${legacy ? total : ""}" placeholder="24"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">${moneyField("rn-price", "Giá gói (đ)", pk.price && legacy ? pk.price : "")}${moneyField("rn-amount", "Đã thu (đ)", "")}</div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Ngày thanh toán</label><input type="date" id="rn-date" value="${td}"></div>
      <div class="field"><label>Hạn dùng gói</label><input type="date" id="rn-exp" value="${esc(pk.expiry && legacy ? pk.expiry : "")}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Phương thức</label><select id="rn-method">${PAY_METHODS.map(m=> `<option>${esc(m)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px;"><label>Ghi chú</label><input id="rn-note" placeholder="VD: khuyến mãi tặng 2 buổi, trả góp 2 lần…"></div>
    <p class="small-note ptp-note">Để trống "Đã thu" = thu đủ. Thu thiếu → app ghi công nợ và nhắc bạn trong "Việc cần làm".</p>
    <p class="auth-err" id="rn-err"></p>
    <button class="btn btn-primary btn-block" id="rn-save" style="margin-top:10px;">Lưu</button>
  `);
  bindMoney();
  let cur = legacy;
  const autoExp = ()=>{ const n = Number($("#rn-sess").value)||0; const e = $("#rn-exp"); if(n && !e.dataset.touched) e.value = suggestExpiry(cur ? (isDate(c.startDate) ? c.startDate : td) : base, n); };
  const curBtn = $("#rn-cur"); if(curBtn) curBtn.addEventListener("click", ()=>{ cur = !cur; curBtn.classList.toggle("on", cur); autoExp(); });
  $("#rn-exp").addEventListener("change", e=>{ e.target.dataset.touched = "1"; });
  $("#rn-sess").addEventListener("input", autoExp);
  $$("[data-rn-pre]").forEach(b=> b.addEventListener("click", ()=>{ const n = b.dataset.rnPre; $("#rn-sess").value = n; if(!$("#rn-name").value || /^Gói \d+ buổi$/.test($("#rn-name").value)) $("#rn-name").value = `Gói ${n} buổi`; autoExp(); }));
  if(!legacy) autoExp();
  $("#rn-save").addEventListener("click", async ()=>{
    const sessions = Math.round(Number($("#rn-sess").value)||0), price = Math.round(Number($("#rn-price").value)||0);
    const amtRaw = $("#rn-amount").value, amount = amtRaw==="" ? price : Math.round(Number(amtRaw)||0);
    const date = $("#rn-date").value || td, expiry = $("#rn-exp").value || "";
    if(!sessions && !cur){ $("#rn-err").textContent = "Nhập số buổi của gói."; return; }
    if(price < 0 || amount < 0){ $("#rn-err").textContent = "Số tiền không hợp lệ."; return; }
    if(amount > price && price){ $("#rn-err").textContent = "Số đã thu lớn hơn giá gói."; return; }
    const kind = cur ? "current" : (total ? "renew" : "new");
    const name = $("#rn-name").value.trim() || `Gói ${sessions || total} buổi`;
    $("#rn-save").disabled = true;
    const ok = await saveAndRender(cid, doc=>{
      const add = cur ? 0 : sessions;
      const pay = { id: rid("p"), date, amount, price, sessions: cur ? (sessions || Number(doc.packageTotal)||0) : sessions, method: $("#rn-method").value, kind, note: $("#rn-note").value.trim(), by:"pt", at: Date.now() };
      return {
        packageTotal: (Number(doc.packageTotal)||0) + add,
        pkg: Object.assign({}, doc.pkg||{}, { name, price, sessions: pay.sessions, expiry, start: date, state:"active" }),
        payments: (doc.payments||[]).concat([pay]),
      };
    }, kind==="current" ? "Đã ghi nhận thanh toán" : `Đã ${total ? "gia hạn" : "tạo gói"} +${sessions} buổi`, "payments");
    if(ok) closeSheet(); else $("#rn-save").disabled = false;
  });
}
function openPaySheet(cid){
  const c = findClient(cid); if(!c) return;
  const debt = outstanding(c);
  ptpSheet(`
    ${sheetHead("Thu tiền")}
    <p class="small-note ptp-note">${esc(c.name)}${debt ? ` · còn nợ <b>${money(debt)}</b>` : " · không có công nợ"}</p>
    <div class="field-row" style="margin-top:10px;">${moneyField("py-amount", "Số tiền (đ)", debt || "")}
      <div class="field"><label>Ngày</label><input type="date" id="py-date" value="${today()}"></div></div>
    <div class="field" style="margin-top:10px;"><label>Phương thức</label><select id="py-method">${PAY_METHODS.map(m=> `<option>${esc(m)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px;"><label>Ghi chú</label><input id="py-note" placeholder="VD: trả nốt đợt 2"></div>
    <p class="auth-err" id="py-err"></p>
    <button class="btn btn-primary btn-block" id="py-save" style="margin-top:12px;">Ghi nhận</button>`);
  bindMoney();
  $("#py-save").addEventListener("click", async ()=>{
    const amount = Math.round(Number($("#py-amount").value)||0);
    if(amount <= 0){ $("#py-err").textContent = "Nhập số tiền."; return; }
    $("#py-save").disabled = true;
    const ok = await saveAndRender(cid, doc=> ({ payments: (doc.payments||[]).concat([{ id: rid("p"), date: $("#py-date").value || today(), amount, price:0, sessions:0,
      method: $("#py-method").value, kind:"debt", note: $("#py-note").value.trim(), by:"pt", at: Date.now() }]) }), "Đã ghi nhận thanh toán", "payments");
    if(ok) closeSheet(); else $("#py-save").disabled = false;
  });
}
function openPkgEdit(cid){
  const c = findClient(cid); if(!c) return;
  const pk = c.pkg || {}, st = pkgState(c);
  ptpSheet(`
    ${sheetHead("Sửa gói tập")}
    <div class="field"><label>Tên gói</label><input id="pe-name" value="${esc(pk.name||"")}" placeholder="VD: Gói 24 buổi"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Tổng số buổi</label><input type="number" inputmode="numeric" min="0" id="pe-total" value="${Number(c.packageTotal)||""}"></div>
      <div class="field"><label>Hạn dùng</label><input type="date" id="pe-exp" value="${esc(pk.expiry||"")}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Trạng thái học viên</label><select id="pe-state">${Object.entries(PKG_STATE).map(([k,v])=> `<option value="${k}" ${st===k?"selected":""}>${v}</option>`).join("")}</select></div>
    <p class="small-note ptp-note">"Tạm nghỉ" / "Đã kết thúc" sẽ tắt nhắc vắng, nhắc xếp lịch cho học viên này.</p>
    <button class="btn btn-primary btn-block" id="pe-save" style="margin-top:12px;">Lưu</button>`);
  $("#pe-save").addEventListener("click", async ()=>{
    $("#pe-save").disabled = true;
    const ok = await saveAndRender(cid, doc=> ({ packageTotal: Math.max(0, Math.round(Number($("#pe-total").value)||0)),
      pkg: Object.assign({}, doc.pkg||{}, { name: $("#pe-name").value.trim(), expiry: $("#pe-exp").value || "", state: $("#pe-state").value }) }), "Đã lưu gói");
    if(ok) closeSheet(); else $("#pe-save").disabled = false;
  });
}
function openRevenue(ym){
  ym = ym || ui.revYm || ymOf(today()); ui.revYm = ym;
  const clients = ptData.asPT, now = Date.now(), td = today();
  const months = Array.from({ length:6 }, (_,i)=> ymAdd(ym, i-5)).map(m=> ({ m, v: clients.reduce((a,c)=> a + paidIn(c, m), 0) }));
  const maxV = Math.max(1, ...months.map(x=> x.v));
  const pays = []; clients.forEach(c=> (c.payments||[]).forEach(p=>{ if(ymOf(p.date)===ym) pays.push({ c, p }); }));
  pays.sort((a,b)=> String(b.p.date).localeCompare(String(a.p.date)));
  const total = pays.reduce((a,x)=> a + (Number(x.p.amount)||0), 0);
  const doneM = clients.reduce((a,c)=> a + sessOf(c.id).filter(s=> s.status==="done" && ymOf(s.date)===ym).length, 0);
  const active = clients.filter(c=> isActive(c, sessOf(c.id), now)).length;
  const debt = clients.reduce((a,c)=> a + outstanding(c), 0);
  let pSum = 0, sSum = 0; clients.forEach(c=> (c.payments||[]).forEach(p=>{ if(p.kind!=="debt" && Number(p.price) && Number(p.sessions)){ pSum += Number(p.price); sSum += Number(p.sessions); } }));
  const renewSoon = clients.map(c=>{ const rem = remaining(c, sessOf(c.id)), pk = c.pkg||{}; const dl = isDate(pk.expiry) ? ddiff(td, pk.expiry) : null;
    return { c, rem, dl, need: pkgState(c)==="active" && ((rem!==null && rem<=3) || (dl!==null && dl<=14)) }; }).filter(x=> x.need);
  const potential = renewSoon.reduce((a,x)=> a + (Number(x.c.pkg && x.c.pkg.price)||0), 0);
  const mLabel = m=> `T${Number(m.slice(5,7))}`;
  ptpSheet(`
    ${sheetHead("Gói tập & doanh thu")}
    <div class="ptp-calnav">
      <button class="ptp-ib" data-rv="-1" aria-label="Tháng trước">${ic("chevron_left")}</button>
      <div class="lbl"><b>Tháng ${Number(ym.slice(5,7))}/${ym.slice(0,4)}</b><small>${pays.length} giao dịch</small></div>
      <button class="ptp-ib" data-rv="1" aria-label="Tháng sau" ${ym >= ymOf(td) ? "disabled" : ""}>${ic("chevron_right")}</button>
    </div>
    <div class="ptp-rev-hero"><small>Đã thu trong tháng</small><b>${money(total)}</b></div>
    <div class="stat-grid cols-2 ptp-kpi2">
      <div class="stat-box"><div class="num">${active}<i>/${clients.length}</i></div><div class="cap">Học viên đang hoạt động</div></div>
      <div class="stat-box"><div class="num">${doneM}</div><div class="cap">Buổi đã dạy trong tháng</div></div>
      <div class="stat-box"><div class="num">${sSum ? moneyShort(pSum/sSum) : "—"}</div><div class="cap">Đơn giá TB / buổi</div></div>
      <div class="stat-box"><div class="num ${debt?"ptp-warn":""}">${moneyShort(debt)}</div><div class="cap">Công nợ chưa thu</div></div>
    </div>
    <div class="card">
      <div class="card-title">${ic("bar_chart")}Doanh thu 6 tháng</div>
      <div class="ptp-bars">${months.map(x=> `<button class="b ${x.m===ym?"on":""}" data-rv-m="${x.m}"><span class="v">${x.v ? moneyShort(x.v) : ""}</span><i style="height:${Math.round(x.v/maxV*100)}%"></i><small>${mLabel(x.m)}</small></button>`).join("")}</div>
    </div>
    ${renewSoon.length ? `<div class="card">
      <div class="card-title">${ic("autorenew")}Sắp cần gia hạn (${renewSoon.length})</div>
      ${potential ? `<p class="small-note ptp-note">Doanh thu tiềm năng nếu gia hạn đủ: <b>${money(potential)}</b></p>` : ""}
      ${renewSoon.map(x=> `<div class="ptp-pay"><div class="l"><b>${esc(x.c.name)}</b><small>${x.rem!==null ? `còn ${Math.max(0,x.rem)} buổi` : "không giới hạn buổi"}${x.dl!==null ? ` · ${x.dl<0 ? "đã hết hạn" : `hết hạn sau ${x.dl} ngày`}` : ""}</small></div>
        <button class="btn btn-soft btn-sm" data-rv-renew="${esc(x.c.id)}">Gia hạn</button></div>`).join("")}
    </div>` : ""}
    <div class="card">
      <div class="card-title">${ic("receipt_long")}Thanh toán trong tháng</div>
      ${pays.length ? pays.map(({c,p})=> `<div class="ptp-pay"><div class="l"><b>${esc(c.name)}</b><small>${ddmm(p.date)} · ${esc(PAY_KIND[p.kind]||"Thanh toán")}${Number(p.sessions) && p.kind!=="current" ? ` · +${Math.round(Number(p.sessions))} buổi` : ""} · ${esc(p.method||"")}</small></div><b class="amt">${money(p.amount)}</b></div>`).join("")
        : `<p class="small-note">Chưa có thanh toán nào trong tháng này. Ghi nhận trong form học viên → tab "Gói tập".</p>`}
    </div>`);
  $$("[data-rv]").forEach(b=> b.addEventListener("click", ()=> openRevenue(ymAdd(ym, Number(b.dataset.rv)))));
  $$("[data-rv-m]").forEach(b=> b.addEventListener("click", ()=> openRevenue(b.dataset.rvM)));
  $$("[data-rv-renew]").forEach(b=> b.addEventListener("click", ()=> openRenewSheet(b.dataset.rvRenew)));
}

/* ---------------------------------------------------------------------
   7. HỒ SƠ SỨC KHOẺ (tab trong form học viên — PT & học viên)
   --------------------------------------------------------------------- */
function renderHealthTab(body, c){
  const h = c.health || {}, td = today(), role = (typeof cf!=="undefined" && cf.role) || "pt", isPT = role==="pt";
  const ms = sortedMeasures(c), { last, first } = latestValues(ms);
  const age = ageOf(h.dob, td), bmi = bmiInfo(last.weight && last.weight.v, num(h.height)), whr = whrInfo(last.waist && last.waist.v, last.hip && last.hip.v, h.gender);
  const pq = parqStatus(h, td, c.parqClearance);
  const clr = c.parqClearance || null;
  const conds = (h.conditions||[]);
  const g = h.goal || {};
  const dir = goalDir(h);
  const photos = (c.photos||[]).filter(p=> isImg(p.data)).slice().sort((a,b)=> String(b.date).localeCompare(String(a.date)));
  const pqPill = { none:`<span class="st st-late">Chưa làm</span>`, ok:`<span class="st st-done">Đạt</span>`, refer:`<span class="st st-late">Cần ý kiến BS</span>`, cleared:`<span class="st st-up">BS đã cho phép</span>` }[pq.state];
  const metric = MEASURES.find(m=> m.k===ui.metric) || MEASURES[0];
  const pts = ms.map(m=> ({ date:m.date, v: num(m[metric.k]) })).filter(p=> p.v!=null);
  const target = metric.k==="weight" ? num(g.targetWeight) : metric.k==="fat" ? num(g.targetFat) : null;
  // tiến độ cân nặng về mục tiêu
  let wProg = null;
  if(num(g.targetWeight) && first.weight && last.weight && first.weight.v !== num(g.targetWeight)){
    wProg = Math.max(0, Math.min(1, (first.weight.v - last.weight.v) / (first.weight.v - num(g.targetWeight))));
  }
  const goalDays = isDate(g.targetDate) ? ddiff(td, g.targetDate) : null;
  body.innerHTML = `
    <div class="ptp-ov">
      <div><small>Tuổi</small><b>${age!=null ? age : "—"}</b><i>${h.gender==="male" ? "Nam" : h.gender==="female" ? "Nữ" : "&nbsp;"}</i></div>
      <div><small>BMI</small><b>${bmi ? fmtNum(bmi.v) : "—"}</b><i class="${bmi && !bmi.ok ? "ptp-warn" : ""}">${bmi ? bmi.cls : (h.height ? "cần cân nặng" : "cần chiều cao")}</i></div>
      <div><small>Eo / mông</small><b>${whr ? fmtNum(whr.v, 2) : "—"}</b><i class="${whr && whr.risk ? "ptp-warn" : ""}">${whr ? (whr.risk ? `≥ ${whr.lim} nguy cơ` : "trong ngưỡng") : "cần số đo"}</i></div>
      <div><small>PAR-Q</small><b>${pq.state==="none" ? "—" : `${pq.yes}<em>/7</em>`}</b><i class="${pq.state==="refer" ? "ptp-warn" : ""}">${pq.state==="none" ? "chưa làm" : pq.state==="ok" ? "không có “Có”" : pq.state==="cleared" ? "đã có xác nhận BS" : "câu trả lời “Có”"}</i></div>
    </div>

    ${conds.filter(x=> x.status!=="recovered").length || pq.state==="refer" ? `<div class="ptp-alert">${ic("health_and_safety")}<div><b>Lưu ý an toàn khi xếp bài</b>
      ${pq.state==="refer" ? `<small>PAR-Q có ${pq.yes} câu "Có": chỉ tập nhẹ, tăng dần cho tới khi có ý kiến bác sĩ.</small>` : ""}
      ${conds.filter(x=> x.status!=="recovered").map(x=> `<small><b>${esc(x.name)}</b>${x.avoid ? ": "+esc(x.avoid) : ""}</small>`).join("")}</div></div>` : ""}

    <div class="card">
      <div class="card-title">${ic("quiz")}PAR-Q — sàng lọc trước khi tập ${pqPill}</div>
      <p class="small-note ptp-note">${pq.state==="none" ? "7 câu hỏi chuẩn quốc tế giúp phát hiện rủi ro tim mạch, xương khớp trước khi tăng mức vận động. Nên làm ở buổi đầu tiên và làm lại mỗi 12 tháng hoặc khi sức khoẻ thay đổi."
        : `Làm ngày ${ddmmyy(pq.date)}${h.parq && h.parq.by ? ` · bởi ${h.parq.by==="pt" ? "PT" : "học viên"}` : ""}${pq.stale ? " · <b>đã quá 12 tháng, nên làm lại</b>" : ""}.`}</p>
      ${pq.state==="refer" ? `<p class="small-note ptp-note">Có ít nhất 1 câu "Có": cần trao đổi với bác sĩ trước khi tăng cường độ hoặc làm bài đánh giá thể lực. Trong lúc chờ: tập nhẹ, tăng dần, tránh bài gắng sức tối đa.</p>` : ""}
      ${pq.state==="ok" ? `<p class="small-note ptp-note">Có thể bắt đầu tăng dần mức vận động. Hoãn tập nếu đang ốm, sốt; phụ nữ mang thai cần hỏi ý kiến bác sĩ.</p>` : ""}
      ${pq.state==="cleared" && clr ? `<p class="small-note ptp-note">Xác nhận của bác sĩ ngày ${isDate(clr.date) ? ddmmyy(clr.date) : "—"} · PT ${esc(clr.byName || "")} ghi nhận ${clr.at ? ddmmyy(dstr(new Date(Number(clr.at)))) : ""}${clr.note ? " · "+esc(clr.note) : ""}</p>` : ""}
      ${pq.legacyClearance ? `<p class="small-note ptp-note">Có xác nhận "BS đã cho phép" cũ không rõ người ghi — ${isPT ? "PT cần xác nhận lại (kèm ngày & người xác nhận)." : "PT sẽ xác nhận lại."}</p>` : ""}
      <div class="ptp-row2">
        <button class="btn btn-outline btn-sm btn-block" id="hp-parq">${pq.state==="none" ? "Làm PAR-Q (7 câu)" : "Xem / làm lại"}</button>
        ${isPT && (pq.state==="refer" || pq.state==="cleared") ? `<button class="btn btn-soft btn-sm btn-block" id="hp-clear">${pq.state==="cleared" ? "Sửa xác nhận BS" : "Đã có xác nhận BS"}</button>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="card-title">${ic("healing")}Chấn thương &amp; bệnh lý<button class="btn btn-soft btn-sm ptp-right" id="hp-cond-add">${ic("add")}Thêm</button></div>
      ${conds.length ? conds.map(x=> `
        <button class="ptp-cond" data-cond="${esc(x.id)}">
          <div class="top"><b>${esc(x.name)}</b><span class="st ${x.status==="recovered" ? "st-done" : "st-late"}">${x.status==="recovered" ? "Đã hồi phục" : "Đang theo dõi"}</span></div>
          <small>${x.kind==="disease" ? "Bệnh lý" : "Chấn thương"}${x.since ? " · từ "+esc(x.since.length===7 ? x.since.slice(5)+"/"+x.since.slice(0,4) : ddmmyy(x.since)) : ""}${x.note ? " · "+esc(x.note) : ""}</small>
          ${x.avoid ? `<small class="av">${ic("warning")}${esc(x.avoid)}</small>` : ""}
        </button>`).join("") : `<p class="small-note">Chưa ghi nhận chấn thương / bệnh lý nào.</p>`}
    </div>

    <div class="card">
      <div class="card-title">${ic("flag")}Mục tiêu chi tiết<button class="btn btn-soft btn-sm ptp-right" id="hp-goal">${ic("edit")}Sửa</button></div>
      <div class="ptp-goal">
        <div class="main">${esc(g.main || c.goal || "Chưa đặt mục tiêu")}</div>
        ${c.goal && g.main ? `<small>${esc(c.goal)}</small>` : ""}
        <div class="ptp-kvs">
          ${num(g.targetWeight) ? `<div class="ptp-kv"><span>Cân nặng mục tiêu</span><b>${fmtNum(g.targetWeight)} kg${last.weight ? ` <i>(hiện ${fmtNum(last.weight.v)})</i>` : ""}</b></div>` : ""}
          ${num(g.targetFat) ? `<div class="ptp-kv"><span>% mỡ mục tiêu</span><b>${fmtNum(g.targetFat)}%${last.fat ? ` <i>(hiện ${fmtNum(last.fat.v)}%)</i>` : ""}</b></div>` : ""}
          ${isDate(g.targetDate) ? `<div class="ptp-kv"><span>Hạn mục tiêu</span><b>${ddmmyy(g.targetDate)} <i>(${goalDays >= 0 ? `còn ${goalDays} ngày` : "đã qua"})</i></b></div>` : ""}
          ${g.level ? `<div class="ptp-kv"><span>Trình độ</span><b>${esc(LEVELS[g.level]||g.level)}</b></div>` : ""}
          ${g.daysPerWeek ? `<div class="ptp-kv"><span>Có thể tập</span><b>${esc(g.daysPerWeek)} buổi/tuần</b></div>` : ""}
          ${num(h.height) ? `<div class="ptp-kv"><span>Chiều cao</span><b>${fmtNum(h.height)} cm</b></div>` : ""}
          ${isDate(h.dob) ? `<div class="ptp-kv"><span>Ngày sinh</span><b>${ddmmyy(h.dob)}</b></div>` : ""}
        </div>
        ${wProg!==null ? `<div class="progress-row"><span class="label">Tiến độ cân nặng</span><span class="value">${Math.round(wProg*100)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(wProg*100)}%"></div></div>` : ""}
        ${g.why ? `<p class="small-note ptp-note"><b>Động lực:</b> ${esc(g.why)}</p>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="card-title">${ic("straighten")}Số đo cơ thể<button class="btn btn-soft btn-sm ptp-right" id="hp-m-add">${ic("add")}Đo mới</button></div>
      <div class="ptp-chips">${MEASURES.map(m=> `<button class="pill ${m.k===metric.k?"active":""}" data-metric="${m.k}">${m.short}</button>`).join("")}</div>
      <div class="ptp-chart">${pts.length ? trendSVG(pts, { target, label: metric.label }) : `<div class="ptp-empty sm">${ic("show_chart")}<p>Chưa có số đo ${esc(metric.label.toLowerCase())}.</p></div>`}
        ${pts.length===1 ? `<p class="small-note">Cần từ 2 lần đo để thấy xu hướng.</p>` : ""}</div>
      <div class="ptp-mgrid">${MEASURES.map(m=>{
        const L = last[m.k], F = first[m.k]; if(!L) return `<div class="c"><small>${m.short}</small><b>—</b></div>`;
        const d = F && F.date!==L.date ? r1(L.v - F.v) : null, good = dir && m.good[dir] ? Math.sign(d||0) === m.good[dir] : null;
        return `<div class="c"><small>${m.short}</small><b>${fmtNum(L.v)}<i>${m.unit}</i></b>${d ? `<em class="${good===true?"up":good===false?"down":""}">${d>0?"+":""}${fmtNum(d)}</em>` : ""}</div>`; }).join("")}</div>
      ${ms.length ? `<details class="ptp-hist"><summary>Lịch sử đo (${ms.length} lần)</summary>
        ${ms.slice().reverse().map(m=> `<div class="ptp-mrow"><b>${ddmmyy(m.date)}</b><span>${MEASURES.filter(f=> num(m[f.k])!=null).map(f=> `${f.short} ${fmtNum(m[f.k])}`).join(" · ")}</span>
          ${isPT || m.by===role ? `<button class="ptp-ib ghost" data-m-del="${esc(m.id)}" aria-label="Xoá lần đo">${ic("delete")}</button>` : ""}</div>`).join("")}</details>` : ""}
      <p class="small-note ptp-note">${MEASURE_TIPS}</p>
    </div>

    <div class="card">
      <div class="card-title">${ic("photo_library")}Ảnh tiến độ <span class="ptp-count">${photos.length}/${MAX_PHOTOS}</span></div>
      ${photos.length ? `<div class="ptp-photos">${photos.map(p=> `<button class="ptp-ph" data-ph="${esc(p.id)}"><img src="${esc(p.data)}" alt="Ảnh ${esc(POSES[p.pose]||"")} ngày ${ddmm(p.date)}"><span>${ddmm(p.date)} · ${esc(POSES[p.pose]||"")}</span></button>`).join("")}</div>`
        : `<p class="small-note">Chưa có ảnh. Ảnh được nén ~600px để lưu gọn và chỉ PT + học viên xem được.</p>`}
      <div class="ptp-row2">
        <button class="btn btn-outline btn-sm btn-block" id="hp-ph-add" ${photos.length >= MAX_PHOTOS ? "disabled" : ""}>${ic("photo_camera")}Thêm ảnh</button>
        ${photos.length >= 2 ? `<button class="btn btn-outline btn-sm btn-block" id="hp-ph-cmp">${ic("compare")}So sánh trước / sau</button>` : ""}
      </div>
      <p class="small-note ptp-note">${PHOTO_TIPS}</p>
    </div>`;
  $("#hp-parq").addEventListener("click", ()=> openParq(c.id));
  const cl = $("#hp-clear"); if(cl) cl.addEventListener("click", ()=> openClearance(c.id));
  $("#hp-cond-add").addEventListener("click", ()=> openCondSheet(c.id, null));
  $$("[data-cond]").forEach(b=> b.addEventListener("click", ()=> openCondSheet(c.id, b.dataset.cond)));
  $("#hp-goal").addEventListener("click", ()=> openGoalSheet(c.id));
  $("#hp-m-add").addEventListener("click", ()=> openMeasureSheet(c.id));
  $$("[data-metric]").forEach(b=> b.addEventListener("click", ()=>{ ui.metric = b.dataset.metric; renderClientForm(); }));
  $$("[data-m-del]").forEach(b=> b.addEventListener("click", ()=> confirmDialog("Xoá lần đo này?", "Số đo của ngày này sẽ bị xoá.", ()=>{
    saveAndRender(c.id, doc=> ({ measurements: (doc.measurements||[]).filter(x=> x.id!==b.dataset.mDel) }), "Đã xoá lần đo");
  }, "Xoá", "delete")));
  $$("[data-ph]").forEach(b=> b.addEventListener("click", ()=> openPhotoView(c.id, b.dataset.ph)));
  const pa = $("#hp-ph-add"); if(pa) pa.addEventListener("click", ()=> openPhotoAdd(c.id));
  const pc = $("#hp-ph-cmp"); if(pc) pc.addEventListener("click", ()=> openPhotoCompare(c.id));
}

/* ---- PAR-Q ---- */
function openParq(cid){
  const c = findClient(cid); if(!c) return;
  const h = c.health || {}, old = (h.parq && Array.isArray(h.parq.answers)) ? h.parq.answers.slice() : [];
  const ans = PARQ.map((_,i)=> old[i]===true || old[i]===false ? old[i] : null);
  const role = (typeof cf!=="undefined" && cf.role) || "pt";
  ptpSheet(`
    ${sheetHead("PAR-Q — 7 câu sàng lọc")}
    <p class="small-note ptp-note">Trả lời trung thực "Có" hoặc "Không" cho từng câu. Nếu chưa chắc, hãy chọn "Có" và hỏi ý kiến bác sĩ.</p>
    <div class="ptp-parq">${PARQ.map((q,i)=> `
      <div class="ptp-q"><p><b>${i+1}.</b> ${q}</p>
        <div class="ptp-yn" data-q="${i}">
          <button class="${ans[i]===true?"on yes":""}" data-v="1">Có</button>
          <button class="${ans[i]===false?"on no":""}" data-v="0">Không</button>
        </div></div>`).join("")}</div>
    <p class="auth-err" id="pq-err"></p>
    <button class="btn btn-primary btn-block" id="pq-save" style="margin-top:12px;">Lưu kết quả</button>
    <p class="small-note ptp-note">PAR-Q phù hợp cho người 15–69 tuổi. Ngoài độ tuổi này, nên khám sức khoẻ trước khi tập.</p>`);
  $$(".ptp-yn").forEach(g=> $$("button", g).forEach(b=> b.addEventListener("click", ()=>{
    const i = Number(g.dataset.q); ans[i] = b.dataset.v==="1";
    $$("button", g).forEach(x=> x.className = ""); b.className = "on " + (ans[i] ? "yes" : "no");
  })));
  $("#pq-save").addEventListener("click", async ()=>{
    const miss = ans.findIndex(a=> a===null);
    if(miss >= 0){ $("#pq-err").textContent = `Còn câu ${miss+1} chưa trả lời.`; return; }
    $("#pq-save").disabled = true;
    const ok = await saveAndRender(cid, doc=>{
      const hh = Object.assign({}, doc.health||{}), prev = hh.parq || {};
      const same = Array.isArray(prev.answers) && prev.answers.join() === ans.join();
      hh.parq = { answers: ans, date: today(), by: role, clearance: same ? (prev.clearance || null) : null };   // clearance cũ chỉ để tương thích; xác nhận thật ở clients.parqClearance
      return { health: hh };
    }, ans.some(Boolean) ? 'Đã lưu — có câu "Có", cần ý kiến bác sĩ' : "Đã lưu PAR-Q: có thể bắt đầu tập", ans.some(Boolean) ? "health_and_safety" : "check_circle");
    if(ok) closeSheet(); else $("#pq-save").disabled = false;
  });
}
function openClearance(cid){
  const c = findClient(cid); if(!c) return;
  if(roleFor(cid) !== "pt"){ toast("Chỉ PT ghi nhận xác nhận của bác sĩ", "error"); return; }
  const cl = c.parqClearance || {};
  ptpSheet(`
    ${sheetHead("Xác nhận của bác sĩ")}
    <button class="ptp-dayrow ptp-toggle ${cl.ok?"on":""}" id="cl-ok"><span class="t">Học viên đã có ý kiến bác sĩ cho phép tập</span><span class="ck">${ic("check")}</span></button>
    <div class="field" style="margin-top:10px;"><label>Ngày xác nhận</label><input type="date" id="cl-date" value="${esc(cl.date || today())}"></div>
    <div class="field" style="margin-top:10px;"><label>Giới hạn bác sĩ dặn</label><textarea id="cl-note" rows="2" placeholder="VD: nhịp tim tối đa 140, không tập tạ nặng 2 tháng">${esc(cl.note||"")}</textarea></div>
    <button class="btn btn-primary btn-block" id="cl-save" style="margin-top:12px;">Lưu</button>`);
  let okv = !!cl.ok;
  $("#cl-ok").addEventListener("click", e=>{ okv = !okv; e.currentTarget.classList.toggle("on", okv); });
  $("#cl-save").addEventListener("click", async ()=>{
    const ok = await saveAndRender(cid, doc=>{
      const p = (doc.health && doc.health.parq) || {};
      const u = cloud.user || {};
      return { parqClearance: { ok: okv, date: $("#cl-date").value || today(), note: $("#cl-note").value.trim(),
        answers: Array.isArray(p.answers) ? p.answers.join() : "", by:"pt", byUid: u.uid || null, byName: (cloud.profile && cloud.profile.brandName) || u.name || "PT", at: Date.now() } };
    }, "Đã lưu xác nhận");
    if(ok) closeSheet();
  });
}

/* ---- Chấn thương / bệnh lý ---- */
function openCondSheet(cid, id){
  const c = findClient(cid); if(!c) return;
  const list = (c.health && c.health.conditions) || [];
  const x = Object.assign({ kind:"injury", name:"", since:"", status:"active", avoid:"", note:"" }, list.find(y=> y.id===id) || {});
  const opts = ()=> (x.kind==="disease" ? DISEASES : INJURY_AREAS);
  let drawn = false;
  const draw = ()=>{
    ptpSheet(`
      ${sheetHead(id ? "Sửa chấn thương / bệnh lý" : "Thêm chấn thương / bệnh lý")}
      <div class="seg ptp-seg"><button class="${x.kind!=="disease"?"active":""}" data-kind="injury">Chấn thương</button><button class="${x.kind==="disease"?"active":""}" data-kind="disease">Bệnh lý</button></div>
      <div class="ptp-chips" style="margin-top:10px;">${opts().map(o=> `<button class="pill ${x.name===o || x.name.startsWith(o+" ")?"active":""}" data-cpre="${esc(o)}">${esc(o)}</button>`).join("")}</div>
      <div class="field" style="margin-top:10px;"><label>${x.kind==="disease" ? "Bệnh lý" : "Vùng / chấn thương"}*</label><input id="cd-name" value="${esc(x.name)}" placeholder="${x.kind==="disease" ? "VD: Tăng huyết áp" : "VD: Gối trái — đau sụn chêm"}"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Từ khi nào</label><input type="month" id="cd-since" value="${esc(String(x.since||"").slice(0,7))}"></div>
        <div class="field"><label>Tình trạng</label><select id="cd-status"><option value="active" ${x.status!=="recovered"?"selected":""}>Đang theo dõi</option><option value="recovered" ${x.status==="recovered"?"selected":""}>Đã hồi phục</option></select></div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Bài cần tránh / cách điều chỉnh</label><textarea id="cd-avoid" rows="3">${esc(x.avoid)}</textarea></div>
      <div class="field" style="margin-top:10px;"><label>Ghi chú (thuốc, chỉ định bác sĩ…)</label><input id="cd-note" value="${esc(x.note)}"></div>
      <p class="auth-err" id="cd-err"></p>
      <button class="btn btn-primary btn-block" id="cd-save" style="margin-top:10px;">Lưu</button>
      ${id ? `<button class="btn btn-ghost btn-block" id="cd-del">${ic("delete")}Xoá mục này</button>` : ""}`, drawn);
    drawn = true;
    const sync = ()=>{ x.name = $("#cd-name").value; x.since = $("#cd-since").value; x.status = $("#cd-status").value; x.avoid = $("#cd-avoid").value; x.note = $("#cd-note").value; };
    $$("[data-kind]").forEach(b=> b.addEventListener("click", ()=>{ sync(); x.kind = b.dataset.kind; draw(); }));
    $$("[data-cpre]").forEach(b=> b.addEventListener("click", ()=>{
      sync(); const o = b.dataset.cpre;
      const prevHint = AVOID_HINTS[x.name] || "";
      if(o!=="Khác") x.name = o;
      if(AVOID_HINTS[o] && (!x.avoid.trim() || x.avoid===prevHint)) x.avoid = AVOID_HINTS[o];
      draw(); if(o==="Khác") setTimeout(()=> $("#cd-name").focus(), 60);
    }));
    $("#cd-save").addEventListener("click", async ()=>{
      sync();
      if(!x.name.trim()){ $("#cd-err").textContent = "Nhập tên chấn thương / bệnh lý."; return; }
      $("#cd-save").disabled = true;
      const item = { id: id || rid("h"), kind:x.kind, name:x.name.trim(), since:x.since||"", status:x.status, avoid:x.avoid.trim(), note:x.note.trim(), by:(typeof cf!=="undefined"?cf.role:"pt"), at:Date.now() };
      const ok = await saveAndRender(cid, doc=>{
        const hh = Object.assign({}, doc.health||{}), arr = (hh.conditions||[]).slice();
        const i = arr.findIndex(y=> y.id===item.id);
        if(i >= 0) arr[i] = item; else arr.push(item);
        hh.conditions = arr;
        return { health: hh };
      }, "Đã lưu");
      if(ok) closeSheet(); else $("#cd-save").disabled = false;
    });
    const del = $("#cd-del"); if(del) del.addEventListener("click", ()=> confirmDialog("Xoá mục này?", esc(x.name), ()=>{
      saveAndRender(cid, doc=>{ const hh = Object.assign({}, doc.health||{}); hh.conditions = (hh.conditions||[]).filter(y=> y.id!==id); return { health: hh }; }, "Đã xoá");
    }, "Xoá", "delete"));
  };
  draw();
}

/* ---- Mục tiêu chi tiết + thông tin cơ thể ---- */
function openGoalSheet(cid){
  const c = findClient(cid); if(!c) return;
  const h = c.health || {}, g = h.goal || {};
  ptpSheet(`
    ${sheetHead("Mục tiêu & thông tin cơ thể")}
    <div class="ptp-sub">Mục tiêu chính</div>
    <div class="ptp-chips" id="gl-main">${GOAL_MAIN.map(o=> `<button class="pill ${g.main===o?"active":""}" data-gm="${esc(o)}">${esc(o)}</button>`).join("")}</div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Cân nặng mục tiêu (kg)</label><input type="number" inputmode="decimal" step="0.1" id="gl-tw" value="${esc(g.targetWeight||"")}"></div>
      <div class="field"><label>% mỡ mục tiêu</label><input type="number" inputmode="decimal" step="0.1" id="gl-tf" value="${esc(g.targetFat||"")}"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Hạn đạt mục tiêu</label><input type="date" id="gl-td" value="${esc(g.targetDate||"")}"></div>
      <div class="field"><label>Buổi/tuần có thể tập</label><select id="gl-dpw"><option value="">—</option>${[1,2,3,4,5,6,7].map(n=> `<option ${Number(g.daysPerWeek)===n?"selected":""}>${n}</option>`).join("")}</select></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Trình độ tập luyện</label><select id="gl-lv"><option value="">—</option>${Object.entries(LEVELS).map(([k,v])=> `<option value="${k}" ${g.level===k?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px;"><label>Động lực / lý do (giúp PT giữ lửa cho học viên)</label><textarea id="gl-why" rows="2" placeholder="VD: mặc vừa váy cưới tháng 6, chạy 10 km cùng bạn">${esc(g.why||"")}</textarea></div>
    <div class="ptp-sub" style="margin-top:14px;">Thông tin cơ thể</div>
    <div class="field-row">
      <div class="field"><label>Ngày sinh</label><input type="date" id="gl-dob" value="${esc(h.dob||"")}"></div>
      <div class="field"><label>Giới tính</label><select id="gl-gender"><option value="">—</option><option value="male" ${h.gender==="male"?"selected":""}>Nam</option><option value="female" ${h.gender==="female"?"selected":""}>Nữ</option></select></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Chiều cao (cm)</label><input type="number" inputmode="decimal" step="0.5" id="gl-h" value="${esc(h.height||"")}"></div>
    <p class="small-note ptp-note">Mục tiêu giảm mỡ an toàn: 0,5–1% cân nặng mỗi tuần. Tăng cơ: khoảng 0,25–0,5% cân nặng mỗi tuần.</p>
    <p class="auth-err" id="gl-err"></p>
    <button class="btn btn-primary btn-block" id="gl-save" style="margin-top:10px;">Lưu</button>`);
  let main = g.main || "";
  $$("[data-gm]").forEach(b=> b.addEventListener("click", ()=>{ main = main===b.dataset.gm ? "" : b.dataset.gm; $$("[data-gm]").forEach(x=> x.classList.toggle("active", x.dataset.gm===main)); }));
  $("#gl-save").addEventListener("click", async ()=>{
    const tw = num($("#gl-tw").value), tf = num($("#gl-tf").value), hh = num($("#gl-h").value), dob = $("#gl-dob").value;
    if(tw!=null && (tw < 25 || tw > 300)){ $("#gl-err").textContent = "Cân nặng mục tiêu không hợp lệ."; return; }
    if(tf!=null && (tf < 3 || tf > 60)){ $("#gl-err").textContent = "% mỡ mục tiêu nên trong khoảng 3–60%."; return; }
    if(hh!=null && (hh < 90 || hh > 250)){ $("#gl-err").textContent = "Chiều cao không hợp lệ (90–250 cm)."; return; }
    if(dob && ageOf(dob, today())===null){ $("#gl-err").textContent = "Ngày sinh không hợp lệ."; return; }
    $("#gl-save").disabled = true;
    const ok = await saveAndRender(cid, doc=>{
      const H = Object.assign({}, doc.health||{});
      H.goal = { main, targetWeight: tw, targetFat: tf, targetDate: $("#gl-td").value || "", level: $("#gl-lv").value || "",
        daysPerWeek: Number($("#gl-dpw").value) || null, why: $("#gl-why").value.trim() };
      H.dob = dob || ""; H.gender = $("#gl-gender").value || ""; H.height = hh;
      return { health: H };
    }, "Đã lưu mục tiêu", "flag");
    if(ok) closeSheet(); else $("#gl-save").disabled = false;
  });
}

/* ---- Số đo ---- */
function openMeasureSheet(cid){
  const c = findClient(cid); if(!c) return;
  const { last } = latestValues(sortedMeasures(c));
  const role = (typeof cf!=="undefined" && cf.role) || "pt";
  ptpSheet(`
    ${sheetHead("Nhập số đo")}
    <div class="field"><label>Ngày đo</label><input type="date" id="ms-date" value="${today()}"></div>
    <div class="ptp-mform">${MEASURES.map(m=> `
      <div class="field"><label>${m.label} (${m.unit})</label><input type="number" inputmode="decimal" step="${m.step}" min="${m.min}" max="${m.max}" data-mf="${m.k}" placeholder="${last[m.k] ? "lần trước "+fmtNum(last[m.k].v) : ""}"></div>`).join("")}</div>
    <p class="small-note ptp-note">${MEASURE_TIPS} % mỡ: dùng cùng một máy InBody / cân điện tử để so sánh.</p>
    <p class="auth-err" id="ms-err"></p>
    <button class="btn btn-primary btn-block" id="ms-save" style="margin-top:10px;">Lưu số đo</button>`);
  $("#ms-save").addEventListener("click", async ()=>{
    const date = $("#ms-date").value;
    if(!isDate(date)){ $("#ms-err").textContent = "Chọn ngày đo."; return; }
    if(date > today()){ $("#ms-err").textContent = "Ngày đo không được ở tương lai."; return; }
    const vals = {}; let bad = null;
    $$("[data-mf]").forEach(inp=>{ const v = num(inp.value); if(v==null) return; const m = MEASURES.find(x=> x.k===inp.dataset.mf);
      if(v < m.min || v > m.max) bad = bad || `${m.label} nên trong khoảng ${m.min}–${m.max} ${m.unit}.`; else vals[m.k] = r1(v); });
    if(bad){ $("#ms-err").textContent = bad; return; }
    if(!Object.keys(vals).length){ $("#ms-err").textContent = "Nhập ít nhất 1 số đo."; return; }
    $("#ms-save").disabled = true;
    const ok = await saveAndRender(cid, doc=>{
      const arr = (doc.measurements||[]).slice(); const i = arr.findIndex(x=> x.date===date);
      if(i >= 0) arr[i] = Object.assign({}, arr[i], vals, { at:Date.now() });
      else arr.push(Object.assign({ id: rid("m"), date, by: role, at: Date.now() }, vals));
      arr.sort((a,b)=> String(a.date).localeCompare(String(b.date)));
      return { measurements: arr.slice(-120) };
    }, "Đã lưu số đo", "straighten");
    if(ok) closeSheet(); else $("#ms-save").disabled = false;
  });
}

/* ---- Ảnh tiến trình ---- */
function compressImage(file, max, maxChars){
  max = max || 600; maxChars = maxChars || 90000;
  return new Promise((resolve, reject)=>{
    if(!file || !/^image\//.test(file.type||"image/")) return reject(new Error("Tệp không phải ảnh."));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{
      try{
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(img.width*k)); cv.height = Math.max(1, Math.round(img.height*k));
        const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        let q = 0.72, data = cv.toDataURL("image/jpeg", q);
        while(data.length > maxChars && q > 0.42){ q -= 0.1; data = cv.toDataURL("image/jpeg", q); }
        URL.revokeObjectURL(url); resolve(data);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh này (thử ảnh JPG/PNG).")); };
    img.src = url;
  });
}
function pickImage(){
  return new Promise(resolve=>{
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
    input.onchange = ()=> resolve(input.files && input.files[0] || null);
    input.click();
  });
}
function openPhotoAdd(cid){
  const c = findClient(cid); if(!c) return;
  const st = { pose:"front", date: today(), data:null };
  const role = (typeof cf!=="undefined" && cf.role) || "pt";
  const draw = ()=>{
    ptpSheet(`
      ${sheetHead("Thêm ảnh tiến độ")}
      <div class="seg ptp-seg">${Object.entries(POSES).map(([k,v])=> `<button class="${st.pose===k?"active":""}" data-pose="${k}">${v}</button>`).join("")}</div>
      <div class="field" style="margin-top:10px;"><label>Ngày chụp</label><input type="date" id="pa-date" value="${esc(st.date)}"></div>
      <button class="ptp-drop" id="pa-pick">${st.data ? `<img src="${esc(st.data)}" alt="Ảnh đã chọn">` : `${ic("photo_camera")}<span>Chọn ảnh từ máy</span><small>JPG / PNG — tự nén còn ~600px</small>`}</button>
      ${st.data ? `<p class="small-note ptp-note">Dung lượng sau nén: ~${Math.round(st.data.length*0.75/1024)} KB. Chạm vào ảnh để chọn ảnh khác.</p>` : ""}
      <p class="small-note ptp-note">${PHOTO_TIPS}</p>
      <p class="auth-err" id="pa-err"></p>
      <button class="btn btn-primary btn-block" id="pa-save" ${st.data ? "" : "disabled"} style="margin-top:10px;">Lưu ảnh</button>`, st.drawn); st.drawn = true;
    $$("[data-pose]").forEach(b=> b.addEventListener("click", ()=>{ st.date = $("#pa-date").value || st.date; st.pose = b.dataset.pose; draw(); }));
    $("#pa-pick").addEventListener("click", async ()=>{
      st.date = $("#pa-date").value || st.date;
      const f = await pickImage(); if(!f) return;
      try{ st.data = await compressImage(f, 600, 90000); draw(); }
      catch(e){ $("#pa-err").textContent = e.message; }
    });
    $("#pa-save").addEventListener("click", async ()=>{
      st.date = $("#pa-date").value || st.date;
      if(!isImg(st.data)){ $("#pa-err").textContent = "Chưa chọn ảnh."; return; }
      $("#pa-save").disabled = true; $("#pa-save").textContent = "Đang lưu…";
      let tooBig = false;
      const ok = await saveAndRender(cid, doc=>{
        const arr = (doc.photos||[]).filter(p=> isImg(p.data));
        const size = arr.reduce((a,p)=> a + p.data.length, 0) + st.data.length;
        if(arr.length >= MAX_PHOTOS || size > MAX_PHOTO_CHARS){ tooBig = true; return null; }
        return { photos: arr.concat([{ id: rid("ph"), date: st.date, pose: st.pose, data: st.data, by: role, at: Date.now() }]) };
      }, null);
      if(tooBig){ $("#pa-err").textContent = `Bộ nhớ ảnh của học viên đã đầy (tối đa ${MAX_PHOTOS} ảnh / ~${Math.round(MAX_PHOTO_CHARS*0.75/1024)} KB). Xoá bớt ảnh cũ rồi thử lại.`; $("#pa-save").disabled = false; $("#pa-save").textContent = "Lưu ảnh"; return; }
      if(ok){ closeSheet(); toast("Đã lưu ảnh tiến độ", "photo_camera"); }
      else { $("#pa-save").disabled = false; $("#pa-save").textContent = "Lưu ảnh"; }
    });
  };
  draw();
}
function nearestWeight(c, date){
  const ms = sortedMeasures(c).filter(m=> num(m.weight)!=null);
  if(!ms.length) return null;
  const best = ms.reduce((b,m)=> Math.abs(ddiff(m.date, date)) < Math.abs(ddiff(b.date, date)) ? m : b, ms[0]);
  return Math.abs(ddiff(best.date, date)) <= 14 ? num(best.weight) : null;
}
function openPhotoView(cid, pid){
  const c = findClient(cid); if(!c) return;
  const p = (c.photos||[]).find(x=> x.id===pid); if(!p || !isImg(p.data)) return;
  const role = (typeof cf!=="undefined" && cf.role) || "pt", w = nearestWeight(c, p.date);
  ptpSheet(`
    ${sheetHead(`${esc(POSES[p.pose]||"Ảnh")} · ${ddmmyy(p.date)}`)}
    <img class="ptp-big" src="${esc(p.data)}" alt="Ảnh tiến độ">
    <p class="small-note ptp-note">${p.by==="pt" ? "PT" : "Học viên"} tải lên${w ? ` · cân nặng gần ngày này: ${fmtNum(w)} kg` : ""}</p>
    ${role==="pt" || p.by===role ? `<button class="btn btn-ghost btn-block" id="pv-del">${ic("delete")}Xoá ảnh</button>` : ""}`);
  const d = $("#pv-del"); if(d) d.addEventListener("click", ()=> confirmDialog("Xoá ảnh này?", "Ảnh sẽ bị xoá với cả PT và học viên.", ()=>{
    saveAndRender(cid, doc=> ({ photos: (doc.photos||[]).filter(x=> x.id!==pid) }), "Đã xoá ảnh");
  }, "Xoá", "delete"));
}
function openPhotoCompare(cid){
  const c = findClient(cid); if(!c) return;
  const all = (c.photos||[]).filter(p=> isImg(p.data)).slice().sort((a,b)=> String(a.date).localeCompare(String(b.date)));
  const poses = Object.keys(POSES).filter(k=> all.some(p=> p.pose===k));
  if(!poses.includes(ui.cmpPose)) ui.cmpPose = poses[0];
  let list = all.filter(p=> p.pose===ui.cmpPose); if(list.length < 2) list = all;
  const st = { a: list[0].id, b: list[list.length-1].id };
  const draw = ()=>{
    const A = list.find(p=> p.id===st.a) || list[0], B = list.find(p=> p.id===st.b) || list[list.length-1];
    const wa = nearestWeight(c, A.date), wb = nearestWeight(c, B.date);
    const sel = (id, cur)=> `<select id="${id}" aria-label="Chọn ảnh">${list.map(p=> `<option value="${esc(p.id)}" ${p.id===cur?"selected":""}>${ddmmyy(p.date)} · ${esc(POSES[p.pose]||"")}</option>`).join("")}</select>`;
    ptpSheet(`
      ${sheetHead("So sánh trước / sau")}
      ${poses.length > 1 ? `<div class="seg ptp-seg">${poses.map(k=> `<button class="${ui.cmpPose===k?"active":""}" data-cmp="${k}">${POSES[k]}</button>`).join("")}</div>` : ""}
      <div class="ptp-cmp">
        <div><img src="${esc(A.data)}" alt="Trước"><div class="field">${sel("cmp-a", A.id)}</div>${wa ? `<small>${fmtNum(wa)} kg</small>` : ""}</div>
        <div><img src="${esc(B.data)}" alt="Sau"><div class="field">${sel("cmp-b", B.id)}</div>${wb ? `<small>${fmtNum(wb)} kg</small>` : ""}</div>
      </div>
      <p class="small-note ptp-note">Cách nhau ${Math.abs(ddiff(A.date, B.date))} ngày${wa && wb ? ` · cân nặng ${wb-wa>0?"+":""}${fmtNum(r1(wb-wa))} kg` : ""}.</p>`, st.drawn); st.drawn = true;
    $$("[data-cmp]").forEach(b=> b.addEventListener("click", ()=>{ ui.cmpPose = b.dataset.cmp; openPhotoCompare(cid); }));
    $("#cmp-a").addEventListener("change", e=>{ st.a = e.target.value; draw(); });
    $("#cmp-b").addEventListener("change", e=>{ st.b = e.target.value; draw(); });
  };
  draw();
}

/* ---------------------------------------------------------------------
   8. CHÈN VÀO CÁC TAB CŨ: Thông tin · Buổi này tập gì · Thời khoá biểu · Tiến độ
   --------------------------------------------------------------------- */
function healthBannerHTML(c){
  const h = c.health || {}, pq = parqStatus(h, today(), c.parqClearance);
  const conds = (h.conditions||[]).filter(x=> x.status!=="recovered");
  if(!conds.length && pq.state!=="refer") return "";
  return `<div class="ptp-alert ptp-banner" data-goto-health>${ic("health_and_safety")}<div><b>Lưu ý sức khoẻ</b>
    ${pq.state==="refer" ? `<small>PAR-Q có câu "Có" — tập nhẹ, tăng dần.</small>` : ""}
    ${conds.slice(0,3).map(x=> `<small><b>${esc(x.name)}</b>${x.avoid ? ": "+esc(x.avoid) : ""}</small>`).join("")}</div>${ic("chevron_right")}</div>`;
}
function postInfo(c){
  const body = $("#client-content"); if(!body) return;
  const first = body.querySelector(".card"); if(!first) return;
  const h = c.health || {}, td = today(), pq = parqStatus(h, td, c.parqClearance);
  const { last, first: f0 } = latestValues(sortedMeasures(c));
  const rem = remaining(c, sessOf(c.id)), pk = c.pkg || {};
  const conds = (h.conditions||[]).filter(x=> x.status!=="recovered");
  const bd = birthday(h.dob, td);
  const box = document.createElement("div"); box.className = "card ptp-infosum";
  box.innerHTML = `
    <div class="card-title">${ic("health_and_safety")}Sức khoẻ &amp; gói tập</div>
    <div class="ptp-sumgrid">
      <button data-goto-tab="ptp_health"><small>PAR-Q</small><b class="${pq.state==="refer"?"ptp-warn":""}">${{ none:"Chưa làm", ok:"Đạt", refer:"Cần ý kiến BS", cleared:"BS cho phép" }[pq.state]}</b></button>
      <button data-goto-tab="ptp_health"><small>Chấn thương / bệnh lý</small><b class="${conds.length?"ptp-warn":""}">${conds.length ? `${conds.length} đang theo dõi` : "Không"}</b></button>
      <button data-goto-tab="ptp_health"><small>Cân nặng</small><b>${last.weight ? `${fmtNum(last.weight.v)} kg` : "—"}${last.weight && f0.weight && f0.weight.date!==last.weight.date ? ` <i>(${last.weight.v-f0.weight.v>0?"+":""}${fmtNum(r1(last.weight.v-f0.weight.v))})</i>` : ""}</b></button>
      <button data-goto-tab="ptp_pkg"><small>Gói tập</small><b class="${rem!==null && rem<=3 ? "ptp-warn" : ""}">${rem===null ? "Không giới hạn" : `Còn ${Math.max(0,rem)} buổi`}${isDate(pk.expiry) ? ` <i>· HSD ${ddmm(pk.expiry)}</i>` : ""}</b></button>
    </div>
    ${bd && bd.days <= 7 ? `<p class="small-note ptp-note">${ic("cake")} ${bd.days===0 ? "Hôm nay là sinh nhật!" : `Sinh nhật sau ${bd.days} ngày (${ddmm(bd.date)})`}</p>` : ""}`;
  first.after(box);
  $$("[data-goto-tab]", box).forEach(b=> b.addEventListener("click", ()=>{ cf.tab = b.dataset.gotoTab; cf.focusSid = null; renderClientForm(); $("#app-scroll").scrollTo(0,0); }));
}
function postToday(c){
  const body = $("#client-content"); if(!body) return;
  const html = healthBannerHTML(c); if(!html) return;
  body.insertAdjacentHTML("afterbegin", html);
  const b = $(".ptp-banner", body); if(b) b.addEventListener("click", ()=>{ cf.tab = "ptp_health"; renderClientForm(); $("#app-scroll").scrollTo(0,0); });
}
function postProgress(c){
  const body = $("#client-content"); if(!body) return;
  const ms = sortedMeasures(c), pts = ms.map(m=> ({ date:m.date, v:num(m.weight) })).filter(p=> p.v!=null);
  const g = (c.health && c.health.goal) || {};
  const box = document.createElement("div"); box.className = "card ptp-bodycard";
  box.innerHTML = `<div class="card-title">${ic("monitor_weight")}Cân nặng theo thời gian<button class="btn btn-soft btn-sm ptp-right" data-goto-health>${ic("straighten")}Số đo</button></div>
    ${pts.length ? trendSVG(pts, { target:num(g.targetWeight), label:"Cân nặng" }) : `<p class="small-note">Chưa có số đo. Nhập ở tab "Sức khoẻ" để theo dõi cân nặng, vòng eo, % mỡ và ảnh tiến độ.</p>`}`;
  const sg = body.querySelector(".stat-grid");
  if(sg) sg.after(box); else body.prepend(box);
  $("[data-goto-health]", box).addEventListener("click", ()=>{ cf.tab = "ptp_health"; renderClientForm(); $("#app-scroll").scrollTo(0,0); });
}

/* ---------------------------------------------------------------------
   9. TÍCH HỢP (ghi đè hàm toàn cục của coach.js)
   --------------------------------------------------------------------- */
const MY_TABS = { ptp_health: renderHealthTab, ptp_pkg: renderPkgTab };
function ensureTabs(){
  if(typeof CF_TABS==="undefined" || CF_TABS.some(t=> t.id==="ptp_health")) return;
  const i = CF_TABS.findIndex(t=> t.id==="info");
  CF_TABS.splice(i >= 0 ? i+1 : CF_TABS.length, 0, { id:"ptp_health", label:"Sức khoẻ" }, { id:"ptp_pkg", label:"Gói tập" });
}
function addIcons(){
  if(typeof FK_LINE==="undefined") return;
  const CAL = "r:3,4,18,18,2.5|M16 2v4|M8 2v4|M3 10h18";
  const add = {
    chevron_left:"M15 18l-6-6 6-6",
    payments:"r:2,6,20,12,2|c:12,12,2.5|M6 12h.01|M18 12h.01",
    cake:"M4 21h16|M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7|M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0|M12 12V9|M12 6.5c-.9-.9-.9-2.2 0-3.5.9 1.3.9 2.6 0 3.5z",
    health_and_safety:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M12 8v6|M9 11h6",
    healing:"M3.5 13.5l10-10a3.5 3.5 0 0 1 5 5l-10 10a3.5 3.5 0 0 1-5-5z|M10 10h.01|M14 10h.01|M10 14h.01|M14 14h.01",
    straighten:"r:2,8,20,8,1.5|M6 8v3|M10 8v4|M14 8v3|M18 8v4",
    calendar_month: CAL + "|M8 14h.01|M12 14h.01|M16 14h.01|M8 18h.01|M12 18h.01",
    today: CAL + "|r:7,13,4,4,1",
    sort:"M3 6h13|M3 12h9|M3 18h5|M18 8v12|M15 17l3 3 3-3",
    receipt_long:"M6 2h12v20l-3-2-3 2-3-2-3 2z|M9 7h6|M9 11h6|M9 15h4",
    checklist:"M11 6h10|M11 12h10|M11 18h10|M3 6l1.5 1.5L7 5|M3 12l1.5 1.5L7 11|M3 18l1.5 1.5L7 17",
    account_balance_wallet:"M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5|M16 14h.01",
    quiz:"r:4,3,16,18,2|M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4V14|M12 17h.01",
    autorenew:"M21 12a9 9 0 0 1-15.5 6.2|M3 12A9 9 0 0 1 18.5 5.8|M18.5 2v4h-4|M5.5 22v-4h4",
    inventory_2:"r:3,3,18,5,1|M5 8v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8|M10 12h4",
  };
  Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; });
}
function install(){
  ptpState();
  addIcons();
  ensureTabs();
  if(typeof renderCoachScreen==="function"){
    const _rcs = renderCoachScreen;
    renderCoachScreen = function(){
      const r = _rcs.apply(this, arguments);
      try{ enhanceCoach(); }catch(e){ console.error("[pt-pro] coach", e); }
      return r;
    };
  }
  if(typeof renderClientForm==="function"){
    const _rcf = renderClientForm;
    renderClientForm = function(){
      let mine = null;
      try{ ensureTabs(); mine = (typeof cf!=="undefined" && MY_TABS[cf.tab]) ? cf.tab : null; }catch(e){}
      if(mine){
        const c = typeof cfClient==="function" ? cfClient() : findClient(cf.cid);
        cf.tab = "info";
        try{ _rcf.apply(this, arguments); } finally { cf.tab = mine; }
        if(!c) return;
        try{
          $("#client-content").classList.add("ptp-tabbody");
          $$("#client-tabs [data-cft]").forEach(b=> b.classList.toggle("active", b.dataset.cft===mine));
          const act = $(`#client-tabs [data-cft="${mine}"]`); if(act && act.scrollIntoView) act.scrollIntoView({ inline:"center", block:"nearest" });
          MY_TABS[mine]($("#client-content"), c);
        }catch(e){ console.error("[pt-pro] tab", e); $("#client-content").innerHTML = `<p class="empty-hint">Không hiển thị được mục này.</p>`; }
        return;
      }
      try{ const cc = $("#client-content"); if(cc) cc.classList.remove("ptp-tabbody"); }catch(e){}
      const r = _rcf.apply(this, arguments);
      try{
        const c = typeof cfClient==="function" ? cfClient() : null;
        if(c){
          if(cf.tab==="info") postInfo(c);
          if(cf.tab==="today") postToday(c);
          if(cf.tab==="schedule") postSchedule(c);
          if(cf.tab==="progress") postProgress(c);
        }
      }catch(e){ console.error("[pt-pro] post", e); }
      return r;
    };
  }
  // Module nạp sau appBoot(): vẽ lại màn đang mở
  try{
    const a = document.querySelector(".screen.active");
    if(a && a.id==="screen-coach") renderCoachScreen(false);
    if(a && a.id==="screen-client") renderClientForm();
  }catch(e){}
}

const api = {
  install, openCalendar, openAssign, openRevenue, openRenewSheet, openPaySheet, openMeasureSheet, openParq, openPhotoAdd, openPhotoCompare,
  openAbsentSheet, openClearance, setFilter, loadMyCancel,
  logic: { dstr, dparse, dadd, ddiff, mondayOf, startOf, durOf, norm, money, moneyShort, remaining, absentStreak, doneCount, chargedCount, usedCount,
    absentChargeDefault, CANCEL_KINDS, clearanceValid, overdueCount, nextWithin,
    isActive, birthday, ageOf, parqStatus, paidIn, outstanding, latestValues, sortedMeasures, bmiInfo, whrInfo, clientAlerts,
    ptItems, findConflicts, layoutLanes, buildProgramSessions, suggestExpiry, trendSVG, ymAdd, PARQ, MEASURES },
  _ui: ui,
};
return api;
})();

try{ PTP.install(); }catch(e){ console.error("[pt-pro] không cài được:", e); }
