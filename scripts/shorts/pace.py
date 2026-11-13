"""Ngắt nghỉ cho giọng đọc MiniMax: chèn dấu dừng <#giây#> sau dấu câu (bên trong 1 đoạn lời).

  pace("Khoan đã! Mở app, nhập cân nặng.", {"comma": 0.22, "stop": 0.42})
  → "Khoan đã! <#0.42#>Mở app, <#0.22#>nhập cân nặng."
Không chèn ở cuối đoạn (khoảng lặng giữa các nhịp do prep.js lo). cfg rỗng/None → giữ nguyên lời.
"""
import re


def pace(text, cfg):
    if not cfg or not text: return text
    c, s = float(cfg.get("comma", 0) or 0), float(cfg.get("stop", 0) or 0)

    def rep(m):
        p = m.group(1)
        sec = s if p in ".!?…" else c
        return f"{p} <#{sec:.2f}#>" if sec > 0 else m.group(0)
    # dấu câu + khoảng trắng + còn chữ phía sau (không đụng số thập phân 1,6 / 6.25)
    return re.sub(r"([,;:.!?…])\s+(?=\S)", rep, text.strip())
