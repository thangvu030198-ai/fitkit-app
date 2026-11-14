/* =========================================================================
   TapEasy — Cloud Functions: TÀI KHOẢN (vòng R3 · 14/11/2026 · docs/DATABASE-SETUP.md §11–12)
   1. requestEmailOtp (callable, KHÔNG cần đăng nhập)  — gửi mã 6 số qua email để đặt lại mật khẩu
   2. verifyEmailOtp  (callable, KHÔNG cần đăng nhập)  — kiểm mã → đặt mật khẩu mới + thu hồi mọi phiên cũ
        · Chỉ lưu BĂM của mã (HMAC-SHA256 với muối riêng + "tiêu" OTP_PEPPER trong Secret Manager) — không lưu mã gốc
        · Hạn 10 phút · tối đa 5 lần nhập sai · mỗi email ≥ 60 giây / lần, ≤ 5 lần / giờ · mỗi IP ≤ 20 lần / giờ
        · Trả lời TRUNG TÍNH: email có hay không có tài khoản đều { ok:true } (chống dò email)
        · Gửi mail qua API HTTP (Resend / SendGrid / Brevo — không cần thư viện) hoặc SMTP (nodemailer — tuỳ chọn)
   3. exportMyData    (callable, cần đăng nhập)        — gom dữ liệu gắn với tài khoản trên máy chủ (quyền tiếp cận dữ liệu)

   Cấu hình — KHÔNG ghi khoá vào mã:
     firebase functions:secrets:set MAIL_API_KEY      # khoá API của dịch vụ mail (hoặc mật khẩu SMTP)
     firebase functions:secrets:set OTP_PEPPER        # chuỗi ngẫu nhiên ≥ 32 ký tự
     functions/.env →  MAIL_PROVIDER=resend|sendgrid|brevo|smtp   MAIL_FROM="TapEasy <no-reply@ten-mien-cua-ban.vn>"
                       (SMTP) SMTP_HOST=…  SMTP_PORT=465  SMTP_USER=…
   ========================================================================= */
"use strict";
const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const REGION = "asia-southeast1";
const MAIL_API_KEY  = defineSecret("MAIL_API_KEY");
const OTP_PEPPER    = defineSecret("OTP_PEPPER");
const MAIL_PROVIDER = defineString("MAIL_PROVIDER", { default: "resend", description: "resend | sendgrid | brevo | smtp" });
const MAIL_FROM     = defineString("MAIL_FROM", { default: "", description: "Địa chỉ gửi đã xác minh với dịch vụ mail, VD: TapEasy <no-reply@ten-mien.vn>" });
const SMTP_HOST     = defineString("SMTP_HOST", { default: "" });
const SMTP_PORT     = defineString("SMTP_PORT", { default: "465" });
const SMTP_USER     = defineString("SMTP_USER", { default: "" });

