/* =========================================================================
   TapEasy — SỰ KIỆN (events.js)
   Thi đua tháng · Sự kiện offline (vé QR, điểm danh, review ảnh) · Quà tặng ·
   Điểm TapEasy · Công cụ quản trị sự kiện (theo vai trò RBAC)
   - Nạp SAU cloud-events.js và SAU pt.js / achievements.js (xem docs/INTEGRATION-events-shop.md)
   - Dữ liệu riêng: state.tapEvents = { localId, joined:{chId:{…}}, badges:{chId:{…}},
       points:[{id,ts,delta,reason,ref}], contact:{name,phone}, address:{…}, seenGifts:[], … }
   - Quyền: theo TE_RBAC (rbac.js) — teCan('events.manage' | 'events.checkin' | 'challenges.manage' | 'gifts.manage' |
     'community.moderate' | 'reviews.moderate' | 'data.export' …). Bản app đầy đủ luôn nạp rbac.js (vòng tích hợp 3): 7 lần chạm
     dòng phiên bản do rbac.js xử lý (mở đăng nhập quản trị). state.isAdmin chỉ còn là dự phòng khi chạy module rời (bộ kiểm thử).
   - BẮT BUỘC ẢNH/CLIP + NỘI DUNG (yêu cầu chủ app): sự kiện, thử thách, review, bài đăng sau sự kiện
     → ≥ 1 ảnh hoặc 1 video + tên/mô tả ≥ 80 ký tự (sự kiện, thử thách) / nội dung ≥ 20 ký tự (bài đăng).
     Ảnh/clip qua window.TapMedia (events-media.js: nén, IndexedDB/Storage, gallery, tự phát clip).
     Tab "Khoảnh khắc": bảng tin ảnh/clip sau sự kiện — thả tim, bình luận, báo cáo, kiểm duyệt.
   - Dữ liệu dùng chung (thử thách, sự kiện, đăng ký, review, quà) qua window.cloudEvents
   - XP/cấp độ vẫn do achievements.js tính (không cộng XP ở đây → không tính trùng).
     Điểm TapEasy là điểm thưởng TIÊU ĐƯỢC (đổi voucher ở Cửa hàng).
   ========================================================================= */
(function(G){
"use strict";

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const p2 = n=> String(n).padStart(2,"0");
const ds = d=> `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const isDs = s=> typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const parse = s=>{ const a = String(s).slice(0,10).split("-").map(Number); return new Date(a[0], a[1]-1, a[2], 12); };
const addD = (s, n)=>{ const d = parse(s); d.setDate(d.getDate()+n); return ds(d); };
const diffD = (a, b)=> Math.round((parse(b) - parse(a))/86400000);
const mondayOf = s=>{ const d = parse(s); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return ds(d); };
const minS = (a, b)=> a < b ? a : b, maxS = (a, b)=> a > b ? a : b;
const obj = o=> (o && typeof o==="object" && !Array.isArray(o)) ? o : {};
const arr = a=> Array.isArray(a) ? a : [];
const nf = (n, d)=>{ n = Number(n)||0; d = d||0; try{ return n.toLocaleString("vi-VN", { maximumFractionDigits:d, minimumFractionDigits:0 }); }catch(e){ return String(Math.round(n*10**d)/10**d); } };
const money = v=> nf(Math.round(Number(v)||0)) + "đ";
const esc = s=> (typeof G.escapeHtml==="function" ? G.escapeHtml(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const escAttr = s=> esc(s).replace(/`/g, "&#96;");
const DOW = ["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];
const DOW_S = ["CN","T2","T3","T4","T5","T6","T7"];
const dm = s=> isDs(String(s).slice(0,10)) ? `${String(s).slice(8,10)}/${String(s).slice(5,7)}` : "";
const dmy = s=> isDs(String(s).slice(0,10)) ? `${String(s).slice(8,10)}/${String(s).slice(5,7)}/${String(s).slice(0,4)}` : "";
const hm = iso=> String(iso||"").slice(11,16);
const isoToTs = iso=>{ const m = String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); if(!m) return NaN; return new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)).getTime(); };
const weekKey = s=>{ const d = parse(s); d.setDate(d.getDate() - ((d.getDay()+6)%7) + 3); const y = d.getFullYear(); const w = 1 + Math.floor(Math.round((d - new Date(y, 0, 1, 12))/864e5)/7); return `${y}-W${p2(w)}`; };
const round1 = x=> Math.round((Number(x)||0)*10)/10;

/* ---------------------------------------------------------------------
   1. MÃ QR — xem _test/events-kit (đã kiểm chứng giải mã bằng OpenCV)
   --------------------------------------------------------------------- */
