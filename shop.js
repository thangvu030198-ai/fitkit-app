/* =========================================================================
   TapEasy STORE (shop.js) — cửa hàng phong cách thời trang quốc tế tối giản
   - Màn cửa hàng riêng, nền sáng, toàn màn hình (thoát khung điện thoại 460 px khi màn rộng):
     hero editorial · menu chữ MỚI / NAM / NỮ / PHỤ KIỆN · lưới ảnh 3:4 tràn viền (2 cột mobile, 3–4 cột rộng)
     · chạm giữ (hoặc rê chuột) đổi sang ảnh thứ hai · trang sản phẩm (gallery vuốt, chấm màu, ô size, bảng size cm,
     chất liệu/bảo quản, giao hàng & đổi trả, THÊM VÀO GIỎ, gợi ý) · giỏ hàng dạng ngăn kéo · voucher đổi bằng điểm
     · checkout 3 bước (Giao hàng → Thanh toán COD / chuyển khoản / VietQR → Xác nhận) · đơn hàng có tiến trình
     · quản trị sản phẩm (ảnh nén, tồn kho theo màu × size) và đơn hàng.
   - Dữ liệu danh mục mặc định: shop-data.js (TAPEASY_SHOP_DATA); dữ liệu thật: cloudEvents.products / orders.
   - Tương thích dữ liệu cũ: state.tapShop = { cart:[{key,pid,color,size,qty}], vouchers:[…], addr:{}, pay } (+ ship);
     mã sản phẩm/màu cũ giữ nguyên; TapShop.openCart/openOrders/openRedeem/grantVoucher/cartCount/art/artFor/core.
   - Nạp SAU events.js. Quyền quản trị: teCan('shop.products') / teCan('shop.orders') nếu có, không thì state.isAdmin.
   ========================================================================= */
