/* =========================================================================
   TapEasy — Cloud Functions THƯƠNG MẠI & THI ĐUA (functions/commerce.js) · vòng sửa bảo mật 11/2026
   "Máy chủ quyết": giá đơn, tồn kho, voucher, điểm, tiến độ thi đua, check-in (QS-08, QS-09, QC-01…QC-08, QC-19).
   firestore.rules chặn client ghi thẳng các trường này (orders create: false, entries.value, regs checked_in, vouchers.used, points/*).

   Callable (asia-southeast1) — client gọi qua cloud.fn(name, data) (cloud.js):
     createOrder            { items[{pid,color,size,qty}], ship, payment, voucherCode?, address{}, note? } → đơn giá máy chủ
     redeemPoints           { rewardId }                       → trừ điểm (transaction) + voucher cá nhân dùng 1 lần
     myPoints               {}                                 → { balance, tx[] }
     recordChallengeProgress{ challengeId, daily{date:v}, manual{date:v}?, baseline? } → value có trần, chỉ khi thử thách đang mở
     settleChallenge        { challengeId }  (challenges.manage) → xếp hạng, cộng điểm hoàn thành / hạng, tạo quà top N
     checkInEvent           { eventId, code }                  → khung giờ + mã băm / mã xoay vòng 60 giây + cộng điểm
     checkinCodeNow         { eventId }      (events.checkin)  → mã xoay vòng hiện tại cho màn hình tại sự kiện
     placeOrder / claimVoucher / registerEvent — tên & payload cloud-events.js đang gọi (callFn) — cùng logic máy chủ ở trên
     (vòng 2) claimVoucher giữ chỗ 30 phút (voucherHolds) · claimChallengeVoucher { challengeId } → voucher 15 % hoàn thành (ngoài quà top)
     · myVouchers {} → voucher cá nhân còn dùng được (đổi điểm / thử thách)
   Trigger:
     orderStockSync   orders/{id}                         → huỷ đơn: hoàn kho + hoàn lượt voucher đúng 1 lần (QC-07)
     regCountAgg      events/{id}/regs/{uid}              → regCount (rules kiểm còn chỗ — QC-19)
     commentCountHeal events/{id}/reviews/{rid}/mcomments → đếm lại commentCount (QS-19)
     reviewCountHeal  events/{id}/reviews/{rid}           → commentCount bị sửa lệch → đếm lại; review mới → cộng điểm review
     routineReportHeal routines/{rid}/reports/{uid}       → ẩn khi ≥ 3 báo cáo từ tài khoản ≥ 7 ngày tuổi (QS-19 / QC-14)
     momentReportHeal  events/{id}/reviews/{rid}/mreports/{uid} → (vòng 2) trọng số báo cáo Khoảnh khắc (tài khoản ≥ 3 ngày) + tự ẩn khi ≥ 3
   Hàm thuần (kiểm thử Node, tests/suites/65-fix-security.test.js): exports._commerceTest
   ========================================================================= */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const A = require("./admin")._adminTest;

const REGION = "asia-southeast1";
const DAY = 864e5, TZ_MS = 7 * 3600e3;                    // giờ Việt Nam (UTC+7) — ngày thử thách / sự kiện tính theo giờ VN
const db = ()=> admin.firestore();
const nowMs = ()=> Date.now();
const str = (s, n)=> String(s == null ? "" : s).trim().slice(0, n || 300);
const arr = a=> Array.isArray(a) ? a : [];
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const round1 = x=> Math.round(x * 10) / 10;
const p2 = n=> String(n).padStart(2, "0");
const vnDay = ms=>{ const d = new Date((ms == null ? nowMs() : ms) + TZ_MS); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
const isDs = s=> typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dsMs = s=> Date.parse(s + "T00:00:00Z") - TZ_MS;  // 00:00 giờ VN của ngày s
const addDays = (s, n)=> vnDay(dsMs(s) + n * DAY + 3600e3);
const diffD = (a, b)=> Math.round((dsMs(b) - dsMs(a)) / DAY);
const mondayOf = s=>{ const d = new Date(Date.parse(s + "T12:00:00Z")); const wd = (d.getUTCDay() + 6) % 7; return addDays(s, -wd); };
const weekKey = s=>{ const d = new Date(Date.parse(s + "T12:00:00Z")); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); const y = d.getUTCFullYear();
  const w = 1 + Math.floor(Math.round((d - Date.UTC(y, 0, 1, 12)) / DAY) / 7); return `${y}-W${p2(w)}`; };
