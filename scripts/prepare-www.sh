#!/usr/bin/env bash
# TapEasy — gom file web vào www/ (webDir của Capacitor) + tải sẵn thư viện 800+ bài tập
set -e

# Vòng 2 (ux · FIX-security #6): bản nộp store KHÔNG được chạy chế độ demo.
#   STORE_BUILD=1 bash scripts/prepare-www.sh   → DỪNG nếu firebase-config.js còn trống (apiKey/projectId/appId rỗng)
#   (mặc định)                                   → chỉ cảnh báo (bản thử / web demo vẫn build được)
fb_empty=0
if [ ! -f firebase-config.js ]; then fb_empty=1
elif grep -Eq '(apiKey|projectId|appId)[[:space:]]*:[[:space:]]*(""|'"''"')' firebase-config.js; then fb_empty=1
fi
if [ "$fb_empty" = 1 ]; then
  if [ "${STORE_BUILD:-0}" = 1 ]; then
    echo "❌ STORE_BUILD=1 nhưng firebase-config.js trống (apiKey/projectId/appId) — bản store không được chạy chế độ demo. Điền cấu hình Firebase rồi build lại."
    exit 1
  fi
  echo "⚠️ firebase-config.js trống → app chạy CHẾ ĐỘ DEMO (chỉ dùng thử; bản nộp store: STORE_BUILD=1 sẽ dừng)"
fi

rm -rf www && mkdir -p www/vendor

# HTML + CSS (đúng thứ tự nạp trong index.html)
cp index.html manifest.json sw.js privacy-policy.html delete-account.html \
   style.css themes.css ui-kit.css nutrition-pro.css training-pro.css program-builder.css \
   pt-pro.css pt-connect.css community.css achievements.css health-safety.css events.css shop.css \
   findpt.css kb.css admin.css \
   themes-modules.css \
   www/
cp brand.css www/ 2>/dev/null || echo "⚠️ Chưa có brand.css (biến màu thương hiệu TapEasy) — app vẫn chạy với màu mặc định"
# JS lõi (rbac.js ngay sau cloud.js)
cp themes.js fk-lazy.js icons.js firebase-config.js media-config.js cloud.js rbac.js data.js people-ai.js templates.js exdb.js app.js \
   meals.js meals-extra.js nutrition.js freevideos.js video.js library.js coach.js ptprofile.js pt.js \
   www/
# JS module mở rộng (nạp sau pt.js; health-safety.js luôn cuối)
cp ui-kit.js exdb-vi-1.js exdb-vi-2.js exdb-vi-3.js exdb-vi.js nutrition-pro.js training-pro.js \
   program-builder.js pt-pro.js \
   cloud-social.js pt-connect.js community.js \
   cloud-pt-directory.js findpt.js \
   achievements.js \
   cloud-events.js events-media.js events.js shop-data.js shop.js \
   kb-data-1.js kb-data-2.js kb-data-3.js kb-data-4.js kb-data-5.js kb-data-6.js kb.js \
   cloud-admin.js admin.js \
   press-feel.js \
   morph-icons.js \
   health-safety.js \
   www/
# Gói giao diện + thành phần chữ ký (nạp sau health-safety.js / sau themes-modules.css — docs/THEME-PACKS.md)
cp theme-packs.css ui-signature.css theme-packs.js ui-signature.js www/
# Cảm giác bấm (docs/PRESS-FEEL.md): CSS ngay trước brand.css, JS ngay trước morph-icons.js
cp press-feel.css www/
# Token accent theo theme + logo đổi màu (docs/THEME-PACKS.md §8): CSS ngay trước brand.css, JS ngay sau theme-packs.js
cp theme-accent.css theme-accent.js www/

# morphicons (MIT) — icon biến hình, tự host (tạo bằng .github/workflows/vendor-morphicons.yml); chưa có → app đổi icon tức thì
if [ -f vendor/morphicons.min.js ]; then cp vendor/morphicons.min.js www/vendor/; cp vendor/morphicons.LICENSE vendor/morphicons.VERSION www/vendor/ 2>/dev/null || true
else echo "⚠️ Chưa có vendor/morphicons.min.js (chạy workflow vendor-morphicons) — icon đổi tức thì, không biến hình"; fi

# free-exercise-db (Unlicense / Public Domain) — đóng gói kèm app để dùng offline
curl -fsSL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o www/vendor/exercises.json \
  || echo "⚠️ Không tải được exercises.json — app sẽ tự tải khi có mạng"

