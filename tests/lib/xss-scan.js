/* =========================================================================
   Quét tĩnh XSS (heuristic, không cần thư viện):
   1) scanApp(): tìm `${…}` trong ngữ cảnh HTML (thẻ <…>, innerHTML, openSheet, toast,
      confirmDialog, insertAdjacentHTML) mà biểu thức chứa dữ liệu dạng chữ
      (name/title/note/text/msg/…) và KHÔNG bọc escapeHtml → phân loại nguồn:
        cross-user : dữ liệu do tài khoản KHÁC ghi (PT ↔ học viên qua cloud)
        self       : dữ liệu người dùng tự nhập trên máy mình (plan, bài tuỳ chỉnh, món, ghi chú…)
        sink       : hàm tiện ích nhận HTML thô (toast/confirmDialog) — nguy hiểm theo người gọi
        external   : thông điệp lỗi từ API bên ngoài
        static     : hằng số/dữ liệu đóng gói trong app
        review     : chưa phân loại — cần người xem
   2) scanCloudFields(): mọi trường giá trị của dữ liệu cloud (c./s./e./n./pr./st./u./nx.)
      chèn vào HTML không escape — kể cả trường "số", "giờ", "ảnh" (Firestore rules không kiểm kiểu).
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

/* Trích biểu thức trong ${ … } (đếm ngoặc, bỏ qua chuỗi lồng — đủ dùng cho mã của app) */
function extractExpr(src, start){
  let depth = 1, i = start, q = null;
  while(i < src.length && depth > 0){
    const ch = src[i];
    if(q){
      if(ch === "\\"){ i += 2; continue; }
      if(q === "`" && ch === "$" && src[i+1] === "{"){ depth++; i += 2; q = null; continue; }
      if(ch === q) q = null;
    } else {
      if(ch === "'" || ch === '"' || ch === "`") q = ch;
      else if(ch === "{") depth++;
      else if(ch === "}") depth--;
    }
    i++;
  }
  return src.slice(start, i-1);
}

const TEXTY = /(\bname\b|Name\b|\.title\b|\btitle\b|\bnote\b|\.note\b|\btext\b|\bmsg\b|\bmessage\b|\bfeedback\b|ptNote|\bbio\b|\bphone\b|\bemail\b|brand|\bwho\b|\blabel\b|\bdesc\b|\bgoal\b|\bcity\b|\bquote\b|\bcaption\b)/;
/* Bộ lọc an toàn. Vòng 2: escAttr (events/shop: esc + thoát dấu `), avatarHTML (pt-connect: ảnh qua esc, chữ cái đầu qua esc),
   brandMark (SVG logo hằng), ic(GOAL_IC[…]) (tra bảng hằng → tên icon; khoá lạ chỉ ra "[object Object]", không có thẻ) */