/** "2026-11-20T07:30" (giờ VN, như events.js isoToTs) → ms */
const isoVN = iso=>{ const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); if(!m) return NaN; return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) - TZ_MS; };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randCode = n=> Array.from(crypto.randomBytes(n), b=> CODE_CHARS[b % CODE_CHARS.length]).join("");
const sha256 = s=> crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
function safeEqual(a, b){ const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest(); return crypto.timingSafeEqual(x, y); }
function needAuth(request){ const a = request.auth; if(!a || !a.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập."); return a; }
async function notBanned(uid){
  const b = await db().collection("bans").doc(uid).get();
  if(b.exists){ const d = b.data() || {}; const until = d.until && typeof d.until.toMillis === "function" ? d.until.toMillis() : Number(d.until) || 0;
    if(!d.liftedAt && (!until || until > nowMs())) throw new HttpsError("permission-denied", "Tài khoản đang bị khoá."); }
}

/* =====================================================================
   1. GIÁ ĐƠN HÀNG (thuần) — đồng bộ shop.js totals()/stockOf()/REDEEM
   ===================================================================== */
const SHOP_DEFAULT = { shippingFee: 30000, freeShipFrom: 499000, expressFee: 45000 };
const EXPRESS_OK = ["Hà Nội", "TP. Hồ Chí Minh"];
const REDEEM = [
  { id:"ship", cost:200,  kind:"ship",   value:30000,  title:"Miễn phí giao hàng", sub:"Tối đa 30.000 ₫" },
  { id:"a20",  cost:400,  kind:"amount", value:20000,  min:150000, title:"Giảm 20.000 ₫", sub:"Đơn từ 150.000 ₫" },
  { id:"a50",  cost:800,  kind:"amount", value:50000,  min:250000, title:"Giảm 50.000 ₫", sub:"Đơn từ 250.000 ₫" },
  { id:"p15",  cost:1500, kind:"pct",    value:15, max:100000, title:"Giảm 15%", sub:"Tối đa 100.000 ₫" },
  { id:"a120", cost:2500, kind:"amount", value:120000, min:300000, title:"Giảm 120.000 ₫", sub:"Đơn từ 300.000 ₫" },
];
const VK = (c, z)=> String(c || "") + "|" + String(z || "");
function stockOf(p, color, size){
  p = obj(p);
  if(p.stockBy && typeof p.stockBy === "object"){ const k = VK(color, size); return k in p.stockBy ? Math.max(0, Number(p.stockBy[k]) || 0) : (arr(p.sizes).length || arr(p.colors).length > 1 ? 0 : Math.max(0, Number(p.stock) || 0)); }
  return typeof p.stock === "number" ? Math.max(0, p.stock) : Infinity;   // sản phẩm không quản lý tồn kho
}
/** Chuẩn hoá voucher (admin: percent/amount/freeship · đổi điểm: pct/amount/ship) */
function normVoucher(v){
  if(!v) return null; v = obj(v);
  const kind = v.kind === "percent" || v.kind === "pct" ? "pct" : v.kind === "freeship" || v.kind === "ship" ? "ship" : "amount";
  return { code: str(v.code, 20), kind, value: Number(v.value) || 0, min: Number(v.min) || 0, max: Number(v.cap || v.max) || 0, title: str(v.title, 60) };
}
/* Vòng 2 (FIX-commerce §2 #4c): giữ chỗ mã 30 phút khi "Áp dụng" — voucherHolds/{code}_{uid} { code, uid, at, exp }.
   Lượt còn lại = uses − used − (giữ chỗ CÒN HẠN của NGƯỜI KHÁC) → mã uses:1 không báo "áp dụng thành công" ở nhiều giỏ. */
const HOLD_MS = 30 * 60e3;
const tsMs = v=> v && typeof v.toMillis === "function" ? v.toMillis() : (Number(v) || 0);
/** Thuần: số lượt còn cho uid (tính giữ chỗ còn hạn của người khác) */
function voucherAvailable(v, holds, uid, at){
  const others = arr(holds).filter(h=> h && h.uid !== uid && tsMs(h.exp) > at).length;
  return (Number(v && v.uses) || 1) - (Number(v && v.used) || 0) - others;
}
/** Voucher còn dùng được cho uid? → null = được; chuỗi = lý do */
function voucherProblem(v, uid, today){
  if(!v) return "Mã không tồn tại.";
  if(v.revoked) return "Mã đã bị thu hồi.";
  if(v.exp && String(v.exp) < today) return "Mã đã hết hạn.";
  if((Number(v.used) || 0) >= (Number(v.uses) || 1)) return "Mã đã hết lượt dùng.";
  if(v.owner && v.owner !== uid) return "Mã này thuộc tài khoản khác.";
  return null;
}
/**
 * Tính đơn từ dữ liệu MÁY CHỦ. items: [{pid,color,size,qty}] (client chỉ chọn món & số lượng).
 * → { lines, subtotal, shipping, discount, total, stock: {pid: {key: qty}}, vErr }  · ném lỗi tiếng Việt khi không hợp lệ.
 */
function priceOrder(items, products, settings, voucher, ship){
  const cfg = Object.assign({}, SHOP_DEFAULT, obj(settings));
  items = arr(items);
  if(!items.length) throw new HttpsError("invalid-argument", "Giỏ hàng trống.");
  if(items.length > 20) throw new HttpsError("invalid-argument", "Tối đa 20 dòng sản phẩm / đơn.");
  const merged = new Map();
  items.forEach(it=>{
    it = obj(it);
    const qty = Number(it.qty);
    if(!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpsError("invalid-argument", "Số lượng mỗi món từ 1 đến 10.");   // QC-06: chặn SL âm / thập phân
    const pid = str(it.pid, 80), color = str(it.color, 40), size = str(it.size, 20), k = pid + "§" + VK(color, size);
    const cur = merged.get(k); if(cur){ cur.qty += qty; if(cur.qty > 10) throw new HttpsError("invalid-argument", "Số lượng mỗi món từ 1 đến 10."); }
    else merged.set(k, { pid, color, size, qty });
  });
  const lines = [], stock = {};
  let subtotal = 0;
  for(const it of merged.values()){
    const p = obj(products[it.pid]);
    if(!products[it.pid] || p.deleted || p.hidden) throw new HttpsError("failed-precondition", "Có sản phẩm không còn bán — tải lại giỏ hàng.");
    const colors = arr(p.colors), sizes = arr(p.sizes);
    const col = colors.length ? colors.find(c=> c && c.id === it.color) : null;
    if(colors.length && !col) throw new HttpsError("invalid-argument", `Màu không hợp lệ: ${p.name || it.pid}.`);
    if(sizes.length && !sizes.includes(it.size)) throw new HttpsError("invalid-argument", `Size không hợp lệ: ${p.name || it.pid}.`);
    const price = Math.round(Number(p.price) || 0);
    if(!(price > 0)) throw new HttpsError("failed-precondition", `Sản phẩm chưa có giá: ${p.name || it.pid}.`);
    const have = stockOf(p, it.color, it.size), k = VK(it.color, it.size);
    const want = (stock[it.pid] && stock[it.pid][k] || 0) + it.qty;
    if(want > have) throw new HttpsError("failed-precondition", `${p.name || it.pid}${it.size ? " · " + it.size : ""}: chỉ còn ${have === Infinity ? "—" : have}.`);
    if(have !== Infinity){ stock[it.pid] = stock[it.pid] || {}; stock[it.pid][k] = want; }
    subtotal += price * it.qty;
    lines.push({ pid: it.pid, name: str(p.name, 120), color: it.color, colorName: col ? str(col.name, 40) : "", size: it.size, qty: it.qty, price,
      img: /^assets\//.test(String(p.img || "")) ? String(p.img) : "" });
  }
  const express = ship === "express";
  const shipFee = express ? (Number(cfg.expressFee) || 45000) : (Number(cfg.shippingFee) || 0);
  const freeFrom = express ? Infinity : (Number(cfg.freeShipFrom) || Infinity);
  const shipping = subtotal >= freeFrom ? 0 : shipFee;
  let discount = 0, vErr = "";
  const v = normVoucher(voucher);
  if(v){
    if(subtotal < v.min) vErr = `Đơn tối thiểu ${v.min.toLocaleString("vi-VN")} ₫ để dùng mã này.`;
    else if(v.kind === "ship"){ discount = Math.min(shipping, v.value || shipping); if(!shipping) vErr = "Đơn đã được miễn phí giao hàng."; }
    else if(v.kind === "amount") discount = Math.min(v.value, subtotal);
    else discount = Math.min(Math.round(subtotal * v.value / 100), v.max || Infinity, subtotal);
  }
  discount = Math.max(0, Math.round(discount));
  return { lines, subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount), stock, vErr, voucher: v };
}
function cleanAddress(a){
  a = obj(a);
  const out = { name: str(a.name, 80), phone: str(a.phone, 20), province: str(a.province, 80), district: str(a.district, 80), ward: str(a.ward, 80),
    line: str(a.line || a.street || a.address, 200), note: str(a.note, 300) };
  if(out.name.length < 2) throw new HttpsError("invalid-argument", "Nhập tên người nhận.");
  if(!/^\+?[0-9 .]{8,15}$/.test(out.phone)) throw new HttpsError("invalid-argument", "Số điện thoại người nhận chưa đúng.");
  if(!out.province || !out.line) throw new HttpsError("invalid-argument", "Nhập đủ địa chỉ giao hàng.");
  return out;
}
function applyStockDelta(p, perKey, sign){
  if(!p.stockBy || typeof p.stockBy !== "object"){
    if(typeof p.stock !== "number") return null;
    const n = Object.values(perKey).reduce((a, q)=> a + q, 0);
    return { stock: Math.max(0, p.stock + sign * n) };
  }
  const sb = Object.assign({}, p.stockBy);
  Object.keys(perKey).forEach(k=>{ sb[k] = Math.max(0, (Number(sb[k]) || 0) + sign * perKey[k]); });
  return { stockBy: sb, stock: Object.values(sb).reduce((a, x)=> a + (Number(x) || 0), 0) };
}

/** Payload của cloud-events.js (callFn "placeOrder": payVia / shipMethod / voucher{code}) → dạng createOrder (thuần) */
function normOrderInput(d){
  d = obj(d);
  return Object.assign({}, d, {
    ship: d.ship || d.shipMethod, payment: d.payment || d.payVia,
    voucherCode: d.voucherCode || (d.voucher && typeof d.voucher === "object" ? d.voucher.code : d.voucher) || "",
  });
}
async function createOrderFor(uid, d){
  await notBanned(uid);
  await A.rateLimit(`${uid}_order`, 20, 3600);
  d = normOrderInput(d);
  const ship = d.ship === "express" ? "express" : "standard";
  const payVia = ["cod", "bank", "vietqr"].includes(d.payment) ? d.payment : "cod";
  const address = cleanAddress(d.address);
  if(ship === "express" && !EXPRESS_OK.includes(address.province)) throw new HttpsError("invalid-argument", "Hoả tốc chỉ áp dụng nội thành Hà Nội, TP. Hồ Chí Minh.");
  const code = str(d.voucherCode, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const pids = Array.from(new Set(arr(d.items).map(i=> str(obj(i).pid, 80)).filter(Boolean))).slice(0, 20);
  const today = vnDay();
  const orderRef = db().collection("orders").doc();
  const out = await db().runTransaction(async tx=>{
    const pRefs = pids.map(id=> db().collection("products").doc(id));
    const pSnaps = await Promise.all(pRefs.map(r=> tx.get(r)));
    const products = {}; pSnaps.forEach((s, i)=>{ if(s.exists) products[pids[i]] = s.data(); });
    const st = await tx.get(db().collection("settings").doc("public"));
    let vRef = null, vDoc = null, useRef = null, holdRef = null;
    if(code){
      vRef = db().collection("vouchers").doc(code); const vs = await tx.get(vRef); vDoc = vs.exists ? vs.data() : null;
      const why = voucherProblem(vDoc, uid, today); if(why) throw new HttpsError("failed-precondition", why);
      useRef = db().collection("voucherUses").doc(`${code}_${uid}`);
      if((await tx.get(useRef)).exists) throw new HttpsError("failed-precondition", "Bạn đã dùng mã này rồi.");
      holdRef = db().collection("voucherHolds").doc(`${code}_${uid}`);
      const hs = await tx.get(db().collection("voucherHolds").where("code", "==", code));
      if(voucherAvailable(vDoc, hs.docs.map(x=> x.data()), uid, nowMs()) <= 0) throw new HttpsError("failed-precondition", "Mã đang được giữ chỗ cho giỏ hàng khác — thử lại sau 30 phút hoặc bỏ mã.");
    }
    const t = priceOrder(d.items, products, st.exists ? st.data() : {}, vDoc ? Object.assign({ code }, vDoc) : null, ship);
    if(code && (t.vErr || !t.discount)) throw new HttpsError("failed-precondition", t.vErr || "Mã không áp dụng được cho đơn này.");
    Object.keys(t.stock).forEach((pid, i)=>{ const delta = applyStockDelta(products[pid], t.stock[pid], -1); if(delta) tx.update(pRefs[pids.indexOf(pid)], Object.assign(delta, { updatedAt: nowMs() })); });
    if(vRef){ tx.update(vRef, { used: (Number(vDoc.used) || 0) + 1, lastUsedAt: nowMs() }); tx.set(useRef, { code, uid, order: orderRef.id, at: nowMs() }); tx.delete(holdRef); }
    const status = payVia === "cod" ? "pending" : "awaiting_payment";
    const dt = new Date(nowMs() + TZ_MS);
    const order = { code: `TE${p2(dt.getUTCDate())}${p2(dt.getUTCMonth() + 1)}-${randCode(4)}`, uid, name: address.name, items: t.lines,
      subtotal: t.subtotal, shipping: t.shipping, discount: t.discount, total: t.total, voucher: t.voucher && t.discount ? { code: t.voucher.code, title: t.voucher.title } : null,
      payment: payVia === "cod" ? "cod" : "bank", payVia, shipMethod: ship, address, note: str(d.note || address.note, 300),
      status, history: [{ s: status, ts: nowMs(), by: "system" }], stockApplied: true, pricedBy: "server", createdAt: nowMs(), updatedAt: nowMs() };
    tx.set(orderRef, order);
    return order;
  });
  return Object.assign({ id: orderRef.id }, out);
}
exports.createOrder = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 30 }, async (request)=> createOrderFor(needAuth(request).uid, request.data));
/* Tên gọi mà cloud-events.js (fixer commerce) dùng: lỗi nghiệp vụ trả { rejected } thay vì ném "not-found"
   (callFn coi not-found / internal là "Function chưa triển khai" và rơi về ghi thẳng — rules đã chặn). */
exports.placeOrder = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 30 }, async (request)=>{
  const a = needAuth(request);
  try{ return await createOrderFor(a.uid, request.data); }
  catch(e){ if(e instanceof HttpsError && e.code !== "unauthenticated") return { rejected: true, code: e.code, error: e.message }; throw e; }
});
/* Kiểm mã + GIỮ CHỖ 30 phút (vòng 2 — FIX-commerce §2 #4c). KHÔNG trừ lượt: createOrder trừ trong transaction và xoá giữ chỗ.
   Giữ chỗ hết hạn của mã được dọn ngay trong transaction này. claimId = id giữ chỗ (client gửi lại khi đặt — không bắt buộc). */
exports.claimVoucher = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 15 }, async (request)=>{
  const a = needAuth(request);
  await A.rateLimit(`${a.uid}_vcheck`, 60, 3600);                      // chống dò mã
  const code = str(obj(request.data).code, 20).toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if(!code) return { ok: false, error: "Nhập mã giảm giá." };
  const vRef = db().collection("vouchers").doc(code), useRef = db().collection("voucherUses").doc(`${code}_${a.uid}`);
  const holdRef = db().collection("voucherHolds").doc(`${code}_${a.uid}`), at = nowMs();
  return db().runTransaction(async tx=>{
    const [vs, us] = [await tx.get(vRef), await tx.get(useRef)];
    const v = vs.exists ? vs.data() : null;
    const why = us.exists ? "Bạn đã dùng mã này rồi." : voucherProblem(v, a.uid, vnDay(at));
    if(why) return { ok: false, error: why };
    const hs = await tx.get(db().collection("voucherHolds").where("code", "==", code));
    if(voucherAvailable(v, hs.docs.map(x=> x.data()), a.uid, at) <= 0) return { ok: false, error: "Mã đang được giữ chỗ cho giỏ hàng khác hoặc đã hết lượt — thử lại sau 30 phút." };
    hs.docs.forEach(x=>{ const h = x.data() || {}; if(h.uid !== a.uid && tsMs(h.exp) <= at) tx.delete(x.ref); });
    tx.set(holdRef, { code, uid: a.uid, at, exp: at + HOLD_MS });
    const n = normVoucher(Object.assign({ code }, v));
    return { ok: true, server: true, claimId: holdRef.id, holdUntil: at + HOLD_MS, code, voucher: { code, kind: n.kind, value: n.value, min: n.min, max: n.max, title: n.title } };
  });
});

