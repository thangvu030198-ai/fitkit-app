/* =========================================================================
   TapEasy — DANH BẠ PT CÔNG KHAI (cloud-pt-directory.js)
   Mở rộng `cloud` (cloud.js) bằng `cloud.ptdir` — lớp dữ liệu cho màn "Tìm PT" (findpt.js).

   Nguyên tắc "công khai minh bạch":
     · Giá do PT tự niêm yết, hiển thị đầy đủ (buổi lẻ, gói 12/24, online, buổi thử) + ngày cập nhật.
     · Điểm đánh giá = trung bình CỘNG ĐƠN GIẢN các đánh giá đang hiển thị; đánh giá bị ẩn được
       đếm và nêu lý do công khai. Xếp hạng "Phù hợp" không có suất trả tiền (công thức ở logic.matchScore).
     · Chỉ người "Đã tập cùng" (form PT↔học viên có ≥ 1 buổi hoàn thành, hoặc buổi thử PT xác nhận) được đánh giá.
     · PT trả lời công khai, KHÔNG xoá được đánh giá. Kiểm duyệt viên (teCan("reviews.moderate")) chỉ ẩn kèm lý do.
     · Huy hiệu "Đã xác minh" chỉ do người có teCan("pt.verify") gắn (đối chiếu chứng chỉ).

   Hai "động cơ" giống cloud.js / cloud-social.js:
     - demo     : localStorage "tapeasy_ptdir_demo_v1" (+ 20 hồ sơ PT minh hoạ, 79 đánh giá mẫu)
     - firebase : firebase.firestore() khi cloud.mode === "firebase"

   Firestore (rules đầy đủ: docs/INTEGRATION-findpt.md):
     ptListings/{uid}                       niêm yết của PT (id = uid PT, 1 niêm yết / PT)
       { uid, name, brandName, gender, years, specs[], bio, prov, ward, areaHint, places[], prices{}, cancel, cancelNote,
         langs[], avail{T2..CN}, certs[], cover, album[], showPhone, phone, status:"public"|"draft",
         createdAt, updatedAt, priceUpdatedAt,
         verified, verifiedAt, verifiedBy, verifyNote        ← chỉ teCan("pt.verify")
         hidden, hiddenReason, hiddenBy, hiddenAt             ← chỉ teCan("listings.moderate")
         ratingAvg, ratingCount, ratingDist, criteriaAvg, reviewHidden, respRate, respMins, respN ← Cloud Function }
     ptListings/{lid}/reviews/{reviewerUid}   1 đánh giá / người / PT
       { uid, name, stars, criteria{expertise,punctual,attitude,results}, text, photos[], basis{type,id,sessions},
         createdAt, updatedAt, editedAt, reply{text,at,by}|null, hidden, hiddenReason, modBy, modAt, reports, flagged }
     ptListings/{lid}/reviews/{rid}/reports/{uid}  { reason, at }
     ptListings/{lid}/requests/{qid}          yêu cầu của học viên: "trial" (buổi thử) | "connect" (kết nối) | "question" (hỏi)
       { uid, name, email?, kind, slot{date,time}?, place?, goal?, msgs[{from,role,text,ts}], status, card?, clientId?,
         createdAt, respondedAt, updatedAt }
     clients/{cid}/feedback/pt                PT nhận xét học viên — RIÊNG TƯ (chỉ PT + học viên của form)
       { by, stars{attendance,effort,comms}, text, at, reply{text,at}|null, shareable }
   Nạp SAU cloud.js + cloud-social.js (dùng bộ lọc từ ngữ), TRƯỚC findpt.js.
   ========================================================================= */
