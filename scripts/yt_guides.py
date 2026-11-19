#!/usr/bin/env python3
"""TapEasy — tìm VIDEO HƯỚNG DẪN YouTube cho MỌI bài trong Thư viện 800+ (free-exercise-db) bằng YouTube Data API v3.

Chạy trong GitHub Actions (media-yt-guides.yml), KHOÁ KHÔNG nằm trong mã: secret YT_API_KEY.
Hạn mức miễn phí 10.000 đơn vị/ngày: 1 lần search = 100 đơn vị (+1 cho videos.list) → mặc định ~90 bài/lần chạy;
workflow chạy MỖI NGÀY cho đến khi đủ (đã tìm rồi thì bỏ qua — chạy lại bao nhiêu lần cũng được).

Chọn video: chỉ video NHÚNG ĐƯỢC (status.embeddable), ≤ 10 phút, tiêu đề khớp tên bài (từ khoá chính), ưu tiên "how to / form /
technique / tutorial", trừ "workout routine / compilation / follow along / music". Lấy tối đa 2 video, ưu tiên 2 kênh khác nhau.
Ra: media/yt/index.json  { "v":1, "items": { exdbId: ["ytid1","ytid2"] }, "tried": { exdbId: "YYYY-MM-DD" } }
Thứ tự: bài đang dùng trong giáo án mẫu / trình tạo giáo án / AI trước, rồi tới phần còn lại của thư viện.
Biến môi trường: YT_API_KEY (bắt buộc), YT_LIMIT (mặc định 90), YT_RETRY_EMPTY=1 (tìm lại bài lần trước không ra kết quả).
"""
import json, math, os, re, sys, datetime, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "media/yt"; IDX = OUT / "index.json"
KEY = os.environ.get("YT_API_KEY", "").strip()
LIMIT = int(os.environ.get("YT_LIMIT", "97") or 97)   # 10.000 đơn vị/ngày ÷ (100 search + 1 videos.list)
RETRY_EMPTY = os.environ.get("YT_RETRY_EMPTY") == "1"
API = "https://www.googleapis.com/youtube/v3/"
STOP = {"the", "with", "on", "and", "a", "of", "to", "exercise", "version", "alternate", "alternating", "v", "bar"}
BAD = re.compile(r"\b(workout routine|full workout|compilation|follow along|minute workout|min workout|music|playlist|reaction|asmr|vlog|day in the life)\b", re.I)
EQUIP = ["smith", "barbell", "dumbbell", "cable", "kettlebell", "band", "machine", "lever", "ez", "trap", "sled", "landmine", "bodyweight"]
NEG = re.compile(r"\b(stop|don'?t|never|worst|why you|is useless|overrated|vs\.?|versus)\b", re.I)
GOOD = re.compile(r"\b(how to|form|technique|tutorial|proper|correct|guide|tips|mistakes|demo|demonstration)\b", re.I)

def get(path, **q):
    q["key"] = KEY
    url = API + path + "?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "TapEasy-yt-bot"}), timeout=30) as r:
        return json.loads(r.read())