const OTP_TTL_MS = 10 * 60 * 1000;      // hạn 10 phút
const OTP_MAX_TRIES = 5;                // tối đa 5 lần nhập
const OTP_RESEND_MS = 60 * 1000;        // ≥ 60 giây giữa 2 lần gửi
const OTP_PER_HOUR = 5;                 // mỗi email
const IP_PER_HOUR = 20;                 // mỗi địa chỉ IP (gửi + kiểm)
const HOUR = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const normEmail = e => String(e || "").trim().toLowerCase();
function otpHash(pepper, salt, email, code){ return crypto.createHmac("sha256", String(pepper || "")).update(`${salt}:${email}:${code}`).digest("hex"); }
function safeEqual(a, b){ const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function genCode(){ return String(crypto.randomInt(0, 1000000)).padStart(6, "0"); }
function value(p, d){ try{ const v = p.value(); return v == null || v === "" ? d : v; }catch(e){ return d; } }

/** Cửa sổ trượt đơn giản theo giờ: trả { ok, doc } — doc để ghi lại */
function rateStep(cur, nowMs, max){
  const w = cur && nowMs - Number(cur.windowStart || 0) < HOUR ? { windowStart: Number(cur.windowStart), count: Number(cur.count) || 0 } : { windowStart: nowMs, count: 0 };
  if(w.count >= max) return { ok: false, doc: w };
  w.count++; return { ok: true, doc: w };
}
async function ipGate(db, request, nowMs){
  const ip = String((request.rawRequest && (request.rawRequest.ip || (request.rawRequest.headers || {})["x-forwarded-for"])) || "unknown").split(",")[0].trim();
  const ref = db.collection("otp_rate").doc("ip_" + sha(ip).slice(0, 40));
  const ok = await db.runTransaction(async tx=>{
    const s = await tx.get(ref);
    const r = rateStep(s.exists ? s.data() : null, nowMs, IP_PER_HOUR);
    if(r.ok) tx.set(ref, Object.assign(r.doc, { updatedAt: nowMs }));
    return r.ok;
  });
  if(!ok) throw new HttpsError("resource-exhausted", "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau 1 giờ.");
}

/* ---------------- Gửi mail ---------------- */
function mailBody(code){
  const text = `Mã đặt lại mật khẩu TapEasy của bạn: ${code}\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này cho bất kỳ ai.\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n\nYour TapEasy password reset code: ${code} (valid for 10 minutes). If you did not request it, ignore this email.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#12232b;line-height:1.6">
<p>Mã đặt lại mật khẩu TapEasy của bạn:</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
<p>Mã có hiệu lực trong <b>10 phút</b>. Không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
<hr style="border:0;border-top:1px solid #dde5e8"><p style="color:#5b6e76;font-size:13px">Your TapEasy password reset code is <b>${code}</b> (valid for 10 minutes). If you did not request it, you can safely ignore this email.</p></div>`;
  return { subject: `${code} là mã đặt lại mật khẩu TapEasy`, text, html };
}
function mailConfigured(){
  const provider = String(value(MAIL_PROVIDER, "resend")).toLowerCase();
  const key = value(MAIL_API_KEY, ""), from = value(MAIL_FROM, "");
  if(!key || !from) return false;
  if(provider === "smtp" && !(value(SMTP_HOST, "") && value(SMTP_USER, ""))) return false;
  return true;
}
/** Gửi mail; `fetchImpl` cho phép test thay thế. Ném lỗi khi dịch vụ từ chối. */
async function sendMail(to, msg, fetchImpl){
  const provider = String(value(MAIL_PROVIDER, "resend")).toLowerCase();
  const key = value(MAIL_API_KEY, ""), from = value(MAIL_FROM, "");
  const f = fetchImpl || globalThis.fetch;
  const m = /^(.*)<([^>]+)>\s*$/.exec(from);
  const fromName = m ? m[1].trim().replace(/^"|"$/g, "") : "TapEasy", fromEmail = m ? m[2].trim() : from.trim();
  let url, headers, body;
  if(provider === "sendgrid"){
    url = "https://api.sendgrid.com/v3/mail/send"; headers = { Authorization: `Bearer ${key}` };
    body = { personalizations: [{ to: [{ email: to }] }], from: { email: fromEmail, name: fromName }, subject: msg.subject,
      content: [{ type: "text/plain", value: msg.text }, { type: "text/html", value: msg.html }] };
  } else if(provider === "brevo"){
    url = "https://api.brevo.com/v3/smtp/email"; headers = { "api-key": key };
    body = { sender: { email: fromEmail, name: fromName }, to: [{ email: to }], subject: msg.subject, textContent: msg.text, htmlContent: msg.html };
  } else if(provider === "smtp"){
    let nodemailer;
    try{ nodemailer = require("nodemailer"); }catch(e){ throw new Error("MAIL_PROVIDER=smtp cần thêm thư viện: cd functions && npm install nodemailer"); }
    const port = Number(value(SMTP_PORT, "465")) || 465;
    const tr = nodemailer.createTransport({ host: value(SMTP_HOST, ""), port, secure: port === 465, auth: { user: value(SMTP_USER, ""), pass: key } });
    await tr.sendMail({ from, to, subject: msg.subject, text: msg.text, html: msg.html });
    return true;
  } else {
    url = "https://api.resend.com/emails"; headers = { Authorization: `Bearer ${key}` };
    body = { from, to: [to], subject: msg.subject, text: msg.text, html: msg.html };
  }
  const res = await f(url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(body) });
  if(!res || !res.ok) throw new Error(`Dịch vụ mail (${provider}) trả lỗi ${res && res.status}`);
  return true;
}