(function(G){
"use strict";
if(typeof cloud === "undefined" || !cloud) return;
if(cloud.ptdir && cloud.ptdir.__v) return;

const VERSION = 1;
const DEMO_KEY = "tapeasy_ptdir_demo_v1";
const SEED_VERSION = "s3";            // s3 (fix-pt): album thumb 360 px
const DAY = 86400000;
const CFG = Object.assign({ samples: "auto" }, (G.TAPEASY_FINDPT_CONFIG || {}));   // samples: "auto" | true | false
const MAX_REVIEW = 1500, MIN_REVIEW = 20, MAX_REPLY = 1000, MAX_PHOTOS = 3, MAX_PHOTO_CHARS = 170000;
const MAX_LISTING_CHARS = 900000;                  // < 1 MiB / doc Firestore
const now = ()=> Date.now();
const rid = p=> `${p||"x"}${now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const clone = o=> JSON.parse(JSON.stringify(o == null ? null : o));
const str = (s, n)=> String(s == null ? "" : s).trim().slice(0, n || 500);
const arr = a=> Array.isArray(a) ? a : [];
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const num = (v, d)=> Number.isFinite(Number(v)) ? Number(v) : (d || 0);
const int15 = v=> Math.max(1, Math.min(5, Math.round(Number(v) || 0)));
function err(msg, code){ const e = new Error(msg); e.code = code || "ptdir/error"; return e; }
const ERR = {
  "permission-denied": "Máy chủ chưa cho phép thao tác này (kiểm tra quyền hoặc firestore.rules — xem INTEGRATION-findpt.md).",
  "unavailable": "Không kết nối được máy chủ, kiểm tra mạng rồi thử lại.",
  "not-found": "Dữ liệu không còn tồn tại.",
  "failed-precondition": "Máy chủ cần tạo chỉ mục (index) cho truy vấn này — xem INTEGRATION-findpt.md.",
  "resource-exhausted": "Dữ liệu quá lớn, hãy bớt ảnh hoặc chọn ảnh nhẹ hơn.",
};
function nice(e){
  if(e && e.code && String(e.code).startsWith("ptdir/")) return e;
  if(e && (e.name === "QuotaExceededError" || /quota/i.test(e.message || ""))) return err("Bộ nhớ của bản thử nghiệm đã đầy — hãy bớt ảnh rồi lưu lại.", "ptdir/quota");
  const code = e && (e.code || "");
  return err(ERR[code] || (e && e.message) || "Đã có lỗi xảy ra.", code || "ptdir/error");
}
const wrap = fn=> async (...a)=>{ try{ return await fn(...a); }catch(e){ throw nice(e); } };
const me = ()=> cloud.user || null;
function needUser(){ const u = me(); if(!u) throw err("Bạn cần đăng nhập để dùng tính năng này.", "ptdir/auth"); return u; }
const can = p=>{ try{ return typeof G.teCan === "function" ? !!G.teCan(p) : (typeof teCan === "function" && !!teCan(p)); }catch(e){ return false; } };
const isFb = ()=> cloud.mode === "firebase" && typeof firebase !== "undefined" && !!firebase.firestore;
const fdb = ()=> firebase.firestore();
const qd = q=> q.docs.map(d=> Object.assign({ id:d.id }, d.data()));
const dd = d=> d && d.exists ? Object.assign({ id:d.id }, d.data()) : null;
/* Cloud Function (asia-southeast1) — claimReviewRights … */
async function callFn(name, data){ const r = await firebase.app().functions("asia-southeast1").httpsCallable(name)(data || {}); return r && r.data; }
/* Chặn người dùng (App Store 1.2): a đã chặn b? — API thật cloud.js: isBlockedBy(a, b) chỉ trả lời khi a là CHÍNH MÌNH
   (client chỉ đọc được danh sách của mình). a là người khác: Firebase → rules blockedBy() tự từ chối (permission-denied →
   BLOCKED_MSG); demo → đọc kho demo của cloud.js (blocks[a][b]) để mô phỏng đúng rules. */
async function blockedBy(a, b){
  a = String(a || ""); b = String(b || ""); if(!a || !b) return false;
  try{ if(cloud.user && cloud.user.uid === a && typeof cloud.isBlockedBy === "function") return !!(await cloud.isBlockedBy(a, b)); }catch(e){}
  if(!isFb()){ try{ const db = JSON.parse(localStorage.getItem("fitkit_cloud_demo_v1") || "{}"); return !!(db.blocks && db.blocks[a] && db.blocks[a][b]); }catch(e){} }
  return false;
}
/* Lọc dữ liệu của người MÌNH đã chặn (yêu cầu, đánh giá) — nạp danh sách chặn 1 lần rồi dùng cloud.isBlockedSync */
async function warmBlocks(){ try{ if(me() && typeof cloud.isBlocked === "function") await cloud.isBlocked("__warm__"); }catch(e){} }
const iBlocked = uid=>{ try{ return !!uid && typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid)); }catch(e){ return false; } };
const BLOCKED_MSG = "Bạn không thể gửi tin cho PT này (người nhận đã tắt liên lạc với bạn).";
function hashStr(s){ let h = 5381; s = String(s); for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/* =====================================================================
   1. ĐỊA GIỚI HÀNH CHÍNH MỚI (34 tỉnh/thành, hiệu lực 01/7/2025; chính quyền 2 cấp: tỉnh → xã/phường/đặc khu)
   Phường/xã: danh sách TIÊU BIỂU (không đầy đủ 3.321 đơn vị) — PT gõ tên phường/xã khác được.
   ===================================================================== */
const REGIONS = { bac:"Miền Bắc", trung:"Miền Trung & Tây Nguyên", nam:"Miền Nam" };
const PROVINCES = [
  // id, tên, loại, miền, sáp nhập từ, phường/xã tiêu biểu
  ["hn", "Hà Nội", "tp", "bac", "", ["Phường Hoàn Kiếm","Phường Cửa Nam","Phường Ba Đình","Phường Ngọc Hà","Phường Giảng Võ","Phường Tây Hồ","Phường Phú Thượng","Phường Cầu Giấy","Phường Nghĩa Đô","Phường Yên Hòa","Phường Đống Đa","Phường Láng","Phường Kim Liên","Phường Văn Miếu - Quốc Tử Giám","Phường Ô Chợ Dừa","Phường Hai Bà Trưng","Phường Bạch Mai","Phường Vĩnh Tuy","Phường Thanh Xuân","Phường Khương Đình","Phường Phương Liệt","Phường Hoàng Mai","Phường Định Công","Phường Tương Mai","Phường Lĩnh Nam","Phường Long Biên","Phường Bồ Đề","Phường Việt Hưng","Phường Phúc Lợi","Phường Từ Liêm","Phường Xuân Phương","Phường Tây Mỗ","Phường Đại Mỗ","Phường Xuân Đỉnh","Phường Đông Ngạc","Phường Phú Diễn","Phường Hà Đông","Phường Dương Nội","Phường Kiến Hưng"]],
  ["hp", "Hải Phòng", "tp", "bac", "Hải Phòng + Hải Dương", ["Phường Hồng Bàng","Phường Ngô Quyền","Phường Lê Chân","Phường Gia Viên","Phường An Biên","Phường Hải An","Phường Kiến An","Phường Đồ Sơn","Phường Hải Dương","Phường Thành Đông"]],
  ["qn", "Quảng Ninh", "tinh", "bac", "", ["Phường Hạ Long","Phường Bãi Cháy","Phường Hồng Gai","Phường Cẩm Phả","Phường Uông Bí"]],
  ["cb", "Cao Bằng", "tinh", "bac", "", []],
  ["ls", "Lạng Sơn", "tinh", "bac", "", []],
  ["lc2", "Lai Châu", "tinh", "bac", "", []],
  ["db", "Điện Biên", "tinh", "bac", "", []],
  ["sl", "Sơn La", "tinh", "bac", "", []],
  ["tq", "Tuyên Quang", "tinh", "bac", "Tuyên Quang + Hà Giang", []],
  ["lc", "Lào Cai", "tinh", "bac", "Lào Cai + Yên Bái", []],
  ["tn", "Thái Nguyên", "tinh", "bac", "Thái Nguyên + Bắc Kạn", []],
  ["pt", "Phú Thọ", "tinh", "bac", "Phú Thọ + Vĩnh Phúc + Hòa Bình", []],
  ["bn", "Bắc Ninh", "tinh", "bac", "Bắc Ninh + Bắc Giang", ["Phường Kinh Bắc","Phường Võ Cường","Phường Từ Sơn","Phường Bắc Giang"]],
  ["hy", "Hưng Yên", "tinh", "bac", "Hưng Yên + Thái Bình", []],
  ["nb", "Ninh Bình", "tinh", "bac", "Ninh Bình + Hà Nam + Nam Định", ["Phường Hoa Lư","Phường Nam Định","Phường Phủ Lý"]],
  ["th", "Thanh Hóa", "tinh", "trung", "", ["Phường Hạc Thành","Phường Đông Quang","Phường Hàm Rồng","Phường Sầm Sơn"]],
  ["na", "Nghệ An", "tinh", "trung", "", ["Phường Thành Vinh","Phường Trường Vinh","Phường Vinh Hưng","Phường Vinh Phú","Phường Cửa Lò"]],
  ["ht", "Hà Tĩnh", "tinh", "trung", "", []],
  ["qt", "Quảng Trị", "tinh", "trung", "Quảng Trị + Quảng Bình", []],
  ["hue", "Huế", "tp", "trung", "", ["Phường Thuận Hóa","Phường Phú Xuân","Phường Vỹ Dạ","Phường An Cựu","Phường Kim Long","Phường Thủy Xuân"]],
  ["dn", "Đà Nẵng", "tp", "trung", "Đà Nẵng + Quảng Nam", ["Phường Hải Châu","Phường Hòa Cường","Phường Thanh Khê","Phường An Khê","Phường An Hải","Phường Sơn Trà","Phường Ngũ Hành Sơn","Phường Liên Chiểu","Phường Cẩm Lệ","Phường Hội An","Phường Tam Kỳ"]],
  ["qng", "Quảng Ngãi", "tinh", "trung", "Quảng Ngãi + Kon Tum", []],
  ["gl", "Gia Lai", "tinh", "trung", "Gia Lai + Bình Định", ["Phường Quy Nhơn","Phường Pleiku"]],
  ["dl", "Đắk Lắk", "tinh", "trung", "Đắk Lắk + Phú Yên", ["Phường Buôn Ma Thuột","Phường Tuy Hòa"]],
  ["kh", "Khánh Hòa", "tinh", "trung", "Khánh Hòa + Ninh Thuận", ["Phường Nha Trang","Phường Bắc Nha Trang","Phường Tây Nha Trang","Phường Nam Nha Trang","Phường Cam Ranh","Phường Phan Rang"]],
  ["ld", "Lâm Đồng", "tinh", "trung", "Lâm Đồng + Đắk Nông + Bình Thuận", ["Phường Xuân Hương - Đà Lạt","Phường Cam Ly - Đà Lạt","Phường Lâm Viên - Đà Lạt","Phường Lang Biang - Đà Lạt","Phường Phan Thiết","Phường Mũi Né"]],
  ["hcm", "TP. Hồ Chí Minh", "tp", "nam", "TP.HCM + Bình Dương + Bà Rịa - Vũng Tàu", ["Phường Sài Gòn","Phường Tân Định","Phường Bến Thành","Phường Cầu Ông Lãnh","Phường Bàn Cờ","Phường Xuân Hòa","Phường Nhiêu Lộc","Phường Xóm Chiếu","Phường Khánh Hội","Phường Chợ Quán","Phường Chợ Lớn","Phường Tân Thuận","Phường Phú Thuận","Phường Tân Mỹ","Phường Tân Hưng","Phường Gia Định","Phường Bình Thạnh","Phường Thạnh Mỹ Tây","Phường Phú Nhuận","Phường Đức Nhuận","Phường Cầu Kiệu","Phường Tân Sơn Nhất","Phường Tân Sơn Hòa","Phường Bảy Hiền","Phường Tân Bình","Phường Hạnh Thông","Phường Gò Vấp","Phường An Khánh","Phường Thủ Đức","Phường Bình Trưng","Phường Phước Long","Phường Hiệp Bình","Phường Linh Xuân","Phường Thủ Dầu Một","Phường Dĩ An","Phường Thuận An","Phường Vũng Tàu","Phường Tam Thắng"]],
  ["dna", "Đồng Nai", "tinh", "nam", "Đồng Nai + Bình Phước", ["Phường Trấn Biên","Phường Biên Hòa"]],
  ["tni", "Tây Ninh", "tinh", "nam", "Tây Ninh + Long An", []],
  ["ct", "Cần Thơ", "tp", "nam", "Cần Thơ + Sóc Trăng + Hậu Giang", ["Phường Ninh Kiều","Phường Cái Khế","Phường Tân An","Phường An Bình","Phường Bình Thủy","Phường Cái Răng","Phường Sóc Trăng","Phường Vị Thanh"]],
  ["vl", "Vĩnh Long", "tinh", "nam", "Vĩnh Long + Bến Tre + Trà Vinh", []],
  ["dt", "Đồng Tháp", "tinh", "nam", "Đồng Tháp + Tiền Giang", []],
  ["ag", "An Giang", "tinh", "nam", "An Giang + Kiên Giang", ["Đặc khu Phú Quốc","Phường Rạch Giá","Phường Long Xuyên","Phường Châu Đốc"]],
  ["cm", "Cà Mau", "tinh", "nam", "Cà Mau + Bạc Liêu", []],
].map(([id, name, type, region, merged, wards])=> ({ id, name, type, region, merged, wards }));
const PROV = {}; PROVINCES.forEach(p=> PROV[p.id] = p);

/* =====================================================================
   2. DANH MỤC
   ===================================================================== */
const SPECS = ["Giảm mỡ","Tăng cơ","Sức mạnh","Người mới","Thể lực","Yoga","Pilates","Linh hoạt","Phục hồi","Phục hồi chức năng",
  "Tư thế & đau lưng","Người cao tuổi","Mẹ bầu & sau sinh","Boxing","Muay Thai","Calisthenics","Chạy bộ","Bơi lội","Aerobic & nhảy",
  "Kettlebell & chức năng","Thể hình thi đấu","Dinh dưỡng thể thao","Huấn luyện VĐV"];
const PLACE_TYPES = { gym:{ label:"Phòng tập", icon:"fitness_center" }, home:{ label:"Tại nhà", icon:"home" }, online:{ label:"Online", icon:"laptop" }, outdoor:{ label:"Ngoài trời", icon:"park" } };
const CANCEL = {
  flex:     { label:"Linh hoạt", text:"Huỷ hoặc đổi lịch miễn phí trước 6 giờ. Huỷ muộn hơn tính 50% giá buổi." },
  moderate: { label:"Tiêu chuẩn", text:"Huỷ hoặc đổi lịch miễn phí trước 24 giờ. Huỷ muộn hơn tính 1 buổi." },
  strict:   { label:"Chặt", text:"Huỷ miễn phí trước 48 giờ. Gói đã mua không hoàn tiền, được bảo lưu tối đa 30 ngày (ốm có giấy khám được bảo lưu)." },
};
const CRITERIA = [["expertise","Chuyên môn"],["punctual","Đúng giờ"],["attitude","Thái độ"],["results","Hiệu quả"]];
const SFB = [["attendance","Chuyên cần"],["effort","Nỗ lực"],["comms","Trao đổi"]];        // PT → học viên (riêng tư)
const LANGS = { vi:"Tiếng Việt", en:"English", zh:"中文", ko:"한국어", ja:"日本語" };
const DAYS = ["T2","T3","T4","T5","T6","T7","CN"];
const SLOTS = [["m","Sáng","05:30–09:00"],["n","Trưa","11:00–14:00"],["a","Chiều","14:00–17:00"],["e","Tối","17:00–21:30"]];
const KINDS = { trial:"Đặt buổi thử", connect:"Lời mời kết nối", question:"Câu hỏi" };
const RSTATUS = { pending:"Chờ PT trả lời", accepted:"PT đã nhận", declined:"PT từ chối", done:"Đã tập", cancelled:"Đã huỷ" };
const REPORT_REASONS = ["Không phải trải nghiệm thật / chưa từng tập", "Thông tin sai sự thật", "Ngôn từ xúc phạm, quấy rối", "Lộ thông tin cá nhân", "Spam / quảng cáo", "Khác"];

/* =====================================================================
   3. LOGIC THUẦN (dùng cho UI, kiểm thử Node, Cloud Function)
   ===================================================================== */
const norm = s=> String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
const provName = id=> (PROV[id] && PROV[id].name) || "";
function areaText(l, short){
  l = obj(l); const p = provName(l.prov);
  if(short) return [l.ward ? String(l.ward).replace(/^(Phường|Xã|Đặc khu)\s+/, "") : "", p].filter(Boolean).join(" · ");
  return [l.ward, p].filter(Boolean).join(", ");
}
function perSession(l){
  const p = obj(obj(l).prices), out = {};
  if(num(p.single) > 0) out.single = num(p.single);
  if(num(p.pack12) > 0) out.pack12 = Math.round(num(p.pack12) / 12);
  if(num(p.pack24) > 0) out.pack24 = Math.round(num(p.pack24) / 24);
  if(num(p.online) > 0) out.online = num(p.online);
  return out;
}
/* QP-09 (fix-pt): giá theo HÌNH THỨC — tại phòng tập / tại nhà / ngoài trời chỉ xét giá trực tiếp (buổi lẻ, gói),
   online chỉ xét giá online; noPack: bỏ giá gói chia đều */
const INPERSON = { gym:1, home:1, outdoor:1 };
function pricesFor(l, place, noPack){
  const ps = perSession(l);
  const types = arr(obj(l).places).map(p=> obj(p).type);
  const hasIn = types.some(t=> INPERSON[t]), hasOn = types.includes("online");
  const direct = [];
  if(ps.single) direct.push(["single", ps.single]);
  if(!noPack){ if(ps.pack12) direct.push(["pack12", ps.pack12]); if(ps.pack24) direct.push(["pack24", ps.pack24]); }
  const online = ps.online ? [["online", ps.online]] : (!hasIn && hasOn ? direct.map(x=> ["online", x[1]]) : []);   // PT chỉ dạy online: giá buổi lẻ = giá online
  if(INPERSON[place]) return hasIn ? direct : [];
  if(place === "online") return hasOn ? online : [];
  return direct.concat(ps.online ? [["online", ps.online]] : []);
}
function priceFrom(l){ const v = Object.values(perSession(l)); return v.length ? Math.min(...v) : 0; }
function priceTo(l){ const v = Object.values(perSession(l)); return v.length ? Math.max(...v) : 0; }
/** "từ X" theo hình thức đang lọc + nhãn hình thức của mức giá thấp nhất ("tại phòng" / "online") */
function priceInfo(l, place, noPack){
  const ps = pricesFor(l, place, noPack); if(!ps.length) return { v: priceFrom(l), mode:"" };
  const best = ps.reduce((m, x)=> x[1] < m[1] ? x : m, ps[0]);
  return { v: best[1], key: best[0], mode: best[0] === "online" ? "online" : "inperson" };
}
function packSaving(l, k){ const p = obj(obj(l).prices); const s = num(p.single), n = k === "pack24" ? 24 : 12, t = num(p[k]); return s > 0 && t > 0 ? Math.max(0, Math.round((1 - t / (s * n)) * 100)) : 0; }
/* QP-14 (fix-pt): mức nền = điểm sàn 4,0 với 5 phiếu ảo → PT 0 đánh giá (25 điểm) không vượt PT 20 đánh giá 4,2★ (29 điểm) */
const PRIOR_C = 4.0, PRIOR_M = 5;
function bayes(avg, n){ n = num(n); return n ? (PRIOR_C * PRIOR_M + num(avg) * n) / (PRIOR_M + n) : PRIOR_C; }
function aggregate(reviews){
  const vis = arr(reviews).filter(r=> r && !r.hidden);
  const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 }, crit = {}, cc = {};
  let sum = 0;
  vis.forEach(r=>{ const s = int15(r.stars); dist[s]++; sum += s;
    CRITERIA.forEach(([k])=>{ const v = Number(obj(r.criteria)[k]); if(v >= 1 && v <= 5){ crit[k] = (crit[k]||0) + v; cc[k] = (cc[k]||0) + 1; } }); });
  const criteria = {}; CRITERIA.forEach(([k])=> criteria[k] = cc[k] ? Math.round(crit[k] / cc[k] * 10) / 10 : 0);
  return { avg: vis.length ? Math.round(sum / vis.length * 10) / 10 : 0, count: vis.length, dist, criteria,
    hiddenCount: arr(reviews).length - vis.length, withPhotos: vis.filter(r=> arr(r.photos).length).length,
    replied: vis.filter(r=> r.reply && r.reply.text).length };
}
/** Tỉ lệ phản hồi = số yêu cầu được PT trả lời trong 24 giờ / tổng yêu cầu 90 ngày gần nhất (≥ 3 yêu cầu mới công bố) */
function respStats(requests, at){
  at = at || now();
  const list = arr(requests).filter(q=> q && q.createdAt && q.createdAt > at - 90*DAY && q.status !== "cancelled");
  const answered = list.filter(q=> q.respondedAt && q.respondedAt - q.createdAt <= DAY);
  const mins = answered.map(q=> (q.respondedAt - q.createdAt) / 60000);
  return { n: list.length, rate: list.length >= 3 ? Math.round(answered.length / list.length * 100) : null,
    mins: mins.length ? Math.round(mins.reduce((a,b)=> a+b, 0) / mins.length) : null };
}
function fmtMins(m){ if(m == null) return "—"; if(m < 60) return `${Math.max(1, Math.round(m))} phút`; if(m < 24*60) return `${Math.round(m/60)} giờ`; return `${Math.round(m/1440)} ngày`; }
function haystack(l){
  l = obj(l);
  return norm([l.name, l.brandName, arr(l.specs).join(" "), arr(l.places).map(p=> [obj(p).name, obj(p).note, PLACE_TYPES[obj(p).type] ? PLACE_TYPES[obj(p).type].label : ""].join(" ")).join(" "),
    l.ward, l.areaHint, provName(l.prov), arr(l.langs).map(k=> LANGS[k] || k).join(" "), String(l.bio||"").slice(0, 300),
    l.gender === "female" ? "nu" : "nam", arr(l.certs).map(c=> obj(c).name + " " + obj(c).issuer).join(" ")].join(" "));
}
const DEFAULT_FILTER = { q:"", prov:"", ward:"", place:"", gym:"", priceMin:0, priceMax:0, gender:"", specs:[], minRating:0, verified:false, langs:[] };
function filterListings(list, f){
  f = Object.assign({}, DEFAULT_FILTER, obj(f));
  const toks = norm(f.q).split(" ").filter(Boolean), gymT = norm(f.gym);
  return arr(list).filter(l=>{
    if(!l) return false;
    if(l.hidden && !f.includeHidden) return false;
    if(l.status && l.status !== "public" && !f.includeDraft) return false;
    if(f.prov && l.prov !== f.prov) return false;
    if(f.ward && norm(l.ward) !== norm(f.ward)) return false;
    if(f.place && !arr(l.places).some(p=> obj(p).type === f.place)) return false;
    if(gymT && !arr(l.places).some(p=> norm(obj(p).name).includes(gymT) || norm(obj(p).note).includes(gymT))) return false;
    if(f.gender && l.gender !== f.gender) return false;
    if(arr(f.specs).length && !arr(f.specs).some(s=> arr(l.specs).includes(s))) return false;
    if(arr(f.langs).length && !arr(f.langs).every(s=> arr(l.langs).includes(s))) return false;
    if(f.verified && !l.verified) return false;
    if(f.minRating && !(num(l.ratingCount) > 0 && num(l.ratingAvg) >= f.minRating)) return false;
    if(f.priceMin || f.priceMax){
      const ps = pricesFor(l, f.place, !!f.noPack).map(x=> x[1]); if(!ps.length) return false;
      const lo = f.priceMin || 0, hi = f.priceMax || Infinity;
      if(!ps.some(v=> v >= lo && v <= hi)) return false;
    }
    if(toks.length){ const h = l._hay || (l._hay = haystack(l)); if(!toks.every(t=> h.includes(t))) return false; }
    return true;
  });
}
function countFilters(f){
  f = Object.assign({}, DEFAULT_FILTER, obj(f)); let n = 0;
  ["prov","ward","place","gym","gender"].forEach(k=>{ if(f[k]) n++; });
  if(f.priceMin || f.priceMax) n++; if(arr(f.specs).length) n++; if(arr(f.langs).length) n++; if(f.minRating) n++; if(f.verified) n++;
  return n;
}
const GOAL_SPECS = { lose:["Giảm mỡ","Thể lực","Aerobic & nhảy","Chạy bộ"], gain:["Tăng cơ","Sức mạnh","Thể hình thi đấu"], maintain:["Thể lực","Linh hoạt","Yoga","Sức mạnh"] };
/** Điểm "Phù hợp" (0–100+): KHÔNG có suất trả tiền. Hiển thị công khai trong sheet "Cách xếp hạng". */
function matchScore(l, ctx){
  l = obj(l); ctx = obj(ctx);
  const parts = [];
  const r = bayes(l.ratingAvg, l.ratingCount); parts.push([`Đánh giá (Bayes, mức nền ${PRIOR_C.toFixed(1).replace(".", ",")} · ${PRIOR_M} phiếu)`, Math.round((r - 3) * 25)]);   // 3★ → 0, 5★ → 50
  if(l.verified) parts.push(["Đã xác minh chứng chỉ", 8]);
  if(num(l.respRate) >= 90) parts.push(["Trả lời ≥ 90% yêu cầu trong 24 giờ", 6]); else if(num(l.respRate) >= 70) parts.push(["Trả lời ≥ 70% yêu cầu trong 24 giờ", 3]);
  const want = GOAL_SPECS[ctx.goal] || [];
  if(want.some(s=> arr(l.specs).includes(s))) parts.push(["Chuyên môn hợp mục tiêu của bạn", 10]);
  if(ctx.prov && l.prov === ctx.prov) parts.push(["Cùng tỉnh/thành bạn chọn", 12]);
  if(arr(l.album).length >= 5) parts.push(["Album đủ ảnh (≥ 5)", 2]);
  if(num(l.ratingCount) === 0) parts.push(["PT mới — chưa có đánh giá", 0]);
  return { score: parts.reduce((a, p)=> a + p[1], 0), parts };
}
function sortListings(list, mode, ctx){
  const a = arr(list).slice();
  const pf = l=> priceFrom(l) || Infinity;
  if(mode === "price_asc") return a.sort((x,y)=> pf(x) - pf(y));
  if(mode === "price_desc") return a.sort((x,y)=> (priceFrom(y)||0) - (priceFrom(x)||0));
  if(mode === "rating") return a.sort((x,y)=> bayes(y.ratingAvg, y.ratingCount) - bayes(x.ratingAvg, x.ratingCount) || num(y.ratingCount) - num(x.ratingCount));
  if(mode === "reviews") return a.sort((x,y)=> num(y.ratingCount) - num(x.ratingCount) || num(y.ratingAvg) - num(x.ratingAvg));
  if(mode === "response") return a.sort((x,y)=> (y.respRate == null ? -1 : y.respRate) - (x.respRate == null ? -1 : x.respRate) || (x.respMins || 9e9) - (y.respMins || 9e9));
  if(mode === "new") return a.sort((x,y)=> num(y.joinedAt || y.createdAt) - num(x.joinedAt || x.createdAt));
  return a.sort((x,y)=> matchScore(y, ctx).score - matchScore(x, ctx).score || bayes(y.ratingAvg, y.ratingCount) - bayes(x.ratingAvg, x.ratingCount));
}
function histogram(list, step, max){
  step = step || 100000; max = max || 1500000;
  const bins = Array.from({ length: Math.ceil(max / step) }, ()=> 0);
  arr(list).forEach(l=>{ const p = priceFrom(l); if(p > 0) bins[Math.min(bins.length - 1, Math.floor(p / step))]++; });
  return bins;
}
function provinceStats(list){
  const m = {};
  arr(list).forEach(l=>{ const p = priceFrom(l); if(!l.prov || !p) return; const x = m[l.prov] = m[l.prov] || { prov:l.prov, n:0, sum:0, min:Infinity, max:0 }; x.n++; x.sum += p; x.min = Math.min(x.min, p); x.max = Math.max(x.max, p); });
  return Object.values(m).map(x=> Object.assign(x, { avg: Math.round(x.sum / x.n / 1000) * 1000 })).sort((a,b)=> b.n - a.n);
}
function maskName(n){
  n = str(n, 60); if(!n) return "Thành viên TapEasy";
  if(/\.$/.test(n) || /\b[A-Z]\.$/.test(n)) return n;
  const w = n.split(/\s+/); if(w.length < 2) return n;
  if(/^[A-Za-z]+$/.test(w[0]) && /^[A-Za-z]+$/.test(w[w.length-1]) && !/[^\x00-\x7F]/.test(n)) return `${w[0]} ${w[w.length-1][0]}.`;   // tên Latin: "Sarah Kim" → "Sarah K."
  return `${w[w.length-1]} ${w[0][0].toUpperCase()}.`;                                                      // tên Việt: "Hoàng Long" → "Long H."
}
const initials = n=> String(n||"?").trim().split(/\s+/).map(w=> w[0]||"").slice(-2).join("").toUpperCase() || "?";
const isImgUrl = s=> /^https:\/\//i.test(String(s||"")) || /^data:image\/(jpeg|png|webp);base64,/.test(String(s||""));
function profanity(t){ try{ const S = cloud.social; return S && S.moderation ? S.moderation.findProfanity(t) : []; }catch(e){ return []; } }
function validateListing(l){
  l = obj(l);
  const name = str(l.name, 80);
  if(name.length < 2) return "Nhập tên hiển thị (ít nhất 2 ký tự).";
  if(!["male","female"].includes(l.gender)) return "Chọn giới tính để học viên lọc đúng.";
  if(!arr(l.specs).length) return "Chọn ít nhất 1 chuyên môn.";
  if(arr(l.specs).length > 6) return "Tối đa 6 chuyên môn — chọn những gì bạn mạnh nhất.";
  if(!PROV[l.prov]) return "Chọn tỉnh/thành nơi bạn dạy.";
  if(!arr(l.places).length) return "Chọn ít nhất 1 địa điểm tập (phòng tập, tại nhà, online, ngoài trời).";
  if(arr(l.places).some(p=> obj(p).type === "gym" && str(obj(p).name).length < 2)) return "Nhập tên phòng tập.";
  const p = obj(l.prices);
  if(!(num(p.single) >= 50000 && num(p.single) <= 5000000)) return "Giá buổi lẻ cần từ 50.000đ đến 5.000.000đ.";
  for(const k of ["pack12","pack24","online"]){ const v = num(p[k]); if(v && (v < 50000 || v > 120000000)) return "Giá gói / online chưa hợp lệ."; }
  if(p.trial != null && p.trial !== "" && (num(p.trial) < 0 || num(p.trial) > 5000000)) return "Giá buổi thử chưa hợp lệ.";
  if(!CANCEL[l.cancel]) return "Chọn chính sách huỷ buổi.";
  if(!isImgUrl(l.cover)) return "Thêm ảnh bìa.";
  const al = arr(l.album).filter(a=> isImgUrl(obj(a).src));
  if(al.length < 3) return "Album cần ít nhất 3 ảnh (buổi tập, nơi tập, chứng chỉ…).";
  if(al.length > 9) return "Album tối đa 9 ảnh.";
  if(str(l.bio, 2000).length > 800) return "Giới thiệu tối đa 800 ký tự.";
  const bad = profanity([name, l.brandName, l.bio, arr(l.places).map(x=> obj(x).name).join(" ")].join(" "));
  if(bad.length) return `Nội dung có từ ngữ không phù hợp ("${bad.slice(0,3).join('", "')}").`;
  if(JSON.stringify(l).length > MAX_LISTING_CHARS) return "Ảnh quá nặng — hãy bớt ảnh album/chứng chỉ rồi lưu lại.";
  return null;
}
function validateReview(r){
  r = obj(r);
  const s = Number(r.stars); if(!(s >= 1 && s <= 5 && Math.round(s) === s)) return "Chọn số sao tổng thể (1–5).";
  for(const [k, label] of CRITERIA){ const v = Number(obj(r.criteria)[k]); if(!(v >= 1 && v <= 5)) return `Chấm điểm tiêu chí "${label}".`; }
  const t = str(r.text, 4000);
  if(t.length < MIN_REVIEW) return `Viết ít nhất ${MIN_REVIEW} ký tự để đánh giá có ích cho người sau.`;
  if(t.length > MAX_REVIEW) return `Đánh giá tối đa ${MAX_REVIEW} ký tự.`;
  if(arr(r.photos).length > MAX_PHOTOS) return `Tối đa ${MAX_PHOTOS} ảnh.`;
  if(arr(r.photos).some(p=> !isImgUrl(p) || String(p).length > MAX_PHOTO_CHARS)) return "Ảnh không hợp lệ hoặc quá nặng.";
  const bad = profanity(t); if(bad.length) return `Đánh giá có từ ngữ không phù hợp ("${bad.slice(0,3).join('", "')}"). Hãy góp ý thẳng thắn nhưng lịch sự nhé.`;
  if(/(\d[\s.-]?){9,}/.test(t) || /@[a-z0-9-]+\.[a-z]/i.test(t)) return "Không ghi số điện thoại / email trong đánh giá (bảo vệ thông tin cá nhân).";
  return null;
}
/* QP-12 / QS-07 (fix-pt): chỉ tính buổi PT XÁC NHẬN — PT bấm "Đã tập", PT ghi thay, hoặc PT xác nhận buổi học viên tự báo */
const isDateS = s=> /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const pad2_ = n=> String(n).padStart(2, "0");
const todayISO = ()=>{ const d = new Date(); return `${d.getFullYear()}-${pad2_(d.getMonth()+1)}-${pad2_(d.getDate())}`; };
const dayDiff = (a, b)=>{ const p = s=>{ const [y,m,d] = String(s).split("-").map(Number); return new Date(y, (m||1)-1, d||1).getTime(); }; return Math.round((p(b) - p(a)) / DAY); };
function confirmedDone(s){ s = obj(s); return s.status === "done" && (s.completedBy !== "student" || !!s.ptConfirmedAt || !!s.proxyLog); }
function trainedStats(sessions){
  const done = arr(sessions).filter(s=> s && s.status === "done");
  const conf = done.filter(confirmedDone);
  const dates = conf.map(s=> s.date).filter(isDateS).sort();
  return { done: done.length, confirmed: conf.length, first: dates[0] || "", last: dates[dates.length-1] || "" };
}
const RIGHTS_DAYS = 365;            // quyền đánh giá giữ 12 tháng sau buổi cuối (kể cả khi đã rời PT / PT xoá form)
/** Đủ "đã tập cùng": ≥ 1 buổi PT xác nhận VÀ (≥ 2 buổi HOẶC đã tập cùng ≥ 7 ngày), buổi cuối trong 12 tháng */
function trainedOk(x, today){
  x = obj(x); const n = x.confirmed == null ? num(x.done) : num(x.confirmed);
  if(n < 1) return false;
  if(isDateS(x.last) && today && dayDiff(x.last, today) > RIGHTS_DAYS) return false;
  if(n >= 2 || !isDateS(x.first)) return true;
  return !today || dayDiff(x.first, today) >= 7;
}
/** Đánh giá có đủ điều kiện "Đã tập cùng" không — ctx do API tự dựng:
    { uid, ptUid, today, coaches[{id, ptId, done, confirmed, first, last}], rights{…}|null (quyền bền vững), trials[{id, status}], existing } */
function eligibility(ctx){
  ctx = obj(ctx);
  if(!ctx.uid) return { ok:false, code:"login", reason:"Đăng nhập để viết đánh giá." };
  if(ctx.uid === ctx.ptUid) return { ok:false, code:"self", reason:"Bạn không thể tự đánh giá hồ sơ của mình." };
  const today = ctx.today || todayISO();
  const ex = ctx.existing;
  // QP-02: đánh giá đã viết luôn sửa được (rời PT / PT xoá form không làm mất quyền sửa)
  if(ex && !ex.hidden && ex.basis) return { ok:true, basis: clone(ex.basis), label: basisLabel(ex.basis), edit:true };
  const cnt = x=> num(x.done) || num(x.confirmed);
  const c = arr(ctx.coaches).filter(x=> x && x.ptId === ctx.ptUid).sort((a,b)=> num(b.confirmed == null ? b.done : b.confirmed) - num(a.confirmed == null ? a.done : a.confirmed))[0];
  if(c && !ctx.serverOnly && trainedOk(c, today)) return { ok:true, basis:{ type:"client", id:c.id, sessions: cnt(c) }, label:`Đã tập cùng · ${cnt(c)} buổi` };
  const r = ctx.rights && ctx.rights.ptUid === ctx.ptUid ? ctx.rights : (ctx.rights && !ctx.rights.ptUid ? ctx.rights : null);
  const until = r && r.until != null ? (typeof r.until.toMillis === "function" ? r.until.toMillis() : Number(r.until)) : 0;
  const rType = r ? (r.type || (r.basis && r.basis.type) || "client") : "";          // Firebase: { uid, lid, basis:{type,id}, until } do Function grantRights ghi
  if(r && until && until > Date.now() && !r.confirmed) return { ok:true, basis:{ type: rType === "trial" ? "trial" : "client", id: r.cid || (r.basis && r.basis.id) || "rights", sessions: num(r.sessions) || 1, former: !c }, label: rType === "trial" ? "Đã tập buổi thử" : `Đã tập cùng${num(r.sessions) ? ` · ${num(r.sessions)} buổi` : ""}` };
  if(ctx.serverOnly){   // Firebase: rules chỉ nhận quyền do MÁY CHỦ cấp (reviewRights) — không tự kết luận ở máy người dùng
    return { ok:false, code:"pending-rights", reason:"Quyền đánh giá do máy chủ TapEasy xác nhận: cần ≥ 2 buổi PT xác nhận và đã kết nối ≥ 7 ngày, hoặc 1 buổi thử đã hoàn thành. Thử lại sau buổi tập tiếp theo nhé." };
  }
  if(r && trainedOk(r, today)) return { ok:true, basis:{ type:"client", id: r.cid || "former", sessions: cnt(r), former:true }, label:`Đã tập cùng · ${cnt(r)} buổi` };
  const t = arr(ctx.trials).find(x=> x && x.status === "done");
  if(t) return { ok:true, basis:{ type:"trial", id:t.id, sessions:1 }, label:"Đã tập buổi thử" };
  if(c && num(c.done) >= 1) return { ok:false, code:"unconfirmed", reason:"Cần PT xác nhận buổi đã tập (PT bấm \"Đã tập\" hoặc ghi thay): ít nhất 2 buổi, hoặc 1 buổi và đã tập cùng từ 7 ngày." };
  if(c) return { ok:false, code:"no-session", reason:"Bạn đã kết nối với PT này nhưng chưa có buổi nào được đánh dấu hoàn thành." };
  return { ok:false, code:"not-trained", reason:"Chỉ người đã tập cùng PT mới đánh giá được: kết nối qua TapEasy và có buổi hoàn thành được PT xác nhận, hoặc buổi thử được PT xác nhận." };
}
function basisLabel(b){ b = obj(b); return b.type === "client" ? `Đã tập cùng · ${num(b.sessions) || 1} buổi` : b.type === "trial" ? "Đã tập buổi thử" : "Đã tập cùng"; }
function moneyVN(v){ v = Math.round(num(v)); return v.toLocaleString("vi-VN") + "đ"; }
function moneyK(v){ v = num(v); if(!v) return "0"; if(v >= 1000000) return (Math.round(v / 100000) / 10).toLocaleString("vi-VN") + "tr"; return Math.round(v / 1000) + "k"; }

/* =====================================================================
   4. DỮ LIỆU MINH HOẠ — 20 PT (ảnh Pexels, tên & đánh giá giả lập) + 79 đánh giá
   Ảnh: Pexels License (dùng miễn phí, kể cả thương mại). Tác giả ghi kèm từng ảnh.
   Không dùng ảnh người nổi tiếng. Tên phòng tập là tên minh hoạ.
   ===================================================================== */
const PX = (id, w)=> `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w || 900}`;
const PXP = id=> `https://www.pexels.com/photo/${id}/`;
const A_ = "Andres Ayrton", KS = "Ketut Subiyanto", MA = "Miriam Alonso", MN = "Mikhail Nilov", KP = "Kampus Production", GF = "Gustavo Fring", RD = "RDNE Stock project";
const SEED_PT = [
  { id:"seed_khang", name:"Trần Minh Khang", brandName:"Khang Strength Lab", gender:"male", years:7, prov:"hn", ward:"Phường Cầu Giấy", areaHint:"Q. Cầu Giấy cũ",
    specs:["Tăng cơ","Sức mạnh","Giảm mỡ"], langs:["vi","en"],
    certs:[["NASM Certified Personal Trainer (CPT)","NASM (Hoa Kỳ)",2018],["Huấn luyện viên Powerlifting cơ sở","Liên đoàn Powerlifting Hà Nội",2021]],
    places:[["gym","Iron Lab Cầu Giấy","Khu Dịch Vọng Hậu"],["online","Google Meet","Chỉnh kỹ thuật qua video"]],
    prices:{ single:450000, pack12:4800000, pack24:9000000, online:300000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m,e", T3:"e", T4:"m,e", T5:"e", T6:"m,e", T7:"m,a", CN:"" }, resp:[52,50,14], joined:"2025-02-18", verified:"2025-03-04", students:48, sessions:1920,
    bio:"Mình chuyên giúp dân văn phòng tăng sức mạnh nền tảng (squat, deadlift, bench) đúng kỹ thuật, không chấn thương. Mỗi học viên có giáo án theo chu kỳ 4–6 tuần, đo tiến độ bằng số kg × lần và video form hằng tuần.",
    cover:[6550865,A_], album:[[6550844,A_],[6551087,A_],[6550852,A_],[6551437,A_],[40371837,"大 董"],[6551078,A_],[6550840,A_]] },
  { id:"seed_thuha", name:"Nguyễn Thu Hà", brandName:"Mây Yoga Tây Hồ", gender:"female", years:6, prov:"hn", ward:"Phường Tây Hồ", areaHint:"Q. Tây Hồ cũ",
    specs:["Yoga","Linh hoạt","Phục hồi"], langs:["vi","en"],
    certs:[["Yoga Alliance RYT-500","Yoga Alliance",2020],["Yin Yoga & Myofascial Release 50h","Rishikesh Yogpeeth",2022]],
    places:[["gym","Studio Mây Yoga","Ven hồ Tây, gần Quảng An"],["home","Tại nhà học viên","Bán kính 5 km"],["online","Zoom 1-1",""]],
    prices:{ single:350000, pack12:3900000, pack24:7200000, online:250000, trial:0 }, cancel:"flex",
    avail:{ T2:"m,n", T3:"m,e", T4:"m,n", T5:"m,e", T6:"m", T7:"m,a", CN:"m" }, resp:[38,37,22], joined:"2025-04-02", verified:"2025-04-20", students:62, sessions:2140,
    bio:"Yoga cho người cứng người, đau vai gáy vì ngồi máy tính. Mình dạy chậm, chỉnh tư thế bằng lời và bằng tay (khi bạn đồng ý), luôn có phương án thay thế cho người có chấn thương.",
    cover:[7593038,MA], album:[[7592348,MA],[7593040,MA],[7592357,MA],[7592425,MA],[7592757,MA]] },
  { id:"seed_phuc", name:"Lê Hoàng Phúc", brandName:"Phúc Lê Coaching", gender:"male", years:9, prov:"hcm", ward:"Phường Sài Gòn", areaHint:"Quận 1 cũ",
    specs:["Giảm mỡ","Tăng cơ","Dinh dưỡng thể thao"], langs:["vi","en"],
    certs:[["ACE Certified Personal Trainer","American Council on Exercise",2017],["ISSA Nutritionist","ISSA",2021]],
    places:[["gym","District One Strength Club","Gần chợ Bến Thành"],["online","Theo dõi ăn uống online","Video form + nhật ký bữa ăn"]],
    prices:{ single:700000, pack12:7800000, pack24:14400000, online:450000, trial:350000 }, cancel:"strict",
    avail:{ T2:"m,e", T3:"m,e", T4:"m,e", T5:"m,e", T6:"m", T7:"m", CN:"" }, resp:[61,57,35], joined:"2025-01-09", verified:"2025-02-01", students:85, sessions:3600,
    bio:"Giảm mỡ bền vững cho người bận rộn: 3 buổi/tuần + thực đơn món Việt tính sẵn macro. Mình theo dõi cân nặng trung bình tuần, vòng eo và sức mạnh — không ép ăn kiêng khắc nghiệt.",
    cover:[4854263,KS], album:[[4853692,KS],[4853917,KS],[4853287,KS],[4853293,KS],[4854258,KS],[4853275,KS],[30635703,"IARA MELO"]] },
  { id:"seed_ngocanh", name:"Phạm Ngọc Anh", brandName:"Lumi Pilates", gender:"female", years:5, prov:"hcm", ward:"Phường An Khánh", areaHint:"Thảo Điền – TP. Thủ Đức cũ",
    specs:["Pilates","Mẹ bầu & sau sinh","Tư thế & đau lưng"], langs:["vi","en"],
    certs:[["Pilates Mat & Reformer Comprehensive","Balanced Body",2021],["Pre & Postnatal Exercise Specialist","American Council on Exercise",2023]],
    places:[["gym","Lumi Pilates Studio (reformer)","Khu Thảo Điền"],["online","Pilates thảm qua Zoom",""]],
    prices:{ single:900000, pack12:9600000, pack24:18000000, online:400000, trial:500000 }, cancel:"strict",
    avail:{ T2:"m,a", T3:"m,a", T4:"a,e", T5:"m,a", T6:"m,a", T7:"m", CN:"" }, resp:[29,29,12], joined:"2025-06-20", verified:"2025-07-02", students:34, sessions:1180,
    bio:"Pilates reformer 1-1 cho người đau lưng, mẹ sau sinh bị tách cơ bụng, dân văn phòng gù vai. Buổi đầu luôn đánh giá tư thế và hơi thở trước khi tập.",
    cover:[18136887,"Lê Đức"], album:[[18136882,"Lê Đức"],[8769175,GF],[6111610,KP],[6111607,KP],[31509844,"Flexity Yoga & Pilates"]] },
  { id:"seed_ductai", name:"Võ Đức Tài", brandName:"Ring 79 Boxing", gender:"male", years:10, prov:"hcm", ward:"Phường Tân Sơn Nhất", areaHint:"Q. Tân Bình cũ",
    specs:["Boxing","Giảm mỡ","Thể lực"], langs:["vi"],
    certs:[["Huấn luyện viên Quyền Anh cơ sở","Liên đoàn Quyền Anh TP.HCM",2016],["Sơ cấp cứu thể thao","Hội Chữ thập đỏ TP.HCM",2024]],
    places:[["gym","Ring 79 Boxing Gym","Gần sân bay Tân Sơn Nhất"],["outdoor","Công viên Hoàng Văn Thụ","Sáng sớm"]],
    prices:{ single:400000, pack12:4200000, pack24:7900000, online:0, trial:0 }, cancel:"moderate",
    avail:{ T2:"e", T3:"m,e", T4:"e", T5:"m,e", T6:"e", T7:"m,a", CN:"m" }, resp:[44,40,48], joined:"2025-05-11", verified:"", students:57, sessions:2400,
    bio:"Boxing kỹ thuật cho người mới: tư thế, bước chân, combo cơ bản, đánh pad. Đổ mồ hôi nhiều nhưng an toàn — không sparring khi bạn chưa sẵn sàng.",
    cover:[35168122,"Hoàng Phương Nguyễn"], album:[[35305754,"Sóc Năng Động"],[6740344,MN],[6740342,MN],[6740346,MN],[8611244,RD],[6740338,MN]] },
  { id:"seed_quynhnhu", name:"Đặng Quỳnh Như", brandName:"Như Fit", gender:"female", years:3, prov:"dn", ward:"Phường Hải Châu", areaHint:"Q. Hải Châu cũ",
    specs:["Giảm mỡ","Tăng cơ","Người mới"], langs:["vi"],
    certs:[["ACE Certified Personal Trainer","American Council on Exercise",2023]],
    places:[["gym","Hải Châu Fitness Hub","Đường Bạch Đằng"],["online","Giáo án + check-in qua app",""]],
    prices:{ single:250000, pack12:2700000, pack24:5000000, online:150000, trial:0 }, cancel:"flex",
    avail:{ T2:"m,e", T3:"e", T4:"m,e", T5:"e", T6:"m,e", T7:"m", CN:"m" }, resp:[27,26,9], joined:"2025-09-03", verified:"2025-09-20", students:26, sessions:640,
    bio:"Dành cho bạn nữ mới vào phòng gym: tập mông – đùi – lưng đúng form, tự tin dùng máy. Mình nhắn nhắc lịch và xem ảnh bữa ăn mỗi ngày.",
    cover:[40021619,"Andreas Suwardy"], album:[[40021609,"Andreas Suwardy"],[40021611,"Andreas Suwardy"],[40021296,"Irwan Susanto"],[9545911,"TUBARONES PHOTOGRAPHY"]] },
  { id:"seed_giabao", name:"Huỳnh Gia Bảo", brandName:"Bảo Calisthenics", gender:"male", years:6, prov:"dn", ward:"Phường An Hải", areaHint:"Q. Sơn Trà cũ",
    specs:["Calisthenics","Thể lực","Chạy bộ"], langs:["vi","en"],
    certs:[["Calisthenics Coach Level 1","World Calisthenics Organization",2020],["Sơ cấp cứu & CPR","Hội Chữ thập đỏ Đà Nẵng",2024]],
    places:[["outdoor","Bãi xà ven biển Phạm Văn Đồng","Bờ biển An Hải"],["home","Tại nhà với xà đơn",""]],
    prices:{ single:200000, pack12:2100000, pack24:3900000, online:120000, trial:0 }, cancel:"flex",
    avail:{ T2:"m,e", T3:"m,e", T4:"m,e", T5:"m,e", T6:"m,e", T7:"m", CN:"m" }, resp:[33,30,40], joined:"2025-07-15", verified:"", students:31, sessions:980,
    bio:"Kéo xà đầu tiên, chống đẩy chuẩn, handstand — chỉ cần trọng lượng cơ thể. Tập ngoài trời bên biển buổi sáng, có giáo án tại nhà cho ngày mưa.",
    cover:[13993574,"Niko Twisty"], album:[[13993572,"Niko Twisty"],[13993540,"Niko Twisty"],[10021269,"Nikola Vu"],[10021280,"Nikola Vu"],[35703187,"Skylight Views"]] },
  { id:"seed_vanson", name:"Nguyễn Văn Sơn", brandName:"Sơn Cảng Gym", gender:"male", years:14, prov:"hp", ward:"Phường Lê Chân", areaHint:"Q. Lê Chân cũ",
    specs:["Thể hình thi đấu","Tăng cơ","Dinh dưỡng thể thao"], langs:["vi"],
    certs:[["Huấn luyện viên Thể hình – Fitness","Trường ĐH TDTT Bắc Ninh (bồi dưỡng)",2014],["Huấn luyện viên Fitness nâng cao","Trung tâm HL&TĐ TDTT Hải Phòng",2018]],
    places:[["gym","Cảng Gym Lê Chân","Gần hồ Tam Bạc"]],
    prices:{ single:300000, pack12:3200000, pack24:6000000, online:200000, trial:150000 }, cancel:"moderate",
    avail:{ T2:"m,a,e", T3:"m,a,e", T4:"m,a,e", T5:"m,a,e", T6:"m,a,e", T7:"m,a", CN:"" }, resp:[40,31,190], joined:"2025-03-28", verified:"2025-04-15", students:120, sessions:5200,
    bio:"14 năm đứng sàn, từng chuẩn bị cho học viên thi thể hình phong trào cấp thành phố. Tăng cơ bài bản, chia giai đoạn tăng cân / siết cơ, kiểm tra số đo 2 tuần/lần.",
    cover:[12890881,"Connor Scott McManus"], album:[[12890817,"Connor Scott McManus"],[33188911,"Kenneth Surillo"],[5799855,"Kong Khawlhring"],[6388373,"Tima Miroshnichenko"],[40309468,"Tuti Isnawati"]] },
  { id:"seed_mailinh", name:"Trịnh Mai Linh", brandName:"Linh Dance Fit", gender:"female", years:8, prov:"ct", ward:"Phường Ninh Kiều", areaHint:"Q. Ninh Kiều cũ",
    specs:["Aerobic & nhảy","Giảm mỡ","Người mới"], langs:["vi"],
    certs:[["Zumba Instructor – Basic 1","Zumba Fitness",2018],["Huấn luyện viên Aerobic","Trung tâm TDTT Cần Thơ",2017]],
    places:[["gym","Ninh Kiều Wellness","Gần bến Ninh Kiều"],["online","Lớp nhóm nhỏ online","Tối T3 / T5"]],
    prices:{ single:180000, pack12:1900000, pack24:3500000, online:100000, trial:0 }, cancel:"flex",
    avail:{ T2:"e", T3:"e", T4:"e", T5:"e", T6:"e", T7:"m,e", CN:"m" }, resp:[25,24,30], joined:"2025-08-08", verified:"2025-08-30", students:70, sessions:1500,
    bio:"Nhảy cho vui mà đốt mỡ thật: bài nhảy dễ, nhạc Việt + quốc tế, cường độ chỉnh theo nhịp tim. Hợp với ai ngại phòng gym.",
    cover:[40428934,"Andreas Suwardy"], album:[[40428947,"Andreas Suwardy"],[40428937,"Andreas Suwardy"],[4090012,"Kate Trysh"],[37156646,"Muhamad Guruh Budi Hartono"],[8957662,KP]] },
  { id:"seed_thanhtam", name:"Lý Thanh Tâm", brandName:"Tâm Rehab & Active Aging", gender:"female", years:9, prov:"hue", ward:"Phường Phú Xuân", areaHint:"Trung tâm Huế",
    specs:["Phục hồi chức năng","Người cao tuổi","Tư thế & đau lưng"], langs:["vi","en"],
    certs:[["Cử nhân Kỹ thuật Phục hồi chức năng","Trường ĐH Y – Dược, ĐH Huế",2014],["NASM Corrective Exercise Specialist (CES)","NASM",2020]],
    places:[["home","Tập tại nhà người cao tuổi","Nội thành Huế"],["gym","Phú Xuân Active Studio","Gần cầu Trường Tiền"]],
    prices:{ single:500000, pack12:5400000, pack24:10200000, online:300000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m,a", T3:"m,a", T4:"m,a", T5:"m,a", T6:"m,a", T7:"m", CN:"" }, resp:[36,35,25], joined:"2025-02-26", verified:"2025-03-10", students:41, sessions:2300,
    bio:"Tập an toàn cho người lớn tuổi, sau mổ thay khớp, đau thắt lưng. Phối hợp với bác sĩ điều trị khi cần; không thay thế điều trị y khoa.",
    cover:[6922174,KP], album:[[6922177,KP],[6922122,KP],[6922123,KP],[6922165,KP],[6922119,KP]] },
  { id:"seed_khanhvy", name:"Bùi Khánh Vy", brandName:"Vy Swim Nha Trang", gender:"female", years:5, prov:"kh", ward:"Phường Nha Trang", areaHint:"Trung tâm Nha Trang",
    specs:["Bơi lội","Thể lực","Người mới"], langs:["vi","en"],
    certs:[["Huấn luyện viên Bơi lội","Sở VH-TT Khánh Hòa",2021],["Cứu hộ – cứu đuối","Hội Chữ thập đỏ Khánh Hòa",2022]],
    places:[["gym","Hồ bơi khu Trần Phú","Gần biển Trần Phú"],["outdoor","Bơi biển buổi sáng","Khi biển êm"]],
    prices:{ single:300000, pack12:3200000, pack24:6000000, online:0, trial:0 }, cancel:"flex",
    avail:{ T2:"m,a", T3:"m,a", T4:"m,a", T5:"m,a", T6:"m,a", T7:"m,a", CN:"m" }, resp:[31,30,17], joined:"2025-05-30", verified:"2025-06-14", students:95, sessions:2600,
    bio:"Dạy bơi cho trẻ từ 5 tuổi và người lớn sợ nước. 10–12 buổi là bơi được ếch 25 m. Luôn có cứu hộ và áo phao cho người mới.",
    cover:[40719510,"Skytech Aviation"], album:[[40719514,"Skytech Aviation"],[40719515,"Skytech Aviation"],[37304029,"Dwi Rizqi F"],[8028663,"SHVETS production"]] },
  { id:"seed_quanghuy", name:"Đỗ Quang Huy", brandName:"Đà Lạt Trail Lab", gender:"male", years:11, prov:"ld", ward:"Phường Xuân Hương - Đà Lạt", areaHint:"Trung tâm Đà Lạt",
    specs:["Chạy bộ","Thể lực","Giảm mỡ"], langs:["vi","en"],
    certs:[["RRCA Certified Running Coach","Road Runners Club of America",2019]],
    places:[["outdoor","Hồ Xuân Hương & đồi thông","Trung tâm Đà Lạt"],["online","Giáo án chạy theo nhịp tim","Xem dữ liệu đồng hồ"]],
    prices:{ single:350000, pack12:3600000, pack24:6600000, online:250000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m", T3:"m,a", T4:"m", T5:"m,a", T6:"m", T7:"m", CN:"m" }, resp:[22,21,45], joined:"2025-10-01", verified:"", students:38, sessions:900,
    bio:"Từ 0 lên 10 km, rồi chinh phục trail 21 km ở cao nguyên. Tập theo vùng nhịp tim, kết hợp sức mạnh chân để không đau gối.",
    cover:[39322345,"Tuấn Vũ"], album:[[29151594,"Anh Tuấn Lê"],[18715198,"Hiep Nguyen"],[31492040,"Nay Nyo"],[4853083,KS]] },
  { id:"seed_my", name:"Hoàng Thị Mỹ", brandName:"Mỹ Mom Fit", gender:"female", years:8, prov:"qn", ward:"Phường Hạ Long", areaHint:"TP. Hạ Long cũ",
    specs:["Mẹ bầu & sau sinh","Yoga","Pilates"], langs:["vi"],
    certs:[["Registered Prenatal Yoga Teacher (RPYT)","Yoga Alliance",2019],["Pre & Postnatal Coaching","Girls Gone Strong",2022]],
    places:[["home","Tập tại nhà","Hạ Long, Bãi Cháy"],["online","Lớp 1-1 cho mẹ bầu qua Zoom",""]],
    prices:{ single:400000, pack12:4300000, pack24:8000000, online:280000, trial:0 }, cancel:"flex",
    avail:{ T2:"m,a", T3:"m", T4:"m,a", T5:"m", T6:"m,a", T7:"m", CN:"" }, resp:[24,24,11], joined:"2025-04-19", verified:"2025-05-05", students:52, sessions:1700,
    bio:"Tập cho mẹ bầu từ tam cá nguyệt 2 (cần ý kiến bác sĩ sản), phục hồi sàn chậu và tách cơ bụng sau sinh. Nhẹ nhàng, an toàn, không vội.",
    cover:[13849172,"RAY LEI"], album:[[13849175,"RAY LEI"],[13849171,"RAY LEI"],[3984364,GF],[3984362,GF],[7055659,"Pavel Danilyuk"]] },
  { id:"seed_nhatnam", name:"Phan Nhật Nam", brandName:"Vinh Muay Club", gender:"male", years:4, prov:"na", ward:"Phường Thành Vinh", areaHint:"TP. Vinh cũ",
    specs:["Muay Thai","Giảm mỡ","Thể lực"], langs:["vi"],
    certs:[["Huấn luyện viên Muay cơ bản","Liên đoàn Muay Việt Nam",2022]],
    places:[["gym","Vinh Muay Club","Gần quảng trường trung tâm"]],
    prices:{ single:150000, pack12:1500000, pack24:2800000, online:0, trial:0 }, cancel:"flex",
    avail:{ T2:"e", T3:"e", T4:"e", T5:"e", T6:"e", T7:"a,e", CN:"a" }, resp:[19,17,55], joined:"2025-11-20", verified:"", students:22, sessions:520,
    bio:"Muay Thai cho người mới: đá, gối, chỏ, ôm ghì đúng kỹ thuật, tập pad và bao. Giá sinh viên, nhóm 2 người giảm thêm.",
    cover:[8612586,RD], album:[[8611942,RD],[8612030,RD],[8611370,RD],[40608838,"Hera Permata S"],[8611297,RD]] },
  { id:"seed_thuyduong", name:"Cao Thùy Dương", brandName:"Dương Strong", gender:"female", years:7, prov:"bn", ward:"Phường Kinh Bắc", areaHint:"TP. Bắc Ninh cũ",
    specs:["Tăng cơ","Sức mạnh","Người mới"], langs:["vi","en"],
    certs:[["ISSA Certified Personal Trainer","ISSA",2018],["Strength Coaching for Women","Girls Gone Strong",2021]],
    places:[["gym","Kinh Bắc Strong Gym","Trung tâm Bắc Ninh"],["online","Giáo án + duyệt video form",""]],
    prices:{ single:280000, pack12:3000000, pack24:5600000, online:180000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m,e", T3:"m,e", T4:"e", T5:"m,e", T6:"m,e", T7:"m", CN:"" }, resp:[30,29,20], joined:"2025-03-07", verified:"2025-03-30", students:44, sessions:1650,
    bio:"Phụ nữ cũng nâng tạ nặng được! Mình hướng dẫn squat, deadlift, hip thrust từ thanh đòn rỗng, theo dõi kỷ lục cá nhân và điều chỉnh theo chu kỳ kinh nguyệt.",
    cover:[13673631,"Bùi Lành"], album:[[13673629,"Bùi Lành"],[31500878,"Ventara Films"],[31500868,"Ventara Films"],[14502911,"Jason Morrison"]] },
  { id:"seed_tuankiet", name:"Mai Tuấn Kiệt", brandName:"Kiệt Kettlebell Lab", gender:"male", years:10, prov:"hcm", ward:"Phường Thủ Dầu Một", areaHint:"Bình Dương cũ",
    specs:["Kettlebell & chức năng","Sức mạnh","Giảm mỡ"], langs:["vi"],
    certs:[["Kettlebell Instructor Level 1","StrongFirst",2017],["CrossFit Level 1 Trainer","CrossFit",2019]],
    places:[["gym","Kiệt Functional Box","Trung tâm Thủ Dầu Một"],["home","Mang tạ ấm đến nhà",""],["online","Buổi 30 phút qua Zoom",""]],
    prices:{ single:350000, pack12:3700000, pack24:6900000, online:200000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m,e", T3:"m,e", T4:"m,e", T5:"m,e", T6:"m", T7:"m,a", CN:"" }, resp:[35,33,26], joined:"2025-06-02", verified:"2025-06-25", students:49, sessions:2100,
    bio:"Swing, clean, press, get-up — sức mạnh toàn thân chỉ với một quả tạ ấm. Buổi 45 phút gọn gàng cho người bận.",
    cover:[10942691,"Alexa Popovich"], album:[[10942689,"Alexa Popovich"],[4804337,KS],[6390225,"Tima Miroshnichenko"],[9545907,"TUBARONES PHOTOGRAPHY"]] },
  { id:"seed_baotram", name:"Ngô Bảo Trâm", brandName:"Trâm Home Fit", gender:"female", years:2, prov:"th", ward:"Phường Hạc Thành", areaHint:"TP. Thanh Hóa cũ",
    specs:["Giảm mỡ","Người mới","Linh hoạt"], langs:["vi"],
    certs:[["Huấn luyện viên Fitness cơ bản","Trung tâm TDTT Thanh Hóa",2024]],
    places:[["home","Tập tại nhà học viên","Nội thành, bán kính 4 km"],["online","Video call 1-1",""]],
    prices:{ single:160000, pack12:1700000, pack24:3200000, online:100000, trial:0 }, cancel:"flex",
    avail:{ T2:"m,e", T3:"m,e", T4:"m,e", T5:"m,e", T6:"m,e", T7:"m,a", CN:"m" }, resp:[12,12,8], joined:"2026-08-14", verified:"", students:9, sessions:140,
    bio:"Mới vào nghề nhưng rất kỹ: mang thảm, dây kháng lực, tạ đơn tới nhà. Bài tập không nhảy để không làm phiền hàng xóm.",
    cover:[4852739,KS], album:[[8032754,"MART PRODUCTION"],[7900680,"Ron Lach"],[8846574,"MART PRODUCTION"],[6453430,"Marta Wave"],[4498454,"Kaboompics"]] },
  { id:"seed_anhdung", name:"Kiều Anh Dũng", brandName:"ADK Performance", gender:"male", years:16, prov:"hn", ward:"Phường Hoàn Kiếm", areaHint:"Q. Hoàn Kiếm cũ",
    specs:["Huấn luyện VĐV","Sức mạnh","Phục hồi chức năng"], langs:["vi","en"],
    certs:[["Certified Strength & Conditioning Specialist (CSCS)","NSCA",2015],["Thạc sĩ Khoa học Thể thao","Trường ĐH TDTT Bắc Ninh",2013],["FMS Level 2","Functional Movement Systems",2018]],
    places:[["gym","ADK Performance Center","Gần hồ Hoàn Kiếm"],["online","Phân tích dữ liệu & giáo án từ xa",""]],
    prices:{ single:1200000, pack12:13200000, pack24:24000000, online:700000, trial:800000 }, cancel:"strict",
    avail:{ T2:"m,a", T3:"m,a", T4:"m,a", T5:"m,a", T6:"m,a", T7:"m", CN:"" }, resp:[47,46,18], joined:"2025-01-15", verified:"2025-01-28", students:140, sessions:6800,
    bio:"Huấn luyện sức mạnh & thể lực cho VĐV bán chuyên và người muốn tối ưu thành tích: test thể lực, sức mạnh tối đa, sàng lọc chuyển động FMS, quay lại tập sau chấn thương.",
    cover:[20523354,"VO2 Master"], album:[[32830368,"TSquared Lab"],[13621289,"TSquared Lab"],[29224211,"foad shariyati"],[40371850,"大 董"],[34794734,"Mateo Franciosi"]] },
  { id:"seed_haiyen", name:"Lâm Hải Yến", brandName:"Yến Ocean Yoga", gender:"female", years:6, prov:"ag", ward:"Đặc khu Phú Quốc", areaHint:"Phú Quốc",
    specs:["Yoga","Linh hoạt","Phục hồi"], langs:["vi","en"],
    certs:[["Yoga Alliance RYT-200","Yoga Alliance",2019],["Aerial Yoga Teacher Training","Rishikesh Yogpeeth",2021]],
    places:[["outdoor","Yoga bãi biển","Bãi Trường, sáng sớm"],["home","Tại resort / villa của bạn",""],["online","Zoom 1-1",""]],
    prices:{ single:600000, pack12:6500000, pack24:12000000, online:350000, trial:0 }, cancel:"moderate",
    avail:{ T2:"m,a", T3:"m,a", T4:"m,a", T5:"m,a", T6:"m,a", T7:"m,a", CN:"m" }, resp:[26,25,16], joined:"2025-12-05", verified:"2025-12-20", students:60, sessions:1300,
    bio:"Yoga bình minh trên biển, Hatha & Vinyasa nhẹ cho người mới; lớp riêng cho khách du lịch và cặp đôi.",
    cover:[39963095,"Andreas Suwardy"], album:[[40901922,"Riqqah_ss"],[40189494,"ds rexy"],[40302221,"Tomy Putra"],[40261672,"David Tumpal"],[40666375,"anggit priyandani"]] },
  { id:"seed_minhtri", name:"Tạ Minh Trí", brandName:"Trí Outdoor PT", gender:"male", years:5, prov:"gl", ward:"Phường Quy Nhơn", areaHint:"TP. Quy Nhơn cũ",
    specs:["Giảm mỡ","Thể lực","Người mới"], langs:["vi"],
    certs:[["ACE Certified Personal Trainer","American Council on Exercise",2021]],
    places:[["outdoor","Công viên ven biển Xuân Diệu","Quy Nhơn"],["home","Tại nhà, mang dụng cụ",""]],
    prices:{ single:220000, pack12:2300000, pack24:4300000, online:120000, trial:0 }, cancel:"flex",
    avail:{ T2:"m", T3:"m,e", T4:"m", T5:"m,e", T6:"m", T7:"m", CN:"m" }, resp:[18,16,70], joined:"2026-03-21", verified:"", students:19, sessions:420,
    bio:"Tập ngoài trời sáng sớm bên biển: tạ đơn, dây kháng lực, chạy biến tốc. Hợp người mới muốn giảm 3–6 kg trong 2–3 tháng.",
    cover:[40219053,"Achmad Fauzy"], album:[[40302238,"Tomy Putra"],[40302239,"Tomy Putra"],[40219056,"Achmad Fauzy"],[40646062,"Andri Wijayanto"],[40261686,"David Tumpal"]] },
];
/* Ảnh trong đánh giá (Pexels) */
const RVP = { 4853876:KS, 30635703:"IARA MELO", 4426296:KS, 4426317:KS, 4426318:KS, 7690208:"cottonbro studio", 4436347:KS, 4428991:KS };
/* Đánh giá: [tên, sao, [chuyên môn, đúng giờ, thái độ, hiệu quả], ngày trước, "client"|"trial", số buổi, nội dung, ảnh[], trả lời PT, trả lời sau (ngày), cờ] */
const SEED_RV = {
  seed_khang:[
    ["Hoàng Long",5,[5,5,5,5],12,"client",36,"Tập với anh Khang 3 tháng, deadlift từ 60 lên 120 kg mà lưng không đau lần nào. Anh quay video từng hiệp rồi chỉ lỗi rất cụ thể, giáo án có số kg rõ ràng nên ngày lẻ mình tự tập cũng được.",[],"Cảm ơn Long! 120 kg là nhờ em đi tập đều đó. Chu kỳ tới mình thử nâng squat nhé.",1],
    ["Minh Thư",5,[5,4,5,5],30,"client",24,"Lúc đầu mình sợ tạ nặng vì nghĩ con gái tập sẽ to. Anh giải thích kỹ, cho tập từ thanh đòn rỗng. Sau 2 tháng vòng eo giảm 4 cm, hết mỏi lưng khi ngồi làm việc.",[4853876]],
    ["Đức Anh",4,[5,3,5,4],47,"client",12,"Chuyên môn rất chắc, giải thích dễ hiểu. Trừ 1 sao vì có 2 buổi anh đến trễ khoảng 10 phút (có báo trước và bù giờ). Nói chung vẫn đáng tiền.",[],"Cảm ơn Đức Anh đã góp ý thẳng. Tháng đó anh kẹt lịch thi đấu, giờ đã cố định lịch, không để trễ nữa nhé.",2],
    ["Thanh Tùng",5,[5,5,5,4],70,"trial",1,"Mới tập buổi thử miễn phí nhưng ấn tượng: đo khả năng vận động, kiểm tra squat và gập hông trước khi cho tập. Không chèo kéo mua gói."],
    ["Phương Linh",5,[5,5,5,5],95,"client",48,"48 buổi rồi vẫn thấy tiến bộ đều. Bench từ 25 lên 45 kg. Anh còn chỉnh thực đơn cho mình ăn đủ đạm mà không phải ăn ức gà mãi.",[30635703],"Phương Linh chăm nhất lớp sáng! Giữ nhịp này nhé.",3],
    ["Quốc Bảo",3,[4,4,3,3],120,"client",10,"Kiến thức tốt nhưng buổi nào cũng tập nặng, mình hơi đuối vì đi làm về muộn. Nên hỏi kỹ thể trạng hôm đó hơn.",[],"Cảm ơn Bảo, góp ý rất đúng. Giờ mỗi buổi anh đều hỏi giấc ngủ và mức mệt (thang 1–10) trước khi chốt mức tạ.",4],
  ],
  seed_thuha:[
    ["Ngọc Mai",5,[5,5,5,5],8,"client",20,"Chị Hà dạy rất nhẹ nhàng, hết đau vai gáy sau 1 tháng. Mỗi buổi chị đều hỏi hôm nay cơ thể thấy thế nào rồi mới chọn bài."],
    ["Sarah K.",5,[5,5,5,5],25,"client",12,"Lessons in English and Vietnamese, very patient. My hamstrings were super tight from running, now I can touch my toes.",[],"Thank you Sarah! Keep the 10-minute evening routine.",1],
    ["Thu Trang",4,[5,4,5,4],40,"trial",1,"Buổi thử ở studio view hồ Tây rất đẹp, yên tĩnh. Hơi khó gửi xe vào giờ tan tầm.",[],"Cảm ơn Trang, chị đã ghi thêm hướng dẫn gửi xe ở ngõ bên cạnh trong phần địa điểm nhé.",1],
    ["Hải Yến",5,[5,5,5,5],60,"client",36,"Mình bị thoát vị đĩa đệm nhẹ, chị Hà luôn đưa bài thay thế và không bao giờ ép gập sâu. Rất an tâm."],
    ["Bảo Ngọc",5,[4,5,5,5],88,"client",8,"Lớp online qua Zoom mà chị vẫn nhìn ra mình lệch hông. Giờ giấc chuẩn từng phút.",[4426296]],
  ],
  seed_phuc:[
    ["Tuấn Anh",5,[5,5,5,5],6,"client",30,"Giảm 9 kg trong 4 tháng, vẫn ăn cơm, phở bình thường. Anh Phúc tính macro bằng món Việt nên dễ theo. Đắt nhưng xứng đáng.",[30635703],"Tuấn Anh làm được là nhờ kỷ luật ăn uống của em. Giai đoạn duy trì mình giữ 3 buổi/tuần nhé.",1],
    ["Khánh Linh",4,[5,5,4,4],22,"client",24,"Chuyên môn giỏi, theo dõi sát. Chính sách huỷ hơi chặt (phải báo trước 48 tiếng) nên mình mất 1 buổi lúc ốm đột xuất.",[],"Cảm ơn Linh. Có giấy khám bệnh anh vẫn bảo lưu buổi, lần sau em cứ gửi qua tin nhắn nhé — anh đã ghi rõ điều này vào chính sách huỷ.",2],
    ["Hùng Nguyễn",5,[5,5,5,5],45,"client",60,"Tập 60 buổi, mỡ bụng giảm rõ, bench 80 kg. Phòng tập sạch, ít người buổi sáng."],
    ["Diễm My",2,[3,4,2,2],80,"trial",1,"Buổi thử trả phí 350k nhưng chủ yếu tư vấn mua gói, tập thực tế chỉ 25 phút. Mình chưa thấy phù hợp.",[],"Chào My, cảm ơn em đã phản hồi. Buổi thử gồm 30 phút đánh giá thể trạng + 30 phút tập; anh xin lỗi vì phần tư vấn gói kéo dài. Từ tháng 10 anh đã tách riêng phần tư vấn, không tính vào giờ tập.",3,{ reports:2, flagged:true }],
    ["Quang Vinh",5,[5,5,5,5],130,"client",36,"Lần đầu tập gym ở tuổi 38. Anh Phúc kiên nhẫn, chỉnh form từng chút. Huyết áp ổn định hơn, bác sĩ cũng khen."],
  ],
  seed_ngocanh:[
    ["Thảo Vy",5,[5,5,5,5],10,"client",16,"Sau sinh bé thứ 2 bị tách cơ bụng 2,5 ngón, tập với Ngọc Anh 2 tháng còn 1 ngón. Rất hiểu cơ thể phụ nữ sau sinh.",[],"Chúc mừng chị Vy! Mình giữ bài thở và dead bug mỗi ngày nhé.",1],
    ["Jenny Park",5,[5,5,5,5],34,"client",12,"Reformer studio is beautiful and clean. Ngoc Anh explains in English very clearly. My lower back pain is gone."],
    ["Mỹ Hạnh",4,[5,5,4,4],58,"trial",1,"Giá cao so với mặt bằng nhưng 1-1 trên reformer thì hợp lý. Buổi thử hơi ngắn, mong được tập lâu hơn.",[],"Cảm ơn Hạnh, buổi thử là 45 phút; mình sẽ báo rõ thời lượng khi xác nhận lịch.",2],
    ["Ngân Hà",5,[5,5,5,5],100,"client",24,"Dáng thẳng hẳn, đồng nghiệp hỏi có phải tập múa không. Lịch linh hoạt theo ca làm của mình.",[4426317]],
  ],
  seed_ductai:[
    ["Minh Khôi",5,[5,4,5,5],15,"client",24,"Tập boxing giảm 6 kg, sung sức hẳn. Anh Tài vui tính nhưng nghiêm khi tập kỹ thuật. Không bị ép sparring.",[],"Khôi đấm combo 1-2-3 giờ chuẩn rồi đó!",1],
    ["Lan Phương",4,[4,3,5,4],42,"client",12,"Buổi tối đông người nên đôi lúc phải chờ bao. Kỹ thuật được hướng dẫn kỹ."],
    ["Tấn Phát",5,[5,5,5,5],66,"trial",1,"Buổi thử miễn phí, được quấn băng tay, học thủ thế, đánh pad 3 hiệp. Rất đã!"],
    ["Bích Ngọc",3,[4,2,4,3],110,"client",8,"Anh dạy hay nhưng hay đổi lịch sát giờ, 3 lần trong 1 tháng. Mong ổn định hơn.",[],"Xin lỗi Ngọc. Tháng đó anh có giải đấu cho học viên; giờ anh chỉ nhận số học viên vừa đủ để giữ lịch cố định.",3],
  ],
  seed_quynhnhu:[
    ["Hồng Nhung",5,[5,5,5,5],9,"client",20,"Như nhiệt tình lắm, tối nào cũng nhắn hỏi bữa ăn. Mông lên form rõ sau 2 tháng hip thrust.",[7690208],"Nhung giỏi quá! Tháng sau mình tăng lên 60 kg nha.",1],
    ["Khánh Huyền",5,[4,5,5,5],33,"trial",1,"Lần đầu vào gym rất ngại, Như hướng dẫn cách dùng từng máy, không ai nhìn mình kỳ quặc cả."],
    ["Thu Hằng",4,[4,5,5,4],51,"client",12,"Giá mềm, PT trẻ nhiệt tình. Kiến thức dinh dưỡng còn hơi chung chung, mong Như học thêm.",[],"Cảm ơn chị Hằng đã góp ý! Em đang học thêm khoá dinh dưỡng thể thao, xong sẽ cập nhật chứng chỉ ạ.",2],
    ["Minh Châu",5,[5,5,5,5],76,"client",24,"Theo được 24 buổi, giảm 5 kg, eo nhỏ 6 cm. Rất đáng tiền ở Đà Nẵng."],
  ],
  seed_giabao:[
    ["Việt Hoàng",5,[5,4,5,5],18,"client",16,"Từ 0 lên 8 cái kéo xà sau 2 tháng. Tập bên biển buổi sáng quá đã.",[],"Mục tiêu tiếp theo: muscle-up nhé Hoàng!",1],
    ["Tom Walker",4,[5,4,4,4],37,"trial",1,"Great outdoor session, Bao speaks good English. Hard to find the spot the first time.",[],"Thanks Tom, I now send a map pin before every first session.",1],
    ["Thanh Hải",4,[4,3,5,4],90,"client",10,"Trời mưa thì chuyển sang tập tại nhà theo video, hơi kém hiệu quả. Còn lại rất ổn."],
  ],
  seed_vanson:[
    ["Đình Trọng",5,[5,4,5,5],20,"client",48,"Anh Sơn kinh nghiệm thật sự, chuẩn bị cho mình thi giải phong trào thành phố, về nhì hạng mục Classic.",[],"Năm sau lên nhất nhé Trọng!",2],
    ["Văn Cường",4,[5,3,4,4],44,"client",24,"Rất giỏi nhưng trả lời tin nhắn chậm, có khi nửa ngày. Trên sàn thì không chê được.",[],"Anh đứng sàn cả ngày nên hay xem tin buổi tối, cảm ơn Cường góp ý. Giờ anh trả lời trong giờ nghỉ trưa.",3],
    ["Hà Anh",5,[5,5,5,5],72,"trial",1,"Buổi thử 150k, được đo thành phần cơ thể và lên giáo án mẫu 1 tuần mang về. Rẻ mà chất."],
    ["Quý Nguyễn",3,[4,3,3,3],140,"client",12,"Phong cách hơi 'old school', ép ăn nhiều ức gà quá. Ai thích bài bản thì hợp.",[],"Cảm ơn Quý. Thực đơn giờ anh có thêm món Việt thay thế (cá, đậu phụ, thịt bò) cho dễ ăn hơn.",5],
  ],
  seed_mailinh:[
    ["Kim Ngân",5,[5,5,5,5],11,"client",24,"Lớp vui cực, nhạc hay. Giảm 4 kg mà không thấy mệt như chạy bộ."],
    ["Thu Ba",5,[4,5,5,5],29,"client",36,"Mình 52 tuổi vẫn theo được, cô Linh luôn có động tác nhẹ hơn cho người lớn tuổi.",[],"Cô Ba là người giữ lửa cho cả lớp đó!",1],
    ["Mỹ Duyên",4,[4,4,5,4],63,"trial",1,"Lớp online tối thứ 3 mạng hơi lag nhưng Linh xử lý nhanh. Rất thân thiện."],
    ["Hoài Thương",5,[5,5,5,5],99,"client",20,"Hết ngại vận động, giờ ngày nào cũng muốn nhảy. Cảm ơn Linh!",[4426318]],
  ],
  seed_thanhtam:[
    ["Phương Thảo",5,[5,5,5,5],14,"client",30,"Ba mình 72 tuổi sau mổ thay khớp gối, cô Tâm đến nhà tập 3 buổi/tuần. Giờ ba tự đi bộ ra chợ được. Cô làm việc với cả bác sĩ điều trị.",[],"Cảm ơn Thảo. Chú tiến bộ là nhờ cả nhà nhắc chú tập bài tại nhà.",1],
    ["Hữu Phước",5,[5,5,5,5],39,"client",20,"Đau thắt lưng 5 năm, tập theo cô 2 tháng đỡ hẳn, không còn phải uống thuốc giảm đau hằng tuần."],
    ["Lệ Quyên",4,[5,5,5,3],82,"trial",1,"Cô đánh giá rất kỹ, nhưng khuyên mình đi khám trước khi tập — hơi mất thời gian nhưng có trách nhiệm.",[],"Với cơn đau lan xuống chân thì khám trước là an toàn nhất chị ạ. Có kết quả mình bắt đầu ngay.",2],
    ["Anh Thư",5,[5,5,5,5],125,"client",12,"Cô nói tiếng Anh nên hướng dẫn được cả mẹ chồng người Úc của mình. Rất chuyên nghiệp."],
  ],
  seed_khanhvy:[
    ["Thu Hương",5,[5,5,5,5],7,"client",12,"Bé nhà mình 6 tuổi sợ nước, sau 10 buổi đã bơi ếch được 15 m. Cô Vy kiên nhẫn và luôn có phao.",[],"Bé dũng cảm lắm chị ơi!",1],
    ["Đăng Khoa",5,[5,5,4,5],31,"client",12,"38 tuổi mới học bơi, xấu hổ lắm nhưng cô Vy dạy riêng vào giờ vắng. Giờ bơi được 50 m."],
    ["Lisa Martin",4,[4,5,5,4],55,"trial",1,"Lovely teacher, the pool was a bit crowded on weekend morning.",[],"Thank you Lisa! Weekday mornings are much quieter.",1],
    ["Minh Tâm",4,[4,4,5,4],108,"client",8,"Bơi biển buổi sáng rất thích, nhưng hay bị huỷ do sóng to — an toàn là đúng nên vẫn 4 sao."],
  ],
  seed_quanghuy:[
    ["Hoàng Nam",5,[5,5,5,5],16,"client",24,"Hoàn thành trail 21 km Đà Lạt lần đầu, không đau gối. Giáo án theo nhịp tim rất khoa học.",[4436347],"Nam về đích cười tươi nhất đoàn!",1],
    ["Thùy Linh",4,[5,4,4,5],48,"client",12,"Anh Huy giỏi, nhưng sáng sớm Đà Lạt lạnh quá, mong có lịch chiều nhiều hơn.",[],"Đã mở thêm lịch chiều T3, T5 rồi Linh nhé.",2],
    ["Khắc Duy",5,[5,5,4,5],86,"trial",1,"Buổi thử miễn phí: test chạy 12 phút, chỉnh tư thế tiếp đất. Học được nhiều."],
  ],
  seed_my:[
    ["Thanh Huyền",5,[5,5,5,5],13,"client",20,"Tập từ tháng thứ 5 thai kỳ đến lúc sinh, đỡ đau lưng hẳn. Chị Mỹ luôn hỏi ý kiến bác sĩ sản của mình trước khi đổi bài.",[],"Chúc mừng em và bé! Sau 6 tuần mình tập phục hồi sàn chậu nhé.",1],
    ["Phương Anh",5,[5,5,5,5],41,"client",16,"Sau sinh 4 tháng, bụng gọn và hết són tiểu khi hắt hơi. Ước gì biết chị sớm hơn."],
    ["Ngọc Diệp",4,[5,4,5,4],77,"trial",1,"Chị rất tâm lý, chỉ là lịch kín nên phải chờ 1 tuần mới có buổi.",[],"Xin lỗi Diệp, chị đã mở thêm lớp online buổi trưa.",2],
    ["Hà My",5,[5,5,5,5],140,"client",24,"Online qua Zoom mà vẫn chỉnh tư thế rất kỹ, có video bài tập gửi sau mỗi buổi."],
  ],
  seed_nhatnam:[
    ["Đức Mạnh",5,[5,4,5,5],19,"client",12,"Giá sinh viên mà dạy tâm huyết. Đá vòng cầu giờ đã đúng kỹ thuật.",[],"Mạnh tập chăm lắm!",1],
    ["Trung Kiên",1,[1,1,1,1],26,"trial",1,"(Nội dung đã bị ẩn)",[],"",0,{ hidden:true, hiddenReason:"Ngôn từ xúc phạm cá nhân, không mô tả trải nghiệm tập luyện", reports:3 }],
    ["Hải Đăng",4,[4,4,4,4],38,"client",8,"Phòng tập hơi nóng buổi chiều, còn lại ổn. Nam nhiệt tình."],
    ["Thảo Nguyên",4,[4,5,5,4],64,"trial",1,"Con gái tập cũng thoải mái, Nam giải thích kỹ cách tự vệ cơ bản."],
  ],
  seed_thuyduong:[
    ["Lan Anh",5,[5,5,5,5],21,"client",36,"Deadlift 80 kg ở tuổi 34! Chị Dương lên giáo án theo chu kỳ, tuần mệt thì giảm tải. Hiểu phụ nữ ghê.",[],"Lan Anh mạnh mẽ lắm, tháng sau thử 90 kg nhé!",1],
    ["Hồng Vân",5,[5,5,5,5],49,"client",24,"Online duyệt video form mỗi tuần, rẻ hơn tập trực tiếp mà vẫn tiến bộ."],
    ["Thu Phương",4,[4,5,5,4],73,"trial",1,"Buổi thử chu đáo. Phòng tập hơi xa nhà mình nên chưa đăng ký gói."],
    ["Bảo Anh",5,[5,5,4,5],115,"client",12,"Người mới toanh vẫn theo được, chị không bao giờ làm mình thấy ngại.",[4428991]],
  ],
  seed_tuankiet:[
    ["Gia Huy",5,[5,5,5,5],17,"client",24,"Buổi 45 phút mà mệt hơn 2 tiếng gym thường. Kettlebell swing chuẩn, hết đau lưng."],
    ["Ngọc Trâm",4,[4,4,5,4],53,"client",12,"Tập tại nhà rất tiện, anh mang đủ tạ. Mong có thêm bài cho người yếu tay.",[],"Đã thêm phần tiến trình dễ hơn cho các bài press rồi Trâm nhé.",2],
    ["Minh Quân",5,[5,5,5,5],97,"trial",1,"Buổi thử online 30 phút qua Zoom mà vẫn chỉnh được tư thế swing. Rất ổn."],
  ],
  seed_baotram:[
    ["Hải Yến",5,[4,5,5,5],9,"client",8,"Trâm mới vào nghề nhưng rất chịu khó, tới nhà đúng giờ, bài tập không gây ồn. Giá quá hợp lý.",[],"Cảm ơn chị đã tin em ạ!",1],
    ["Minh Hằng",4,[3,5,5,4],28,"trial",1,"Nhiệt tình, dễ thương. Kinh nghiệm còn ít nên có câu mình hỏi về dinh dưỡng chưa trả lời được ngay.",[],"Em cảm ơn góp ý ạ, em đã hỏi lại chuyên gia và gửi chị câu trả lời qua tin nhắn.",1],
  ],
  seed_anhdung:[
    ["Trần Quân",5,[5,5,5,5],5,"client",48,"Mình chạy bán chuyên, sau 4 tháng với thầy Dũng thành tích 10 km giảm 3 phút, squat 1,5 lần cân nặng. Buổi nào cũng có số liệu.",[],"Quân kỷ luật nhất nhóm. Mùa giải tới mình nhắm dưới 40 phút nhé.",1],
    ["Mai Hoa",5,[5,5,5,5],27,"client",24,"Đứt dây chằng chéo trước, sau phẫu thuật được thầy phối hợp với bác sĩ để quay lại đá bóng. Đắt nhưng không đâu tốt bằng."],
    ["Đức Huy",4,[5,5,4,4],52,"trial",1,"Buổi thử 800k gồm test FMS, ước tính VO2 và báo cáo PDF. Giá cao, phù hợp ai có mục tiêu thành tích rõ ràng.",[],"Cảm ơn Huy đã mô tả đúng, mình muốn học viên biết rõ trước khi đặt.",1],
    ["Kim Oanh",5,[5,5,5,5],84,"client",36,"Phòng tập chuyên nghiệp, dụng cụ hiện đại, giờ giấc chính xác tới từng phút."],
    ["Văn Toàn",3,[5,5,3,4],150,"client",12,"Chuyên môn 10/10 nhưng thầy khá nghiêm, ít động viên. Người cần động lực tinh thần có thể chưa hợp.",[],"Cảm ơn Toàn, góp ý rất có giá trị. Thầy đang cố gắng phản hồi tích cực hơn sau mỗi buổi.",6],
  ],
  seed_haiyen:[
    ["Emma Reid",5,[5,5,5,5],4,"client",6,"Sunrise yoga on the beach was the highlight of our Phu Quoc trip. Yen adapts every pose to your level.",[],"Thank you Emma, come back soon!",1],
    ["Khánh Ly",5,[5,5,5,5],23,"client",10,"Tập cho cả hai vợ chồng tại villa, chị Yến đến sớm 10 phút chuẩn bị thảm. Thư giãn tuyệt đối."],
    ["Hoàng Phúc",4,[4,5,5,4],46,"trial",1,"Biển đẹp, bài tập nhẹ. Gió to hơi khó giữ thăng bằng — chị đã chuyển sang góc khuất gió."],
    ["Thu Hà",5,[5,5,5,5],81,"client",12,"Về Hà Nội rồi vẫn tập online với chị được. Hết mất ngủ.",[4426296]],
  ],
  seed_minhtri:[
    ["Quốc Huy",5,[5,5,5,5],15,"client",20,"Giảm 5 kg trong 2 tháng, tập sáng bên biển rất có động lực. Trí đúng giờ, vui vẻ.",[],"Huy giữ thói quen chạy biến tốc nha!",1],
    ["Thanh Mai",4,[4,4,5,4],44,"client",12,"Trời nắng sớm nên phải tập từ 5h30. Hơi cực nhưng hiệu quả."],
    ["Đình Phong",3,[3,4,4,3],92,"trial",1,"Buổi thử ổn nhưng bài tập khá chung, chưa thấy cá nhân hoá. Có lẽ cần thêm thời gian.",[],"Cảm ơn Phong, buổi thử mình tập chung để đánh giá; từ buổi 2 giáo án sẽ theo mục tiêu riêng của bạn.",2],
  ],
};
function ts(d){ const [y,m,dd] = String(d).split("-").map(Number); return new Date(y, (m||1)-1, dd||1, 9).getTime(); }
function buildSeeds(at){
  at = at || now();
  const listings = {}, reviews = {};
  SEED_PT.forEach((s, i)=>{
    const cover = { src: PX(s.cover[0], 1000), thumb: PX(s.cover[0], 520), by: s.cover[1], link: PXP(s.cover[0]), px: s.cover[0] };
    listings[s.id] = {
      id: s.id, uid: s.id, seed: true, status:"public", hidden:false,
      name: s.name, brandName: s.brandName, gender: s.gender, years: s.years, prov: s.prov, ward: s.ward, areaHint: s.areaHint,
      specs: s.specs.slice(), langs: s.langs.slice(), bio: s.bio,
      certs: s.certs.map(([name, issuer, year])=> ({ name, issuer, year, img:"" })),
      places: s.places.map(([type, name, note])=> ({ type, name, note: note || "" })),
      prices: Object.assign({}, s.prices), cancel: s.cancel, cancelNote:"",
      avail: Object.assign({}, s.avail),
      cover: cover.src, coverThumb: cover.thumb, coverCredit: { by: cover.by, link: cover.link },
      album: s.album.map(([id, by])=> ({ src: PX(id, 1000), thumb: PX(id, 360), by, link: PXP(id) })),   // QP-23: thumb 360 px (album ngang hồ sơ)
      respN: s.resp[0], respRate: Math.round(s.resp[1] / s.resp[0] * 100), respMins: s.resp[2],
      joinedAt: ts(s.joined), createdAt: ts(s.joined), updatedAt: at - (i % 7 + 2) * DAY, priceUpdatedAt: at - (i % 9 + 5) * DAY,
      verified: !!s.verified, verifiedAt: s.verified ? ts(s.verified) : 0, verifiedBy: s.verified ? "TapEasy (minh hoạ)" : "",
      stats: { students: s.students, sessions: s.sessions }, showPhone:false, phone:"",
    };
    const rv = reviews[s.id] = {};
    (SEED_RV[s.id] || []).forEach((r, j)=>{
      const [name, stars, c, ago, basis, sessions, text, photos, reply, lag, flags] = r;
      const uid = "seed_u_" + hashStr(s.id + name);
      const created = at - ago * DAY - (j * 37 + 11) * 60000;
      rv[uid] = Object.assign({
        id: uid, uid, seed:true, name, stars, criteria:{ expertise:c[0], punctual:c[1], attitude:c[2], results:c[3] }, text,
        photos: arr(photos).map(id=> PX(id, 700)), photoCredits: arr(photos).map(id=> ({ by: RVP[id] || "Pexels", link: PXP(id) })),
        basis:{ type: basis, id:"seed", sessions }, createdAt: created, updatedAt: created,
        reply: reply ? { text: reply, at: created + (lag || 1) * DAY, by: s.id } : null,
        hidden:false, reports:0, flagged:false,
      }, flags ? clone(flags) : {});
      if(rv[uid].hidden){ rv[uid].modBy = "Kiểm duyệt viên TapEasy"; rv[uid].modAt = created + DAY; }
    });
  });
  return { listings, reviews };
}

/* =====================================================================
   5. ĐỘNG CƠ DEMO (localStorage)
   ===================================================================== */
function blank(){ return { v:1, seedV:"", seedAt:0, listings:{}, reviews:{}, reports:{}, requests:{}, feedback:{}, rights:{}, cfg:{} }; }
function dLoad(){ try{ return Object.assign(blank(), JSON.parse(localStorage.getItem(DEMO_KEY) || "{}")); }catch(e){ return blank(); } }
function dSave(db){ localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
function wantSamples(){ if(CFG.samples === true || CFG.samples === false) return CFG.samples; return !isFb(); }
function ensureSeeds(db){
  if(!wantSamples()){
    if(db.seedV){ Object.keys(db.listings).forEach(k=>{ if(db.listings[k].seed){ delete db.listings[k]; delete db.reviews[k]; } }); db.seedV = ""; return true; }
    return false;
  }
  if(db.seedV === SEED_VERSION) return false;
  const at = db.seedAt || now();
  const s = buildSeeds(at);
  Object.keys(s.listings).forEach(id=>{
    const old = db.listings[id] || {};
    db.listings[id] = Object.assign(s.listings[id], { verified: old.verifiedBy && old.verifiedBy !== "TapEasy (minh hoạ)" ? old.verified : s.listings[id].verified, hidden: !!old.hidden, hiddenReason: old.hiddenReason || "" });
    const mine = db.reviews[id] || {};
    db.reviews[id] = Object.assign({}, s.reviews[id], Object.fromEntries(Object.entries(mine).filter(([k, r])=> r && !r.seed)));
  });
  db.seedV = SEED_VERSION; db.seedAt = at;
  return true;
}
function dDb(){ const db = dLoad(); if(ensureSeeds(db)){ try{ dSave(db); }catch(e){} } return db; }
const delay = ms=> new Promise(r=> setTimeout(r, ms == null ? 60 : ms));
const demo = {
  async list(){ const db = dDb(); return Object.entries(db.listings).map(([id, l])=> withAgg(Object.assign(clone(l), { id }), db)); },
  async get(id){ const db = dDb(); const l = db.listings[id]; return l ? withAgg(Object.assign(clone(l), { id }), db) : null; },
  async put(id, doc){ const db = dDb(); db.listings[id] = Object.assign({}, db.listings[id] || {}, clone(doc), { id }); dSave(db); return withAgg(clone(db.listings[id]), db); },
  async patch(id, partial){ const db = dDb(); if(!db.listings[id]) throw err("Niêm yết không còn tồn tại.", "ptdir/not-found"); Object.assign(db.listings[id], clone(partial), { id }); dSave(db); return withAgg(clone(db.listings[id]), db); },
  async del(id){ const db = dDb(); delete db.listings[id]; dSave(db); },
  async reviews(lid){ const db = dDb(); return Object.values(db.reviews[lid] || {}).map(clone); },
  async putReview(lid, uid, doc){ const db = dDb(); db.reviews[lid] = db.reviews[lid] || {}; db.reviews[lid][uid] = Object.assign({}, db.reviews[lid][uid] || {}, clone(doc)); dSave(db); return clone(db.reviews[lid][uid]); },
  async patchReview(lid, uid, partial){ const db = dDb(); const r = (db.reviews[lid] || {})[uid]; if(!r) throw err("Đánh giá không còn tồn tại.", "ptdir/not-found"); Object.assign(r, clone(partial)); dSave(db); return clone(r); },
  async delReview(lid, uid){ const db = dDb(); if(db.reviews[lid]) delete db.reviews[lid][uid]; dSave(db); },
  async report(lid, ruid, by, reason){
    const db = dDb(); const r = (db.reviews[lid] || {})[ruid]; if(!r) throw err("Đánh giá không còn tồn tại.", "ptdir/not-found");
    const key = lid + "/" + ruid; const m = db.reports[key] = db.reports[key] || {};
    if(m[by]) return { already:true, reports: r.reports || 0 };
    m[by] = { reason, at: now() }; r.reports = (r.reports || 0) + 1; r.flagged = true; dSave(db);
    return { already:false, reports: r.reports };
  },
  async reportsOf(lid, ruid){ return Object.entries(dDb().reports[lid + "/" + ruid] || {}).map(([uid, x])=> Object.assign({ uid }, x)); },
  async createReq(lid, doc){ const db = dDb(); db.requests[lid] = db.requests[lid] || {}; const id = rid("q"); db.requests[lid][id] = Object.assign({ id, lid }, clone(doc)); dSave(db); return clone(db.requests[lid][id]); },
  async reqsFor(lid){ return Object.values(dDb().requests[lid] || {}).map(clone); },
  async myReqs(uid){ const db = dDb(); const out = []; Object.keys(db.requests).forEach(lid=> Object.values(db.requests[lid]).forEach(q=>{ if(q.uid === uid) out.push(clone(q)); })); return out; },
  async patchReq(lid, qid, partial){ const db = dDb(); const q = (db.requests[lid] || {})[qid]; if(!q) throw err("Yêu cầu không còn tồn tại.", "ptdir/not-found"); Object.assign(q, clone(partial)); dSave(db); return clone(q); },
  async getReq(lid, qid){ return clone((dDb().requests[lid] || {})[qid] || null); },
  async allReviews(){ const db = dDb(); const out = []; Object.keys(db.reviews).forEach(lid=> Object.values(db.reviews[lid]).forEach(r=> out.push(Object.assign({ lid }, clone(r))))); return out; },
  async getFb(cid){ return clone(dDb().feedback[cid] || null); },
  async putFb(cid, doc){ const db = dDb(); db.feedback[cid] = Object.assign({}, db.feedback[cid] || {}, clone(doc)); dSave(db); return clone(db.feedback[cid]); },
  /* QP-02: quyền đánh giá bền vững reviewRights/{ptUid}_{uid} (Firebase: chỉ Cloud Function ghi) */
  async getRights(ptUid, uid){ return clone((dDb().rights || {})[ptUid + "_" + uid] || null); },
  async putRights(ptUid, uid, doc){ const db = dDb(); db.rights = db.rights || {}; const k = ptUid + "_" + uid, old = db.rights[k] || {};
    const n = Object.assign({}, old, clone(doc)); if(num(old.confirmed) > num(n.confirmed)) Object.assign(n, { confirmed: old.confirmed, done: Math.max(num(old.done), num(n.done)) });
    if(old.first && (!n.first || old.first < n.first)) n.first = old.first; if(old.last && (!n.last || old.last > n.last)) n.last = old.last;
    db.rights[k] = n; dSave(db); return clone(n); },
};
function withAgg(l, db){
  if(!l) return l;
  const g = aggregate(Object.values((db.reviews || {})[l.id] || {}));
  l.ratingAvg = g.avg; l.ratingCount = g.count; l.ratingDist = g.dist; l.criteriaAvg = g.criteria; l.reviewHidden = g.hiddenCount;
  if(!l.seed){ const rs = respStats(Object.values((db.requests || {})[l.id] || {})); l.respRate = rs.rate; l.respMins = rs.mins; l.respN = rs.n; }
  return l;
}

/* =====================================================================
   6. ĐỘNG CƠ FIREBASE
   ===================================================================== */
const L_ = ()=> fdb().collection("ptListings");
const fbe = {
  async list(){
    const pub = qd(await L_().where("status", "==", "public").where("hidden", "==", false).limit(400).get());
    if(!(can("listings.moderate") || can("pt.verify"))) return pub;
    let hid = []; try{ hid = qd(await L_().where("hidden", "==", true).limit(200).get()); }catch(e){}
    return pub.concat(hid);
  },
  async get(id){ return dd(await L_().doc(id).get()); },
  async put(id, doc){ await L_().doc(id).set(clone(doc), { merge:true }); return fbe.get(id); },
  async patch(id, partial){ await L_().doc(id).update(clone(partial)); return fbe.get(id); },
  async del(id){ await L_().doc(id).delete(); },
  async reviews(lid){ return qd(await L_().doc(lid).collection("reviews").limit(300).get()); },
  async putReview(lid, uid, doc){ await L_().doc(lid).collection("reviews").doc(uid).set(clone(doc), { merge:true }); return dd(await L_().doc(lid).collection("reviews").doc(uid).get()); },
  async patchReview(lid, uid, partial){ await L_().doc(lid).collection("reviews").doc(uid).update(clone(partial)); return dd(await L_().doc(lid).collection("reviews").doc(uid).get()); },
  async delReview(lid, uid){ await L_().doc(lid).collection("reviews").doc(uid).delete(); },
  async report(lid, ruid, by, reason){
    const ref = L_().doc(lid).collection("reviews").doc(ruid), mark = ref.collection("reports").doc(by);
    return fdb().runTransaction(async tx=>{
      const [r, m] = await Promise.all([tx.get(ref), tx.get(mark)]);
      if(!r.exists) throw err("Đánh giá không còn tồn tại.", "ptdir/not-found");
      if(m.exists) return { already:true, reports: r.data().reports || 0 };
      const n = (r.data().reports || 0) + 1;
      tx.set(mark, { reason, at: now(), uid: by }); tx.update(ref, { reports: n, flagged: true });   // integrator (FIX-security vòng 2 #4): uid để xoá tài khoản dọn được
      return { already:false, reports: n };
    });
  },
  async reportsOf(lid, ruid){ return qd(await L_().doc(lid).collection("reviews").doc(ruid).collection("reports").get()).map(x=> Object.assign({ uid:x.id }, x)); },
  async createReq(lid, doc){ const ref = await L_().doc(lid).collection("requests").add(clone(doc)); return Object.assign({ id: ref.id, lid }, doc); },
  async reqsFor(lid){ return qd(await L_().doc(lid).collection("requests").orderBy("createdAt", "desc").limit(200).get()).map(q=> Object.assign({ lid }, q)); },
  async myReqs(uid){ const s = await fdb().collectionGroup("requests").where("uid", "==", uid).limit(100).get(); return s.docs.map(d=> Object.assign({ id:d.id, lid: d.ref.parent.parent.id }, d.data())); },
  async patchReq(lid, qid, partial){ await L_().doc(lid).collection("requests").doc(qid).update(clone(partial)); return Object.assign({ lid }, dd(await L_().doc(lid).collection("requests").doc(qid).get())); },
  async getReq(lid, qid){ const d = dd(await L_().doc(lid).collection("requests").doc(qid).get()); return d ? Object.assign({ lid }, d) : null; },
  async allReviews(){ const s = await fdb().collectionGroup("reviews").where("flagged", "==", true).limit(200).get(); return s.docs.map(d=> Object.assign({ id:d.id, lid: d.ref.parent.parent.id }, d.data())); },
  async getFb(cid){ return dd(await fdb().collection("clients").doc(cid).collection("feedback").doc("pt").get()); },
  async putFb(cid, doc){ await fdb().collection("clients").doc(cid).collection("feedback").doc("pt").set(clone(doc), { merge:true }); return fbe.getFb(cid); },
  async getRights(ptUid, uid){ try{ return dd(await fdb().collection("reviewRights").doc(ptUid + "_" + uid).get()); }catch(e){ return null; } },
  async putRights(){ return null; },          // Firebase: Cloud Function onSessionWrite ghi (rules: client không ghi) — xem FIX-pt.md
};
const E = ()=> isFb() ? fbe : demo;
/* Hồ sơ minh hoạ luôn ở kho demo (kể cả khi bật Firebase với samples:true) */
const isSeedId = id=> /^seed_/.test(String(id||""));
const EI = id=> isSeedId(id) ? demo : E();

/* =====================================================================
   7. API CÔNG KHAI — cloud.ptdir
   ===================================================================== */
function adminStatus(l){
  try{ if(G.cloudAdmin && typeof G.cloudAdmin.ptStatus === "function" && l && !l.seed){ const s = G.cloudAdmin.ptStatus(l.uid || l.id) || {}; return s; } }catch(e){}
  return {};
}
function decorate(l){
  if(!l) return l;
  const s = adminStatus(l);
  if(s.verified) l.verified = true;
  if(s.listingHidden) l.hidden = true;
  l.priceFrom = priceFrom(l);
  return l;
}
async function coachCtx(ptUid){
  const u = me(); if(!u) return { uid:null };
  let coaches = [];
  try{
    const list = (await cloud.myCoaches()).filter(c=> c.ptId === ptUid);
    for(const c of list){
      let ss = []; try{ ss = await cloud.listSessions(c.id); }catch(e){}
      const t = trainedStats(ss);
      coaches.push(Object.assign({ id:c.id, ptId:c.ptId }, t));
      if(t.confirmed) try{ await E().putRights(ptUid, u.uid, Object.assign({ ptUid, uid:u.uid, cid:c.id, at: now() }, t)); }catch(e){}
    }
  }catch(e){}
  let rights = null; try{ rights = await E().getRights(ptUid, u.uid); }catch(e){}
  if(isFb() && !rights){   // QP-02/QP-12: nhờ Function claimReviewRights xét lại từ dữ liệu máy chủ (buổi PT xác nhận / buổi thử)
    try{ const res = await callFn("claimReviewRights", { lid: ptUid }); if(res && res.ok) rights = await E().getRights(ptUid, u.uid); }catch(e){}
  }
  return { uid:u.uid, ptUid, coaches, rights, serverOnly: isFb() };
}
/** Lưu quyền đánh giá bền vững khi học viên rời PT / PT xoá form (gọi từ lớp quyền cloud-social) */
async function recordRights(c, sessions){
  c = obj(c); if(!c.ptId || !c.studentUid) return null;
  const t = trainedStats(sessions); if(!t.confirmed) return null;
  return E().putRights(c.ptId, c.studentUid, Object.assign({ ptUid: c.ptId, uid: c.studentUid, cid: c.id || null, at: now() }, t));
}
const sortRv = list=> arr(list).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
/* QP-08: "Học viên · Buổi đã dạy" = form có học viên thật (đang/đã kết nối) + ≥ 1 buổi PT xác nhận; buổi = buổi đã tập của các form đó.
   Tính ở máy PT nên vẫn là số "PT tự khai" cho tới khi Cloud Function ghi stats.verified (lockedKeys) — UI ghi rõ. */
function statsFrom(forms, sessMap){
  let students = 0, sessions = 0;
  arr(forms).forEach(c=>{ c = obj(c); const ss = arr(obj(sessMap)[c.id]);
    if(!(c.studentUid || c.linkedOnce) || !ss.some(confirmedDone)) return;
    students++; sessions += ss.filter(s=> s && s.status === "done").length; });
  return { students, sessions, src:"app", verified:false, at: now() };
}
async function realStats(){
  const map = {}; let forms = [];
  try{ forms = await cloud.myClientsAsPT(); for(const c of forms){ try{ map[c.id] = await cloud.listSessions(c.id); }catch(e){ map[c.id] = []; } } }catch(e){}
  return statsFrom(forms, map);
}
let SEED_CACHE = null;

const api = {
  __v: VERSION,
  get engine(){ return isFb() ? "firebase" : "demo"; },
  config: CFG,
  showsSamples: wantSamples,
  data: { REGIONS, PROVINCES, PROV, SPECS, PLACE_TYPES, CANCEL, CRITERIA, SFB, LANGS, DAYS, SLOTS, KINDS, RSTATUS, REPORT_REASONS, DEFAULT_FILTER },
  logic: { norm, provName, areaText, perSession, priceFrom, priceTo, packSaving, bayes, aggregate, respStats, fmtMins, haystack, filterListings, countFilters,
    matchScore, sortListings, histogram, provinceStats, maskName, initials, validateListing, validateReview, eligibility, basisLabel, moneyVN, moneyK,
    isImgUrl, hashStr, GOAL_SPECS, PRIOR_C, PRIOR_M, pricesFor, priceInfo, confirmedDone, trainedStats, trainedOk, statsFrom },
  seeds(){ if(!SEED_CACHE) SEED_CACHE = buildSeeds(now()); return SEED_CACHE; },
  isSeed: isSeedId,

  /* ---------- Danh bạ ---------- */
  list: wrap(async ()=>{
    let list = [];
    if(isFb()){
      try{ list = await fbe.list(); }catch(e){ if(!wantSamples()) throw e; console.warn("[ptdir] list", e); }
      if(wantSamples()){ const ids = new Set(list.map(l=> l.id)); (await demo.list()).filter(l=> l.seed && !ids.has(l.id)).forEach(l=> list.push(l)); }
    } else list = await demo.list();
    const showHidden = can("listings.moderate") || can("pt.verify");
    const u = me();
    return list.map(decorate).filter(l=> l && (!l.hidden || showHidden || (u && l.uid === u.uid)) && (l.status === "public" || (u && l.uid === u.uid) || showHidden));
  }),
  get: wrap(async id=>{ const l = await EI(id).get(id); return decorate(l); }),
  myListing: wrap(async ()=>{ const u = me(); if(!u) return null; return decorate(await E().get(u.uid)); }),
  saveMyListing: wrap(async (input, opts)=>{
    const u = needUser(); opts = obj(opts);
    const pr = cloud.profile || {};
    if(!pr.isPT) throw err("Bật Chế độ PT (Hồ sơ → Tài khoản) trước khi niêm yết.", "ptdir/not-pt");
    const cur = await E().get(u.uid) || {};
    const d = obj(input);
    const doc = {
      id: u.uid, uid: u.uid, name: str(d.name, 60), brandName: str(d.brandName, 80), gender: d.gender, years: Math.max(0, Math.min(60, Math.round(num(d.years)))),
      specs: arr(d.specs).map(s=> str(s, 40)).filter(Boolean).slice(0, 6), bio: str(d.bio, 800), prov: d.prov, ward: str(d.ward, 80), areaHint: str(d.areaHint, 80),
      places: arr(d.places).map(p=> ({ type: PLACE_TYPES[obj(p).type] ? p.type : "gym", name: str(obj(p).name, 80), note: str(obj(p).note, 120) })).slice(0, 6),
      prices: { single: Math.round(num(obj(d.prices).single)), pack12: Math.round(num(obj(d.prices).pack12)), pack24: Math.round(num(obj(d.prices).pack24)), online: Math.round(num(obj(d.prices).online)),
        trial: obj(d.prices).trial === "" || obj(d.prices).trial == null ? null : Math.round(num(obj(d.prices).trial)) },
      cancel: d.cancel, cancelNote: str(d.cancelNote, 300), langs: arr(d.langs).filter(k=> LANGS[k]).slice(0, 5),
      avail: Object.fromEntries(DAYS.map(k=> [k, String(obj(d.avail)[k] || "").split(",").filter(s=> SLOTS.some(x=> x[0] === s)).join(",")])),
      certs: arr(d.certs).map(c=> ({ name: str(obj(c).name, 120), issuer: str(obj(c).issuer, 120), year: Math.round(num(obj(c).year)) || null, no: str(obj(c).no, 60), img: isImgUrl(obj(c).img) ? c.img : "" })).filter(c=> c.name).slice(0, 6),
      cover: d.cover, coverThumb: d.coverThumb || d.cover, coverCredit: obj(d.coverCredit),
      album: arr(d.album).filter(a=> isImgUrl(obj(a).src)).map(a=> ({ src:a.src, thumb: isImgUrl(a.thumb) ? a.thumb : a.src, by: str(a.by, 80), link: /^https:\/\//.test(String(a.link||"")) ? a.link : "" })).slice(0, 9),
      showPhone: !!d.showPhone, phone: d.showPhone ? str(d.phone || pr.phone, 20) : "",
      status: opts.draft ? "draft" : "public",
      stats: await realStats(),                     // QP-08: tính từ form/buổi thật (không lấy users.stats tự ghi)
      updatedAt: now(),
    };
    const bad = opts.draft ? (doc.name.length < 2 ? "Nhập tên hiển thị (ít nhất 2 ký tự)." : JSON.stringify(doc).length > MAX_LISTING_CHARS ? "Ảnh quá nặng — hãy bớt ảnh album/chứng chỉ rồi lưu lại." : null) : validateListing(doc);
    if(bad) throw err(bad, "ptdir/invalid");
    if(!cur.createdAt){ doc.createdAt = now(); doc.joinedAt = now(); doc.hidden = false; doc.verified = false; }
    if(!cur.priceUpdatedAt || JSON.stringify(cur.prices || {}) !== JSON.stringify(doc.prices)) doc.priceUpdatedAt = now();
    const saved = await E().put(u.uid, doc);
    return decorate(saved);
  }),
  setMyStatus: wrap(async status=>{ const u = needUser(); return decorate(await E().patch(u.uid, { status: status === "draft" ? "draft" : "public", updatedAt: now() })); }),
  deleteMyListing: wrap(async ()=>{ const u = needUser(); await E().del(u.uid); return true; }),
  recordRights: wrap(async (c, sessions)=> recordRights(c, sessions)),
  /** Bản demo: dọn dữ liệu Tìm PT của tài khoản đã xoá (mô phỏng Cloud Function — QP-17 / QS-10) */
  _cleanupUser(uid, forms){
    if(isFb() || !uid) return false;
    const db = dDb();
    delete db.listings[uid]; delete db.reviews[uid]; delete db.requests[uid];
    Object.keys(db.reviews || {}).forEach(lid=>{ if(db.reviews[lid] && db.reviews[lid][uid]) delete db.reviews[lid][uid]; });
    Object.keys(db.requests || {}).forEach(lid=> Object.keys(db.requests[lid] || {}).forEach(qid=>{ if(db.requests[lid][qid] && db.requests[lid][qid].uid === uid) delete db.requests[lid][qid]; }));
    Object.keys(db.reports || {}).forEach(k=>{ if(k.startsWith(uid + "/") || k.endsWith("/" + uid)) delete db.reports[k]; else if(db.reports[k] && db.reports[k][uid]) delete db.reports[k][uid]; });
    Object.keys(db.rights || {}).forEach(k=>{ const r = db.rights[k]; if(r && (r.uid === uid || r.ptUid === uid)) delete db.rights[k]; });
    arr(forms).forEach(cid=>{ if(db.feedback) delete db.feedback[cid]; });
    dSave(db); return true;
  },
  setVerified: wrap(async (id, on, note)=>{
    if(!can("pt.verify")) throw err("Chỉ người có quyền \"Xác minh PT\" mới gắn được huy hiệu.", "ptdir/denied");
    const u = me() || { uid:"admin", name:"Quản trị" };
    const res = await EI(id).patch(id, { verified: !!on, verifiedAt: on ? now() : 0, verifiedBy: on ? (u.name || u.uid) : "", verifyNote: str(note, 300) });
    try{ if(!isSeedId(id) && G.cloudAdmin && typeof G.cloudAdmin.verifyPT === "function") await G.cloudAdmin.verifyPT(res.uid || id, !!on, str(note, 300) || (on ? "Đối chiếu từ Tìm PT" : "Thu hồi từ Tìm PT")); }catch(e){}
    try{ if(G.TE_RBAC && G.TE_RBAC.audit) G.TE_RBAC.audit(on ? "findpt.verify" : "findpt.unverify", { type:"listing", id }, { note: str(note, 200) }); }catch(e){}
    return decorate(res);
  }),
  setHidden: wrap(async (id, on, reason)=>{
    if(!can("listings.moderate")) throw err("Chỉ người có quyền \"Ẩn / hiện niêm yết\" mới làm được.", "ptdir/denied");
    reason = str(reason, 300); if(on && reason.length < 4) throw err("Nhập lý do ẩn (PT sẽ thấy lý do).", "ptdir/reason");
    const u = me() || { uid:"admin" };
    const res = await EI(id).patch(id, { hidden: !!on, hiddenReason: on ? reason : "", hiddenBy: u.uid, hiddenAt: now() });
    try{ if(!isSeedId(id) && G.cloudAdmin && typeof G.cloudAdmin.setListing === "function") await G.cloudAdmin.setListing(res.uid || id, !!on, reason); }catch(e){}
    return decorate(res);
  }),

  /* ---------- Đánh giá ---------- */
  reviews: wrap(async lid=> sortRv(await EI(lid).reviews(lid))),
  summary: wrap(async lid=> aggregate(await EI(lid).reviews(lid))),
  eligibility: wrap(async lid=>{
    const u = me();
    const l = await EI(lid).get(lid);
    const ptUid = l ? (l.uid || lid) : lid;
    if(!u) return eligibility({ uid:null });
    const ctx = isSeedId(lid) ? { uid:u.uid, ptUid } : await coachCtx(ptUid);
    let trials = [];
    try{ trials = (await EI(lid).myReqs(u.uid)).filter(q=> q.lid === lid && q.kind === "trial"); }catch(e){}
    ctx.trials = trials;
    let mine = null; try{ mine = (await EI(lid).reviews(lid)).find(r=> r.uid === u.uid) || null; }catch(e){}
    ctx.existing = mine;
    const res = eligibility(ctx);
    res.existing = mine;
    return res;
  }),
  submitReview: wrap(async (lid, data)=>{
    const u = needUser(); data = obj(data);
    const el = await api.eligibility(lid);
    if(!el.ok) throw err(el.reason, "ptdir/not-eligible");
    const doc = { uid:u.uid, name: str(data.name || u.name, 60), stars: Math.round(num(data.stars)),
      criteria: Object.fromEntries(CRITERIA.map(([k])=> [k, Math.round(num(obj(data.criteria)[k]))])),
      text: str(data.text, MAX_REVIEW), photos: arr(data.photos).slice(0, MAX_PHOTOS), basis: el.basis, updatedAt: now() };
    const bad = validateReview(doc); if(bad) throw err(bad, "ptdir/invalid");
    if(el.existing){
      if(el.existing.hidden) throw err("Đánh giá này đã bị kiểm duyệt ẩn, không sửa được. Liên hệ hỗ trợ nếu bạn cho rằng có nhầm lẫn.", "ptdir/hidden");
      doc.editedAt = now();
      doc.basis = clone(el.existing.basis || doc.basis);                        // rules: basis không đổi khi sửa
      if(el.existing.reply && el.existing.reply.at) doc.editedAfterReply = true;   // §4.10: hiện "đã sửa sau phản hồi của PT"
    }
    else Object.assign(doc, { createdAt: now(), reply:null, hidden:false, reports:0, flagged:false });
    return EI(lid).putReview(lid, u.uid, doc);
  }),
  deleteMyReview: wrap(async lid=>{ const u = needUser(); await EI(lid).delReview(lid, u.uid); return true; }),
  /** PT trả lời công khai (sửa được, KHÔNG xoá được đánh giá) */
  replyReview: wrap(async (lid, ruid, text)=>{
    const u = needUser(); const l = await EI(lid).get(lid);
    if(!l || (l.uid || lid) !== u.uid) throw err("Chỉ PT chủ hồ sơ mới trả lời được.", "ptdir/denied");
    text = str(text, MAX_REPLY); if(text.length < 2) throw err("Nội dung trả lời trống.", "ptdir/empty");
    const bad = profanity(text); if(bad.length) throw err("Trả lời có từ ngữ không phù hợp, hãy giữ giọng lịch sự.", "ptdir/invalid");
    return EI(lid).patchReview(lid, ruid, { reply:{ text, at: now(), by: u.uid } });
  }),
  reportReview: wrap(async (lid, ruid, reason)=>{
    const u = needUser(); reason = str(reason, 300) || "Khác";
    const res = await EI(lid).report(lid, ruid, u.uid, reason);
    try{ if(!res.already && G.cloudAdmin && typeof G.cloudAdmin.report === "function") await G.cloudAdmin.report("review", ruid, reason, { parentId: lid, title: "Đánh giá PT · " + lid }); }catch(e){}
    return res;
  }),
  /** action: "hide" | "restore" | "dismiss" (giữ nguyên, xoá cờ báo cáo) */
  moderateReview: wrap(async (lid, ruid, action, reason)=>{
    if(!can("reviews.moderate")) throw err("Bạn không có quyền kiểm duyệt đánh giá.", "ptdir/denied");
    reason = str(reason, 300);
    if(action === "hide" && reason.length < 4) throw err("Nhập lý do ẩn — lý do được hiển thị công khai.", "ptdir/reason");
    const u = me() || { uid:"admin", name:"Kiểm duyệt viên" };
    const patch = action === "hide" ? { hidden:true, hiddenReason: reason, modBy: u.name || u.uid, modAt: now(), flagged:false }
      : action === "restore" ? { hidden:false, hiddenReason:"", modBy: u.name || u.uid, modAt: now(), flagged:false }
      : { flagged:false, modBy: u.name || u.uid, modAt: now(), modNote: reason || "Giữ nguyên — không vi phạm" };
    const res = await EI(lid).patchReview(lid, ruid, patch);
    try{ if(G.TE_RBAC && G.TE_RBAC.audit) G.TE_RBAC.audit("findpt.review." + action, { type:"review", id: lid + "/" + ruid }, { reason }); }catch(e){}
    return res;
  }),
  reportsOf: wrap(async (lid, ruid)=>{ if(!can("reviews.moderate")) return []; return EI(lid).reportsOf(lid, ruid); }),
  modQueue: wrap(async ()=>{
    if(!can("reviews.moderate")) return [];
    let list = (await demo.allReviews()).filter(r=> r.flagged);
    if(isFb()){ try{ list = list.concat(await fbe.allReviews()); }catch(e){ console.warn("[ptdir] modQueue", e); } }
    return list.sort((a,b)=> (b.reports||0) - (a.reports||0) || (b.createdAt||0) - (a.createdAt||0));
  }),

  /* ---------- Yêu cầu: buổi thử · kết nối · câu hỏi ---------- */
  sendRequest: wrap(async (lid, data)=>{
    const u = needUser(); data = obj(data);
    const l = await EI(lid).get(lid); if(!l) throw err("PT không còn niêm yết.", "ptdir/not-found");
    if((l.uid || lid) === u.uid) throw err("Đây là hồ sơ của chính bạn.", "ptdir/self");
    const kind = KINDS[data.kind] ? data.kind : "question";
    const text = str(data.text, 1000);
    if(kind === "question" && text.length < 5) throw err("Nhập câu hỏi cho PT (ít nhất 5 ký tự).", "ptdir/empty");
    const bad = profanity(text); if(bad.length) throw err("Tin nhắn có từ ngữ không phù hợp.", "ptdir/invalid");
    if(/(\d[\s.-]?){9,}/.test(text) && kind !== "connect") throw err("Chưa nên gửi số điện thoại trước khi PT nhận lời — TapEasy bảo vệ thông tin của bạn.", "ptdir/pii");
    const mine = (await EI(lid).myReqs(u.uid)).filter(q=> q.lid === lid);
    if(mine.filter(q=> q.createdAt > now() - DAY).length >= 5) throw err("Bạn đã gửi 5 yêu cầu cho PT này trong 24 giờ, hãy chờ PT trả lời nhé.", "ptdir/rate");
    if(kind !== "question" && mine.some(q=> q.kind === kind && q.status === "pending")) throw err(kind === "trial" ? "Bạn đã có yêu cầu buổi thử đang chờ PT trả lời." : "Bạn đã gửi lời mời kết nối, đang chờ PT trả lời.", "ptdir/dup");
    if(await blockedBy(l.uid || lid, u.uid)) throw err(BLOCKED_MSG, "ptdir/blocked");          // rules: !blockedBy(lid, me())
    const doc = { uid:u.uid, name: str(u.name, 60) || "Thành viên", kind, status:"pending", createdAt: now(), updatedAt: now(), respondedAt:0,
      msgs: text ? [{ from:u.uid, role:"student", text, ts: now() }] : [] };
    if(kind === "trial"){
      const slot = obj(data.slot); if(!/^\d{4}-\d{2}-\d{2}$/.test(String(slot.date||"")) || !/^\d{2}:\d{2}$/.test(String(slot.time||""))) throw err("Chọn ngày và giờ cho buổi thử.", "ptdir/slot");
      doc.slot = { date: slot.date, time: slot.time }; doc.place = str(data.place, 120); doc.goal = str(data.goal, 200);
    }
    if(kind === "connect"){
      doc.goal = str(data.goal, 200);
      if(data.shareEmail && u.email) doc.email = String(u.email).toLowerCase();
      if(data.card && typeof data.card === "object") doc.card = clone(data.card);
    }
    let q;
    try{ q = await EI(lid).createReq(lid, doc); }
    catch(e){ if(isFb() && e && e.code === "permission-denied") throw err(BLOCKED_MSG + " Nếu không phải vậy, hãy thử lại sau.", "ptdir/blocked"); throw e; }
    if(l.seed) setTimeout(()=>{ seedAutoReply(lid, q).catch(()=>{}); }, Math.max(200, num(CFG.autoReplyMs) || 1600));
    return q;
  }),
  myRequests: wrap(async ()=>{
    const u = me(); if(!u) return [];
    let list = await demo.myReqs(u.uid);
    if(isFb()){ try{ list = list.filter(q=> isSeedId(q.lid)).concat(await fbe.myReqs(u.uid)); }catch(e){ console.warn("[ptdir] myReqs", e); } }
    await warmBlocks();
    return list.filter(q=> !iBlocked(q.lid)).sort((a,b)=> (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0));      // ẩn yêu cầu gửi PT mình đã chặn
  }),
  inbox: wrap(async ()=>{ const u = me(); if(!u) return []; await warmBlocks(); return (await E().reqsFor(u.uid)).filter(q=> !iBlocked(q.uid)).sort((a,b)=> (b.updatedAt||b.createdAt||0) - (a.updatedAt||a.createdAt||0)); }),
  /** PT trả lời: status "accepted" | "declined" | "done" (đã tập buổi thử) + tin nhắn tuỳ chọn */
  respond: wrap(async (lid, qid, data)=>{
    const u = needUser(); data = obj(data);
    if(lid !== u.uid) throw err("Chỉ PT nhận yêu cầu mới trả lời được.", "ptdir/denied");
    const q = await E().getReq(lid, qid); if(!q) throw err("Yêu cầu không còn tồn tại.", "ptdir/not-found");
    const patch = { updatedAt: now() };
    if(data.status){ if(!["accepted","declined","done"].includes(data.status)) throw err("Trạng thái không hợp lệ.", "ptdir/invalid"); patch.status = data.status; }
    // QS-07: chỉ xác nhận "đã tập buổi thử" khi buổi thử đã diễn ra (không cấp quyền đánh giá trước)
    if(data.status === "done" && q.kind === "trial" && q.slot && isDateS(q.slot.date) && q.slot.date > todayISO()) throw err("Buổi thử chưa diễn ra — xác nhận sau ngày " + q.slot.date.split("-").reverse().join("/") + ".", "ptdir/too-early");
    if(!q.respondedAt) patch.respondedAt = now();
    const text = str(data.text, 1000);
    if(text){ const bad = profanity(text); if(bad.length) throw err("Tin nhắn có từ ngữ không phù hợp.", "ptdir/invalid"); patch.msgs = arr(q.msgs).concat([{ from:u.uid, role:"pt", text, ts: now() }]).slice(-30); }
    if(data.clientId) patch.clientId = str(data.clientId, 60);
    return E().patchReq(lid, qid, patch);
  }),
  addMessage: wrap(async (lid, qid, text)=>{
    const u = needUser(); text = str(text, 1000); if(text.length < 1) throw err("Tin nhắn trống.", "ptdir/empty");
    const q = await EI(lid).getReq(lid, qid); if(!q) throw err("Yêu cầu không còn tồn tại.", "ptdir/not-found");
    const role = lid === u.uid ? "pt" : q.uid === u.uid ? "student" : null; if(!role) throw err("Không phải cuộc trao đổi của bạn.", "ptdir/denied");
    const bad = profanity(text); if(bad.length) throw err("Tin nhắn có từ ngữ không phù hợp.", "ptdir/invalid");
    if(role === "student" && await blockedBy(lid, u.uid)) throw err(BLOCKED_MSG, "ptdir/blocked");
    // QS-12: hội thoại CHỈ NỐI THÊM (append-only) — bản gốc lấy lại từ kho, không nhận mảng msgs từ người gọi
    const patch = { msgs: arr(q.msgs).concat([{ from:u.uid, role, text, ts: now() }]).slice(-30), updatedAt: now() };
    if(role === "pt" && !q.respondedAt) patch.respondedAt = now();
    const res = await EI(lid).patchReq(lid, qid, patch);
    if(isSeedId(lid) && role === "student") setTimeout(()=>{ seedAutoReply(lid, res, true).catch(()=>{}); }, Math.max(200, num(CFG.autoReplyMs) || 1600));
    return res;
  }),
  cancelRequest: wrap(async (lid, qid)=>{ const u = needUser(); const q = await EI(lid).getReq(lid, qid); if(!q || q.uid !== u.uid) throw err("Không phải yêu cầu của bạn.", "ptdir/denied"); return EI(lid).patchReq(lid, qid, { status:"cancelled", updatedAt: now() }); }),
  /** Chỉ bản demo + hồ sơ minh hoạ: giả lập "buổi thử đã diễn ra" để thử luồng đánh giá */
  simulateTrialDone: wrap(async (lid, qid)=>{
    if(!isSeedId(lid)) throw err("Chỉ dùng cho hồ sơ minh hoạ.", "ptdir/invalid");
    const u = needUser(); const q = await demo.getReq(lid, qid); if(!q || q.uid !== u.uid) throw err("Không phải yêu cầu của bạn.", "ptdir/denied");
    return demo.patchReq(lid, qid, { status:"done", updatedAt: now(), respondedAt: q.respondedAt || now(), msgs: arr(q.msgs).concat([{ from: lid, role:"pt", text:"(Hồ sơ minh hoạ) Đã xác nhận buổi thử hoàn thành — bạn có thể viết đánh giá.", ts: now() }]) });
  }),

  /* ---------- PT ↔ học viên: nhận xét RIÊNG TƯ ---------- */
  getFeedback: wrap(async cid=> E().getFb(cid)),
  saveFeedback: wrap(async (cid, data)=>{
    const u = needUser(); data = obj(data);
    const c = await cloud.getClient(cid); if(!c || c.ptId !== u.uid) throw err("Chỉ PT của học viên này mới viết nhận xét được.", "ptdir/denied");
    const doc = { by: u.uid, byName: str(u.name, 60), stars: Object.fromEntries(SFB.map(([k])=> [k, int15(obj(data.stars)[k])])), text: str(data.text, 1000), at: now() };
    if(doc.text.length < 10) throw err("Viết nhận xét ít nhất 10 ký tự.", "ptdir/empty");
    const bad = profanity(doc.text); if(bad.length) throw err("Nhận xét có từ ngữ không phù hợp.", "ptdir/invalid");
    return E().putFb(cid, doc);
  }),
  replyFeedback: wrap(async (cid, text)=>{
    const u = needUser(); const c = await cloud.getClient(cid); if(!c || c.studentUid !== u.uid) throw err("Chỉ học viên của form này mới phản hồi được.", "ptdir/denied");
    text = str(text, 1000); if(text.length < 2) throw err("Phản hồi trống.", "ptdir/empty");
    return E().putFb(cid, { reply:{ text, at: now() } });
  }),
  setFeedbackShareable: wrap(async (cid, on)=>{
    const u = needUser(); const c = await cloud.getClient(cid); if(!c || c.studentUid !== u.uid) throw err("Chỉ học viên mới đổi được quyền chia sẻ.", "ptdir/denied");
    return E().putFb(cid, { shareable: !!on });
  }),
  /** Thẻ tóm tắt học viên (chỉ từ nhận xét học viên đã cho phép chia sẻ) — đính kèm khi gửi lời mời kết nối PT mới */
  myStudentCard: wrap(async ()=>{
    const u = me(); if(!u) return null;
    let list = []; try{ list = await cloud.myCoaches(); }catch(e){}
    const fbs = [];
    for(const c of list){ try{ const f = await E().getFb(c.id); if(f && f.shareable) fbs.push(f); }catch(e){} }
    if(!fbs.length) return null;
    const avg = k=> Math.round(fbs.reduce((a,f)=> a + num(obj(f.stars)[k]), 0) / fbs.length * 10) / 10;
    return { n: fbs.length, attendance: avg("attendance"), effort: avg("effort"), comms: avg("comms") };
  }),

  /* ---------- Ảnh: nén JPEG ---------- */
  compressImage(file, opts){
    opts = obj(opts); const max = opts.max || 720, q = opts.q || 0.74;
    return new Promise((resolve, reject)=>{
      if(!file) return reject(err("Chưa chọn ảnh.", "ptdir/empty"));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = ()=>{
        try{
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", q));
        }catch(e){ reject(e); }
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(err("Không đọc được ảnh này.", "ptdir/img")); };
      img.src = url;
    });
  },

  _demo: { load: dLoad, save: dSave, reset(){ try{ localStorage.removeItem(DEMO_KEY); }catch(e){} SEED_CACHE = null; }, buildSeeds, ensureSeeds, KEY: DEMO_KEY },
};

/* Trả lời tự động của hồ sơ MINH HOẠ (bản thử nghiệm) — ghi rõ là tự động */
async function seedAutoReply(lid, q, msgOnly){
  const cur = await demo.getReq(lid, q.id); if(!cur || cur.status === "cancelled") return;
  // QP-15 (fix-pt): yêu cầu đã được xử lý trước (vd. "Đã tập buổi thử") → không ghi đè trạng thái, không chèn trả lời lệch thứ tự
  if(!msgOnly && cur.status !== "pending") return;
  const l = await demo.get(lid); const first = l ? String(l.name).trim().split(/\s+/).slice(-1)[0] : "PT";
  let text, status = cur.status;
  if(msgOnly) text = `(Trả lời tự động · hồ sơ minh hoạ) Mình là ${first}. Cảm ơn bạn đã nhắn! Với PT thật, câu trả lời sẽ hiện ở đây và trong mục "Yêu cầu của tôi".`;
  else if(cur.kind === "trial"){ if(cur.status === "pending") status = "accepted"; text = `(Trả lời tự động · hồ sơ minh hoạ) ${first} xác nhận buổi thử ${cur.slot ? cur.slot.time + " ngày " + cur.slot.date.split("-").reverse().join("/") : ""}. Nhớ mang nước, khăn và giày thể thao nhé!`; }
  else if(cur.kind === "connect"){ if(cur.status === "pending") status = "accepted"; text = `(Trả lời tự động · hồ sơ minh hoạ) Cảm ơn bạn! Đây là PT minh hoạ nên không tạo được form thật. Với PT thật, khi nhận lời PT sẽ gửi mã mời / lời mời để hai bên chat, giao giáo án.`; }
  else text = `(Trả lời tự động · hồ sơ minh hoạ) Cảm ơn câu hỏi của bạn! ${first} thường trả lời trong ${fmtMins(l && l.respMins)}.`;
  await demo.patchReq(lid, q.id, { status, respondedAt: cur.respondedAt || now(), updatedAt: now(), msgs: arr(cur.msgs).concat([{ from: lid, role:"pt", text, ts: now(), auto:true }]) });
  try{ G.dispatchEvent && G.dispatchEvent(new CustomEvent("ptdir:request", { detail:{ lid, qid: q.id } })); }catch(e){}
}

try{ cloud.ptdir = api; }catch(e){ try{ Object.defineProperty(cloud, "ptdir", { value: api, configurable:true }); }catch(_){} }
})(typeof window !== "undefined" ? window : globalThis);
