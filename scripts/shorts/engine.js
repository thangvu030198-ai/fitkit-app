/* =========================================================================
   TapEasy Shorts — ENGINE (thuần, không DOM): series.json → kế hoạch dựng (plan) của 1 short.
   Dùng chung cho: shorts.js (trình duyệt), prep.js / smoke_node.js / tests (Node).
   - Thời lượng mỗi nhịp (beat) = lời đọc thật (TTS, giây) hoặc ước tính số từ / wps.
   - Phụ đề karaoke: chia cụm ≤ 2 dòng, mốc từng từ chia theo số âm tiết (ước tính) trong đoạn lời.
   - Bố cục cố định 1080×1920, vùng an toàn TikTok/Reels: chữ không vào 220 px trên, 420 px dưới, 140 px phải.
   - Mọi mốc "có gì mới" (cắt cảnh, bước thẻ, nhấn) ≤ 2,5 s một lần (trừ thẻ kết đứng yên cho quét QR).
   ========================================================================= */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory();
  else root.ShortsEngine = factory();
})(typeof self !== "undefined" ? self : this, function(){
"use strict";

const W = 1080, H = 1920, FPS = 30;
const SAFE = { top:220, bottom:420, right:140, left:60 };
const X0 = SAFE.left, X1 = W - SAFE.right, Y0 = SAFE.top, Y1 = H - SAFE.bottom;   // 60…940 × 220…1500
/* vùng bố cục (px) — mọi chữ phủ của bộ dựng nằm trong các vùng này */
const ZONES = {
  kicker: { x:X0, y:236, w:X1 - X0, h:40 },
  head:   { x:X0, y:286, w:X1 - X0, h:214 },
  vis:    { x:X0 - 20, y:516, w:X1 - X0 + 40, h:756 },     // khung hình ảnh (thẻ/phone) — chữ trong thẻ vẫn ≥ 60 px mép
  card:   { x:X0 + 4, y:530, w:X1 - X0 - 8, h:728 },       // nội dung chữ của thẻ (chừa 4 px mỗi bên: viền/bóng không lấn vùng an toàn)
  cap:    { x:X0, y:1270, w:X1 - X0, h:170 },              // 2 dòng × (58×1,2 + đệm 12) ≈ 164 px → kết thúc ≤ 1440
  src:    { x:X0, y:1452, w:X1 - X0, h:48 },               // nguồn ≤ 2 dòng 24 px → ≤ 1500 (đáy vùng an toàn), cách phụ đề ≥ 12 px
};
const CAP = { size:58, line:1.2, maxChars:24, maxLines:2, maxWords:9 };
const HEAD = { maxSize:94, minSize:60, charW:0.6, maxLines:2 };   // 0,6: tính cả lề .2em giữa các từ
const MAX_GAP = 2.5;            // giây tối đa giữa 2 "điều mới" trên hình
const LEAD = 0.14, TAIL = 0.26; // đệm trước/sau lời trong mỗi nhịp

/* ---------------- tiện ích ---------------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r3 = x => Math.round(x * 1000) / 1000;
const words = s => String(s || "").trim().split(/\s+/).filter(Boolean);
function fmtNum(v, dec){
  const s = Number(v).toFixed(dec || 0);
  const [i, d] = s.split(".");
  const neg = i[0] === "-"; const ii = neg ? i.slice(1) : i;
  const g = ii.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + g + (d ? "," + d : "");
}
/* trọng số âm tiết ước tính của 1 token (tiếng Việt: 1 chữ ≈ 1 âm tiết; số đọc dài hơn; viết tắt đọc từng chữ) */
function syl(tok){
  const t = String(tok);
  const core = t.replace(/[^\p{L}\p{N}]/gu, "");
  let w;
  if(!core) w = 0.3;
  else if(/\d/.test(core)){
    const parts = t.replace(/[^\d.,]/g, "").split(/[,]/);
    const ip = (parts[0] || "").replace(/\./g, "");
    w = Math.max(1, 2 * ip.length - 1) + (parts[1] ? 1 + parts[1].length : 0);
    if(/[–-]/.test(t)) w += 1.5;
    if(/%/.test(t)) w += 2;
  }
  else if(/^[A-ZĐ0-9]{2,5}$/.test(core)) w = core.length;
  else if(/^[a-z]+$/i.test(core) && /[aeiouy]{1}[^aeiouy]*[aeiouy]/i.test(core) && !/[^\x00-\x7f]/.test(core)) w = Math.max(1, (core.match(/[aeiouy]+/gi) || []).length);
  else w = 1;
  if(/[.!?…]["”)]?$/.test(t)) w += 0.9;
  else if(/[,;:]$/.test(t)) w += 0.5;
  return w;
}
function estDur(text, wps){ return words(text).length / (wps || 2.4); }

/* chia cụm phụ đề: ≤ maxLines dòng × maxChars, ≤ maxWords từ, ngắt ưu tiên ở dấu câu */
function wrapLines(toks, maxChars){
  const lines = [[]]; let len = 0;
  for(const w of toks){
    const add = (lines[lines.length - 1].length ? 1 : 0) + w.length;
    if(lines[lines.length - 1].length && len + add > maxChars){ lines.push([w]); len = w.length; }
    else { lines[lines.length - 1].push(w); len += add; }
  }
  if(lines.length === 2){                       // 2 dòng → chia cân, tránh chữ mồ côi dòng dưới
    const all = lines[0].concat(lines[1]); let best = null;
    for(let i = 1; i < all.length; i++){
      const a = all.slice(0, i).join(" ").length, b = all.slice(i).join(" ").length;
      if(a > maxChars || b > maxChars) continue;
      const cost = Math.max(a, b) + (b > a ? 0 : 0.5);
      if(!best || cost < best.cost) best = { i, cost };
    }
    if(best) return [all.slice(0, best.i), all.slice(best.i)];
  }
  return lines;
}
/* câu (ngắt ở . ! ? …) → số cụm ít nhất vừa khung, rồi chia CÂN (độ dài gần đều, ưu tiên ngắt sau dấu phẩy) — không để 1 chữ mồ côi */
function chunkCaption(text, o){
  o = Object.assign({}, CAP, o || {});
  const fits = arr => arr.length > 0 && wrapLines(arr, o.maxChars).length <= o.maxLines && arr.length <= o.maxWords;
  const sentences = []; let cur = [];
  for(const w of words(text)){ cur.push(w); if(/[.!?…]["”)]?$/.test(w) && !/^\d+\.$/.test(w)){ sentences.push(cur); cur = []; } }
  if(cur.length) sentences.push(cur);
  // câu 1 chữ dính vào câu trước nếu vừa
  for(let i = sentences.length - 1; i > 0; i--) if(sentences[i].length === 1 && fits(sentences[i - 1].concat(sentences[i]))){ sentences[i - 1].push(...sentences[i]); sentences.splice(i, 1); }
  const out = [];
  for(const toks of sentences){
    const greedy = []; let c = [];
    for(const w of toks){ if(c.length && !fits(c.concat(w))){ greedy.push(c); c = []; } c.push(w); }
    if(c.length) greedy.push(c);
    let best = greedy;
    for(let n = greedy.length; n <= greedy.length + 2 && n > 1; n++){
      const parts = balanced(toks, n);
      if(parts && parts.every(fits)){ best = parts; break; }
    }
    best.forEach(p => out.push(p));
  }
  return out.map(c => ({ toks:c, lines:wrapLines(c, o.maxChars) }));
}
function balanced(toks, n){
  const cum = [0]; toks.forEach(w => cum.push(cum[cum.length - 1] + w.length + 1));
  const L = cum[cum.length - 1], cuts = [0];
  for(let k = 1; k < n; k++){
    const target = L * k / n; let bi = -1, bc = 1e9;
    for(let i = cuts[k - 1] + 1; i <= toks.length - (n - k); i++){
      const cost = Math.abs(cum[i] - target) - (/[,;:]$/.test(toks[i - 1]) ? L / n * 0.3 : 0) + ((i - cuts[k - 1]) < 2 ? L : 0);
      if(cost < bc){ bc = cost; bi = i; }
    }
    if(bi < 0) return null; cuts.push(bi);
  }
  cuts.push(toks.length);
  const parts = []; for(let k = 0; k < n; k++) parts.push(toks.slice(cuts[k], cuts[k + 1]));
  return parts.every(p => p.length) ? parts : null;
}
function headSize(lines){
  const n = Math.max(1, ...lines.map(l => [...String(l)].length));
  return Math.floor(clamp(ZONES.head.w / (n * HEAD.charW), HEAD.minSize, HEAD.maxSize));
}

/* số bước nội tại của từng loại thẻ (mỗi bước = 1 "điều mới") */
function stepCount(v){
  switch(v.k){
    case "formula": return (v.lines || []).length;
    case "calc": return (v.rows || []).length + (v.total ? 1 : 0);
    case "bars": case "compare": case "goals": case "list": case "meals": return (v.rows || v.items || []).length;
    case "week": return 2;
    case "food": return (v.items || []).length;
    case "beforeafter": return (v.rows || []).length;
    case "chart": return 2;
    case "heat": return 3;
    case "myth": return 2;
    case "versus": case "duo": return 2;
    case "themes": return (v.shots || []).length;
    case "watch": return 2;
    case "stat": return 1;
    default: return 0;
  }
}

/* ---------------- kế hoạch 1 short ----------------
   series: toàn bộ series.json · id: short · durs: { "0": giây, …, "end": giây } (lời thật sau cắt lặng, đã chia tempo) */
function plan(series, id, durs, opts){
  opts = opts || {};
  const S = (series.shorts || []).find(s => s.id === id);
  if(!S) throw new Error("không có short " + id);
  const wps = series.wps || 2.4; durs = durs || {};
  const tempo = Number(durs.tempo) || 1;
  const voiceDur = (k, text) => (durs[k] != null ? Number(durs[k]) : estDur(text, wps));
  const beats = []; const events = []; const chunks = [];
  let t = 0;
  S.beats.forEach((b, i) => {
    const say = b.say || "";
    const vd = say ? voiceDur(String(i), say) : 0;
    const minD = Number(b.min) || (i === 0 ? 2.2 : 2.0);
    const dur = Math.max(minD, LEAD + vd + TAIL);
    const t0 = t, t1 = t + dur;
    const vs = Array.isArray(b.v) ? b.v : [b.v];
    const wsum = vs.reduce((a, v) => a + (Number(v.w) || 1), 0);
    let tp = t0; const pieces = [];
    vs.forEach((v, j) => {
      const pd = dur * (Number(v.w) || 1) / wsum;
      const p = Object.assign({}, v, { t0:r3(tp), t1:r3(j === vs.length - 1 ? t1 : tp + pd), j });
      const n = stepCount(v);
      p.steps = [];
      if(n){
        const a = p.t0 + (j === 0 && i === 0 ? 0.35 : 0.3), z = Math.max(a + 0.01, p.t1 - 0.55);
        for(let s = 0; s < n; s++) p.steps.push(r3(n === 1 ? a : a + (z - a) * s / (n - 1)));
      }
      pieces.push(p); tp += pd;
    });
    const head = b.h ? (Array.isArray(b.h) ? b.h : [b.h]) : [];
    beats.push({ i, t0:r3(t0), t1:r3(t1), h:head, hsize:headSize(head.length ? head : [""]), acc: b.acc == null ? head.length - 1 : b.acc,
                 bg: b.bg || S.bg || "", pieces, voice: say ? { t0:r3(t0 + LEAD), dur:r3(vd), text:say, est: durs[String(i)] == null } : null });
    // phụ đề karaoke
    const capText = b.cap || say;
    if(capText && b.noCap !== true){
      const cs = chunkCaption(capText);
      const all = cs.flatMap(c => c.toks);
      const ws = all.map(syl); const tot = ws.reduce((a, x) => a + x, 0) || 1;
      const va = t0 + LEAD, vz = t0 + LEAD + (vd || (dur - LEAD - TAIL));
      let acc = 0, k = 0; const wt = [];
      all.forEach((w, q) => { const a = va + (vz - va) * acc / tot; acc += ws[q]; const z = va + (vz - va) * acc / tot; wt.push([r3(a), r3(z)]); });
      cs.forEach((c, ci) => {
        const first = wt[k], lastW = wt[k + c.toks.length - 1];
        let li = 0; const lines = c.lines.map(line => line.map(w => { const tt = wt[k + li++]; return { w, t0:tt[0], t1:tt[1] }; }));
        const nextStart = ci < cs.length - 1 ? wt[k + c.toks.length][0] : null;
        chunks.push({ beat:i, text:c.toks.join(" "), lines,
                      t0:r3(Math.max(t0, first[0] - 0.08)), t1:r3(nextStart != null ? nextStart - 0.08 : Math.min(t1, lastW[1] + 0.35)) });
        k += c.toks.length;
      });
    }
    t = t1;
  });
  // thẻ kết
  const E = Object.assign({ dur:2.8, title:"Tải miễn phí trong cộng đồng TapEasy", sub:"Quét mã QR · nhóm Zalo TapEasy Cộng Đồng", say:"" }, series.end_card || {}, S.end_card || {});
  const ed = E.say ? voiceDur("end", E.say) : 0;
  const endDur = Math.max(Number(E.dur) || 2.8, E.say ? LEAD + ed + 0.55 : 0);
  const end = { t0:r3(t), t1:r3(t + endDur), title:E.title, sub:E.sub, qr:series.qr || "assets/zalo-community-qr.jpg",
                voice: E.say ? { t0:r3(t + LEAD), dur:r3(ed), text:E.say, est: durs.end == null } : null };
  if(E.say){
    const toks = words(E.say), ws = toks.map(syl), tot = ws.reduce((a, x) => a + x, 0) || 1; let acc = 0;
    const line = toks.map((w, q) => { const a = end.voice.t0 + ed * acc / tot; acc += ws[q]; return { w, t0:r3(a), t1:r3(end.voice.t0 + ed * acc / tot) }; });
    chunks.push({ beat:"end", text:E.say, lines:[line], t0:end.t0, t1:end.t1, hidden:true });   // chỉ ghi SRT; thẻ kết đã có tiêu đề
  }
  const duration = r3(end.t1);
  // các mốc "điều mới"
  events.push({ t:0, type:"hook" });
  beats.forEach(b => b.pieces.forEach((p, j) => {
    if(!(b.i === 0 && j === 0)) events.push({ t:p.t0, type:"cut", kind:p.enter || (j ? "swap" : "beat") });
    p.steps.forEach(s => events.push({ t:s, type:"step" }));
  }));
  events.push({ t:end.t0, type:"end" });
  chunks.filter(c => !c.hidden).forEach(c => events.push({ t:c.t0, type:"caption", soft:true }));
  events.sort((a, b) => a.t - b.t);
  // chèn "nhấn" (zoom/trôi máy quay) để không có quãng > MAX_GAP mà hình đứng yên
  const hard = events.filter(e => !e.soft);
  const punches = [];
  for(let q = 0; q < hard.length - 1; q++){
    const a = hard[q].t, z = hard[q + 1].t;
    if(a >= end.t0) break;
    const gap = z - a;
    if(gap > MAX_GAP - 0.2){ const n = Math.ceil(gap / (MAX_GAP - 0.3)); for(let m = 1; m < n; m++) punches.push({ t:r3(a + gap * m / n), type:"punch" }); }
  }
  const allEv = events.concat(punches).sort((a, b) => a.t - b.t);
  const sources = S.sources || "", disclaimer = S.disclaimer || "";
  return {
    id:S.id, n:S.n, title:S.title, cover:S.cover || S.title, pillar:S.pillar || "", kicker:S.kicker || "", W, H, fps:series.fps || FPS, duration, tempo,
    hook:{ text:S.hook, t_full:0.55 }, accent:S.accent || "mint", bg:S.bg || "",
    beats, chunks, end, events:allEv, sources, disclaimer, illustrative:!!S.illustrative,
    voice: beats.some(b => b.voice && !b.voice.est), zones:ZONES, safe:SAFE,
  };
}

/* ---------------- tra cứu theo t (dùng trong render) ---------------- */
function beatAt(P, t){ for(const b of P.beats) if(t < b.t1) return b; return null; }
function pieceAt(b, t){ if(!b) return null; for(const p of b.pieces) if(t < p.t1) return p; return b.pieces[b.pieces.length - 1]; }
function chunkAt(P, t){ for(const c of P.chunks) if(!c.hidden && t >= c.t0 && t < c.t1) return c; return null; }
function punchAt(P, t){
  let last = null;
  for(const e of P.events){ if(e.t > t) break; if(e.type !== "caption") last = e; }
  return last ? { dt:t - last.t, type:last.type } : { dt:99, type:"" };
}
/* quãng "đứng yên" dài nhất (giây) trước thẻ kết — QA ≤ MAX_GAP */
function maxGap(P){
  const ts = P.events.filter(e => e.type !== "caption" && e.t <= P.end.t0).map(e => e.t);
  let g = 0; for(let i = 1; i < ts.length; i++) g = Math.max(g, ts[i] - ts[i - 1]);
  return r3(g);
}
/* SRT từ cụm phụ đề */
function srt(P){
  const tc = s => { const ms = Math.max(0, Math.round(s * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60, x = ms % 1000;
    const p = (n, l) => String(n).padStart(l || 2, "0"); return `${p(h)}:${p(m)}:${p(ss)},${p(x, 3)}`; };
  return P.chunks.map((c, i) => `${i + 1}\n${tc(c.t0)} --> ${tc(c.t1)}\n${c.lines.map(l => l.map(w => w.w).join(" ")).join("\n")}\n`).join("\n");
}

/* Mifflin–St Jeor (= app.js calcBMR) + PAL (= data.js ACTIVITY_LEVELS) — để kiểm số liệu kịch bản */
const PAL = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, veryActive:1.9 };
function mifflin(p){ const b = 10 * p.weight + 6.25 * p.height - 5 * p.age; return Math.round(p.gender === "male" ? b + 5 : b - 161); }
function tdee(bmr, act){ return Math.round(bmr * (PAL[act] || PAL.moderate)); }

return { W, H, FPS, SAFE, ZONES, CAP, HEAD, MAX_GAP, plan, chunkCaption, wrapLines, syl, estDur, words, headSize, fmtNum,
         beatAt, pieceAt, chunkAt, punchAt, maxGap, srt, mifflin, tdee, PAL, stepCount, clamp };
});