/* ---------------- 1. requestEmailOtp ---------------- */
async function requestEmailOtpCore(request, deps){
  deps = deps || {};
  const nowMs = deps.now ? deps.now() : Date.now();
  const email = normEmail(request.data && request.data.email);
  if(!EMAIL_RE.test(email) || email.length > 254) throw new HttpsError("invalid-argument", "Email không hợp lệ.");
  /* Kiểm cấu hình TRƯỚC khi tra tài khoản → lỗi cấu hình không làm lộ email nào có tài khoản */
  if(!mailConfigured()) throw new HttpsError("failed-precondition", "Máy chủ chưa cấu hình gửi email. Hãy dùng link đặt lại mật khẩu.");
  const db = admin.firestore();
  await ipGate(db, request, nowMs);
  const ref = db.collection("email_otps").doc(sha(email));
  const gate = await db.runTransaction(async tx=>{
    const s = await tx.get(ref), cur = s.exists ? s.data() : {};
    if(nowMs - Number(cur.lastSentAt || 0) < OTP_RESEND_MS) return "wait";
    const r = rateStep(cur, nowMs, OTP_PER_HOUR);
    if(!r.ok) return "hour";
    tx.set(ref, Object.assign({}, r.doc, { lastSentAt: nowMs }), { merge: true });
    return "ok";
  });
  if(gate === "wait") throw new HttpsError("resource-exhausted", "Vui lòng đợi 60 giây rồi gửi lại.");
  if(gate === "hour") throw new HttpsError("resource-exhausted", "Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau 1 giờ.");

  let user = null;
  try{ user = await admin.auth().getUserByEmail(email); }catch(e){ user = null; }
  if(!user || user.disabled){ logger.info("OTP: email không có tài khoản hoạt động (trả lời trung tính)"); return { ok: true }; }

  const code = (deps.genCode || genCode)(), salt = crypto.randomBytes(16).toString("hex");
  await ref.set({ uid: user.uid, salt, hash: otpHash(value(OTP_PEPPER, ""), salt, email, code), exp: nowMs + OTP_TTL_MS, tries: 0 }, { merge: true });
  try{ await sendMail(email, mailBody(code), deps.fetch); }
  catch(e){
    logger.error("OTP: không gửi được email", { message: e.message });
    await ref.set({ hash: admin.firestore.FieldValue.delete(), salt: admin.firestore.FieldValue.delete(), exp: 0 }, { merge: true });
  }
  return { ok: true };
}

/* ---------------- 2. verifyEmailOtp ---------------- */
async function verifyEmailOtpCore(request, deps){
  deps = deps || {};
  const nowMs = deps.now ? deps.now() : Date.now();
  const d = request.data || {};
  const email = normEmail(d.email), code = String(d.code || "").replace(/\D/g, ""), pw = String(d.newPassword || "");
  const BAD = "Mã không đúng hoặc đã hết hạn.";
  if(!EMAIL_RE.test(email) || code.length !== 6) throw new HttpsError("invalid-argument", BAD);
  if(pw.length < 6 || pw.length > 128) throw new HttpsError("invalid-argument", "Mật khẩu cần 6–128 ký tự.");
  const db = admin.firestore();
  await ipGate(db, request, nowMs);
  const ref = db.collection("email_otps").doc(sha(email));
  const FV = admin.firestore.FieldValue;
  const out = await db.runTransaction(async tx=>{
    const s = await tx.get(ref), cur = s.exists ? s.data() : null;
    if(!cur || !cur.hash || !cur.salt || !cur.uid || nowMs > Number(cur.exp || 0)) return { err: BAD };
    if(Number(cur.tries || 0) >= OTP_MAX_TRIES){ tx.set(ref, { hash: FV.delete(), salt: FV.delete(), exp: 0 }, { merge: true }); return { err: "Bạn đã nhập sai quá 5 lần. Hãy yêu cầu mã mới.", many: true }; }
    if(!safeEqual(cur.hash, otpHash(value(OTP_PEPPER, ""), cur.salt, email, code))){
      const tries = Number(cur.tries || 0) + 1;
      if(tries >= OTP_MAX_TRIES){ tx.set(ref, { hash: FV.delete(), salt: FV.delete(), exp: 0, tries }, { merge: true }); return { err: "Bạn đã nhập sai quá 5 lần. Hãy yêu cầu mã mới.", many: true }; }
      tx.set(ref, { tries }, { merge: true });
      return { err: BAD };
    }
    tx.set(ref, { hash: FV.delete(), salt: FV.delete(), exp: 0, tries: 0, usedAt: nowMs }, { merge: true });   // mã dùng 1 lần
    return { uid: cur.uid };
  });
  if(out.err) throw new HttpsError(out.many ? "resource-exhausted" : "invalid-argument", out.err);
  try{
    await admin.auth().updateUser(out.uid, { password: pw, emailVerified: true });   // nhập đúng mã gửi tới hộp thư = đã chứng minh sở hữu email
    await admin.auth().revokeRefreshTokens(out.uid);                               // đăng xuất mọi thiết bị đang giữ phiên cũ
  }catch(e){
    logger.error("OTP: không đặt được mật khẩu", { uid: out.uid, message: e.message });
    throw new HttpsError("internal", "Chưa đặt được mật khẩu mới. Vui lòng thử lại.");
  }
  logger.info("OTP: đã đặt lại mật khẩu", { uid: out.uid });
  return { ok: true };
}