/* Huỷ đơn → hoàn kho + hoàn lượt voucher ĐÚNG 1 LẦN (QC-07: đơn huỷ là trạng thái cuối — rules chặn mở lại) */
exports.orderStockSync = onDocumentWritten({ document: "orders/{id}", region: REGION, maxInstances: 5 }, async (event)=>{
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if(!after || after.status !== "cancelled" || (before && before.status === "cancelled") || !after.stockApplied || after.stockRestored) return;
  const ref = event.data.after.ref;
  await db().runTransaction(async tx=>{
    const cur = await tx.get(ref); const o = cur.data() || {}; if(o.stockRestored) return;
    const per = {}; arr(o.items).forEach(it=>{ const q = Math.max(0, Math.round(Number(it.qty) || 0)); if(!q) return; per[it.pid] = per[it.pid] || {}; const k = VK(it.color, it.size); per[it.pid][k] = (per[it.pid][k] || 0) + q; });
    const refs = Object.keys(per).map(pid=> db().collection("products").doc(pid));
    const snaps = await Promise.all(refs.map(r=> tx.get(r)));
    let vSnap = null, vRef = null;
    const unconfirmed = before && ["pending", "awaiting_payment"].includes(before.status);
    if(o.voucher && o.voucher.code && unconfirmed){ vRef = db().collection("vouchers").doc(o.voucher.code); vSnap = await tx.get(vRef); }
    snaps.forEach((s, i)=>{ if(!s.exists) return; const delta = applyStockDelta(s.data(), per[refs[i].id], +1); if(delta) tx.update(refs[i], Object.assign(delta, { updatedAt: nowMs() })); });
    if(vSnap && vSnap.exists){ tx.update(vRef, { used: Math.max(0, (Number(vSnap.data().used) || 0) - 1) }); tx.delete(db().collection("voucherUses").doc(`${o.voucher.code}_${o.uid}`)); }
    tx.update(ref, { stockRestored: true, stockRestoredAt: nowMs() });
  });
});