const TapQR = (function(){
  const ECC = { L:{ o:0, f:1 }, M:{ o:1, f:0 }, Q:{ o:2, f:3 }, H:{ o:3, f:2 } };
  const ECW = [
    [-1, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];
  const NB = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];
  function rawModules(v){ let r = (16*v + 128)*v + 64; if(v >= 2){ const na = Math.floor(v/7) + 2; r -= (25*na - 10)*na - 55; if(v >= 7) r -= 36; } return r; }
  const dataCW = (v, e)=> Math.floor(rawModules(v)/8) - ECW[e.o][v]*NB[e.o][v];
  function gfMul(x, y){ let z = 0; for(let i=7;i>=0;i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg){ const r = new Array(deg).fill(0); r[deg-1] = 1; let root = 1;
    for(let i=0;i<deg;i++){ for(let j=0;j<r.length;j++){ r[j] = gfMul(r[j], root); if(j+1 < r.length) r[j] ^= r[j+1]; } root = gfMul(root, 2); } return r; }
  function rsRemainder(data, div){ const r = div.map(()=> 0);
    for(const b of data){ const f = b ^ r.shift(); r.push(0); div.forEach((c, i)=> r[i] ^= gfMul(c, f)); } return r; }
  function utf8(s){ const out = []; const t = unescape(encodeURIComponent(String(s))); for(let i=0;i<t.length;i++) out.push(t.charCodeAt(i)); return out; }
  function alignPos(v, size){ if(v === 1) return []; const na = Math.floor(v/7) + 2; const step = Math.floor((v*8 + na*3 + 5)/(na*4 - 4))*2;
    const r = [6]; for(let p = size - 7; r.length < na; p -= step) r.splice(1, 0, p); return r; }

  function encode(text, opt){
    opt = opt || {};
    let e = ECC[String(opt.ecl || "M").toUpperCase()] || ECC.M;
    const bytes = Array.isArray(text) ? text : utf8(text);
    let v = 0;
    for(let ver = Math.max(1, opt.minVersion||1); ver <= 40; ver++){
      const bits = 4 + (ver <= 9 ? 8 : 16) + bytes.length*8;
      if(bits <= dataCW(ver, e)*8){ v = ver; break; }
    }
    if(!v) throw new Error("Dữ liệu quá dài cho mã QR");
    if(opt.boost !== false) for(const k of ["Q","H"]){ const e2 = ECC[k]; if(e2.o > e.o && 4 + (v<=9?8:16) + bytes.length*8 <= dataCW(v, e2)*8) e = e2; }
    /* chuỗi bit dữ liệu */
    const bb = [];
    const put = (val, len)=>{ for(let i=len-1;i>=0;i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach(b=> put(b, 8));
    const cap = dataCW(v, e)*8;
    put(0, Math.min(4, cap - bb.length));
    put(0, (8 - bb.length % 8) % 8);
    for(let pad = 0xEC; bb.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for(let i=0;i<bb.length;i+=8){ let x = 0; for(let j=0;j<8;j++) x = (x << 1) | bb[i+j]; data.push(x); }
    /* sửa lỗi Reed–Solomon + đan xen khối */
    const nb = NB[e.o][v], ecl = ECW[e.o][v], raw = Math.floor(rawModules(v)/8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw/nb), div = rsDivisor(ecl), blocks = [];
    for(let i=0, k=0; i<nb; i++){ const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
      const ec = rsRemainder(dat, div); if(i < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
    const cw = [];
    for(let i=0;i<blocks[0].length;i++) blocks.forEach((b, j)=>{ if(i !== shortLen - ecl || j >= nShort) cw.push(b[i]); });
    /* ma trận */
    const size = v*4 + 17;
    const M = Array.from({length:size}, ()=> new Array(size).fill(false));
    const F = Array.from({length:size}, ()=> new Array(size).fill(false));
    const setF = (x, y, d)=>{ M[y][x] = d; F[y][x] = true; };
    for(let i=0;i<size;i++){ setF(6, i, i%2 === 0); setF(i, 6, i%2 === 0); }
    const finder = (cx, cy)=>{ for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx+dx, y = cy+dy;
      if(x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size-4, 3); finder(3, size-4);
    const ap = alignPos(v, size), na = ap.length;
    for(let i=0;i<na;i++) for(let j=0;j<na;j++){
      if((i === 0 && j === 0) || (i === 0 && j === na-1) || (i === na-1 && j === 0)) continue;
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) setF(ap[i]+dx, ap[j]+dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = mask=>{
      const d = e.f << 3 | mask; let r = d; for(let i=0;i<10;i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const bits = (d << 10 | r) ^ 0x5412, g = i=> ((bits >>> i) & 1) !== 0;
      for(let i=0;i<=5;i++) setF(8, i, g(i));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for(let i=9;i<15;i++) setF(14 - i, 8, g(i));
      for(let i=0;i<8;i++) setF(size - 1 - i, 8, g(i));
      for(let i=8;i<15;i++) setF(8, size - 15 + i, g(i));
      setF(8, size - 8, true);
    };
    drawFormat(0);
    if(v >= 7){ let r = v; for(let i=0;i<12;i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const bits = v << 12 | r;
      for(let i=0;i<18;i++){ const c = ((bits >>> i) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i/3); setF(a, b, c); setF(b, a, c); } }
    /* đặt dữ liệu theo đường zig-zag */
    let bi = 0;
    for(let right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let vert = 0; vert < size; vert++) for(let j=0;j<2;j++){
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if(!F[y][x] && bi < cw.length*8){ M[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    const maskFn = [ (x,y)=>(x+y)%2===0, (x,y)=>y%2===0, (x,y)=>x%3===0, (x,y)=>(x+y)%3===0, (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
      (x,y)=>x*y%2 + x*y%3===0, (x,y)=>(x*y%2 + x*y%3)%2===0, (x,y)=>((x+y)%2 + x*y%3)%2===0 ];
    const applyMask = m=>{ for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = ()=>{
      let p = 0;
      const line = get=>{ let run = 1; for(let i=1;i<=size;i++){ if(i < size && get(i) === get(i-1)) run++; else { if(run >= 5) p += run - 2; run = 1; } } };
      for(let y=0;y<size;y++) line(i=> M[y][i]);
      for(let x=0;x<size;x++) line(i=> M[i][x]);
      for(let y=0;y<size-1;y++) for(let x=0;x<size-1;x++){ const c = M[y][x]; if(c === M[y][x+1] && c === M[y+1][x] && c === M[y+1][x+1]) p += 3; }
      const pat = [true,false,true,true,true,false,true];
      const finderLike = get=>{ for(let i=0;i+7<=size;i++){ let ok = true; for(let k=0;k<7;k++) if(get(i+k) !== pat[k]){ ok = false; break; }
        if(!ok) continue; let before = true, after = true;
        for(let k=1;k<=4;k++){ if(i-k >= 0 && get(i-k)) before = false; if(i+6+k < size && get(i+6+k)) after = false; }
        if(before || after) p += 40; } };
      for(let y=0;y<size;y++) finderLike(i=> M[y][i]);
      for(let x=0;x<size;x++) finderLike(i=> M[i][x]);
      let dark = 0; for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(M[y][x]) dark++;
      const total = size*size; p += Math.floor(Math.abs(dark*20 - total*10) / total) * 10;
      return p;
    };
    let best = opt.mask != null ? opt.mask : -1;
    if(best < 0){ let min = Infinity;
      for(let m=0;m<8;m++){ applyMask(m); drawFormat(m); const s = penalty(); if(s < min){ min = s; best = m; } applyMask(m); } }
    applyMask(best); drawFormat(best);
    return { version:v, size, ecl: Object.keys(ECC).find(k=> ECC[k] === e), mask:best, modules:M };
  }
  /* SVG 1 path (mỗi ô 1 đơn vị) — sắc nét ở mọi kích thước */
  function svg(text, opt){
    opt = opt || {};
    const q = encode(text, opt), m = opt.margin == null ? 4 : opt.margin, n = q.size + m*2;
    let d = "";
    for(let y=0;y<q.size;y++){ let x = 0; while(x < q.size){ if(!q.modules[y][x]){ x++; continue; } let w = 1; while(x+w < q.size && q.modules[y][x+w]) w++; d += `M${x+m} ${y+m}h${w}v1h-${w}z`; x += w; } }
    const px = opt.size || 200;
    return `<svg class="${opt.cls||"tq-svg"}" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="${opt.label ? String(opt.label).replace(/[<>&"]/g,"") : "Mã QR"}">`
      + `<rect width="${n}" height="${n}" fill="${opt.light||"#fff"}"/><path d="${d}" fill="${opt.dark||"#061A24"}"/></svg>`;
  }
  return { encode, svg, utf8 };
})();

/* ---------------------------------------------------------------------
   2. LÕI NGHIỆP VỤ (hàm thuần — kiểm thử được bằng Node)
   --------------------------------------------------------------------- */
const METRICS = {
  sessions:    { label:"Số buổi tập", unit:"buổi", icon:"fitness_center", glyph:"dumbbell", manual:"add", manualMax:2, step:1,
                 src:"Tự động: buổi được tính khi bạn bấm “Kết thúc buổi” (kể cả buổi 20 phút). Buổi tập ngoài app (lớp nhóm, PT) → nhập tay.",
                 manualHint:"Buổi tập ngoài app (lớp nhóm, tập với PT, thể thao…)" },
  run_km:      { label:"Quãng đường chạy", unit:"km", icon:"directions_run", glyph:"runner", manual:"add", manualMax:60, step:0.1,
                 src:"Tự động: cộng các bài chạy đã hoàn thành trong giáo án (theo km/m; bài ghi theo phút được ước tính 7 phút/km). Chạy ngoài app → nhập km từ đồng hồ/Strava.",
                 manualHint:"Chạy ngoài app: nhập số km trên đồng hồ / Strava / Garmin" },
  water_days:  { label:"Ngày uống đủ nước", unit:"ngày", icon:"water_drop", glyph:"drop", manual:"log-water",
                 src:"Tự động: ngày có lượng nước ghi trong app ≥ mục tiêu cá nhân." },
  weight_loss: { label:"Số kg đã giảm", unit:"kg", icon:"monitor_weight", glyph:"scale", manual:"weighin", manualMax:250, step:0.1,
                 src:"Tự động: chênh lệch giữa cân mốc lúc tham gia và lần cân gần nhất (InBody/cân thường trong app). Tính tối đa 1% cân nặng/tuần." },
  food_days:   { label:"Ngày ghi ăn uống", unit:"ngày", icon:"restaurant", glyph:"notebook", manual:"log-food",
                 src:"Tự động: ngày có ít nhất 1 món trong nhật ký Dinh dưỡng." },
  sleep_days:  { label:"Đêm ngủ đủ giấc", unit:"đêm", icon:"bedtime", glyph:"moon", manual:"log-sleep",
                 src:"Tự động: đêm ngủ ≥ mục tiêu − 30 phút (tối thiểu 7 giờ) ghi trong Giấc ngủ." },
  manual:      { label:"Tự nhập", unit:"lần", icon:"edit", glyph:"star", manual:"add", manualMax:100, step:1,
                 src:"Nhập tay hằng ngày và xác nhận trung thực." },
};
/* fix-commerce QC-04: trần MỖI NGÀY tính trên tổng (tự động + nhập tay) — cùng bảng với "máy chủ" (cloudEvents.policy.CH_DAILY) */
const DAILY_CAP = { sessions:2, run_km:60, water_days:1, food_days:1, sleep_days:1, manual:100 };
const RANK_BONUS = [500, 300, 150];          // điểm thưởng thêm cho hạng 1/2/3 (khi tiến độ > 0)
const CHECKIN_EARLY_MS = 2*3600e3, CHECKIN_LATE_MS = 6*3600e3;   // QC-08: khung điểm danh [bắt đầu − 2 giờ, kết thúc + 6 giờ] (khớp lớp dữ liệu)
const SPORTS = {
  run:          { label:"Chạy bộ", icon:"directions_run" },
  hyrox:        { label:"Phối hợp / Hyrox", icon:"bolt" },
  powerlifting: { label:"Powerlifting", icon:"fitness_center" },
  group:        { label:"Tập nhóm", icon:"groups" },
  workshop:     { label:"Workshop dinh dưỡng", icon:"restaurant" },
  picnic:       { label:"Picnic sống khoẻ", icon:"park" },
  yoga:         { label:"Yoga & giãn cơ", icon:"self_improvement" },
  other:        { label:"Khác", icon:"event" },
};
/* 34 tỉnh/thành theo Nghị quyết 202/2025/QH15 (hiệu lực 01/07/2025) — chính quyền 2 cấp, không còn cấp huyện */
const PROVINCES = ["Hà Nội","TP. Hồ Chí Minh","Hải Phòng","Đà Nẵng","Huế","Cần Thơ",
  "An Giang","Bắc Ninh","Cà Mau","Cao Bằng","Đắk Lắk","Điện Biên","Đồng Nai","Đồng Tháp","Gia Lai","Hà Tĩnh","Hưng Yên",
  "Khánh Hoà","Lai Châu","Lâm Đồng","Lạng Sơn","Lào Cai","Nghệ An","Ninh Bình","Phú Thọ","Quảng Ngãi","Quảng Ninh",
  "Quảng Trị","Sơn La","Tây Ninh","Thái Nguyên","Thanh Hoá","Tuyên Quang","Vĩnh Long"];
const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/;
const normPhone = s=> String(s||"").replace(/[\s.\-()]/g, "");
const validPhone = s=> PHONE_RE.test(normPhone(s));

function chStatus(ch, today){ if(!ch) return "ended"; if(today < ch.start) return "upcoming"; if(today > ch.end) return "ended"; return "active"; }
function daysLeft(ch, today){ return Math.max(0, diffD(today, ch.end)); }
function waterTarget(st){ const P = obj(st.profile); const o = Number(P.waterTargetOverride); if(P.waterTargetOverride != null && o > 0) return o; const w = Number(P.weight) > 25 ? Number(P.weight) : 65; return Math.round(w*0.035*10)/10; }
function sleepMin(st){ const g = Number(obj(st.profile).sleepGoalHours) || 8; return Math.max(7, g - 0.5); }

/* Buổi tập: dùng đúng quy tắc của achievements.js (FKAch.buildCtx) nếu có, không thì quy tắc tương đương */
let _sessMemo = { k:"", v:null };
function sessionDates(st, today){
  const k = today + "|" + arr(st.finishedDates).length + "|" + Object.keys(obj(st.workoutLog)).length + "|" + arr(obj(st.achievements).quick).length;
  if(_sessMemo.k === k && _sessMemo.st === st) return _sessMemo.v;
  let set = null;
  try{ if(G.FKAch && typeof G.FKAch.buildCtx === "function"){ const c = G.FKAch.buildCtx(st, parse(today)); set = new Set(Array.from(c.sess.keys())); } }catch(e){ set = null; }
  if(!set){
    set = new Set();
    arr(st.finishedDates).forEach(d=>{ if(isDs(d) && d <= today) set.add(d); });
    const WL = obj(st.workoutLog);
    Object.keys(WL).forEach(d=>{ const l = WL[d]; if(isDs(d) && d <= today && l && l.finishedAt && arr(l.completedExerciseIds).length) set.add(d); });
    arr(obj(st.achievements).quick).forEach(d=>{ if(isDs(d) && d <= today) set.add(d); });
  }
  _sessMemo = { k, v:set, st };
  return set;
}
/* Chạy bộ: tìm bài chạy đã hoàn thành trong workoutLog → km */
function exName(item){ try{ if(typeof G.getExerciseMeta === "function") return String(G.getExerciseMeta(item).name||""); }catch(e){} return String((item.custom && item.custom.name) || ""); }
function isRunItem(item){
  const id = String(item && item.exerciseId || "").toLowerCase(), n = exName(item).toLowerCase();
  if(/walk|đi bộ|bước/.test(id + " " + n)) return false;
  return /^(running|run|jog|jogging|treadmillrun|sprint|tempo|intervalrun|zone2run)/.test(id) || /chạy|\brun(ning)?\b|jog/.test(n);
}
function kmOf(item){
  const r = String(item && item.reps || "").toLowerCase().replace(",", "."), sets = Math.max(1, Number(item && item.sets) || 1);
  let m = r.match(/(\d+(?:\.\d+)?)\s*km/); if(m) return { km: Number(m[1])*sets, est:false };
  m = r.match(/(\d{3,5})\s*m\b/); if(m) return { km: Number(m[1])/1000*sets, est:false };
  m = r.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(phút|ph|min)/); if(m){ const a = Number(m[1]), b = m[2] ? Number(m[2]) : a; return { km: ((a+b)/2)/7*sets, est:true }; }
  return { km:0, est:false };
}
function planItemsFor(st, dayKey){
  const P = obj(st.plans), act = P[st.activePlanId], out = [];
  if(act && act.days && act.days[dayKey]) out.push(...arr(act.days[dayKey].items));
  return out;
}
function findItem(st, dayKey, uid){
  let it = planItemsFor(st, dayKey).find(x=> x && x.uid === uid); if(it) return it;
  const P = obj(st.plans);
  for(const pid in P){ const days = obj(P[pid] && P[pid].days); for(const k in days){ it = arr(days[k] && days[k].items).find(x=> x && x.uid === uid); if(it) return it; } }
  return null;
}
function runKm(st, from, to){
  const WL = obj(st.workoutLog), by = {}; let est = false;
  for(const d in WL){
    if(!isDs(d) || d < from || d > to) continue;
    const l = WL[d]; if(!l) continue;
    for(const uid of arr(l.completedExerciseIds)){
      const it = findItem(st, l.dayKey, uid); if(!it || !isRunItem(it)) continue;
      const k = kmOf(it); if(k.km > 0){ by[d] = round1((by[d]||0) + k.km); if(k.est) est = true; }
    }
  }
  return { by, est };
}
function weighIns(st){
  return arr(st.inbodyLogs).filter(l=> l && Number(l.weight) > 20 && Number(l.ts) > 0)
    .map(l=> ({ d: ds(new Date(Number(l.ts))), w: Number(l.weight), ts: Number(l.ts) })).sort((a,b)=> a.ts - b.ts);
}
/* Tiến độ của MÌNH cho 1 thử thách (từ dữ liệu app + nhập tay) */
function progress(ch, st, J, today){
  J = obj(J); st = obj(st);
  const M = METRICS[ch.metric] || METRICS.manual;
  const from = ch.start, to = minS(ch.end, today);
  const wk0 = maxS(mondayOf(to), from);
  const daily = {}; let est = false, capped = false, note = "";
  const addDay = (d, v)=>{ if(v) daily[d] = round1((daily[d]||0) + v); };
  if(to >= from){
    if(ch.metric === "sessions"){ sessionDates(st, today).forEach(d=>{ if(d >= from && d <= to) addDay(d, 1); }); }
    else if(ch.metric === "water_days"){ const t = waterTarget(st), W = obj(st.waterLog); for(const d in W){ if(isDs(d) && d >= from && d <= to && Number(W[d]) >= t - 0.05) addDay(d, 1); } note = `Mục tiêu nước: ${nf(t,1)} lít/ngày`; }
    else if(ch.metric === "food_days"){ const F = obj(st.foodLog); for(const d in F){ if(!isDs(d) || d < from || d > to) continue; const day = obj(F[d]); if(Object.values(day).some(a=> arr(a).length)) addDay(d, 1); } }
    else if(ch.metric === "sleep_days"){ const S = obj(st.sleepLog), mn = sleepMin(st); for(const d in S){ if(isDs(d) && d >= from && d <= to && Number(obj(S[d]).hours) >= mn) addDay(d, 1); } }
    else if(ch.metric === "run_km"){ const r = runKm(st, from, to); for(const d in r.by) addDay(d, r.by[d]); est = r.est; }
  }
  /* nhập tay (đã xác nhận) — QC-04: gộp theo ngày, phần nhập tay chỉ lấp phần còn thiếu tới trần/ngày SAU khi đã cộng phần tự động */
  let manual = 0;
  const cap = DAILY_CAP[ch.metric] != null ? DAILY_CAP[ch.metric] : (M.manualMax || 1e9);
  if(M.manual === "add"){
    const byDay = {};
    arr(J.manual).forEach(x=>{ if(x && isDs(x.d) && x.d >= from && x.d <= to && Number(x.v) > 0) byDay[x.d] = (byDay[x.d]||0) + Math.min(Number(x.v), M.manualMax || 1e9); });
    for(const d in byDay){ const room = Math.max(0, cap - (daily[d]||0)), v = round1(Math.min(byDay[d], room)); if(v > 0){ manual += v; addDay(d, v); } }
  }
  for(const d in daily) if(daily[d] > cap) daily[d] = cap;   // dữ liệu tự động bất thường (đồng bộ máy khác…) cũng không vượt trần
  let value, weekValue, baseNote = "";
  if(ch.metric === "weight_loss"){
    const W = weighIns(st), baseTs = Number(J.baselineTs) || 0;
    let base = Number(J.baseline) > 20 ? Number(J.baseline) : (W.filter(x=> x.d <= from).pop() || {}).w || Number(obj(st.profile).weight) || 0;
    /* QC-09: mốc khai cao bất thường → bảng xếp hạng dùng mốc ≤ 105% lần cân gần nhất trước khi tham gia (≤ 14 ngày) hoặc cân nặng hồ sơ */
    if(Number(J.baseline) > 20){
      const prior = W.filter(x=> x.ts < baseTs && x.ts >= baseTs - 14*864e5).pop();
      const ref = prior ? prior.w : (Number(obj(st.profile).weight) > 25 ? Number(obj(st.profile).weight) : 0);
      if(ref && base > ref*1.05){ const eff = round1(ref*1.05); baseNote = `Mốc khai ${nf(base,1)} kg cao hơn ${Math.round((base/ref - 1)*100)}% so với ${prior ? "lần cân gần nhất" : "hồ sơ"} (${nf(ref,1)} kg) — bảng xếp hạng dùng mốc ${nf(eff,1)} kg.`; base = eff; }
    }
    const inRange = W.filter(x=> x.d >= from && x.d <= to && x.ts >= baseTs);
    const cur = inRange.length ? inRange[inRange.length-1].w : base;
    inRange.forEach(x=> daily[x.d] = round1(Math.max(0, base - x.w)));
    const weeks = Math.max(1, (diffD(J.baselineDate && isDs(J.baselineDate) ? maxS(J.baselineDate, from) : from, to) + 1)/7);
    const cap = Math.floor(base*0.01*weeks*10 + 1e-9)/10, raw = round1(Math.max(0, base - cur));
    value = Math.min(raw, cap); capped = raw > cap + 0.05;
    const before = W.filter(x=> x.ts >= baseTs && x.d < wk0).pop();
    const wStart = before ? before.w : base;
    weekValue = round1(Math.min(Math.max(0, wStart - cur), Math.floor(base*0.01*10 + 1e-9)/10));
    note = (capped ? `Đã giảm ${nf(raw,1)} kg — bảng xếp hạng tính tối đa ${nf(cap,1)} kg (1%/tuần) để khuyến khích giảm an toàn.` : (base ? `Mốc ${nf(base,1)} kg → hiện ${nf(cur,1)} kg` : "")) + (baseNote ? " " + baseNote : "");
  } else {
    value = Object.values(daily).reduce((a,b)=> a+b, 0);
    weekValue = Object.keys(daily).filter(d=> d >= wk0).reduce((a,d)=> a + daily[d], 0);
  }
  value = round1(value); weekValue = round1(weekValue);
  const target = Number(ch.target) || 1;
  return { value, weekValue, week: weekKey(to < from ? from : to), target, pct: Math.max(0, Math.min(1, value/target)), done: value >= target,
    manual: round1(manual), manualPct: value > 0 ? Math.round(Math.min(1, manual/value)*100) : 0, dailyCap: cap, daily, est, capped, baseFlag: !!baseNote, note, from, to };
}
/* Bảng xếp hạng: gộp entries (máy chủ) + dòng của mình (giá trị mới nhất), xếp hạng kiểu 1-2-2-4 */
function buildBoard(entries, mine, period, curWeek){
  const key = period === "week" ? "weekValue" : "value";
  const map = new Map();
  arr(entries).forEach(e=>{ if(e && e.uid) map.set(e.uid, Object.assign({}, e)); });
  if(mine && mine.uid) map.set(mine.uid, Object.assign({}, map.get(mine.uid) || {}, mine, { me:true }));
  const rows = Array.from(map.values()).map(r=>{
    let v = Number(r[key]) || 0;
    if(period === "week" && curWeek && !r.me && !r.bot && r.week && r.week !== curWeek) v = 0;   // số tuần cũ
    return Object.assign(r, { score: round1(v) });
  });
  rows.sort((a,b)=> (b.score - a.score) || ((a.updatedAt||0) - (b.updatedAt||0)) || String(a.name||"").localeCompare(String(b.name||""), "vi"));
  let rank = 0, prev = null;
  rows.forEach((r, i)=>{ if(prev === null || r.score !== prev){ rank = i + 1; prev = r.score; } r.rank = rank; });
  return { rows, me: rows.find(r=> r.me) || null, total: rows.length, key };
}
/* Kết quả cuối tháng của mình → điểm thưởng / quà / voucher */
function outcome(ch, board, value){
  const me = board && board.me, rank = me ? me.rank : 0, done = value >= (Number(ch.target)||1);
  const res = { rank, total: board ? board.total : 0, done, points:[], gift:null, voucher:null };
  if(done) res.points.push({ delta: Number(ch.points)||0, reason:`Hoàn thành: ${ch.title}`, ref:`done_${ch.id}` });
  if(rank && rank <= 3 && value > 0) res.points.push({ delta: RANK_BONUS[rank-1], reason:`Hạng ${rank}: ${ch.title}`, ref:`rank_${ch.id}` });
  const gifts = arr(ch.gifts), top = Number(ch.giftTop)||0;
  if(rank && rank <= top && value > 0 && gifts.length){ const g = gifts[Math.min(rank-1, gifts.length-1)]; res.gift = { title: g.title || String(g), pid: g.pid || "" }; }
  else if(done) res.voucher = { pct:15, max:100000, title:"Voucher giảm 15% (tối đa 100.000đ)", reason:`Hoàn thành ${ch.title}` };
  return res;
}
/* Sự kiện: trạng thái theo thời gian */
function evPhase(ev, ts){
  const s = isoToTs(ev.start), e = isoToTs(ev.end || ev.start) || s + 2*3600e3;
  if(ts < s - CHECKIN_EARLY_MS) return "upcoming";
  if(ts <= e + CHECKIN_LATE_MS) return ts < s ? "soon" : ts <= e ? "live" : "after";
  return "ended";
}
const canCheckIn = (ev, ts)=> ["soon","live","after"].includes(evPhase(ev, ts));
/* Nội dung mã QR */
const qrTicket = (evId, code)=> `TAPEASY:T:${evId}:${code}`;
const qrVenue = (evId, code)=> `TAPEASY:CI:${evId}:${code}`;
function parseQR(text){ const m = String(text||"").trim().match(/^TAPEASY:(T|CI):([A-Za-z0-9_\-]+):([A-Z0-9]{4,8})$/); return m ? { kind: m[1]==="T" ? "ticket" : "venue", evId:m[2], code:m[3] } : null; }
/* CSV (UTF-8 BOM cho Excel, chống CSV injection) */
function toCSV(rows, cols){
  const cell = v=>{ let s = v==null ? "" : String(v); if(/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  return "﻿" + [cols.map(c=> cell(c.label)).join(",")].concat(arr(rows).map(r=> cols.map(c=> cell(typeof c.get==="function" ? c.get(r) : r[c.key])).join(","))).join("\r\n");
}
/* Lịch (.ics) */
function toICS(ev){
  const f = iso=>{ const t = isoToTs(iso); const d = new Date(t); return `${d.getUTCFullYear()}${p2(d.getUTCMonth()+1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00Z`; };
  const t = s=> String(s||"").replace(/\\/g,"\\\\").replace(/[,;]/g, m=> "\\"+m).replace(/\r?\n/g,"\\n");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TapEasy//Su kien//VI","CALSCALE:GREGORIAN","BEGIN:VEVENT",
    `UID:${ev.id}@tapeasy.app`, `DTSTAMP:${f(new Date().toISOString().slice(0,16))}`, `DTSTART:${f(ev.start)}`, `DTEND:${f(ev.end||ev.start)}`,
    `SUMMARY:${t(ev.title)}`, `LOCATION:${t((ev.venue||"") + (ev.address ? ", " + ev.address : ""))}`, `DESCRIPTION:${t(ev.desc||"")}`,
    "BEGIN:VALARM","TRIGGER:-PT12H","ACTION:DISPLAY","DESCRIPTION:Nhắc sự kiện TapEasy","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
}
const mapsUrl = ev=> ev.mapUrl && /^https:\/\//.test(ev.mapUrl) ? ev.mapUrl : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([ev.venue, ev.address].filter(Boolean).join(", "));
const pointsBalance = list=> arr(list).reduce((a,x)=> a + (Number(x && x.delta)||0), 0);

const CORE = { METRICS, DAILY_CAP, SPORTS, PROVINCES, RANK_BONUS, CHECKIN_EARLY_MS, CHECKIN_LATE_MS, chStatus, daysLeft, waterTarget, sessionDates, isRunItem, kmOf, runKm, progress, buildBoard, outcome,
  evPhase, canCheckIn, qrTicket, qrVenue, parseQR, toCSV, toICS, mapsUrl, validPhone, normPhone, pointsBalance, weekKey, money, nf,
  _d:{ ds, parse, addD, diffD, mondayOf, isoToTs } };

/* ---------------------------------------------------------------------
   3. HÌNH ẢNH: glyph, huy hiệu thử thách, minh hoạ môn thể thao
   --------------------------------------------------------------------- */
const GL = {
  dumbbell:"M6.5 7v10|M17.5 7v10|M3.5 9.5v5|M20.5 9.5v5|M6.5 12h11",
  runner:"c:15,4.5,2|M13.6 8 11 13.5|M7.5 10.6l3-2.1 4 1 2 3 3 .8|M11 13.5l3.5 2.5-1.5 5.5|M11 13.5 8.5 17.5 4.5 18",
  drop:"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  scale:"r:3,3,18,18,4|M7.5 10a6 6 0 0 1 9 0|M12 10l1.5-2",
  notebook:"M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z|M9.5 3v18|M12.5 8h3.5|M12.5 12h3.5|M12.5 16h2",
  moon:"M11 4a7.5 7.5 0 1 0 9 9 6 6 0 0 1-9-9z",
  flame:"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  star:"M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.5 9.4l6.6-1z",
  trophy:"M8 21h8|M12 16.5V21|M7 3.5h10V9a5 5 0 0 1-10 0z|M17 5h3v1.5a4 4 0 0 1-3.6 4|M7 5H4v1.5a4 4 0 0 0 3.6 4",
  kettlebell:"M9 8.5V7a3 3 0 0 1 6 0v1.5|M7.2 8.5h9.6a2 2 0 0 1 2 2.2l-.9 8.6a2 2 0 0 1-2 1.7H8.1a2 2 0 0 1-2-1.7l-.9-8.6a2 2 0 0 1 2-2.2z|M10 14.5h4",
};
function pathsSVG(d){
  return String(d).split("|").map(s=>{
    if(s.startsWith("c:")){ const a = s.slice(2).split(","); return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}"/>`; }
    if(s.startsWith("r:")){ const a = s.slice(2).split(","); return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="${a[4]||0}"/>`; }
    return `<path d="${s}"/>`;
  }).join("");
}
let _bid = 0;
/* Huy hiệu thử thách: dùng lại khung huy hiệu của achievements.js (FKAch.badgeSVG), thay glyph riêng */
function chBadgeSVG(ch, size, opt){
  opt = opt || {};
  const b = obj(ch.badge), tier = Math.max(1, Math.min(3, Number(b.tier)||1));
  const glyph = GL[b.glyph] || GL[(METRICS[ch.metric]||{}).glyph] || GL.star;
  const label = opt.label === false ? "" : String(b.label || "").slice(0, 6);
  try{
    if(G.FKAch && typeof G.FKAch.badgeSVG === "function"){
      const svg = G.FKAch.badgeSVG({ tier, glyph:"star", labelTxt: label }, size, { label: label ? undefined : false });
      return svg.replace(/(<g class="ach-glyph"[^>]*>)[\s\S]*?(<\/g>)/, (m, a, z)=> a + pathsSVG(glyph) + z);
    }
  }catch(e){}
  const id = "teb" + (++_bid), c = ["#FFB08A","#DDF7F1","#FFD27A"][tier-1];
  return `<svg class="te-bsvg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AF1DD"/><stop offset="1" stop-color="#FF7A45"/></linearGradient></defs>`
    + `<circle cx="32" cy="32" r="28" fill="#0B2A33" stroke="${c}" stroke-width="2.2"/><g transform="translate(17.8,${label?13.3:17.8}) scale(1.18)" fill="none" stroke="url(#${id})" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${pathsSVG(glyph)}</g>`
    + (label ? `<text x="32" y="53" text-anchor="middle" fill="${c}" font-size="10" font-weight="700" font-family="Inter Tight, Inter, sans-serif">${esc(label)}</text>` : "") + `</svg>`;
}
/* Minh hoạ ảnh bìa sự kiện (SVG nét trắng trên nền gradient theo môn) */
function sportArt(sport){
  const W = `stroke="#fff" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const big = (g, x, y, s, sw)=> `<g transform="translate(${x} ${y}) scale(${s})" ${W} stroke-width="${sw||1}">${pathsSVG(g)}</g>`;
  let inner = "";
  if(sport === "run") inner = `<circle cx="258" cy="40" r="22" fill="#fff" opacity=".2"/><path d="M-10 118C80 98 170 134 330 102" ${W} stroke-width="3" opacity=".35"/><path d="M-10 134C90 116 190 144 330 124" ${W} stroke-width="2" opacity=".2"/>${big(GL.runner, 128, 12, 4.3, .85)}<path d="M58 58h40M44 74h46M66 90h28" ${W} stroke-width="3" opacity=".45"/>`;
  else if(sport === "hyrox") inner = `<path d="M86 60C86 38 122 38 122 60" ${W} stroke-width="7"/><circle cx="104" cy="88" r="30" ${W} stroke-width="3.6"/><path d="M90 116h28" ${W} stroke-width="3.6"/><circle cx="96" cy="80" r="5" fill="#fff" opacity=".5"/>
    <path d="M176 104h92l14-20h-92z" ${W} stroke-width="3.2"/><path d="M190 84l-10-30M270 84l10-30M160 112h150" ${W} stroke-width="3" opacity=".6"/><path d="M196 36h44l-9-9M240 36l-9 9" ${W} stroke-width="3" opacity=".55"/><circle cx="40" cy="104" r="16" ${W} stroke-width="3" opacity=".5"/>`;
  else if(sport === "powerlifting") inner = `<path d="M24 74h272" ${W} stroke-width="5"/>${[0,1,2].map(i=>`<rect x="${70+i*14}" y="${40+i*-8}" width="10" height="${68+i*16}" rx="3" fill="#fff" opacity="${.9-i*.2}"/><rect x="${240-i*14}" y="${40+i*-8}" width="10" height="${68+i*16}" rx="3" fill="#fff" opacity="${.9-i*.2}"/>`).join("")}<path d="M24 66v16M296 66v16" ${W} stroke-width="5"/><path d="M140 118h40" ${W} stroke-width="3" opacity=".5"/>`;
  else if(sport === "group"){ const person = (x, y, s2, up)=> `<g transform="translate(${x} ${y}) scale(${s2})" ${W} stroke-width="${3.2/s2}"><circle cx="0" cy="0" r="10"/><path d="M0 12v28M0 40l-11 22M0 40l11 22${up ? "M-20 4 0 20 20 4" : "M-18 30 0 18 18 30"}"/></g>`;
    inner = person(150, 40, 1, true) + person(212, 28, 1.15, true) + person(274, 40, 1, true) + `<path d="M120 128h190" ${W} stroke-width="2" opacity=".4"/><circle cx="60" cy="44" r="18" fill="#fff" opacity=".18"/>`; }
  else if(sport === "workshop") inner = `<path d="M96 76h128a64 46 0 0 1-128 0z" ${W} stroke-width="3.4"/><path d="M128 66c-4-18 8-30 22-34-2 14-8 26-22 34zM176 64c6-16 22-22 36-20-6 12-18 20-36 20z" ${W} stroke-width="3" opacity=".9"/><path d="M58 40v68M50 40v16a8 8 0 0 0 16 0V40M262 40c-10 4-14 16-14 28h14v40" ${W} stroke-width="3"/><path d="M138 30c0-8 6-8 6-16M158 30c0-8 6-8 6-16" ${W} stroke-width="2.4" opacity=".5"/>`;
  else if(sport === "yoga") inner = `<circle cx="160" cy="70" r="58" fill="#fff" opacity=".12"/><path d="M-10 122C70 108 250 108 330 122" ${W} stroke-width="2.4" opacity=".4"/>
    <g ${W} stroke-width="3.6"><circle cx="160" cy="34" r="9"/><path d="M160 45v30"/><path d="M160 52 132 30M160 52l28-22"/><path d="M160 75c-14 6-30 14-42 22 14 4 30 2 42-4 12 6 28 8 42 4-12-8-28-16-42-22z"/></g>
    <circle cx="52" cy="40" r="16" fill="#fff" opacity=".22"/><path d="M262 104c6-12 18-18 30-16-4 12-16 18-30 16zM262 104c-2-14 4-26 16-32 2 14-4 26-16 32z" ${W} stroke-width="2.4" opacity=".7"/>`;
  else if(sport === "picnic") inner = `<circle cx="262" cy="36" r="18" fill="#fff" opacity=".22"/><path d="M76 120V70M76 70c-26 0-34-22-22-38 4-16 26-22 36-10 16-4 28 10 22 26 8 14-6 24-14 22-6 2-14 0-22 0z" ${W} stroke-width="3"/><path d="M140 112l60-22 96 14-60 26z" ${W} stroke-width="3"/><path d="M170 101l60 10M200 90l36 30M230 95l-34 26" ${W} stroke-width="2" opacity=".55"/>`;
  else inner = big(GL.star, 128, 16, 4.2, .9);
  return `<svg class="te-art" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${inner.replace(/\|"/g,'"')}</svg>`;
}
function starsHTML(n, size){
  size = size || 14; n = Math.max(0, Math.min(5, Number(n)||0));
  return `<span class="te-stars" aria-label="${nf(n,1)} trên 5 sao">` + [1,2,3,4,5].map(i=>{
    const f = n >= i ? 1 : n > i-1 ? n-(i-1) : 0;
    const id = "tes" + (++_bid);
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}"><stop offset="${f}" stop-color="#FFC46B"/><stop offset="${f}" stop-color="rgba(127,127,127,.35)"/></linearGradient></defs><path d="${GL.star}" fill="url(#${id})"/></svg>`;
  }).join("") + `</span>`;
}
/* Ảnh mẫu trong review demo ("art:run1") — vẽ SVG, không tải mạng */
function demoPhoto(key){
  const hue = { run1:"#1B6A68,#FF7A45", run2:"#114650,#5EE6C7", run3:"#2B1F63,#FF9466" }[String(key).replace("art:","")] || "#114650,#5EE6C7";
  const [a, b] = hue.split(",");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="250" cy="60" r="34" fill="#fff" opacity=".25"/><path d="M0 190C90 160 190 210 320 170V240H0z" fill="#061A24" opacity=".35"/><g transform="translate(118 40) scale(4.6)" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round">${pathsSVG(GL.runner)}</g></svg>`);
}

/* =====================================================================
   PHẦN GIAO DIỆN — chỉ chạy trong trình duyệt khi app đã nạp
   ===================================================================== */
const TapEv = G.TapEv = Object.assign(G.TapEv || {}, { core: CORE, QR: TapQR, chBadgeSVG, sportArt, starsHTML, money, nf, esc, demoPhoto });
G.TapQR = TapQR;
if(typeof document === "undefined" || typeof G.addEventListener !== "function") return;
let _hasState = false; try{ _hasState = typeof state !== "undefined" && !!state; }catch(e){}
if(!_hasState){ console.warn("[events] Không thấy state — module chưa được tích hợp."); return; }
if(typeof cloudEvents === "undefined"){ console.warn("[events] Thiếu cloud-events.js — nạp cloud-events.js trước events.js."); return; }

const q = (s, r)=> (r||document).querySelector(s);
const qa = (s, r)=> Array.from((r||document).querySelectorAll(s));
const warn = e=>{ try{ console.warn("[events]", e); }catch(_){} };
const icon = n=> `<span class="material-symbols-rounded">${n}</span>`;
const todayS = ()=> ds(new Date());
const say = (m, ic)=>{ try{ toast(esc(m), ic || "check_circle"); }catch(e){} };
const reduceMotion = ()=>{ try{ return G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };

function TE(){
  const t = state.tapEvents = obj(state.tapEvents);
  t.joined = obj(t.joined); t.badges = obj(t.badges); t.points = arr(t.points);
  t.contact = obj(t.contact); t.address = obj(t.address); t.seenGifts = arr(t.seenGifts); t.monthGifts = obj(t.monthGifts);
  return t;
}
/* QC-11 (vòng 2): saveState() của lõi trả false khi localStorage đầy → save() trả boolean để hoàn tác điểm/voucher/chốt thưởng */
function save(){ try{ return saveState() !== false; }catch(e){ warn(e); return false; } }
const FULL_MSG = "Bộ nhớ máy đầy — chưa lưu được điểm/quà. Giải phóng dung lượng rồi mở lại Sự kiện.";
/* Quyền: RBAC (rbac.js → teCan) nếu có, không thì chế độ quản trị cũ (state.isAdmin) */
function can(p){ try{ if(typeof teCan === "function") return !!teCan(p); }catch(e){} return !!state.isAdmin; }
const hasRBAC = ()=> !!(G.TE_RBAC && typeof G.TE_RBAC.can === "function");   // rbac.js thật (app.js có teCan dự phòng = state.isAdmin)
const canEv = ()=> can("events.manage");
const canCI = ()=> can("events.checkin") || can("events.manage");
const canCh = ()=> can("challenges.manage");
const canMod = ()=> can("community.moderate") || can("reviews.moderate");
const canGifts = ()=> hasRBAC() ? can("gifts.manage") : !!state.isAdmin;
const canExport = ()=> hasRBAC() ? can("data.export") : !!state.isAdmin;
const isAdmin = ()=> canEv() || canCI() || canCh() || canMod() || canGifts() || ["shop.products", "shop.orders", "orders.view"].some(can);
function need(ok, what){ if(ok) return true; say(`Tài khoản chưa có quyền ${what}.`, "lock"); return false; }
const TM = ()=> G.TapMedia || null;
/* Ảnh bìa thẻ (ảnh/clip) — minh hoạ SVG làm lớp dự phòng khi chưa tải được */
function coverBox(doc, fallback, opt){
  const T = TM();
  if(T) return T.coverHTML(doc, Object.assign({ fallback }, opt || {}));
  return doc && doc.cover && /^https:\/\//.test(doc.cover) ? `${fallback}<img src="${escAttr(doc.cover)}" alt="" loading="lazy">` : fallback;
}
function galleryBox(doc, fallback, opt){
  const T = TM();
  if(T) return T.galleryHTML(T.mediaOf(doc), Object.assign({ fallback }, opt || {}));
  return `<div class="te-evd-cover fk-dark-island">${coverBox(doc, fallback)}</div>`;
}
const mediaN = doc=>{ const T = TM(); return T ? T.mediaOf(doc).length : arr(doc && doc.photos).length; };

/* ---------- Icon nét mảnh riêng (tiền tố te_) ---------- */
function addIcons(){
  try{
    if(typeof FK_LINE === "undefined") return;
    Object.assign(FK_LINE, {
      te_trophy: GL.trophy,
      te_ticket: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z|M14.5 5v2|M14.5 11v2|M14.5 17v2",
      te_qr: "r:3,3,7,7,1|r:14,3,7,7,1|r:3,14,7,7,1|M14 14h3v3h-3z|M20.5 14v.01|M14 20.5h.01|M17.5 20.5h3|M20.5 17.5v3",
      te_scan: "M3 8V5a2 2 0 0 1 2-2h3|M16 3h3a2 2 0 0 1 2 2v3|M21 16v3a2 2 0 0 1-2 2h-3|M8 21H5a2 2 0 0 1-2-2v-3|M7 12h10",
      te_gift: "r:3,8,18,4,1|M12 8v13|M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7|M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5",
      te_coin: "c:12,12,9|M14.8 9.2a3 3 0 0 0-2.8-1.7c-1.7 0-3 1-3 2.3 0 3 6 1.5 6 4.4 0 1.3-1.3 2.3-3 2.3a3.2 3.2 0 0 1-3-1.8|M12 6v1.5|M12 16.5V18",
      te_podium: "r:9,7,6,14,1|r:2.5,12,6.5,9,1|r:15,10,6.5,11,1",
      te_map: "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z|M9 4v13.5|M15 6.5V20",
      te_cart: "c:9,20,1.3|c:18,20,1.3|M2.5 3h2.5l2.4 11.2a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.5L21 7H6",
      te_bag: "M5 8h14l-1 12a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 20z|M9 8V6.5a3 3 0 0 1 6 0V8",
      te_truck: "M3 6h11v10H3z|M14 9h4l3 3.5V16h-7|c:7,17.5,1.8|c:17,17.5,1.8",
      te_receipt: "M6 2.5h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z|M9 7h6|M9 11h6|M9 15h4",
      te_voucher: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5z|M9.5 14.5l5-5|c:9.5,9.5,.6|c:14.5,14.5,.6",
      te_admin: "M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z|M9 12l2 2 4-4",
      te_download: "M12 3v12|M7 10l5 5 5-5|M4 20h16",
      te_minus: "M5 12h14", te_plus: "M12 5v14|M5 12h14",
      te_block: "c:12,12,9|M5.7 5.7l12.6 12.6",
      te_cal_add: "r:3,4,18,17,2.5|M16 2.5v4|M8 2.5v4|M3 10h18|M12 13v5|M9.5 15.5h5",
      te_runner: GL.runner, te_drop: GL.drop, te_scale: GL.scale, te_notebook: GL.notebook, te_moon: GL.moon,
      te_medal: "c:12,14.5,6|M8.5 9.5 6 2.5h4l2 5|M15.5 9.5 18 2.5h-4l-2 5|M12 12v5",
      te_people: "c:9,8,3.2|M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1|c:17,9,2.5|M17 14a4 4 0 0 1 4 4v1",
      te_hourglass: "M6 2h12|M6 22h12|M7 2v4l5 6-5 6v4|M17 2v4l-5 6 5 6v4",
    });
  }catch(e){ warn(e); }
}

/* ---------------------------------------------------------------------
   4. TapEasy POINTS (sổ điểm cục bộ, chống cộng trùng theo ref)
   --------------------------------------------------------------------- */
/* fix-commerce QC-02/QC-11: SỔ CÁI có mã băm nối chuỗi — h = băm(h trước | id | ts | delta | ref | muối thiết bị).
   Số dư = tổng giao dịch HỢP LỆ; giao dịch chèn/sửa tay (sai băm, |delta| bất thường, làm số dư âm) bị cách ly, không tính.
   Lưu thất bại (bộ nhớ đầy) → hoàn tác + báo lỗi, không "cộng điểm giả". Bản Firebase: sổ điểm trên máy chủ (Function — FIX-commerce §Chuyển giao). */
const PT_MAX = 5000, PT_SALT_KEY = "tapeasy_pts_k1";
function h53(str, seed){ let h1 = 0xdeadbeef ^ (seed||0), h2 = 0x41c6ce57 ^ (seed||0);
  for(let i = 0; i < str.length; i++){ const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
let _ptSalt = "";
function ptSalt(create){
  if(_ptSalt) return _ptSalt;
  try{ _ptSalt = localStorage.getItem(PT_SALT_KEY) || ""; if(!_ptSalt && create){ _ptSalt = Array.from({length:3}, ()=> Math.random().toString(36).slice(2)).join(""); localStorage.setItem(PT_SALT_KEY, _ptSalt); } }catch(e){}
  return _ptSalt || (create ? (_ptSalt = "tapeasy-local") : "");
}
const ptHash = (prev, x)=> h53([prev || "0", x.id, x.ts, x.delta, x.ref || "", ptSalt(true)].join("|"));
/* Dữ liệu cũ (trước bản sửa, chưa có mã băm) được niêm phong 1 lần — chỉ khi máy chưa từng có muối sổ điểm */
function ledger(){
  const t = TE(), L = t.points;
  if(t.ptV !== 2){
    const fresh = !ptSalt(false);
    if(fresh){ let prev = "0"; L.forEach(x=>{ if(!x || typeof x !== "object") return; x.delta = Math.round(Number(x.delta)||0); x.h = ptHash(prev, x); prev = x.h; }); }
    t.ptV = 2; ptSalt(true);
  }
  return L;
}
let _ptMemo = { k:"", v:null };
function verifyLedger(L){
  const k = L.length + "|" + (L.length ? (L[L.length-1] && L[L.length-1].h) + ":" + (L[L.length-1] && L[L.length-1].delta) : "") + "|" + L.reduce((a, x)=> a + (Number(x && x.delta)||0), 0);
  if(_ptMemo.k === k && _ptMemo.L === L) return _ptMemo.v;
  const valid = [], bad = []; let bal = 0, prevStored = "0", lastValid = "0";
  L.forEach(x=>{
    const ok = x && typeof x === "object" && typeof x.h === "string" && Number.isInteger(x.delta) && x.delta !== 0 && Math.abs(x.delta) <= PT_MAX && bal + x.delta >= 0
      && (x.h === ptHash(prevStored, x) || x.h === ptHash(lastValid, x));
    if(ok){ valid.push(x); bal += x.delta; lastValid = x.h; } else bad.push(x);
    prevStored = x && typeof x.h === "string" ? x.h : prevStored;
  });
  const v = { valid, bad, balance: bal, last: L.length && L[L.length-1] && typeof L[L.length-1].h === "string" ? L[L.length-1].h : lastValid };
  _ptMemo = { k, v, L }; return v;
}
/** Lưu state và xác nhận đã nằm trong localStorage (saveState của lõi có thể ném lỗi hoặc nuốt lỗi) */
function persistOk(markId){
  try{ const r = saveState(); if(r === false) return false; }catch(e){ return false; }
  try{ const raw = localStorage.getItem("fitkit_state_v1"); if(raw && markId && raw.indexOf(markId) < 0) return false; }catch(e){}
  return true;
}
const Points = {
  list(){ return verifyLedger(ledger()).valid.slice().sort((a,b)=> b.ts - a.ts); },
  balance(){ return verifyLedger(ledger()).balance; },
  quarantined(){ return verifyLedger(ledger()).bad.length; },
  has(ref){ return !!ref && ledger().some(x=> x && x.ref === ref); },
  add(delta, reason, ref){
    delta = Math.round(Number(delta)||0); if(!delta || Math.abs(delta) > PT_MAX) return false;
    const L = ledger(), v = verifyLedger(L); if(ref && L.some(x=> x && x.ref === ref)) return false;
    if(delta < 0 && v.balance + delta < 0) return false;
    const x = { id: "pt" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), ts: Date.now(), delta, reason: String(reason||"").slice(0,120), ref: ref || "" };
    x.h = ptHash(v.last, x); L.push(x);
    if(!persistOk(x.id)){ L.pop(); try{ saveState(); }catch(e){} say("Bộ nhớ máy đầy — chưa lưu được điểm. Giải phóng dung lượng rồi thử lại.", "error"); return false; }
    refreshBadges(); return true;
  },
  _verify: ()=> verifyLedger(ledger()),
};
TapEv.points = Points;

/* ---------------------------------------------------------------------
   5. DỮ LIỆU (bộ nhớ đệm + đồng bộ tiến độ + chốt kết quả cuối tháng)
   --------------------------------------------------------------------- */
const C = { ready:false, ts:0, loading:null, err:null, challenges:[], entries:{}, mine:{}, events:[], regs:{}, gifts:[], adminRemote:false, moments:null, momentsTs:0 };
async function safe(p, dflt){ try{ return await p; }catch(e){ if(!(e && e.code === "auth")) warn(e); return dflt; } }
function loadAll(force){
  if(C.loading) return C.loading;
  if(!force && C.ready && Date.now() - C.ts < 15000) return Promise.resolve();
  C.loading = (async ()=>{
    try{
      await cloudEvents.init();
      const today = todayS();
      const [chs, evs, mine, regs, gifts] = await Promise.all([
        cloudEvents.listChallenges(), cloudEvents.listEvents(), safe(cloudEvents.myEntries(), {}), safe(cloudEvents.myRegs(), {}), safe(cloudEvents.myGifts(), [])]);
      C.challenges = arr(chs).filter(c=> c && c.id && (!c.hidden || canCh())).sort((a,b)=> String(a.start).localeCompare(String(b.start)) || String(a.title).localeCompare(String(b.title), "vi"));
      C.events = arr(evs).filter(e=> e && e.id && (!e.hidden || canEv())).sort((a,b)=> isoToTs(a.start) - isoToTs(b.start));
      C.mine = obj(mine); C.regs = obj(regs); C.gifts = arr(gifts);
      const need = C.challenges.filter(c=> chStatus(c, today) !== "ended" || C.mine[c.id] || TE().joined[c.id]);
      const lists = await Promise.all(need.map(c=> safe(cloudEvents.listEntries(c.id, today), [])));
      C.entries = {}; need.forEach((c, i)=> C.entries[c.id] = lists[i]);
      /* đồng bộ trạng thái tham gia giữa máy chủ ↔ máy này */
      const J = TE().joined;
      for(const id in C.mine) if(!J[id]) J[id] = { joinedAt: C.mine[id].joinedAt || Date.now(), baseline: C.mine[id].baseline || null, baselineTs: C.mine[id].baselineTs || 0, manual: [] };
      C.ready = true; C.ts = Date.now(); C.err = null;
      await syncProgress();
      await settleAll();
    }catch(e){ C.err = e; warn(e); }
    finally{ C.loading = null; }
  })();
  return C.loading;
}
function myProgress(ch){ return progress(ch, state, TE().joined[ch.id], todayS()); }
function myRow(ch, pr){ const u = cloudEvents.me(); return { uid:u.uid, name:u.name, value:pr.value, weekValue:pr.weekValue, week:pr.week, done:pr.done, updatedAt: Date.now() }; }
async function syncProgress(){
  const today = todayS(), J = TE().joined;
  for(const ch of C.challenges){
    const j = J[ch.id]; if(!j || chStatus(ch, today) === "upcoming") continue;
    if(chStatus(ch, today) === "ended" && j.pushedFinal) continue;
    const pr = myProgress(ch), sig = `${pr.value}|${pr.week}|${pr.weekValue}|${pr.manual}`;
    if(j.lastPush === sig){ if(chStatus(ch, today) === "ended") j.pushedFinal = true; continue; }
    const r = await safe(cloudEvents.pushProgress(ch.id, { value:pr.value, week:pr.week, weekValue:pr.weekValue, done:pr.done, manual:pr.manual }), null);
    if(r){ j.lastPush = sig; if(chStatus(ch, today) === "ended" || r.locked) j.pushedFinal = true; if(r.flags) j.serverFlags = arr(r.flags); if(r.value != null && !r.locked) j.serverValue = Number(r.value)||0; }
    /* hoàn thành → huy hiệu thử thách (ngay khi đạt, không cần đợi hết tháng) */
    if(pr.done && !TE().badges[ch.id]){ TE().badges[ch.id] = { d: today, title: ch.title, badge: ch.badge || {}, metric: ch.metric }; queueCelebrate({ type:"badge", ch }); }
  }
  save();
}
/* integrator (FIX-security vòng 2 #2): Firebase — nhận voucher hoàn thành từ máy chủ → "ok" | "none" (máy chủ: không đủ điều kiện) | "pending" | "full" */
async function claimFinVoucher(ch, j){
  const S = G.TapShop, vr = `fin_${ch.id}`;
  if(!S || typeof S.grantVoucher !== "function") return "pending";
  if(typeof S.hasVoucherRef === "function" && S.hasVoucherRef(vr)){ delete j.finVoucher; return "ok"; }
  const r = await safe(cloudEvents.claimChallengeVoucher(ch.id), null), sv = r && r.ok && r.voucher;
  if(!sv || !sv.code){ j.finVoucher = r && r.ok === false && !r.pending ? "none" : "pending"; return j.finVoucher; }
  const v = S.grantVoucher({ kind: sv.kind, value: sv.value, min: sv.min, max: sv.max, title: sv.title || "Voucher hoàn thành thử thách", sub: sv.sub || `Hoàn thành ${ch.title}`,
    code: sv.code, exp: sv.exp, src: "challenge", ref: vr, server: true });
  if(!v && !(typeof S.hasVoucherRef === "function" && S.hasVoucherRef(vr))){ j.finVoucher = "pending"; return "full"; }
  delete j.finVoucher; return "ok";
}
async function settleAll(){
  const today = todayS(), J = TE().joined;
  const settledNow = [], cele = []; let full = false;
  for(const ch of C.challenges){
    const j = J[ch.id]; if(!j || j.settled || chStatus(ch, today) !== "ended") continue;
    /* QC-05: tham gia SAU ngày kết thúc (hồi tố) → không xét hạng, không điểm/quà */
    const ja = Number(j.joinedAt) || 0, sj = C.mine[ch.id] && Number(C.mine[ch.id].joinedAt) || 0;
    if((ja && ds(new Date(ja)) > ch.end) || (sj && ds(new Date(sj)) > ch.end)){ Object.assign(j, { settled: Date.now(), rank: 0, total: 0, final: 0, done: false, lateJoin: true }); continue; }
    if(!j.pushedFinal && C.mine[ch.id]) continue;          // chưa gửi được số chốt lên máy chủ → chờ lần tải sau
    const pr0 = progress(ch, state, j, ch.end);
    /* xét thưởng theo số "máy chủ" đã nhận (đã kẹp trần) nếu thấp hơn số tính trên máy */
    const pr = j.serverValue != null && j.serverValue < pr0.value ? Object.assign({}, pr0, { value: j.serverValue, done: j.serverValue >= (Number(ch.target)||1) }) : pr0;
    const entries = C.entries[ch.id] || await safe(cloudEvents.listEntries(ch.id, ch.end), []);
    const board = buildBoard(entries, myRow(ch, pr), "month");
    const res = outcome(ch, board, pr.value);
    /* QC-11: điểm không lưu được (bộ nhớ đầy) → CHƯA chốt thử thách này; lần mở sau thử lại (ref chống cộng trùng) */
    if(!res.points.every(p=> Points.add(p.delta, p.reason, p.ref) || Points.has(p.ref))){ full = true; break; }
    if(pr.done && !TE().badges[ch.id]) TE().badges[ch.id] = { d: ch.end, title: ch.title, badge: ch.badge || {}, metric: ch.metric };
    const u = cloudEvents.me();
    if(res.gift && cloudEvents.mode === "demo"){   // demo: giả lập nhà sáng lập trao quà; firebase: admin bấm "Chốt & trao quà"
      const g = await safe(cloudEvents.createGift({ key:`g_${ch.id}_${u.uid}`, uid:u.uid, name:u.name, title:`Quà hạng ${res.rank}: ${res.gift.title}`, item: res.gift.title, pid: res.gift.pid,
        reason:`Hạng ${res.rank}/${res.total} · ${ch.title}`, month: ch.month || ch.start.slice(0,7), source:{ type:"challenge", id: ch.id, rank: res.rank } }), null);
      if(g) C.gifts.unshift(g);
    }
    if(res.voucher && G.TapShop && typeof G.TapShop.grantVoucher === "function" && cloudEvents.mode === "firebase"){
      /* integrator (FIX-security vòng 2 #2): Firebase — voucher hoàn thành do MÁY CHỦ cấp (claimChallengeVoucher, theo số máy chủ);
         ví chỉ giữ bản sao server:true. Function chưa sẵn sàng → j.finVoucher = "pending", thử lại ở lần tải sau (retryFinVouchers) */
      if((await claimFinVoucher(ch, j)) === "full"){ full = true; break; }
    }
    else if(res.voucher && G.TapShop && typeof G.TapShop.grantVoucher === "function"){ const vr = `fin_${ch.id}`;
      try{ const v = G.TapShop.grantVoucher(Object.assign({ ref: vr }, res.voucher));
        if(!v && !arr(obj(state.tapShop).vouchers).some(x=> x && x.ref === vr)){ full = true; break; } }catch(e){ warn(e); } }
    Object.assign(j, { settled: Date.now(), rank: res.rank, total: res.total, final: pr.value, done: pr.done });
    settledNow.push(j); cele.push({ type:"result", ch, res, value: pr.value });
  }
  /* integrator: voucher hoàn thành chưa nhận được (Function chưa sẵn sàng lúc chốt) → thử lại 1 lần mỗi lượt tải */
  if(!full && cloudEvents.mode === "firebase") for(const ch of C.challenges){ const j = J[ch.id];
    if(j && j.settled && j.finVoucher === "pending" && !settledNow.includes(j) && (await claimFinVoucher(ch, j)) === "full") break; }
  /* quà cộng đồng: check-in ≥ 2 sự kiện offline trong 1 tháng đã qua */
  const byMonth = {};
  for(const id in C.regs){ const r = C.regs[id]; if(r && r.status === "checked_in" && r.checkedInAt){ const m = ds(new Date(r.checkedInAt)).slice(0,7); (byMonth[m] = byMonth[m] || []).push(id); } }
  const curM = today.slice(0,7);
  for(const m in byMonth){
    if(m >= curM || byMonth[m].length < 2 || TE().monthGifts[m]) continue;
    TE().monthGifts[m] = Date.now();
    if(cloudEvents.mode === "demo"){ const u = cloudEvents.me();
      const g = await safe(cloudEvents.createGift({ key:`g_ev_${m}_${u.uid}`, uid:u.uid, name:u.name, title:"Bộ quà cộng đồng: sticker + dây đeo TapEasy", item:"Bộ sticker + dây đeo", pid:"p_sticker",
        reason:`Tham gia ${byMonth[m].length} sự kiện offline tháng ${m.slice(5)}/${m.slice(0,4)}`, month:m, source:{ type:"events", month:m } }), null);
      if(g) C.gifts.unshift(g); }
  }
  /* QC-11: lưu thất bại → hoàn tác cờ "đã chốt" (điểm/voucher có ref nên lần sau không cộng trùng), không chúc mừng */
  if(!save() || full){
    settledNow.forEach(j=>{ delete j.settled; });
    if(settledNow.length || full) say(FULL_MSG, "error");
    return false;
  }
  cele.forEach(c=> queueCelebrate(c));
  return true;
}

/* ---------------------------------------------------------------------
   6. MÀN "SỰ KIỆN" (hub) + điều hướng
   --------------------------------------------------------------------- */
const TABS = [
  { id:"challenges", label:"Thi đua", icon:"te_trophy" },
  { id:"events", label:"Offline", icon:"event" },
  { id:"moments", label:"Khoảnh khắc", icon:"photo_library", stick:"events" },
  { id:"gifts", label:"Quà", icon:"te_gift" },
];
const ADMIN_SECTIONS = [];
let _tab = "challenges", _prev = "home", _evFilter = "all", _boardPeriod = {}, _rendering = false;
TapEv.registerTab = def=>{ if(!def || !def.id || TABS.find(t=> t.id === def.id)) return; let at = def.after ? TABS.findIndex(t=> t.id === def.after) + 1 : TABS.length;
  if(at > 0) while(TABS[at] && TABS[at].stick === def.after) at++;            // "Khoảnh khắc" luôn đứng ngay sau "Offline"
  TABS.splice(at > 0 ? at : TABS.length, 0, def); if(q("#screen-events.active")) renderHub(); };
TapEv.addAdminSection = def=>{ if(def && def.id && !ADMIN_SECTIONS.find(s=> s.id === def.id)) ADMIN_SECTIONS.push(def); };
function ensureScreen(){
  if(q("#screen-events")) return;
  const host = q("#app-scroll"); if(!host) return;
  const sec = document.createElement("section");
  sec.id = "screen-events"; sec.className = "screen te-screen";
  sec.innerHTML = `<div class="topbar te-topbar">
      <button class="icon-btn" data-te="back" aria-label="Quay lại">${icon("arrow_back")}</button>
      <div class="logo">Sự kiện</div>
      <button class="icon-btn te-cart-btn" data-te="cart" aria-label="Giỏ hàng">${icon("te_cart")}<i class="te-dot-n" id="te-cart-n" hidden></i></button>
    </div>
    <div class="content" id="te-content"></div>`;
  host.appendChild(sec);
  try{ if(typeof SUB_SCREENS !== "undefined" && Array.isArray(SUB_SCREENS) && !SUB_SCREENS.includes("events")) SUB_SCREENS.push("events"); }catch(e){}
}
function curScreen(){ const a = q(".screen.active"); return a ? a.id.replace("screen-","") : "home"; }
function openHub(tab, opt){
  ensureScreen();
  if(tab) _tab = tab;
  if(opt && opt.filter) _evFilter = opt.filter;
  const cur = curScreen(); if(cur !== "events") _prev = cur;
  try{ if(typeof closeSheet === "function" && q("#sheet-backdrop.open")) closeSheet(); }catch(e){}
  goto("events");
  renderHub();
  loadAll(!C.ready).then(()=>{ if(curScreen() === "events") renderHub(); });
}
TapEv.open = openHub;
function heroHTML(){
  const pts = Points.balance(), today = todayS();
  let lvl = null; try{ if(G.FKAch) lvl = G.FKAch.evaluate(state, new Date()).level; }catch(e){}
  const active = C.challenges.filter(c=> chStatus(c, today) === "active");
  const joined = active.filter(c=> TE().joined[c.id]).length;
  const tickets = C.events.filter(e=> C.regs[e.id] && C.regs[e.id].status !== "cancelled" && evPhase(e, Date.now()) !== "ended").length;
  const m = Number(today.slice(5,7));
  return `<div class="te-hero">
    <i class="te-orb a" aria-hidden="true"></i><i class="te-orb b" aria-hidden="true"></i>
    <div class="te-hero-top">
      <div><div class="te-eyebrow">Cộng đồng TapEasy · Tháng ${m}</div>
        <h2 class="te-h">Thi đua, gặp gỡ<br>&amp; nhận quà</h2></div>
      <button class="te-pts" data-te="tab" data-id="gifts" aria-label="${nf(pts)} Điểm TapEasy — xem quà và đổi điểm">${icon("te_coin")}<b id="te-hero-pts">${nf(pts)}</b><small>điểm</small></button>
    </div>
    <div class="te-hero-stats">
      <div><b>${joined}/${active.length}</b><span>thử thách đang theo</span></div>
      <div><b>${tickets}</b><span>vé sắp tới</span></div>
      <div><b>${lvl ? "Cấp " + lvl.lvl : Object.keys(TE().badges).length}</b><span>${lvl ? esc(lvl.title) + " · XP" : "huy hiệu thử thách"}</span></div>
    </div>
  </div>`;
}
function tabsHTML(){
  const list = TABS.concat(isAdmin() ? [{ id:"admin", label:"Quản trị", icon:"te_admin" }] : []);
  return `<div class="te-tabs" role="tablist" aria-label="Mục sự kiện">${list.map(t=>
    `<button role="tab" aria-selected="${_tab===t.id}" class="te-tab ${_tab===t.id?"active":""}" data-te="tab" data-id="${t.id}">${icon(t.icon)}<span>${esc(t.label)}</span>${t.id==="gifts" && newGifts().length ? `<i class="te-dot" aria-label="có quà mới"></i>` : ""}</button>`).join("")}</div>`;
}
function renderHub(){
  ensureScreen();
  const box = q("#te-content"); if(!box) return;
  if(_tab === "admin" && !isAdmin()) _tab = "challenges";
  if(!TABS.concat([{ id:"admin" }]).find(t=> t.id === _tab)) _tab = "challenges";
  _rendering = true;
  try{
    const body = !C.ready && C.loading ? (typeof fkSkeleton === "function" ? fkSkeleton(3, "card") : `<p class="small-note">Đang tải…</p>`)
      : !C.ready && C.err ? (typeof fkError === "function" ? fkError("Không tải được dữ liệu sự kiện.", ()=> loadAll(true).then(renderHub)) : `<p class="small-note">Không tải được dữ liệu. <a data-te="reload">Thử lại</a></p>`)
      : tabBody(_tab);
    box.innerHTML = heroHTML() + tabsHTML() + `<div class="te-body" id="te-body" role="tabpanel">${body}</div>`;
    const ext = TABS.find(t=> t.id === _tab);
    if(C.ready && ext && typeof ext.mount === "function") try{ ext.mount(q("#te-body")); }catch(e){ warn(e); }
    if(C.ready && _tab === "admin") mountAdmin(q("#te-body"));
    if(C.ready && _tab === "moments") loadMoments(false);
    refreshBadges();
  }finally{ _rendering = false; }
}
TapEv.render = ()=>{ if(curScreen() === "events") renderHub(); };
function tabBody(t){
  if(t === "challenges") return challengesTab();
  if(t === "events") return eventsTab();
  if(t === "gifts") return giftsTab();
  if(t === "moments") return momentsTab();
  if(t === "admin") return `<div id="te-admin"></div>`;
  const ext = TABS.find(x=> x.id === t);
  if(ext && typeof ext.render === "function") try{ return ext.render(); }catch(e){ warn(e); }
  return "";
}

/* ---------------------------------------------------------------------
   7. THI ĐUA THÁNG
   --------------------------------------------------------------------- */
function entriesCount(ch){ const L = C.entries[ch.id]; const n = arr(L).length; const joined = TE().joined[ch.id] && !arr(L).some(e=> e.uid === cloudEvents.me().uid) ? 1 : 0; return n + joined; }
function boardFor(ch, period){
  const pr = TE().joined[ch.id] ? myProgress(ch) : null;
  return buildBoard(C.entries[ch.id] || [], pr ? myRow(ch, pr) : null, period, weekKey(minS(todayS(), ch.end)));
}
function periodLabel(ch){ return `${dm(ch.start)} – ${dm(ch.end)}`; }
/* Mục nội dung chi tiết (lịch trình, điều kiện, quà, an toàn) */
function listSec(title, ic, items, cls){
  items = arr(items).map(x=> String(x == null ? "" : x).trim()).filter(Boolean); if(!items.length) return "";
  return `<section class="te-sec ${cls||""}"><div class="card-title">${icon(ic)}${esc(title)}</div><ul class="te-ul">${items.map(x=> `<li>${esc(x)}</li>`).join("")}</ul></section>`;
}
function agendaSec(list){
  list = arr(list).filter(a=> a && (a.x || a.t)); if(!list.length) return "";
  return `<section class="te-sec"><div class="card-title">${icon("schedule")}Lịch trình</div><ol class="te-agenda">${list.map(a=> `<li><time>${esc(a.t || "")}</time><span>${esc(a.x || "")}</span></li>`).join("")}</ol></section>`;
}
const parseAgenda = txt=> String(txt||"").split(/\n+/).map(l=> l.trim()).filter(Boolean).slice(0, 20).map(l=>{ const m = l.match(/^(\d{1,2}[:h.]\d{2})\s*(?:[|–—-]\s*)?(.+)$/); return m ? { t: m[1].replace(/[h.]/, ":").padStart(5, "0"), x: m[2].trim().slice(0, 160) } : { t:"", x: l.slice(0, 160) }; });
const parseLines = (txt, n)=> String(txt||"").split(/\n+/).map(l=> l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, n || 12).map(l=> l.slice(0, 200));
function chCardHTML(ch){
  const today = todayS(), st = chStatus(ch, today), j = TE().joined[ch.id], M = METRICS[ch.metric] || METRICS.manual;
  const pr = j && st !== "upcoming" ? (st === "ended" ? progress(ch, state, j, ch.end) : myProgress(ch)) : null;
  const b = j && st !== "upcoming" ? boardFor(ch, "month") : null;
  const n = entriesCount(ch);
  const earned = !!TE().badges[ch.id];
  const when = st === "active" ? `còn ${daysLeft(ch, today)} ngày` : st === "upcoming" ? `bắt đầu ${dm(ch.start)}` : "đã kết thúc";
  const hasCover = mediaN(ch) > 0;
  return `<article class="te-ch ${ch.color==="coral"?"coral":"mint"} ${st}${hasCover ? " has-cover" : ""}" data-te="ch" data-id="${escAttr(ch.id)}" role="button" tabindex="0" aria-label="${escAttr(ch.title)}">
    ${hasCover ? `<div class="te-ch-cover fk-dark-island">${coverBox(ch, `<div class="te-ch-fb ${ch.color==="coral"?"coral":"mint"}"></div>`, { badges:false })}<span class="te-ch-when">${icon(M.icon)}${esc(M.label)}</span></div>` : ""}
    <div class="te-ch-badge ${earned ? "" : "locked"}">${chBadgeSVG(ch, 64)}</div>
    <div class="te-ch-body">
      <div class="te-ch-meta"><span class="te-chip">${icon(M.icon)}${esc(periodLabel(ch))}</span><span>${when}</span></div>
      <h4>${esc(ch.title)}</h4>
      ${pr ? `<div class="te-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${Number(ch.target)||0}" aria-valuenow="${Number(pr.value)||0}"><i style="width:${Math.round(pr.pct*100)}%"></i></div>
        <div class="te-ch-prog"><b>${nf(pr.value, ch.metric==="run_km"||ch.metric==="weight_loss"?1:0)}</b>/${nf(ch.target,1)} ${esc(ch.unit||M.unit)}${pr.done ? ` · <span class="te-ok">${icon("check")}Hoàn thành</span>` : ""}
          ${b && b.me ? `<span class="te-rank">${icon("te_podium")}#${b.me.rank}<small>/${b.total}</small></span>` : ""}</div>`
        : st === "ended" ? `<div class="te-ch-sub">Đã kết thúc ${dmy(ch.end)} · mục tiêu ${nf(ch.target,1)} ${esc(ch.unit||M.unit)}</div>`
        : `<div class="te-ch-sub">${icon("te_people")}${nf(n)} người · +${nf(ch.points)} điểm${Number(ch.giftTop) ? ` · Top ${Number(ch.giftTop)} nhận quà` : ""}</div>`}
    </div>
    ${!j && st !== "ended" ? `<button class="btn btn-primary btn-sm te-join" data-te="join" data-id="${escAttr(ch.id)}">Tham gia</button>` : `<span class="te-chev">${icon("chevron_right")}</span>`}
  </article>`;
}
function challengesTab(){
  const today = todayS();
  const g = { active:[], upcoming:[], ended:[] };
  C.challenges.forEach(c=> g[chStatus(c, today)].push(c));
  g.ended.sort((a,b)=> String(b.end).localeCompare(String(a.end)));
  const ng = newGifts();
  return `${ng.length ? giftBannerHTML(ng[0]) : ""}
    ${g.active.length ? `<div class="section-title"><h3>Đang diễn ra</h3><span class="small-note">Tiến độ tự cập nhật từ nhật ký</span></div>
      <div class="te-list">${g.active.map(chCardHTML).join("")}</div>` : (typeof fkEmpty === "function" ? fkEmpty("te_trophy", "Chưa có thử thách tháng này", "Nhà sáng lập sẽ sớm mở thử thách mới — quay lại sau nhé!", null) : "")}
    ${g.upcoming.length ? `<div class="section-title"><h3>Sắp tới</h3></div><div class="te-list">${g.upcoming.map(chCardHTML).join("")}</div>` : ""}
    ${g.ended.length ? `<details class="te-ended"><summary><span>Đã kết thúc (${g.ended.length})</span>${icon("chevron_right")}</summary><div class="te-list">${g.ended.slice(0, 12).map(chCardHTML).join("")}</div></details>` : ""}
    <div class="te-how card">
      <div class="card-title">${icon("tips_and_updates")}Cách tính &amp; phần thưởng</div>
      <ul class="te-ul">
        <li>Tiến độ <b>tự động</b> từ dữ liệu bạn đã ghi: buổi tập, nước, cân nặng, bài chạy, nhật ký ăn, giấc ngủ.</li>
        <li>Hoạt động ngoài app (chạy bằng đồng hồ, lớp nhóm) → <b>nhập tay và xác nhận trung thực</b>; ban tổ chức có thể đối chiếu ảnh chụp khi trao giải.</li>
        <li>Hoàn thành → huy hiệu thử thách + điểm; Top 1/2/3 cộng thêm ${RANK_BONUS.map(nf).join("/")} điểm và nhận quà (giao miễn phí).</li>
        <li>Bảng xếp hạng có <b>Tuần này</b> (Thứ Hai – Chủ nhật) và <b>Cả tháng</b>.</li>
      </ul>
    </div>`;
}
function podiumHTML(rows, ch){
  const top = rows.slice(0, 3); if(top.length < 3) return "";
  const order = [top[1], top[0], top[2]];
  const dig = ch.metric === "run_km" || ch.metric === "weight_loss" ? 1 : 0;
  return `<div class="te-podium" aria-hidden="true">${order.map((r, i)=> `<div class="te-pod p${[2,1,3][i]} ${r.me ? "me" : ""}">
      <span class="te-av">${esc(initials(r.name))}</span><b>${esc(shortName(r.name))}</b><small>${nf(r.score, dig)} ${esc(ch.unit||"")}</small>
      <div class="te-pod-bar"><span>${r.rank}</span></div></div>`).join("")}</div>`;
}
const initials = n=>{ const p = String(n||"?").trim().split(/\s+/); return ((p.length > 1 ? p[p.length-2][0] : "") + (p[p.length-1][0]||"")).toUpperCase(); };
const shortName = n=>{ const p = String(n||"").trim().split(/\s+/); return p.length > 2 ? p.slice(-2).join(" ") : p.join(" "); };
function boardHTML(ch){
  const period = _boardPeriod[ch.id] || (chStatus(ch, todayS()) === "ended" ? "month" : "week");
  const b = boardFor(ch, period), dig = ch.metric === "run_km" || ch.metric === "weight_loss" ? 1 : 0;
  const rows = b.rows, show = rows.slice(0, 20);
  if(b.me && !show.includes(b.me)) show.push(b.me);   // đồng hạng (1-2-2-4) có thể đẩy "Bạn" ra sau vị trí 20 dù hạng ≤ 20
  return `<div class="te-board" id="te-board-${escAttr(ch.id)}">
    <div class="te-seg" role="tablist" aria-label="Kỳ xếp hạng">
      <button role="tab" aria-selected="${period==="week"}" class="${period==="week"?"active":""}" data-te="period" data-id="${escAttr(ch.id)}" data-p="week">Tuần này</button>
      <button role="tab" aria-selected="${period==="month"}" class="${period==="month"?"active":""}" data-te="period" data-id="${escAttr(ch.id)}" data-p="month">Cả tháng</button>
    </div>
    ${rows.length ? podiumHTML(rows, ch) : ""}
    <ol class="te-rows">${show.map(r=> `<li class="${r.me ? "me" : ""}"><span class="te-rk">${r.rank}</span><span class="te-av sm">${esc(initials(r.name))}</span>
      <span class="te-nm">${esc(r.name)}${r.me ? ` <em>Bạn</em>` : ""}${r.done && period==="month" ? ` <span class="te-ok" title="Đã hoàn thành">${icon("check")}</span>` : ""}</span>
      <b>${nf(r.score, dig)}<small> ${esc(ch.unit||"")}</small></b></li>`).join("") || `<li class="te-empty-row">Chưa có ai — hãy là người đầu tiên!</li>`}</ol>
    ${cloudEvents.mode === "demo" ? `<p class="small-note">Bản thử nghiệm: bảng xếp hạng gồm người chơi mẫu để bạn hình dung.</p>` : ""}
  </div>`;
}
function dailyBarsHTML(ch, pr){
  const days = []; for(let d = ch.start; d <= ch.end && days.length < 40; d = addD(d, 1)) days.push(d);
  const today = todayS(), mx = Math.max(1, ...days.map(d=> pr.daily[d]||0));
  return `<div class="te-days" aria-label="Tiến độ theo ngày">${days.map(d=> { const v = pr.daily[d]||0; return `<i class="${v ? "on" : ""} ${d===today?"today":""} ${d>today?"future":""}" style="--h:${Math.max(v?18:6, Math.round(v/mx*100))}%" title="${dm(d)}: ${nf(v,1)}"></i>`; }).join("")}</div>
    <div class="te-days-cap"><span>${dm(ch.start)}</span><span>${dm(ch.end)}</span></div>`;
}
function openChallenge(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  const today = todayS(), st = chStatus(ch, today), j = TE().joined[ch.id], M = METRICS[ch.metric] || METRICS.manual;
  const pr = j && st !== "upcoming" ? progress(ch, state, j, st === "ended" ? ch.end : today) : null;
  const dig = ch.metric === "run_km" || ch.metric === "weight_loss" ? 1 : 0;
  const gifts = arr(ch.gifts);
  const manualBtn = j && st === "active" ? (M.manual === "add" ? `<button class="btn btn-outline btn-sm" data-te="manual" data-id="${escAttr(ch.id)}">${icon("edit")}Nhập tay</button>`
    : M.manual === "weighin" ? `<button class="btn btn-outline btn-sm" data-te="weighin" data-id="${escAttr(ch.id)}">${icon("monitor_weight")}Cân hôm nay</button>`
    : M.manual === "log-water" ? `<button class="btn btn-outline btn-sm" data-te="goto" data-id="nutrition">${icon("water_drop")}Ghi nước</button>`
    : M.manual === "log-food" ? `<button class="btn btn-outline btn-sm" data-te="goto" data-id="nutrition">${icon("restaurant")}Ghi bữa ăn</button>`
    : M.manual === "log-sleep" ? `<button class="btn btn-outline btn-sm" data-te="goto" data-id="sleep">${icon("bedtime")}Ghi giấc ngủ</button>` : "") : "";
  sheet(`<div class="sheet-header"><h3>Thử thách</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    ${mediaN(ch) ? `<div class="te-gal-wrap fk-dark-island">${galleryBox(ch, `<div class="te-ch-fb ${ch.color==="coral"?"coral":"mint"}"></div>`, { label: "Ảnh thử thách", eager:true })}</div>` : ""}
    <div class="te-chd ${ch.color==="coral"?"coral":"mint"}">
      <div class="te-chd-badge ${TE().badges[ch.id] ? "" : "locked"}">${chBadgeSVG(ch, 96)}</div>
      <div><div class="te-chd-st st-${st}">${st==="active" ? `Đang diễn ra · còn ${daysLeft(ch, today)} ngày` : st==="upcoming" ? `Bắt đầu ${dmy(ch.start)}` : `Đã kết thúc ${dmy(ch.end)}`}</div>
        <h3 class="te-chd-t">${esc(ch.title)}</h3><div class="small-note">${esc(periodLabel(ch))} · Mục tiêu ${nf(ch.target,1)} ${esc(ch.unit||M.unit)}</div></div>
    </div>
    ${pr ? `<div class="te-my card">
        <div class="te-my-top"><div class="te-my-num"><b>${nf(pr.value, dig)}</b><span>/ ${nf(ch.target,1)} ${esc(ch.unit||M.unit)}</span></div>
          <div class="te-my-pct">${Math.round(pr.pct*100)}%</div></div>
        <div class="te-bar lg"><i style="width:${Math.round(pr.pct*100)}%"></i></div>
        ${ch.metric !== "weight_loss" ? dailyBarsHTML(ch, pr) : ""}
        <p class="small-note">${esc(M.src)}${pr.est ? " Một số bài chạy được ước tính theo thời gian." : ""}</p>
        ${pr.note ? `<p class="small-note te-note">${esc(pr.note)}</p>` : ""}
        ${pr.manual ? `<p class="small-note">Trong đó nhập tay: ${nf(pr.manual, dig)} ${esc(ch.unit||M.unit)}.</p>` : ""}
        ${j.settled ? `<div class="te-result">${icon("te_medal")}Kết quả: hạng <b>#${Number(j.rank)||0}</b>/${Number(j.total)||0}${j.done ? " · Hoàn thành" : ""}</div>` : ""}
        <div class="te-row-btns">${manualBtn}</div>
      </div>` : ""}
    <p class="te-desc">${esc(ch.desc || "")}</p>
    ${listSec("Luật & cách tính", "tips_and_updates", ch.rules)}
    ${listSec("Điều kiện tham gia", "info", ch.eligibility)}
    ${listSec("An toàn là trên hết", "tm_shield", ch.safety, "safe")}
    <div class="te-rewards">
      <div>${icon("te_coin")}<b>+${nf(ch.points)} điểm</b><span>khi hoàn thành</span></div>
      <div>${icon("te_podium")}<b>+${RANK_BONUS.map(nf).join(" / ")}</b><span>hạng 1 / 2 / 3</span></div>
      ${Number(ch.giftTop) && gifts.length ? `<div>${icon("te_gift")}<b>Top ${Number(ch.giftTop)} nhận quà</b><span>${esc(gifts.slice(0, Number(ch.giftTop)).map(g=> g.title||g).join(" · "))}</span></div>` : ""}
    </div>
    ${st !== "upcoming" ? `<div class="section-title"><h3>Bảng xếp hạng</h3><span class="small-note">${nf(entriesCount(ch))} người</span></div>${boardHTML(ch)}` : ""}
    ${!j && st !== "ended" ? `<button class="btn btn-primary btn-block" data-te="join" data-id="${escAttr(ch.id)}">${icon("te_trophy")}Tham gia thử thách</button>` : ""}
    ${j && st !== "ended" ? `<button class="btn btn-ghost btn-block" data-te="leave" data-id="${escAttr(ch.id)}">Rời thử thách</button>` : ""}
  `, { id:"ch:" + ch.id });
}
function bmiOf(){ const P = state.profile || {}; const h = (Number(P.height)||0)/100; return h ? Number(P.weight)/(h*h) : 22; }
async function joinChallenge(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  if(cloudEvents.mode === "firebase" && !(typeof cloud !== "undefined" && cloud.user)){ askLogin("tham gia thử thách"); return; }
  if(ch.metric === "weight_loss"){
    const P = state.profile || {}, bmi = bmiOf();
    if(bmi < 18.5 || (Number(P.age) && Number(P.age) < 18)){
      sheet(`<div class="sheet-header"><h3>Chưa phù hợp</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
        <div class="te-warn">${icon("warning")}<p>Thử thách giảm cân không dành cho bạn lúc này (BMI ${nf(bmi,1)}${Number(P.age) < 18 ? ", dưới 18 tuổi" : ""}). Giảm cân khi đã thiếu cân hoặc đang tuổi phát triển có thể ảnh hưởng sức khoẻ.</p></div>
        <p class="small-note">Bạn có thể tham gia thử thách tập luyện, uống nước hoặc ghi nhật ký ăn uống — vẫn được điểm và quà như nhau.</p>
        <button class="btn btn-primary btn-block" data-te="close">Xem thử thách khác</button>`); return;
    }
    const w = Number(P.weight) || "";
    sheet(`<div class="sheet-header"><h3>Cân mốc trước khi bắt đầu</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
      <p class="small-note">Cân vào buổi sáng, sau khi đi vệ sinh và trước khi ăn uống, mặc đồ nhẹ — các lần cân sau cũng làm giống vậy để số liệu chính xác.</p>
      <div class="field"><label for="te-w0">Cân nặng hiện tại (kg)</label><input id="te-w0" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="${w}"></div>
      <div class="te-warn soft">${icon("info")}<p>Mức an toàn là 0,5–1% cân nặng mỗi tuần (khoảng ${nf((Number(w)||65)*0.005,1)}–${nf((Number(w)||65)*0.01,1)} kg/tuần). Bảng xếp hạng chỉ tính tối đa 1%/tuần. Đang mang thai/cho con bú hoặc có bệnh mạn tính: hỏi ý kiến bác sĩ trước.</p></div>
      <div class="te-warn" id="te-w0-warn" hidden role="alert">${icon("warning")}<p id="te-w0-wt"></p></div>
      <button class="btn btn-primary btn-block" id="te-w0-go">Tham gia</button>`);
    /* QC-09: mốc lệch > 5% so với lần cân gần nhất (≤ 14 ngày) / hồ sơ → cảnh báo + xác nhận; bảng xếp hạng vẫn kẹp mốc ≤ 105% (progress) */
    const lastW = weighInsList().filter(x=> Number(x.ts) >= Date.now() - 14*864e5).pop();
    const ref = lastW ? lastW.w : (Number(P.weight) > 25 ? Number(P.weight) : 0);
    let warned = false;
    q("#te-w0").addEventListener("input", ()=>{ warned = false; const b = q("#te-w0-warn"); if(b) b.hidden = true; });
    q("#te-w0-go").addEventListener("click", async ()=>{
      const v = Number(String(q("#te-w0").value).replace(",", "."));
      if(!(v >= 30 && v <= 250)){ say("Nhập cân nặng từ 30 đến 250 kg", "error"); return; }
      if(ref && Math.abs(v - ref) / ref > 0.05 && !warned){
        warned = true; const b = q("#te-w0-warn"), t = q("#te-w0-wt");
        if(t) t.textContent = `Mốc ${nf(v,1)} kg lệch ${Math.round(Math.abs(v/ref - 1)*100)}% so với ${lastW ? "lần cân gần nhất" : "cân nặng trong hồ sơ"} (${nf(ref,1)} kg). Hãy cân lại buổi sáng. Bảng xếp hạng chỉ dùng mốc tối đa ${nf(ref*1.05,1)} kg. Bấm “Tham gia” lần nữa nếu số này đúng.`;
        if(b) b.hidden = false; return;
      }
      const ts = Date.now();
      state.inbodyLogs = arr(state.inbodyLogs); state.inbodyLogs.push({ id: "te" + ts.toString(36), ts, source:"manual", weight: v, bodyFatPct:null, muscleMassKg:null, bodyWaterPct:null, visceralFat:null, note:"Cân mốc thử thách TapEasy" });
      await doJoin(ch, { baseline: v, baselineTs: ts - 1000, baselineDate: todayS() });
    });
    return;
  }
  await doJoin(ch, {});
}
async function doJoin(ch, extra){
  try{
    await cloudEvents.joinChallenge(ch.id, extra.baseline ? { baseline: extra.baseline, baselineTs: extra.baselineTs } : {});
    TE().joined[ch.id] = Object.assign({ joinedAt: Date.now(), manual: [] }, TE().joined[ch.id] || {}, extra);
    save();
    C.entries[ch.id] = await safe(cloudEvents.listEntries(ch.id, todayS()), C.entries[ch.id] || []);
    await syncProgress();
    say(chStatus(ch, todayS()) === "upcoming" ? "Đã đăng ký — thử thách bắt đầu " + dm(ch.start) : "Đã tham gia! Tiến độ tự tính từ nhật ký của bạn", "te_trophy");
    openChallenge(ch.id); rerender();
  }catch(e){ say(e.message || "Không tham gia được", "error"); }
}
function leaveChallenge(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  confirmDialog("Rời thử thách?", "Tiến độ nhập tay của thử thách này sẽ bị xoá và bạn không còn trên bảng xếp hạng.", async ()=>{
    try{ await cloudEvents.leaveChallenge(id); delete TE().joined[id]; save(); C.entries[id] = await safe(cloudEvents.listEntries(id, todayS()), []); say("Đã rời thử thách", "logout"); rerender(); }
    catch(e){ say(e.message, "error"); }
  }, "Rời thử thách", "logout");
}
function openManual(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  const M = METRICS[ch.metric] || METRICS.manual, j = TE().joined[ch.id]; if(!j) return;
  const today = todayS();
  if(!isDs(ch.start) || !isDs(ch.end)){ say("Thử thách có ngày không hợp lệ — báo ban tổ chức nhé.", "error"); return; }   // QS-11: ngày do nhân sự nhập chỉ nhận YYYY-MM-DD
  const max = minS(today, ch.end), cap = DAILY_CAP[ch.metric] != null ? DAILY_CAP[ch.metric] : (M.manualMax || 100);
  const prNow = myProgress(ch);
  const list = arr(j.manual).slice().sort((a,b)=> String(b.d).localeCompare(String(a.d)));
  sheet(`<div class="sheet-header"><h3>Nhập tay · ${esc(M.label)}</h3><button class="icon-btn" data-te="ch" data-id="${escAttr(ch.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <p class="small-note">${esc(M.manualHint || "")} Tối đa ${nf(cap,1)} ${esc(ch.unit||M.unit)}/ngày (tính cả phần app tự ghi).${prNow.manualPct ? ` Hiện nhập tay chiếm ${prNow.manualPct}% tiến độ của bạn${prNow.manualPct > 30 ? " — ban tổ chức sẽ đối chiếu bằng chứng khi trao giải" : ""}.` : ""}</p>
    <div class="field-row">
      <div class="field"><label for="te-m-d">Ngày</label><input id="te-m-d" type="date" min="${escAttr(ch.start)}" max="${escAttr(max)}" value="${escAttr(max)}"></div>
      <div class="field"><label for="te-m-v">${esc(ch.unit || M.unit)}</label><input id="te-m-v" type="text" inputmode="decimal" autocomplete="off" maxlength="6" placeholder="VD: ${ch.metric==="run_km" ? "5,2" : "1"}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label for="te-m-n">Ghi chú / bằng chứng (tuỳ chọn)</label><input id="te-m-n" type="text" maxlength="120" placeholder="VD: Strava — chạy sáng công viên"></div>
    <label class="te-check"><input type="checkbox" id="te-m-ok"><span>Tôi xác nhận số liệu này là <b>trung thực</b>. Ban tổ chức có thể yêu cầu ảnh chụp đồng hồ/ứng dụng để đối chiếu khi trao giải; gian lận sẽ bị loại khỏi bảng xếp hạng.</span></label>
    <button class="btn btn-primary btn-block" id="te-m-go">Lưu</button>
    ${list.length ? `<div class="section-title"><h3>Đã nhập</h3></div><div class="te-mlist">${list.slice(0, 30).map(x=> `<div class="list-item"><div class="info"><div class="name">${dm(x.d)} · ${nf(x.v,1)} ${esc(ch.unit||M.unit)}</div>${x.note ? `<div class="meta">${esc(x.note)}</div>` : ""}</div>
      <button class="icon-btn" data-te="manual-del" data-id="${escAttr(ch.id)}" data-x="${escAttr(x.id)}" aria-label="Xoá mục ${dm(x.d)}">${icon("delete")}</button></div>`).join("")}</div>` : ""}
  `);
  q("#te-m-go").addEventListener("click", async ()=>{
    const d = q("#te-m-d").value, v = Number(String(q("#te-m-v").value).replace(",", ".")), note = String(q("#te-m-n").value || "").trim().slice(0, 120);
    if(!isDs(d) || d < ch.start || d > max){ say("Chọn ngày trong thời gian thử thách, không ở tương lai", "error"); return; }
    if(!(v > 0) || v > (M.manualMax || 100)){ say(`Giá trị từ ${M.step||1} đến ${M.manualMax||100}`, "error"); return; }
    /* QC-04: trần/ngày tính cả phần app tự ghi (buổi đã "Kết thúc", bài chạy trong giáo án) */
    const auto = Math.max(0, (Number(prNow.daily[d])||0) - arr(j.manual).filter(x=> x.d === d).reduce((a,x)=> a + Number(x.v), 0));
    const sameDay = Math.min(cap, Number(prNow.daily[d])||0);
    if(sameDay + v > cap + 1e-9){ say(`Tối đa ${nf(cap,1)} ${ch.unit||M.unit}/ngày${auto ? ` — app đã tự ghi ${nf(Math.min(auto, cap),1)} cho ngày này` : ""}. Kiểm tra lại số liệu`, "error"); return; }
    if(!q("#te-m-ok").checked){ say("Hãy tích xác nhận số liệu trung thực", "error"); return; }
    j.manual = arr(j.manual); j.manual.push({ id: "m" + Date.now().toString(36), d, v: round1(v), note, ts: Date.now() });
    save(); await syncProgress(); say("Đã lưu tiến độ", "check_circle"); openChallenge(ch.id); rerender();
  });
}
async function deleteManual(chId, xid){
  const j = TE().joined[chId]; if(!j) return;
  j.manual = arr(j.manual).filter(x=> x.id !== xid); save(); await syncProgress(); openManual(chId); rerender();
}
function openWeighIn(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  const last = (weighInsList().pop() || {}).w || state.profile.weight || "";
  sheet(`<div class="sheet-header"><h3>Cân hôm nay</h3><button class="icon-btn" data-te="ch" data-id="${escAttr(ch.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <p class="small-note">Cân buổi sáng, sau vệ sinh, trước ăn — cùng một chiếc cân. Cân 1–2 lần/tuần là đủ; cân nặng dao động 0,5–1 kg trong ngày là bình thường.</p>
    <div class="field"><label for="te-wi">Cân nặng (kg)</label><input id="te-wi" type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="${last}"></div>
    <label class="te-check"><input type="checkbox" id="te-wi-ok"><span>Tôi xác nhận số cân trung thực.</span></label>
    <button class="btn btn-primary btn-block" id="te-wi-go">Lưu vào nhật ký InBody</button>`);
  q("#te-wi-go").addEventListener("click", async ()=>{
    const v = Number(String(q("#te-wi").value).replace(",", "."));
    if(!(v >= 30 && v <= 250)){ say("Nhập cân nặng từ 30 đến 250 kg", "error"); return; }
    if(!q("#te-wi-ok").checked){ say("Hãy tích xác nhận", "error"); return; }
    state.inbodyLogs = arr(state.inbodyLogs); const ts = Date.now();
    state.inbodyLogs.push({ id:"te" + ts.toString(36), ts, source:"manual", weight:v, bodyFatPct:null, muscleMassKg:null, bodyWaterPct:null, visceralFat:null, note:"Cân thử thách TapEasy" });
    save(); await syncProgress(); say("Đã lưu cân nặng", "monitor_weight"); openChallenge(ch.id); rerender();
  });
}
const weighInsList = ()=> arr(state.inbodyLogs).filter(l=> l && Number(l.weight) > 0).sort((a,b)=> a.ts - b.ts).map(l=> ({ w: Number(l.weight), ts: l.ts }));

/* ---------------------------------------------------------------------
   8. SỰ KIỆN OFFLINE
   --------------------------------------------------------------------- */
const myReg = id=>{ const r = C.regs[id]; return r && r.status !== "cancelled" ? r : null; };
function whenText(ev, long){
  const s = isoToTs(ev.start); if(!isFinite(s)) return "";
  const d = new Date(s), e = ev.end ? hm(ev.end) : "";
  return long ? `${DOW[d.getDay()]}, ${dmy(ev.start)} · ${hm(ev.start)}${e ? "–" + e : ""}` : `${DOW_S[d.getDay()]} ${dm(ev.start)} · ${hm(ev.start)}`;
}
function evCardHTML(ev){
  const ph = evPhase(ev, Date.now()), r = myReg(ev.id), S = SPORTS[ev.sport] || SPORTS.other;
  const d = new Date(isoToTs(ev.start)), cap = Number(ev.capacity)||0, cnt = Number(ev.regCount)||0, full = cap && cnt >= cap;
  return `<article class="te-ev ${ph}" data-te="ev" data-id="${escAttr(ev.id)}" role="button" tabindex="0" aria-label="${escAttr(ev.title)}, ${escAttr(whenText(ev, true))}">
    <div class="te-ev-cover sp-${escAttr(ev.sport||"other")} fk-dark-island">${coverBox(ev, sportArt(ev.sport))}
      <div class="te-ev-date"><b>${isFinite(d) ? d.getDate() : ""}</b><small>TH${isFinite(d) ? d.getMonth()+1 : ""}</small></div>
      ${r ? `<span class="te-ev-tag ${r.status==="checked_in"?"ok":""}">${icon(r.status==="checked_in" ? "check" : "te_ticket")}${r.status==="checked_in" ? "Đã điểm danh" : "Đã đăng ký"}</span>`
        : ph === "ended" ? `<span class="te-ev-tag dim">Đã diễn ra</span>` : full ? `<span class="te-ev-tag dim">Hết chỗ</span>` : ""}
    </div>
    <div class="te-ev-body">
      <div class="te-ev-sport">${icon(S.icon)}${esc(S.label)} · ${esc(ev.city||"")}</div>
      <h4>${esc(ev.title)}</h4>
      <div class="te-ev-meta"><span>${icon("schedule")}${esc(whenText(ev))}</span><span>${icon("location_on")}${esc(ev.venue||"")}</span></div>
      <div class="te-ev-foot">
        ${ph === "ended" ? (ev.reviewCount ? `<span class="te-rv-mini">${starsHTML(ev.rating, 13)}<small>${nf(ev.rating,1)} · ${nf(ev.reviewCount)} review${Number(ev.momentCount) > Number(ev.reviewCount) ? ` · ${nf(ev.momentCount)} khoảnh khắc` : ""}</small></span>` : ev.momentCount ? `<small class="te-dim">${nf(ev.momentCount)} khoảnh khắc</small>` : `<small class="te-dim">Chưa có review</small>`)
          : `<div class="te-cap" aria-label="${cnt}/${cap} chỗ"><i style="width:${cap ? Math.min(100, Math.round(cnt/cap*100)) : 0}%"></i></div><small>${nf(cnt)}/${nf(cap)} chỗ</small>`}
        <b class="te-fee ${Number(ev.fee) ? "" : "free"}">${Number(ev.fee) ? money(ev.fee) : "Miễn phí"}</b>
        <span class="te-ptag">+${nf(ev.points)}</span>
      </div>
    </div>
  </article>`;
}
function eventsTab(){
  const now = Date.now();
  const sports = Array.from(new Set(C.events.map(e=> e.sport||"other")));
  let list = C.events.slice();
  if(_evFilter === "mine") list = list.filter(e=> myReg(e.id));
  else if(_evFilter !== "all") list = list.filter(e=> (e.sport||"other") === _evFilter);
  const up = list.filter(e=> evPhase(e, now) !== "ended"), past = list.filter(e=> evPhase(e, now) === "ended").reverse();
  const nMine = C.events.filter(e=> myReg(e.id) && evPhase(e, now) !== "ended").length;
  return `<div class="te-filter" role="tablist" aria-label="Lọc sự kiện">
      <button class="pill ${_evFilter==="all"?"active":""}" data-te="evf" data-id="all">Tất cả</button>
      <button class="pill ${_evFilter==="mine"?"active":""}" data-te="evf" data-id="mine">${icon("te_ticket")}Vé của tôi${nMine ? ` <i>${nMine}</i>` : ""}</button>
      ${sports.map(s=> `<button class="pill ${_evFilter===s?"active":""}" data-te="evf" data-id="${escAttr(s)}">${esc((SPORTS[s]||SPORTS.other).label)}</button>`).join("")}
    </div>
    ${up.length ? `<div class="te-list">${up.map(evCardHTML).join("")}</div>` : (typeof fkEmpty === "function" ? fkEmpty("event", _evFilter === "mine" ? "Bạn chưa có vé nào" : "Chưa có sự kiện sắp tới", _evFilter === "mine" ? "Đăng ký một sự kiện để nhận vé QR và điểm thưởng khi điểm danh." : "Theo dõi để không bỏ lỡ buổi chạy, tập nhóm, workshop tiếp theo.", null, { small:true }) : "")}
    ${past.length ? `<div class="section-title"><h3>Đã diễn ra · ảnh &amp; review</h3></div><div class="te-list">${past.slice(0, 10).map(evCardHTML).join("")}</div>` : ""}
    <p class="small-note te-center">Muốn tổ chức sự kiện cộng đồng? Liên hệ nhà sáng lập TapEasy để được đăng lên app.</p>`;
}
async function openEvent(id, opt){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  const now = Date.now(), ph = evPhase(ev, now), r = myReg(ev.id), S = SPORTS[ev.sport] || SPORTS.other;
  const cap = Number(ev.capacity)||0, cnt = Number(ev.regCount)||0, full = cap && cnt >= cap;
  let actions = "";
  if(ph === "ended"){
    if(r && r.status === "checked_in") actions = `<button class="btn btn-primary btn-block" data-te="review" data-id="${escAttr(ev.id)}">${icon("photo_camera")}${Points.has("rv_" + ev.id) ? "Sửa review & khoảnh khắc" : "Đăng review kèm ảnh/clip"}</button>`;
  } else if(r){
    if(r.status === "checked_in") actions = `<div class="te-okbox">${icon("check_circle")}Bạn đã điểm danh${Points.has("ci_" + ev.id) ? ` · +${nf(ev.points)} điểm` : ""}</div>`
      + (ph === "after" || ph === "live" ? `<button class="btn btn-outline btn-block" data-te="review" data-id="${escAttr(ev.id)}">${icon("photo_camera")}Đăng review kèm ảnh/clip</button>` : "");
    else actions = (canCheckIn(ev, now) ? `<button class="btn btn-primary btn-block" data-te="checkin" data-id="${escAttr(ev.id)}">${icon("te_scan")}Điểm danh ngay</button>` : "")
      + `<button class="btn ${canCheckIn(ev, now) ? "btn-outline" : "btn-primary"} btn-block" data-te="ticket" data-id="${escAttr(ev.id)}">${icon("te_ticket")}Xem vé QR</button>`;
  } else if(full) actions = `<button class="btn btn-outline btn-block" disabled>Đã đủ ${nf(cap)} chỗ</button>`;
  else actions = `<button class="btn btn-primary btn-block" data-te="register" data-id="${escAttr(ev.id)}">${icon("te_ticket")}Đăng ký tham gia${Number(ev.fee) ? " · " + money(ev.fee) : " · Miễn phí"}</button>`;
  sheet(`<div class="sheet-header"><h3>${esc(S.label)}</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <div class="te-gal-wrap sp-${escAttr(ev.sport||"other")} fk-dark-island">${galleryBox(ev, sportArt(ev.sport), { label:"Ảnh & clip sự kiện", eager:true, auto:true })}</div>
    <h3 class="te-evd-t">${esc(ev.title)}</h3>
    <div class="te-evd-info">
      <div>${icon("schedule")}<span>${esc(whenText(ev, true))}</span></div>
      <div>${icon("location_on")}<span><b>${esc(ev.venue||"")}</b><br><small>${esc(ev.address||"")}</small></span></div>
      <div>${icon("te_people")}<span>${nf(cnt)}/${nf(cap)} người đã đăng ký${full ? " — hết chỗ" : ""}</span></div>
      <div>${icon("te_coin")}<span>${Number(ev.fee) ? `Phí ${money(ev.fee)}` : "Miễn phí"} · điểm danh nhận <b>+${nf(ev.points)} điểm</b></span></div>
    </div>
    <a class="btn btn-outline btn-block te-map" href="${escAttr(mapsUrl(ev))}" target="_blank" rel="noopener noreferrer">${icon("te_map")}Chỉ đường (Google Maps)</a>
    <div class="te-evd-actions">${actions}</div>
    ${r && ph !== "ended" && r.status !== "checked_in" ? `<div class="te-row-btns"><button class="btn btn-ghost btn-sm" data-te="ics" data-id="${escAttr(ev.id)}">${icon("te_cal_add")}Thêm vào lịch</button><button class="btn btn-ghost btn-sm" data-te="unreg" data-id="${escAttr(ev.id)}">Huỷ đăng ký</button></div>` : ""}
    <p class="te-desc">${esc(ev.desc||"")}</p>
    ${agendaSec(ev.agenda)}
    ${listSec("Điều kiện tham gia", "info", ev.requirements)}
    ${listSec("Quà & quyền lợi", "te_gift", ev.perks, "perk")}
    ${listSec("Quy định an toàn", "tm_shield", ev.safety, "safe")}
    ${listSec("Mang theo", "te_bag", ev.bring)}
    <p class="small-note">Tổ chức: ${esc(ev.organizer || "TapEasy")}. Tham gia vận động theo sức của mình; nếu có bệnh tim mạch, huyết áp, đang mang thai… hãy hỏi ý kiến bác sĩ trước.</p>
    ${canCI() || canEv() ? `<div class="te-admin-quick"><b>${icon("te_admin")}Ban tổ chức</b><div class="te-row-btns">
      ${canCI() ? `<button class="btn btn-outline btn-sm" data-te="a-regs" data-id="${escAttr(ev.id)}">Danh sách</button>
      <button class="btn btn-outline btn-sm" data-te="a-scan" data-id="${escAttr(ev.id)}">${icon("te_scan")}Quét vé</button>
      <button class="btn btn-outline btn-sm" data-te="a-poster" data-id="${escAttr(ev.id)}">${icon("te_qr")}Mã tại chỗ</button>` : ""}
      ${canEv() ? `<button class="btn btn-outline btn-sm" data-te="a-ev-edit" data-id="${escAttr(ev.id)}">${icon("edit")}Sửa</button>` : ""}
      ${canEv() && ph !== "upcoming" ? `<button class="btn btn-primary btn-sm" data-te="recap" data-id="${escAttr(ev.id)}">${icon("photo_camera")}Đăng bài sau sự kiện</button>` : ""}</div></div>` : ""}
    <div id="te-reviews" class="te-reviews">${ph === "ended" || ev.reviewCount || ev.momentCount ? (typeof fkSkeleton === "function" ? fkSkeleton(2, "list") : "") : ""}</div>
  `, { id:"ev:" + ev.id });
  if(ph === "ended" || ev.reviewCount || ev.momentCount){
    const [list] = await Promise.all([safe(cloudEvents.listReviews(ev.id), []), ensureBlocks()]);
    const box = q("#te-reviews"); if(!box || !q(`[data-sheet-id="ev:${CSS.escape(ev.id)}"]`)) return;
    C.evPosts = list; box.innerHTML = reviewsHTML(list);
  }
}
/* ---------------------------------------------------------------------
   Chặn người dùng (App Store Guideline 1.2) — API thật ở cloud.js: blockUser(uid,{name,reason}) · listBlocked() · isBlockedSync(uid)
   Nội dung (Khoảnh khắc, review, bình luận) của người đã chặn bị ẩn khỏi mọi danh sách vẽ trong module này.
   --------------------------------------------------------------------- */
let _blkTs = 0;
async function ensureBlocks(force){
  try{
    if(typeof cloud === "undefined" || !cloud || !cloud.user || typeof cloud.listBlocked !== "function") return;
    if(!force && _blkTs && Date.now() - _blkTs < 60000) return;
    await cloud.listBlocked(); _blkTs = Date.now();
  }catch(e){ warn(e); }
}
function blockedUid(uid){ try{ return !!(uid && typeof cloud !== "undefined" && cloud && typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid))); }catch(e){ return false; } }
const notBlocked = x=> !blockedUid(x && x.uid);
function canBlock(uid){ return !!(uid && uid !== cloudEvents.me().uid && typeof cloud !== "undefined" && cloud && typeof cloud.blockUser === "function"); }
function blockUserFlow(uid, name, where){
  uid = String(uid || "");
  if(!canBlock(uid)) return;
  if(!cloud.user){ askLogin("chặn người dùng"); return; }
  const nm = cleanName(name) || "người này";
  confirmDialog(`Chặn ${esc(nm)}?`, "Bạn sẽ không còn thấy Khoảnh khắc, review và bình luận của người này; họ cũng không bình luận hay nhắn tin được cho bạn. Bỏ chặn bất cứ lúc nào ở Cộng đồng hoặc màn PT → Người đã chặn.", async ()=>{
    try{
      await cloud.blockUser(uid, { name: nm, reason: String(where || "events").slice(0, 40) });
      _blkTs = Date.now();
      if(C.moments) C.moments = C.moments.filter(notBlocked);
      C.evPosts = arr(C.evPosts).filter(notBlocked);
      try{ closeSheet(); }catch(e){}
      say(`Đã chặn ${nm}`, "te_block"); paintMoments();
    }catch(e){ say(e.message || "Không chặn được người này", "error"); }
  }, "Chặn", "te_block");
}
TapEv.blockUser = blockUserFlow;
function askLogin(what){
  sheet(`<div class="sheet-header"><h3>Cần đăng nhập</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <p class="small-note">Đăng nhập để ${esc(what)} — vé, tiến độ và quà được lưu trên tài khoản của bạn.</p>
    <button class="btn btn-primary btn-block" onclick="closeSheet();showAuth('login')">Đăng nhập / Tạo tài khoản</button>`);
}
function openRegister(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  if(cloudEvents.mode === "firebase" && !(typeof cloud !== "undefined" && cloud.user)){ askLogin("đăng ký sự kiện"); return; }
  const c = TE().contact, P = state.profile || {}, sporty = ["run","hyrox","powerlifting","group"].includes(ev.sport);
  sheet(`<div class="sheet-header"><h3>Đăng ký</h3><button class="icon-btn" data-te="ev" data-id="${escAttr(ev.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <div class="te-reg-ev"><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))} · ${esc(ev.venue||"")}</small></div>
    <div class="field"><label for="te-r-name">Họ tên</label><input id="te-r-name" type="text" maxlength="60" autocomplete="name" value="${escAttr(c.name || P.name || "")}"></div>
    <div class="field" style="margin-top:10px;"><label for="te-r-phone">Số điện thoại</label><input id="te-r-phone" type="tel" inputmode="tel" maxlength="14" autocomplete="tel" placeholder="VD: 0912 345 678" value="${escAttr(c.phone || "")}"></div>
    ${arr(ev.options).length ? `<div class="field" style="margin-top:10px;"><label for="te-r-opt">${ev.sport==="powerlifting" ? "Hạng cân" : ev.sport==="run" ? "Cự ly" : "Lựa chọn"}</label><select id="te-r-opt">${arr(ev.options).map(o=> `<option>${esc(o)}</option>`).join("")}</select></div>` : ""}
    ${sporty ? `<div class="field" style="margin-top:10px;"><label for="te-r-sos">Người liên hệ khẩn cấp (tên – SĐT)</label><input id="te-r-sos" type="text" maxlength="80" placeholder="VD: Mẹ – 0987 654 321" value="${escAttr(c.sos || "")}"></div>` : ""}
    <div class="field" style="margin-top:10px;"><label for="te-r-note">Ghi chú cho BTC (tuỳ chọn)</label><input id="te-r-note" type="text" maxlength="120" placeholder="VD: đi cùng 1 người bạn, ăn chay…"></div>
    <label class="te-check"><input type="checkbox" id="te-r-ok"><span>Tôi đủ sức khoẻ tham gia hoạt động này và tự chịu trách nhiệm vận động trong khả năng. Nếu có bệnh tim mạch, huyết áp, chấn thương hoặc đang mang thai, tôi đã hỏi ý kiến bác sĩ.</span></label>
    ${Number(ev.fee) ? `<div class="te-warn soft">${icon("info")}<p>Phí ${money(ev.fee)} thanh toán tại quầy điểm danh (tiền mặt hoặc chuyển khoản). Huỷ trước 24 giờ không mất phí.</p></div>` : ""}
    <p class="small-note">SĐT chỉ dùng để ban tổ chức liên hệ trong sự kiện, không chia sẻ cho bên thứ ba.</p>
    <button class="btn btn-primary btn-block" id="te-r-go">${icon("te_ticket")}Xác nhận đăng ký</button>`);
  q("#te-r-go").addEventListener("click", async e=>{
    const name = String(q("#te-r-name").value||"").trim(), phone = normPhone(q("#te-r-phone").value);
    if(name.length < 2){ say("Nhập họ tên", "error"); return; }
    if(!validPhone(phone)){ say("Số điện thoại chưa đúng (10 số, bắt đầu 03/05/07/08/09)", "error"); return; }
    if(!q("#te-r-ok").checked){ say("Hãy tích xác nhận sức khoẻ", "error"); return; }
    const sos = q("#te-r-sos") ? String(q("#te-r-sos").value||"").trim().slice(0, 80) : "";
    const info = { name, phone, option: q("#te-r-opt") ? q("#te-r-opt").value : "", sos, note: String(q("#te-r-note").value||"").trim().slice(0,120) };
    Object.assign(TE().contact, { name, phone, sos }); save();
    e.currentTarget.disabled = true;
    try{
      const reg = await cloudEvents.register(ev.id, info);
      C.regs[ev.id] = reg; ev.regCount = (Number(ev.regCount)||0) + 1;
      openTicket(ev.id, { fresh:true }); rerender();   // QC-20: báo thành công ngay trong vé (không dùng toast che nút "Điểm danh ngay")
    }catch(err){ say(err.message || "Không đăng ký được", "error"); const b = q("#te-r-go"); if(b) b.disabled = false; }
  });
}
function openTicket(id, opt){
  const ev = C.events.find(e=> e.id === id), r = myReg(id); if(!ev || !r) return;
  const now = Date.now();
  try{ const t = q("#toast"); if(t) t.classList.remove("show"); }catch(e){}
  sheet(`<div class="sheet-header"><h3>Vé của bạn</h3><button class="icon-btn" data-te="ev" data-id="${escAttr(ev.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    ${opt && opt.fresh ? `<div class="te-okbox" role="status">${icon("check_circle")}Đăng ký thành công — vé QR đã sẵn sàng</div>` : ""}
    <div class="te-ticket">
      <div class="te-tk-top sp-${escAttr(ev.sport||"other")} fk-dark-island">
        <div class="te-tk-brand">TapEasy · ${esc((SPORTS[ev.sport]||SPORTS.other).label)}</div>
        <b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))}</small><small>${esc(ev.venue||"")}</small>
      </div>
      <div class="te-tk-cut" aria-hidden="true"></div>
      <div class="te-tk-qr">${TapQR.svg(qrTicket(ev.id, r.code), { size:208, margin:2, ecl:"Q", label:"Mã QR vé " + r.code })}</div>
      <div class="te-tk-code" aria-label="Mã vé ${r.code.split("").join(" ")}">${esc(r.code)}</div>
      <div class="te-tk-meta"><span>${esc(r.name||"")}</span>${r.option ? `<span>${esc(r.option)}</span>` : ""}<span class="${r.status==="checked_in"?"ok":""}">${r.status==="checked_in" ? "Đã điểm danh" : "Chưa điểm danh"}</span></div>
    </div>
    <p class="small-note te-center">Đưa mã này cho ban tổ chức quét tại quầy, hoặc tự điểm danh bằng mã tại chỗ khi đến nơi. Tăng độ sáng màn hình để quét nhanh hơn.</p>
    ${canCheckIn(ev, now) && r.status !== "checked_in" ? `<button class="btn btn-primary btn-block" data-te="checkin" data-id="${escAttr(ev.id)}">${icon("te_scan")}Điểm danh ngay</button>` : ""}
    <div class="te-row-btns"><button class="btn btn-ghost btn-sm" data-te="ics" data-id="${escAttr(ev.id)}">${icon("te_cal_add")}Thêm vào lịch</button>
      <a class="btn btn-ghost btn-sm" href="${escAttr(mapsUrl(ev))}" target="_blank" rel="noopener noreferrer">${icon("te_map")}Bản đồ</a></div>`);
}
function cancelReg(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  confirmDialog("Huỷ đăng ký?", "Chỗ của bạn sẽ được nhường cho người khác. Bạn có thể đăng ký lại nếu còn chỗ.", async ()=>{
    try{ await cloudEvents.cancelReg(id); if(C.regs[id]) C.regs[id].status = "cancelled"; ev.regCount = Math.max(0, (Number(ev.regCount)||1) - 1); say("Đã huỷ đăng ký", "event_busy"); rerender(); }
    catch(e){ say(e.message, "error"); }
  }, "Huỷ đăng ký", "event_busy");
}
function downloadICS(id){ const ev = C.events.find(e=> e.id === id); if(ev) downloadFile(`tapeasy-${ev.id}.ics`, toICS(ev), "text/calendar;charset=utf-8"); }
function openCheckIn(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  sheet(`<div class="sheet-header"><h3>Điểm danh</h3><button class="icon-btn" data-te="ev" data-id="${escAttr(ev.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <div class="te-reg-ev"><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))}</small></div>
    <div class="te-ci-way"><span class="te-num">1</span><div><b>Quét mã QR tại quầy điểm danh</b><small>Ban tổ chức dán mã “Điểm danh TapEasy” ở cổng/quầy.</small></div></div>
    <button class="btn btn-primary btn-block" id="te-ci-scan">${icon("te_scan")}Mở camera quét mã</button>
    <div class="te-ci-way"><span class="te-num">2</span><div><b>Hoặc nhập mã 6 ký tự</b><small>Do ban tổ chức đọc/ghi trên bảng.</small></div></div>
    <div class="te-code-in"><input id="te-ci-code" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="6" placeholder="VD: K7M2QX" aria-label="Mã điểm danh 6 ký tự"><button class="btn btn-outline" id="te-ci-go">Xác nhận</button></div>
    <p class="small-note">Hoặc đưa <a data-te="ticket" data-id="${escAttr(ev.id)}">vé QR của bạn</a> để ban tổ chức quét.</p>`);
  const inp = q("#te-ci-code");
  inp.addEventListener("input", ()=>{ inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); });
  q("#te-ci-go").addEventListener("click", ()=> doCheckIn(ev, inp.value));
  q("#te-ci-scan").addEventListener("click", ()=> openScanner({
    title:"Quét mã điểm danh", hint:"Hướng camera vào mã QR “Điểm danh TapEasy” tại quầy.", back:{ te:"checkin", id: ev.id },
    onCode: async text=>{ const p = parseQR(text);
      if(!p || p.kind !== "venue"){ say("Đây không phải mã điểm danh TapEasy", "error"); return false; }
      if(p.evId !== ev.id){ say("Mã này thuộc sự kiện khác", "error"); return false; }
      return doCheckIn(ev, p.code); },
  }));
}
async function doCheckIn(ev, code){
  code = String(code||"").toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)){ say("Mã gồm 6 ký tự", "error"); return false; }
  try{
    const r = await cloudEvents.checkIn(ev.id, code);
    C.regs[ev.id] = Object.assign({}, C.regs[ev.id] || {}, r || {}, { status:"checked_in", checkedInAt: (r && r.checkedInAt) || Date.now() });
    const got = Points.add(Number(ev.points)||0, `Điểm danh: ${ev.title}`, "ci_" + ev.id);
    const lost = !got && Number(ev.points) > 0 && !Points.has("ci_" + ev.id);   // QC-11: bộ nhớ đầy → điểm chưa lưu
    celebrateSheet(`Điểm danh thành công!`, got ? `+${nf(ev.points)} Điểm TapEasy đã vào ví của bạn. Chúc bạn một buổi thật vui!` : lost ? "Đã điểm danh — nhưng bộ nhớ máy đầy nên điểm thưởng CHƯA được lưu. Giải phóng dung lượng rồi mở lại vé để nhận điểm." : "Bạn đã điểm danh sự kiện này.", "check_circle", { te:"ev", id: ev.id, label:"Xem sự kiện" });
    rerender(); return true;
  }catch(e){ say(e.message || "Không điểm danh được", "error"); return false; }
}
/* Camera + BarcodeDetector (Chrome/Android, Edge, Samsung). Không hỗ trợ (Safari/iOS) → nhập mã. */
function openScanner(opt){
  const supported = "BarcodeDetector" in G && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  sheet(`<div class="sheet-header"><h3>${esc(opt.title || "Quét mã QR")}</h3><button class="icon-btn" ${opt.back ? `data-te="${escAttr(opt.back.te)}" data-id="${escAttr(opt.back.id||"")}"` : `data-te="close"`} aria-label="Quay lại">${icon("arrow_back")}</button></div>
    ${supported ? `<div class="te-cam"><video id="te-cam-v" playsinline muted></video><i class="te-cam-frame" aria-hidden="true"></i><i class="te-cam-line" aria-hidden="true"></i></div>
      <p class="small-note te-center" id="te-cam-msg">${esc(opt.hint || "")}</p>`
    : `<div class="te-warn soft">${icon("info")}<p>Trình duyệt/thiết bị này chưa hỗ trợ quét QR trong app. Hãy nhập mã bên dưới (hoặc dùng app Camera của máy để đọc mã rồi nhập).</p></div>`}
    <div class="te-code-in"><input id="te-scan-code" type="text" autocapitalize="characters" autocomplete="off" maxlength="40" placeholder="${escAttr(opt.placeholder || "Nhập mã 6 ký tự")}" aria-label="Nhập mã"><button class="btn btn-outline" id="te-scan-go">Xác nhận</button></div>`);
  let stream = null, timer = null, busy = false, stopped = false;
  const stop = ()=>{ stopped = true; clearTimeout(timer); try{ stream && stream.getTracks().forEach(t=> t.stop()); }catch(e){} stream = null; };
  try{ onSheetCloseHook = stop; }catch(e){}
  const handle = async text=>{ if(busy) return; busy = true; let ok = false; try{ ok = await opt.onCode(text); }catch(e){ warn(e); } busy = false; if(ok) stop(); return ok; };
  q("#te-scan-go").addEventListener("click", ()=>{ const v = String(q("#te-scan-code").value||"").trim(); if(v) handle(opt.manualWrap ? opt.manualWrap(v) : v); });
  if(!supported) return;
  (async ()=>{
    try{
      const det = new G.BarcodeDetector({ formats:["qr_code"] });
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" }, audio:false });
      const v = q("#te-cam-v"); if(!v || stopped){ stop(); return; }
      v.srcObject = stream; await v.play();
      const tick = async ()=>{
        if(stopped || !q("#te-cam-v")) { stop(); return; }
        try{ const codes = await det.detect(v); if(codes && codes.length && !busy){ try{ navigator.vibrate && navigator.vibrate(30); }catch(e){} const ok = await handle(codes[0].rawValue); if(ok) return; } }catch(e){}
        timer = setTimeout(tick, 280);
      };
      tick();
    }catch(e){
      const m = q("#te-cam-msg"); if(m) m.textContent = e && e.name === "NotAllowedError" ? "Bạn chưa cho phép dùng camera — bật quyền camera trong Cài đặt hoặc nhập mã bên dưới." : "Không mở được camera — hãy nhập mã bên dưới.";
    }
  })();
}
/* Nén ảnh (canvas → JPEG) trước khi đăng review */
function compressImage(file, maxSide, quality){
  return new Promise((resolve, reject)=>{
    if(!file || !/^image\//.test(file.type)) return reject(new Error("Tệp không phải ảnh"));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{
      try{
        const s = Math.min(1, (maxSide||1080) / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth*s)), h = Math.max(1, Math.round(img.naturalHeight*s));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        let qv = quality || 0.72, out = cv.toDataURL("image/jpeg", qv);
        while(out.length > 260000 && qv > 0.4){ qv -= 0.08; out = cv.toDataURL("image/jpeg", qv); }   // ≤ ~190 KB/ảnh
        URL.revokeObjectURL(url); resolve(out);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
    img.src = url;
  });
}
TapEv.compressImage = compressImage;
/* ---------------------------------------------------------------------
   8b. ĐĂNG REVIEW / BÀI SAU SỰ KIỆN (bắt buộc ảnh hoặc clip + nội dung)
   --------------------------------------------------------------------- */
function mediaMissingHTML(){ return `<div class="te-warn">${icon("warning")}<p>Chưa nạp events-media.js nên chưa thêm được ảnh/video — bài đăng bắt buộc có ảnh hoặc clip.</p></div>`; }
const starIcon = size=> `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${GL.star}" fill="#FFC46B"/></svg>`;
function starPickHTML(stars){ return `<div class="te-star-pick" id="te-rv-stars" role="radiogroup" aria-label="Chấm sao">${[1,2,3,4,5].map(i=> `<button type="button" role="radio" aria-checked="${i===stars}" aria-label="${i} sao" data-s="${i}" class="${i <= stars ? "on" : ""}">${starIcon(30)}</button>`).join("")}</div>`; }
async function openReview(id, opt){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  if(cloudEvents.mode === "firebase" && !(typeof cloud !== "undefined" && cloud.user)){ askLogin("đăng review"); return; }
  const T = TM(), u = cloudEvents.me();
  const mine = (await safe(cloudEvents.listReviews(ev.id), [])).find(r=> r.uid === u.uid && r.kind !== "recap") || null;
  let stars = mine ? Math.max(1, Math.min(5, Number(mine.stars)||5)) : 5;
  const ed = T ? T.createEditor({ kind:"review", media: T.mediaOf(mine || {}), coverId: mine && mine.coverId, label:"Ảnh / clip khoảnh khắc" }) : null;
  const back = opt && opt.back === "moments" ? `data-te="close"` : `data-te="ev" data-id="${escAttr(ev.id)}"`;
  sheet(`<div class="sheet-header"><h3>${mine ? "Sửa review" : "Review & khoảnh khắc"}</h3><button class="icon-btn" ${back} aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <div class="te-reg-ev"><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))}</small></div>
    <div class="tm-errs" id="te-rv-errs" hidden role="alert"></div>
    ${starPickHTML(stars)}
    <div class="field"><label for="te-rv-t">Cảm nhận của bạn (ít nhất 20 ký tự)</label><textarea id="te-rv-t" rows="4" maxlength="2000" placeholder="Điều bạn thích nhất? Ban tổ chức nên cải thiện gì cho lần sau?">${esc(mine ? mine.text || "" : "")}</textarea></div>
    ${ed ? ed.html() : mediaMissingHTML()}
    <p class="small-note">Ảnh tự nén còn ≤ 1600 px; video ≤ 60 giây, ≤ 25 MB. Chỉ đăng ảnh/clip có sự đồng ý của người xuất hiện trong đó. Bài nhận từ 3 báo cáo sẽ tạm ẩn chờ kiểm duyệt.</p>
    <button class="btn btn-primary btn-block" id="te-rv-go">${icon("tm_send")}${mine ? "Cập nhật" : "Đăng review"}${Points.has("rv_" + ev.id) ? "" : " · +50 điểm"}</button>`, { id:"rv:" + ev.id });
  const root = q("#sheet-content");
  if(ed) ed.mount(root);
  if(T) T.bindCounter(q("#te-rv-t"), T.LIMITS.minText.review);
  const pick = q("#te-rv-stars");
  pick.addEventListener("click", e=>{ const b = e.target.closest("button[data-s]"); if(!b) return; stars = Number(b.dataset.s); qa("button", pick).forEach(x=>{ const s = Number(x.dataset.s); x.classList.toggle("on", s <= stars); x.setAttribute("aria-checked", String(s === stars)); }); });
  q("#te-rv-go").addEventListener("click", async e=>{
    const btn = e.currentTarget, text = String(q("#te-rv-t").value || "").trim();
    if(!T || !ed){ say("Thiếu events-media.js — chưa đăng được", "error"); return; }
    const v = T.validate("review", Object.assign({ stars, text }, ed.value()));
    if(!v.ok){ T.showErrors(q("#te-rv-errs"), v.errors, { text: q("#te-rv-t"), media: ed.el(), stars: pick }); return; }
    T.showErrors(q("#te-rv-errs"), []);
    const lab = btn.innerHTML; btn.disabled = true;
    try{
      const up = await ed.commit(`moments/${ev.id}/${u.uid}`, (k, n)=>{ btn.textContent = `Đang tải ảnh/video ${k}/${n}…`; });
      btn.textContent = "Đang đăng…";
      await cloudEvents.addReview(ev.id, { stars, text, media: up.media, coverId: up.coverId });
      for(const s of ed.removed()) cloudEvents.deleteMedia(s).catch(()=>{});
      const a = Points.add(30, `Review: ${ev.title}`, "rv_" + ev.id), b = Points.add(20, `Ảnh/clip sự kiện: ${ev.title}`, "rvp_" + ev.id);
      ev.reviewCount = (Number(ev.reviewCount)||0) + (mine ? 0 : 1); ev.momentCount = (Number(ev.momentCount)||0) + (mine ? 0 : 1);
      C.moments = null; C.momentsTs = 0;
      const lost = (!a && !Points.has("rv_" + ev.id)) || (!b && !Points.has("rvp_" + ev.id));   // QC-11: bộ nhớ đầy → không báo "+N điểm"
      say(mine ? "Đã cập nhật review" : lost ? "Đã đăng — nhưng bộ nhớ máy đầy nên điểm thưởng chưa được lưu." : `Cảm ơn bạn đã chia sẻ!${a || b ? " +" + ((a ? 30 : 0) + (b ? 20 : 0)) + " điểm" : ""}`, lost ? "error" : "rate_review");
      if(opt && opt.back === "moments"){ closeSheet(); openHub("moments"); } else openEvent(ev.id);
    }catch(err){ say(err.message || "Không đăng được review", "error"); const b2 = q("#te-rv-go"); if(b2){ b2.disabled = false; b2.innerHTML = retryLabel(err, lab); } }
  });
}
/* Bài đăng sau sự kiện của ban tổ chức (quyền events.manage) */
async function openRecap(evId, postId){
  if(!need(canEv(), "đăng bài thay ban tổ chức")) return;
  const ev = C.events.find(e=> e.id === evId); if(!ev) return;
  const T = TM();
  const prev = postId ? (await safe(cloudEvents.listReviews(ev.id), [])).find(r=> r.id === postId && r.kind === "recap") || null : null;
  const ed = T ? T.createEditor({ kind:"recap", media: T.mediaOf(prev || {}), coverId: prev && prev.coverId, label:"Ảnh & clip sau sự kiện", allowUrl:true }) : null;
  sheet(`<div class="sheet-header"><h3>${prev ? "Sửa bài sau sự kiện" : "Bài đăng sau sự kiện"}</h3><button class="icon-btn" data-te="ev" data-id="${escAttr(ev.id)}" aria-label="Quay lại">${icon("arrow_back")}</button></div>
    <div class="te-reg-ev"><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))} · ${nf(ev.regCount||0)} người đăng ký</small></div>
    <div class="tm-errs" id="te-rc-errs" hidden role="alert"></div>
    <div class="field"><label for="te-rc-t">Nội dung (ít nhất 20 ký tự)</label><textarea id="te-rc-t" rows="5" maxlength="2000" placeholder="Cảm ơn người tham gia, kết quả nổi bật, lời hẹn sự kiện tiếp theo…">${esc(prev ? prev.text || "" : "")}</textarea></div>
    ${ed ? ed.html() : mediaMissingHTML()}
    <p class="small-note">Bài hiện trong chi tiết sự kiện và bảng tin Khoảnh khắc, gắn nhãn “Ban tổ chức”. Ảnh có người: chỉ đăng khi đã được đồng ý (đã ghi trong điều khoản đăng ký).</p>
    <button class="btn btn-primary btn-block" id="te-rc-go">${icon("tm_send")}${prev ? "Cập nhật bài" : "Đăng bài"}</button>`, { id:"rc:" + ev.id });
  if(ed) ed.mount(q("#sheet-content"));
  if(T) T.bindCounter(q("#te-rc-t"), T.LIMITS.minText.recap);
  q("#te-rc-go").addEventListener("click", async e=>{
    const btn = e.currentTarget, text = String(q("#te-rc-t").value || "").trim();
    if(!T || !ed){ say("Thiếu events-media.js — chưa đăng được", "error"); return; }
    const v = T.validate("recap", Object.assign({ text }, ed.value()));
    if(!v.ok){ T.showErrors(q("#te-rc-errs"), v.errors, { text: q("#te-rc-t"), media: ed.el() }); return; }
    const lab = btn.innerHTML; btn.disabled = true;
    try{
      const up = await ed.commit(`events/${ev.id}/recap`, (k, n)=>{ btn.textContent = `Đang tải ảnh/video ${k}/${n}…`; });
      await cloudEvents.addPost(ev.id, { id: prev ? prev.id : "", text, media: up.media, coverId: up.coverId });
      for(const s of ed.removed()) cloudEvents.deleteMedia(s).catch(()=>{});
      if(!prev) ev.momentCount = (Number(ev.momentCount)||0) + 1;
      C.moments = null; C.momentsTs = 0; say(prev ? "Đã cập nhật bài" : "Đã đăng bài sau sự kiện", "photo_camera"); openEvent(ev.id);
    }catch(err){ say(err.message || "Không đăng được bài", "error"); const b2 = q("#te-rc-go"); if(b2){ b2.disabled = false; b2.innerHTML = retryLabel(err, lab); } }
  });
}

/* ---------------------------------------------------------------------
   8c. KHOẢNH KHẮC SỰ KIỆN — bảng tin ảnh/clip: thả tim · bình luận · báo cáo · kiểm duyệt
   --------------------------------------------------------------------- */
const timeAgo = ts=>{ const d = Math.max(0, Date.now() - (Number(ts)||0)), m = Math.round(d/60000); if(m < 1) return "vừa xong"; if(m < 60) return m + " phút trước"; const h = Math.round(m/60); if(h < 24) return h + " giờ trước"; const dd = Math.round(h/24); return dd < 7 ? dd + " ngày trước" : dmy(ds(new Date(Number(ts)))); };
function momentCardHTML(p, opt){
  opt = opt || {}; const T = TM(), u = cloudEvents.me();
  const key = `${p.evId}/${p.id}`, mine = p.uid === u.uid, hidden = T ? T.isHidden(p) : !!p.hidden, recap = p.kind === "recap";
  const ev = C.events.find(e=> e.id === p.evId), evTitle = p.evTitle || (ev && ev.title) || "", sport = (ev && ev.sport) || p.evSport || "other";
  const media = T ? T.mediaOf(p) : [];
  return `<article class="te-mo${hidden ? " is-hidden" : ""}${recap ? " recap" : ""}" data-mo="${escAttr(key)}">
    <header class="te-mo-h"><span class="te-av sm${recap ? " staff" : ""}" aria-hidden="true">${recap ? icon("te_trophy") : esc(initials(p.name))}</span>
      <div class="te-mo-who"><b>${esc(p.name || "Thành viên")}</b>${recap ? ` <span class="te-mo-tag">Ban tổ chức</span>` : ""}
        <small>${esc(timeAgo(p.ts))}</small>${!opt.compact && evTitle ? `<button type="button" class="te-link te-mo-ev" data-te="ev" data-id="${escAttr(p.evId)}">${icon("event")}<span>${esc(evTitle)}</span></button>` : ""}</div>
      ${!recap && p.stars ? starsHTML(p.stars, 12) : ""}</header>
    ${hidden ? `<p class="te-mo-note">${icon("tm_eye_off")}${p.hidden ? "Bài đang bị ẩn bởi kiểm duyệt" : `Tạm ẩn do ${nf(p.reportCount)} báo cáo — chờ kiểm duyệt`}${mine && !canMod() ? " (chỉ bạn thấy)" : ""}.</p>` : ""}
    ${media.length && T ? `<div class="te-mo-media sp-${escAttr(sport)} fk-dark-island">${T.galleryHTML(media, { fallback: sportArt(sport), ratio: opt.compact ? "16/10" : "4/3", auto:true, controls:false, thumb: !!opt.compact, label:"Ảnh & clip của " + (p.name || "thành viên") })}</div>` : ""}
    ${p.text ? `<p class="te-mo-t">${esc(p.text)}</p>` : ""}
    <footer class="te-mo-a">
      <button type="button" class="te-mo-btn like${p.liked ? " on" : ""}" data-te="mo-like" data-id="${escAttr(key)}" data-n="${Number(p.likeCount)||0}" aria-pressed="${!!p.liked}" aria-label="Thả tim (${Number(p.likeCount)||0})">${icon("tm_heart")}<span>${nf(p.likeCount||0)}</span></button>
      <button type="button" class="te-mo-btn" data-te="mo-cmt" data-id="${escAttr(key)}" aria-label="Bình luận (${Number(p.commentCount)||0})">${icon("tm_comment")}<span>${nf(p.commentCount||0)}</span></button>
      <span class="te-mo-sp"></span>
      ${mine ? `<button type="button" class="te-mo-btn" data-te="mo-edit" data-id="${escAttr(key)}" aria-label="Sửa bài">${icon("edit")}</button><button type="button" class="te-mo-btn" data-te="mo-del" data-id="${escAttr(key)}" aria-label="Xoá bài">${icon("tm_trash")}</button>`
        : `<button type="button" class="te-mo-btn${p.reportedByMe ? " done" : ""}" data-te="mo-report" data-id="${escAttr(key)}"${p.reportedByMe ? " disabled" : ""} aria-label="${p.reportedByMe ? "Đã báo cáo" : "Báo cáo bài đăng"}">${icon("tm_flag")}</button>`
          + (!recap && canBlock(p.uid) ? `<button type="button" class="te-mo-btn block" data-te="mo-block" data-id="${escAttr(key)}" aria-label="Chặn người này (${escAttr(p.name || "thành viên")})" title="Chặn người này">${icon("te_block")}</button>` : "")}
      ${canMod() ? `<button type="button" class="te-mo-btn mod" data-te="mo-mod" data-id="${escAttr(key)}" aria-label="Kiểm duyệt bài (${Number(p.reportCount)||0} báo cáo)">${icon("tm_shield")}${p.reportCount ? `<span>${nf(p.reportCount)}</span>` : ""}</button>` : ""}
    </footer>
  </article>`;
}
function reviewsHTML(list){
  list = arr(list).filter(notBlocked);                       // App Store 1.2: ẩn bài của người đã chặn
  const rv = list.filter(r=> r.kind !== "recap"), avg = rv.length ? rv.reduce((a,r)=> a + (Number(r.stars)||0), 0) / rv.length : 0;
  if(!list.length) return `<p class="small-note">Chưa có review nào — người đã điểm danh đăng review kèm ảnh/clip tại đây.</p>`;
  return `<div class="section-title"><h3>Khoảnh khắc &amp; review</h3>${rv.length ? `<span class="te-rv-mini">${starsHTML(avg, 14)}<small>${nf(avg,1)} · ${rv.length} review</small></span>` : ""}</div>
    <div class="te-mo-list compact">${list.slice(0, 20).map(p=> momentCardHTML(p, { compact:true })).join("")}</div>`;
}
function autoplayRowHTML(){
  const T = TM(); if(!T) return "";
  const why = T.autoplayBlock(), on = T.autoplayPref();
  const note = why === "motion" ? "Đang tắt vì máy bật “Giảm chuyển động”." : why === "data" ? "Đang tắt vì chế độ tiết kiệm dữ liệu / mạng chậm." : why === "lowfx" ? "Đang tắt vì chế độ giảm hiệu ứng." : on ? "Clip phát không tiếng khi cuộn tới — chạm để xem toàn màn hình, có tiếng." : "Clip chỉ phát khi bạn chạm vào.";
  return `<div class="te-mo-auto" id="te-mo-auto"><label class="te-switch"><input type="checkbox" data-te-auto ${on ? "checked" : ""} aria-describedby="te-mo-auto-n"><span aria-hidden="true"></span><b>Tự phát clip</b></label><small id="te-mo-auto-n">${esc(note)}</small></div>`;
}
function momentsTab(){
  return `<div class="te-mo-head"><div><h3>Khoảnh khắc sự kiện</h3><small>Ảnh &amp; clip từ người tham gia và ban tổ chức</small></div>
      <button class="btn btn-primary btn-sm" data-te="mo-new">${icon("photo_camera")}Đăng</button></div>
    ${TM() ? autoplayRowHTML() : mediaMissingHTML()}
    <div id="te-mo-list" class="te-mo-list">${momentsBodyHTML()}</div>`;
}
/* Nội dung bảng tin: danh sách (mọi chữ qua esc() trong momentCardHTML) hoặc khung chờ khi chưa tải */
function momentsBodyHTML(){
  if(C.moments) return momentsListHTML(C.moments);
  return typeof fkSkeleton === "function" ? fkSkeleton(2, "card") : `<p class="small-note">Đang tải…</p>`;
}
function momentsListHTML(list){
  list = arr(list).filter(notBlocked);                       // App Store 1.2: ẩn bài của người đã chặn
  if(!list.length) return typeof fkEmpty === "function" ? fkEmpty("photo_library", "Chưa có khoảnh khắc nào", "Điểm danh một sự kiện offline rồi đăng ảnh/clip đầu tiên — nhận +50 điểm!", null, { small:true }) : `<p class="small-note">Chưa có khoảnh khắc nào.</p>`;
  return list.map(p=> momentCardHTML(p)).join("") + (list.some(p=> TM() && TM().mediaOf(p).some(m=> m.credit && m.credit.site === "Pexels")) ? `<p class="small-note te-center">Ảnh/clip mẫu: Pexels — tên tác giả ghi trên từng ảnh.</p>` : "");
}
async function loadMoments(force){
  if(!force && C.moments && Date.now() - C.momentsTs < 30000) return;
  const [list] = await Promise.all([safe(cloudEvents.listMoments({ all: canMod(), limit: 60 }), null), ensureBlocks()]);
  if(list){ C.moments = list.map(p=> Object.assign(p, { evTitle: p.evTitle || ((C.events.find(e=> e.id === p.evId) || {}).title || "") })); C.momentsTs = Date.now(); }
  else if(!C.moments) C.moments = [];
  paintMoments();
}
function paintMoments(){ const box = q("#te-mo-list"); if(box && curScreen() === "events" && _tab === "moments") box.innerHTML = momentsListHTML(C.moments || []); }
TapEv.loadMoments = loadMoments;
/* tìm bài trong bộ nhớ đệm (bảng tin + chi tiết sự kiện) */
function moFind(key){ const [evId, pid] = String(key||"").split("/"); const p = arr(C.moments).concat(arr(C.evPosts)).find(x=> x.evId === evId && x.id === pid) || null; return { evId, pid, p }; }
function moPatch(evId, pid, patch){ [C.moments, C.evPosts].forEach(L=> arr(L).forEach(x=>{ if(x.evId === evId && x.id === pid) Object.assign(x, patch); })); }
function moCount(key, act, n){ qa(`[data-te="${act}"][data-id="${CSS.escape(key)}"]`).forEach(b=>{ const s = b.querySelector("span:last-child"); if(s && !s.classList.contains("material-symbols-rounded")) s.textContent = nf(n); }); }
async function refreshEvPosts(evId){
  const box = q("#te-reviews"); if(!box || !q(`[data-sheet-id="ev:${CSS.escape(evId)}"]`)) return;
  const [list] = await Promise.all([safe(cloudEvents.listReviews(evId), []), ensureBlocks()]); C.evPosts = list; box.innerHTML = reviewsHTML(list);
}
function needLogin(what){ if(cloudEvents.mode === "firebase" && !(typeof cloud !== "undefined" && cloud.user)){ askLogin(what); return true; } return false; }
async function moLike(key){
  if(needLogin("thả tim")) return;
  const { evId, pid } = moFind(key);
  const btns = qa(`[data-te="mo-like"][data-id="${CSS.escape(key)}"]`); if(!btns.length) return;
  const was = btns[0].classList.contains("on"), n = Number(btns[0].dataset.n) || 0;
  const paint = (on, c)=> btns.forEach(b=>{ b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.dataset.n = c; b.setAttribute("aria-label", `Thả tim (${c})`);
    const s = b.querySelector("span:last-child"); if(s) s.textContent = nf(c);
    if(on && !reduceMotion()){ b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } });
  paint(!was, Math.max(0, n + (was ? -1 : 1)));
  try{ const r = await cloudEvents.toggleLike(evId, pid); paint(r.liked, r.likeCount); moPatch(evId, pid, { liked: r.liked, likeCount: r.likeCount }); }
  catch(e){ paint(was, n); say(e.message || "Không thả tim được", "error"); }
}
async function openComments(key){
  const { evId, pid, p } = moFind(key);
  const fromEv = !!q(`#sheet-content[data-sheet-id="ev:${CSS.escape(evId)}"]`);
  sheet(`<div class="sheet-header"><h3>Bình luận</h3><button class="icon-btn" ${fromEv ? `data-te="ev" data-id="${escAttr(evId)}" aria-label="Quay lại">${icon("arrow_back")}` : `data-te="close" aria-label="Đóng">${icon("close")}`}</button></div>
    ${p ? `<div class="te-reg-ev"><b>${esc(p.name || "")}${p.evTitle ? " · " + esc(p.evTitle) : ""}</b><small>${esc(String(p.text || "").slice(0, 140))}${String(p.text || "").length > 140 ? "…" : ""}</small></div>` : ""}
    <div id="te-cmts" class="te-cmts">${typeof fkSkeleton === "function" ? fkSkeleton(2, "list") : ""}</div>
    <div class="te-cmt-form"><textarea id="te-cmt-t" rows="2" maxlength="300" aria-label="Viết bình luận" placeholder="Viết bình luận lịch sự, tích cực…"></textarea><button class="btn btn-primary" id="te-cmt-go" aria-label="Gửi bình luận">${icon("tm_send")}</button></div>
    <p class="small-note">Bình luận hiển thị công khai với thành viên TapEasy. Không chia sẻ số điện thoại, địa chỉ.</p>`, { id:"cmt:" + key });
  const me = cloudEvents.me().uid;
  const paint = async ()=>{
    const [all] = await Promise.all([safe(cloudEvents.listComments(evId, pid), []), ensureBlocks()]); const box = q("#te-cmts"); if(!box) return;
    const L = arr(all).filter(notBlocked), hiddenN = arr(all).length - L.length;   // App Store 1.2: ẩn bình luận của người đã chặn
    box.innerHTML = (L.length ? L.map(c=> `<div class="te-cmt"><span class="te-av sm" aria-hidden="true">${esc(initials(c.name))}</span><div><b>${esc(c.name || "")}</b> <small>${esc(timeAgo(c.ts))}</small><p>${esc(c.text || "")}</p></div><span class="te-cmt-a">${c.uid !== me && canBlock(c.uid) ? `<button type="button" class="icon-btn sm" data-te="cmt-block" data-id="${escAttr(key)}" data-u="${escAttr(c.uid)}" data-n="${escAttr(c.name || "")}" aria-label="Chặn người này (${escAttr(c.name || "thành viên")})" title="Chặn người này">${icon("te_block")}</button>` : ""}${c.uid === me || canMod() ? `<button type="button" class="icon-btn sm" data-te="cmt-del" data-id="${escAttr(key)}" data-c="${escAttr(c.id)}" aria-label="Xoá bình luận của ${escAttr(c.name || "")}">${icon("tm_trash")}</button>` : ""}</span></div>`).join("")
      : `<p class="small-note">Chưa có bình luận — hãy là người đầu tiên!</p>`) + (hiddenN ? `<p class="small-note te-dim">${nf(hiddenN)} bình luận của người bạn đã chặn được ẩn.</p>` : "");
    moPatch(evId, pid, { commentCount: arr(all).length }); moCount(key, "mo-cmt", arr(all).length);
  };
  TapEv._cmtPaint = paint;
  await paint();
  const go = q("#te-cmt-go"); if(!go) return;
  go.addEventListener("click", async ()=>{
    if(needLogin("bình luận")) return;
    const t = q("#te-cmt-t"), text = String(t.value || "").trim();
    if(!text){ say("Viết vài chữ trước khi gửi nhé", "error"); t.focus(); return; }
    go.disabled = true;
    try{ await cloudEvents.addComment(evId, pid, text); t.value = ""; await paint(); }catch(e){ say(e.message || "Không gửi được bình luận", "error"); }
    go.disabled = false;
  });
}
const REPORT_REASONS = ["Spam, quảng cáo", "Ảnh/clip phản cảm, khoả thân", "Bạo lực, quấy rối, xúc phạm", "Đăng ảnh người khác khi chưa được đồng ý", "Thông tin sai sự thật, lừa đảo", "Lý do khác"];
function openReport(key){
  if(needLogin("báo cáo")) return;
  const { evId, pid, p } = moFind(key);
  sheet(`<div class="sheet-header"><h3>Báo cáo bài đăng</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <p class="small-note">Báo cáo được gửi ẩn danh tới đội kiểm duyệt TapEasy. Bài nhận từ 3 báo cáo sẽ tạm ẩn chờ xem xét.</p>
    <div class="te-reasons" role="radiogroup" aria-label="Lý do báo cáo">${REPORT_REASONS.map((r, i)=> `<label class="te-check"><input type="radio" name="te-rp" value="${escAttr(r)}"${i === 0 ? " checked" : ""}><span>${esc(r)}</span></label>`).join("")}</div>
    <div class="field" style="margin-top:10px;"><label for="te-rp-n">Mô tả thêm (tuỳ chọn)</label><input id="te-rp-n" type="text" maxlength="160"></div>
    <button class="btn btn-primary btn-block" id="te-rp-go" style="margin-top:12px;">${icon("tm_flag")}Gửi báo cáo</button>`);
  q("#te-rp-go").addEventListener("click", async e=>{
    const btn = e.currentTarget, r = (q('input[name="te-rp"]:checked') || {}).value || "Lý do khác", note = String(q("#te-rp-n").value || "").trim(), reason = note ? `${r}: ${note}` : r;
    btn.disabled = true;
    try{
      const res = await cloudEvents.report(evId, pid, reason);
      try{ if(G.cloudAdmin && typeof G.cloudAdmin.report === "function") Promise.resolve(G.cloudAdmin.report(p && p.kind === "recap" ? "post" : "review", pid, reason, { parentId: evId, title: "Khoảnh khắc · " + ((p && p.evTitle) || evId) })).catch(()=>{}); }catch(_){}
      moPatch(evId, pid, { reportedByMe:true, reportCount: res.reportCount });
      if(res.hidden && !canMod()){ C.moments = arr(C.moments).filter(x=> !(x.evId === evId && x.id === pid)); C.evPosts = arr(C.evPosts).filter(x=> !(x.evId === evId && x.id === pid)); }
      closeSheet(); say(res.already ? "Bạn đã báo cáo bài này trước đó" : "Cảm ơn bạn — đội kiểm duyệt sẽ xem xét sớm", "tm_flag"); paintMoments();
    }catch(err){ say(err.message || "Không gửi được báo cáo", "error"); btn.disabled = false; }
  });
}
function openModerate(key){
  if(!need(canMod(), "kiểm duyệt cộng đồng")) return;
  const { p } = moFind(key), T = TM();
  sheet(`<div class="sheet-header"><h3>Kiểm duyệt khoảnh khắc</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    ${p ? `<div class="te-reg-ev"><b>${esc(p.name || "")}${p.evTitle ? " · " + esc(p.evTitle) : ""}</b><small>${nf(p.reportCount || 0)} báo cáo · ${p.hidden ? "đang ẩn" : T && T.isHidden(p) ? "tạm ẩn (đủ số báo cáo)" : "đang hiển thị"}${p.modOk ? " · đã duyệt giữ lại" : ""}</small></div>
      ${p.text ? `<p class="te-desc">${esc(p.text)}</p>` : ""}` : ""}
    <div class="te-evd-actions">
      <button class="btn btn-primary btn-block" data-te="mo-modact" data-id="${escAttr(key)}" data-a="keep">${icon("tm_eye")}Giữ lại / khôi phục (bỏ qua báo cáo)</button>
      <button class="btn btn-outline btn-block" data-te="mo-modact" data-id="${escAttr(key)}" data-a="hide">${icon("tm_eye_off")}Ẩn bài</button>
      <button class="btn btn-ghost btn-block" data-te="mo-modact" data-id="${escAttr(key)}" data-a="delete">${icon("tm_trash")}Xoá vĩnh viễn</button></div>
    <p class="small-note">Ẩn: tác giả vẫn thấy bài kèm ghi chú. Xoá: mất cả ảnh/clip, lượt thích, bình luận. Thao tác được ghi nhật ký quản trị (nếu bật RBAC).</p>`);
}
async function moModAct(key, action){
  if(!need(canMod(), "kiểm duyệt cộng đồng")) return;
  const { evId, pid, p } = moFind(key);
  const run = async ()=>{
    try{
      await cloudEvents.moderate(evId, pid, action);
      try{ if(G.cloudAdmin && typeof G.cloudAdmin.appendAudit === "function") Promise.resolve(G.cloudAdmin.appendAudit({ action:`mod.moment.${action}`, target:{ type:"moment", id: pid, name: (p && p.evTitle) || evId }, details:{ evId } })).catch(()=>{}); }catch(_){}
      say(action === "delete" ? "Đã xoá bài" : action === "hide" ? "Đã ẩn bài" : "Đã giữ lại bài", "tm_shield");
      try{ closeSheet(); }catch(e){}
      C.momentsTs = 0; await loadMoments(true); if(curScreen() === "events" && _tab === "admin") renderHub();
    }catch(e){ say(e.message || "Không thực hiện được", "error"); }
  };
  if(action === "delete") confirmDialog("Xoá vĩnh viễn?", "Bài, ảnh/clip, lượt thích và bình luận sẽ bị xoá, không khôi phục được.", run, "Xoá", "delete"); else await run();
}
function deleteMyPost(key){
  const { evId, pid, p } = moFind(key);
  confirmDialog("Xoá bài đăng?", "Ảnh/clip, lượt thích và bình luận của bài này sẽ bị xoá.", async ()=>{
    try{ await cloudEvents.deletePost(evId, pid); if(p && p.kind !== "recap"){ const ev = C.events.find(e=> e.id === evId); if(ev) ev.reviewCount = Math.max(0, (Number(ev.reviewCount)||1) - 1); }
      C.moments = arr(C.moments).filter(x=> !(x.evId === evId && x.id === pid)); C.evPosts = arr(C.evPosts).filter(x=> !(x.evId === evId && x.id === pid));
      say("Đã xoá bài", "tm_trash"); paintMoments(); refreshEvPosts(evId); }
    catch(e){ say(e.message || "Không xoá được", "error"); }
  }, "Xoá", "delete");
}
function openNewMoment(){
  const now = Date.now();
  const mineEv = C.events.filter(e=>{ const r = C.regs[e.id]; return r && r.status === "checked_in" && ["live","after","ended"].includes(evPhase(e, now)); });
  const staffEv = canEv() ? C.events.filter(e=> ["live","after","ended"].includes(evPhase(e, now))).slice(-6).reverse() : [];
  const pickHTML = (e, te)=> `<button type="button" class="te-pick" data-te="${te}" data-id="${escAttr(e.id)}"><span class="te-pick-c sp-${escAttr(e.sport||"other")} fk-dark-island">${coverBox(e, sportArt(e.sport), { badges:false, auto:false })}</span><span><b>${esc(e.title)}</b><small>${esc(whenText(e))}</small></span>${icon("chevron_right")}</button>`;
  sheet(`<div class="sheet-header"><h3>Đăng khoảnh khắc</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    ${mineEv.length ? `<p class="small-note">Chọn sự kiện bạn đã điểm danh — bài đăng cần ít nhất 1 ảnh hoặc clip và vài dòng cảm nhận.</p><div class="te-list">${mineEv.map(e=> pickHTML(e, "mo-review")).join("")}</div>`
      : `<div class="te-warn soft">${icon("info")}<p>Chỉ người đã <b>điểm danh</b> sự kiện mới đăng được khoảnh khắc — để bảng tin luôn là ảnh thật từ buổi tập thật.</p></div>
        <button class="btn btn-primary btn-block" data-te="tab" data-id="events">${icon("event")}Xem sự kiện sắp tới</button>`}
    ${staffEv.length ? `<div class="section-title"><h3>Ban tổ chức · bài sau sự kiện</h3></div><div class="te-list">${staffEv.map(e=> pickHTML(e, "recap")).join("")}</div>` : ""}`);
}

/* ---------------------------------------------------------------------
   9. QUÀ & ĐIỂM
   --------------------------------------------------------------------- */
const GIFT_ST = { new:["Chờ xác nhận địa chỉ","coral"], confirmed:["Đã xác nhận · đang chuẩn bị","mint"], shipping:["Đang giao","mint"], delivered:["Đã nhận","ok"], cancelled:["Đã huỷ","dim"] };
function newGifts(){ return C.gifts.filter(g=> g.status === "new"); }
function giftArt(g){ try{ if(g.pid && G.TapShop && typeof G.TapShop.artFor === "function") return G.TapShop.artFor(g.pid, 64); }catch(e){} return `<span class="te-gift-ic">${icon("te_gift")}</span>`; }
function giftBannerHTML(g){
  return `<button class="te-gift-banner" data-te="gift" data-id="${escAttr(g.id)}"><span class="te-gb-ic">${icon("te_gift")}</span>
    <span><b>Bạn nhận quà!</b><small>${esc(g.item || g.title)} — xác nhận địa chỉ để TapEasy giao miễn phí</small></span>${icon("chevron_right")}</button>`;
}
function giftsTab(){
  const pts = Points.balance(), L = Points.list();
  const badges = Object.keys(TE().badges).map(id=> Object.assign({ id }, TE().badges[id])).sort((a,b)=> String(b.d).localeCompare(String(a.d)));
  return `<div class="te-wallet">
      <div class="te-wallet-top"><div>${icon("te_coin")}<span>Điểm TapEasy</span></div><b>${nf(pts)}</b></div>
      <p>Điểm thưởng từ thử thách, điểm danh sự kiện và review — dùng để đổi voucher ở Cửa hàng. Khác với XP (đo mức chăm chỉ, không tiêu được).</p>
      <div class="te-row-btns">${G.TapShop ? `<button class="btn btn-primary btn-sm" data-te="redeem">${icon("te_voucher")}Đổi điểm lấy voucher</button>` : ""}<button class="btn btn-outline btn-sm" data-te="ledger">${icon("te_receipt")}Lịch sử điểm</button></div>
    </div>
    <div class="section-title"><h3>Quà của tôi</h3>${C.gifts.length ? `<span class="small-note">${C.gifts.length} quà</span>` : ""}</div>
    ${C.gifts.length ? `<div class="te-list">${C.gifts.map(g=>{ const s = GIFT_ST[g.status] || GIFT_ST.new; return `<button class="te-gift" data-te="gift" data-id="${escAttr(g.id)}">
        <span class="te-gift-art">${giftArt(g)}</span><span class="te-gift-b"><b>${esc(g.item || g.title)}</b><small>${esc(g.reason || "")}</small>
        <span class="te-st ${s[1]}">${esc(s[0])}</span></span>${icon("chevron_right")}</button>`; }).join("")}</div>`
      : (typeof fkEmpty === "function" ? fkEmpty("te_gift", "Chưa có quà", "Lọt top thử thách tháng, hoàn thành mục tiêu hoặc tham gia ≥ 2 sự kiện offline trong tháng để nhận quà miễn phí.", { label:"Xem thử thách", onClick: ()=> openHub("challenges") }, { small:false }) : "")}
    ${badges.length ? `<div class="section-title"><h3>Huy hiệu thử thách</h3><span class="small-note">${badges.length}</span></div>
      <div class="te-badges">${badges.map(b=> `<div class="te-bdg" title="${escAttr(b.title)}">${chBadgeSVG({ badge:b.badge, metric:b.metric }, 64)}<b>${esc(b.title)}</b><small>${dmy(b.d)}</small></div>`).join("")}</div>` : ""}
    <div class="card te-how">
      <div class="card-title">${icon("te_gift")}Ai được nhận quà?</div>
      <ul class="te-ul">
        <li><b>Top mỗi thử thách tháng</b>: áo tập, bình nước, khăn tập… giao miễn phí toàn quốc.</li>
        <li><b>Hoàn thành mục tiêu</b>: huy hiệu + điểm + voucher giảm 15% Cửa hàng.</li>
        <li><b>Tham gia ≥ 2 sự kiện offline/tháng</b>: bộ quà cộng đồng (sticker + dây đeo).</li>
        <li>10% doanh thu Cửa hàng được dùng để mua quà cho thành viên tích cực.</li>
      </ul>
      <p class="small-note">Điểm nhận được: hoàn thành thử thách +200–300 · Top 1/2/3 +${RANK_BONUS.map(nf).join("/")} · điểm danh sự kiện +80–250 · review +30 (có ảnh +20).</p>
    </div>`;
}
function openLedger(){
  const L = Points.list();
  sheet(`<div class="sheet-header"><h3>Lịch sử điểm</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <div class="te-wallet sm"><div class="te-wallet-top"><div>${icon("te_coin")}<span>Số dư</span></div><b>${nf(Points.balance())}</b></div></div>
    ${L.length ? `<div class="te-ledger">${L.slice(0, 60).map(x=> `<div class="te-led"><div><b>${esc(x.reason)}</b><small>${dmy(ds(new Date(x.ts)))}</small></div><span class="${x.delta > 0 ? "plus" : "minus"}">${x.delta > 0 ? "+" : "−"}${nf(Math.abs(x.delta))}</span></div>`).join("")}</div>`
      : `<p class="small-note">Chưa có giao dịch điểm nào.</p>`}`);
}
/* Form địa chỉ giao hàng VN (dùng chung với shop.js) */
function addressFormHTML(a, opt){
  a = obj(a); opt = opt || {};
  return `<div class="te-addr">
    <div class="field-row"><div class="field"><label for="te-a-name">Người nhận</label><input id="te-a-name" type="text" maxlength="60" autocomplete="name" value="${escAttr(a.name||"")}"></div>
      <div class="field"><label for="te-a-phone">Số điện thoại</label><input id="te-a-phone" type="tel" inputmode="tel" maxlength="14" autocomplete="tel" value="${escAttr(a.phone||"")}"></div></div>
    <div class="field" style="margin-top:10px;"><label for="te-a-prov">Tỉnh / Thành phố</label><select id="te-a-prov"><option value="">— Chọn tỉnh/thành —</option>${PROVINCES.map(p=> `<option ${a.province===p?"selected":""}>${esc(p)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px;"><label for="te-a-ward">Phường / Xã</label><input id="te-a-ward" type="text" maxlength="60" placeholder="VD: Phường Hoàn Kiếm" value="${escAttr(a.ward||"")}"></div>
    <div class="field" style="margin-top:10px;"><label for="te-a-street">Số nhà, tên đường / thôn, xóm</label><input id="te-a-street" type="text" maxlength="120" autocomplete="street-address" placeholder="VD: 12 ngõ 34 Hàng Bông" value="${escAttr(a.street||"")}"></div>
    ${opt.note !== false ? `<div class="field" style="margin-top:10px;"><label for="te-a-note">Ghi chú giao hàng (tuỳ chọn)</label><input id="te-a-note" type="text" maxlength="120" placeholder="VD: giao giờ hành chính, gọi trước 15 phút" value="${escAttr(a.note||"")}"></div>` : ""}
    <p class="small-note">Theo địa giới hành chính mới (từ 01/07/2025): 34 tỉnh/thành, địa chỉ gồm phường/xã — không còn quận/huyện.</p>
  </div>`;
}
function readAddress(root){
  const v = s=> String((q(s, root)||{}).value||"").trim();
  const a = { name: v("#te-a-name"), phone: normPhone(v("#te-a-phone")), province: v("#te-a-prov"), ward: v("#te-a-ward"), street: v("#te-a-street"), note: q("#te-a-note", root) ? v("#te-a-note") : "" };
  const err = a.name.length < 2 ? "Nhập tên người nhận" : !validPhone(a.phone) ? "Số điện thoại chưa đúng (10 số, bắt đầu 03/05/07/08/09)" : !PROVINCES.includes(a.province) ? "Chọn tỉnh/thành phố" : a.ward.length < 2 ? "Nhập phường/xã" : a.street.length < 3 ? "Nhập số nhà, tên đường" : "";
  return { a, err };
}
const addrText = a=> a ? [a.street, a.ward, a.province].filter(Boolean).join(", ") : "";
Object.assign(TapEv, { addressFormHTML, readAddress, addrText, PROVINCES, validPhone, normPhone });
function openGift(id){
  const g = C.gifts.find(x=> x.id === id); if(!g) return;
  markGiftSeen(g.id);
  const s = GIFT_ST[g.status] || GIFT_ST.new;
  const needSize = g.pid === "p_tee" || g.pid === "p_socks";
  const sizes = g.pid === "p_tee" ? ["S","M","L","XL","XXL"] : ["35–39","40–44"];
  const a = Object.assign({ name: TE().contact.name || (state.profile||{}).name || "", phone: TE().contact.phone || "" }, TE().address, g.address || {});
  sheet(`<div class="sheet-header"><h3>Quà tặng</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <div class="te-gift-hero"><span class="te-gift-art lg">${giftArt(g)}</span><div><b>${esc(g.item || g.title)}</b><small>${esc(g.reason||"")}</small><span class="te-st ${s[1]}">${esc(s[0])}</span></div></div>
    ${g.status === "new" ? `<p class="small-note">Chúc mừng! Quà được <b>giao miễn phí</b>. Vui lòng xác nhận địa chỉ trong 14 ngày.</p>
      ${needSize ? `<div class="field"><label for="te-g-size">Chọn size</label><select id="te-g-size">${sizes.map(z=> `<option>${esc(z)}</option>`).join("")}</select></div>
        ${g.pid === "p_tee" ? `<p class="small-note">Gợi ý size áo: S (1m50–1m60, 45–52 kg) · M (1m60–1m68, 52–60 kg) · L (1m68–1m75, 60–70 kg) · XL (1m75–1m80, 70–80 kg) · XXL (&gt; 1m80, 80–90 kg).</p>` : ""}` : ""}
      ${addressFormHTML(a)}
      <button class="btn btn-primary btn-block" id="te-g-go">${icon("te_truck")}Xác nhận nhận quà</button>`
    : `<div class="te-addr-show">${icon("location_on")}<div><b>${esc((g.address||{}).name||"")} · ${esc((g.address||{}).phone||"")}</b><small>${esc(addrText(g.address))}</small>${g.size ? `<small>Size: ${esc(g.size)}</small>` : ""}</div></div>
      <p class="small-note">Cần đổi địa chỉ? Liên hệ TapEasy qua mục Hồ sơ → Hỗ trợ.</p>`}`);
  const go = q("#te-g-go");
  if(go) go.addEventListener("click", async ()=>{
    const { a: addr, err } = readAddress(q("#sheet-content")); if(err){ say(err, "error"); return; }
    TE().address = addr; Object.assign(TE().contact, { name: addr.name, phone: addr.phone }); save();
    go.disabled = true;
    try{
      const upd = await cloudEvents.updateGift(g.id, { status:"confirmed", address: addr, size: q("#te-g-size") ? q("#te-g-size").value : "", confirmedAt: Date.now() });
      Object.assign(g, upd || { status:"confirmed", address: addr });
      say("Đã xác nhận — TapEasy sẽ gửi quà sớm!", "te_truck"); openGift(g.id); rerender();
    }catch(e){ say(e.message, "error"); go.disabled = false; }
  });
}
function markGiftSeen(id){ const t = TE(); if(!t.seenGifts.includes(id)){ t.seenGifts.push(id); save(); } }

/* Hàng đợi chúc mừng (huy hiệu thử thách / kết quả tháng / quà mới) */
const _cele = [];
function queueCelebrate(x){ _cele.push(x); setTimeout(showNextCelebrate, 600); }
function blocking(){
  try{ if(typeof session !== "undefined" && session && !session.finished && !session.paused) return true; }catch(e){}
  if(q("#sheet-backdrop.open") || q(".ach-pop")) return true;
  const a = q("#auth"); if(a && a.classList.contains("open")) return true;
  const o = q("#onboarding"); if(o && o.classList.contains("open")) return true;
  /* lớp phủ của module khác (sàng lọc sức khoẻ, trình tạo giáo án…) đang mở */
  const dlg = qa('[role="dialog"]').find(d=> d.id !== "sheet-content" && !d.hidden && d.offsetParent !== null && getComputedStyle(d).visibility !== "hidden");
  if(dlg) return true;
  return false;
}
let _celeT = null;
function showNextCelebrate(){
  clearTimeout(_celeT);
  if(!_cele.length) return;
  if(blocking()){ _celeT = setTimeout(showNextCelebrate, 2500); return; }
  const x = _cele.shift();
  if(x.type === "badge") celebrateSheet("Hoàn thành thử thách!", `Bạn đã đạt mục tiêu “${x.ch.title}”. Huy hiệu đã vào bộ sưu tập — điểm thưởng được cộng khi thử thách kết thúc.`, null, { te:"ch", id:x.ch.id, label:"Xem bảng xếp hạng" }, chBadgeSVG(x.ch, 120));
  else if(x.type === "result"){ const r = x.res;
    celebrateSheet(`Kết quả: hạng #${r.rank}/${r.total}`, `${x.ch.title} — bạn đạt ${nf(x.value,1)} ${x.ch.unit||""}.` + (r.points.length ? ` +${nf(r.points.reduce((a,p)=> a+p.delta, 0))} điểm.` : "") + (r.gift ? ` Bạn nhận quà: ${r.gift.title}!` : r.voucher ? " Bạn nhận voucher giảm 15% Cửa hàng." : " Hẹn gặp ở thử thách tháng sau!"),
      r.rank <= 3 ? "te_trophy" : "te_medal", r.gift ? { te:"tab", id:"gifts", label:"Xem quà" } : { te:"tab", id:"challenges", label:"Thử thách mới" }); }
  else if(x.type === "gift") celebrateSheet("Bạn nhận quà!", `${x.g.item || x.g.title} — ${x.g.reason || ""}. Giao miễn phí, xác nhận địa chỉ nhé.`, "te_gift", { te:"gift", id:x.g.id, label:"Xác nhận địa chỉ" });
}
function celebrateSheet(title, msg, ic, cta, art){
  sheet(`<div class="te-cele">
      <div class="te-cele-art">${art || `<span class="te-cele-ic">${icon(ic || "celebration")}</span>`}<i class="te-cele-rays" aria-hidden="true"></i></div>
      <h3>${esc(title)}</h3><p>${esc(msg)}</p>
      <div class="te-row-btns center">${cta ? `<button class="btn btn-primary" data-te="${escAttr(cta.te)}" data-id="${escAttr(cta.id||"")}">${esc(cta.label)}</button>` : ""}<button class="btn btn-outline" data-te="close">Đóng</button></div>
    </div>`);
  try{ if(!reduceMotion() && navigator.vibrate) navigator.vibrate([18, 40, 18]); }catch(e){}
}
function checkGiftNotice(){
  const unseen = newGifts().filter(g=> !TE().seenGifts.includes(g.id));
  unseen.forEach(g=>{ if(!_cele.some(x=> x.g && x.g.id === g.id)){ markGiftSeen(g.id); queueCelebrate({ type:"gift", g }); } });
}

/* ---------------------------------------------------------------------
   10. CHẾ ĐỘ QUẢN TRỊ (nhà sáng lập)
   --------------------------------------------------------------------- */
async function mountAdmin(el){
  if(!el) return;
  const box = q("#te-admin", el) || el;
  const remote = hasRBAC() ? isAdmin() : await safe(cloudEvents.isAdminRemote(), false);
  const today = todayS();
  let roleTxt = "";
  try{ if(hasRBAC() && G.TE_RBAC && G.TE_RBAC.roleLabel) roleTxt = G.TE_RBAC.roleLabel(G.TE_RBAC.role()); }catch(e){}
  const secs = ADMIN_SECTIONS.filter(s=> !s.perm || [].concat(s.perm).some(can)).map(s=> `<div class="section-title"><h3>${esc(s.title)}</h3></div><div id="te-as-${escAttr(s.id)}">${typeof fkSkeleton === "function" ? fkSkeleton(2, "list") : ""}</div>`).join("");
  const noMedia = x=> !mediaN(x);
  box.innerHTML = `<div class="te-admin-head">${icon("te_admin")}<div><b>${hasRBAC() ? `Công cụ sự kiện${roleTxt ? " · " + esc(roleTxt) : ""}` : "Chế độ quản trị · nhà sáng lập"}</b><small>${cloudEvents.mode === "firebase" ? (remote ? "Quyền ghi kiểm tra trên máy chủ (rules)." : "Tài khoản CHƯA có quyền quản trị trên máy chủ — thao tác ghi sẽ bị từ chối.") : "Bản demo: dữ liệu lưu trên máy này (ảnh/clip trong IndexedDB)."}</small></div>
      ${hasRBAC() ? "" : `<button class="btn btn-ghost btn-sm" data-te="admin-off">Tắt</button>`}</div>
    ${canEv() || canCh() ? `<div class="te-quick" role="group" aria-label="Tạo nhanh">${canEv() ? `<button class="btn btn-primary" data-te="a-ev-new">${icon("te_plus")}Tạo sự kiện</button>` : ""}${canCh() ? `<button class="btn btn-outline" data-te="a-ch-edit" data-id="">${icon("te_plus")}Tạo thử thách</button>` : ""}${canEv() && evDraft() ? `<small class="te-dim">Có bản nháp sự kiện chưa đăng</small>` : ""}</div>` : ""}
    <div class="te-warn soft">${icon("photo_camera")}<p>Mọi sự kiện, thử thách và bài đăng <b>bắt buộc có ít nhất 1 ảnh hoặc 1 video</b> và nội dung đầy đủ (mô tả ≥ 80 ký tự; bài đăng ≥ 20 ký tự). Form sẽ chặn lưu nếu thiếu.</p></div>
    ${canCh() ? `<div class="section-title"><h3>Thử thách</h3><button class="btn btn-ghost btn-sm" data-te="a-ch-edit" data-id="">${icon("te_plus")}Tạo thử thách</button></div>
    <div class="te-alist">${C.challenges.map(ch=>{ const st = chStatus(ch, today); return `<div class="te-arow">
      <span class="te-arow-c fk-dark-island">${coverBox(ch, `<div class="te-ch-fb ${ch.color==="coral"?"coral":"mint"}"></div>`, { badges:false, auto:false })}</span>
      <div class="te-arow-b"><b>${esc(ch.title)}</b><small>${esc(periodLabel(ch))} · ${esc((METRICS[ch.metric]||METRICS.manual).label)} ${nf(ch.target,1)} ${esc(ch.unit||"")} · ${st==="active"?"đang diễn ra":st==="upcoming"?"sắp tới":"đã kết thúc"}${ch.hidden ? " · đang ẩn" : ""}${noMedia(ch) ? ` · <span class="te-coral">thiếu ảnh/clip</span>` : ""}</small></div>
      <div class="te-arow-a"><button class="btn btn-outline btn-sm" data-te="a-ch-edit" data-id="${escAttr(ch.id)}">Sửa</button>${canExport() ? `<button class="btn btn-outline btn-sm" data-te="a-ch-csv" data-id="${escAttr(ch.id)}">${icon("te_download")}CSV</button>` : ""}${st==="ended" && canGifts() ? `<button class="btn btn-primary btn-sm" data-te="a-ch-award" data-id="${escAttr(ch.id)}">${icon("te_gift")}Chốt &amp; trao quà</button>` : ""}</div></div>`; }).join("") || `<p class="small-note">Chưa có thử thách.</p>`}</div>` : ""}
    ${canEv() || canCI() ? `<div class="section-title"><h3>Sự kiện offline</h3>${canEv() ? `<button class="btn btn-ghost btn-sm" data-te="a-ev-new">${icon("te_plus")}Tạo sự kiện</button>` : ""}</div>
    <div class="te-alist">${C.events.slice().reverse().map(ev=> `<div class="te-arow">
      <span class="te-arow-c sp-${escAttr(ev.sport||"other")} fk-dark-island">${coverBox(ev, sportArt(ev.sport), { badges:false, auto:false })}</span>
      <div class="te-arow-b"><b>${esc(ev.title)}</b><small>${esc(whenText(ev))} · ${esc(ev.city||"")} · ${nf(ev.regCount||0)}/${nf(ev.capacity||0)} đăng ký${ev.hidden ? " · đang ẩn" : ""}${noMedia(ev) ? ` · <span class="te-coral">thiếu ảnh/clip</span>` : ""}</small></div>
      <div class="te-arow-a">${canEv() ? `<button class="btn btn-outline btn-sm" data-te="a-ev-edit" data-id="${escAttr(ev.id)}">Sửa</button><button class="btn btn-outline btn-sm" data-te="a-ev-dup" data-id="${escAttr(ev.id)}" aria-label="Nhân bản ${escAttr(ev.title)}">${icon("content_copy")}Nhân bản</button>` : ""}${canCI() ? `<button class="btn btn-outline btn-sm" data-te="a-regs" data-id="${escAttr(ev.id)}">Đăng ký</button><button class="btn btn-outline btn-sm" data-te="a-scan" data-id="${escAttr(ev.id)}">${icon("te_scan")}Quét vé</button><button class="btn btn-outline btn-sm" data-te="a-poster" data-id="${escAttr(ev.id)}">${icon("te_qr")}Mã tại chỗ</button>` : ""}${canEv() && evPhase(ev, Date.now()) !== "upcoming" ? `<button class="btn btn-outline btn-sm" data-te="recap" data-id="${escAttr(ev.id)}">${icon("photo_camera")}Bài sau sự kiện</button>` : ""}</div></div>`).join("") || `<p class="small-note">Chưa có sự kiện.</p>`}</div>` : ""}
    ${canMod() ? `<div class="section-title"><h3>Kiểm duyệt khoảnh khắc</h3><span class="small-note">bài bị báo cáo / đang ẩn</span></div><div id="te-a-mod">${typeof fkSkeleton === "function" ? fkSkeleton(2, "list") : ""}</div>` : ""}
    ${secs}
    ${canGifts() ? `<div class="section-title"><h3>Quà tặng</h3>${canExport() ? `<button class="btn btn-outline btn-sm" data-te="a-gifts-csv">${icon("te_download")}CSV</button>` : ""}</div>
    <div id="te-a-gifts">${typeof fkSkeleton === "function" ? fkSkeleton(2, "list") : ""}</div>` : ""}`;
  ADMIN_SECTIONS.forEach(s=>{ const host = q("#te-as-" + s.id); if(host) Promise.resolve().then(()=> s.render(host)).catch(warn); });
  if(canMod()){
    const all = await safe(cloudEvents.listMoments({ all:true, limit: 200 }), []);
    const T = TM(), flagged = all.filter(p=> (Number(p.reportCount)||0) > 0 || p.hidden).sort((a,b)=> (Number(b.reportCount)||0) - (Number(a.reportCount)||0));
    const mb = q("#te-a-mod");
    if(mb){ mb.innerHTML = flagged.length ? `<div class="te-alist">${flagged.slice(0, 50).map(p=>{ const key = `${p.evId}/${p.id}`; return `<div class="te-arow">
        <div class="te-arow-b"><b>${esc(p.name || "")} · ${esc(p.evTitle || ((C.events.find(e=> e.id === p.evId)||{}).title) || p.evId)}</b><small>${nf(p.reportCount||0)} báo cáo · ${p.hidden ? "đang ẩn" : T && T.isHidden(p) ? "tạm ẩn" : p.modOk ? "đã duyệt" : "đang hiện"} · ${esc(String(p.text||"").slice(0, 80))}</small></div>
        <div class="te-arow-a"><button class="btn btn-outline btn-sm" data-te="mo-mod" data-id="${escAttr(key)}">${icon("tm_shield")}Xem &amp; xử lý</button></div></div>`; }).join("")}</div>`
      : `<p class="small-note">Không có bài nào bị báo cáo.</p>`;
      C.moments = C.moments || all; }
  }
  if(!canGifts()) return;
  const gifts = await safe(cloudEvents.allGifts(), []);
  const gbox = q("#te-a-gifts"); if(!gbox) return;
  gbox.innerHTML = gifts.length ? `<div class="te-alist">${gifts.slice(0, 80).map(g=> `<div class="te-arow"><div class="te-arow-b"><b>${esc(g.name||"")} — ${esc(g.item||g.title)}</b><small>${esc(g.reason||"")}${g.address ? " · " + esc(addrText(g.address)) : ""}${g.size ? " · size " + esc(g.size) : ""}</small></div>
    <div class="te-arow-a"><select data-te-gift-st="${escAttr(g.id)}" aria-label="Trạng thái quà">${Object.keys(GIFT_ST).map(k=> `<option value="${k}" ${g.status===k?"selected":""}>${esc(GIFT_ST[k][0])}</option>`).join("")}</select></div></div>`).join("")}</div>` : `<p class="small-note">Chưa trao quà nào.</p>`;
  qa("[data-te-gift-st]", gbox).forEach(sel=> sel.addEventListener("change", async ()=>{ try{ await cloudEvents.updateGift(sel.dataset.teGiftSt, { status: sel.value }); say("Đã cập nhật trạng thái quà"); }catch(e){ say(e.message, "error"); } }));
  TapEv._adminGifts = gifts;
}
/* Lưu tài liệu có ảnh/clip: tải tệp mới → lưu → dọn tệp đã bỏ */
async function saveWithMedia(btn, ed, scope, saveFn){
  const lab = btn.innerHTML; btn.disabled = true;
  try{
    const up = await ed.commit(scope, (k, n)=>{ btn.textContent = `Đang tải ảnh/video ${k}/${n}…`; });
    btn.textContent = "Đang lưu…";
    const r = await saveFn(up);
    for(const s of ed.removed()) cloudEvents.deleteMedia(s).catch(()=>{});
    return r;
  }catch(e){ btn.disabled = false; btn.innerHTML = retryLabel(e, lab); throw e; }
}
/* QC-10: tải ảnh lỗi/treo → nút trở lại trạng thái bấm được, ghi rõ "Thử lại" */
function retryLabel(e, lab){ return e && /media|idb|quota|unavailable|storage/i.test(String(e.code || "") + " " + String(e.message || "")) ? `${icon("refresh")}Lỗi tải ảnh — Thử lại` : lab; }
function chFormSheet(id){
  if(!need(canCh(), "tạo/sửa thử thách")) return;
  const ch = C.challenges.find(c=> c.id === id) || null;
  const today = todayS(), m0 = today.slice(0,8) + "01", mEnd = ds(new Date(parse(m0).getFullYear(), parse(m0).getMonth()+1, 0, 12));
  const c = Object.assign({ title:"", desc:"", metric:"sessions", target:20, unit:"buổi", start:m0, end:mEnd, points:300, giftTop:3, gifts:[{title:"Áo tập TapEasy",pid:"p_tee"},{title:"Bình nước TapEasy 750 ml",pid:"p_bottle"},{title:"Khăn tập TapEasy",pid:"p_towel"}], badge:{ tier:2, glyph:"", label:"" }, color:"coral", hidden:false, rules:[], eligibility:[], safety:[], media:[], coverId:"" }, ch || {});
  const T = TM(), ed = T ? T.createEditor({ kind:"challenge", media: T.mediaOf(c), coverId: c.coverId, allowUrl:true, label:"Ảnh bìa & ảnh thử thách" }) : null;
  sheet(`<div class="sheet-header"><h3>${ch ? "Sửa" : "Tạo"} thử thách</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <div class="tm-errs" id="tf-errs" hidden role="alert"></div>
    ${ed ? ed.html() : mediaMissingHTML()}
    <div class="field" style="margin-top:12px;"><label for="tf-title">Tên thử thách</label><input id="tf-title" maxlength="80" value="${escAttr(c.title)}" placeholder="VD: Tháng 12: Tập đủ 20 buổi"></div>
    <div class="field" style="margin-top:10px;"><label for="tf-desc">Mô tả &amp; luật (ít nhất 80 ký tự)</label><textarea id="tf-desc" rows="4" maxlength="1200">${esc(c.desc)}</textarea></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="tf-metric">Chỉ số</label><select id="tf-metric">${Object.keys(METRICS).map(k=> `<option value="${k}" ${c.metric===k?"selected":""}>${esc(METRICS[k].label)}</option>`).join("")}</select></div>
      <div class="field"><label for="tf-target">Mục tiêu</label><input id="tf-target" type="text" inputmode="decimal" maxlength="7" value="${escAttr(c.target)}"></div>
      <div class="field"><label for="tf-unit">Đơn vị</label><input id="tf-unit" maxlength="10" value="${escAttr(c.unit)}"></div></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="tf-start">Bắt đầu</label><input id="tf-start" type="date" value="${escAttr(c.start)}"></div>
      <div class="field"><label for="tf-end">Kết thúc</label><input id="tf-end" type="date" value="${escAttr(c.end)}"></div></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="tf-points">Điểm hoàn thành</label><input id="tf-points" type="number" min="0" max="5000" step="10" value="${escAttr(c.points)}"></div>
      <div class="field"><label for="tf-top">Số người nhận quà</label><input id="tf-top" type="number" min="0" max="50" value="${escAttr(c.giftTop)}"></div>
      <div class="field"><label for="tf-tier">Hạng huy hiệu</label><select id="tf-tier">${[[1,"Đồng"],[2,"Bạc"],[3,"Vàng"]].map(([v,l])=> `<option value="${v}" ${Number(obj(c.badge).tier)===v?"selected":""}>${l}</option>`).join("")}</select></div></div>
    <div class="field" style="margin-top:10px;"><label for="tf-rules">Luật &amp; cách tính (mỗi dòng 1 ý)</label><textarea id="tf-rules" rows="3" maxlength="1500">${esc(arr(c.rules).join("\n"))}</textarea></div>
    <div class="field" style="margin-top:10px;"><label for="tf-elig">Điều kiện tham gia (mỗi dòng 1 ý)</label><textarea id="tf-elig" rows="2" maxlength="800">${esc(arr(c.eligibility).join("\n"))}</textarea></div>
    <div class="field" style="margin-top:10px;"><label for="tf-safe">Lưu ý an toàn (mỗi dòng 1 ý)</label><textarea id="tf-safe" rows="2" maxlength="800">${esc(arr(c.safety).join("\n"))}</textarea></div>
    <div class="field" style="margin-top:10px;"><label for="tf-gifts">Quà theo hạng (mỗi dòng: Tên quà | mã sản phẩm)</label><textarea id="tf-gifts" rows="3">${esc(arr(c.gifts).map(g=> (g.title||g) + (g.pid ? " | " + g.pid : "")).join("\n"))}</textarea></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="tf-label">Nhãn huy hiệu</label><input id="tf-label" maxlength="6" value="${escAttr(obj(c.badge).label||"")}" placeholder="VD: 20"></div>
      <div class="field"><label for="tf-color">Màu</label><select id="tf-color"><option value="coral" ${c.color==="coral"?"selected":""}>Cam (năng lượng)</option><option value="mint" ${c.color!=="coral"?"selected":""}>Mint (sức khoẻ)</option></select></div></div>
    <label class="te-check"><input type="checkbox" id="tf-hidden" ${c.hidden?"checked":""}><span>Ẩn với người dùng (nháp)</span></label>
    <button class="btn btn-primary btn-block" id="tf-go">Lưu thử thách</button>
    ${ch ? `<button class="btn btn-ghost btn-block" id="tf-del">Xoá thử thách</button>` : ""}`);
  if(ed) ed.mount(q("#sheet-content"));
  if(T) T.bindCounter(q("#tf-desc"), T.LIMITS.minDesc.challenge);
  q("#tf-metric").addEventListener("change", ()=>{ const M = METRICS[q("#tf-metric").value]; if(M) q("#tf-unit").value = M.unit; });
  q("#tf-go").addEventListener("click", async e=>{
    const btn = e.currentTarget, v = s=> String(q(s).value||"").trim();
    const data = Object.assign({}, ch || {}, { title: v("#tf-title"), desc: v("#tf-desc"), metric: v("#tf-metric"), target: Number(v("#tf-target").replace(",", ".")), unit: v("#tf-unit") || (METRICS[v("#tf-metric")]||{}).unit,
      start: v("#tf-start"), end: v("#tf-end"), points: Math.max(0, Math.round(Number(v("#tf-points"))||0)), giftTop: Math.max(0, Math.round(Number(v("#tf-top"))||0)), color: v("#tf-color"), hidden: q("#tf-hidden").checked,
      rules: parseLines(v("#tf-rules")), eligibility: parseLines(v("#tf-elig"), 8), safety: parseLines(v("#tf-safe"), 8),
      gifts: v("#tf-gifts").split(/\n+/).map(l=> l.trim()).filter(Boolean).map(l=>{ const [t, pid] = l.split("|").map(s=> s.trim()); return { title:t, pid: pid||"" }; }),
      badge: { tier: Number(v("#tf-tier"))||1, glyph: (METRICS[v("#tf-metric")]||{}).glyph || "star", label: v("#tf-label") } });
    data.month = data.start.slice(0,7);
    const errs = [];
    if(!(data.target > 0)) errs.push({ field:"target", msg:"Mục tiêu phải lớn hơn 0." });
    if(!isDs(data.start) || !isDs(data.end) || data.end < data.start) errs.push({ field:"end", msg:"Kiểm tra ngày bắt đầu/kết thúc (kết thúc phải sau bắt đầu)." });
    const vr = T && ed ? T.validate("challenge", Object.assign({}, data, ed.value())) : { ok:false, errors:[{ field:"media", msg:"Thiếu events-media.js — chưa thêm được ảnh/clip." }] };
    const all = vr.errors.concat(errs);
    if(all.length){ if(T) T.showErrors(q("#tf-errs"), all, { title:q("#tf-title"), desc:q("#tf-desc"), media: ed && ed.el(), target:q("#tf-target"), end:q("#tf-end") }); else say(all[0].msg, "error"); return; }
    try{
      const chId = ch ? ch.id : await cloudEvents.newId("challenge");
      await saveWithMedia(btn, ed, `challenges/${chId}`, up=> cloudEvents.saveChallenge(Object.assign(data, { id: chId, media: up.media, coverId: up.coverId, cover: up.cover }, ch ? {} : { createdAt: Date.now() })));
      say("Đã lưu thử thách"); closeSheet(); await loadAll(true); rerender();
    }catch(err){ say(err.message || "Không lưu được", "error"); }
  });
  const del = q("#tf-del"); if(del) del.addEventListener("click", ()=> confirmDialog("Xoá thử thách?", "Toàn bộ tiến độ người tham gia của thử thách này sẽ bị xoá.", async ()=>{ try{ await cloudEvents.deleteChallenge(ch.id); if(!/^ch_\d{6}_/.test(ch.id) || ch.createdBy !== "seed") for(const m of arr(ch.media)) for(const s of [m.src, m.thumb, m.poster]) if(s) cloudEvents.deleteMedia(s).catch(()=>{}); await loadAll(true); rerender(); say("Đã xoá"); }catch(e){ say(e.message, "error"); } }, "Xoá", "delete"));
}
/* QU-19: đăng sự kiện ít chạm hơn — nút "Tạo sự kiện" rõ ràng, nhân bản sự kiện cũ, nháp tự lưu, trường tuỳ chọn gom vào "Thêm chi tiết" */
const EV_DRAFT_DAYS = 7;
function evDraft(){ const d = obj(TE().evDraft); return d.ts && Date.now() - d.ts < EV_DRAFT_DAYS*864e5 ? obj(d.data) : null; }
async function evFormSheet(id, opt){
  opt = opt || {};
  if(!need(canEv(), "tạo/sửa sự kiện")) return;
  const ev = C.events.find(e=> e.id === id) || null;
  const src = !ev && opt.from ? C.events.find(e=> e.id === opt.from) || null : null;
  const draft = !ev && !src && !opt.fresh ? evDraft() : null;
  /* FIX-security #4: Firebase — mã xoay vòng (Function checkinCodeNow) hoặc mã đã băm (ẩn); demo — mã 6 ký tự như cũ */
  const ci = ev ? obj(await safe(typeof cloudEvents.checkinInfo === "function" ? cloudEvents.checkinInfo(ev.id) : cloudEvents.getCheckinCode(ev.id).then(c=> ({ code:c })), { code: ev.checkinCode || "" })) : { code:"" };
  const code = ci.rotating ? "" : String(ci.code || ""), codeOptional = !!(ci.rotating || ci.hidden);
  const d0 = addD(todayS(), 7);
  const base = { title:"", sport:"run", start:`${d0}T06:00`, end:`${d0}T08:00`, venue:"", address:"", city:"Hà Nội", capacity:50, fee:0, points:100, options:[], bring:[], desc:"", agenda:[], requirements:[], perks:[], safety:[], media:[], coverId:"", organizer:"TapEasy", hidden:false };
  const copy = src ? Object.assign({}, src, { title: String(src.title||"").replace(/\s*\(bản sao\)$/i, "") + " (bản sao)", start:`${d0}T${hm(src.start) || "06:00"}`, end:`${d0}T${hm(src.end) || hm(src.start) || "08:00"}`, hidden:true }) : null;
  if(copy) ["id","seed","checkinCode","regCount","reviewCount","momentCount","rating","createdAt","updatedAt","seedRegs","demoPast"].forEach(k=> delete copy[k]);
  const e = Object.assign(base, ev || copy || draft || {});
  if(!isDs(String(e.start).slice(0,10))) e.start = `${d0}T06:00`;
  const T = TM(), ed = T ? T.createEditor({ kind:"event", media: T.mediaOf(e), coverId: e.coverId, allowUrl:true, label:"Ảnh & video sự kiện" }) : null;
  const ta = (id2, label, val, rows, ph)=> `<div class="field" style="margin-top:10px;"><label for="${id2}">${label}</label><textarea id="${id2}" rows="${rows||2}" maxlength="1500"${ph ? ` placeholder="${escAttr(ph)}"` : ""}>${esc(val)}</textarea></div>`;
  const filled = [e.agenda, e.requirements, e.perks, e.safety, e.options, e.bring].some(x=> arr(x).length);
  sheet(`<div class="sheet-header"><h3>${ev ? "Sửa sự kiện" : src ? "Nhân bản sự kiện" : "Tạo sự kiện"}</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    ${draft ? `<div class="te-warn soft" id="ef-draft">${icon("edit")}<p>Đang mở bản nháp tự lưu lúc ${esc(new Date(Number(TE().evDraft.ts)||0).toLocaleString("vi-VN"))}. Ảnh/clip cần chọn lại. <button type="button" class="te-link" id="ef-draft-drop">Bỏ nháp</button></p></div>` : ""}
    ${src ? `<p class="small-note">Đã chép nội dung từ “${esc(src.title)}” — đổi ngày giờ rồi lưu. Sự kiện mới đang ở chế độ <b>ẩn (nháp)</b> cho tới khi bạn bỏ tích “Ẩn”.</p>` : ""}
    <div class="tm-errs" id="ef-errs" hidden role="alert"></div>
    ${ed ? ed.html() : mediaMissingHTML()}
    <div class="field" style="margin-top:12px;"><label for="ef-title">Tên sự kiện</label><input id="ef-title" maxlength="90" value="${escAttr(e.title)}"></div>
    <div class="field-row" style="margin-top:10px;"><div class="field"><label for="ef-sport">Môn</label><select id="ef-sport">${Object.keys(SPORTS).map(k=> `<option value="${k}" ${e.sport===k?"selected":""}>${esc(SPORTS[k].label)}</option>`).join("")}</select></div>
      <div class="field"><label for="ef-city">Tỉnh/thành</label><select id="ef-city">${PROVINCES.map(p=> `<option ${e.city===p?"selected":""}>${esc(p)}</option>`).join("")}</select></div></div>
    <div class="field" style="margin-top:10px;"><label for="ef-date">Ngày</label><input id="ef-date" type="date" value="${escAttr(String(e.start).slice(0,10))}"></div>
    <div class="field-row" style="margin-top:10px;"><div class="field"><label for="ef-t1">Bắt đầu</label><input id="ef-t1" type="time" value="${escAttr(hm(e.start))}"></div><div class="field"><label for="ef-t2">Kết thúc</label><input id="ef-t2" type="time" value="${escAttr(hm(e.end))}"></div></div>
    <div class="field" style="margin-top:10px;"><label for="ef-venue">Điểm tập trung</label><input id="ef-venue" maxlength="90" value="${escAttr(e.venue)}"></div>
    <div class="field" style="margin-top:10px;"><label for="ef-addr">Địa chỉ (để mở Google Maps)</label><input id="ef-addr" maxlength="160" value="${escAttr(e.address)}"></div>
    <div class="field" style="margin-top:10px;"><label for="ef-desc">Mô tả (ít nhất 80 ký tự)</label><textarea id="ef-desc" rows="4" maxlength="1500" placeholder="Nội dung chính, ai phù hợp, cường độ, điểm đặc biệt…">${esc(e.desc)}</textarea></div>
    <details class="te-more"${filled || ev ? " open" : ""}><summary>${icon("tune")}<span>Thêm chi tiết <small>số chỗ, phí, lịch trình, điều kiện, quà, an toàn, mã điểm danh</small></span></summary>
    <div class="field-row" style="margin-top:10px;"><div class="field"><label for="ef-cap">Số chỗ</label><input id="ef-cap" type="number" inputmode="numeric" min="1" max="5000" value="${escAttr(Number(e.capacity)||50)}"></div>
      <div class="field"><label for="ef-fee">Phí (đ)</label><input id="ef-fee" type="number" inputmode="numeric" min="0" step="1000" value="${escAttr(Number(e.fee)||0)}"></div><div class="field"><label for="ef-pts">Điểm thưởng khi điểm danh</label><input id="ef-pts" type="number" inputmode="numeric" min="0" max="2000" step="10" value="${escAttr(Number(e.points)||0)}"></div></div>
    ${ta("ef-agenda", "Lịch trình (mỗi dòng: giờ | nội dung)", arr(e.agenda).map(a=> (a.t ? a.t + " | " : "") + (a.x||"")).join("\n"), 4, "05:15 | Điểm danh, nhận số\n05:30 | Khởi động cùng coach")}
    ${ta("ef-req", "Điều kiện tham gia (mỗi dòng 1 ý)", arr(e.requirements).join("\n"), 2, "VD: Từ 16 tuổi; chạy liên tục được 30 phút")}
    ${ta("ef-perks", "Quà &amp; quyền lợi (mỗi dòng 1 ý)", arr(e.perks).join("\n"), 2, "VD: Huy chương hoàn thành; +150 điểm khi điểm danh")}
    ${ta("ef-safe", "Quy định an toàn (mỗi dòng 1 ý)", arr(e.safety).join("\n"), 3, "VD: Có y tế tại điểm xuất phát; mưa giông báo hoãn qua app")}
    ${ta("ef-opts", "Lựa chọn khi đăng ký (mỗi dòng 1 mục — cự ly, hạng cân…)", arr(e.options).join("\n"), 3)}
    ${ta("ef-bring", "Mang theo (mỗi dòng 1 mục)", arr(e.bring).join("\n"), 2)}
    <div class="field" style="margin-top:10px;"><label for="ef-code">${ci.rotating ? "Mã điểm danh dự phòng (máy chủ đang cấp mã xoay vòng 60 giây — để trống)" : "Mã điểm danh tại chỗ (6 ký tự)"}</label><div class="te-code-in"><input id="ef-code" maxlength="6" value="${escAttr(code)}" autocapitalize="characters"${codeOptional ? ` placeholder="${ci.rotating ? "Mã xoay vòng" : "Đã đặt (ẩn) — để trống để giữ mã cũ"}"` : ""}><button class="btn btn-outline" type="button" id="ef-code-new">Tạo mã mới</button></div></div>
    </details>
    <label class="te-check"><input type="checkbox" id="ef-hidden" ${e.hidden?"checked":""}><span>Ẩn với người dùng (nháp)</span></label>
    <button class="btn btn-primary btn-block" id="ef-go">${icon("event")}${ev ? "Lưu sự kiện" : "Đăng sự kiện"}</button>
    ${ev ? `<div class="te-row-btns"><button class="btn btn-ghost btn-sm" type="button" data-te="a-ev-dup" data-id="${escAttr(ev.id)}">${icon("content_copy")}Nhân bản</button><button class="btn btn-ghost btn-sm" type="button" id="ef-del">Xoá sự kiện</button></div>` : ""}`);
  if(ed) ed.mount(q("#sheet-content"));
  if(T) T.bindCounter(q("#ef-desc"), T.LIMITS.minDesc.event);
  const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  q("#ef-code-new").addEventListener("click", ()=>{ q("#ef-code").value = Array.from({length:6}, ()=> CH[Math.floor(Math.random()*CH.length)]).join(""); });
  if(!code && !codeOptional) q("#ef-code-new").click();
  const v = s=> String((q(s)||{}).value||"").trim();
  const read = ()=>{ const date = v("#ef-date");
    return Object.assign({}, ev || {}, { title: v("#ef-title"), sport: v("#ef-sport"), city: v("#ef-city"), start:`${date}T${v("#ef-t1")||"06:00"}`, end:`${date}T${v("#ef-t2")||v("#ef-t1")||"08:00"}`,
      venue: v("#ef-venue"), address: v("#ef-addr"), capacity: Math.max(1, Math.round(Number(v("#ef-cap"))||1)), fee: Math.max(0, Math.round(Number(v("#ef-fee"))||0)), points: Math.max(0, Math.min(2000, Math.round(Number(v("#ef-pts"))||0))),
      agenda: parseAgenda(v("#ef-agenda")), requirements: parseLines(v("#ef-req")), perks: parseLines(v("#ef-perks")), safety: parseLines(v("#ef-safe")),
      options: v("#ef-opts").split(/\n+/).map(s2=> s2.trim()).filter(Boolean).slice(0, 20).map(s2=> s2.slice(0, 60)), bring: parseLines(v("#ef-bring")),
      desc: v("#ef-desc"), hidden: q("#ef-hidden").checked, checkinCode: v("#ef-code").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6) }); };
  /* nháp tự lưu (chỉ sự kiện mới) — ảnh/clip không lưu trong nháp */
  if(!ev){ let tmr = 0; const box = q("#sheet-content");
    const keep = ()=>{ clearTimeout(tmr); tmr = setTimeout(()=>{ try{ if(!q("#ef-title")) return; const d = read(); delete d.checkinCode; TE().evDraft = { ts: Date.now(), data: d }; save(); }catch(err){ warn(err); } }, 600); };
    if(box){ box.addEventListener("input", keep); box.addEventListener("change", keep); }
    const dd = q("#ef-draft-drop"); if(dd) dd.addEventListener("click", ()=>{ delete TE().evDraft; save(); evFormSheet(null, { fresh:true }); }); }
  q("#ef-go").addEventListener("click", async e2=>{
    const btn = e2.currentTarget, date = v("#ef-date");
    const data = read();
    ["regCount","reviewCount","momentCount","rating"].forEach(k=> delete data[k]);
    const errs = [];
    if(!isDs(date)) errs.push({ field:"date", msg:"Chọn ngày diễn ra." });
    else if(data.end < data.start) errs.push({ field:"t2", msg:"Giờ kết thúc phải sau giờ bắt đầu." });
    if(!data.venue) errs.push({ field:"venue", msg:"Nhập điểm tập trung." });
    if(data.checkinCode.length !== 6 && !(codeOptional && !data.checkinCode)){ const det = q(".te-more"); if(det) det.open = true; errs.push({ field:"code", msg:"Mã điểm danh cần 6 ký tự." }); }
    const vr = T && ed ? T.validate("event", Object.assign({}, data, ed.value())) : { ok:false, errors:[{ field:"media", msg:"Thiếu events-media.js — chưa thêm được ảnh/clip." }] };
    const all = vr.errors.concat(errs);
    if(all.length){ if(T) T.showErrors(q("#ef-errs"), all, { title:q("#ef-title"), desc:q("#ef-desc"), media: ed && ed.el(), date:q("#ef-date"), t2:q("#ef-t2"), venue:q("#ef-venue"), code:q("#ef-code") }); else say(all[0].msg, "error"); return; }
    try{
      const evId = ev ? ev.id : await cloudEvents.newId("event");
      await saveWithMedia(btn, ed, `events/${evId}`, up=> cloudEvents.saveEvent(Object.assign(data, { id: evId, media: up.media, coverId: up.coverId, cover: up.cover }, ev ? {} : { createdAt: Date.now() })));
      if(!ev){ delete TE().evDraft; save(); }
      say(ev ? "Đã lưu sự kiện" : data.hidden ? "Đã lưu sự kiện (đang ẩn)" : "Đã đăng sự kiện"); closeSheet(); await loadAll(true); rerender();
    }catch(err){ say(err.message || "Không lưu được", "error"); }
  });
  const del = q("#ef-del"); if(del) del.addEventListener("click", ()=> confirmDialog("Xoá sự kiện?", "Danh sách đăng ký, review và ảnh/clip của sự kiện cũng bị xoá.", async ()=>{ try{ await cloudEvents.deleteEvent(ev.id); if(!ev.seed) for(const m of arr(ev.media)) for(const s of [m.src, m.thumb, m.poster]) if(s && !mediaShared(s, ev.id)) cloudEvents.deleteMedia(s).catch(()=>{}); await loadAll(true); rerender(); say("Đã xoá"); }catch(e){ say(e.message, "error"); } }, "Xoá", "delete"));
}
/* ảnh/clip dùng chung giữa sự kiện gốc và bản nhân bản → không xoá tệp khi còn sự kiện khác dùng */
const mediaShared = (src, exceptId)=> C.events.some(e=> e.id !== exceptId && arr(e.media).some(m=> m && (m.src === src || m.thumb === src || m.poster === src)));
async function adminRegs(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  sheet(`<div class="sheet-header"><h3>Danh sách đăng ký</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div><div id="te-regs">${typeof fkSkeleton === "function" ? fkSkeleton(4, "list") : ""}</div>`);
  const regs = (await safe(cloudEvents.listRegs(id), [])).filter(r=> r.status !== "cancelled").sort((a,b)=> (a.status === b.status ? 0 : a.status === "checked_in" ? -1 : 1) || String(a.name).localeCompare(String(b.name), "vi"));
  const box = q("#te-regs"); if(!box) return;
  const ci = regs.filter(r=> r.status === "checked_in").length;
  box.innerHTML = `<div class="te-reg-ev"><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))} · ${regs.length} đăng ký · ${ci} đã điểm danh</small></div>
    <div class="te-row-btns"><button class="btn btn-primary btn-sm" data-te="a-regs-csv" data-id="${escAttr(id)}">${icon("te_download")}Xuất CSV</button><button class="btn btn-outline btn-sm" data-te="a-scan" data-id="${escAttr(id)}">${icon("te_scan")}Quét vé</button></div>
    <div class="te-alist">${regs.slice(0, 300).map(r=> `<div class="te-arow"><div class="te-arow-b"><b>${esc(r.name||"")}${r.bot ? ` <small class="te-dim">(mẫu)</small>` : ""}</b><small>${esc(r.phone||"")} · ${esc(r.option||"")} · vé ${esc(r.code||"")}</small></div><span class="te-st ${r.status==="checked_in"?"ok":"dim"}">${r.status==="checked_in"?"Đã điểm danh":"Chưa đến"}</span></div>`).join("")}</div>`;
  TapEv._lastRegs = regs;
}
async function exportRegsCSV(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  const regs = (await safe(cloudEvents.listRegs(id), [])).filter(r=> r.status !== "cancelled");
  downloadFile(`dang-ky-${id}.csv`, toCSV(regs, [{label:"Họ tên",key:"name"},{label:"SĐT",key:"phone"},{label:"Lựa chọn",key:"option"},{label:"Liên hệ khẩn cấp",key:"sos"},{label:"Ghi chú",key:"note"},{label:"Mã vé",key:"code"},
    {label:"Trạng thái",get:r=> r.status==="checked_in" ? "Đã điểm danh" : "Đã đăng ký"},{label:"Giờ điểm danh",get:r=> r.checkedInAt ? new Date(r.checkedInAt).toLocaleString("vi-VN") : ""},{label:"Đăng ký lúc",get:r=> r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : ""}]), "text/csv;charset=utf-8");
}
async function exportChallengeCSV(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  const b = buildBoard(await safe(cloudEvents.listEntries(id, minS(todayS(), ch.end)), []), TE().joined[id] ? myRow(ch, progress(ch, state, TE().joined[id], minS(todayS(), ch.end))) : null, "month");
  downloadFile(`thu-thach-${id}.csv`, toCSV(b.rows, [{label:"Hạng",key:"rank"},{label:"Họ tên",key:"name"},{label:`Tiến độ (${ch.unit||""})`,key:"score"},{label:"Hoàn thành",get:r=> r.score >= ch.target ? "Có" : ""},{label:"Mã người dùng",key:"uid"},{label:"Người chơi mẫu",get:r=> r.bot ? "x" : ""}]), "text/csv;charset=utf-8");
}
async function awardChallenge(id){
  const ch = C.challenges.find(c=> c.id === id); if(!ch) return;
  const entries = await safe(cloudEvents.listEntries(id, ch.end), []);
  const b = buildBoard(entries, TE().joined[id] ? myRow(ch, progress(ch, state, TE().joined[id], ch.end)) : null, "month");
  const giftTop = Math.max(0, Math.min(50, Math.round(Number(ch.giftTop)||0)));
  const top = b.rows.filter(r=> r.rank <= giftTop && r.score > 0), gifts = arr(ch.gifts);
  if(!top.length){ say("Chưa có ai đủ điều kiện nhận quà", "info"); return; }
  /* QS-01 (Nghiêm trọng): tên trên bảng xếp hạng là dữ liệu người dùng → KHÔNG đưa vào confirmDialog (nhận HTML).
     Hộp xác nhận riêng: mọi tên/cờ qua esc(); hiện cờ nghi vấn (nhập tay > 30 %, vượt trần, tự khai cao hơn mức nhận) để duyệt top trước khi trao. */
  const flagTxt = r=>{ const f = arr(r.flags), o = [];
    if(f.includes("manual_hi")) o.push(`nhập tay ${r.value > 0 && r.manual != null ? Math.round(Number(r.manual)/Number(r.value)*100) + "%" : "> 30%"}`);
    if(f.includes("capped") || Number(r.claimedMax) > Number(r.value)) o.push(`tự khai ${nf(Number(r.claimedMax)||0, 1)} > mức nhận`);
    return o; };
  const rowsHTML = top.slice(0, 50).map(r=>{ const fl = flagTxt(r); return `<li class="${fl.length ? "flag" : ""}"><b>#${Number(r.rank)||0}</b> <span>${esc(cleanName(r.name))}</span> <small>${nf(r.score, 1)} ${esc(ch.unit||"")}${r.bot ? " · mẫu" : ""}</small>${fl.length ? `<em>${icon("warning")}${esc(fl.join(" · "))}</em>` : ""}</li>`; }).join("");
  const nFlag = top.filter(r=> flagTxt(r).length).length;
  sheet(`<div class="sheet-header"><h3>Chốt kết quả &amp; trao quà?</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <p class="small-note">${nf(top.length)} người hạng 1–${nf(giftTop)} của “${esc(ch.title)}” sẽ nhận thông báo “Bạn nhận quà” và được giao miễn phí.</p>
    ${nFlag ? `<div class="te-warn">${icon("warning")}<p>${nf(nFlag)} người có dấu hiệu cần đối chiếu (nhập tay nhiều hoặc tự khai vượt mức máy chủ nhận). Hãy yêu cầu ảnh chụp đồng hồ/ứng dụng trước khi giao quà.</p></div>` : ""}
    <ol class="te-award-list">${rowsHTML}</ol>
    <div class="te-row-btns"><button class="btn btn-outline btn-block" data-te="close">Huỷ</button><button class="btn btn-primary btn-block" id="te-award-go">${icon("te_gift")}Trao quà</button></div>`, { id:"award:" + ch.id });
  const go = q("#te-award-go"); if(!go) return;
  go.addEventListener("click", async ()=>{
    go.disabled = true;
    let n = 0;
    for(const r of top){ const g = gifts[Math.min(r.rank-1, gifts.length-1)] || { title:"Quà TapEasy" };
      const res = await safe(cloudEvents.createGift({ key:`g_${ch.id}_${r.uid}`, uid:r.uid, name: cleanName(r.name), title:`Quà hạng ${Number(r.rank)||0}: ${g.title||g}`, item: g.title||String(g), pid: g.pid||"", reason:`Hạng ${Number(r.rank)||0}/${Number(b.total)||0} · ${ch.title}`, month: ch.month || String(ch.start).slice(0,7), source:{ type:"challenge", id:ch.id, rank: Number(r.rank)||0 }, review: flagTxt(r).length ? flagTxt(r).join(" · ") : "" }), null);
      if(res) n++; }
    try{ closeSheet(); }catch(e){}
    say(`Đã trao ${n} quà`, "te_gift"); C.gifts = await safe(cloudEvents.myGifts(), C.gifts); checkGiftNotice(); rerender();
  });
}
const cleanName = s=> String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
async function adminPoster(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  /* FIX-security #4: Firebase có Function checkinCodeNow → mã XOAY VÒNG 60 giây (màn hình tại quầy tự làm mới, không in);
     không thì mã 6 ký tự cố định (demo / mã cũ) — in được. Mã đã băm (ẩn) không xem lại được → đặt mã mới trong Sửa. */
  const ci = obj(await safe(typeof cloudEvents.checkinInfo === "function" ? cloudEvents.checkinInfo(id) : cloudEvents.getCheckinCode(id).then(c=> ({ code:c })), {}));
  const code = String(ci.code || "");
  if(!code){ say(ci.hidden ? "Mã điểm danh đã được mã hoá — mở Sửa sự kiện → Tạo mã mới để in lại" : "Sự kiện chưa có mã điểm danh — mở Sửa để tạo", "error"); return; }
  const tag = "ci-" + Date.now().toString(36);
  sheet(`<div class="sheet-header"><h3>Mã điểm danh tại chỗ</h3><button class="icon-btn" data-te="close" aria-label="Đóng">${icon("close")}</button></div>
    <div class="te-poster" id="te-poster" data-ci="${escAttr(tag)}"><div class="te-poster-brand">TapEasy · Điểm danh</div><b>${esc(ev.title)}</b><small>${esc(whenText(ev, true))}</small>
      <div class="te-poster-qr" id="te-poster-qr">${TapQR.svg(qrVenue(ev.id, code), { size:240, margin:2, ecl:"Q", label:"Mã QR điểm danh" })}</div>
      <div class="te-tk-code" id="te-poster-code">${esc(code)}</div><small>Mở app TapEasy → Sự kiện → Điểm danh → quét mã hoặc nhập 6 ký tự</small></div>
    ${ci.rotating ? `<p class="small-note te-center" id="te-poster-exp" aria-live="polite">Mã đổi sau mỗi 60 giây — để màn hình này mở tại quầy (không in).</p>`
      : `<div class="te-row-btns center"><button class="btn btn-primary btn-sm" data-te="a-poster-print">${icon("te_download")}In / lưu PDF</button></div>
    <p class="small-note">Chỉ đưa mã này ở quầy điểm danh vào đúng ngày sự kiện. Muốn đổi mã → Sửa sự kiện → Tạo mã mới.</p>`}`);
  if(!ci.rotating) return;
  const tick = async ()=>{
    const box = q(`#te-poster[data-ci="${CSS.escape(tag)}"]`); if(!box) return;           // đã đóng / mở tấm khác → dừng
    const n = obj(await safe(cloudEvents.checkinInfo(id), {})); if(!n.code || !q(`#te-poster[data-ci="${CSS.escape(tag)}"]`)) return;
    const qr = q("#te-poster-qr"), cd = q("#te-poster-code");
    if(qr) qr.innerHTML = TapQR.svg(qrVenue(ev.id, String(n.code)), { size:240, margin:2, ecl:"Q", label:"Mã QR điểm danh" });
    if(cd) cd.textContent = String(n.code);
    setTimeout(tick, Math.max(5000, Math.min(60000, (Number(n.expiresAt) || Date.now() + 30000) - Date.now() + 500)));
  };
  setTimeout(tick, Math.max(5000, Math.min(60000, (Number(ci.expiresAt) || Date.now() + 30000) - Date.now() + 500)));
}
function adminScan(id){
  const ev = C.events.find(e=> e.id === id); if(!ev) return;
  let count = 0;
  openScanner({ title:"Quét vé người tham gia", hint:"Quét mã QR trên vé trong app của người tham gia.", placeholder:"Hoặc nhập mã vé 6 ký tự",
    manualWrap: v=> /^TAPEASY:/.test(v) ? v : qrTicket(ev.id, v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
    onCode: async text=>{
      const p = parseQR(text);
      if(!p || p.kind !== "ticket"){ say("Không phải vé TapEasy", "error"); return false; }
      if(p.evId !== ev.id){ say("Vé thuộc sự kiện khác", "error"); return false; }
      try{ const r = await cloudEvents.adminCheckIn(ev.id, p.code); count++;
        if(C.regs[ev.id] && C.regs[ev.id].code === p.code) C.regs[ev.id].status = "checked_in";
        say(`${r.name || "Vé " + p.code} — đã điểm danh (${count})`, "check_circle"); const m = q("#te-cam-msg"); if(m) m.textContent = `Đã điểm danh: ${r.name || p.code}. Quét vé tiếp theo…`;
      }catch(e){ say(e.message, "error"); }
      return false;   // giữ camera để quét tiếp
    } });
}
/* Tải tệp: <a download> (web) → navigator.share (app) → sao chép */
async function downloadFile(name, content, mime){
  try{
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const isNative = !!(G.Capacitor && G.Capacitor.isNativePlatform && G.Capacitor.isNativePlatform());
    if(isNative && navigator.canShare && typeof File === "function"){ const f = new File([blob], name, { type: blob.type }); if(navigator.canShare({ files:[f] })){ await navigator.share({ files:[f], title:name }); return; } }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1500);
    say(`Đã tạo tệp ${name}`, "te_download");
  }catch(e){
    try{ await navigator.clipboard.writeText(String(content)); say("Không tải được tệp — đã sao chép nội dung", "content_copy"); }catch(_){ say("Không xuất được tệp", "error"); }
  }
}
TapEv.downloadFile = downloadFile; TapEv.toCSV = toCSV;

/* ---------------------------------------------------------------------
   11. SHEET + HÀNH ĐỘNG CHUNG (uỷ quyền click qua data-te)
   --------------------------------------------------------------------- */
function sheet(html, opt){
  openSheet(html);
  const sc = q("#sheet-content");
  if(sc){ sc.setAttribute("role", "dialog"); sc.setAttribute("aria-modal", "true"); sc.classList.add("te-sheet"); sc.dataset.sheetId = (opt && opt.id) || ""; sc.scrollTop = 0; }
}
TapEv.sheet = sheet;
function rerender(){
  if(curScreen() === "events") renderHub();
  if(curScreen() === "home") homeInject();
  refreshBadges();
}
TapEv.rerender = rerender;
const ACT = {
  back: ()=> goto(_prev && _prev !== "events" ? _prev : "home"),
  close: ()=> closeSheet(),
  reload: ()=> loadAll(true).then(rerender),
  tab: id=>{ if(curScreen() !== "events") openHub(id); else { _tab = id; try{ closeSheet(); }catch(e){} renderHub(); const t = q(".te-tabs"); if(t) t.scrollIntoView({ block:"nearest" }); } },
  hub: id=> openHub(id || "challenges"),
  goto: id=>{ try{ closeSheet(); }catch(e){} goto(id); },
  ch: id=> openChallenge(id),
  join: (id, el, e)=>{ e && e.stopPropagation(); joinChallenge(id); },
  leave: id=> leaveChallenge(id),
  period: (id, el)=>{ _boardPeriod[id] = el.dataset.p; const box = q("#te-board-" + CSS.escape(id)); const ch = C.challenges.find(c=> c.id === id); if(box && ch) box.outerHTML = boardHTML(ch); },
  manual: id=> openManual(id),
  "manual-del": (id, el)=> deleteManual(id, el.dataset.x),
  weighin: id=> openWeighIn(id),
  ev: id=> openEvent(id),
  evf: id=>{ _evFilter = id; renderHub(); },
  register: id=> openRegister(id),
  ticket: id=> openTicket(id),
  unreg: id=> cancelReg(id),
  ics: id=> downloadICS(id),
  checkin: id=> openCheckIn(id),
  review: id=> openReview(id),
  "mo-review": id=> openReview(id, { back:"moments" }),
  recap: id=> openRecap(id),
  "mo-new": ()=> openNewMoment(),
  "mo-like": id=> moLike(id),
  "mo-cmt": id=> openComments(id),
  "cmt-del": (id, el)=>{ const [evId, pid] = String(id).split("/"); confirmDialog("Xoá bình luận?", "Bình luận sẽ bị xoá vĩnh viễn.", async ()=>{ try{ await cloudEvents.deleteComment(evId, pid, el.dataset.c); if(TapEv._cmtPaint) await TapEv._cmtPaint(); say("Đã xoá bình luận", "tm_trash"); }catch(e){ say(e.message, "error"); } }, "Xoá", "delete"); },
  "mo-report": id=> openReport(id),
  "mo-block": id=>{ const { p } = moFind(id); if(p) blockUserFlow(p.uid, p.name, "moment"); },
  "cmt-block": (id, el)=> blockUserFlow(el && el.dataset && el.dataset.u, el && el.dataset && el.dataset.n, "comment"),
  "mo-mod": id=> openModerate(id),
  "mo-modact": (id, el)=> moModAct(id, el.dataset.a),
  "mo-edit": id=>{ const { evId, pid, p } = moFind(id); if(p && p.kind === "recap") openRecap(evId, pid); else openReview(evId, { back: curScreen() === "events" && _tab === "moments" && !q("#sheet-backdrop.open") ? "moments" : "" }); },
  "mo-del": id=> deleteMyPost(id),
  photo: (id, el)=>{ const T = TM(); if(T && el && el.src) T.openLightbox([{ id:"p", kind:"image", src: el.currentSrc || el.src, alt: el.alt || "Ảnh sự kiện" }], 0); },
  gift: id=> openGift(id),
  ledger: ()=> openLedger(),
  redeem: ()=>{ if(G.TapShop && G.TapShop.openRedeem) G.TapShop.openRedeem(); },
  cart: ()=>{ if(G.TapShop && G.TapShop.openCart) G.TapShop.openCart(); else say("Cửa hàng chưa được cài", "info"); },
  "admin-off": ()=>{ if(hasRBAC() && G.TE_RBAC && G.TE_RBAC.logout){ try{ G.TE_RBAC.logout(); }catch(e){} } else { state.isAdmin = false; save(); } _tab = "challenges"; say("Đã tắt chế độ quản trị", "te_admin"); loadAll(true).then(rerender); },
  "a-ch-edit": id=> chFormSheet(id),
  "a-ch-csv": id=>{ if(need(canCh() && canExport(), "xuất CSV thử thách")) exportChallengeCSV(id); },
  "a-ch-award": id=>{ if(need(canCh() && canGifts(), "chốt kết quả & trao quà")) awardChallenge(id); },
  "a-ev-edit": id=> evFormSheet(id),
  "a-ev-new": ()=> evFormSheet(null),
  "a-ev-dup": id=> evFormSheet(null, { from: id }),
  "a-regs": id=>{ if(need(canCI(), "xem danh sách đăng ký")) adminRegs(id); },
  "a-regs-csv": id=>{ if(need(canCI() && canExport(), "xuất CSV")) exportRegsCSV(id); },
  "a-scan": id=>{ if(need(canCI(), "điểm danh người tham gia")) adminScan(id); },
  "a-poster": id=>{ if(need(canCI(), "xem mã điểm danh")) adminPoster(id); },
  "a-poster-print": ()=>{ const p = q("#te-poster"); if(!p) return; const w = G.open("", "_blank"); if(!w){ say("Trình duyệt chặn cửa sổ in", "error"); return; }
    w.document.write(`<title>Điểm danh TapEasy</title><style>body{font-family:Inter,Arial,sans-serif;text-align:center;padding:40px;color:#061A24}b{display:block;font-size:28px;margin:12px 0}small{display:block;font-size:16px;color:#333;margin:6px 0}.te-tk-code{font:700 44px/1 monospace;letter-spacing:10px;margin:18px 0}svg{width:420px;height:420px}</style>${p.innerHTML}`); w.document.close(); setTimeout(()=>{ try{ w.print(); }catch(e){} }, 300); },
  "a-gifts-csv": async ()=>{ const gifts = await safe(cloudEvents.allGifts(), []);
    downloadFile("qua-tang.csv", toCSV(gifts, [{label:"Người nhận",key:"name"},{label:"Quà",get:g=> g.item||g.title},{label:"Lý do",key:"reason"},{label:"Size",key:"size"},{label:"SĐT",get:g=> (g.address||{}).phone||""},{label:"Địa chỉ",get:g=> addrText(g.address)},{label:"Trạng thái",get:g=> (GIFT_ST[g.status]||GIFT_ST.new)[0]},{label:"Tạo lúc",get:g=> new Date(g.createdAt||0).toLocaleString("vi-VN")}]), "text/csv;charset=utf-8"); },
};
TapEv.act = (name, fn)=>{ ACT[name] = fn; };
/* công tắc "Tự phát clip" ở bảng tin Khoảnh khắc */
document.addEventListener("change", e=>{
  const t = e.target; if(!t || !t.matches || !t.matches("[data-te-auto]")) return;
  const T = TM(); if(!T) return;
  T.setAutoplay(t.checked); const row = q("#te-mo-auto"); if(row){ const w = document.createElement("div"); w.innerHTML = autoplayRowHTML(); row.replaceWith(w.firstElementChild); const inp = q("#te-mo-auto [data-te-auto]"); if(inp) inp.focus(); }
  say(t.checked ? "Đã bật tự phát clip (không tiếng)" : "Đã tắt tự phát clip", "tm_autoplay");
});
document.addEventListener("click", e=>{
  const el = e.target.closest && e.target.closest("[data-te]"); if(!el) return;
  const fn = ACT[el.dataset.te]; if(!fn) return;
  if(el.tagName === "A" && el.getAttribute("href")) return;
  e.preventDefault();
  try{ const r = fn(el.dataset.id, el, e); if(r && r.catch) r.catch(err=> say(err.message || "Có lỗi xảy ra", "error")); }catch(err){ warn(err); say("Có lỗi xảy ra", "error"); }
});
document.addEventListener("keydown", e=>{
  if(e.key !== "Enter" && e.key !== " ") return;
  const el = e.target; if(!el || !el.matches || !el.matches("[data-te][role=button]")) return;
  e.preventDefault(); el.click();
});

/* ---------------------------------------------------------------------
   12. TÍCH HỢP: Trang chủ · Hồ sơ · Menu · Nút quay lại · Chế độ quản trị
   --------------------------------------------------------------------- */
function homeCardHTML(){
  const today = todayS(), now = Date.now();
  const ng = newGifts();
  const active = C.challenges.filter(c=> chStatus(c, today) === "active");
  const mine = active.filter(c=> TE().joined[c.id]);
  const nextEv = C.events.filter(e=> myReg(e.id) && evPhase(e, now) !== "ended")[0];
  const pts = Points.balance();
  let body = "";
  if(mine.length){
    body = mine.slice(0, 2).map(ch=>{ const pr = myProgress(ch), b = boardFor(ch, "month"), dig = ch.metric==="run_km"||ch.metric==="weight_loss" ? 1 : 0;
      return `<button class="te-hc-row" data-te="ch" data-id="${escAttr(ch.id)}"><span class="te-hc-b">${chBadgeSVG(ch, 40, { label:false })}</span>
        <span class="te-hc-i"><b>${esc(ch.title)}</b><span class="te-bar sm"><i style="width:${Math.round(pr.pct*100)}%"></i></span>
        <small>${nf(pr.value, dig)}/${nf(ch.target,1)} ${esc(ch.unit||"")} · còn ${daysLeft(ch, today)} ngày${pr.done ? " · đã đạt" : ""}</small></span>
        ${b.me ? `<span class="te-hc-rank">#${b.me.rank}<small>/${b.total}</small></span>` : ""}</button>`; }).join("");
  } else if(active.length){
    const n = active.reduce((a,c)=> a + entriesCount(c), 0);
    body = `<div class="te-hc-promo"><div><b>${active.length} thử thách tháng ${Number(today.slice(5,7))} đang mở</b><small>${nf(n)} lượt tham gia · top nhận quà giao miễn phí</small></div><button class="btn btn-primary btn-sm" data-te="hub" data-id="challenges">Tham gia</button></div>`;
  }
  if(nextEv){ const r = myReg(nextEv.id), live = canCheckIn(nextEv, now) && r.status !== "checked_in";
    body += `<button class="te-hc-ev" data-te="${live ? "checkin" : "ticket"}" data-id="${escAttr(nextEv.id)}"><span class="te-hc-date"><b>${new Date(isoToTs(nextEv.start)).getDate()}</b><small>TH${new Date(isoToTs(nextEv.start)).getMonth()+1}</small></span>
      <span class="te-hc-i"><b>${esc(nextEv.title)}</b><small>${esc(whenText(nextEv))} · vé ${esc(r.code)}</small></span><span class="te-hc-cta ${live ? "live" : ""}">${icon(live ? "te_scan" : "te_ticket")}${live ? "Điểm danh" : "Vé"}</span></button>`;
  } else {
    const up = C.events.filter(e=> evPhase(e, now) === "upcoming" && !(e.capacity && e.regCount >= e.capacity))[0];
    if(up) body += `<button class="te-hc-ev" data-te="ev" data-id="${escAttr(up.id)}"><span class="te-hc-date"><b>${new Date(isoToTs(up.start)).getDate()}</b><small>TH${new Date(isoToTs(up.start)).getMonth()+1}</small></span>
      <span class="te-hc-i"><b>${esc(up.title)}</b><small>${esc(whenText(up))} · ${Number(up.fee) ? money(up.fee) : "Miễn phí"}</small></span><span class="te-hc-cta">${icon("chevron_right")}</span></button>`;
  }
  if(!body && !ng.length) return "";
  return `<div class="card te-home" data-te-home>
    <div class="te-hc-head"><button class="te-hc-title" data-te="hub" data-id="challenges">${icon("te_trophy")}<span>Sự kiện &amp; Thi đua</span>${icon("chevron_right")}</button>
      <button class="te-pts sm" data-te="hub" data-id="gifts" aria-label="${nf(pts)} điểm">${icon("te_coin")}<b>${nf(pts)}</b></button></div>
    ${ng.length ? giftBannerHTML(ng[0]) : ""}
    ${body}
  </div>`;
}
let _homeLoadT = 0;
function homeInject(){
  const el = q("#home-content"); if(!el || !state.onboarded) return;
  qa(".te-home", el).forEach(n=> n.remove());
  if(!C.ready){ if(Date.now() - _homeLoadT > 30000){ _homeLoadT = Date.now(); loadAll().then(()=>{ if(C.ready && curScreen() === "home") homeInject(); checkGiftNotice(); }); } return; }
  const html = homeCardHTML(); if(!html) return;
  const w = document.createElement("div"); w.innerHTML = html.trim(); const card = w.firstElementChild;
  const metric = q(".metric-grid", el);
  if(metric && metric.parentNode) metric.parentNode.insertBefore(card, metric.nextSibling); else el.appendChild(card);
  if(Date.now() - C.ts > 60000) loadAll(true).then(()=>{ if(curScreen() === "home"){ const old = q(".te-home", el); const h2 = homeCardHTML(); if(old && h2){ const w2 = document.createElement("div"); w2.innerHTML = h2.trim(); old.replaceWith(w2.firstElementChild); } } checkGiftNotice(); });
}
function topButton(){
  const bar = q("#screen-home .topbar"); if(!bar || q(".te-top-btn", bar)) return;
  const b = document.createElement("button");
  b.className = "icon-btn te-top-btn"; b.setAttribute("aria-label", "Sự kiện & thi đua"); b.dataset.te = "hub"; b.dataset.id = "challenges";
  b.innerHTML = icon("te_trophy") + `<i class="te-dot" hidden></i>`;
  const last = bar.lastElementChild; bar.insertBefore(b, last);
}
function refreshBadges(){
  const hasGift = newGifts().length > 0;
  qa(".te-top-btn .te-dot").forEach(d=> d.hidden = !hasGift);
  const n = G.TapShop && G.TapShop.cartCount ? G.TapShop.cartCount() : 0, cn = q("#te-cart-n");
  if(cn){ cn.hidden = !n; cn.textContent = n > 9 ? "9+" : String(n); }
  const pb = q("#te-hero-pts"); if(pb) pb.textContent = nf(Points.balance());
}
TapEv.refreshBadges = refreshBadges;
function profileInject(){
  const scr = q("#screen-profile .content"); if(!scr) return;
  qa(".te-prof", scr).forEach(n=> n.remove());
  const nTk = C.events.filter(e=> myReg(e.id) && evPhase(e, Date.now()) !== "ended").length;
  const card = document.createElement("div");
  card.className = "card te-prof";
  card.innerHTML = `<div class="card-title">${icon("te_trophy")}Sự kiện, quà &amp; cửa hàng</div>
    <button class="link-row" data-te="hub" data-id="gifts"><div class="left">${icon("te_coin")}<div><div class="name">Điểm TapEasy</div><div class="sub">${nf(Points.balance())} điểm · đổi voucher</div></div></div>${icon("chevron_right")}</button>
    <button class="link-row" data-te="hub" data-id="challenges"><div class="left">${icon("te_podium")}<div><div class="name">Thi đua tháng</div><div class="sub">${Object.keys(TE().joined).filter(id=> { const c = C.challenges.find(x=> x.id === id); return c && chStatus(c, todayS()) === "active"; }).length} thử thách đang tham gia</div></div></div>${icon("chevron_right")}</button>
    <button class="link-row" data-te="mytickets"><div class="left">${icon("te_ticket")}<div><div class="name">Vé sự kiện của tôi</div><div class="sub">${nTk ? nTk + " vé sắp tới" : "Chạy bộ, tập nhóm, workshop…"}</div></div></div>${icon("chevron_right")}</button>
    <button class="link-row" data-te="hub" data-id="gifts"><div class="left">${icon("te_gift")}<div><div class="name">Quà của tôi</div><div class="sub">${newGifts().length ? `<b class="te-coral">${newGifts().length} quà chờ xác nhận</b>` : C.gifts.length + " quà"}</div></div></div>${icon("chevron_right")}</button>
    ${G.TapShop ? `<button class="link-row" data-te="orders"><div class="left">${icon("te_receipt")}<div><div class="name">Đơn hàng lưu niệm</div><div class="sub">Theo dõi trạng thái giao hàng</div></div></div>${icon("chevron_right")}</button>` : ""}
    <button class="link-row" data-te="hub" data-id="moments"><div class="left">${icon("photo_library")}<div><div class="name">Khoảnh khắc sự kiện</div><div class="sub">Ảnh &amp; clip sau mỗi buổi tập cộng đồng</div></div></div>${icon("chevron_right")}</button>
    ${isAdmin() ? `<button class="link-row" data-te="hub" data-id="admin"><div class="left">${icon("te_admin")}<div><div class="name">${hasRBAC() ? "Công cụ sự kiện (quản trị)" : "Quản trị (nhà sáng lập)"}</div><div class="sub">Thử thách, sự kiện, kiểm duyệt, sản phẩm, đơn hàng</div></div></div>${icon("chevron_right")}</button>` : ""}`;
  const acc = q("#profile-account-card", scr);
  if(acc && acc.parentNode) acc.parentNode.insertBefore(card, acc); else scr.appendChild(card);
}
ACT.mytickets = ()=> openHub("events", { filter:"mine" });
ACT.orders = ()=>{ if(G.TapShop && G.TapShop.openOrders) G.TapShop.openOrders(); };
/* Bật chế độ quản trị: chạm 7 lần vào dòng phiên bản ("TapEasy v2.0.0") trong Hồ sơ */
let _taps = 0, _tapT = 0;
function onVersionTap(e){
  if(hasRBAC()) return;
  const el = e.target && e.target.closest && e.target.closest("#screen-profile p, #screen-profile small, #screen-profile .small-note"); if(!el) return;
  const t = (el.textContent || "").trim(); if(t.length > 48 || !/\bv\d+\.\d+/i.test(t)) return;
  const now = Date.now(); if(now - _tapT > 2500) _taps = 0; _tapT = now; _taps++;
  if(_taps >= 3 && _taps < 7) say(state.isAdmin ? `Còn ${7-_taps} lần chạm để tắt chế độ quản trị` : `Còn ${7-_taps} lần chạm để bật chế độ quản trị`, "te_admin");
  if(_taps >= 7){ _taps = 0; if(hasRBAC()) return;   // đã có rbac.js: 7 lần chạm do rbac.js xử lý (mở đăng nhập quản trị)
    state.isAdmin = !state.isAdmin; save();
    say(state.isAdmin ? "Đã bật chế độ quản trị (nhà sáng lập)" : "Đã tắt chế độ quản trị", "te_admin");
    C.ts = 0; loadAll(true).then(()=>{ try{ renderProfileScreen(); }catch(err){} });
  }
}
function wrapFn(name, make){
  try{ const old = G[name]; if(typeof old !== "function") return false; G[name] = make(old); return true; }
  catch(e){ warn(e); return false; }
}
function integrate(){
  addIcons(); ensureScreen(); topButton();
  /* Trang chủ: thẻ "Sự kiện & Thi đua" sau các chỉ số trong ngày */
  wrapFn("renderHomeScreen", old=> function(){ const r = old.apply(this, arguments); try{ homeInject(); topButton(); refreshBadges(); }catch(e){ warn(e); } return r; });
  wrapFn("renderProfileScreen", old=> function(){ const r = old.apply(this, arguments); try{ profileInject(); }catch(e){ warn(e); } return r; });
  /* Menu ☰: thêm lối vào (nhận diện sheet menu qua link "Nhắc nhở") */
  wrapFn("openSheet", old=> function(html){
    const r = old.apply(this, arguments);
    try{ if(typeof html === "string" && html.indexOf("goto('reminders');closeSheet();") >= 0){
      const first0 = q("#sheet-content .link-row"), list = first0 && first0.parentNode;
      if(list && !q(".te-menu", list)){
        const add = (te, id, ic, label)=>{ const d = document.createElement("div"); d.className = "link-row te-menu"; d.dataset.te = te; d.dataset.id = id; d.setAttribute("role", "button"); d.tabIndex = 0;
          d.innerHTML = `<div class="left">${icon(ic)}<div class="name">${label}</div></div>${icon("chevron_right")}`; return d; };
        const first = list.children[1] || null;
        /* integrator (FIX-core vòng 2 #8): chữ menu tại nguồn theo GLOSSARY §8 (app.js teMenuRelabel thêm dòng phụ + gộp "Gặp mặt & vé" thành lối tắt ẩn) */
        list.insertBefore(add("hub", "challenges", "te_trophy", "Sự kiện"), first);
        list.insertBefore(add("hub", "events", "te_ticket", "Gặp mặt &amp; vé"), first);
        if(G.TapShop) list.insertBefore(add("hub", "shop", "storefront", "Cửa hàng"), first);
      } } }catch(e){ warn(e); }
    return r;
  });
  /* Vào Hồ sơ → cập nhật thẻ Sự kiện/quà (goto("profile") của app không vẽ lại màn) */
  wrapFn("goto", old=> function(screen){ const r = old.apply(this, arguments); try{ if(screen === "profile") profileInject(); }catch(e){ warn(e); } return r; });
  /* Nút Back Android / Esc: từ màn Sự kiện về màn trước */
  wrapFn("fkHandleBack", old=> function(){
    try{ const T = TM(); if(T && T.lightboxOpen() && T.closeLightbox()) return true; }catch(e){}
    if(curScreen() === "events" && !q("#sheet-backdrop.open")){ goto(_prev && _prev !== "events" ? _prev : "home"); return true; }
    return old.apply(this, arguments);
  });
  document.addEventListener("click", onVersionTap, true);
  /* Vẽ lại màn đang mở */
  try{ if(curScreen() === "home") homeInject(); profileInject(); }catch(e){ warn(e); }
  loadAll().then(()=>{ try{ if(curScreen() === "home") homeInject(); profileInject(); checkGiftNotice(); }catch(e){ warn(e); } });
  /* Có người dùng đăng nhập/đăng xuất → tải lại */
  try{ if(typeof cloud !== "undefined" && cloud.onAuth) cloud.onAuth(()=>{ C.ts = 0; C.ready = false; loadAll(true).then(rerender); }); }catch(e){}
}
/* Lối tắt cho Bảng quản trị (admin.js): mở thẳng form, không phải vào module Sự kiện rồi tìm nút */
TapEv.createEvent = opt=>{ if(curScreen() !== "events"){ ensureScreen(); } return evFormSheet(null, opt || {}); };
TapEv.createChallenge = ()=> chFormSheet("");
TapEv.duplicateEvent = id=> evFormSheet(null, { from: id });
TapEv._t = { settleAll, doCheckIn, blockUserFlow, ensureBlocks, blockedUid, momentsListHTML, reviewsHTML, claimFinVoucher };   // kiểm thử (tests/suites/64)
Object.assign(TapEv, { loadAll, cache: C, openChallenge, openEvent, openGift, openTicket, openScanner, joinChallenge, homeInject, profileInject, isAdmin, can, openReview, openRecap, openComments, momentCardHTML, _ACT: ACT });
try{ integrate(); }catch(e){ warn(e); }

})(typeof window !== "undefined" ? window : globalThis);
