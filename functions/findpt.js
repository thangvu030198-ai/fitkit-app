/* =========================================================================
   TapEasy — Cloud Functions TÌM PT (functions/findpt.js) · docs/INTEGRATION-findpt.md §3
   firestore.rules khoá các trường tổng hợp của ptListings/{uid} (PT không tự sửa điểm, số đánh giá,
   tỉ lệ phản hồi) → máy chủ tính lại mỗi khi có đánh giá / yêu cầu mới. Công thức = cloud.ptdir.logic.aggregate / respStats.
     ptReviewAgg  ptListings/{lid}/reviews/{ruid} onWrite → ratingAvg, ratingCount, ratingDist, criteriaAvg, reviewHidden
     ptRespAgg    ptListings/{lid}/requests/{qid} onWrite → respN, respRate (≥ 3 yêu cầu mới công bố), respMins
   Export từ functions/index.js: Object.assign(exports, require("./findpt"));   (SAU admin.initializeApp())
   ========================================================================= */
"use strict";
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const REGION = "asia-southeast1";
const DAY = 864e5;
const CRITERIA = ["expertise", "punctual", "attitude", "results"];

/** Thuần (kiểm thử được): tổng hợp đánh giá ĐANG HIỂN THỊ (đánh giá bị kiểm duyệt ẩn không tính điểm) */
function aggregateReviews(all){
  all = Array.isArray(all) ? all.filter(Boolean) : [];
  const vis = all.filter(r=> !r.hidden);
  const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 }, crit = {};
  let sum = 0;
  vis.forEach(r=>{ const s = Math.min(5, Math.max(1, Math.round(Number(r.stars) || 0))); dist[s]++; sum += s; });
  CRITERIA.forEach(k=>{
    const vals = vis.map(r=> Number(r.criteria && r.criteria[k])).filter(v=> v >= 1 && v <= 5);
    crit[k] = vals.length ? Math.round(vals.reduce((a, v)=> a + v, 0) / vals.length * 10) / 10 : 0;
  });
  return { ratingAvg: vis.length ? Math.round(sum / vis.length * 10) / 10 : 0, ratingCount: vis.length, ratingDist: dist,
           criteriaAvg: crit, reviewHidden: all.length - vis.length };
}
/** Thuần: tỉ lệ phản hồi = yêu cầu PT trả lời trong 24 giờ / tổng yêu cầu 90 ngày (bỏ yêu cầu đã huỷ) */
function respStats(requests, at){
  at = at || Date.now();
  const list = (Array.isArray(requests) ? requests : []).filter(q=> q && q.createdAt && q.createdAt > at - 90 * DAY && q.status !== "cancelled");
  const ok = list.filter(q=> q.respondedAt && q.respondedAt - q.createdAt <= DAY);
  return { respN: list.length, respRate: list.length >= 3 ? Math.round(ok.length / list.length * 100) : null,
           respMins: ok.length ? Math.round(ok.reduce((a, q)=> a + (q.respondedAt - q.createdAt) / 6e4, 0) / ok.length) : null };
}

exports.ptReviewAgg = onDocumentWritten({ document: "ptListings/{lid}/reviews/{ruid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const db = admin.firestore(), lid = event.params.lid;
  const snap = await db.collection(`ptListings/${lid}/reviews`).get();
  await db.doc(`ptListings/${lid}`).set(aggregateReviews(snap.docs.map(d=> d.data())), { merge: true });
});

exports.ptRespAgg = onDocumentWritten({ document: "ptListings/{lid}/requests/{qid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const db = admin.firestore(), lid = event.params.lid, since = Date.now() - 90 * DAY;
  const snap = await db.collection(`ptListings/${lid}/requests`).where("createdAt", ">", since).get();
  await db.doc(`ptListings/${lid}`).set(respStats(snap.docs.map(d=> d.data())), { merge: true });
});

exports._findptTest = { aggregateReviews, respStats };