/* =====================================================================
   2. TAPEASY POINTS — sổ điểm máy chủ (QC-02). points/{uid} { balance } · points/{uid}/tx/{ref} { delta, reason, ref, ts }
   ===================================================================== */
const refId = ref=> String(ref || "").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 140) || ("r" + nowMs().toString(36));
/** Cộng / trừ điểm idempotent theo ref (trong transaction có sẵn hoặc tự mở) → true nếu ghi mới */
async function awardPoints(uid, delta, ref, reason, txIn){
  delta = Math.round(Number(delta) || 0); if(!delta || !uid) return false;
  const pRef = db().collection("points").doc(uid), tRef = pRef.collection("tx").doc(refId(ref));
  const run = async tx=>{
    const [p, t] = [await tx.get(pRef), await tx.get(tRef)];
    if(t.exists) return false;
    const bal = p.exists ? Number(p.data().balance) || 0 : 0;
    if(delta < 0 && bal + delta < 0) throw new HttpsError("failed-precondition", `Chưa đủ điểm (cần ${-delta}, đang có ${bal}).`);
    tx.set(pRef, { balance: bal + delta, updatedAt: nowMs() }, { merge: true });
    tx.set(tRef, { delta, reason: str(reason, 120), ref: str(ref, 140), ts: nowMs() });
    return true;
  };
  return txIn ? run(txIn) : db().runTransaction(run);
}
exports.myPoints = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 15 }, async (request)=>{
  const a = needAuth(request);
  const p = await db().collection("points").doc(a.uid).get();
  const tx = await db().collection("points").doc(a.uid).collection("tx").orderBy("ts", "desc").limit(100).get();
  return { balance: p.exists ? Number(p.data().balance) || 0 : 0, tx: tx.docs.map(x=> Object.assign({ id: x.id }, x.data())) };
});
exports.redeemPoints = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 20 }, async (request)=>{
  const a = needAuth(request); await notBanned(a.uid);
  await A.rateLimit(`${a.uid}_redeem`, 20, 86400);
  const r = REDEEM.find(x=> x.id === obj(request.data).rewardId);
  if(!r) throw new HttpsError("invalid-argument", "Phần quà đổi điểm không hợp lệ.");
  const code = "TE-" + randCode(8), exp = addDays(vnDay(), 60);
  const voucher = { code, kind: r.kind, value: r.value, min: r.min || 0, max: r.max || 0, uses: 1, used: 0, owner: a.uid, exp, title: r.title, sub: r.sub, src: "points", revoked: false, at: nowMs() };
  await db().runTransaction(async tx=>{
    await awardPoints(a.uid, -r.cost, `redeem_${code}`, `Đổi điểm: ${r.title}`, tx);
    tx.set(db().collection("vouchers").doc(code), voucher);
  });
  return voucher;
});

/* =====================================================================
   3. THI ĐUA — tiến độ có trần, chỉ khi thử thách đang mở (QS-09, QC-01, QC-04, QC-05)
   ===================================================================== */
const DAILY_CAP = { sessions: 2, run_km: 60, water_days: 1, food_days: 1, sleep_days: 1, manual: 1000 };
const GRACE_DAYS = 1;                                      // đồng bộ lần cuối tới hết ngày end + 1 (chỉ tính ngày ≤ end)
/**
 * Thuần: tính tiến độ máy chủ từ bảng ngày client gửi.
 * ch {metric, start, end, target}, daily {YYYY-MM-DD: v}, manual {YYYY-MM-DD: v}, entry (bản ghi hiện có: baseline…), today (YYYY-MM-DD giờ VN)
 */