const SAFE = /escapeHtml\(|richText\(|attrUrl\(|safeUrl\(|\besc\(|\bescAttr\(|\bavatarHTML\(|\bbrandMark\(\s*["'`]\w*["'`]?\s*\)|\bic\(GOAL_IC\[|encodeURIComponent\(|\.toFixed\(|toLocaleString\(|Math\.|\.length\b|fmtDur\(|fmtDay\(|relDay\(|pad2\(|\bfmt1\(|\bNumber\(|ringSVG\(|foodPic\(|row\(|JSON\.stringify|\.map\(|\.join\(|clipThumbHTML|\? ?`/;
/* toast() đã tự escape (textContent) từ bản sửa BUG-01 → không còn là ngữ cảnh HTML; confirmDialog vẫn nhận HTML */
const HTML_CTX = /<\/?[a-zA-Z][^>]*>?|innerHTML|insertAdjacentHTML|openSheet\(|confirmDialog\(/;
const LIT = "(?:\"[^\"$]*\"|'[^'$]*'|`[^`$]*`)";
const LITERAL_TERNARY = new RegExp("^[^?]+\\?\\s*" + LIT + "\\s*:\\s*" + LIT + "$");
/** Biểu thức chỉ trả về chuỗi hằng (vd  x ? "Gọi" : "—") → an toàn */
function isLiteralOnly(expr){ return LITERAL_TERNARY.test(String(expr).trim()); }

const RULES = [
  { cls:"cross-user", re: /\b(c|client)\.(name|ptName|studentName|studentEmail|goal|phone)\b|\bptName\b|studentName|\bu\.(who|title)\b|\bs\.(title|ptNote|feedback)\b|\bn\.(text|authorName|kind)\b|\bpr\.\w+|brandName|cloud\.(user|profile)\.name/ },
  { cls:"sink", re: /^(msg|title|message)$/ },
  { cls:"external", re: /err(or)?\.message|\be\.message/ },
  { cls:"static", re: /\bprog\.msg\b|\bt\.name\b|\blabel\b|\.label\b|\.desc\b|goalDef\.|\bmt\.label\b|GOALS\.find|\br\.title\b|\bopts\.title\b|\br\.name\b|\.toLowerCase\(\)$/ },
  { cls:"self", re: /\bplan\.name\b|plans\[[^\]]+\]\.name|\bp\.name\b|\bmeta\.name\b|\bday\.title\b|\bl\.note\b|\bit\.name\b|\brec\.name\b|^\s*name\s*$|\bex\.name\b|\bfood\.name\b|\bf\.name\b|\bbad\.name\b/ },
];
function classify(expr){ for(const r of RULES) if(r.re.test(expr)) return r.cls; return "review"; }

function lineIndex(src){
  const lines = src.split("\n"), starts = []; let acc = 0;
  for(const l of lines){ starts.push(acc); acc += l.length + 1; }
  const at = idx=>{ let lo = 0, hi = starts.length-1; while(lo < hi){ const mid = (lo+hi+1)>>1; if(starts[mid] <= idx) lo = mid; else hi = mid-1; } return { line: lo+1, col: idx - starts[lo] }; };
  return { lines, at };
}
/** `${` nằm trong giá trị thuộc tính HTML (… attr="…${x}") hay trong nội dung */
function contextOf(lineTxt, col){
  const before = lineTxt.slice(0, col).replace(/\$\{[^}]*\}/g, "X");
  const lastTag = before.lastIndexOf("<"), lastClose = before.lastIndexOf(">");
  if(lastTag > lastClose && /=\s*["']?[^"'<>]*$/.test(before.slice(lastTag))) return "thuộc tính";
  return "nội dung";
}

function scanFile(full, rel){
  const src = fs.readFileSync(full, "utf8");
  const { lines, at } = lineIndex(src);
  const out = [];
  const re = /\$\{/g; let m;
  while((m = re.exec(src))){
    const expr = extractExpr(src, m.index + 2).trim();
    const { line, col } = at(m.index);
    const lineTxt = lines[line-1];
    if(/^\s*(\/\/|\*)/.test(lineTxt)) continue;
    if(!HTML_CTX.test(lineTxt) || !TEXTY.test(expr)) continue;
    if(SAFE.test(expr) || isLiteralOnly(expr)) continue;
    out.push({ file: rel, line, expr: expr.length > 90 ? expr.slice(0,87)+"…" : expr, cls: classify(expr), where: contextOf(lineTxt, col), snippet: lineTxt.trim().slice(0, 160) });
  }
  return out;
}
function scanApp(appDir, files){ return files.flatMap(f=> scanFile(path.join(appDir, f), f)); }

const CLOUD_FIELD = /\b(c|s|e|n|pr|st|u|nx)\.(name|ptName|studentName|studentEmail|goal|phone|title|ptNote|feedback|text|authorName|kind|time|mode|status|sets|reps|restSec|photo|years|area|specialty|brandName|bio|packageTotal|startDate|who|videoUrl|students|sessions)\b/;
const CLOUD_SAFE = /escapeHtml\(|attrUrl\(|safeUrl\(|NOTE_KINDS\.includes\(|\besc\(|encodeURIComponent\(|Math\.|\.length\b|relDay\(|fmtDay\(|row\(|stockCreditHTML\(|statusPill\(|\? ?`|^\w+\[[^\]]+\]$/;
function scanCloudFields(appDir, files){
  const out = [];
  for(const rel of files){
    const src = fs.readFileSync(path.join(appDir, rel), "utf8");
    const { lines, at } = lineIndex(src);
    const re = /\$\{/g; let m;
    while((m = re.exec(src))){
      const expr = extractExpr(src, m.index + 2).trim();
      const { line, col } = at(m.index), lineTxt = lines[line-1];
      if(!CLOUD_FIELD.test(expr) || CLOUD_SAFE.test(expr) || isLiteralOnly(expr)) continue;
      if(!HTML_CTX.test(lineTxt)) continue;
      out.push({ file: rel, line, expr: expr.length > 70 ? expr.slice(0,67)+"…" : expr, where: contextOf(lineTxt, col), snippet: lineTxt.trim().slice(0, 140) });
    }
  }
  return out;
}

module.exports = { scanApp, scanFile, scanCloudFields, extractExpr, classify, isLiteralOnly, contextOf };