def iso_dur(s):
    m = re.match(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    if not m: return 0
    d, h, mi, se = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + se

def words(s):
    s = re.sub(r"[^a-z0-9 ]+", " ", str(s).lower().replace("_", " ").replace("-", " "))
    return [w for w in s.split() if w and w not in STOP]

def exdb_ids():
    ids = []
    for f in sorted(ROOT.glob("exdb-vi*.js")):
        ids += re.findall(r'^\s*"([^"]+)":\{n:', f.read_text(encoding="utf-8"), flags=re.M)
    return list(dict.fromkeys(ids))

def priority_ids(all_ids):
    used = set()
    for f in ["program-builder.js", "ai-coach.js", "training-pro.js", "plan-tools.js", "templates.js", "freevideos.js", "library.js"]:
        p = ROOT / f
        if p.exists(): used |= set(re.findall(r'"([A-Z][A-Za-z0-9_]+_[A-Za-z0-9_]+)"', p.read_text(encoding="utf-8")))
    first = [i for i in all_ids if i in used]
    return first + [i for i in all_ids if i not in used]

def pick(ex_id):
    name = ex_id.replace("_", " ")
    key_w = words(name)
    res = get("search", part="snippet", q=f"{name} exercise how to proper form", type="video", maxResults=12,
              videoEmbeddable="true", safeSearch="strict", relevanceLanguage="en")
    cand = [it for it in res.get("items", []) if it.get("id", {}).get("videoId")]
    if not cand: return []
    ids = ",".join(it["id"]["videoId"] for it in cand)
    det = {v["id"]: v for v in get("videos", part="contentDetails,status,statistics", id=ids).get("items", [])}
    scored = []
    for it in cand:
        vid = it["id"]["videoId"]; d = det.get(vid); sn = it.get("snippet", {})
        if not d or not d.get("status", {}).get("embeddable", False): continue
        if d["status"].get("privacyStatus") != "public": continue
        dur = iso_dur(d.get("contentDetails", {}).get("duration"))
        if dur < 8 or dur > 600: continue
        title = sn.get("title", "")
        if BAD.search(title) or NEG.search(title): continue
        tl = title.lower(); nl = name.lower()
        if any(e in tl and e not in nl for e in EQUIP if not (e == "machine" and "lever" in nl) and not (e == "lever" and "machine" in nl)): continue   # khác dụng cụ
        tw = set(words(title)); hit = sum(1 for w in key_w if w in tw or (len(w) > 4 and any(t.startswith(w[:5]) for t in tw)))
        if not key_w or hit / len(key_w) < 0.5: continue
        views = int(d.get("statistics", {}).get("viewCount", 0) or 0)
        score = hit / len(key_w) * 10 + (3 if GOOD.search(title) else 0) + math.log10(views + 10) + (1 if dur <= 90 else 0)
        scored.append((score, vid, sn.get("channelId", "")))
    scored.sort(reverse=True)
    out, chans = [], set()
    for s, vid, ch in scored:                      # ưu tiên 2 kênh khác nhau (2 "góc" khác nhau)
        if ch in chans and len(scored) > 2: continue
        out.append(vid); chans.add(ch)
        if len(out) == 2: break
    if len(out) < 2:
        for s, vid, ch in scored:
            if vid not in out: out.append(vid)
            if len(out) == 2: break
    return out

def main():
    if not KEY:
        print("::error::Thiếu secret YT_API_KEY (Settings → Secrets and variables → Actions)"); sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    data = json.loads(IDX.read_text(encoding="utf-8")) if IDX.exists() else {}
    items, tried = data.get("items", {}), data.get("tried", {})
    ov_p = ROOT / "scripts/yt_overrides.json"          # chủ app duyệt: "drop" = tìm lại bài đó; "force" = gắn cứng video đã chọn
    if ov_p.exists():
        ov = json.loads(ov_p.read_text(encoding="utf-8"))
        for k in ov.get("drop", []): items.pop(k, None); tried.pop(k, None)
        for k, v in (ov.get("force") or {}).items(): items[k] = [x for x in v if re.fullmatch(r"[A-Za-z0-9_-]{11}", x)][:3]
    todo = [i for i in priority_ids(exdb_ids()) if i not in items and (RETRY_EMPTY or i not in tried)]
    if not todo:                                        # hàng chờ hết → tự tìm lại những bài lần trước chưa ra video (sau ≥ 7 ngày)
        old = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        todo = [i for i in priority_ids(exdb_ids()) if i not in items and str(tried.get(i, "")) <= old]
    print(f"Thư viện: {len(exdb_ids())} bài · đã có video: {len(items)} · còn: {len(todo)} · lần này tối đa {LIMIT}")
    today = datetime.date.today().isoformat(); n = 0
    for ex_id in todo[:LIMIT]:
        try:
            got = pick(ex_id)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore")[:200]
            print(f"✗ {ex_id}: HTTP {e.code} {body}")
            if e.code == 403: break                 # hết hạn mức hôm nay → dừng, mai chạy tiếp
            continue
        except Exception as e:
            print(f"✗ {ex_id}: {e}"); continue
        tried[ex_id] = today; n += 1
        if got: items[ex_id] = got; print(f"✓ {ex_id}: {got}")
        else: print(f"· {ex_id}: chưa tìm được video phù hợp")
    IDX.write_text(json.dumps({"v": 1, "items": dict(sorted(items.items())), "tried": dict(sorted(tried.items()))}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Xong: tìm {n} bài · tổng có video {len(items)}/{len(exdb_ids())}")

if __name__ == "__main__":
    main()