function computeProgress(ch, daily, manual, entry, today){
  ch = obj(ch); entry = obj(entry);
  if(!isDs(ch.start) || !isDs(ch.end)) throw new HttpsError("failed-precondition", "Thử thách thiếu ngày bắt đầu/kết thúc.");
  if(today < ch.start) throw new HttpsError("failed-precondition", "Thử thách chưa bắt đầu.");
  if(today > addDays(ch.end, GRACE_DAYS)) throw new HttpsError("failed-precondition", "Thử thách đã kết thúc — không ghi thêm tiến độ.");
  const to = today < ch.end ? today : ch.end, from = ch.start;
  const metric = ch.metric in DAILY_CAP || ch.metric === "weight_loss" ? ch.metric : "manual";
  const days = {}; let manualSum = 0;
  const take = (src, isManual)=> Object.keys(obj(src)).slice(0, 400).forEach(dk=>{
    if(!isDs(dk) || dk < from || dk > to) return;                       // bỏ ngày ngoài kỳ / tương lai
    const v = Number(src[dk]); if(!(v > 0) || !isFinite(v)) return;
    days[dk] = round1((days[dk] || 0) + v); if(isManual) manualSum += v;
  });
  take(daily, false); take(manual, true);
  let value, weekValue, capped = false;
  const wk0 = mondayOf(to) < from ? from : mondayOf(to);
  if(metric === "weight_loss"){
    const base = Number(entry.baseline) || 0;
    if(!(base >= 30 && base <= 250)) throw new HttpsError("failed-precondition", "Thiếu cân mốc hợp lệ (30–250 kg) — nhập lại lúc tham gia.");
    const bDate = isDs(entry.baselineDate) && entry.baselineDate > from ? entry.baselineDate : from;
    const weeks = Math.max(1, (diffD(bDate, to) + 1) / 7);
    const cap = Math.floor(base * 0.01 * weeks * 10 + 1e-9) / 10;
    const ks = Object.keys(days).sort(); const last = ks.length ? Math.max(0, days[ks[ks.length - 1]]) : 0;
    const raw = Math.min(last, base * 0.3);                            // không thể giảm > 30 % cân trong 1 kỳ
    value = Math.min(raw, cap); capped = raw > cap + 0.05;
    const weekCap = Math.floor(base * 0.01 * 10 + 1e-9) / 10;
    const prev = ks.filter(k=> k < wk0).pop();
    weekValue = Math.min(Math.max(0, last - (prev ? days[prev] : 0)), weekCap);
  } else {
    const cap = DAILY_CAP[metric];
    Object.keys(days).forEach(k=>{ if(days[k] > cap){ days[k] = cap; capped = true; } });
    value = Object.values(days).reduce((s, v)=> s + v, 0);
    const maxTotal = (diffD(from, to) + 1) * cap;                     // tổng không vượt số ngày đã qua × trần/ngày
    if(value > maxTotal){ value = maxTotal; capped = true; }
    weekValue = Object.keys(days).filter(k=> k >= wk0).reduce((s, k)=> s + days[k], 0);
  }
  value = round1(value); weekValue = round1(weekValue);
  const target = Number(ch.target) || 1;
  return { value, weekValue, week: weekKey(to), done: value >= target, days, capped, manualPct: value > 0 ? Math.min(100, Math.round(manualSum / value * 100)) : 0 };
}
exports.recordChallengeProgress = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const a = needAuth(request); await notBanned(a.uid);
  await A.rateLimit(`${a.uid}_progress`, 120, 3600);
  const d = obj(request.data), id = str(d.challengeId, 128);
  if(!id) throw new HttpsError("invalid-argument", "Thiếu mã thử thách.");
  const chRef = db().collection("challenges").doc(id), eRef = chRef.collection("entries").doc(a.uid);
  return db().runTransaction(async tx=>{
    const [cs, es] = [await tx.get(chRef), await tx.get(eRef)];
    if(!cs.exists || cs.data().hidden) throw new HttpsError("not-found", "Thử thách không còn tồn tại.");
    if(!es.exists) throw new HttpsError("failed-precondition", "Hãy tham gia thử thách trước.");
    const e = es.data() || {};
    const entry = Object.assign({}, e);
    if(cs.data().metric === "weight_loss" && !(Number(e.baseline) >= 30)){             // khoá cân mốc lần đầu
      const b = Number(d.baseline); if(b >= 30 && b <= 250){ entry.baseline = round1(b); entry.baselineDate = isDs(d.baselineDate) ? d.baselineDate : vnDay(); }
    }
    // cloud-events.js (pushProgress) gửi số TỔNG {value, weekValue, manual} thay vì bảng ngày → kẹp bằng trần máy chủ
    const pr = d.daily || d.manual && typeof d.manual === "object" ? computeProgress(cs.data(), d.daily, d.manual, entry, vnDay())
      : capAggregate(cs.data(), entry, d, vnDay(), nowMs());
    const doc = { value: pr.value, weekValue: pr.weekValue, week: pr.week, done: pr.done, days: pr.days, capped: pr.capped, manualPct: pr.manualPct,
      serverAt: nowMs(), updatedAt: nowMs() };
    if(entry.baseline !== e.baseline){ doc.baseline = entry.baseline; doc.baselineDate = entry.baselineDate; }
    tx.set(eRef, doc, { merge: true });
    return Object.assign({ uid: a.uid }, doc);
  });
});
/**
 * Thuần: kẹp số TỔNG client gửi (value/weekValue/manual) — không vượt (số ngày đã qua × trần/ngày), mỗi lần đồng bộ chỉ tăng
 * tối đa trần/ngày × (số ngày từ lần trước + 1); giảm cân ≤ 1 %/tuần × số tuần, ≤ 30 % cân mốc. Ngoài kỳ → lỗi như computeProgress.
 */