(function(G){
"use strict";
const TapEv = G.TapEv || {};
/* Cài đặt do quản trị nhập ở Bảng quản trị (phí ship, hotline, tài khoản nhận tiền — cloud-admin.js lưu bản đã áp vào
   localStorage "tapeasy_settings_cache_v1"). cloud-admin.js còn vá TapShop.core.CFG lúc chạy; đọc ở đây cho lần vẽ đầu. */
function settingsCache(){
  try{ const s = JSON.parse(localStorage.getItem("tapeasy_settings_cache_v1") || "null") || {}; const o = {};
    ["shippingFee", "freeShipFrom", "giftFundPct", "hotline"].forEach(k=>{ if(s[k] != null && s[k] !== "") o[k] = s[k]; });
    o.shopOpen = s.shopOpen === true;                              // R3: công tắc "mở bán toàn cửa hàng" (Bảng quản trị)
    if(s.bank && s.bank.accountNo) o.bank = s.bank;
    return o; }catch(e){ return {}; }
}
const CFG = Object.assign({
  bank: { bankName:"[Tên ngân hàng — chủ app điền]", bankBin:"", accountNo:"[Số tài khoản]", accountName:"[TÊN CHỦ TÀI KHOẢN]", branch:"" },
  shippingFee: 30000, freeShipFrom: 499000, expressFee: 45000, giftFundPct: 10,
  hotline: "[Hotline / Zalo — chủ app điền]",
  logoMark: "assets/brand/logo-mark.svg",
  logoWord: "assets/brand/logo-wordmark-dark.svg",
  dataSrc: "shop-data.js",
}, G.TAPEASY_SHOP_CONFIG || {}, settingsCache());
CFG.bank = Object.assign({ bankName:"", bankBin:"", accountNo:"", accountName:"", branch:"" }, CFG.bank || {});
/* % quỹ quà do quản trị nhập (cache cài đặt) → luôn là số 0–100 trước khi chèn HTML */
const gfp = ()=> Math.max(0, Math.min(100, Math.round(Number(CFG.giftFundPct)) || 0));

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const arr = a=> Array.isArray(a) ? a : [];
const clone = o=> JSON.parse(JSON.stringify(o));
const nf = n=>{ n = Math.round(Number(n)||0); try{ return n.toLocaleString("vi-VN"); }catch(e){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); } };
const vnd = v=> nf(v) + " ₫";
const money = vnd;
const esc = s=> (typeof G.escapeHtml === "function" ? G.escapeHtml(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const escAttr = s=> esc(s).replace(/`/g, "&#96;");
const p2 = n=> String(n).padStart(2,"0");
const ds = d=> `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const dmy = t=>{ const d = new Date(t); return isNaN(d) ? "" : `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`; };
const hm = t=>{ const d = new Date(t); return isNaN(d) ? "" : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const ascii = s=> String(s||"").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9 \-]/g, "").replace(/\s+/g, " ").trim();
const isHex = h=> /^#[0-9a-f]{6}$/i.test(String(h||""));
const sum = o=> Object.values(obj(o)).reduce((a, b)=> a + (Number(b)||0), 0);
function shade(hex, k){ if(!isHex(hex)) return hex; const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = x=> Math.max(0, Math.min(255, Math.round(k < 0 ? x*(1+k) : x + (255-x)*k))); return "#" + [f(r), f(g), f(b)].map(x=> x.toString(16).padStart(2,"0")).join(""); }
function isLight(hex){ if(!isHex(hex)) return false; const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299*r + 0.587*g + 0.114*b) > 160; }
/* fix-commerce QS-20: ảnh sản phẩm/đơn hàng chỉ nhận nguồn tin cậy — ảnh đóng gói (assets/, không "..", không ký tự lạ), ảnh nén
   dạng data:image base64, blob: (xem trước trên máy) và https từ kho ảnh của app (Firebase Storage + host chủ app khai trong
   TAPEASY_SHOP_CONFIG.imgHosts). Mọi https:// khác (pixel theo dõi IP người xem), "//host", "javascript:" → bỏ (dùng ảnh minh hoạ). */
const IMG_HOSTS = ["firebasestorage.googleapis.com", "storage.googleapis.com"].concat(arr((G.TAPEASY_SHOP_CONFIG || {}).imgHosts).map(h=> String(h).toLowerCase()));
function safeImg(u){
  if(typeof u !== "string" || u.length > 400000 || /["'<>`\s\\]/.test(u)) return "";
  if(/^(\.\/)?assets\/[\w\-./%]+$/.test(u) && !/\.\.|\/\//.test(u)) return u;
  if(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(u)) return u;
  if(/^blob:(https?:\/\/[\w.\-:\[\]]+|null)\/[\w\-]+$/i.test(u)) return u;
  const m = u.match(/^https:\/\/([a-z0-9.\-]+)(?::\d+)?\//i); if(!m) return "";
  const host = m[1].toLowerCase();
  return IMG_HOSTS.includes(host) || /\.firebasestorage\.app$/.test(host) ? u : "";
}

/* ---------------------------------------------------------------------
   1. LÕI THUẦN (kiểm thử được bằng Node): tiền, voucher, VietQR, danh mục, tồn kho, gợi ý size
   --------------------------------------------------------------------- */
const REDEEM = [
  { id:"ship", cost:200,  kind:"ship",   value:30000,  title:"Miễn phí giao hàng", sub:"Tối đa 30.000 ₫" },
  { id:"a20",  cost:400,  kind:"amount", value:20000,  min:150000, title:"Giảm 20.000 ₫", sub:"Đơn từ 150.000 ₫" },
  { id:"a50",  cost:800,  kind:"amount", value:50000,  min:250000, title:"Giảm 50.000 ₫", sub:"Đơn từ 250.000 ₫" },
  { id:"p15",  cost:1500, kind:"pct",    value:15, max:100000, title:"Giảm 15%", sub:"Tối đa 100.000 ₫" },
  { id:"a120", cost:2500, kind:"amount", value:120000, min:300000, title:"Giảm 120.000 ₫", sub:"Đơn từ 300.000 ₫" },
];
function totals(items, v, cfg){
  cfg = cfg || CFG;
  const subtotal = arr(items).reduce((a, it)=> a + (Number(it.price)||0) * Math.max(0, Math.round(Number(it.qty)||0)), 0);
  const shipping = subtotal === 0 || subtotal >= (Number(cfg.freeShipFrom)||Infinity) ? 0 : (Number(cfg.shippingFee)||0);
  let discount = 0, vErr = "";
  if(v){
    const min = Number(v.min)||0;
    if(subtotal < min) vErr = `Đơn tối thiểu ${vnd(min)} để dùng voucher này`;
    else if(v.kind === "ship"){ discount = Math.min(shipping, Number(v.value)||0); if(!shipping) vErr = "Đơn đã được miễn phí giao hàng"; }
    else if(v.kind === "amount") discount = Math.min(Number(v.value)||0, subtotal);
    else if(v.kind === "pct") discount = Math.min(Math.round(subtotal * (Number(v.value)||0) / 100), Number(v.max)||Infinity, subtotal);
  }
  discount = Math.max(0, Math.round(discount));
  return { subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount), vErr, freeShipLeft: subtotal && shipping ? Math.max(0, (Number(cfg.freeShipFrom)||0) - subtotal) : 0 };
}
const shipCfg = (method, cfg)=>{ cfg = cfg || CFG; return method === "express" ? Object.assign({}, cfg, { shippingFee: Number(cfg.expressFee)||45000, freeShipFrom: Infinity }) : cfg; };
function crc16(str){
  const b = unescape(encodeURIComponent(String(str))); let crc = 0xFFFF;
  for(let i=0;i<b.length;i++){ crc ^= b.charCodeAt(i) << 8; for(let k=0;k<8;k++){ crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1); crc &= 0xFFFF; } }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const tlv = (id, v)=>{ v = String(v); return id + String(v.length).padStart(2,"0") + v; };
/* Mã VietQR (chuẩn EMVCo của NAPAS) — chỉ tạo khi chủ app đã điền BIN ngân hàng (6 số) + số tài khoản */
function vietQR(o){
  o = o || {};
  const bin = String(o.bankBin||"").trim(), acc = String(o.accountNo||"").replace(/\s/g, "");
  if(!/^\d{6}$/.test(bin) || !/^[0-9A-Za-z]{4,19}$/.test(acc)) return "";
  const mai = tlv("00", "A000000727") + tlv("01", tlv("00", bin) + tlv("01", acc)) + tlv("02", "QRIBFTTA");
  const amt = Math.round(Number(o.amount)||0);
  let p = tlv("00", "01") + tlv("01", amt ? "12" : "11") + tlv("38", mai) + tlv("53", "704") + (amt ? tlv("54", String(amt)) : "") + tlv("58", "VN");
  const note = ascii(o.note).slice(0, 25); if(note) p += tlv("62", tlv("08", note));
  p += "6304";
  return p + crc16(p);
}

/* --- Danh mục: gộp shop-data.js (mặc định) với sản phẩm trên máy chủ (cloudEvents) ---
   - Sản phẩm chưa có trên máy chủ → "ảo" (_virtual) + cần đồng bộ.
   - Sản phẩm mẫu CHƯA bị quản trị sửa → mô tả/ảnh/màu theo shop-data.js; tồn kho theo máy chủ (nếu cùng phiên bản).
   - Sản phẩm đã sửa (edited / bản cũ có updatedAt ≠ createdAt) → máy chủ thắng, shop-data.js chỉ bù trường thiếu. */
const VK = (c, z)=> String(c||"") + "|" + String(z||"");
function isEdited(p){ return !!p.edited || (p.catalogV == null && Number(p.updatedAt||0) - Number(p.createdAt||0) > 1500); }
function mergeCatalog(dbList, data){
  const cat = arr(data && data.products), ver = Number(data && data.version) || 0;
  const byId = {}; arr(dbList).forEach(p=>{ if(p && p.id) byId[p.id] = p; });
  const list = [], sync = [];
  cat.forEach(c0=>{
    const c = clone(c0), d = byId[c.id];
    if(!d){ const v = Object.assign(c, { catalogV: ver, _virtual: true }); list.push(v); sync.push(v); return; }
    delete byId[c.id];
    let m;
    if(d.deleted){ m = Object.assign({}, d); }
    else if(isEdited(d)){
      m = Object.assign({}, c, d);
      m.demo = d.demo === true;                                    // R3: quản trị đã sửa/lưu → hàng thật (trừ khi tự gắn cờ mẫu)
      if(!d.stockBy){ delete m.stockBy; m.stock = d.stock; }
      if(!arr(d.colors).length) m.colors = c.colors;
    } else {
      m = Object.assign({}, d, c, { createdAt: d.createdAt || c.createdAt });
      if(d.catalogV === ver && d.stockBy && typeof d.stockBy === "object"){ m.stockBy = Object.assign({}, d.stockBy); m.stock = sum(d.stockBy); }
      else sync.push(m);
      m.catalogV = ver;
    }
    list.push(m);
  });
  Object.keys(byId).forEach(k=> list.push(byId[k]));
  return { list, sync };
}
/* R3-ADMIN-01: hàng THẬT = có trên máy chủ, không mang cờ demo (danh mục shop-data.js đều demo:true).
   Cửa hàng "đang bán" khi quản trị bật shopOpen VÀ có ≥ 1 sản phẩm thật đang hiện.
   TAPEASY_SHOP_CONFIG.demoCatalog = true (chỉ dành cho phát triển / kiểm thử): coi danh mục mẫu như hàng thật. */
const demoCatalog = ()=>{ try{ return !!(G.TAPEASY_SHOP_CONFIG && G.TAPEASY_SHOP_CONFIG.demoCatalog === true); }catch(e){ return false; } };
function isReal(p){ return !!p && typeof p === "object" && !p._virtual && p.demo !== true && !p.deleted; }
function storeStateOf(products, open){
  if(demoCatalog()) return { live:true, open:true, real: arr(products).filter(p=> p && !p.deleted).length, reason:"", demo:true };
  const real = arr(products).filter(p=> isReal(p) && !p.hidden).length;
  const isOpen = open === true;
  return { live: isOpen && real > 0, open: isOpen, real, reason: real < 1 ? "empty" : (isOpen ? "" : "closed"), demo:false };
}
function stockOf(p, color, size){
  p = obj(p);
  if(p.stockBy && typeof p.stockBy === "object"){ const k = VK(color, size); return k in p.stockBy ? Math.max(0, Number(p.stockBy[k])||0) : (arr(p.sizes).length || arr(p.colors).length > 1 ? 0 : Math.max(0, Number(p.stock)||0)); }
  return typeof p.stock === "number" ? Math.max(0, p.stock) : 99;
}
function totalStock(p){ p = obj(p); return p.stockBy && typeof p.stockBy === "object" ? sum(p.stockBy) : (typeof p.stock === "number" ? p.stock : 99); }
function colorStock(p, color){ p = obj(p); const zs = arr(p.sizes); return zs.length ? zs.reduce((a, z)=> a + stockOf(p, color, z), 0) : stockOf(p, color, ""); }
/* Trừ / hoàn tồn kho theo dòng đơn (sign = -1 khi đặt, +1 khi huỷ) → { stockBy, stock } mới (không đổi p) */
function applyStock(p, items, sign){
  p = obj(p); if(!p.stockBy) return null;
  const sb = Object.assign({}, p.stockBy);
  arr(items).forEach(it=>{ if(it.pid !== p.id) return; const k = VK(it.color, it.size); sb[k] = Math.max(0, (Number(sb[k])||0) + sign * (Number(it.qty)||0)); });
  return { stockBy: sb, stock: sum(sb) };
}
/* Gợi ý size theo chiều cao/cân nặng trong hồ sơ (bảng size có fitKeys = cột chiều cao, cột cân nặng) */
function recommendSize(chart, prof){
  chart = obj(chart); prof = obj(prof);
  if(!chart.fitKeys || !arr(chart.rows).length) return "";
  const h = Number(prof.height), w = Number(prof.weight); if(!(h > 100 && h < 230 && w > 25 && w < 250)) return "";
  const rng = s=>{ const m = String(s).match(/(\d+(?:[.,]\d+)?)\D+(\d+(?:[.,]\d+)?)/); return m ? [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))] : null; };
  let best = "", bs = Infinity;
  chart.rows.forEach(r=>{
    const hr = rng(r[chart.fitKeys.h]), wr = rng(r[chart.fitKeys.w]); if(!hr || !wr) return;
    const dh = h < hr[0] ? hr[0] - h : h > hr[1] ? h - hr[1] : 0, dw = w < wr[0] ? wr[0] - w : w > wr[1] ? w - wr[1] : 0;
    const sc = dw * 1.6 + dh * 0.6;           // cân nặng quyết định vòng người nhiều hơn chiều cao
    if(sc < bs - 1e-9){ bs = sc; best = r[0]; }
  });
  return bs <= 14 ? best : "";
}
function genderOf(p){ p = obj(p); return p.gender || (p.cat === "wear" ? "unisex" : "acc"); }
function inCat(p, c){
  const g = genderOf(p);
  if(c === "all" || !c) return true;
  if(c === "new") return !!p.isNew || /m[ớo]i/i.test(String(p.badge||""));
  if(c === "men") return g === "men" || g === "unisex";
  if(c === "women") return g === "women" || g === "unisex";
  if(c === "acc") return g === "acc";
  return p.cat === c;
}
function sortList(list, how){
  const L = list.slice(), rk = p=> Number(p.rank) || 99;
  if(how === "price-asc") L.sort((a,b)=> a.price - b.price || rk(a) - rk(b));
  else if(how === "price-desc") L.sort((a,b)=> b.price - a.price || rk(a) - rk(b));
  else if(how === "new") L.sort((a,b)=> (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || (Number(b.createdAt)||0) - (Number(a.createdAt)||0) || rk(a) - rk(b));
  else L.sort((a,b)=> rk(a) - rk(b) || (b.badge ? 1 : 0) - (a.badge ? 1 : 0));
  return L;
}
function normCart(cart){
  return arr(cart).filter(c=> c && c.pid).map(c=>{ const color = String(c.color||""), size = String(c.size||"");
    return { key: [c.pid, color, size].join("|"), pid: String(c.pid), color, size, qty: Math.max(1, Math.min(10, Math.round(Number(c.qty)||1))) }; })
    .reduce((acc, c)=>{ const o = acc.find(x=> x.key === c.key); if(o) o.qty = Math.min(10, o.qty + c.qty); else acc.push(c); return acc; }, []);
}

/* ---------------------------------------------------------------------
   2. ẢNH: ảnh chụp sản phẩm (assets/shop/*.webp) — SVG minh hoạ cũ làm dự phòng
   --------------------------------------------------------------------- */
let _aid = 0, _logoOk = false;
const MARK = '<rect x="0" y="16" width="18" height="72" rx="9"/><rect x="24" y="0" width="26" height="104" rx="13"/><rect x="56" y="42" width="88" height="20" rx="10"/><rect x="150" y="0" width="26" height="104" rx="13"/><rect x="182" y="16" width="18" height="72" rx="9"/><circle cx="100" cy="90.8" r="11"/><path d="M89.17 112.78 C74.75 123.89 57.49 131.24 39.38 133.4 C34.53 133.98 24.78 134.68 20.22 133.38 C22.75 132.74 25.52 132.72 28.12 132.38 C32.56 131.8 36.97 131.01 41.31 129.93 C57.34 125.97 72.29 118.27 84.72 107.38 C86.21 106.15 88.41 106.37 89.64 107.86 C90.87 109.35 90.66 111.55 89.17 112.78 Z"/><path d="M110.83 112.78 C125.25 123.89 142.51 131.24 160.62 133.4 C165.47 133.98 175.22 134.68 179.78 133.38 C177.25 132.74 174.48 132.72 171.88 132.38 C167.44 131.8 163.03 131.01 158.69 129.93 C142.66 125.97 127.71 118.27 115.28 107.38 C113.79 106.15 111.59 106.37 110.36 107.86 C109.13 109.35 109.34 111.55 110.83 112.78 Z"/>';
const BRAND_TEAL = "#02BCB3";
function logoMark(cx, cy, w, color){
  const s = w/200, h = 134*s;
  if(_logoOk && CFG.logoMark && color !== "#fff") return `<image class="te-logo" href="${escAttr(CFG.logoMark)}" x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}"/>`;
  return `<g class="te-logo" transform="translate(${(cx - w/2).toFixed(2)} ${(cy - h/2).toFixed(2)}) scale(${s.toFixed(4)})" fill="${color || BRAND_TEAL}" fill-rule="evenodd">${MARK}</g>`;
}
function markOn(hex){ if(!isHex(hex)) return BRAND_TEAL; const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const sat = Math.max(r,g,b) - Math.min(r,g,b); return sat > 90 ? "#fff" : BRAND_TEAL; }
const slogan = (x, y, size, fill, txt)=> `<text x="${x}" y="${y}" text-anchor="middle" font-family="Be Vietnam Pro, Inter Tight, Inter, -apple-system, sans-serif" font-weight="800" font-size="${size}" fill="${fill}" letter-spacing=".8">${esc(txt)}</text>`;
/* Minh hoạ SVG (dự phòng khi sản phẩm không có ảnh — VD quản trị thêm sản phẩm chưa tải ảnh) */
function art(p, color, size){
  p = obj(p); size = size || 160;
  const c = isHex(color) ? color : (arr(p.colors)[0] || {}).hex || "#0B2A33";
  const dk = shade(c, -0.28), lt = shade(c, 0.18), ink = isLight(c) ? "#0B2A33" : "#F2F5F6";
  const id = "sha" + (++_aid);
  const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset="1" stop-color="${dk}"/></linearGradient></defs>`;
  const body = `url(#${id})`;
  let g = "";
  switch(p.art || p.slug){
    case "tee": case "tank": case "bra": case "jacket": g = `<path d="M66 34 86 26Q100 40 114 26L134 34 168 62 150 84 136 74V172Q100 178 64 172V74L50 84 32 62Z" fill="${body}" stroke="${dk}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M86 26Q100 44 114 26" fill="none" stroke="${dk}" stroke-width="3.5"/>${logoMark(100, 84, 34, markOn(c))}${slogan(100, 116, 8.6, ink, "TẬP DỄ DÀNG.")}`; break;
    case "short": case "legging": g = `<path d="M60 30H140L150 170H108L100 80 92 170H50Z" fill="${body}" stroke="${dk}" stroke-width="1.5"/><path d="M60 44H140" stroke="${dk}" stroke-width="3"/>${logoMark(124, 140, 22, markOn(c))}`; break;
    case "cap": g = `<path d="M44 122C44 72 70 50 104 50 138 50 162 74 162 122Z" fill="${body}" stroke="${dk}" stroke-width="1.5"/>
      <path d="M38 120C80 110 142 110 188 128 178 142 150 144 120 138 92 134 62 134 38 128Z" fill="${dk}"/><circle cx="104" cy="50" r="4.5" fill="${dk}"/>${logoMark(108, 92, 40, markOn(c))}`; break;
    case "bottle": g = `<rect x="88" y="22" width="24" height="14" rx="4" fill="${dk}"/><rect x="76" y="32" width="48" height="28" rx="9" fill="${dk}"/>
      <rect x="68" y="56" width="64" height="126" rx="22" fill="${body}" stroke="${dk}" stroke-width="1.5"/><rect x="76" y="66" width="6" height="104" rx="3" fill="#fff" opacity=".28"/>
      ${logoMark(100, 120, 30, markOn(c))}<text x="100" y="172" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="8" fill="${ink}">750 ml</text>`; break;
    case "band": g = [["#5EE6C7","NHẸ",68],["#FF7A45","VỪA",104],["#1B6A68","NẶNG",140]].map(([col, t, y])=>
        `<ellipse cx="100" cy="${y}" rx="62" ry="20" fill="none" stroke="${shade(col,-0.25)}" stroke-width="13"/><ellipse cx="100" cy="${y}" rx="62" ry="20" fill="none" stroke="${col}" stroke-width="9"/><text x="150" y="${y+4}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="7" fill="#061A24">${t}</text>`).join("")
        + logoMark(52, 68, 22, "#fff"); break;
    case "towel": g = `<rect x="38" y="58" width="124" height="104" rx="10" fill="${body}" stroke="${dk}" stroke-width="1.5"/>
      <path d="M38 140h124M38 148h124" stroke="#fff" stroke-width="3" opacity=".35"/><rect x="116" y="104" width="38" height="28" rx="5" fill="#F5F7F3" opacity=".95"/>${logoMark(135, 118, 28, BRAND_TEAL)}`; break;
    case "sticker": g = `<rect x="34" y="28" width="132" height="152" rx="12" fill="#F2F5F6" stroke="#C9D3D6"/>
      <rect x="48" y="48" width="56" height="44" rx="12" fill="#fff" stroke="#C9D3D6" stroke-dasharray="3 2"/>${logoMark(76, 70, 42, BRAND_TEAL)}
      <rect x="106" y="48" width="56" height="24" rx="12" fill="#FF7A45"/><text x="134" y="63.5" text-anchor="middle" font-family="Be Vietnam Pro, Inter Tight, sans-serif" font-weight="800" font-size="6.6" fill="#fff">CHẠM LÀ TẬP</text>
      <rect x="44" y="150" width="112" height="20" rx="10" fill="#0B2A33"/><text x="100" y="164" text-anchor="middle" font-family="Be Vietnam Pro, Inter Tight, sans-serif" font-weight="800" font-size="8.5" fill="#33D6C9" letter-spacing="1">TẬP DỄ DÀNG</text>`; break;
    case "bag": g = `<path d="M58 54 40 178M142 54 160 178" stroke="${dk}" stroke-width="3" fill="none"/>
      <path d="M56 52H144L152 172Q100 182 48 172Z" fill="${body}" stroke="${dk}" stroke-width="1.5"/><rect x="54" y="46" width="92" height="12" rx="6" fill="${dk}"/>
      ${logoMark(100, 100, 52, markOn(c))}${slogan(100, 140, 8.5, ink, "TẬP DỄ DÀNG.")}`; break;
    case "socks": g = `<path d="M62 30h32v74q0 10 8 16l26 17q12 9 4 22-8 12-22 4l-44-28q-10-6-10-18z" fill="${body}" stroke="${dk}" stroke-width="1.5"/>
      <path d="M62 42h32M62 50h32" stroke="#FF7A45" stroke-width="4"/>${logoMark(78, 80, 24, BRAND_TEAL)}`; break;
    case "lanyard": g = `<path d="M66 18C56 90 78 122 100 134 122 122 144 90 134 18" fill="none" stroke="${c}" stroke-width="12" stroke-linejoin="round"/>
      <rect x="74" y="158" width="52" height="32" rx="7" fill="#F5F7F3" stroke="#C9D3D6"/>${logoMark(100, 174, 34, BRAND_TEAL)}`; break;
    default: g = `<rect x="44" y="44" width="112" height="112" rx="24" fill="${body}"/>${logoMark(100, 96, 64, markOn(c))}`;
  }
  return `<svg class="sh-art" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${escAttr((p.name || "Sản phẩm") + " — ảnh minh hoạ")}">${defs}${g}</svg>`;
}
function catalogData(){ return G.TAPEASY_SHOP_DATA || null; }
const _genColors = {};
function genSet(slug){
  if(_genColors[slug]) return _genColors[slug];
  const D = catalogData(), p = D && arr(D.products).find(x=> x.slug === slug);
  return (_genColors[slug] = new Set(p ? arr(p.colors).map(c=> c.id) : []));
}
/* Danh sách ảnh của 1 sản phẩm theo màu: ảnh quản trị tải lên → ảnh sinh sẵn (assets/shop) → [] (dùng SVG) */
/* Bản 1 file (scripts/build-single-html.py --embed-shop): ảnh assets/shop/* nhúng sẵn dạng data: trong window.__TE_INLINE_ASSETS */
function assetSrc(u){ try{ const m = G.__TE_INLINE_ASSETS; return (m && typeof u === "string" && m[u]) || u; }catch(e){ return u; } }
function imagesFor(p, colorId){
  p = obj(p); const cols = arr(p.colors);
  const c = cols.find(x=> x.id === colorId) || cols[0] || {};
  const own = arr(c.images).map(safeImg).filter(Boolean);
  if(own.length) return own;
  const D = catalogData(), base = (D && D.imgBase) || "assets/shop/";
  if(p.slug && genSet(p.slug).has(c.id)) return [assetSrc(`${base}${p.slug}-${c.id}-1.webp`), assetSrc(`${base}${p.slug}-${c.id}-2.webp`)];
  return arr(p.images).map(safeImg).filter(Boolean);
}

const CORE = { isReal, storeStateOf, demoCatalog, REDEEM, totals, shipCfg, crc16, vietQR, art, ascii, CFG, vnd, mergeCatalog, isEdited, stockOf, totalStock, colorStock, applyStock, recommendSize, inCat, genderOf, sortList, normCart, imagesFor, VK, safeImg };
const S = { products:[], loaded:false, loading:null, synced:false };
const TapShop = G.TapShop = Object.assign(G.TapShop || {}, { core: CORE, art,
  artFor: (pid, size)=>{ const p = (S.products||[]).find(x=> x.id === pid) || { art: String(pid||"").replace(/^p_/, ""), slug: String(pid||"").replace(/^p_/, "") };
    const im = imagesFor(p, (arr(p.colors)[0]||{}).id)[0];
    return im ? `<img class="sx-artimg" src="${escAttr(im)}" alt="${escAttr(p.name||"")}" width="${size||64}" height="${Math.round((size||64)*4/3)}" loading="lazy" decoding="async" style="width:${size||64}px;height:${size||64}px;object-fit:cover;border-radius:12px;background:#EEEDEA">` : art(p, (arr(p.colors)[0]||{}).hex, size); } });

/* =====================================================================
   PHẦN GIAO DIỆN
   ===================================================================== */
if(typeof document === "undefined" || typeof G.addEventListener !== "function") return;
let _hasState = false; try{ _hasState = typeof state !== "undefined" && !!state; }catch(e){}
if(!_hasState || typeof cloudEvents === "undefined"){ console.warn("[shop] Cần nạp cloud-events.js (và events.js) trước shop.js."); return; }

const q = (s, r)=> (r||document).querySelector(s);
const qa = (s, r)=> Array.from((r||document).querySelectorAll(s));
const warn = e=>{ try{ console.warn("[shop]", e); }catch(_){} };
function SH(){ const s = state.tapShop = obj(state.tapShop); s.cart = normCart(s.cart); s.vouchers = arr(s.vouchers); s.addr = obj(s.addr); return s; }
/* QC-11 (vòng 2): saveState() trả false khi bộ nhớ đầy → save() trả boolean để hoàn tác voucher/điểm */
function save(){ try{ return saveState() !== false; }catch(e){ warn(e); return false; } }
const FULL_MSG = "Bộ nhớ máy đầy — chưa lưu được. Giải phóng dung lượng rồi thử lại.";
function can(perm){ try{ if(typeof teCan === "function") return !!teCan(perm); }catch(e){} return !!state.isAdmin; }
/* Quyền (rbac.js): shop.products · orders.view (chỉ đọc) · shop.orders (đổi trạng thái) · shop.refund (huỷ đơn đã xác nhận) · data.export (CSV) */
const canProducts = ()=> can("shop.products"), canOrdersEdit = ()=> can("shop.orders"), canOrders = ()=> can("shop.orders") || can("orders.view");
const canRefund = ()=> can("shop.refund"), canExport = ()=> (typeof teCan === "function" ? can("data.export") : !!state.isAdmin), canAdmin = ()=> canProducts() || canOrders();
/* Ghi "hệ thống" (gieo danh mục mẫu, trừ/hoàn tồn kho theo biến thể khi đặt/huỷ đơn): ở bản demo đây là việc của "máy chủ" giả lập
   → gọi thẳng động cơ demo (giống cloud-events tự gieo seedProducts), không qua lớp bọc quyền của cloud-admin.js.
   Firebase: chỉ người có shop.products ghi được; tồn kho thật nên do Cloud Function onCreate/onUpdate orders đảm nhiệm. */
function sysSave(p){
  const c = Object.assign({}, p); delete c._virtual;
  if(cloudEvents.mode === "demo" && cloudEvents._demo && typeof cloudEvents._demo.saveProduct === "function") return cloudEvents._demo.saveProduct(c);
  if(canProducts()) return cloudEvents.saveProduct(c);
  return Promise.reject(Object.assign(new Error("Không có quyền ghi sản phẩm"), { code:"permission-denied" }));
}
const reduceMotion = ()=>{ try{ return G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };

(function(){ try{ if(!CFG.logoMark) return; const im = new Image(); im.onload = ()=>{ _logoOk = true; }; im.src = CFG.logoMark; }catch(e){} })();

/* shop-data.js: nếu index.html chưa nạp → tự nạp (không chặn app) */
let _dataP = null;
function ensureData(){
  if(catalogData()) return Promise.resolve(catalogData());
  if(_dataP) return _dataP;
  _dataP = new Promise(res=>{ try{ const s = document.createElement("script"); s.src = CFG.dataSrc; s.async = true; s.onload = ()=> res(catalogData()); s.onerror = ()=> res(null); document.head.appendChild(s); }catch(e){ res(null); } });
  return _dataP;
}
function load(force){
  if(S.loading) return S.loading;
  if(S.loaded && !force) return Promise.resolve();
  S.loading = ensureData().then(()=> cloudEvents.listProducts()).then(async list=>{
    const D = catalogData(); const m = mergeCatalog(list, D);
    // Bản demo: ghi danh mục mẫu vào "máy chủ" giả lập để tồn kho/đơn hàng chạy thật. Firebase: chỉ quản trị đồng bộ (nút trong Quản trị).
    if(m.sync.length && cloudEvents.mode === "demo"){
      for(const p of m.sync){ try{ await sysSave(p); p._virtual = false; }catch(e){ warn(e); } }
    }
    S.products = m.list.filter(p=> p && p.id); S.loaded = true; S.pendingSync = cloudEvents.mode === "demo" ? 0 : m.sync.length;
    const dropped = pruneCart();                                   // QC-12
    try{ migrateVouchers(); }catch(e){ warn(e); }
    if(dropped){ try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){} if(UI.open) toast(`${dropped} sản phẩm không còn bán đã được bỏ khỏi giỏ`); }
  }).catch(warn).finally(()=>{ S.loading = null; });
  return S.loading;
}
const prod = id=> S.products.find(p=> p.id === id);
const storeState = ()=> storeStateOf(S.products, CFG.shopOpen);
TapShop.storeState = storeState;
/* R3-ADMIN-01: khách chỉ thấy HÀNG THẬT khi cửa hàng đang bán; người có quyền shop.products xem trước được hàng thật (kể cả đang ẩn) */
const visible = ()=>{ const st = storeState(), adm = canProducts();
  if(!st.live && !adm) return [];
  return S.products.filter(p=> !p.deleted && (st.demo || isReal(p)) && (!p.hidden || adm)); };
/* QC-12: dòng giỏ "mồ côi" = sản phẩm đã xoá / đang ẩn / không còn trong danh mục (máy chủ cũng từ chối các dòng này) */
const sellableP = p=> !!p && !p.deleted && !p.hidden && (demoCatalog() || isReal(p));          // còn là hàng thật đang bày
const sellable = p=> sellableP(p) && storeState().live;                                          // …và cửa hàng đang mở bán
function cartLines(){
  return SH().cart.map(c=>{ const p = prod(c.pid); if(!sellable(p)) return null;
    const col = arr(p.colors).find(x=> x.id === c.color) || arr(p.colors)[0] || {};
    return { key:c.key, pid:p.id, name:p.name, price:Number(p.price)||0, qty:c.qty, size:c.size||"", color:col.id||"", colorName:col.name||"", hex:col.hex||"", p,
      stock: stockOf(p, col.id, c.size), img: imagesFor(p, col.id)[0] || "" }; }).filter(Boolean);
}
/* QC-12: số trên biểu tượng giỏ = số món THẬT SỰ hiện trong giỏ (khi danh mục đã tải); trước khi tải xong → đếm thô */
const cartCount = ()=> (S.loaded && S.products.length ? cartLines() : SH().cart).reduce((a,c)=> a + (Number(c.qty)||0), 0);
TapShop.cartCount = cartCount;
/** Bỏ dòng giỏ mồ côi sau khi tải danh mục (chỉ khi danh mục tải được — mất mạng không xoá giỏ) → số dòng đã bỏ */
function pruneCart(){
  if(!S.loaded || !S.products.length) return 0;
  const sh = SH(), keep = sh.cart.filter(c=> sellableP(prod(c.pid))), n = sh.cart.length - keep.length;   // tạm đóng bán KHÔNG xoá giỏ
  if(n){ sh.cart = keep; save(); }
  return n;
}
/* QC-18: chuyển khoản / VietQR chỉ mở khi chủ app đã điền tài khoản nhận tiền (không còn "[Số tài khoản]") */
const bankReady = ()=>{ const B = CFG.bank || {}; return !!(B.accountNo && !/^\[/.test(String(B.accountNo)) && B.accountName && !/^\[/.test(String(B.accountName))); };
const payOf = sh=>{ const p = ["cod","bank","vietqr"].includes(sh && sh.pay) ? sh.pay : "cod"; return p !== "cod" && !bankReady() ? "cod" : p; };
TapShop.bankReady = bankReady;
function vouchersUsable(){ const today = ds(new Date()); return SH().vouchers.filter(v=> !v.used && (!v.exp || v.exp >= today)); }
/** opt.noSave: chỉ thêm vào bộ nhớ (người gọi tự lưu cùng thao tác khác — VD trừ điểm). Lưu thất bại (QC-11) → gỡ voucher, trả null */
function grantVoucher(v, opt){
  const sh = SH(); if(v.ref && sh.vouchers.some(x=> x.ref === v.ref)) return null;
  const exp = new Date(); exp.setDate(exp.getDate() + (v.days || 60));
  const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const vo = { id:"v" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), code:"TE-" + Array.from({length:6}, ()=> CH[Math.floor(Math.random()*CH.length)]).join(""),
    kind: v.kind || (v.pct ? "pct" : "amount"), value: v.value != null ? v.value : v.pct, min: v.min || 0, max: v.max || 0, title: v.title || "Voucher", sub: v.sub || v.reason || "",
    src: v.src || "gift", ref: v.ref || "", exp: v.exp && /^\d{4}-\d{2}-\d{2}$/.test(v.exp) ? v.exp : ds(exp), used:false, ts: Date.now() };
  if(v.code && /^[A-Z0-9\-]{4,20}$/.test(String(v.code))) vo.code = String(v.code);
  if(v.server) vo.server = true;                                   // voucher do máy chủ cấp (Firebase redeemPoints) — kiểm khi tạo đơn
  vo.sig = signV(vo);                                              // QC-02/QC-03: chữ ký "máy chủ" → sửa giá trị trong localStorage bị từ chối khi đặt
  sh.vouchers.push(vo);
  if(opt && opt.noSave) return vo;
  if(!save()){ sh.vouchers = sh.vouchers.filter(x=> x !== vo); return null; }
  return vo;
}
TapShop.hasVoucherRef = ref=> !!ref && SH().vouchers.some(x=> x && x.ref === ref);
/* integrator (FIX-security vòng 2 #2): Firebase — gộp voucher cá nhân do MÁY CHỦ giữ (callable myVouchers: đổi điểm + hoàn thành thử thách)
   vào ví, khử trùng theo mã; bản trên máy cùng ref nhưng chưa có bản ghi máy chủ (chưa dùng) → thay bằng bản máy chủ. Demo: không làm gì. */
let _srvVAt = 0, _srvVP = null;
function syncServerVouchers(force){
  if(cloudEvents.mode !== "firebase" || typeof cloudEvents.myVouchers !== "function") return Promise.resolve(0);
  try{ if(!(typeof cloud !== "undefined" && cloud.user)) return Promise.resolve(0); }catch(e){ return Promise.resolve(0); }
  if(_srvVP) return _srvVP;
  if(!force && Date.now() - _srvVAt < 60e3) return Promise.resolve(0);
  _srvVAt = Date.now();
  _srvVP = Promise.resolve(cloudEvents.myVouchers()).then(list=>{
    if(!Array.isArray(list) || !list.length) return 0;
    const added = [], removed = [];
    for(const sv0 of list){
      const sv = obj(sv0), code = String(sv.code || "");
      if(!/^[A-Z0-9\-]{4,20}$/.test(code) || SH().vouchers.some(x=> x && x.code === code)) continue;
      const ref = sv.src === "points" ? "redeem_" + code : /^fin_[\w-]{1,140}$/.test(String(sv.ref || "")) ? String(sv.ref) : "srv_" + code;
      const old = SH().vouchers.find(x=> x && x.ref === ref);
      if(old){ if(old.used || old.server) continue; SH().vouchers = SH().vouchers.filter(x=> x !== old); removed.push(old); }
      const v = grantVoucher({ kind: sv.kind, value: sv.value, min: sv.min, max: sv.max, title: sv.title, sub: sv.sub, code, exp: sv.exp,
        src: sv.src === "points" ? "points" : "challenge", ref, server: true }, { noSave: true });
      if(v) added.push(v); else if(old){ SH().vouchers.push(old); removed.pop(); }
    }
    if(!added.length) return 0;
    if(!save()){ SH().vouchers = SH().vouchers.filter(x=> !added.includes(x)).concat(removed); return 0; }
    return added.length;
  }).catch(e=>{ warn(e); return 0; }).finally(()=>{ _srvVP = null; });
  return _srvVP;
}
TapShop.syncServerVouchers = syncServerVouchers;
TapShop.grantVoucher = grantVoucher;
function signV(v){ try{ return typeof cloudEvents !== "undefined" && cloudEvents.signVoucher ? cloudEvents.signVoucher(v) || "" : ""; }catch(e){ return ""; } }
/* Voucher cũ (trước bản sửa, chưa có chữ ký) → ký 1 lần khi nạp để không mất quà hợp lệ của người dùng */
function migrateVouchers(){
  const sh = SH(); if(sh.vsig === 1) return;
  sh.vouchers.forEach(v=>{ if(v && !v.sig && v.src !== "admin") v.sig = signV(v); });
  sh.vsig = 1; save();
}
/* Mã giảm giá toàn hệ thống (Bảng quản trị → Cửa hàng → Voucher, cloudAdmin.lookupVoucher): kiểm tra mã → thêm vào ví voucher
   của máy này (1 lần / mã) → chọn luôn cho giỏ hiện tại. Lượt dùng thật cần Cloud Function tạo đơn tăng `used` (xem INTEGRATION-admin §10). */
async function applyVoucherCode(input){
  const inp = q("#tsx-vcode"), code = String(input != null ? input : (inp && inp.value) || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(code.length < 4){ toast("Nhập mã giảm giá (4–16 ký tự chữ/số)"); if(inp && inp.focus) inp.focus(); return null; }
  const gv = G.cloudAdmin && G.cloudAdmin.lookupVoucher ? await G.cloudAdmin.lookupVoucher(code).catch(()=> null) : null;
  if(!gv){ toast("Mã không hợp lệ hoặc đã hết hạn"); return null; }
  const ref = "adm_" + gv.code, sh = SH();
  let v = sh.vouchers.find(x=> x.ref === ref && !x.used);
  if(!v && sh.vouchers.some(x=> x.ref === ref)){ toast("Mã này đã được dùng trên máy này"); return null; }
  /* QC-03: giữ chỗ 1 lượt trên "máy chủ" (30 phút) — mã uses:1 chỉ áp được cho 1 giỏ trên toàn hệ thống; lượt bị tiêu thụ khi đặt đơn.
     Firebase: Function createOrder kiểm used < uses + voucherUses/{code_uid} trong transaction (claim chỉ là giữ chỗ mềm). */
  if(!v || !(Number(v.claimUntil) > Date.now())){
    let cl = null;
    try{ cl = typeof cloudEvents.claimVoucher === "function" ? await cloudEvents.claimVoucher(gv.code, gv) : { ok:true, claimId:"" }; }catch(e){ cl = { ok:false, error: e && e.message }; }
    if(!cl || !cl.ok){
      toast((cl && cl.error) || "Mã đã hết lượt dùng");
      if(v){ sh.vouchers = sh.vouchers.filter(x=> x !== v); if(_voucherId === v.id) _voucherId = ""; save(); renderLayer(); }
      return null;
    }
    if(!v){
      const days = gv.exp ? Math.max(1, Math.ceil((new Date(gv.exp + "T23:59:59").getTime() - Date.now()) / 864e5)) : 60;
      const kind = gv.kind === "freeship" ? "ship" : gv.kind === "percent" ? "pct" : "amount";
      const sub = kind === "pct" ? `Giảm ${Number(gv.value)||0}%${gv.cap ? " · tối đa " + vnd(gv.cap) : ""}` : kind === "ship" ? "Miễn phí giao hàng" : `Giảm ${vnd(gv.value)}`;
      v = grantVoucher({ kind, value: kind === "ship" ? 1e9 : gv.value, min: gv.min, max: gv.cap, title: gv.title || ("Mã " + gv.code),
        sub: sub + (gv.min ? ` · đơn từ ${vnd(gv.min)}` : ""), src:"admin", ref, days, code: gv.code });
      if(!v){ toast(sh.vouchers.some(x=> x.ref === ref) ? "Mã này đã được dùng trên máy này" : FULL_MSG); return null; }
    }
    v.code = gv.code; v.claimId = cl.claimId || ""; v.claimUntil = Number(cl.until) || (Date.now() + 30*60e3); save();
  }
  _voucherId = v.id; toast(`Đã áp dụng mã ${gv.code}`); renderLayer();
  return v;
}
TapShop.applyVoucherCode = applyVoucherCode;
/* QC-06/QC-07: tồn kho do "máy chủ" trừ/hoàn trong cùng lần ghi đơn (cloudEvents.placeOrder/updateOrder — demo tự thực thi,
   Firebase: Function createOrder + orderStockSync). Máy khách KHÔNG tự ghi tồn kho nữa (trước đây trừ/hoàn 2 lần). */

/* ---------------------------------------------------------------------
   3. KHUNG CỬA HÀNG (lớp phủ toàn màn hình, nền sáng)
   --------------------------------------------------------------------- */
const SV = {
  back:'<path d="M15 5l-7 7 7 7"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  bag:'<path d="M5.5 8.5h13l-1 12h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>', user:'<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
  plus:'<path d="M12 6v12M6 12h12"/>', minus:'<path d="M6 12h12"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', chev:'<path d="M9 6l6 6-6 6"/>', down:'<path d="M6 9l6 6 6-6"/>',
  copy:'<rect x="8.5" y="8.5" width="11" height="11"/><path d="M15.5 8.5V4.5h-11v11h4"/>', grid:'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>', ruler:'<path d="M3 15.5 15.5 3 21 8.5 8.5 21z"/><path d="M7 11.5l2 2M10 8.5l2 2M13 5.5l2 2"/>',
  truck:'<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>', swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>', gift:'<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1z"/>',
};
const svg = (n, cls)=> `<svg class="tsx-i ${cls||""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SV[n]||""}</svg>`;
const CATS = [["new","Mới"],["men","Nam"],["women","Nữ"],["acc","Phụ kiện"],["all","Tất cả"]];
const CAT_TITLE = { new:"Hàng mới về", men:"Nam", women:"Nữ", acc:"Phụ kiện", all:"Tất cả sản phẩm" };
const UI = { open:false, view:"home", params:{}, stack:[], layer:null, layerP:{}, sort:"featured", type:"", q:"", sel:{}, ck:{ step:1 }, lastOrder:null, orders:null, adm:{ tab:"products", ost:"all", list:null }, edit:null, added:null };
let root = null, _fontLink = false;

function ensureFonts(){
  if(_fontLink) return; _fontLink = true;
  try{ if(navigator.onLine === false) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500&family=Inter:wght@300;400;500;600&display=swap"; document.head.appendChild(l); }catch(e){}
}
function ensureRoot(){
  if(root && document.body.contains(root)) return root;
  root = document.createElement("div");
  root.id = "tsx"; root.className = "tsx"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Cửa hàng TapEasy");
  root.innerHTML = `<header class="tsx-hd" id="tsx-hd"></header><nav class="tsx-cats" id="tsx-cats" aria-label="Danh mục"></nav>
    <main class="tsx-main" id="tsx-main" tabindex="-1"></main><div id="tsx-layer"></div><div class="tsx-toast" id="tsx-toast" role="status" aria-live="polite"></div>`;
  document.body.appendChild(root);
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", e=>{ if((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-sx][role=button]")){ e.preventDefault(); e.target.click(); } });
  bindPress();
  return root;
}
function openStore(view, params, opt){
  ensureRoot(); ensureFonts(); try{ hookBack(); }catch(e){}
  if(!UI.open){
    UI.open = true; UI.stack = []; root.hidden = false;
    document.documentElement.classList.add("tsx-lock");
    try{ if(typeof closeSheet === "function" && q("#sheet-backdrop.open")) closeSheet(); }catch(e){}
    UI.view = "home"; UI.params = {};
  }
  if(view && (view !== UI.view || JSON.stringify(params||{}) !== JSON.stringify(UI.params))) nav(view, params || {}, true);
  else render();
  if(!S.loaded) load().then(()=>{ if(UI.open) render(true); });
  refreshOpenFlag();
  syncServerVouchers().then(n=>{ if(n && UI.open) render(true); });       // integrator: ví voucher máy chủ (Firebase)
  if(opt && opt.layer) openLayer(opt.layer, opt.layerP);
}
/* R3-ADMIN-01: đọc lại công tắc mở bán từ máy chủ mỗi lần mở cửa hàng (cloud-admin.js áp vào CFG.shopOpen) → lớp phủ tự biến mất khi quản trị mở bán */
let _openAt = 0;
function refreshOpenFlag(){
  try{ const A = G.cloudAdmin; if(!A || typeof A.getSettings !== "function" || Date.now() - _openAt < 20000) return; _openAt = Date.now();
    const before = storeState().live;
    Promise.resolve(A.getSettings()).then(()=>{ if(storeState().live !== before){ announceOpen(); if(UI.open) render(true); try{ TapEv.render && TapEv.render(); }catch(e){} } }).catch(()=>{}); }catch(e){}
}
/** Cửa hàng "sắp mở": chưa có hàng thật / chưa bật mở bán, và người xem không phải quản trị cửa hàng */
const gated = ()=> S.loaded && !storeState().live && !canAdmin();
const notifyOn = ()=> !!obj(SH().notifyOpen).on;
function setNotify(on){
  const sh = SH(); sh.notifyOpen = on ? { on:true, at: Date.now() } : { on:false, at: Date.now() };
  if(!save()){ toast(FULL_MSG); return false; }
  try{ if(G.FKAnalytics && typeof G.FKAnalytics.track === "function") G.FKAnalytics.track("shop_notify_optin", { on: !!on }); }catch(e){}
  return true;
}
/* Người đã bấm "Nhận thông báo khi mở bán" → báo đúng 1 lần khi cửa hàng mở */
function announceOpen(){
  try{ const sh = SH(), n = obj(sh.notifyOpen); if(!n.on || n.told || !storeState().live) return false;
    sh.notifyOpen = Object.assign({}, n, { told: Date.now() }); save();
    if(typeof G.toast === "function") G.toast("Cửa hàng TapEasy đã mở bán — vào xem ngay nhé!", "storefront");
    return true; }catch(e){ return false; }
}
function soonHTML(){
  const on = notifyOn();
  return `<div class="tsx-soon-bg" aria-hidden="true" inert>
      <section class="tsx-sec"><div class="tsx-sec-h"><h2>Sản phẩm</h2></div>${skeletonGrid(8)}</section>
    </div>
    <div class="tsx-soon" id="tsx-soon">
      <section class="tsx-soon-card" role="group" aria-labelledby="tsx-soon-t" aria-describedby="tsx-soon-d">
        <span class="tsx-soon-ic" aria-hidden="true">${svg("bag")}</span>
        <h2 id="tsx-soon-t" tabindex="-1">Chưa có sản phẩm nào mở bán</h2>
        <p id="tsx-soon-d">Cửa hàng TapEasy đang chuẩn bị. Quay lại sau nhé!</p>
        <button type="button" class="tsx-btn ${on ? "ghost" : ""}" data-sx="soon-notify" aria-pressed="${on}">${on ? svg("check") + "Đã bật thông báo mở bán" : "Nhận thông báo khi mở bán"}</button>
        <p class="tsx-soon-note" role="status" aria-live="polite">${on ? "Bạn sẽ thấy thông báo trong app khi cửa hàng mở bán. Bấm lại để tắt." : ""}</p>
        <button type="button" class="tsx-btn ghost" data-sx="exit">${svg("back")}Quay lại</button>
      </section>
    </div>`;
}
function exitStore(){
  if(!root) return;
  closeLayer(true); UI.open = false; root.hidden = true; UI.stack = [];
  document.documentElement.classList.remove("tsx-lock");
  try{ TapEv.refreshBadges && TapEv.refreshBadges(); TapEv.render && TapEv.render(); }catch(e){}
}
function nav(view, params, push){
  if(push !== false && UI.open && (UI.view !== view || JSON.stringify(UI.params) !== JSON.stringify(params||{}))) UI.stack.push({ view: UI.view, params: UI.params, y: root ? root.scrollTop : 0 });
  if(UI.stack.length > 30) UI.stack.shift();
  UI.view = view; UI.params = params || {};
  toastOff(); closeLayer(true); render(); if(root) root.scrollTop = 0;
  try{ q("#tsx-main").focus({ preventScroll:true }); }catch(e){}
}
function back(){
  if(UI.layer){ closeLayer(); return; }
  if(q(".tsx-modal")){ q(".tsx-modal").remove(); return; }
  const prev = UI.stack.pop();
  if(!prev){ exitStore(); return; }
  UI.view = prev.view; UI.params = prev.params; render(); if(root) root.scrollTop = prev.y || 0;
}
function toast(m){
  const t = q("#tsx-toast"); if(!t) return; t.textContent = m; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(()=> t.classList.remove("on"), 2400);
}
/* QC-20: thao tác thành công / chuyển bước / chuyển màn → gỡ toast lỗi cũ (không để "Vui lòng chọn size" đè giỏ hàng) */
function toastOff(){ const t = q("#tsx-toast"); if(!t) return; clearTimeout(toast._t); t.classList.remove("on"); }
function confirmBox(title, msg, okLabel, fn){
  const m = document.createElement("div"); m.className = "tsx-modal"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true");
  m.innerHTML = `<div class="tsx-modal-box"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="tsx-row2"><button class="tsx-btn ghost" data-m="no">Không</button><button class="tsx-btn" data-m="ok">${esc(okLabel||"Đồng ý")}</button></div></div>`;
  root.appendChild(m);
  m.addEventListener("click", e=>{ const b = e.target.closest("[data-m]"); if(!b && e.target !== m) return; m.remove(); if(b && b.dataset.m === "ok") try{ fn(); }catch(err){ warn(err); } });
  const ok = q("[data-m=ok]", m); if(ok) ok.focus();
}

/* --- đầu trang + menu danh mục --- */
function headerHTML(){
  const n = cartCount(), atRoot = !UI.stack.length;
  return `<div class="tsx-hd-l">
      <button class="tsx-ib" data-sx="${atRoot ? "exit" : "back"}" aria-label="${atRoot ? "Quay lại app TapEasy" : "Quay lại"}">${svg("back")}</button>
      <button class="tsx-tl wide" data-sx="exit">Quay lại app</button>
    </div>
    <button class="tsx-logo" data-sx="home" aria-label="Cửa hàng TapEasy — trang đầu"><img src="${escAttr(CFG.logoWord)}" alt="TapEasy" width="86" height="20"><span>Cửa hàng</span></button>
    <div class="tsx-hd-r">
      <button class="tsx-ib" data-sx="search" aria-label="Tìm kiếm sản phẩm">${svg("search")}</button>
      <button class="tsx-ib" data-sx="account" aria-label="Tài khoản: đơn hàng và voucher">${svg("user")}</button>
      <button class="tsx-bag" data-sx="cart" aria-label="Giỏ hàng, ${n} sản phẩm">${svg("bag")}<span class="wide">Giỏ hàng</span><i ${n ? "" : "hidden"}>${n > 99 ? "99+" : n}</i></button>
    </div>`;
}
function catsHTML(){
  const cur = UI.view === "list" ? UI.params.cat : "";
  return `<div class="tsx-cats-in" role="list">${CATS.map(([k, l])=> `<button role="listitem" class="${cur === k ? "on" : ""}" data-sx="cat" data-id="${k}" ${cur === k ? 'aria-current="page"' : ""}>${esc(l)}</button>`).join("")}
    ${canAdmin() ? `<button role="listitem" class="adm ${UI.view.startsWith("admin") ? "on" : ""}" data-sx="admin" data-id="products">Quản trị</button>` : ""}</div>`;
}
function render(keepScroll){
  if(!root || !UI.open) return;
  const y = root.scrollTop;
  q("#tsx-hd").innerHTML = headerHTML();
  q("#tsx-cats").innerHTML = catsHTML();
  const box = q("#tsx-main");
  /* R3-ADMIN-01: cửa hàng chưa mở bán → khung xương mờ + thẻ kính ở giữa; phần phía sau không cuộn / bấm / đọc được */
  const gate = gated();
  root.classList.toggle("tsx-soon-on", gate);
  [q("#tsx-hd"), q("#tsx-cats")].forEach(n=>{ if(!n) return; if(gate){ n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); } else { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); } });
  if(gate){
    const had = !!q("#tsx-soon", box);
    closeLayer(true); UI.stack = []; root.dataset.view = "soon"; root.scrollTop = 0;
    box.innerHTML = soonHTML();
    if(!had){ try{ q("#tsx-soon-t", box).focus({ preventScroll:true }); }catch(e){} }
    return;
  }
  root.dataset.view = UI.view;
  let html = "";
  try{ html = (VIEWS[UI.view] || VIEWS.home)(UI.params); }catch(e){ warn(e); html = `<div class="tsx-pad"><p class="tsx-note">Có lỗi khi hiển thị. <button class="tsx-tl" data-sx="home">Về trang đầu</button></p></div>`; }
  box.innerHTML = html + footerHTML();
  if(keepScroll) root.scrollTop = y;
  try{ (AFTER[UI.view] || (()=>{}))(UI.params); }catch(e){ warn(e); }
  if(UI.layer) renderLayer();
}
function footerHTML(){
  if(["checkout","done"].includes(UI.view)) return "";
  return `<footer class="tsx-ft">
    <div class="tsx-ft-cols">
      <div><b>Hỗ trợ</b><button data-sx="guide" data-id="top">Hướng dẫn chọn size</button><button data-sx="info" data-id="ship">Giao hàng</button><button data-sx="info" data-id="returns">Đổi trả 7 ngày</button></div>
      <div><b>Tài khoản</b><button data-sx="orders">Đơn hàng của tôi</button><button data-sx="vouchers">Voucher &amp; điểm</button><button data-sx="cart">Giỏ hàng</button></div>
      <div><b>TapEasy</b><p>${gfp()}% doanh thu cửa hàng dùng mua quà cho thành viên tích cực mỗi tháng.</p><p>Hotline: ${esc(CFG.hotline)}</p></div>
    </div>
    <button class="tsx-btn ghost tsx-ft-exit" data-sx="exit">${svg("back")}Quay lại app TapEasy</button>
    <p class="tsx-ft-cp">© ${new Date().getFullYear()} TapEasy · Ảnh sản phẩm là ảnh dựng 3D/ghost mannequin của thiết kế; màu thực tế có thể chênh nhẹ.</p>
  </footer>`;
}

/* --- ô sản phẩm (ảnh 3:4 tràn viền, chữ nhỏ dưới ảnh) --- */
function tileHTML(p, opt){
  opt = opt || {};
  const col = arr(p.colors).find(c=> colorStock(p, c.id) > 0) || arr(p.colors)[0] || {};
  const ims = imagesFor(p, col.id), out = totalStock(p) <= 0, sale = Number(p.compareAt) > Number(p.price);
  const img = ims[0] ? `<img class="a" src="${escAttr(ims[0])}" alt="${escAttr(p.name)}${col.name ? " — " + escAttr(col.name) : ""}" width="720" height="960" loading="${opt.eager ? "eager" : "lazy"}" decoding="async">`
    + (ims[1] ? `<img class="b" data-src="${escAttr(ims[1])}" alt="" width="720" height="960" decoding="async" aria-hidden="true">` : "")
    : `<span class="tsx-svg">${art(p, col.hex, 220)}</span>`;
  const tag = out ? "Hết hàng" : p.hidden ? "Đang ẩn" : p.isNew ? "Mới" : (p.badge || "");
  return `<article class="tsx-tile ${out ? "out" : ""}" data-sx="p" data-id="${escAttr(p.id)}" role="button" tabindex="0" aria-label="${escAttr(p.name)}, ${escAttr(vnd(p.price))}${out ? ", hết hàng" : ""}">
    <div class="tsx-tile-im">${img}${ims[1] ? `<i class="tsx-hint" aria-hidden="true"></i>` : ""}</div>
    <div class="tsx-tile-tx">
      ${tag ? `<span class="tsx-tag">${esc(tag)}</span>` : ""}
      <h3>${esc(p.name)}</h3>
      <p class="tsx-price">${sale ? `<s>${vnd(p.compareAt)}</s><b class="sale">${vnd(p.price)}</b>` : `<b>${vnd(p.price)}</b>`}</p>
      ${arr(p.colors).length > 1 ? `<span class="tsx-dots" aria-label="${arr(p.colors).length} màu">${arr(p.colors).slice(0,5).map(c=> `<i style="background:${isHex(c.hex) ? c.hex : "#999"}"></i>`).join("")}</span>` : ""}
    </div></article>`;
}
function skeletonGrid(n){ return `<div class="tsx-grid">${Array.from({length:n||8}, ()=> `<div class="tsx-tile sk"><div class="tsx-tile-im"></div><div class="tsx-tile-tx"><i></i><i></i></div></div>`).join("")}</div>`; }

/* ---------------------------------------------------------------------
   4. CÁC MÀN
   --------------------------------------------------------------------- */
const VIEWS = {}, AFTER = {};
const D = ()=> catalogData() || { heroes:[], tiles:[], sizeCharts:{}, howToMeasure:{}, shipping:[], returns:[], imgBase:"assets/shop/" };
const IMG = n=> assetSrc((D().imgBase || "assets/shop/") + n);

/* --- Trang đầu cửa hàng --- */
VIEWS.home = ()=>{
  const H = arr(D().heroes), list = visible();
  const news = sortList(list.filter(p=> inCat(p, "new")), "featured").slice(0, 4);
  return `<section class="tsx-hero" aria-roledescription="carousel" aria-label="Bộ sưu tập">
      <div class="tsx-hero-track" id="tsx-hero">${H.map((h, i)=> `<figure class="tsx-slide ${h.align === "right" ? "r" : ""}" aria-roledescription="slide" aria-label="${i+1} / ${H.length}">
        <picture><source media="(max-width: 760px)" srcset="${escAttr(IMG(h.imgM || h.img))}"><img src="${escAttr(IMG(h.img))}" alt="" width="1600" height="900" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></picture>
        <figcaption><span class="tsx-eyebrow">${esc(h.eyebrow||"")}</span><h2>${esc(h.title||"").replace(/\n/g, "<br>")}</h2>
          <button class="tsx-ul" data-sx="cat" data-id="${escAttr(h.go||"all")}">${esc(h.cta||"Khám phá")}</button></figcaption></figure>`).join("")}</div>
      ${H.length > 1 ? `<div class="tsx-hero-dots" role="tablist" aria-label="Chọn ảnh">${H.map((h, i)=> `<button role="tab" aria-label="Ảnh ${i+1}" data-sx="hero" data-id="${i}" class="${i ? "" : "on"}"></button>`).join("")}</div>` : ""}
    </section>
    <section class="tsx-sec">
      <div class="tsx-sec-h"><h2>Mới về</h2><button class="tsx-ul" data-sx="cat" data-id="new">Xem tất cả</button></div>
      ${S.loaded ? `<div class="tsx-grid">${news.map(p=> tileHTML(p)).join("")}</div>` : skeletonGrid(4)}
    </section>
    <section class="tsx-tiles" aria-label="Danh mục">${arr(D().tiles).map(t=> `<button class="tsx-cattile" data-sx="cat" data-id="${escAttr(t.go)}"><img src="${escAttr(IMG(t.img))}" alt="" width="720" height="960" loading="lazy" decoding="async"><span>${esc(t.label)}</span></button>`).join("")}</section>
    <section class="tsx-sec">
      <div class="tsx-sec-h"><h2>Tất cả sản phẩm</h2><span class="tsx-count">${S.loaded ? list.length + " sản phẩm" : ""}</span></div>
      ${S.loaded ? `<div class="tsx-grid">${sortList(list, "featured").map(p=> tileHTML(p)).join("")}</div>` : skeletonGrid(8)}
    </section>
    <section class="tsx-usp">
      <div>${svg("truck")}<b>Miễn phí giao hàng</b><span>Cho đơn từ ${vnd(CFG.freeShipFrom)}</span></div>
      <div>${svg("swap")}<b>Đổi size 7 ngày</b><span>Miễn phí, chưa giặt, còn tem</span></div>
      <div>${svg("gift")}<b>${gfp()}% doanh thu → quỹ quà</b><span>Tặng thành viên tập đều mỗi tháng</span></div>
    </section>`;
};
AFTER.home = ()=>{
  const tr = q("#tsx-hero"); if(!tr) return;
  tr.addEventListener("scroll", ()=>{ const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); qa(".tsx-hero-dots button").forEach((b, k)=>{ b.classList.toggle("on", k === i); b.setAttribute("aria-selected", String(k === i)); }); }, { passive:true });
};

/* --- Danh mục --- */
VIEWS.list = prm=>{
  const cat = prm.cat || "all";
  let list = visible().filter(p=> inCat(p, cat));
  const types = Array.from(new Set(list.map(p=> p.type).filter(Boolean)));
  if(UI.type && !types.includes(UI.type)) UI.type = "";
  if(UI.type) list = list.filter(p=> p.type === UI.type);
  list = sortList(list, UI.sort);
  return `<section class="tsx-sec top">
    <div class="tsx-list-h"><h1>${esc(CAT_TITLE[cat] || cat)}</h1><span class="tsx-count">${S.loaded ? list.length + " sản phẩm" : ""}</span></div>
    <div class="tsx-tools">
      <div class="tsx-chips" role="group" aria-label="Loại sản phẩm"><button class="${UI.type ? "" : "on"}" data-sx="type" data-id="">Tất cả</button>${types.map(t=> `<button class="${UI.type === t ? "on" : ""}" data-sx="type" data-id="${escAttr(t)}">${esc(t)}</button>`).join("")}</div>
      <label class="tsx-sort"><span>Sắp xếp</span><select data-sx-sort aria-label="Sắp xếp">${[["featured","Nổi bật"],["new","Mới nhất"],["price-asc","Giá tăng dần"],["price-desc","Giá giảm dần"]].map(([k,l])=> `<option value="${k}" ${UI.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    ${S.loaded ? (list.length ? `<div class="tsx-grid">${list.map((p, i)=> tileHTML(p, { eager: i < 4 })).join("")}</div>` : `<p class="tsx-empty">Chưa có sản phẩm trong mục này.</p>`) : skeletonGrid(8)}
    <p class="tsx-note center">Mẹo: chạm và giữ (hoặc rê chuột) lên ảnh để xem mặt sau / ảnh cận.</p>
  </section>`;
};

/* --- Tìm kiếm --- */
VIEWS.search = ()=>{
  const k = ascii(UI.q).toLowerCase();
  const res = k ? visible().filter(p=> ascii([p.name, p.type, p.short, arr(p.colors).map(c=> c.name).join(" ")].join(" ")).toLowerCase().includes(k)) : [];
  const sug = ["Áo thun", "Legging", "Áo khoác", "Bình nước", "Túi", "Tất"];
  return `<section class="tsx-sec top">
    <label class="tsx-search">${svg("search")}<input id="tsx-q" type="search" inputmode="search" autocomplete="off" placeholder="Tìm áo, quần, bình nước…" value="${escAttr(UI.q)}" aria-label="Tìm sản phẩm"></label>
    ${k ? `<p class="tsx-count">${res.length} kết quả cho “${esc(UI.q)}”</p>` : `<div class="tsx-chips">${sug.map(s=> `<button data-sx="q" data-id="${escAttr(s)}">${esc(s)}</button>`).join("")}</div>`}
    <div id="tsx-sres">${k ? (res.length ? `<div class="tsx-grid">${res.map(p=> tileHTML(p)).join("")}</div>` : `<p class="tsx-empty">Không tìm thấy sản phẩm phù hợp. Thử “áo”, “bình”, “legging”.</p>`) : ""}</div>
  </section>`;
};
AFTER.search = ()=>{ const i = q("#tsx-q"); if(i && !i.dataset.f){ i.dataset.f = 1; setTimeout(()=>{ try{ i.focus(); i.setSelectionRange(i.value.length, i.value.length); }catch(e){} }, 30); } };

/* --- Trang sản phẩm --- */
function selFor(p){
  const s = UI.sel[p.id] = obj(UI.sel[p.id]);
  if(!arr(p.colors).some(c=> c.id === s.color)) s.color = (arr(p.colors).find(c=> colorStock(p, c.id) > 0) || arr(p.colors)[0] || {}).id || "";
  if(s.size && !arr(p.sizes).includes(s.size)) s.size = "";
  return s;
}
function chartOf(p){ const C = obj(D().sizeCharts); return p.sizeChart && C[p.sizeChart] ? C[p.sizeChart] : null; }
VIEWS.product = prm=>{
  let p = prod(prm.id);
  if(p && S.loaded && !visible().includes(p)) p = null;             // R3-ADMIN-01: sản phẩm mẫu / đang ẩn không mở được bằng liên kết thẳng
  if(!p) return S.loaded ? `<div class="tsx-pad"><p class="tsx-empty">Sản phẩm không còn bán.</p><button class="tsx-btn" data-sx="home">Về cửa hàng</button></div>` : `<div class="tsx-pd sk"><div class="tsx-pd-gal"><div class="tsx-gal"><div class="tsx-gal-i"></div></div></div></div>`;
  const s = selFor(p), cols = arr(p.colors), col = cols.find(c=> c.id === s.color) || cols[0] || {};
  const ims = imagesFor(p, col.id), sizes = arr(p.sizes), chart = chartOf(p);
  const rec = chart ? recommendSize(chart, state.profile) : "";
  const st = sizes.length ? (s.size ? stockOf(p, col.id, s.size) : colorStock(p, col.id)) : stockOf(p, col.id, "");
  const sale = Number(p.compareAt) > Number(p.price);
  const g = genderOf(p), crumb = g === "acc" ? "Phụ kiện" : g === "women" ? "Nữ" : g === "men" ? "Nam" : "Nam · Nữ";
  const related = arr(p.related).map(prod).filter(x=> x && !x.deleted && !x.hidden).concat(visible().filter(x=> x.id !== p.id && genderOf(x) === g)).filter((x, i, a)=> x.id !== p.id && a.findIndex(y=> y.id === x.id) === i).slice(0, 4);
  const pts = TapEv.points ? TapEv.points.balance() : 0;
  const lowNote = s.size && st > 0 && st <= 3 ? `<p class="tsx-low">Chỉ còn ${st} sản phẩm size ${esc(s.size)}</p>` : (!sizes.length && st > 0 && st <= 5 ? `<p class="tsx-low">Chỉ còn ${st} sản phẩm</p>` : "");
  const out = sizes.length ? colorStock(p, col.id) <= 0 : st <= 0;
  return `<div class="tsx-pd">
    <div class="tsx-pd-gal">
      <div class="tsx-gal" id="tsx-gal" tabindex="0" aria-label="Ảnh sản phẩm, vuốt ngang để xem thêm">${ims.length ? ims.map((u, i)=> `<div class="tsx-gal-i"><img src="${escAttr(u)}" alt="${escAttr(p.name)} — ${escAttr(col.name||"")} — ảnh ${i+1}" width="720" height="960" ${i ? 'loading="lazy"' : ""} decoding="async"></div>`).join("")
        : `<div class="tsx-gal-i svg">${art(p, col.hex, 360)}</div>`}</div>
      ${ims.length > 1 ? `<div class="tsx-gal-n" aria-hidden="true"><span id="tsx-gal-i">1</span> / ${ims.length}</div><div class="tsx-gal-dots" aria-hidden="true">${ims.map((u, i)=> `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
    </div>
    <div class="tsx-pd-info"><div class="tsx-pd-in">
      <p class="tsx-crumb">${esc(crumb)} / ${esc(p.type || "Sản phẩm")}</p>
      <h1 class="tsx-pd-name">${esc(p.name)}</h1>
      <p class="tsx-price lg">${sale ? `<s>${vnd(p.compareAt)}</s><b class="sale">${vnd(p.price)}</b><em>−${Math.round((1 - p.price/p.compareAt)*100)}%</em>` : `<b>${vnd(p.price)}</b>`}</p>
      ${p.short ? `<p class="tsx-pd-short">${esc(p.short)}</p>` : ""}
      ${cols.length ? `<div class="tsx-opt"><div class="tsx-opt-h"><span>Màu: <b>${esc(col.name||"")}</b></span></div>
        <div class="tsx-sw" role="radiogroup" aria-label="Chọn màu">${cols.map(c=> `<button role="radio" aria-checked="${c.id === col.id}" aria-label="${escAttr(c.name)}${colorStock(p, c.id) <= 0 ? " (hết hàng)" : ""}" class="${c.id === col.id ? "on" : ""} ${colorStock(p, c.id) <= 0 ? "x" : ""}" data-sx="color" data-id="${escAttr(p.id)}" data-v="${escAttr(c.id)}"><i style="background:${isHex(c.hex) ? c.hex : "#999"}"></i></button>`).join("")}</div></div>` : ""}
      ${sizes.length ? `<div class="tsx-opt" id="tsx-sizes"><div class="tsx-opt-h"><span>Size${s.size ? `: <b>${esc(s.size)}</b>` : ""}</span>${chart ? `<button class="tsx-ul sm" data-sx="guide" data-id="${escAttr(p.sizeChart)}" data-p="${escAttr(p.id)}">${svg("ruler")}Hướng dẫn chọn size</button>` : ""}</div>
        <div class="tsx-sz" role="radiogroup" aria-label="Chọn size">${sizes.map(z=>{ const k = stockOf(p, col.id, z); return `<button role="radio" aria-checked="${z === s.size}" class="${z === s.size ? "on" : ""} ${k <= 0 ? "x" : ""} ${z === rec ? "rec" : ""}" data-sx="size" data-id="${escAttr(p.id)}" data-v="${escAttr(z)}" ${k <= 0 ? 'aria-disabled="true"' : ""} aria-label="Size ${escAttr(z)}${k <= 0 ? ", hết hàng" : k <= 3 ? ", sắp hết" : ""}${z === rec ? ", gợi ý cho bạn" : ""}">${esc(z)}</button>`; }).join("")}</div>
        ${rec ? `<p class="tsx-rec">Gợi ý theo hồ sơ (${esc(state.profile.height)} cm · ${esc(state.profile.weight)} kg): <b>${esc(rec)}</b>. Thích mặc rộng → tăng 1 size.</p>` : ""}
        <p class="tsx-err" id="tsx-sz-err" hidden>Vui lòng chọn size</p></div>` : ""}
      ${lowNote}
      ${p.fit ? `<p class="tsx-fit">${esc(p.fit)}</p>` : ""}
      <div class="tsx-buy"><button class="tsx-btn block" data-sx="add" data-id="${escAttr(p.id)}" ${out ? "disabled" : ""}>${out ? "Hết hàng màu này" : "Thêm vào giỏ"}</button></div>
      <p class="tsx-pts">${svg("gift")}Bạn có <b>${nf(pts)} điểm</b> TapEasy — <button class="tsx-ul sm" data-sx="vouchers">đổi voucher</button></p>
      <div class="tsx-acc">
        <details open><summary>Mô tả &amp; dáng</summary><div><p>${esc(p.desc || p.short || "")}</p>${arr(p.details).length ? `<ul>${arr(p.details).map(x=> `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></details>
        <details><summary>Chất liệu &amp; bảo quản</summary><div><p><b>Chất liệu.</b> ${esc(p.material || "—")}</p><p><b>Bảo quản.</b> ${esc(p.care || "—")}</p></div></details>
        <details><summary>Giao hàng &amp; đổi trả</summary><div><ul>${arr(D().shipping).concat(arr(D().returns)).map(x=> `<li>${esc(x)}</li>`).join("")}</ul><p>Hỗ trợ: ${esc(CFG.hotline)}</p></div></details>
      </div>
      <p class="tsx-note">Mã: ${esc(String(p.id).replace(/^p_/, "").toUpperCase())}-${esc(String(col.id||"").toUpperCase())} · Ảnh dựng của thiết kế, màu thực tế có thể chênh nhẹ.</p>
    </div></div>
  </div>
  ${related.length ? `<section class="tsx-sec"><div class="tsx-sec-h"><h2>Gợi ý cho bạn</h2></div><div class="tsx-grid rel">${related.map(x=> tileHTML(x)).join("")}</div></section>` : ""}`;
};
AFTER.product = ()=>{
  const g = q("#tsx-gal"); if(!g) return;
  g.addEventListener("scroll", ()=>{ const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth)); const n = q("#tsx-gal-i"); if(n) n.textContent = String(i + 1); qa(".tsx-gal-dots i").forEach((d, k)=> d.classList.toggle("on", k === i)); }, { passive:true });
};
function addToCart(pid){
  const p = prod(pid); if(!p) return;
  if(!sellable(p)){ toast(storeState().live ? "Sản phẩm này chưa mở bán" : "Cửa hàng chưa mở bán"); return; }
  const s = selFor(p), sizes = arr(p.sizes);
  if(sizes.length && !s.size){ const e = q("#tsx-sz-err"); if(e){ e.hidden = false; } const z = q("#tsx-sizes"); if(z){ z.classList.remove("shake"); void z.offsetWidth; z.classList.add("shake"); z.scrollIntoView({ block:"center", behavior: reduceMotion() ? "auto" : "smooth" }); } toast("Vui lòng chọn size"); return; }
  const st = stockOf(p, s.color, s.size); if(st <= 0){ toast("Size/màu này đã hết hàng"); return; }
  const sh = SH(), key = [p.id, s.color, s.size].join("|"), cur = sh.cart.find(c=> c.key === key), max = Math.min(10, st);
  if(cur){ if(cur.qty >= max){ toast(`Chỉ còn ${max} sản phẩm`); return; } cur.qty += 1; }
  else sh.cart.push({ key, pid:p.id, color:s.color, size:s.size, qty:1 });
  save(); try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){}
  toastOff(); UI.added = key; render(true); openLayer("cart");
}

/* --- Hướng dẫn chọn size (ngăn kéo) --- */
function guideHTML(id, pid){
  const C = obj(D().sizeCharts), ch = C[id], H = obj(D().howToMeasure);
  if(!ch) return `<p class="tsx-note">Sản phẩm này không cần chọn size.</p>`;
  const p = pid ? prod(pid) : null, rec = recommendSize(ch, state.profile);
  const other = Object.keys(C).filter(k=> k !== id);
  return `<p class="tsx-note">Số đo <b>cơ thể</b> tính bằng cm (trừ cột ghi “áo”/“quần” là số đo sản phẩm đặt phẳng). Nằm giữa 2 size: thích ôm → size nhỏ, thích thoải mái → size lớn.</p>
    <div class="tsx-tbl-w"><table class="tsx-tbl"><caption>${esc(ch.title)} (cm, kg)</caption><thead><tr>${ch.cols.map(c=> `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${ch.rows.map(r=> `<tr class="${r[0] === rec ? "rec" : ""}">${r.map((v, i)=> i ? `<td>${esc(v)}</td>` : `<th scope="row">${esc(v)}${r[0] === rec ? " ●" : ""}</th>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${rec ? `<p class="tsx-rec">● Gợi ý theo hồ sơ của bạn (${esc(state.profile.height)} cm · ${esc(state.profile.weight)} kg): <b>${esc(rec)}</b>${p ? ` cho ${esc(p.name)}` : ""}.</p>` : `<p class="tsx-note">Điền chiều cao, cân nặng trong Hồ sơ để app gợi ý size.</p>`}
    <h4>Cách đo</h4><ul class="tsx-how">${arr(ch.how).map(k=> H[k] ? `<li>${esc(H[k])}</li>` : "").join("")}</ul>
    <p class="tsx-note">Đổi size miễn phí trong 7 ngày. Cần tư vấn size: ${esc(CFG.hotline)}.</p>
    ${other.length ? `<div class="tsx-chips sm">${other.map(k=> `<button data-sx="guide" data-id="${escAttr(k)}">${esc(C[k].title)}</button>`).join("")}</div>` : ""}`;
}

/* --- Giỏ hàng (ngăn kéo phải) --- */
let _voucherId = "";
function pickedVoucher(){ return vouchersUsable().find(v=> v.id === _voucherId) || null; }
function sumHTML(t, v, ship){
  return `<dl class="tsx-sum">
    <div><dt>Tạm tính</dt><dd>${vnd(t.subtotal)}</dd></div>
    <div><dt>Giao hàng${ship === "express" ? " (hoả tốc)" : ""}</dt><dd>${t.shipping ? vnd(t.shipping) : "Miễn phí"}</dd></div>
    ${t.discount ? `<div class="minus"><dt>Voucher ${v && v.code ? esc(v.code) : ""}</dt><dd>−${vnd(t.discount)}</dd></div>` : ""}
    <div class="total"><dt>Tổng</dt><dd>${vnd(t.total)}</dd></div>
  </dl>`;
}
function cartHTML(){
  const lines = cartLines(), v = pickedVoucher(), t = totals(lines, v), vs = vouchersUsable();
  if(!lines.length) return `<div class="tsx-empty-c"><p>Giỏ hàng của bạn đang trống.</p><button class="tsx-btn block" data-sx="cat" data-id="new">Tiếp tục mua sắm</button></div>`;
  const pct = Math.min(100, Math.round(t.subtotal / CFG.freeShipFrom * 100));
  return `${UI.added ? `<p class="tsx-added">${svg("check")}Đã thêm vào giỏ</p>` : ""}
    <div class="tsx-fs"><p>${t.freeShipLeft ? `Mua thêm <b>${vnd(t.freeShipLeft)}</b> để được miễn phí giao hàng` : `Đơn của bạn được <b>miễn phí giao hàng</b>`}</p><i><b style="width:${t.freeShipLeft ? pct : 100}%"></b></i></div>
    <ul class="tsx-lines">${lines.map(l=> `<li class="tsx-line ${UI.added === l.key ? "new" : ""}">
      <button class="tsx-line-im" data-sx="p" data-id="${escAttr(l.pid)}" aria-label="Xem ${escAttr(l.name)}">${l.img ? `<img src="${escAttr(l.img)}" alt="" width="90" height="120" loading="lazy">` : art(l.p, l.hex, 90)}</button>
      <div class="tsx-line-b"><h4>${esc(l.name)}</h4><p>${esc(l.colorName)}${l.size ? ` · ${arr(l.p.sizes).length > 1 ? `<label class="tsx-mini-sel">Size <select data-sx-size="${escAttr(l.key)}" aria-label="Đổi size ${escAttr(l.name)}">${arr(l.p.sizes).map(z=>{ const k = stockOf(l.p, l.color, z); return `<option value="${escAttr(z)}" ${z === l.size ? "selected" : ""} ${k <= 0 && z !== l.size ? "disabled" : ""}>${esc(z)}${k <= 0 ? " (hết)" : ""}</option>`; }).join("")}</select></label>` : "Size " + esc(l.size)}` : ""}</p>
        <div class="tsx-line-q"><div class="tsx-qty"><button data-sx="qty" data-id="${escAttr(l.key)}" data-v="-1" aria-label="Giảm số lượng">${svg("minus")}</button><b aria-live="polite">${l.qty}</b><button data-sx="qty" data-id="${escAttr(l.key)}" data-v="1" aria-label="Tăng số lượng" ${l.qty >= Math.min(10, l.stock) ? "disabled" : ""}>${svg("plus")}</button></div>
          <button class="tsx-ul sm" data-sx="rm" data-id="${escAttr(l.key)}">Xoá</button><b class="tsx-line-p">${vnd(l.price * l.qty)}</b></div>
        ${l.stock < l.qty ? `<p class="tsx-low">Chỉ còn ${l.stock} sản phẩm — giảm số lượng để đặt</p>` : ""}
      </div></li>`).join("")}</ul>
    <div class="tsx-vpick"><h4>Voucher</h4>
      ${G.cloudAdmin && G.cloudAdmin.lookupVoucher ? `<div class="tsx-vcode"><input id="tsx-vcode" maxlength="16" placeholder="Nhập mã giảm giá" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Mã giảm giá"><button class="tsx-btn ghost" data-sx="vcode">Áp dụng</button></div>` : ""}
      ${vs.length ? `<div role="radiogroup" aria-label="Chọn voucher" class="tsx-vlist"><button role="radio" aria-checked="${!v}" class="${!v ? "on" : ""}" data-sx="voucher" data-id="">Không dùng voucher</button>${vs.map(x=> `<button role="radio" aria-checked="${!!(v && v.id === x.id)}" class="${v && v.id === x.id ? "on" : ""}" data-sx="voucher" data-id="${escAttr(x.id)}"><b>${esc(x.title)}</b><small>${esc(x.sub||"")} · HSD ${esc(String(x.exp||"").split("-").reverse().join("/"))}</small></button>`).join("")}</div>`
        : `<p class="tsx-note">Chưa có voucher. <button class="tsx-ul sm" data-sx="vouchers">Đổi ${nf(TapEv.points ? TapEv.points.balance() : 0)} điểm lấy voucher</button></p>`}
      ${t.vErr ? `<p class="tsx-err">${esc(t.vErr)}</p>` : ""}</div>
    ${sumHTML(t, v)}
    <button class="tsx-btn block" data-sx="checkout">Thanh toán · ${vnd(t.total)}</button>
    <button class="tsx-btn ghost block" data-sx="close-layer">Tiếp tục mua sắm</button>
    <p class="tsx-note center">Phí giao hàng tính lại ở bước Giao hàng (hoả tốc nội thành).</p>`;
}
function changeQty(key, d){
  const sh = SH(), c = sh.cart.find(x=> x.key === key); if(!c) return;
  const p = prod(c.pid), max = Math.min(10, p ? stockOf(p, c.color, c.size) : 10);
  c.qty = (Number(c.qty)||1) + d;
  if(c.qty <= 0) sh.cart = sh.cart.filter(x=> x.key !== key); else c.qty = Math.min(Math.max(1, max), c.qty);
  save(); try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){}
  UI.added = null; render(true);
}
function changeSize(key, size){
  const sh = SH(), c = sh.cart.find(x=> x.key === key); if(!c || c.size === size) return;
  const nk = [c.pid, c.color, size].join("|"), o = sh.cart.find(x=> x.key === nk);
  if(o){ o.qty = Math.min(10, o.qty + c.qty); sh.cart = sh.cart.filter(x=> x !== c); } else { c.size = size; c.key = nk; }
  save(); UI.added = null; toast("Đã đổi size " + size); render(true);
}

/* --- Ngăn kéo / lớp phủ --- */
function openLayer(name, p){ UI.layer = name; UI.layerP = p || {}; renderLayer(); }
function closeLayer(){ UI.layer = null; UI.added = null; const L = q("#tsx-layer"); if(L){ L.innerHTML = ""; L.dataset.l = ""; } if(root) root.classList.remove("tsx-layer-on"); }
function renderLayer(){
  const L = q("#tsx-layer"); if(!L) return;
  let title = "", body = "", side = "right";
  if(UI.layer === "cart"){ const n = cartCount(); title = `Giỏ hàng${n ? ` (${n})` : ""}`; body = cartHTML(); }
  else if(UI.layer === "guide"){ title = "Hướng dẫn chọn size"; body = guideHTML(UI.layerP.id, UI.layerP.pid); side = "right"; }
  else if(UI.layer === "info"){ const ship = UI.layerP.id === "ship"; title = ship ? "Giao hàng" : "Đổi trả"; body = `<ul class="tsx-how">${arr(ship ? D().shipping : D().returns).map(x=> `<li>${esc(x)}</li>`).join("")}</ul><p class="tsx-note">Hỗ trợ: ${esc(CFG.hotline)}</p>`; }
  else { L.innerHTML = ""; return; }
  const sc = q(".tsx-drawer-b", L) ? q(".tsx-drawer-b", L).scrollTop : 0, same = L.dataset.l === UI.layer;
  L.dataset.l = UI.layer;
  L.innerHTML = `<div class="tsx-scrim" data-sx="close-layer"></div><aside class="tsx-drawer ${side} ${same ? "" : "anim"}" role="dialog" aria-modal="true" aria-label="${escAttr(title)}">
    <div class="tsx-drawer-h"><h2>${esc(title)}</h2><button class="tsx-ib" data-sx="close-layer" aria-label="Đóng">${svg("close")}</button></div>
    <div class="tsx-drawer-b">${body}</div></aside>`;
  root.classList.add("tsx-layer-on");
  if(same) q(".tsx-drawer-b", L).scrollTop = sc; else { const b = q(".tsx-drawer [data-sx=close-layer]", L); if(b) try{ b.focus({ preventScroll:true }); }catch(e){} }
}

/* --- Thanh toán 3 bước --- */
const EXPRESS_OK = ["Hà Nội", "TP. Hồ Chí Minh"];
function ckSteps(n){
  return `<ol class="tsx-steps" aria-label="Các bước thanh toán">${["Giao hàng","Thanh toán","Xác nhận"].map((l, i)=> `<li class="${i + 1 < n ? "done" : i + 1 === n ? "cur" : ""}" ${i + 1 === n ? 'aria-current="step"' : ""}>${i + 1 < n ? `<button data-sx="ck-step" data-id="${i + 1}">` : "<span>"}<i>${i + 1 < n ? svg("check") : i + 1}</i>${l}${i + 1 < n ? "</button>" : "</span>"}</li>`).join("")}</ol>`;
}
function ckSummary(t, v, ship){
  const lines = cartLines();
  return `<aside class="tsx-ck-sum"><details class="tsx-ck-det" ${G.innerWidth >= 900 ? "open" : ""}><summary><span>Đơn hàng (${lines.reduce((a, l)=> a + l.qty, 0)})</span><b>${vnd(t.total)}</b></summary>
    <ul class="tsx-mini">${lines.map(l=> `<li><span class="im">${l.img ? `<img src="${escAttr(l.img)}" alt="" width="54" height="72" loading="lazy">` : art(l.p, l.hex, 54)}<i>${Number(l.qty)||0}</i></span><span class="tx"><b>${esc(l.name)}</b><small>${esc([l.colorName, l.size].filter(Boolean).join(" · "))}</small></span><b>${vnd(l.price * l.qty)}</b></li>`).join("")}</ul>
    ${sumHTML(t, v, ship)}</details></aside>`;
}
function bankHTML(o){
  const B = CFG.bank, note = "TAPEASY " + String(o.code||"").replace(/-/g, "");
  const filled = B.accountNo && !/^\[/.test(B.accountNo);
  const qr = filled ? vietQR({ bankBin:B.bankBin, accountNo:B.accountNo, amount:o.total, note }) : "";
  const row = (l, v, copy)=> `<div class="tsx-bank-r"><dt>${esc(l)}</dt><dd>${esc(v)}</dd>${copy ? `<button class="tsx-ib sm" data-sx="copy" data-id="${escAttr(v)}" aria-label="Sao chép ${escAttr(l)}">${svg("copy")}</button>` : "<span></span>"}</div>`;
  return `<div class="tsx-bank">
    ${qr && TapEv.QR ? `<div class="tsx-bank-qr">${TapEv.QR.svg(qr, { size:200, margin:2, ecl:"M", label:"Mã VietQR chuyển khoản" })}<small>Mở app ngân hàng → Quét mã VietQR (đã có số tiền và nội dung)</small></div>`
      : o.payVia === "vietqr" ? `<p class="tsx-err">Mã VietQR sẽ hiện khi chủ app điền mã BIN + số tài khoản (TAPEASY_SHOP_CONFIG). Tạm thời chuyển khoản theo thông tin dưới.</p>` : ""}
    <dl>${row("Ngân hàng", B.bankName + (B.branch ? " – " + B.branch : ""))}${row("Số tài khoản", B.accountNo, filled)}${row("Chủ tài khoản", B.accountName)}${row("Số tiền", vnd(o.total), true)}${row("Nội dung", note, true)}</dl>
    ${!filled ? `<p class="tsx-err">Bản thử nghiệm: thông tin ngân hàng đang để trống — chủ app điền trong TAPEASY_SHOP_CONFIG.</p>` : ""}
    <p class="tsx-note">Ghi đúng nội dung để đơn được xác nhận nhanh. TapEasy không yêu cầu và không lưu thông tin thẻ.</p>
  </div>`;
}
VIEWS.checkout = prm=>{
  const step = Math.max(1, Math.min(3, Number(prm.step)||1)), sh = SH();
  const lines = cartLines();
  if(!lines.length) return `<div class="tsx-pad"><p class="tsx-empty">Giỏ hàng trống.</p><button class="tsx-btn" data-sx="cat" data-id="new">Tiếp tục mua sắm</button></div>`;
  if(cloudEvents.mode === "firebase" && !(typeof cloud !== "undefined" && cloud.user))
    return `<div class="tsx-pad"><h1 class="tsx-h1">Đăng nhập để đặt hàng</h1><p class="tsx-note">Đăng nhập giúp bạn theo dõi đơn và nhận điểm.</p><button class="tsx-btn" data-sx="login">Đăng nhập</button></div>`;
  const ship = sh.ship === "express" ? "express" : "standard", pay = payOf(sh);
  const v = pickedVoucher(), t = totals(lines, v, shipCfg(ship));
  const A = Object.assign({ name: (state.tapEvents && state.tapEvents.contact && state.tapEvents.contact.name) || (state.profile||{}).name || "", phone: (state.tapEvents && state.tapEvents.contact && state.tapEvents.contact.phone) || "" }, obj((state.tapEvents||{}).address), sh.addr);
  let body = "";
  if(step === 1){
    body = `<h2 class="tsx-h2">Địa chỉ giao hàng</h2>
      <div class="tsx-form">${typeof TapEv.addressFormHTML === "function" ? TapEv.addressFormHTML(A) : `<p class="tsx-err">Thiếu events.js (form địa chỉ).</p>`}</div>
      <h2 class="tsx-h2">Phương thức giao hàng</h2>
      <div class="tsx-radios" role="radiogroup" aria-label="Phương thức giao hàng">
        <button role="radio" aria-checked="${ship === "standard"}" class="${ship === "standard" ? "on" : ""}" data-sx="ship" data-id="standard"><i></i><span><b>Tiêu chuẩn · 2–5 ngày</b><small>${totals(lines, null).shipping ? vnd(CFG.shippingFee) + " · miễn phí từ " + vnd(CFG.freeShipFrom) : "Miễn phí"}</small></span></button>
        <button role="radio" aria-checked="${ship === "express"}" class="${ship === "express" ? "on" : ""}" data-sx="ship" data-id="express"><i></i><span><b>Hoả tốc trong ngày · ${vnd(CFG.expressFee)}</b><small>Nội thành Hà Nội, TP. Hồ Chí Minh — đặt trước 11:00</small></span></button>
      </div>
      <button class="tsx-btn block" data-sx="ck-next" data-id="2">Tiếp tục đến thanh toán</button>`;
  } else if(step === 2){
    /* QC-18: chưa cấu hình tài khoản nhận tiền → chỉ COD (không hiện "[Số tài khoản]" cho khách) */
    const P = [["cod","Thanh toán khi nhận hàng (COD)","Kiểm tra hàng rồi trả tiền mặt cho người giao"]].concat(bankReady() ? [["bank","Chuyển khoản ngân hàng","Nhận số tài khoản sau khi đặt, giữ hàng 24 giờ"],["vietqr","VietQR","Quét mã bằng app ngân hàng — tự điền số tiền & nội dung"]] : []);
    body = `<h2 class="tsx-h2">Phương thức thanh toán</h2>
      <div class="tsx-radios" role="radiogroup" aria-label="Phương thức thanh toán">${P.map(([k, l, s])=> `<button role="radio" aria-checked="${pay === k}" class="${pay === k ? "on" : ""}" data-sx="pay" data-id="${k}"><i></i><span><b>${l}</b><small>${s}</small></span></button>`).join("")}</div>
      ${bankReady() ? "" : `<p class="tsx-note">Hiện cửa hàng nhận thanh toán khi giao hàng (COD). Chuyển khoản/VietQR sẽ mở khi cửa hàng cập nhật tài khoản nhận tiền.</p>`}
      <p class="tsx-note">TapEasy không thu thập hay lưu thông tin thẻ ngân hàng.</p>
      <button class="tsx-btn block" data-sx="ck-next" data-id="3">Tiếp tục · xem lại đơn</button>`;
  } else {
    const a = sh.addr || {};
    body = `<h2 class="tsx-h2">Xác nhận đơn hàng</h2>
      <div class="tsx-rv"><div><h4>Giao tới</h4><p><b>${esc(a.name||"")}</b> · ${esc(a.phone||"")}<br>${esc(TapEv.addrText ? TapEv.addrText(a) : "")}${a.note ? `<br><small>${esc(a.note)}</small>` : ""}</p><p>${ship === "express" ? "Hoả tốc trong ngày" : "Tiêu chuẩn 2–5 ngày"}</p></div><button class="tsx-ul sm" data-sx="ck-step" data-id="1">Sửa</button></div>
      <div class="tsx-rv"><div><h4>Thanh toán</h4><p>${pay === "cod" ? "Thanh toán khi nhận hàng (COD)" : pay === "vietqr" ? "VietQR (quét mã sau khi đặt)" : "Chuyển khoản ngân hàng"}</p></div><button class="tsx-ul sm" data-sx="ck-step" data-id="2">Sửa</button></div>
      ${t.vErr ? `<p class="tsx-err">${esc(t.vErr)}</p>` : ""}
      <p class="tsx-note">Bấm “Đặt hàng” là bạn đồng ý chính sách đổi trả 7 ngày. Đơn chưa xác nhận có thể tự huỷ trong mục Đơn hàng.</p>
      <button class="tsx-btn block" id="tsx-place" data-sx="place" data-sig-skip="1">Đặt hàng · ${vnd(t.total)}</button>`;
  }
  return `<div class="tsx-ck"><div class="tsx-ck-main"><h1 class="tsx-h1">Thanh toán</h1>${ckSteps(step)}<div class="tsx-ck-body">${body}</div></div>${ckSummary(t, v, ship)}</div>`;
};
function ckNext(to){
  const sh = SH(), step = Number(UI.params.step)||1;
  if(step === 1 && to > 1){
    if(typeof TapEv.readAddress !== "function"){ toast("Thiếu form địa chỉ"); return; }
    const { a, err } = TapEv.readAddress(q("#tsx-main")); if(err){ toast(err); return; }
    if(sh.ship === "express" && !EXPRESS_OK.includes(a.province)){ toast("Hoả tốc chỉ áp dụng nội thành Hà Nội, TP. Hồ Chí Minh"); return; }
    sh.addr = a; save();
  }
  if(to === 3 && payOf(sh) !== sh.pay){ sh.pay = payOf(sh); save(); }
  toastOff(); UI.params = { step: to }; render(); root.scrollTop = 0;
}
/* QC-16: Store dùng nút "Đặt hàng" thường (không trượt — data-sig-skip) + hộp xác nhận tóm tắt đơn trước khi gửi.
   QC-03/06/QS-06/08: máy khách chỉ gửi món + số lượng + voucher; "máy chủ" (cloudEvents.placeOrder) tính lại giá từ danh mục,
   kiểm tồn kho, trừ kho, tiêu thụ voucher. Từ chối nghiệp vụ → { ok:false, rejected, code, error } → báo đúng lý do, giữ giỏ. */
function orderPayload(){
  const sh = SH(), a = sh.addr, lines = cartLines();
  const ship = sh.ship === "express" ? "express" : "standard", pay = payOf(sh);
  const v = pickedVoucher(), t = totals(lines, v, shipCfg(ship));
  const vo = v && t.discount ? (v.src === "admin" ? { src:"admin", code: v.code, claimId: v.claimId || "", title: v.title }
    : { id: v.id, kind: v.kind, value: v.value, min: v.min, max: v.max, exp: v.exp, ref: v.ref, code: v.code, title: v.title, src: v.src, sig: v.sig || "", server: !!v.server }) : null;
  return { sh, a, lines, ship, pay, v, t, payload: { items: lines.map(l=> ({ pid:l.pid, color:l.color, size:l.size, qty: Math.max(1, Math.min(10, Math.round(Number(l.qty)||1))) })),
    total: t.total, voucher: vo, payment: pay === "cod" ? "cod" : "bank", payVia: pay, shipMethod: ship, address: a, note: (a && a.note) || "", name: (a && a.name) || "" } };
}
function confirmOrder(){
  const btn = q("#tsx-place"); if(btn && btn.disabled) return;
  const sh = SH(), a = sh.addr;
  if(!a || !a.phone){ ckNext(1); toast("Nhập địa chỉ giao hàng"); return; }
  const P = orderPayload(); if(!P.lines.length){ toast("Giỏ hàng trống"); render(); return; }
  const bad = P.lines.find(l=> l.qty > l.stock);
  if(bad){ toast(`${bad.name} (${[bad.colorName, bad.size].filter(Boolean).join(", ")}): chỉ còn ${Number(bad.stock)||0}`); openLayer("cart"); return; }
  const n = P.lines.reduce((x, l)=> x + (Number(l.qty)||0), 0);
  const payTxt = P.pay === "cod" ? "Thanh toán khi nhận hàng (COD)" : P.pay === "vietqr" ? "VietQR — quét mã sau khi đặt" : "Chuyển khoản ngân hàng";
  const m = document.createElement("div"); m.className = "tsx-modal"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "tsx-co-h");
  m.innerHTML = `<div class="tsx-modal-box tsx-co"><h3 id="tsx-co-h">Xác nhận đặt hàng</h3>
    <ul class="tsx-co-l">${P.lines.map(l=> `<li><span>${esc(l.name)}<small>${esc([l.colorName, l.size].filter(Boolean).join(" · "))} × ${Number(l.qty)||0}</small></span><b>${vnd(l.price * l.qty)}</b></li>`).join("")}</ul>
    ${sumHTML(P.t, P.v, P.ship)}
    <p class="tsx-co-m"><b>Giao tới:</b> ${esc(a.name || "")} · ${esc(a.phone || "")}<br>${esc(TapEv.addrText ? TapEv.addrText(a) : "")}</p>
    <p class="tsx-co-m"><b>Thanh toán:</b> ${esc(payTxt)} · ${P.ship === "express" ? "Hoả tốc trong ngày" : "Giao tiêu chuẩn 2–5 ngày"}</p>
    <div class="tsx-row2"><button class="tsx-btn ghost" data-m="no">Xem lại</button><button class="tsx-btn" data-m="ok">Đặt hàng · ${vnd(P.t.total)}</button></div>
    <p class="tsx-note center">${n} sản phẩm · giá và tồn kho được kiểm lại lần cuối khi đặt.</p></div>`;
  root.appendChild(m);
  m.addEventListener("click", e=>{ const b = e.target.closest("[data-m]"); if(!b && e.target !== m) return; m.remove(); if(b && b.dataset.m === "ok") placeOrder(); else if(btn) try{ btn.focus(); }catch(_){} });
  const ok = q("[data-m=ok]", m); if(ok) try{ ok.focus(); }catch(e){}
}
async function placeOrder(){
  const btn = q("#tsx-place"); if(btn && btn.disabled) return;
  const sh = SH(), a = sh.addr;
  if(!a || !a.phone){ ckNext(1); toast("Nhập địa chỉ giao hàng"); return; }
  const reset = ()=>{ const b = q("#tsx-place"); if(b){ b.disabled = false; render(true); } };
  if(btn){ btn.disabled = true; btn.textContent = "Đang đặt hàng…"; }
  try{
    await load(true);                                                   // giá + tồn kho mới nhất trước khi gửi
    const P = orderPayload(); if(!P.lines.length){ toast("Giỏ hàng trống"); render(); return; }
    const bad = P.lines.find(l=> l.qty > l.stock);
    if(bad){ toast(`${bad.name} (${[bad.colorName, bad.size].filter(Boolean).join(", ")}): chỉ còn ${Number(bad.stock)||0}`); openLayer("cart"); reset(); return; }
    const o = await cloudEvents.placeOrder(P.payload);
    if(!o || o.ok === false || !o.id){
      toast((o && o.error) || "Không đặt được hàng — thử lại sau ít phút");
      if(o && o.code === "voucher" && P.v){ _voucherId = ""; }
      S.loaded = false; await load(); reset(); return;
    }
    if(P.v && o.discount){ P.v.used = true; P.v.usedOrder = o.code; }
    sh.cart = []; _voucherId = "";
    /* QC-11: đơn đã nằm trên máy chủ (voucher đã tiêu thụ ở đó) → giữ trạng thái trong bộ nhớ, chỉ báo máy chưa lưu được */
    const okSave = save(); try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){}
    if(!okSave) setTimeout(()=> toast(`Đã đặt đơn ${o.code} — nhưng bộ nhớ máy đầy nên giỏ hàng/voucher trên máy chưa cập nhật.`), 1200);
    UI.lastOrder = o; UI.orders = null; S.loaded = false; load();
    UI.stack = UI.stack.filter(s=> s.view !== "checkout"); nav("done", { id:o.id }, false);
    if(Math.round(Number(o.total)) !== Math.round(P.t.total)) toast(`Tổng tiền theo giá hiện tại: ${vnd(o.total)}`);
  }catch(e){ toast(e && e.message || "Không đặt được hàng"); reset(); }
}
VIEWS.done = ()=>{
  const o = UI.lastOrder; if(!o) return VIEWS.home();
  const A = obj(o.address);
  return `<div class="tsx-done"><span class="tsx-done-ic">${svg("check")}</span>
    <h1 class="tsx-h1">Cảm ơn bạn đã đặt hàng</h1>
    <p>Mã đơn <b>${esc(o.code)}</b> · ${vnd(o.total)}</p>
    ${o.payment === "bank" ? `<p>Vui lòng chuyển khoản trong 24 giờ để giữ hàng.</p>${bankHTML(o)}` : `<p>TapEasy sẽ gọi ${esc(A.phone||"")} để xác nhận trong 24 giờ. Thanh toán khi nhận hàng.</p>`}
    <div class="tsx-row2"><button class="tsx-btn" data-sx="order" data-id="${escAttr(o.id)}">Xem đơn hàng</button><button class="tsx-btn ghost" data-sx="home">Tiếp tục mua sắm</button></div></div>`;
};

/* --- Đơn hàng --- */
const OST = { awaiting_payment:["Chờ chuyển khoản","warn"], pending:["Chờ xác nhận","warn"], confirmed:["Đã xác nhận","ok"], shipping:["Đang giao","ok"], delivered:["Đã giao","done"], cancelled:["Đã huỷ","dim"] };
const FLOW = ["pending","confirmed","shipping","delivered"];
/* QS-06: số lượng trong đơn (dữ liệu khách gửi / máy chủ) LUÔN ép số nguyên 0–99 trước khi chèn HTML — chuỗi "<img onerror>" không chạy trong phiên nhân sự */
const qtyOf = i=> Math.max(0, Math.min(99, Math.round(Number(i && i.qty)) || 0));
/* Ô chọn trạng thái: huỷ đơn đã xác nhận (= hoàn tiền) cần shop.refund */
/* QC-07: chỉ cho các bước chuyển hợp lệ (cloudEvents.policy.ORDER_FLOW); "Đã huỷ" là trạng thái CUỐI (khớp firestore.rules —
   mở lại đơn huỷ từng làm kho hoàn 2 lần). Cần bán lại → khách đặt đơn mới. */
function nextStatuses(st){
  const F = (cloudEvents.policy && cloudEvents.policy.ORDER_FLOW) || {};
  if(st === "cancelled") return [];
  return arr(F[st] || Object.keys(OST)).filter(k=> OST[k] && k !== st);
}
function ostSelect(o){
  const st = OST[o.status] ? o.status : "pending", nx = nextStatuses(st);
  const locked = ["confirmed","shipping","delivered"].includes(st) && !canRefund();
  if(!nx.length) return `<span class="tsx-st ${(OST[st]||OST.pending)[1]}">${esc((OST[st]||OST.pending)[0])}</span>`;
  return `<select data-sx-ost="${escAttr(o.id)}" aria-label="Trạng thái đơn ${escAttr(o.code)}"><option value="${st}" selected>${esc(OST[st][0])}</option>${nx.map(k=> `<option value="${k}" ${k === "cancelled" && locked ? "disabled" : ""}>→ ${esc(OST[k][0])}${k === "cancelled" && locked ? " (cần quyền hoàn tiền)" : ""}</option>`).join("")}</select>`;
}
function orderThumbs(o){ return arr(o.items).slice(0, 4).map(i=>{ const p = prod(i.pid); const u = safeImg(i.img) || (p ? imagesFor(p, i.color)[0] : ""); return u ? `<img src="${escAttr(u)}" alt="" width="54" height="72" loading="lazy">` : `<span class="svg">${art(p || { art: String(i.pid||"").replace(/^p_/, "") }, null, 54)}</span>`; }).join(""); }
VIEWS.orders = ()=>{
  const L = UI.orders;
  return `<section class="tsx-sec top narrow"><h1 class="tsx-h1">Đơn hàng của tôi</h1>
    ${L == null ? `<p class="tsx-note">Đang tải…</p>` : L.err ? `<p class="tsx-note">${esc(L.err)}</p>` : !L.length ? `<p class="tsx-empty">Chưa có đơn hàng. Ủng hộ TapEasy bằng một chiếc áo hoặc bình nước nhé!</p><button class="tsx-btn" data-sx="cat" data-id="new">Mua sắm</button>`
      : `<ul class="tsx-olist">${L.map(o=>{ const s = OST[o.status] || OST.pending; return `<li><button class="tsx-orow" data-sx="order" data-id="${escAttr(o.id)}">
        <span class="tsx-orow-h"><b>${esc(o.code)}</b><span class="tsx-st ${s[1]}">${esc(s[0])}</span></span>
        <span class="tsx-orow-im">${orderThumbs(o)}</span>
        <span class="tsx-orow-f"><small>${dmy(o.createdAt)} · ${arr(o.items).reduce((a,i)=> a + qtyOf(i), 0)} sản phẩm · ${o.payment === "bank" ? (o.payVia === "vietqr" ? "VietQR" : "Chuyển khoản") : "COD"}</small><b>${vnd(o.total)}</b></span></button></li>`; }).join("")}</ul>`}
  </section>`;
};
AFTER.orders = ()=>{
  if(UI.orders != null) return;
  cloudEvents.myOrders().then(L=>{ UI.orders = arr(L); }).catch(e=>{ UI.orders = { err: e && e.code === "auth" ? "Đăng nhập để xem đơn hàng." : (e && e.message) || "Không tải được đơn hàng." }; }).then(()=>{ if(UI.open && UI.view === "orders") render(true); });
};
VIEWS.order = prm=>{
  const o = UI._order && UI._order.id === prm.id ? UI._order : null;
  if(!o) return `<section class="tsx-sec top narrow"><p class="tsx-note">Đang tải đơn hàng…</p></section>`;
  const s = OST[o.status] || OST.pending, hist = arr(o.history), at = st=> (hist.find(h=> h.s === st) || {}).ts;
  const idx = o.status === "awaiting_payment" ? 0 : Math.max(0, FLOW.indexOf(o.status));
  const A = obj(o.address), mine = o.uid === (cloudEvents.me() || {}).uid;
  const steps = [["Đặt hàng", o.createdAt], ["Xác nhận", at("confirmed")], ["Đang giao", at("shipping")], ["Đã giao", at("delivered")]];
  return `<section class="tsx-sec top narrow">
    <p class="tsx-crumb">Đơn hàng</p><h1 class="tsx-h1">${esc(o.code)}</h1>
    <p><span class="tsx-st ${s[1]}">${esc(s[0])}</span> <small class="tsx-note">Đặt lúc ${hm(o.createdAt)} ${dmy(o.createdAt)}</small></p>
    ${o.status !== "cancelled" ? `<ol class="tsx-track" aria-label="Tiến trình đơn hàng">${steps.map(([l, tm], i)=>{ const done = i <= idx && (i === 0 || FLOW.indexOf(o.status) >= i); return `<li class="${done ? "done" : ""} ${i === idx ? "cur" : ""}"><i>${done ? svg("check") : ""}</i><b>${l}</b><small>${done && tm ? hm(tm) + " " + dmy(tm).slice(0, 5) : i === 0 ? "" : "—"}</small></li>`; }).join("")}</ol>`
      : `<p class="tsx-note">Đơn đã huỷ${at("cancelled") ? " lúc " + hm(at("cancelled")) + " " + dmy(at("cancelled")) : ""}.</p>`}
    ${o.status === "awaiting_payment" ? bankHTML(o) : ""}
    <ul class="tsx-mini big">${arr(o.items).map(i=>{ const p = prod(i.pid); const u = safeImg(i.img) || (p ? imagesFor(p, i.color)[0] : ""); return `<li><span class="im">${u ? `<img src="${escAttr(u)}" alt="" width="54" height="72" loading="lazy">` : art(p || {}, null, 54)}<i>${qtyOf(i)}</i></span><span class="tx"><b>${esc(i.name)}</b><small>${esc([i.colorName, i.size].filter(Boolean).join(" · "))}</small></span><b>${vnd((Number(i.price)||0)*qtyOf(i))}</b></li>`; }).join("")}</ul>
    ${sumHTML({ subtotal:o.subtotal||0, shipping:o.shipping||0, discount:o.discount||0, total:o.total||0 }, o.voucher, o.shipMethod)}
    <div class="tsx-rv"><div><h4>Giao tới</h4><p><b>${esc(A.name||"")}</b> · ${esc(A.phone||"")}<br>${esc(TapEv.addrText ? TapEv.addrText(A) : "")}${A.note ? `<br><small>${esc(A.note)}</small>` : ""}</p></div></div>
    <p class="tsx-note">${o.payment === "bank" ? (o.payVia === "vietqr" ? "Thanh toán: VietQR" : "Thanh toán: chuyển khoản") : "Thanh toán: COD (khi nhận hàng)"} · Hỗ trợ: ${esc(CFG.hotline)}</p>
    ${["pending","awaiting_payment"].includes(o.status) && mine ? `<button class="tsx-btn ghost block" data-sx="cancel" data-id="${escAttr(o.id)}">Huỷ đơn</button>` : ""}
    ${canOrdersEdit() && !mine ? `<label class="tsx-field"><span>Trạng thái (quản trị)</span>${ostSelect(o)}</label>` : ""}
  </section>`;
};
async function openOrder(id){
  let o = arr(UI.orders && !UI.orders.err ? UI.orders : []).find(x=> x.id === id) || (UI.lastOrder && UI.lastOrder.id === id ? UI.lastOrder : null);
  if(!o){ try{ o = arr(await cloudEvents.myOrders()).find(x=> x.id === id); }catch(e){} }
  if(!o && canOrders()){ try{ o = arr(await cloudEvents.allOrders()).find(x=> x.id === id); }catch(e){} }
  if(!o){ toast("Không tìm thấy đơn"); return; }
  UI._order = o; if(UI.view === "order" && UI.params.id === id) render(true); else nav("order", { id });
}
/* QC-07: huỷ đơn chưa xác nhận → "máy chủ" hoàn kho ĐÚNG 1 LẦN (cờ stockApplied) + hoàn lượt voucher; máy khách không tự cộng kho */
function cancelOrder(id){
  const o0 = UI._order && UI._order.id === id ? UI._order : null;
  confirmBox("Huỷ đơn hàng?", o0 && o0.voucher ? "Voucher của đơn sẽ được trả lại vào ví (nếu còn hạn)." : "Đơn chưa xác nhận sẽ được huỷ ngay.", "Huỷ đơn", async ()=>{
    try{ const o = await cloudEvents.cancelOrder(id);
      const code = (o && o.code) || (o0 && o0.code);
      if(o && o.voucherRestored && code){ SH().vouchers.forEach(v=>{ if(v.usedOrder === code){ v.used = false; delete v.usedOrder; if(v.src === "admin"){ v.claimId = ""; v.claimUntil = 0; } } }); save(); }
      toast("Đã huỷ đơn"); UI.orders = null; S.loaded = false; await load(); UI._order = Object.assign({}, UI._order, o || { status:"cancelled" }); render(true); }
    catch(e){ toast(e && e.message || "Không huỷ được"); }
  });
}

/* --- Tài khoản: điểm & voucher --- */
VIEWS.vouchers = ()=>{
  const bal = TapEv.points ? TapEv.points.balance() : 0, today = ds(new Date());
  const mine = SH().vouchers.slice().sort((a,b)=> (a.used - b.used) || String(b.exp).localeCompare(String(a.exp)));
  return `<section class="tsx-sec top narrow"><h1 class="tsx-h1">Voucher &amp; điểm</h1>
    <div class="tsx-bal"><span>Điểm TapEasy</span><b>${nf(bal)}</b><small>Kiếm điểm: hoàn thành thử thách, điểm danh sự kiện, viết review.</small></div>
    <h2 class="tsx-h2">Đổi điểm</h2>
    <ul class="tsx-rd">${REDEEM.map(r=> `<li class="${bal >= r.cost ? "" : "lock"}"><span><b>${esc(r.title)}</b><small>${esc(r.sub)} · HSD 60 ngày</small></span><button class="tsx-btn sm ${bal >= r.cost ? "" : "ghost"}" data-sx="redeem" data-id="${r.id}" ${bal >= r.cost ? "" : "disabled"}>${nf(r.cost)} điểm</button></li>`).join("")}</ul>
    ${mine.length ? `<h2 class="tsx-h2">Voucher của tôi</h2><ul class="tsx-vmine">${mine.map(v=>{ const exp = v.exp && v.exp < today; return `<li class="${v.used || exp ? "dim" : ""}"><b>${esc(v.title)}</b><code>${esc(v.code)}</code><small>${esc(v.sub||"")} · ${v.used ? "Đã dùng" + (v.usedOrder ? " (" + esc(v.usedOrder) + ")" : "") : exp ? "Hết hạn" : "HSD " + esc(String(v.exp||"").split("-").reverse().join("/"))}</small></li>`; }).join("")}</ul>` : ""}
    <p class="tsx-note">Mỗi đơn dùng 1 voucher. Điểm đã đổi không hoàn lại.</p>
  </section>`;
};
VIEWS.account = ()=> `<section class="tsx-sec top narrow"><h1 class="tsx-h1">Tài khoản</h1>
    <ul class="tsx-links"><li><button data-sx="orders">Đơn hàng của tôi ${svg("chev")}</button></li><li><button data-sx="vouchers">Voucher &amp; Điểm TapEasy ${svg("chev")}</button></li>
    <li><button data-sx="cart">Giỏ hàng (${cartCount()}) ${svg("chev")}</button></li><li><button data-sx="guide" data-id="top">Hướng dẫn chọn size ${svg("chev")}</button></li>
    ${canAdmin() ? `<li><button data-sx="admin" data-id="products">Quản trị cửa hàng ${svg("chev")}</button></li>` : ""}
    <li><button data-sx="exit">Quay lại app TapEasy ${svg("chev")}</button></li></ul></section>`;
function redeem(id){
  const r = REDEEM.find(x=> x.id === id); if(!r || !TapEv.points) return;
  confirmBox(`Đổi ${nf(r.cost)} điểm?`, `Nhận voucher “${r.title}” (${r.sub}), hạn dùng 60 ngày.`, "Đổi điểm", ()=> redeemNow(r));
}
async function redeemNow(r){
  if(!r || !TapEv.points) return;
  {
    /* QC-02 (Firebase): sổ điểm + voucher do máy chủ giữ — callable redeemPoints trừ điểm trong transaction và tạo vouchers/{code} 1 lượt */
    if(cloudEvents.mode === "firebase"){
      let sv = null;
      try{ sv = typeof cloudEvents.redeemPoints === "function" ? await cloudEvents.redeemPoints(r.id) : null; }catch(e){ toast(e && e.message || "Không đổi được điểm"); return; }
      if(!sv || !sv.code){ toast("Đổi điểm tạm khoá — máy chủ chưa sẵn sàng. Điểm của bạn vẫn giữ nguyên."); return; }
      /* voucher + số dư hiển thị lưu CÙNG một lần (Points.add lưu cả state) */
      const v = grantVoucher({ kind:r.kind, value:r.value, min:r.min, max:r.max, title:r.title, sub:r.sub, src:"points", ref:"redeem_" + sv.code, code: sv.code, exp: sv.exp, server:true }, { noSave:true });
      const ok = TapEv.points.add(-r.cost, `Đổi voucher: ${r.title}`, "redeem_" + sv.code) || (v && save());
      if(!ok){ if(v) SH().vouchers = SH().vouchers.filter(x=> x !== v);
        toast(`Máy chủ đã cấp voucher ${sv.code} nhưng bộ nhớ máy đầy — ghi lại mã này và nhập ở bước thanh toán.`); render(true); return; }
      toast(`Đã nhận voucher ${v ? v.code : sv.code}`); render(true); try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){}
      return;
    }
    const ref = "redeem_" + r.id + "_" + Date.now();
    if(TapEv.points.balance() < r.cost){ toast("Không đủ điểm"); return; }
    /* QC-11: thêm voucher vào bộ nhớ, rồi trừ điểm — Points.add lưu CẢ HAI trong một lần ghi; lưu lỗi → hoàn tác voucher, điểm giữ nguyên */
    const v = grantVoucher({ kind:r.kind, value:r.value, min:r.min, max:r.max, title:r.title, sub:r.sub, src:"points", ref }, { noSave:true });
    if(!TapEv.points.add(-r.cost, `Đổi voucher: ${r.title}`, ref)){
      if(v) SH().vouchers = SH().vouchers.filter(x=> x !== v);
      toast(TapEv.points.balance() < r.cost ? "Không đủ điểm" : FULL_MSG); render(true); return; }
    toast(`Đã nhận voucher ${v ? v.code : ""}`); render(true); try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){}
  }
}

/* ---------------------------------------------------------------------
   5. QUẢN TRỊ (sản phẩm · đơn hàng)
   --------------------------------------------------------------------- */
VIEWS.admin = prm=>{
  if(!canAdmin()) return `<div class="tsx-pad"><p class="tsx-note">Bạn chưa có quyền quản trị cửa hàng.</p></div>`;
  const tab = prm.id === "orders" || !canProducts() ? "orders" : "products";
  const tabs = `<div class="tsx-chips">${canProducts() ? `<button class="${tab === "products" ? "on" : ""}" data-sx="admin" data-id="products">Sản phẩm</button>` : ""}${canOrders() ? `<button class="${tab === "orders" ? "on" : ""}" data-sx="admin" data-id="orders">Đơn hàng</button>` : ""}</div>`;
  if(tab === "products"){
    const L = S.products.filter(p=> !p.deleted), SS = storeState();
    return `<section class="tsx-sec top"><h1 class="tsx-h1">Quản trị cửa hàng</h1>${tabs}
      <p class="tsx-note tsx-live ${SS.live ? "on" : ""}" role="status">${SS.demo ? "Chế độ phát triển: danh mục MẪU đang được coi như hàng thật (TAPEASY_SHOP_CONFIG.demoCatalog)." : SS.live ? `Cửa hàng ĐANG MỞ BÁN · ${SS.real} sản phẩm thật.` : SS.real ? `Cửa hàng CHƯA mở bán (${SS.real} sản phẩm thật đã sẵn sàng) — khách đang thấy màn “Chưa có sản phẩm nào mở bán”. Bật “Mở bán” trong Bảng quản trị → Cửa hàng.` : "Chưa có sản phẩm thật. Sản phẩm gắn nhãn MẪU không hiện cho khách: bấm Sửa → Lưu để dùng làm hàng thật, hoặc Thêm sản phẩm."}</p>
      <div class="tsx-row2 left"><button class="tsx-btn sm" data-sx="a-edit" data-id="">${svg("plus")}Thêm sản phẩm</button>${S.pendingSync ? `<button class="tsx-btn sm ghost" data-sx="a-sync">Đồng bộ ${S.pendingSync} sản phẩm mẫu lên máy chủ</button>` : ""}</div>
      ${cloudEvents.mode === "firebase" ? `<p class="tsx-note">Firebase: quyền ghi thật do <code>admins/{uid}</code> + rules quyết định.</p>` : ""}
      <table class="tsx-atbl"><thead><tr><th scope="col">Sản phẩm</th><th scope="col">Giá</th><th scope="col">Tồn</th><th scope="col"></th></tr></thead><tbody>
      ${L.map(p=>{ const im = imagesFor(p, (arr(p.colors)[0]||{}).id)[0]; const ts = totalStock(p); return `<tr class="${p.hidden ? "dim" : ""}"><td><span class="tsx-at">${im ? `<img src="${escAttr(im)}" alt="" width="42" height="56" loading="lazy">` : art(p, (arr(p.colors)[0]||{}).hex, 42)}<span><b>${esc(p.name)}</b><small>${esc(p.id)}${p.demo === true ? " · MẪU (khách không thấy)" : ""}${p.hidden ? " · ẩn" : ""}${p._virtual ? " · chưa đồng bộ" : ""}${p.edited ? " · đã sửa" : ""}</small></span></span></td>
        <td>${vnd(p.price)}</td><td class="${ts <= 5 ? "low" : ""}">${nf(ts)}</td><td><button class="tsx-ul sm" data-sx="a-edit" data-id="${escAttr(p.id)}">Sửa</button></td></tr>`; }).join("")}
      </tbody></table></section>`;
  }
  const L = UI.adm.list;
  const F = UI.adm.ost, list = arr(L).filter(o=> F === "all" || o.status === F);
  const live = arr(L).filter(o=> o.status !== "cancelled"), done = arr(L).filter(o=> o.status === "delivered");
  const rev = live.reduce((a,o)=> a + (o.total||0), 0), revDone = done.reduce((a,o)=> a + (o.total||0), 0);
  return `<section class="tsx-sec top"><h1 class="tsx-h1">Quản trị cửa hàng</h1>${tabs}
    ${L == null ? `<p class="tsx-note">Đang tải đơn hàng…</p>` : L.err ? `<p class="tsx-err">${esc(L.err)}</p>` : `
    <div class="tsx-stats"><div><b>${nf(live.length)}</b><span>Đơn (trừ huỷ)</span></div><div><b>${vnd(rev)}</b><span>Doanh thu đặt</span></div><div><b>${vnd(revDone * gfp() / 100)}</b><span>Quỹ quà (${gfp()}% đã giao)</span></div></div>
    <div class="tsx-tools"><div class="tsx-chips sm">${[["all","Tất cả"]].concat(Object.keys(OST).map(k=> [k, OST[k][0]])).map(([k, l])=> `<button class="${F === k ? "on" : ""}" data-sx="a-ost" data-id="${k}">${esc(l)} (${k === "all" ? arr(L).length : arr(L).filter(o=> o.status === k).length})</button>`).join("")}</div>
      ${canExport() ? `<button class="tsx-btn sm ghost" data-sx="a-csv">Xuất CSV</button>` : ""}</div>
    <table class="tsx-atbl"><thead><tr><th scope="col">Đơn</th><th scope="col">Khách</th><th scope="col">Tổng</th><th scope="col">Trạng thái</th></tr></thead><tbody>
    ${list.slice(0, 200).map(o=> `<tr><td><button class="tsx-ul sm" data-sx="order" data-id="${escAttr(o.id)}">${esc(o.code)}</button><small>${dmy(o.createdAt)} · ${o.payment === "bank" ? (o.payVia === "vietqr" ? "VietQR" : "CK") : "COD"}${o.shipMethod === "express" ? " · hoả tốc" : ""}</small></td>
      <td>${esc(obj(o.address).name||"")}<small>${esc(obj(o.address).phone||"")} · ${esc(obj(o.address).province||"")}</small></td><td>${vnd(o.total)}</td>
      <td>${canOrdersEdit() ? ostSelect(o) : `<span class="tsx-st ${(OST[o.status]||OST.pending)[1]}">${esc((OST[o.status]||OST.pending)[0])}</span>`}</td></tr>`).join("") || `<tr><td colspan="4">Chưa có đơn.</td></tr>`}
    </tbody></table>`}
  </section>`;
};
AFTER.admin = prm=>{
  if((prm.id === "orders" || !canProducts()) && UI.adm.list == null){
    cloudEvents.allOrders().then(L=>{ UI.adm.list = arr(L); }).catch(e=>{ UI.adm.list = { err: (e && e.message) || "Không tải được đơn" }; }).then(()=>{ if(UI.open && UI.view === "admin") render(true); });
  }
};
/* --- Form sản phẩm (ảnh tải lên được nén, tồn kho theo màu × size) --- */
function editDraft(id){
  const p0 = id ? prod(id) : null;
  const d = clone(Object.assign({ name:"", short:"", type:"", cat:"gear", gender:"acc", price:99000, compareAt:0, colors:[{ id:"black", name:"Đen", hex:"#1C1D1F" }], sizes:[], stockBy:{}, badge:"", isNew:false, material:"", care:"", desc:"", fit:"", sizeChart:"", hidden:false, rank:50 },
    p0 ? Object.assign({}, p0, { _virtual: undefined }) : {}));
  if(!d.stockBy || typeof d.stockBy !== "object"){ d.stockBy = {}; arr(d.colors).forEach(c=>{ (arr(d.sizes).length ? d.sizes : [""]).forEach(z=>{ d.stockBy[VK(c.id, z)] = Math.floor((Number(p0 && p0.stock)||0) / Math.max(1, arr(d.colors).length * Math.max(1, arr(d.sizes).length))); }); }); }
  d.colors = arr(d.colors).map(c=> Object.assign({ images:[] }, c, { images: arr(c.images).filter(safeImg) }));
  return { id: p0 ? p0.id : "", d };
}
VIEWS["admin-edit"] = ()=>{
  if(!canProducts()) return `<div class="tsx-pad"><p class="tsx-note">Bạn chưa có quyền sửa sản phẩm.</p></div>`;
  const E = UI.edit; if(!E) return `<div class="tsx-pad"><p class="tsx-note">Không có sản phẩm.</p></div>`;
  const d = E.d, sizes = arr(d.sizes), zs = sizes.length ? sizes : [""], charts = Object.keys(obj(D().sizeCharts));
  const f = (id, label, val, attrs)=> `<label class="tsx-field"><span>${label}</span><input id="${id}" value="${escAttr(val == null ? "" : val)}" ${attrs||""}></label>`;
  const gen = genSet(d.slug || "___");
  return `<section class="tsx-sec top narrow"><p class="tsx-crumb"><button class="tsx-ul sm" data-sx="admin" data-id="products">Quản trị</button> / ${E.id ? "Sửa" : "Thêm"} sản phẩm</p>
    <h1 class="tsx-h1">${esc(d.name || "Sản phẩm mới")}</h1>
    <div class="tsx-form adm">
      ${f("pf-name", "Tên sản phẩm", d.name, 'maxlength="80"')}${f("pf-short", "Mô tả ngắn", d.short, 'maxlength="80"')}
      <div class="tsx-f3">${f("pf-price", "Giá (₫)", d.price, 'type="number" min="1000" step="1000" inputmode="numeric"')}${f("pf-cmp", "Giá gốc gạch (₫)", d.compareAt || "", 'type="number" min="0" step="1000" inputmode="numeric"')}${f("pf-rank", "Thứ tự nổi bật", d.rank, 'type="number" min="1" max="999"')}</div>
      <div class="tsx-f3">
        <label class="tsx-field"><span>Nhóm</span><select id="pf-gender">${[["men","Nam"],["women","Nữ"],["unisex","Nam & Nữ"],["acc","Phụ kiện"]].map(([k,l])=> `<option value="${k}" ${genderOf(d) === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${f("pf-type", "Loại (Áo, Quần, Mũ…)", d.type, 'maxlength="24"')}
        <label class="tsx-field"><span>Bảng size</span><select id="pf-chart"><option value="">— Không —</option>${charts.map(k=> `<option value="${k}" ${d.sizeChart === k ? "selected" : ""}>${esc(D().sizeCharts[k].title)}</option>`).join("")}</select></label>
      </div>
      ${f("pf-sizes", "Size (cách nhau dấu phẩy; để trống nếu không có)", sizes.join(", "), 'data-sx-resize="1"')}
      <h2 class="tsx-h2">Màu, ảnh &amp; tồn kho</h2>
      <p class="tsx-note">Ảnh tự cắt 3:4, nén WebP/JPEG ≤ ~150 KB (tối đa 3 ảnh/màu). Không tải ảnh → dùng ảnh mẫu (nếu có) hoặc hình minh hoạ.</p>
      ${d.colors.map((c, ci)=> `<div class="tsx-acol">
        <div class="tsx-f3"><label class="tsx-field"><span>Tên màu</span><input id="pc-name-${ci}" value="${escAttr(c.name)}" maxlength="24"></label>
          <label class="tsx-field"><span>Mã màu</span><input id="pc-hex-${ci}" type="color" value="${escAttr(isHex(c.hex) ? c.hex : "#1C1D1F")}"></label>
          <div class="tsx-field"><span>&nbsp;</span>${d.colors.length > 1 ? `<button class="tsx-ul sm" data-sx="a-color-rm" data-id="${ci}">Xoá màu</button>` : ""}</div></div>
        <div class="tsx-aimgs">${arr(c.images).map((u, ii)=> `<span><img src="${escAttr(u)}" alt="" width="60" height="80"><button class="tsx-ib sm" data-sx="a-img-rm" data-id="${ci}" data-v="${ii}" aria-label="Xoá ảnh">${svg("close")}</button></span>`).join("")}
          ${!arr(c.images).length && gen.has(c.id) ? `<span class="gen"><img src="${escAttr(imagesFor(d, c.id)[0])}" alt="" width="60" height="80"><small>ảnh mẫu</small></span>` : ""}
          ${arr(c.images).length < 3 ? `<label class="tsx-up">${svg("plus")}<span>Tải ảnh</span><input type="file" accept="image/*" multiple data-sx-file="${ci}" hidden></label>` : ""}</div>
        <div class="tsx-stk">${zs.map(z=> `<label><span>${esc(z || "Tồn kho")}</span><input type="number" min="0" max="9999" inputmode="numeric" id="ps-${ci}-${escAttr(z)}" value="${escAttr(Number(d.stockBy[VK(c.id, z)])||0)}"></label>`).join("")}</div>
      </div>`).join("")}
      <button class="tsx-btn sm ghost" data-sx="a-color-add">${svg("plus")}Thêm màu</button>
      <h2 class="tsx-h2">Nội dung</h2>
      ${f("pf-badge", "Nhãn (VD: Bán chạy)", d.badge, 'maxlength="14"')}
      <label class="tsx-check"><input type="checkbox" id="pf-new" ${d.isNew ? "checked" : ""}><span>Hiện trong mục MỚI</span></label>
      ${f("pf-fit", "Dáng / gợi ý size", d.fit, 'maxlength="160"')}
      <label class="tsx-field"><span>Mô tả</span><textarea id="pf-desc" rows="3" maxlength="600">${esc(d.desc||"")}</textarea></label>
      <label class="tsx-field"><span>Chất liệu</span><textarea id="pf-mat" rows="2" maxlength="400">${esc(d.material||"")}</textarea></label>
      ${f("pf-care", "Bảo quản", d.care, 'maxlength="200"')}
      <label class="tsx-check"><input type="checkbox" id="pf-hidden" ${d.hidden ? "checked" : ""}><span>Ẩn sản phẩm khỏi cửa hàng</span></label>
      <div class="tsx-row2"><button class="tsx-btn" data-sx="a-save">Lưu sản phẩm</button>${E.id ? `<button class="tsx-btn ghost" data-sx="a-del">Xoá</button>` : ""}</div>
    </div></section>`;
};
function readForm(){
  const E = UI.edit; if(!E || !q("#pf-name")) return;
  const d = E.d, v = s=> String((q(s)||{}).value||"").trim();
  Object.assign(d, { name:v("#pf-name"), short:v("#pf-short"), price:Math.round(Number(v("#pf-price"))||0), compareAt:Math.round(Number(v("#pf-cmp"))||0), rank:Math.round(Number(v("#pf-rank"))||50),
    gender:v("#pf-gender"), type:v("#pf-type"), sizeChart:v("#pf-chart"), badge:v("#pf-badge"), fit:v("#pf-fit"), desc:v("#pf-desc"), material:v("#pf-mat"), care:v("#pf-care"),
    isNew: !!(q("#pf-new")||{}).checked, hidden: !!(q("#pf-hidden")||{}).checked });
  d.cat = d.gender === "acc" ? (d.cat === "souvenir" ? "souvenir" : (d.cat === "wear" ? "wear" : "gear")) : "wear";
  const oldSizes = arr(d.sizes);
  d.sizes = v("#pf-sizes").split(",").map(s=> s.trim()).filter(Boolean).slice(0, 12);
  const sb = {};
  d.colors.forEach((c, ci)=>{
    const nm = v("#pc-name-" + ci); if(nm) c.name = nm;
    const hx = v("#pc-hex-" + ci); if(isHex(hx)) c.hex = hx;
    if(!c.id) c.id = (ascii(c.name).toLowerCase().replace(/\s+/g, "-").slice(0, 20) || "c") + (d.colors.some((x, j)=> j !== ci && x.id === ascii(c.name).toLowerCase().replace(/\s+/g, "-").slice(0, 20)) ? "-" + ci : "");
    (oldSizes.length ? oldSizes : [""]).forEach(z=>{ const inp = q(`#ps-${ci}-${CSS.escape(z)}`); if(inp) sb[VK(c.id, z)] = Math.max(0, Math.round(Number(inp.value)||0)); });
  });
  const nb = {}; d.colors.forEach(c=> (d.sizes.length ? d.sizes : [""]).forEach(z=>{ const k = VK(c.id, z); nb[k] = k in sb ? sb[k] : (Number(d.stockBy[k])||0); }));
  d.stockBy = nb;
}
async function saveEdit(){
  readForm(); const E = UI.edit, d = E.d;
  const err = d.name.length < 3 ? "Tên sản phẩm quá ngắn" : !(d.price >= 1000) ? "Giá tối thiểu 1.000 ₫" : d.price > 100000000 ? "Giá tối đa 100.000.000 ₫" : (d.compareAt && d.compareAt < d.price) ? "Giá gốc gạch phải lớn hơn giá bán (hoặc để trống)" : !d.colors.length ? "Cần ít nhất 1 màu" : "";
  if(err){ toast(err); return; }
  const bytes = JSON.stringify(d.colors.map(c=> c.images)).length;
  if(cloudEvents.mode === "firebase" && bytes > 850000){ toast("Ảnh quá nặng cho 1 sản phẩm (> 850 KB) — bớt ảnh hoặc dùng Firebase Storage"); return; }
  const data = Object.assign({}, d, { id: E.id || undefined, stock: sum(d.stockBy), edited: true, demo: false, catalogV: (catalogData() || {}).version || 0 });   // R3: quản trị lưu = hàng thật
  delete data._virtual;
  try{ const r = await cloudEvents.saveProduct(data); toast("Đã lưu sản phẩm"); await load(true); UI.edit = null; UI.stack.pop(); nav("admin", { id:"products" }, false); return r; }
  catch(e){ toast(e && e.message || "Không lưu được"); }
}
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
function compressPhoto(file){
  return new Promise((resolve, reject)=>{
    if(!file || !/^image\/(jpeg|png|webp|heic|heif|gif|bmp)$/i.test(file.type)) return reject(new Error("Chỉ nhận ảnh JPG, PNG, WebP hoặc HEIC"));   // R3-ADMIN-06: không nhận SVG / tệp lạ
    if(file.size > PHOTO_MAX_BYTES) return reject(new Error("Ảnh quá lớn (tối đa 15 MB)"));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{ try{
      const W = 900, H = 1200, r = 3/4, iw = img.naturalWidth, ih = img.naturalHeight;
      let sw = iw, sh = ih; if(iw / ih > r) sw = ih * r; else sh = iw / r;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
      cx.fillStyle = "#EEEDEA"; cx.fillRect(0, 0, W, H); cx.drawImage(img, (iw - sw)/2, (ih - sh)/2, sw, sh, 0, 0, W, H);
      let qv = 0.82, type = "image/webp", out = cv.toDataURL(type, qv);
      if(!/^data:image\/webp/.test(out)){ type = "image/jpeg"; out = cv.toDataURL(type, qv); }
      while(out.length > 200000 && qv > 0.42){ qv -= 0.08; out = cv.toDataURL(type, qv); }
      URL.revokeObjectURL(url); resolve(out);
    }catch(e){ URL.revokeObjectURL(url); reject(e); } };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
    img.src = url;
  });
}
function exportCSV(list){
  if(!TapEv.toCSV || !TapEv.downloadFile){ toast("Thiếu tiện ích CSV (events.js)"); return; }
  TapEv.downloadFile("don-hang.csv", TapEv.toCSV(list, [{label:"Mã đơn",key:"code"},{label:"Ngày",get:o=> new Date(o.createdAt||0).toLocaleString("vi-VN")},{label:"Người nhận",get:o=> obj(o.address).name},{label:"SĐT",get:o=> obj(o.address).phone},
    {label:"Địa chỉ",get:o=> TapEv.addrText ? TapEv.addrText(obj(o.address)) : ""},{label:"Sản phẩm",get:o=> arr(o.items).map(i=> `${qtyOf(i)}x ${i.name}${i.size ? " " + i.size : ""}${i.colorName ? " " + i.colorName : ""}`).join("; ")},
    {label:"Tạm tính",key:"subtotal"},{label:"Ship",key:"shipping"},{label:"Giao",get:o=> o.shipMethod === "express" ? "Hoả tốc" : "Tiêu chuẩn"},{label:"Giảm",key:"discount"},{label:"Tổng",key:"total"},
    {label:"Thanh toán",get:o=> o.payment === "bank" ? (o.payVia === "vietqr" ? "VietQR" : "Chuyển khoản") : "COD"},{label:"Trạng thái",get:o=> (OST[o.status]||OST.pending)[0]},{label:"Ghi chú",key:"note"}]), "text/csv;charset=utf-8");
}
async function setOrderStatus(id, st){
  try{
    const o = await cloudEvents.updateOrder(id, { status: st });          // tồn kho: máy chủ tự hoàn/trừ theo cờ stockApplied (QC-07)
    toast("Đã cập nhật: " + (OST[st]||[st])[0]);
    if(Array.isArray(UI.adm.list)){ const i = UI.adm.list.findIndex(x=> x.id === id); if(i >= 0) UI.adm.list[i] = Object.assign({}, UI.adm.list[i], o || { status: st }); }
    if(UI._order && UI._order.id === id) UI._order = Object.assign({}, UI._order, o || { status: st });
    S.loaded = false; load().then(()=> render(true));
  }catch(e){ toast(e && e.message || "Không cập nhật được"); }
}

/* ---------------------------------------------------------------------
   6. SỰ KIỆN GIAO DIỆN (uỷ quyền)
   --------------------------------------------------------------------- */
const ACT = {
  home: ()=>{ UI.stack = []; nav("home", {}, false); },
  exit: ()=> exitStore(),
  back: ()=> back(),
  cat: id=>{ UI.type = ""; nav("list", { cat:id || "all" }); },
  type: id=>{ UI.type = id || ""; render(true); },
  hero: id=>{ const tr = q("#tsx-hero"); if(tr) tr.scrollTo({ left: Number(id) * tr.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" }); },
  search: ()=> nav("search", {}),
  q: id=>{ UI.q = id; render(true); },
  account: ()=> nav("account", {}),
  p: id=> nav("product", { id }),
  color: (id, el)=>{ const p = prod(id); if(!p) return; const s = selFor(p); s.color = el.dataset.v; if(s.size && stockOf(p, s.color, s.size) <= 0) s.size = ""; render(true); const g = q("#tsx-gal"); if(g) g.scrollLeft = 0; },
  size: (id, el)=>{ const p = prod(id); if(!p) return; if(el.getAttribute("aria-disabled") === "true"){ toast("Size " + el.dataset.v + " đã hết hàng màu này"); return; } selFor(p).size = el.dataset.v; render(true); },
  add: id=> addToCart(id),
  guide: (id, el)=> openLayer("guide", { id: id || "top", pid: el && el.dataset.p || "" }),
  info: id=> openLayer("info", { id }),
  cart: ()=>{ UI.added = null; openLayer("cart"); },
  "close-layer": ()=>{ closeLayer(); if(["list","home","product"].includes(UI.view)) render(true); },
  qty: (key, el)=> changeQty(key, Number(el.dataset.v)),
  rm: key=>{ const sh = SH(); sh.cart = sh.cart.filter(x=> x.key !== key); save(); UI.added = null; try{ TapEv.refreshBadges && TapEv.refreshBadges(); }catch(e){} render(true); },
  voucher: id=>{ _voucherId = id; renderLayer(); },
  vcode: ()=> applyVoucherCode(),
  checkout: ()=>{ if(!cartLines().length) return; closeLayer(true); nav("checkout", { step:1 }); },
  "ck-next": id=> ckNext(Number(id)),
  "ck-step": id=>{ toastOff(); UI.params = { step:Number(id) }; render(); root.scrollTop = 0; },
  ship: id=>{ SH().ship = id; save(); qa("[data-sx=ship]").forEach(b=>{ const on = b.dataset.id === id; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); const lines = cartLines(); const t = totals(lines, pickedVoucher(), shipCfg(id)); const s = q(".tsx-ck-sum"); if(s) s.outerHTML = ckSummary(t, pickedVoucher(), id); },
  pay: id=>{ if(id !== "cod" && !bankReady()) id = "cod"; SH().pay = id; save(); qa("[data-sx=pay]").forEach(b=>{ const on = b.dataset.id === id; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); },
  place: ()=> confirmOrder(),
  orders: ()=>{ UI.orders = null; closeLayer(true); nav("orders", {}); },
  order: id=> openOrder(id),
  cancel: id=> cancelOrder(id),
  vouchers: ()=>{ closeLayer(true); nav("vouchers", {}); },
  redeem: id=> redeem(id),
  copy: async v=>{ try{ await navigator.clipboard.writeText(v); toast("Đã sao chép"); }catch(e){ toast("Không sao chép được — hãy chép tay"); } },
  login: ()=>{ exitStore(); try{ showAuth("login"); }catch(e){} },
  admin: id=>{ if(id === "orders") UI.adm.list = null; nav("admin", { id: id || "products" }, UI.view !== "admin"); },
  "a-edit": id=>{ UI.edit = editDraft(id); nav("admin-edit", { id: id || "new" }); },
  "a-color-add": ()=>{ readForm(); UI.edit.d.colors.push({ id:"", name:"Màu mới", hex:"#8C8F93", images:[] }); render(true); },
  "a-color-rm": id=>{ readForm(); UI.edit.d.colors.splice(Number(id), 1); render(true); },
  "a-img-rm": (id, el)=>{ readForm(); const c = UI.edit.d.colors[Number(id)]; if(c) c.images.splice(Number(el.dataset.v), 1); render(true); },
  "a-save": ()=> saveEdit(),
  "a-del": ()=>{ const E = UI.edit; if(!E || !E.id) return; confirmBox("Xoá sản phẩm?", "Đơn hàng cũ vẫn giữ tên sản phẩm. Sản phẩm mẫu bị xoá sẽ không tự hiện lại.", "Xoá", async ()=>{
      try{ const isCat = arr((catalogData()||{}).products).some(p=> p.id === E.id);
        if(isCat){ const c = Object.assign({}, prod(E.id) || {}, { id:E.id, deleted:true, hidden:true, edited:true }); delete c._virtual; await cloudEvents.saveProduct(c); } else await cloudEvents.deleteProduct(E.id);
        await load(true); UI.edit = null; toast("Đã xoá"); UI.stack.pop(); nav("admin", { id:"products" }, false); }catch(e){ toast(e && e.message || "Không xoá được"); } }); },
  "a-sync": async ()=>{ const L = S.products.filter(p=> p._virtual || p.catalogV !== (catalogData()||{}).version); let n = 0;
    for(const p of L){ try{ const c = Object.assign({}, p); delete c._virtual; await cloudEvents.saveProduct(c); n++; }catch(e){ toast(e && e.message || "Lỗi đồng bộ"); break; } }
    toast(`Đã đồng bộ ${n} sản phẩm`); await load(true); render(true); },
  "a-ost": id=>{ UI.adm.ost = id; render(true); },
  "soon-notify": ()=>{ const on = !notifyOn(); if(!setNotify(on)) return; render(true);
    try{ const b = q('[data-sx="soon-notify"]'); if(b) b.focus({ preventScroll:true }); }catch(e){}
    toast(on ? "Đã bật — TapEasy sẽ báo khi cửa hàng mở bán" : "Đã tắt thông báo mở bán"); },
  "a-csv": ()=> exportCSV(arr(UI.adm.list)),
};
function onClick(e){
  const el = e.target.closest && e.target.closest("[data-sx]"); if(!el || !root.contains(el)) return;
  if(el.classList.contains("tsx-tile") && Number(el.dataset.lp || 0) > Date.now() - 600){ e.preventDefault(); return; }
  const fn = ACT[el.dataset.sx]; if(!fn) return;
  e.preventDefault();
  try{ const r = fn(el.dataset.id, el, e); if(r && r.catch) r.catch(err=>{ warn(err); toast(err && err.message || "Có lỗi xảy ra"); }); }catch(err){ warn(err); toast("Có lỗi xảy ra"); }
}
function onChange(e){
  const t = e.target;
  if(t.matches("[data-sx-sort]")){ UI.sort = t.value; render(true); return; }
  if(t.matches("[data-sx-size]")){ changeSize(t.dataset.sxSize, t.value); return; }
  if(t.matches("[data-sx-ost]")){ setOrderStatus(t.dataset.sxOst, t.value); return; }
  if(t.matches("[data-sx-resize]")){ readForm(); render(true); return; }
  if(t.matches("[data-sx-file]")){
    readForm(); const c = UI.edit && UI.edit.d.colors[Number(t.dataset.sxFile)]; if(!c) return;
    const files = Array.from(t.files || []).slice(0, 3 - arr(c.images).length);
    Promise.all(files.map(f=> compressPhoto(f).catch(err=>{ toast(err.message); return ""; }))).then(list=>{ c.images = arr(c.images).concat(list.filter(Boolean)).slice(0, 3); render(true); toast(`Đã thêm ${list.filter(Boolean).length} ảnh`); });
  }
}
function onInput(e){
  const t = e.target;
  if(t.id === "tsx-q"){ UI.q = t.value; clearTimeout(onInput._t); onInput._t = setTimeout(()=>{ const box = q("#tsx-sres"), k = ascii(UI.q).toLowerCase();
    const res = k ? visible().filter(p=> ascii([p.name, p.type, p.short, arr(p.colors).map(c=> c.name).join(" ")].join(" ")).toLowerCase().includes(k)) : [];
    if(box) box.innerHTML = k ? (res.length ? `<p class="tsx-count">${res.length} kết quả</p><div class="tsx-grid">${res.map(p=> tileHTML(p)).join("")}</div>` : `<p class="tsx-empty">Không tìm thấy sản phẩm phù hợp.</p>`) : ""; }, 160); }
}
/* Chạm giữ (cảm ứng) hoặc rê chuột → ảnh thứ hai */
function bindPress(){
  let lp = null;
  const showAlt = (t, on)=>{ const b = q("img.b", t); if(!b) return; if(on && !b.src && b.dataset.src) b.src = b.dataset.src; t.classList.toggle("alt", !!on); };
  root.addEventListener("pointerdown", e=>{
    const t = e.target.closest && e.target.closest(".tsx-tile"); if(!t || e.pointerType === "mouse") return;
    const b = q("img.b", t); if(b && !b.src && b.dataset.src) b.src = b.dataset.src;   // nạp trước
    lp = { t, x:e.clientX, y:e.clientY, fired:false };
    lp.timer = setTimeout(()=>{ if(!lp) return; lp.fired = true; showAlt(t, true); t.dataset.lp = String(Date.now()); try{ navigator.vibrate && navigator.vibrate(8); }catch(_){} }, 320);
  }, { passive:true });
  root.addEventListener("pointermove", e=>{ if(lp && !lp.fired && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10){ clearTimeout(lp.timer); lp = null; } }, { passive:true });
  const end = ()=>{ if(!lp) return; clearTimeout(lp.timer); if(lp.fired){ const t = lp.t; t.dataset.lp = String(Date.now()); setTimeout(()=> showAlt(t, false), 120); } lp = null; };
  root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
  root.addEventListener("contextmenu", e=>{ if(e.target.closest && e.target.closest(".tsx-tile")) e.preventDefault(); });
  root.addEventListener("mouseover", e=>{ const t = e.target.closest && e.target.closest(".tsx-tile"); if(t && !t.contains(e.relatedTarget)) showAlt(t, true); });
  root.addEventListener("mouseout", e=>{ const t = e.target.closest && e.target.closest(".tsx-tile"); if(t && !t.contains(e.relatedTarget)) showAlt(t, false); });
  root.addEventListener("focusin", e=>{ const t = e.target.closest && e.target.closest(".tsx-tile"); if(t) showAlt(t, true); });
  root.addEventListener("focusout", e=>{ const t = e.target.closest && e.target.closest(".tsx-tile"); if(t) showAlt(t, false); });
}
document.addEventListener("keydown", e=>{ if(!UI.open || e.key !== "Escape") return; e.preventDefault(); back(); });

/* ---------------------------------------------------------------------
   7. TÍCH HỢP VỚI APP / events.js
   --------------------------------------------------------------------- */
TapShop.open = (view, params)=> openStore(view || "home", params || {});
TapShop.openCart = ()=> openStore(UI.open ? UI.view : "home", UI.open ? UI.params : {}, { layer:"cart" });
TapShop.openOrders = ()=>{ UI.orders = null; openStore("orders", {}); };
TapShop.openRedeem = ()=> openStore("vouchers", {});
TapShop.openProduct = id=> openStore("product", { id });
TapShop.close = exitStore;
TapShop.isOpen = ()=> UI.open;
TapShop._ui = UI; TapShop._S = S; TapShop._act = ACT; TapShop.reload = ()=> load(true).then(()=> render(true));
/* kiểm thử (tests/suites/64-fix-commerce.test.js) */
TapShop.refresh = ()=>{ return load(true).then(()=>{ announceOpen(); if(UI.open) render(true); try{ TapEv.render && TapEv.render(); }catch(e){} return storeState(); }); };
TapShop.notify = { isOn: notifyOn, set: setNotify };
TapShop.editProduct = id=>{ if(!canProducts()) return false; return load().then(()=>{ UI.edit = editDraft(id || ""); UI.adm.list = null; openStore("admin-edit", { id: id || "" }); return true; }); };
TapShop._t = { gated, soonHTML, compressPhoto, announceOpen, placeOrder, confirmOrder, orderPayload, nextStatuses, ostSelect, pruneCart, payOf, qtyOf, toastOff, pickVoucher: id=>{ _voucherId = id || ""; },
  redeemNow: id=> redeemNow(REDEEM.find(x=> x.id === id)) };

function hubTeaser(){
  if(S.loaded && !storeState().live && !canAdmin()){                 // R3-ADMIN-01: không bày ảnh / giá mẫu khi chưa mở bán
    return `<div class="sx-teaser sx-soon"><div class="sx-soon-card"><b>Chưa có sản phẩm nào mở bán</b><p>Cửa hàng TapEasy đang chuẩn bị. Quay lại sau nhé!</p>
      <button class="btn btn-outline btn-sm" data-te="sx-open">Xem cửa hàng</button></div></div>`;
  }
  const top = sortList(visible(), "featured").slice(0, 4), n = cartCount();
  return `<div class="sx-teaser">
    <button class="sx-hero" data-te="sx-open" aria-label="Vào Cửa hàng TapEasy"><img src="${escAttr(IMG("hero-1m.webp"))}" alt="" width="900" height="1200" loading="lazy"><span class="sx-hero-t"><small>Cửa hàng TapEasy</small><b>Bộ sưu tập<br>Thu — Đông 2026</b><em>Vào cửa hàng →</em></span></button>
    ${S.loaded ? `<div class="sx-rail">${top.map(p=>{ const im = imagesFor(p, (arr(p.colors)[0]||{}).id)[0]; return `<button data-te="sx-p" data-id="${escAttr(p.id)}" aria-label="${escAttr(p.name)}, ${escAttr(vnd(p.price))}">${im ? `<img src="${escAttr(im)}" alt="" width="180" height="240" loading="lazy">` : art(p, null, 120)}<span>${esc(p.name)}</span><b>${vnd(p.price)}</b></button>`; }).join("")}</div>` : ""}
    <div class="sx-links"><button data-te="sx-cart">Giỏ hàng${n ? ` (${n})` : ""}</button><button data-te="orders">Đơn hàng</button><button data-te="redeem">Đổi điểm</button></div>
    <p class="small-note">${gfp()}% doanh thu cửa hàng dùng mua quà cho thành viên tích cực mỗi tháng.</p>
  </div>`;
}
try{
  if(TapEv.registerTab) TapEv.registerTab({ id:"shop", label:"Cửa hàng", icon:"storefront", after:"events", render: hubTeaser, mount(){ if(!S.loaded) load().then(()=> TapEv.render && TapEv.render()); } });
  if(TapEv.act){
    const A0 = TapEv._ACT || {}, oldHub = A0.hub;
    TapEv.act("sx-open", ()=> openStore("home"));
    TapEv.act("sx-p", id=> openStore("product", { id }));
    TapEv.act("sx-cart", ()=> TapShop.openCart());
    TapEv.act("hub", (id, el, e)=>{ if(id === "shop"){ try{ closeSheet(); }catch(_){} openStore("home"); return; } return oldHub && oldHub(id, el, e); });
  }
  if(TapEv.addAdminSection){
    TapEv.addAdminSection({ id:"products", title:"Cửa hàng — sản phẩm", perm:"shop.products", render: async el=>{ await load(); el.innerHTML = canProducts() ? `<p class="small-note">${S.products.filter(p=> !p.deleted).length} sản phẩm · tồn ${nf(S.products.reduce((a, p)=> a + (p.deleted ? 0 : totalStock(p)), 0))}</p><button class="btn btn-primary btn-sm" data-te="sx-admin" data-id="products">Mở quản trị sản phẩm</button>` : `<p class="small-note">Chưa có quyền shop.products.</p>`; } });
    TapEv.addAdminSection({ id:"orders", title:"Cửa hàng — đơn hàng", perm:["shop.orders", "orders.view"], render: el=>{ el.innerHTML = canOrders() ? `<button class="btn btn-primary btn-sm" data-te="sx-admin" data-id="orders">Mở quản trị đơn hàng</button>` : `<p class="small-note">Chưa có quyền shop.orders.</p>`; } });
    TapEv.act && TapEv.act("sx-admin", id=>{ UI.adm.list = null; openStore("admin", { id }); });
  }
}catch(e){ warn(e); }
/* Nút Back Android / Esc: lùi trong cửa hàng, hết thì thoát về app.
   Cửa hàng là lớp trên cùng → mỗi lần mở, đặt bộ bọc của shop lên ĐẦU chuỗi fkHandleBack (module nạp sau có thể đã bọc lại). */
let _backFn = null;
function hookBack(){
  try{ if(G.fkHandleBack === _backFn && _backFn) return; const prev = G.fkHandleBack;
    _backFn = function(){ if(UI.open){ back(); return true; } return typeof prev === "function" ? prev.apply(this, arguments) : false; };
    G.fkHandleBack = _backFn; }catch(e){ warn(e); }
}
hookBack();

ensureData().then(()=> load()).then(()=>{ try{ announceOpen(); }catch(e){} try{ TapEv.render && TapEv.render(); }catch(e){} });
})(typeof window !== "undefined" ? window : globalThis);