# Ảnh: nền, icon app, favicon, lối tắt PWA, ảnh chia sẻ, logo thương hiệu TapEasy (assets/brand/ — không chép source/)
mkdir -p www/assets/brand
cp assets/bg-storm.jpg www/assets/
cp assets/icon-*.png assets/apple-touch-icon-180.png assets/shortcut-*.png www/assets/ 2>/dev/null || echo "⚠️ Thiếu một số icon PNG trong assets/"
cp assets/favicon.svg assets/favicon-32.png assets/favicon-16.png assets/favicon.ico www/assets/ 2>/dev/null || echo "⚠️ Thiếu favicon trong assets/"
cp assets/og-tapeasy.jpg www/assets/ 2>/dev/null || echo "⚠️ Thiếu assets/og-tapeasy.jpg (ảnh chia sẻ mạng xã hội)"
cp assets/brand/*.svg assets/brand/*.png www/assets/brand/ 2>/dev/null || echo "⚠️ Chưa có assets/brand/ (logo TapEasy) — app vẫn chạy, logo sẽ thiếu"
# Ảnh sản phẩm Gian hàng (shop-data.js → assets/shop/<slug>-<màu>-1|2.webp; không chép _build/)
if ls assets/shop/*.webp >/dev/null 2>&1; then mkdir -p www/assets/shop && cp assets/shop/*.webp www/assets/shop/; else echo "⚠️ Chưa có assets/shop/*.webp — Gian hàng dùng hình minh hoạ SVG"; fi

# Kiểm tra: mọi <script src>/<link href> cục bộ trong index.html đều có trong www/
missing=0
for f in $(grep -oE '(src|href)="[^"#:]+\.(js|css)"' index.html | sed -E 's/^(src|href)="//; s/"$//'); do
  [ -f "www/$f" ] || { echo "❌ Thiếu www/$f"; missing=1; }
done
# … và mọi ảnh assets/… mà index.html, manifest.json, sw.js tham chiếu
for f in $(grep -ohE '(\./)?assets/[A-Za-z0-9_./-]+\.(png|jpe?g|svg|ico|webp)' index.html manifest.json sw.js | sed -E 's#^\./##' | sort -u); do
  [ -f "www/$f" ] || { echo "❌ Thiếu www/$f"; missing=1; }
done
# … và ảnh sản phẩm mà shop-data.js trỏ tới (assets/shop/<slug>-<màu>-1|2.webp + hero) nếu thư mục ảnh có trong mã nguồn
if ls assets/shop/*.webp >/dev/null 2>&1; then
  for f in assets/shop/*.webp; do [ -f "www/$f" ] || { echo "❌ Thiếu www/$f"; missing=1; }; done
fi
[ "$missing" = 0 ] && echo "✅ Đủ mọi file JS/CSS/ảnh mà index.html, manifest.json, sw.js, Gian hàng cần"
[ "$missing" = 0 ] || { echo "❌ www/ thiếu file — dừng (xem danh sách ở trên)"; exit 1; }

# =====================================================================================
# Tối ưu bản phát hành (vòng sửa UX — QU-01 / QU-09, docs/qa/FIX-ux.md)
#   BUNDLE=0     không gộp CSS            (mặc định 1: 20 file CSS → 1 file app.<băm>.css, GIỮ NGUYÊN thứ tự cascade)
#   JS KHÔNG gộp: ghép các <script> cổ điển thành 1 file đổi ngữ nghĩa — `typeof X` của hằng/let khai báo ở file sau
#   ném ReferenceError (TDZ) thay vì "undefined" (đã thử: renderHomeScreen → teHomeExplore hỏng), và 1 lỗi chặn mọi module sau.
#   Gộp JS chỉ làm được sau khi nạp lười theo nhóm (QU-01, docs/qa/FIX-ux.md §Chuyển giao).
#   MINIFY=0     không nén CSS            (mặc định 1: bộ nén CSS an toàn viết sẵn bên dưới — đã kiểm ảnh chụp giống hệt bản gốc)
#   MINIFY_JS=1  nén JS bằng esbuild      (mặc định 0 — CHƯA kiểm trên thiết bị; bật khi CI có mạng: esbuild trong PATH →
#                node_modules/.bin → npx --yes esbuild@0.24; không có/offline → tự bỏ qua; bản nén không parse được → giữ bản gốc)
# Luôn làm: sinh lại danh sách ASSETS + băm phiên bản cache trong www/sw.js từ CHÍNH www/index.html
#   (không còn phải sửa tay "fitkit-vN" mỗi lần đổi file). File gốc vẫn được giữ trong www/ (mã có thể nạp lười theo tên).
# =====================================================================================
BUNDLE="${BUNDLE:-1}"; MINIFY="${MINIFY:-1}"; MINIFY_JS="${MINIFY_JS:-0}"
if [ "$MINIFY_JS" = 1 ] && [ -z "${ESBUILD:-}" ]; then
  TO=""; command -v timeout >/dev/null 2>&1 && TO="timeout 120"
  if command -v esbuild >/dev/null 2>&1; then ESBUILD="esbuild"
  elif [ -x node_modules/.bin/esbuild ]; then ESBUILD="node_modules/.bin/esbuild"
  elif command -v npx >/dev/null 2>&1 && $TO npx --yes esbuild@0.24 --version >/dev/null 2>&1; then ESBUILD="npx --yes esbuild@0.24"
  fi
fi
if [ "$MINIFY_JS" = 1 ]; then [ -n "${ESBUILD:-}" ] && echo "• Nén JS bằng: $ESBUILD" || echo "⚠️ MINIFY_JS=1 nhưng không có esbuild (offline?) — bỏ qua nén JS"; fi
if command -v node >/dev/null 2>&1; then
  BUNDLE="$BUNDLE" MINIFY="$MINIFY" MINIFY_JS="$MINIFY_JS" ESBUILD="${ESBUILD:-}" node - <<'NODE_EOF' || { echo "❌ Bước tối ưu www/ lỗi — dừng"; exit 1; }
const fs = require("fs"), path = require("path"), crypto = require("crypto"), cp = require("child_process");
const W = "www", rd = f => fs.readFileSync(path.join(W, f), "utf8"), wr = (f, s) => fs.writeFileSync(path.join(W, f), s);
const E = process.env, hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);
const kb = n => (n / 1024).toFixed(0) + " KB";
let html = rd("index.html");
const LOCAL = /^(?!https?:|\/\/|data:)[^"?#]+$/;

/* Bộ nén CSS an toàn: bỏ chú thích (ngoài chuỗi), gộp khoảng trắng, bỏ khoảng trắng quanh { } ; , — KHÔNG đụng ":" (".a :is()" ≠ ".a:is()") hay "+ -" (calc) */
function minCss(src){
  let out = "", i = 0, n = src.length;
  while(i < n){
    const c = src[i];
    if(c === "/" && src[i+1] === "*"){ const j = src.indexOf("*/", i + 2); i = j < 0 ? n : j + 2; out += " "; continue; }
    if(c === '"' || c === "'"){ let j = i + 1; while(j < n && src[j] !== c){ if(src[j] === "\\") j++; j++; } out += src.slice(i, j + 1); i = j + 1; continue; }
    if(/\s/.test(c)){ while(i < n && /\s/.test(src[i])) i++; out += " "; continue; }
    out += c; i++;
  }
  // khoảng trắng quanh dấu phân cách — chỉ làm ngoài chuỗi: tách theo chuỗi rồi xử lý phần lẻ
  return out.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/).map((part, k)=> k % 2 ? part :
    part.replace(/\s*([{};,])\s*/g, "$1").replace(/;}/g, "}")).join("").trim();
}
function esb(file, loader){
  if(E.MINIFY_JS !== "1" || !E.ESBUILD) return null;
  try{ return cp.execSync(`${E.ESBUILD} --minify --loader=${loader} --charset=utf8 --log-level=error`, { input: fs.readFileSync(file), maxBuffer: 64 << 20 }).toString(); }
  catch(e){ console.log("⚠️ esbuild lỗi ở " + file + " — giữ bản gốc"); return null; }
}