function capAggregate(ch, entry, claim, today, at){
  ch = obj(ch); entry = obj(entry); claim = obj(claim);
  if(!isDs(ch.start) || !isDs(ch.end)) throw new HttpsError("failed-precondition", "Thử thách thiếu ngày bắt đầu/kết thúc.");
  if(today < ch.start) throw new HttpsError("failed-precondition", "Thử thách chưa bắt đầu.");
  if(today > addDays(ch.end, GRACE_DAYS)) throw new HttpsError("failed-precondition", "Thử thách đã kết thúc — không ghi thêm tiến độ.");
  const to = today < ch.end ? today : ch.end, days = diffD(ch.start, to) + 1;
  const num = v=>{ v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  const v = num(claim.value);
  let cap, perPush, weekCap;
  if(ch.metric === "weight_loss"){
    const base = Number(entry.baseline) || 0;
    if(!(base >= 30 && base <= 250)) throw new HttpsError("failed-precondition", "Thiếu cân mốc hợp lệ (30–250 kg) — nhập lại lúc tham gia.");
    cap = Math.min(Math.floor(base * 0.01 * Math.max(1, days / 7) * 10 + 1e-9) / 10, base * 0.3); perPush = cap; weekCap = Math.floor(base * 0.01 * 10 + 1e-9) / 10;
  } else {
    const per = DAILY_CAP[ch.metric] || DAILY_CAP.manual;
    cap = days * per; weekCap = per * 7;
    const prevAt = Number(entry.serverAt) || 0, since = prevAt ? Math.max(0, Math.floor((at - prevAt) / DAY)) : days;
    perPush = (Number(entry.value) || 0) + per * (since + 1);
  }
  const value = round1(Math.min(v, cap, perPush));
  const weekValue = round1(Math.min(num(claim.weekValue), value, weekCap));
  const manual = Math.min(num(claim.manual), value);
  return { value, weekValue, week: weekKey(to), done: value >= (Number(ch.target) || 1), days: obj(entry.days), capped: v > value + 0.05,
    manualPct: value > 0 ? Math.min(100, Math.round(manual / value * 100)) : 0 };
}
/** Xếp hạng kiểu 1-2-2-4 theo value (thuần) */
function rankEntries(list){
  const rows = arr(list).filter(e=> e && e.uid).map(e=> ({ uid: e.uid, name: str(e.name, 40), value: Number(e.value) || 0, done: !!e.done }))
    .sort((x, y)=> y.value - x.value);
  let rank = 0, prev = null;
  rows.forEach((r, i)=>{ if(prev === null || r.value !== prev){ rank = i + 1; prev = r.value; } r.rank = rank; });
  return rows;
}
const RANK_BONUS = [500, 300, 150];
/* Vòng 2 (FIX-commerce §2 #4b): người HOÀN THÀNH nhưng không nhận quà top → voucher 15 % (tối đa 100.000 ₫) = events.js outcome().
   Voucher là bản ghi MÁY CHỦ vouchers/{code} { owner: uid, uses: 1 } (client Firebase từ chối voucher ví không có bản ghi máy chủ).
   Mỗi người / thử thách đúng 1 voucher: voucherGrants/fin_{chId}_{uid} (chỉ Functions đọc / ghi). */
const FIN_VOUCHER = { kind: "pct", value: 15, max: 100000, min: 0, days: 60, title: "Giảm 15% (tối đa 100.000 ₫)" };
/** Thuần: spec voucher hoàn thành cho 1 dòng xếp hạng (đã có rank) → null nếu chưa hoàn thành hoặc đã nhận quà top */
function challengeVoucherFor(ch, row){
  ch = obj(ch); row = obj(row);
  if(!row.uid || !row.done) return null;
  const gifts = arr(ch.gifts), top = Number(ch.giftTop) || 0;
  if(row.rank && row.rank <= top && Number(row.value) > 0 && gifts.length) return null;
  return Object.assign({}, FIN_VOUCHER, { sub: `Hoàn thành ${str(ch.title, 80)}` });
}
/** Cấp voucher máy chủ idempotent (transaction) → voucher (already:true nếu đã cấp trước đó) */
async function issueChallengeVoucher(uid, chId, spec){
  const gRef = db().collection("voucherGrants").doc(refId(`fin_${chId}_${uid}`));
  return db().runTransaction(async tx=>{
    const g = await tx.get(gRef);
    if(g.exists){ const vs = await tx.get(db().collection("vouchers").doc(String(g.data().code))); return vs.exists ? Object.assign({ already: true }, vs.data()) : null; }
    const code = "TE-" + randCode(8), at = nowMs();
    const voucher = { code, kind: spec.kind, value: spec.value, min: spec.min || 0, max: spec.max || 0, uses: 1, used: 0, owner: uid,
      exp: addDays(vnDay(at), spec.days || 60), title: str(spec.title, 60), sub: str(spec.sub, 120), src: "challenge", ref: `fin_${chId}`, revoked: false, at };
    tx.set(gRef, { uid, code, ref: `fin_${chId}`, at });
    tx.set(db().collection("vouchers").doc(code), voucher);
    return voucher;
  });
}
async function rankedServerEntries(id){
  const snap = await db().collection("challenges").doc(id).collection("entries").get();
  return rankEntries(snap.docs.map(x=> Object.assign({ uid: x.id }, x.data())).filter(e=> e.serverAt));
}
exports.settleChallenge = onCall({ region: REGION, maxInstances: 2, timeoutSeconds: 120 }, async (request)=>{
  const actor = await A.actorOf(request, { recentSec: A.SESSION_SEC });
  A.need(actor, "challenges.manage");
  const id = str(obj(request.data).challengeId, 128);
  const cs = await db().collection("challenges").doc(id).get();
  if(!cs.exists) throw new HttpsError("not-found", "Không tìm thấy thử thách.");
  const ch = cs.data();
  if(!(vnDay() > ch.end)) throw new HttpsError("failed-precondition", "Thử thách chưa kết thúc.");
  // chỉ entry có tiến độ do máy chủ ghi (serverAt) — số tự khai kiểu cũ không được trao thưởng
  const rows = await rankedServerEntries(id);
  const gifts = arr(ch.gifts), top = Number(ch.giftTop) || 0;
  let awarded = 0, giftN = 0, voucherN = 0;
  for(const r of rows){
    const spec = challengeVoucherFor(ch, r);
    if(spec){ const v = await issueChallengeVoucher(r.uid, id, spec); if(v && !v.already) voucherN++; }
    if(r.done && Number(ch.points)) if(await awardPoints(r.uid, Number(ch.points), `done_${id}`, `Hoàn thành: ${ch.title}`)) awarded++;
    if(r.rank <= 3 && r.value > 0) if(await awardPoints(r.uid, RANK_BONUS[r.rank - 1], `rank_${id}`, `Hạng ${r.rank}: ${ch.title}`)) awarded++;
    if(r.rank <= top && r.value > 0 && gifts.length){
      const g = gifts[Math.min(r.rank - 1, gifts.length - 1)];
      const gRef = db().collection("gifts").doc(`g_${id}_${r.uid}`);
      if(!(await gRef.get()).exists){ await gRef.set({ uid: r.uid, name: r.name, title: `Quà hạng ${r.rank}: ${str(g && g.title || g, 80)}`, item: str(g && g.title || g, 80),
        pid: str(g && g.pid, 80), reason: `Hạng ${r.rank}/${rows.length} · ${str(ch.title, 80)}`, status: "new", freeShip: true, source: { type: "challenge", id, rank: r.rank },
        createdAt: nowMs(), updatedAt: nowMs() }); giftN++; }
    }
  }
  await A.writeAudit(actor, "challenge.settle", { type: "challenge", id, name: str(ch.title, 100) }, { entries: rows.length, awarded, gifts: giftN, vouchers: voucherN });
  return { ok: true, rows: rows.slice(0, 50), awarded, gifts: giftN, vouchers: voucherN };
});
/* Người dùng tự nhận voucher hoàn thành sau khi thử thách kết thúc (events.js settleAll gọi khi mode = firebase) —
   không cần chờ quản trị bấm "Chốt & trao quà". Kết quả theo số MÁY CHỦ (serverAt), cùng quy tắc với settleChallenge. */
exports.claimChallengeVoucher = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const a = needAuth(request); await notBanned(a.uid);
  await A.rateLimit(`${a.uid}_finv`, 20, 3600);
  const id = str(obj(request.data).challengeId, 128);
  if(!id) throw new HttpsError("invalid-argument", "Thiếu mã thử thách.");
  const cs = await db().collection("challenges").doc(id).get();
  if(!cs.exists) return { ok: false, error: "Không tìm thấy thử thách." };
  const ch = cs.data();
  if(!(vnDay() > String(ch.end || ""))) return { ok: false, error: "Thử thách chưa kết thúc." };
  const row = (await rankedServerEntries(id)).find(r=> r.uid === a.uid);
  const spec = challengeVoucherFor(ch, row);
  if(!spec) return { ok: false, error: row && row.done ? "Bạn nhận quà hạng thay cho voucher." : "Chưa hoàn thành mục tiêu theo số máy chủ ghi nhận." };
  const v = await issueChallengeVoucher(a.uid, id, spec);
  if(!v) throw new HttpsError("internal", "Không cấp được voucher — thử lại sau.");
  return { ok: true, already: !!v.already, voucher: publicVoucher(v) };
});
/** Voucher cá nhân còn dùng được (đổi điểm, hoàn thành thử thách) — client gộp vào ví (server:true) */
const publicVoucher = v=> ({ code: v.code, kind: v.kind, value: v.value, min: v.min || 0, max: v.max || 0, exp: v.exp || "", title: v.title || "", sub: v.sub || "",
  src: v.src || "", ref: v.ref || "", server: true });
