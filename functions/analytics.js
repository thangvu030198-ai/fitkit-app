/* TapEasy — Số liệu cho mục "Phân tích" của bảng quản trị (pulse.js ghi, admin-analytics.js đọc)
   adminAnalytics (callable, quyền analytics.view): đếm số tài liệu activity mang từng NHÃN (Firestore count() — không đọc từng tài liệu).
   Dữ liệu là nhãn đếm ẩn danh (không uid/email) — xem firestore.rules mục "NHỊP SỬ DỤNG ẨN DANH". */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const A = require("./admin")._adminTest;

const REGION = "asia-southeast1";
const SESSION_SEC = 12 * 3600;
const MAX_TAGS = 400, CHUNK = 40;
const TAG_RE = /^[dwmnr]:[0-9]{4}-[0-9]{2}(-[0-9]{2})?(\|[a-z]{1,4}(:[a-z0-9_-]{1,24})?|>[0-9]{1,2})?$/;

/** Lọc danh sách nhãn hợp lệ, bỏ trùng, tối đa MAX_TAGS */
function cleanTags(list){
  const out = [];
  (Array.isArray(list) ? list : []).forEach(t=>{ t = String(t == null ? "" : t); if(t.length <= 64 && TAG_RE.test(t) && out.indexOf(t) < 0 && out.length < MAX_TAGS) out.push(t); });
  return out;
}
/** countFn(tag) → Promise<number>; chạy theo lô để không mở quá nhiều truy vấn cùng lúc */
async function countTags(tags, countFn){
  const counts = {};
  for(let i = 0; i < tags.length; i += CHUNK){
    const part = tags.slice(i, i + CHUNK);
    const res = await Promise.all(part.map(t=> Promise.resolve().then(()=> countFn(t)).then(n=> Number(n) || 0, ()=> 0)));
    part.forEach((t, j)=>{ counts[t] = res[j]; });
  }
  return counts;
}
async function adminAnalyticsCore(request, deps){
  deps = deps || {};
  const actor = await (deps.actorOf || A.actorOf)(request, { recentSec: SESSION_SEC });
  if(!actor.role || !A.hasPerm(actor.role, actor.px, "analytics.view")) throw new HttpsError("permission-denied", "Bạn không có quyền xem số liệu.");
  const tags = cleanTags(request.data && request.data.tags);
  if(!tags.length) throw new HttpsError("invalid-argument", "Thiếu danh sách nhãn cần đếm.");
  const countFn = deps.count || (t=> admin.firestore().collection("activity").where("t", "array-contains", t).count().get().then(s=> s.data().count));
  return { at: Date.now(), counts: await countTags(tags, countFn) };
}

exports.adminAnalytics = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 60, memory: "256MiB", invoker: "public" }, request=> adminAnalyticsCore(request));
exports._analyticsTest = { cleanTags, countTags, adminAnalyticsCore, TAG_RE, MAX_TAGS };