/* ---------- 1. CSS: gộp mọi <link rel=stylesheet> cục bộ theo đúng thứ tự → app.<băm>.css ---------- */
const cssRe = /<link rel="stylesheet" href="([^"]+\.css)"[^>]*>[^\n]*\n?/g;
const cssList = [...html.matchAll(cssRe)].map(m => m[1]).filter(h => LOCAL.test(h));
let cssOut = null;
if(E.BUNDLE !== "0" && cssList.length > 1){
  const raw = cssList.map(f => `/* ${f} */\n` + rd(f)).join("\n");
  let css = raw;
  if(E.MINIFY !== "0") css = minCss(raw);
  cssOut = `app.${hash(css)}.css`; wr(cssOut, css);
  let first = true;
  html = html.replace(cssRe, (m, h) => {
    if(!LOCAL.test(h)) return m;
    if(!first) return "";
    first = false;
    // program-builder.js tìm link program-builder.css hoặc style[data-pb-css] → giữ dấu hiệu để không chèn trùng
    return `<link rel="stylesheet" href="${cssOut}">  <!-- gộp ${cssList.length} file CSS (prepare-www.sh) -->\n<style data-pb-css></style>\n`;
  });
  console.log(`• CSS: ${cssList.length} file ${kb(raw.length)} → ${cssOut} ${kb(css.length)}`);
} else if(E.MINIFY !== "0"){
  for(const f of cssList) wr(f, minCss(rd(f)));
  console.log(`• CSS: nén từng file (${cssList.length})`);
}