exports.myVouchers = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 15 }, async (request)=>{
  const a = needAuth(request);
  const today = vnDay();
  const snap = await db().collection("vouchers").where("owner", "==", a.uid).get();
  const list = snap.docs.map(x=> Object.assign({ code: x.id }, x.data()))
    .filter(v=> !v.revoked && (Number(v.used) || 0) < (Number(v.uses) || 1) && (!v.exp || String(v.exp) >= today));
  return { vouchers: list.slice(0, 100).map(publicVoucher) };
});

/* =====================================================================
   4. CHECK-IN SỰ KIỆN — khung giờ + mã băm / mã xoay vòng (QC-08)
   ===================================================================== */
const CHECKIN_EARLY_MS = 2 * 3600e3, CHECKIN_LATE_MS = 6 * 3600e3;   // = events.js
function checkinOpen(ev, at){
  const s = isoVN(ev.start); if(!isFinite(s)) return false;
  const e = isFinite(isoVN(ev.end)) ? isoVN(ev.end) : s + 2 * 3600e3;
  return at >= s - CHECKIN_EARLY_MS && at <= e + CHECKIN_LATE_MS;
}
/** Mã xoay vòng 6 ký tự, đổi mỗi 60 giây: HMAC-SHA256(secret, eventId:bước) */
function rotatingCode(secret, eventId, at){
  const step = Math.floor((at == null ? nowMs() : at) / 60000);
  const h = crypto.createHmac("sha256", String(secret)).update(`${eventId}:${step}`).digest();
  return Array.from(h.slice(0, 6), b=> CODE_CHARS[b % CODE_CHARS.length]).join("");
}
/** So mã: xoay vòng (bước hiện tại hoặc trước) → băm (codeHash) → mã tĩnh cũ (so hằng thời gian) */
function codeMatches(priv, eventId, code, at){
  priv = obj(priv); code = str(code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(code.length < 4) return false;
  if(priv.secret && priv.rotating){ for(const dt of [0, -60000]) if(safeEqual(code, rotatingCode(priv.secret, eventId, (at || nowMs()) + dt))) return "rotating"; }
  if(priv.codeHash) return safeEqual(sha256(`${eventId}:${code}`), priv.codeHash) ? "hash" : false;
  if(priv.code) return safeEqual(code, String(priv.code).toUpperCase()) ? "code" : false;
  return false;
}
exports.checkInEvent = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const a = needAuth(request); await notBanned(a.uid);
  const d = obj(request.data), id = str(d.eventId, 128);
  await A.rateLimit(`${a.uid}_ci_${id}`, 10, 600);                      // mã 4–6 ký tự không dò được
  const evRef = db().collection("events").doc(id), regRef = evRef.collection("regs").doc(a.uid);
  const [es, ps] = await Promise.all([evRef.get(), evRef.collection("private").doc("checkin").get()]);
  if(!es.exists || es.data().hidden) throw new HttpsError("not-found", "Sự kiện không còn tồn tại.");
  const ev = es.data();
  if(!checkinOpen(ev, nowMs())) throw new HttpsError("failed-precondition", "Chưa tới giờ check-in (mở từ 2 giờ trước khi bắt đầu) hoặc sự kiện đã kết thúc.");
  const via = codeMatches(ps.exists ? ps.data() : {}, id, d.code, nowMs());
  if(!via) throw new HttpsError("permission-denied", "Mã check-in không đúng. Hỏi lại ban tổ chức nhé.");
  const pts = Math.max(0, Math.min(1000, Math.round(Number(ev.points) || 0)));
  const res = await db().runTransaction(async tx=>{
    const r = await tx.get(regRef);
    if(!r.exists || r.data().status === "cancelled") throw new HttpsError("failed-precondition", "Bạn chưa đăng ký sự kiện này.");
    if(r.data().status === "checked_in") return { already: true };
    if(pts) await awardPoints(a.uid, pts, `ci_${id}`, `Check-in: ${str(ev.title, 80)}`, tx);
    tx.update(regRef, { status: "checked_in", checkedInAt: nowMs(), checkinVia: via, updatedAt: nowMs() });
    return { already: false };
  });
  return Object.assign({ ok: true, points: res.already ? 0 : pts }, res);
});
/* Đăng ký sự kiện trong transaction: còn chỗ (regCount máy chủ giữ — QC-19), sự kiện miễn phí mới tự "đã thanh toán" */
function cleanRegInfo(i){ i = obj(i); return { name: str(i.name, 60), phone: String(i.phone || "").replace(/[^\d+]/g, "").slice(0, 14), option: str(i.option, 60), sos: str(i.sos, 80), note: str(i.note, 120) }; }
exports.registerEvent = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const a = needAuth(request); await notBanned(a.uid);
  await A.rateLimit(`${a.uid}_reg`, 30, 3600);
  const d = obj(request.data), id = str(d.evId || d.eventId, 128);
  if(!id) throw new HttpsError("invalid-argument", "Thiếu mã sự kiện.");
  const info = cleanRegInfo(d.info);
  const evRef = db().collection("events").doc(id), regRef = evRef.collection("regs").doc(a.uid);
  return db().runTransaction(async tx=>{
    const [es, rs] = [await tx.get(evRef), await tx.get(regRef)];
    if(!es.exists || es.data().hidden) throw new HttpsError("failed-precondition", "Sự kiện không còn tồn tại.");
    const ev = es.data();
    if(rs.exists && rs.data().status !== "cancelled") return Object.assign({ id: a.uid }, rs.data());
    const cap = Math.round(Number(ev.capacity) || 0), n = Math.round(Number(ev.regCount) || 0);
    if(cap > 0 && n >= cap) throw new HttpsError("resource-exhausted", "Sự kiện đã đủ chỗ.");
    const free = !ev.fee || Number(ev.fee) === 0;
    const doc = Object.assign({}, info, { uid: a.uid, name: info.name || str(a.token && a.token.name, 60) || "Bạn", code: randCode(6), status: "registered", paid: free,
      createdAt: rs.exists ? (rs.data().createdAt || nowMs()) : nowMs(), updatedAt: nowMs() });
    tx.set(regRef, doc);
    tx.update(evRef, { regCount: n + 1 });                             // regCountAgg đếm lại nếu lệch
    return Object.assign({ id: a.uid }, doc);
  });
});
exports.checkinCodeNow = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 15 }, async (request)=>{
  const actor = await A.actorOf(request, { recentSec: A.SESSION_SEC });
  if(!(A.hasPerm(actor.role, actor.px, "events.checkin") || A.hasPerm(actor.role, actor.px, "events.manage"))) throw new HttpsError("permission-denied", "Bạn không có quyền check-in sự kiện.");
  const id = str(obj(request.data).eventId, 128);
  const ref = db().collection("events").doc(id).collection("private").doc("checkin");
  const s = await ref.get(); let p = s.exists ? s.data() : {};
  if(!p.secret){ p = Object.assign({}, p, { secret: crypto.randomBytes(24).toString("hex"), rotating: true }); await ref.set({ secret: p.secret, rotating: true }, { merge: true }); }
  const at = nowMs();
  return { code: rotatingCode(p.secret, id, at), expiresAt: (Math.floor(at / 60000) + 1) * 60000, qr: `TAPEASY:CI:${id}:${rotatingCode(p.secret, id, at)}` };
});