/* ---------------- 3. exportMyData ---------------- */
const EXPORT_PER_DAY = 5, EXPORT_CAP = 500;
async function exportMyDataCore(request, deps){
  deps = deps || {};
  const auth = request.auth;
  if(!auth || !auth.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const db = admin.firestore(), uid = auth.uid, nowMs = deps.now ? deps.now() : Date.now();
  const rateRef = db.collection("otp_rate").doc("export_" + uid);
  const ok = await db.runTransaction(async tx=>{
    const s = await tx.get(rateRef), cur = s.exists ? s.data() : null;
    const w = cur && nowMs - Number(cur.windowStart || 0) < 24 * HOUR ? { windowStart: Number(cur.windowStart), count: Number(cur.count) || 0 } : { windowStart: nowMs, count: 0 };
    if(w.count >= EXPORT_PER_DAY) return false;
    w.count++; tx.set(rateRef, Object.assign(w, { updatedAt: nowMs })); return true;
  });
  if(!ok) throw new HttpsError("resource-exhausted", "Bạn đã xuất dữ liệu nhiều lần hôm nay. Vui lòng thử lại vào ngày mai.");
  const out = { uid, generatedAt: new Date(nowMs).toISOString(), truncatedAt: EXPORT_CAP, data: {} };
  const rows = docs => docs.slice(0, EXPORT_CAP).map(d=> Object.assign({ _path: d.ref && d.ref.path }, d.data() || {}));
  const q = async (label, query)=>{ try{ out.data[label] = rows((await query.get()).docs); }catch(e){ logger.warn("exportMyData: bỏ qua " + label, { message: e.message }); out.data[label] = null; } };
  const one = async (label, ref)=>{ try{ const s = await ref.get(); out.data[label] = s.exists ? s.data() : null; }catch(e){ out.data[label] = null; } };
  await one("user", db.collection("users").doc(uid));
  await one("contact", db.collection("users").doc(uid).collection("private").doc("contact"));
  await q("consents", db.collection("users").doc(uid).collection("consents"));
  await one("role", db.collection("roles").doc(uid));
  await one("ptVerification", db.collection("pt_verifications").doc(uid));
  await one("ptListing", db.collection("ptListings").doc(uid));
  await one("userSocial", db.collection("userSocial").doc(uid));
  await one("points", db.collection("points").doc(uid));
  await q("pointsTx", db.collection("points").doc(uid).collection("tx"));
  await q("routines", db.collection("routines").where("authorUid", "==", uid));
  await q("orders", db.collection("orders").where("uid", "==", uid));
  await q("gifts", db.collection("gifts").where("uid", "==", uid));
  await q("supportTickets", db.collection("support_tickets").where("uid", "==", uid));
  await q("reportsSent", db.collection("reports").where("by", "==", uid));
  await q("invitesSent", db.collection("invites").where("ptId", "==", uid));
  await q("vouchers", db.collection("vouchers").where("owner", "==", uid));
  for(const col of ["reviews", "mcomments", "regs", "entries", "requests"]) await q(col, db.collectionGroup(col).where("uid", "==", uid));
  logger.info("Người dùng xuất dữ liệu", { uid });
  return out;
}

/* invoker:"public" — callable tự kiểm tra quyền bên trong; thiếu dòng này thì hàm tạo lại sau lần deploy lỗi đầu tiên
   không có quyền gọi công khai → trình duyệt nhận 403 ở bước CORS (OPTIONS) và app báo "internal". */
const OPTS = { region: REGION, maxInstances: 5, timeoutSeconds: 30, memory: "256MiB", invoker: "public" };
exports.requestEmailOtp = onCall(Object.assign({ secrets: [MAIL_API_KEY, OTP_PEPPER] }, OPTS), request=> requestEmailOtpCore(request));
exports.verifyEmailOtp  = onCall(Object.assign({ secrets: [OTP_PEPPER] }, OPTS), request=> verifyEmailOtpCore(request));
exports.exportMyData    = onCall(Object.assign({}, OPTS, { timeoutSeconds: 120, memory: "512MiB" }), request=> exportMyDataCore(request));
exports._accountTest = { requestEmailOtpCore, verifyEmailOtpCore, exportMyDataCore, otpHash, rateStep, mailBody, sendMail, mailConfigured,
  OTP_TTL_MS, OTP_MAX_TRIES, OTP_RESEND_MS, OTP_PER_HOUR, IP_PER_HOUR };