/* ---------- 2. JS: nén từng file (nếu có esbuild) — giữ nguyên từng <script> ---------- */
const jsRe = /<script src="([^"]+\.js)"(?: defer)?><\/script>[^\n]*\n?/g;
// + dữ liệu nạp lười (vòng 2, fkLazy): <script type="text/fk-lazy" data-group=… src=…> — trình duyệt không tự tải,
//   fk-lazy.js chèn khi cần ⇒ file vẫn phải có trong www/ (bước kiểm bên trên) + precache (bước 3 lấy mọi src=)
const lazyList = [...html.matchAll(/<script\b[^>]*\btype="text\/fk-lazy"[^>]*>/g)]
  .map(m => (/\bsrc="([^"]+\.js)"/.exec(m[0]) || [])[1]).filter(h => h && LOCAL.test(h));
if(lazyList.length) console.log(`• Nạp lười (fkLazy): ${lazyList.length} file dữ liệu — giữ file rời + precache`);
const jsList = [...html.matchAll(jsRe)].map(m => m[1]).filter(h => LOCAL.test(h)).concat(lazyList);
let jsBefore = 0, jsAfter = 0, nMin = 0;
const jsCode = {};
for(const f of jsList){
  const s = rd(f); jsBefore += s.length;
  const m = esb(path.join(W, f), "js");
  if(m){ try{ new Function(m); }catch(e){ console.log("⚠️ bản nén " + f + " không hợp lệ — giữ bản gốc"); jsCode[f] = s; jsAfter += s.length; continue; } wr(f, m); nMin++; }
  jsCode[f] = m || s; jsAfter += (m || s).length;
}
if(nMin) console.log(`• JS: nén ${nMin}/${jsList.length} file ${kb(jsBefore)} → ${kb(jsAfter)}`);
wr("index.html", html);

/* ---------- 3. sw.js: ASSETS + phiên bản cache sinh từ www/index.html ---------- */
let sw = rd("sw.js");
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1].replace(/^\.\//, ""))
  .filter(h => LOCAL.test(h) && /\.(js|css|png|jpe?g|svg|ico|webp|json)$/i.test(h));
const old = (sw.match(/const ASSETS = \[([\s\S]*?)\];/) || [, ""])[1];
const oldAssets = [...old.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]).filter(h => /^assets\//.test(h));
const extra = ["manifest.json", "theme-packs.js", "theme-accent.js", "ui-signature.js", "vendor/morphicons.min.js"];      // + icon biến hình (nạp lười, nếu đã vendor) · tài nguyên phụ luôn có
const all = [...new Set(["index.html", ...refs, ...extra, ...oldAssets])].filter(f => fs.existsSync(path.join(W, f)));
const ver = hash(all.map(f => f + ":" + crypto.createHash("sha1").update(fs.readFileSync(path.join(W, f))).digest("hex")).join("|"));
sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, "const ASSETS = [  // SINH TỰ ĐỘNG bởi scripts/prepare-www.sh từ www/index.html\n  " +
  all.map(f => JSON.stringify("./" + f)).join(", ") + ",\n];")
  .replace(/const CACHE = "(fitkit-v\d+)[^"]*";/, (m, v) => `const CACHE = "${v}-${ver}";`);
wr("sw.js", sw);
try{ new Function(sw); }catch(e){ console.log("❌ www/sw.js sau khi sinh không hợp lệ: " + e.message); process.exit(1); }
console.log(`• sw.js: ${all.length} tài nguyên precache · cache ${(sw.match(/const CACHE = "([^"]+)"/) || [])[1]}`);

/* ---------- 4. Kiểm lại: mọi tham chiếu cục bộ trong www/index.html có thật ---------- */
const miss = refs.filter(f => !fs.existsSync(path.join(W, f)));
if(miss.length){ console.log("❌ www/index.html trỏ tới file không có: " + miss.join(", ")); process.exit(1); }
console.log(`✅ www/index.html: ${refs.length} tham chiếu cục bộ đều có · ${(html.match(/<link rel="stylesheet"/g) || []).length} stylesheet · ${(html.match(/<script src=/g) || []).length} script`);
NODE_EOF
else
  echo "⚠️ Không có node — bỏ qua gộp/nén và sinh ASSETS của sw.js (www/ vẫn chạy với file gốc)"
fi
ls -la www www/vendor