/* =====================================================================
   5. BỘ ĐẾM TỰ CHỮA (không tin bộ đếm client ghi)
   ===================================================================== */
async function countOf(q){ try{ return (await q.count().get()).data().count; }catch(e){ return (await q.get()).size; } }
exports.regCountAgg = onDocumentWritten({ document: "events/{id}/regs/{uid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const id = event.params.id;
  const all = await db().collection("events").doc(id).collection("regs").get();
  const n = all.docs.filter(x=> (x.data() || {}).status !== "cancelled").length;
  const ev = db().collection("events").doc(id); const cur = await ev.get();
  if(cur.exists && Number(cur.data().regCount || 0) !== n) await ev.update({ regCount: n });
});
async function healComments(evId, rid){
  const rRef = db().collection("events").doc(evId).collection("reviews").doc(rid);
  const r = await rRef.get(); if(!r.exists) return null;
  const n = await countOf(rRef.collection("mcomments"));
  if(Number(r.data().commentCount || 0) !== n) await rRef.update({ commentCount: n });
  return n;
}
exports.commentCountHeal = onDocumentWritten({ document: "events/{id}/reviews/{rid}/mcomments/{cid}", region: REGION, maxInstances: 5 },
  async (event)=>{ await healComments(event.params.id, event.params.rid); });
exports.reviewCountHeal = onDocumentWritten({ document: "events/{id}/reviews/{rid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if(!after) return;
  if(before && Number(before.commentCount || 0) !== Number(after.commentCount || 0)) await healComments(event.params.id, event.params.rid);
  // điểm review (thay Points.add trên máy) — chỉ người đã check-in (rules) · 1 lần / sự kiện
  if(!before && after.kind === "review" && after.uid === event.params.rid){
    await awardPoints(after.uid, 30, `rv_${event.params.id}`, `Review: sự kiện ${event.params.id}`).catch(e=> logger.warn("điểm review", { message: e.message }));
    if(arr(after.media).length) await awardPoints(after.uid, 20, `rvp_${event.params.id}`, `Ảnh/clip sự kiện ${event.params.id}`).catch(()=>{});
  }
});
/** Trọng số báo cáo: chỉ tài khoản ≥ 7 ngày tuổi (thuần, kiểm thử được) */
function reportWeight(createdMs, at){ return createdMs && (at - createdMs) >= 7 * DAY ? 1 : 0; }
exports.routineReportHeal = onDocumentCreated({ document: "routines/{rid}/reports/{uid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const rRef = db().collection("routines").doc(event.params.rid);
  const r = await rRef.get(); if(!r.exists) return;
  const d = r.data() || {};
  if(d.moderatedAt || d.approved) return;                                 // kiểm duyệt viên đã quyết — không ghi đè
  const reps = await rRef.collection("reports").get();
  let w = 0;
  for(const x of reps.docs){
    if(x.id === d.authorUid) continue;
    try{ const u = await admin.auth().getUser(x.id); w += reportWeight(Date.parse(u.metadata && u.metadata.creationTime) || 0, nowMs()); }catch(e){}
  }
  const hide = w >= 3;
  if(!!d.hidden !== hide) await rRef.update({ hidden: hide, autoModAt: nowMs(), autoModWeight: w });
  else if(Number(d.autoModWeight) !== w) await rRef.update({ autoModWeight: w });   // integrator (FIX-pt vòng 2): giao diện đọc trọng số mới nhất kể cả khi "ẩn" không đổi
});

/* Vòng 2 (FIX-commerce §2 #4a · QS-19 / QC-14): báo cáo bài Khoảnh khắc (events/{id}/reviews/{rid}/mreports/{uid}) tính TRỌNG SỐ
   ở máy chủ: tài khoản ≥ 3 ngày tuổi (Auth creationTime, = TRUST_DAYS của cloud-events.js) = 1, mới = 0, tự báo cáo = 0.
   Trọng số lưu ở bản ghi báo cáo (sw — rules cấm client ghi w/sw/reportWeight); bài ghi reportCount / reportWeight thật,
   tự ẩn (hidden + autoHidden) khi trọng số ≥ 3 nếu kiểm duyệt viên chưa "giữ" (modOk). Không tự bỏ ẩn — để kiểm duyệt quyết. */
const MOMENT_TRUST_DAYS = 3, MOMENT_HIDE = 3;
function momentReportWeight(createdMs, at){ return createdMs && (at - createdMs) >= MOMENT_TRUST_DAYS * DAY ? 1 : 0; }
/** Thuần: patch cho bài sau khi đếm lại báo cáo [{ uid, sw }] */
function momentReportPatch(post, reports, at){
  post = obj(post);
  const list = arr(reports).filter(r=> r && r.uid && r.uid !== post.uid);
  const reportCount = list.length, reportWeight = list.reduce((s, r)=> s + (Number(r.sw) === 1 ? 1 : 0), 0);
  const patch = { reportCount, reportWeight, reported: reportCount > 0 };
  if(reportWeight >= MOMENT_HIDE && !post.modOk && post.hidden !== true) Object.assign(patch, { hidden: true, autoHidden: true, autoModAt: at });
  return patch;
}
async function accountCreatedMs(uid){ try{ const u = await admin.auth().getUser(uid); return Date.parse(u.metadata && u.metadata.creationTime) || 0; }catch(e){ return 0; } }
exports.momentReportHeal = onDocumentCreated({ document: "events/{id}/reviews/{rid}/mreports/{uid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const { id, rid } = event.params;
  const pRef = db().collection("events").doc(id).collection("reviews").doc(rid);
  const p = await pRef.get(); if(!p.exists) return null;
  const post = p.data() || {}, at = nowMs();
  const reps = [];
  for(const x of (await pRef.collection("mreports").get()).docs){
    const r = x.data() || {};
    let sw = r.sw;
    if(sw !== 0 && sw !== 1){                                             // bản ghi mới / dữ liệu cũ (w do client tự ghi — bỏ qua)
      sw = x.id === post.uid ? 0 : momentReportWeight(await accountCreatedMs(x.id), at);
      await x.ref.set({ sw, swAt: at }, { merge: true });
    }
    reps.push({ uid: x.id, sw });
  }
  const patch = momentReportPatch(post, reps, at);
  await pRef.update(patch);
  return patch;
});

exports._commerceTest = { normOrderInput, capAggregate, cleanRegInfo, priceOrder, voucherProblem, normVoucher, stockOf, applyStockDelta, cleanAddress, computeProgress, rankEntries, checkinOpen, rotatingCode,
  codeMatches, reportWeight, awardPoints, vnDay, isoVN, weekKey, mondayOf, addDays, REDEEM, DAILY_CAP, sha256,
  voucherAvailable, HOLD_MS, challengeVoucherFor, FIN_VOUCHER, momentReportWeight, momentReportPatch, MOMENT_TRUST_DAYS };
