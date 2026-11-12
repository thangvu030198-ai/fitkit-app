#!/usr/bin/env python3
"""TapEasy intro — giọng đọc giới thiệu (voiceover) bằng TTS qua API apivn (OpenAI-compatible) → build/voice/voice.wav.

Kịch bản: scripts/intro-video/voiceover.json (chương, start, end, text — neo theo chương: start = t0 + at,
end = t1 − tail hoặc t0 + until). Giọng: nam trầm ấm, tiếng Việt, tốc độ vừa, tự tin truyền cảm hứng.

KHOÁ KHÔNG BAO GIỜ nằm trong mã — biến môi trường (GitHub Actions: secrets):
  TTS_API_KEY   khoá (workflow: secrets.TTS_API_KEY nếu có, không thì secrets.IMG_API_KEY); thiếu → thử IMG_API_KEY
  TTS_API_BASE  mặc định https://apivn.vn/v1        TTS_MODEL  mặc định minimax-speech-2.8-turbo
  TTS_VOICE     ép 1 voice id (bỏ qua dò)            TTS_SPEED  1.0 (tốc độ vừa)      TTS_PITCH  -2 (trầm hơn, kiểu MiniMax)
  TTS_RECIPE    ép cách gọi: openai | openai_vs | t2a_v2 | audio_t2a_v2

Cách gọi (nhà cung cấp chưa rõ tham số giọng → TỰ DÒ, ghi log từng lần thử, đã che khoá):
  0. GET {base}/audio/voices, /voices, /audio/speech/voices, /models — nếu có danh sách giọng thì chấm điểm
     (nam + trầm/ấm/thuyết minh + tiếng Việt) và thử trước.
  1. openai      POST {base}/audio/speech {model, input, voice, response_format:"mp3", speed}
  2. openai_vs   như 1 + voice_setting:{voice_id, speed, vol, pitch} + language_boost:"Vietnamese"
  3. t2a_v2      POST {base}/t2a_v2 kiểu MiniMax T2A v2 {model, text, voice_setting, audio_setting, language_boost} (audio hex)
  4. audio_t2a_v2 POST {base}/audio/t2a_v2 (cùng thân như 3)
  Mỗi cách thử lần lượt các voice id: (dò được) + Deep_Voice_Man, presenter_male, audiobook_male_1, male-qn-jingying,
  Vietnamese_male_1, Determined_Man, onyx. 401/403 → dừng; 404/405 → bỏ cách đó; lỗi khác → voice kế tiếp.
  Cách + giọng chạy được đầu tiên ("recipe") dùng cho mọi đoạn; lỗi giữa chừng → thử lại 3 lần rồi dò lại.

Ghép (ffmpeg + numpy): mỗi đoạn 1 mp3 (build/voice/NN-<chương>.mp3, có cache theo hash lời + recipe) → cắt lặng đầu/cuối →
chuẩn hoá −16 LUFS → đặt đúng `start`. KHÔNG cắt lời giữa chừng: lời dài hơn chỗ trống →
  (a) --fit-timeline: kéo dài chương trong timeline.json theo bội 4 phách (ưu tiên) rồi chạy lại prep.py;
  (b) không thì co tốc độ atempo ≤ 1.10; (c) vẫn dài → lấn sang khoảng lặng sau + dời các đoạn sau (cảnh báo).
Ra: build/voice/voice.wav (48 kHz mono, −16 LUFS), build/voice/report.json, build/qa/voice/tts-log.json + report.txt.
TTS lỗi hoàn toàn → không có voice.wav (mix_audio.py dùng nhạc không lời) + cảnh báo; mã thoát 0 (trừ khi --strict).

  python3 scripts/intro-video/tts.py --check            # chỉ đếm từ/giây từng đoạn (không gọi API)
  TTS_API_KEY=… python3 scripts/intro-video/tts.py --fit-timeline
"""
import argparse, base64, hashlib, json, math, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
VDIR = os.path.join(BUILD, "voice")
QADIR = os.path.join(BUILD, "qa", "voice")
SR = 48000
GH = os.environ.get("GITHUB_ACTIONS") == "true"

KEY = (os.environ.get("TTS_API_KEY") or os.environ.get("IMG_API_KEY") or "").strip()
BASE = (os.environ.get("TTS_API_BASE") or "https://apivn.vn/v1").strip().rstrip("/")
SPEED = float(os.environ.get("TTS_SPEED") or 1.0)
PITCH = int(float(os.environ.get("TTS_PITCH") or -2))
VOICE_ENV = (os.environ.get("TTS_VOICE") or "").strip()
RECIPE_ENV = (os.environ.get("TTS_RECIPE") or "").strip()
DEFAULT_VOICES = ["Deep_Voice_Man", "presenter_male", "audiobook_male_1", "male-qn-jingying", "Vietnamese_male_1", "Determined_Man", "onyx"]
STRATEGIES = ["openai", "openai_vs", "t2a_v2", "audio_t2a_v2"]
PROBE_TEXT = "Xin chào, đây là TapEasy. Tập đúng, tiến bộ thật sự."
LOG = []


def warn(msg):
    print(("::warning::" if GH else "! ") + msg, flush=True)


def redact(s):
    s = str(s)
    if KEY: s = s.replace(KEY, "***")
    return re.sub(r"(?i)(bearer\s+|api[_-]?key[\"'=:\s]+)[A-Za-z0-9._\-]{8,}", r"\1***", s)


# ------------------------------------------------------------------ HTTP
def http(method, url, body=None, timeout=180):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Accept": "*/*", "User-Agent": "tapeasy-intro-tts/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, (r.headers.get("Content-Type") or ""), r.read()
    except urllib.error.HTTPError as e:
        try: b = e.read()
        except Exception: b = b""
        return e.code, (e.headers.get("Content-Type") or "") if e.headers else "", b
    except Exception as e:                                   # mạng / DNS / hết giờ
        return 0, "", redact(f"{type(e).__name__}: {e}").encode("utf-8")


def log_attempt(how, url, voice, status, ctype, body, note=""):
    is_audio = looks_audio(body)
    ent = {"t": time.strftime("%H:%M:%S"), "how": how, "url": redact(url), "voice": voice, "status": status, "ctype": ctype,
           "body": f"<audio {len(body)} byte>" if is_audio else redact(body[:600].decode("utf-8", "replace")), "note": note}
    LOG.append(ent)
    print(f"  [{how:<12}] voice={voice or '-':<20} HTTP {status} {ctype[:28]:<28} {ent['body'][:160]!s}", flush=True)
    return ent


def looks_audio(b):
    return bool(b) and (b[:3] == b"ID3" or b[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xe3") or b[:4] in (b"RIFF", b"OggS", b"fLaC"))


def extract_audio(status, ctype, body):
    """→ (bytes âm thanh | None, lý do lỗi)"""
    if status != 200: return None, f"HTTP {status}"
    if looks_audio(body) or ctype.startswith("audio/") or ctype == "application/octet-stream":
        return (body, "") if looks_audio(body) else (None, "nội dung không phải âm thanh")
    try: j = json.loads(body.decode("utf-8"))
    except Exception: return None, "không đọc được JSON"
    br = j.get("base_resp") if isinstance(j, dict) else None              # MiniMax: HTTP 200 + base_resp.status_code ≠ 0 = lỗi
    if isinstance(br, dict) and br.get("status_code") not in (0, None):
        return None, f"base_resp {br.get('status_code')}: {br.get('status_msg')}"
    if isinstance(j, dict) and j.get("error"): return None, f"error: {redact(j.get('error'))[:200]}"
    cands = []
    def walk(o, depth=0):
        if depth > 4: return
        if isinstance(o, dict):
            for k in ("audio", "audio_data", "b64_json", "data", "audio_file", "audio_url", "url", "file"):
                if k in o: cands.append(o[k]); walk(o[k], depth + 1)
        elif isinstance(o, list):
            for x in o[:3]: walk(x, depth + 1)
    walk(j)
    for c in cands:
        if not isinstance(c, str) or len(c) < 8: continue
        if c.startswith("http"):
            st, ct, b = http("GET", c)
            if st == 200 and looks_audio(b): return b, ""
            continue
        s = c.split(",", 1)[1] if c.startswith("data:") else c
        if re.fullmatch(r"[0-9a-fA-F]+", s or "") and len(s) % 2 == 0:
            b = bytes.fromhex(s)
            if looks_audio(b): return b, ""
        try:
            b = base64.b64decode(s + "=" * (-len(s) % 4))
            if looks_audio(b): return b, ""
        except Exception: pass
    return None, "JSON không có âm thanh: " + ",".join(list(j.keys())[:8] if isinstance(j, dict) else [])


# ------------------------------------------------------------------ dò giọng
def score_voice(v):
    t = " ".join(str(v.get(k, "")) for k in ("id", "voice_id", "name", "voice_name", "description", "gender", "language", "tags", "desc")).lower()
    s = 0
    if re.search(r"\b(male|man|men|boy|gentleman|nam)\b|男", t) and not re.search(r"female|woman|girl|lady|nữ|女", t): s += 3
    if re.search(r"female|woman|girl|lady|nữ|女", t): s -= 6
    if re.search(r"deep|trầm|low|bass|magnetic|warm|ấm|calm|narrat|presenter|audiobook|announcer|baritone|mature|steady|confident|inspir", t): s += 3
    if re.search(r"vietnam|tiếng việt|\bvi\b|vi[-_]vn", t): s += 4
    return s


def discover_voices():
    found = []
    for path in ("/audio/voices", "/voices", "/audio/speech/voices", "/get_voice", "/models"):
        url = BASE + path
        st, ct, b = http("GET", url, timeout=40)
        log_attempt("GET", url, "", st, ct, b, "dò danh sách giọng/model")
        if st != 200: continue
        try: j = json.loads(b.decode("utf-8"))
        except Exception: continue
        items = []
        def walk(o, depth=0):
            if depth > 3: return
            if isinstance(o, list):
                for x in o:
                    if isinstance(x, dict) and any(k in x for k in ("voice_id", "voice", "id", "name")): items.append(x)
                    else: walk(x, depth + 1)
            elif isinstance(o, dict):
                for k in ("voices", "data", "system_voice", "voice_list", "items", "result"):
                    if k in o: walk(o[k], depth + 1)
        walk(j)
        if path == "/models":
            ids = [str(x.get("id")) for x in items if isinstance(x, dict)]
            tts = [i for i in ids if re.search(r"speech|tts|t2a|audio", i, re.I)]
            print(f"  /models: {len(ids)} model; liên quan giọng nói: {', '.join(tts[:12]) or '—'}")
            continue
        for x in items:
            vid = x.get("voice_id") or x.get("voice") or x.get("id") or x.get("name")
            if vid: found.append({"id": str(vid), "score": score_voice(x), "raw": {k: str(v)[:80] for k, v in list(x.items())[:6]}})
    found.sort(key=lambda v: -v["score"])
    good = [v for v in found if v["score"] > 0]
    if found: print(f"  dò được {len(found)} giọng; hợp 'nam trầm/tiếng Việt': {', '.join(v['id'] for v in good[:8]) or '—'}")
    return [v["id"] for v in good[:6]], found[:60]


def build_request(how, model, text, voice):
    vs = {"voice_id": voice, "speed": SPEED, "vol": 1.0, "pitch": PITCH}
    if how == "openai":
        return BASE + "/audio/speech", {"model": model, "input": text, "voice": voice, "response_format": "mp3", "speed": SPEED}
    if how == "openai_vs":
        return BASE + "/audio/speech", {"model": model, "input": text, "voice": voice, "response_format": "mp3", "speed": SPEED,
                                        "voice_setting": vs, "language_boost": "Vietnamese"}
    body = {"model": model, "text": text, "stream": False, "language_boost": "Vietnamese", "output_format": "hex", "voice_setting": vs,
            "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1}}
    return BASE + ("/t2a_v2" if how == "t2a_v2" else "/audio/t2a_v2"), body


def call(recipe, model, text, note=""):
    url, body = build_request(recipe["how"], model, text, recipe["voice"])
    st, ct, b = http("POST", url, body)
    audio, why = extract_audio(st, ct, b)
    log_attempt(recipe["how"], url, recipe["voice"], st, ct, b, note + ((" · " + why) if why else ""))
    return audio, st, (why or "")


def probe(model, voices):
    hows = [RECIPE_ENV] if RECIPE_ENV else STRATEGIES
    for how in hows:
        for v in voices:
            audio, st, why = call({"how": how, "voice": v}, model, PROBE_TEXT, "thử")
            if audio and duration_of_bytes(audio) > 0.8:
                print(f"  ✓ chạy được: {how} · giọng {v}")
                return {"how": how, "voice": v}
            if st in (401, 403):
                warn(f"TTS: khoá bị từ chối (HTTP {st}) — kiểm secret TTS_API_KEY/IMG_API_KEY"); return None
            if st in (404, 405) or (st == 0 and "URLError" in why): break          # đường này không có → cách kế tiếp
            if st == 400 and re.search(r"model", why + str(LOG[-1].get("body", "")), re.I) and not re.search(r"voice", str(LOG[-1].get("body", "")), re.I):
                break                                                              # model không hợp đường này
            time.sleep(0.4)
    return None


# ------------------------------------------------------------------ âm thanh
def ff(*a, **kw):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", *a], check=True, capture_output=True, **kw)


def decode(path_or_bytes, tempo=1.0):
    """→ float32 mono 48 kHz (atempo nếu tempo ≠ 1)"""
    af = ["-af", f"atempo={tempo:.4f}"] if abs(tempo - 1) > 1e-3 else []
    if isinstance(path_or_bytes, (bytes, bytearray)):
        p = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-i", "pipe:0", *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
                           input=bytes(path_or_bytes), capture_output=True)
    else:
        p = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-i", path_or_bytes, *af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
                           capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode("utf-8", "replace")[:300])
    return np.frombuffer(p.stdout, dtype="<f4").astype(np.float64)


def duration_of_bytes(b):
    try: return len(decode(b)) / SR
    except Exception: return 0.0


def write_wav(path, x, ch=1):
    x = np.clip(x, -1, 1)
    pcm = (x.T if ch > 1 else x) * 32767
    with wave.open(path, "wb") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.astype("<i2").tobytes())


def lufs(x):
    """độ to tích hợp (EBU R128) của mảng mono — đo bằng ffmpeg ebur128"""
    if len(x) < SR * 0.5 or np.abs(x).max() < 1e-5: return -70.0
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0", "-af", "ebur128", "-f", "null", "-"],
                       input=x.astype("<f4").tobytes(), capture_output=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr.decode("utf-8", "replace"))
    return float(m[-1]) if m else -70.0


def trim_silence(x, thr_db=-45, pad=0.04):
    a = np.abs(x); thr = 10 ** (thr_db / 20) * max(1e-9, a.max())
    win = int(SR * 0.01); env = np.convolve(a, np.ones(win) / win, mode="same")
    idx = np.where(env > thr)[0]
    if not len(idx): return x
    i0 = max(0, idx[0] - int(pad * SR)); i1 = min(len(x), idx[-1] + int(pad * SR))
    out = x[i0:i1].copy(); f = int(0.008 * SR)
    if len(out) > 2 * f: out[:f] *= np.linspace(0, 1, f); out[-f:] *= np.linspace(1, 0, f)
    return out


def norm16(x, target=-16.0):
    L = lufs(x); g = 10 ** ((target - L) / 20) if L > -69 else 1.0
    y = x * g
    pk = np.abs(y).max()
    if pk > 0.89: y = np.tanh(y / 0.89 * 1.0) * 0.89 if pk > 1.2 else y * (0.89 / pk)   # đỉnh ≤ −1 dBFS
    return y, L


# ------------------------------------------------------------------ timeline
def load_tl():
    p = os.path.join(BUILD, "timeline.resolved.json")
    if not os.path.exists(p): subprocess.run([sys.executable, os.path.join(HERE, "prep.py")], check=True)
    return json.load(open(p, encoding="utf-8"))


def slots(vo, tl, ext=None):
    """start/end/hard (giây) của từng đoạn theo timeline hiện tại. hard = giới hạn cứng (không đè đoạn sau / khoảng lặng)."""
    C = {c["id"]: c for c in tl["chapters"]}; ext = ext or {}
    out = []
    for i, ln in enumerate(vo["lines"]):
        c = C[ln["chapter"]]; t0, t1 = c["t0"], c["t1"]
        xs = float(c.get("voice_ext_beats", 0)) * tl["beat"]          # chương đã được tts.py kéo dài → mốc "until" dời theo
        s = t0 + float(ln.get("at", 0.5))
        e = (t0 + float(ln["until"]) + xs) if "until" in ln else (t1 - float(ln.get("tail", 0.4)))
        hard = (t0 + float(ln["hard_until"]) + xs) if "hard_until" in ln else t1 + 0.15
        out.append({"i": i, "chapter": ln["chapter"], "start": round(s, 3), "end": round(e, 3), "hard": hard, "text": ln["text"]})
    for k in range(len(out) - 1):
        out[k]["hard"] = round(min(out[k]["hard"], out[k + 1]["start"] - 0.3), 3)
    out[-1]["hard"] = round(min(out[-1]["hard"], tl["duration"] - 0.3), 3)
    return out


def check(vo, tl, quiet=False):
    lo, hi = vo.get("wps", [2.3, 2.6]); bad = 0; rows = []
    for s in slots(vo, tl):
        w = len(s["text"].split()); d = s["end"] - s["start"]; r = w / d
        ok = lo - 0.05 <= r <= hi + 0.05
        bad += 0 if ok else 1
        rows.append(f"  {'✓' if ok else '!'} {s['chapter']:<10} {s['start']:7.2f}–{s['end']:7.2f} ({d:5.2f}s) {w:3d} từ  {r:.2f} từ/s")
    tot_w = sum(len(l["text"].split()) for l in vo["lines"])
    if not quiet: print("\n".join(rows)); print(f"  tổng {tot_w} từ · {len(vo['lines'])} đoạn · {bad} đoạn ngoài {lo}–{hi} từ/s")
    return bad


def extend_chapter(cid, beats_add):
    """kéo dài chương cid thêm beats_add phách trong timeline.json (shot cuối dài thêm) — ghi lại bản vá"""
    p = os.path.join(HERE, "timeline.json"); tl = json.load(open(p, encoding="utf-8"))
    for c in tl["chapters"]:
        if c["id"] == cid:
            c["beats"] = c["beats"] + beats_add
            c["shots"][-1]["beats"] = c["shots"][-1]["beats"] + beats_add
            c["voice_ext_beats"] = c.get("voice_ext_beats", 0) + beats_add      # ghi dấu: tts.py đã kéo dài (để mốc lời "until" dời theo)
            break
    with open(p, "w", encoding="utf-8") as f: json.dump(tl, f, ensure_ascii=False, indent=2); f.write("\n")
    subprocess.run([sys.executable, os.path.join(HERE, "prep.py")], check=True, capture_output=True)


# ------------------------------------------------------------------ chính
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="chỉ đếm từ/giây (không gọi API)")
    ap.add_argument("--fit-timeline", action="store_true", help="lời dài hơn chương → kéo dài chương trong timeline.json (bội 4 phách)")
    ap.add_argument("--max-tempo", type=float, default=1.10)
    ap.add_argument("--strict", action="store_true", help="TTS lỗi → mã thoát 1 (mặc định: cảnh báo, video vẫn có nhạc)")
    ap.add_argument("--force", action="store_true", help="tạo lại mọi đoạn (bỏ cache)")
    args = ap.parse_args()
    vo = json.load(open(os.path.join(HERE, "voiceover.json"), encoding="utf-8"))
    model = (os.environ.get("TTS_MODEL") or vo.get("model") or "minimax-speech-2.8-turbo").strip()
    tl = load_tl()
    print(f"Lời đọc: {len(vo['lines'])} đoạn · model {model} @ {BASE}")
    check(vo, tl)
    if args.check: return 0
    os.makedirs(VDIR, exist_ok=True); os.makedirs(QADIR, exist_ok=True)
    out_wav = os.path.join(VDIR, "voice.wav")
    if os.path.exists(out_wav): os.remove(out_wav)
    report = {"ok": False, "model": model, "base": BASE, "recipe": None, "lines": [], "warnings": [], "timeline_ext": {}}

    def finish(code):
        with open(os.path.join(QADIR, "tts-log.json"), "w", encoding="utf-8") as f: json.dump(LOG, f, ensure_ascii=False, indent=1)
        with open(os.path.join(VDIR, "report.json"), "w", encoding="utf-8") as f: json.dump(report, f, ensure_ascii=False, indent=1)
        txt = [f"Giọng đọc: {'ĐẠT' if report['ok'] else 'KHÔNG CÓ (video dùng nhạc không lời)'} · model {model} · recipe {report['recipe']}"]
        for l in report["lines"]:
            txt.append(f"  {l['chapter']:<10} chỗ {l['start']:7.2f}–{l['end']:7.2f} · đặt {l['placed'][0]:7.2f}–{l['placed'][1]:7.2f} "
                       f"({l['dur']:.2f}s, atempo {l['tempo']:.3f}, gốc {l['lufs_in']:.1f} LUFS)")
        txt += [f"  ! {w}" for w in report["warnings"]]
        if report["timeline_ext"]: txt.append("  timeline.json đã kéo dài (phách): " + json.dumps(report["timeline_ext"], ensure_ascii=False))
        with open(os.path.join(QADIR, "report.txt"), "w", encoding="utf-8") as f: f.write("\n".join(txt) + "\n")
        print("\n".join(txt))
        return code

    if not KEY:
        warn("TTS: thiếu TTS_API_KEY/IMG_API_KEY — video sẽ chỉ có nhạc (không lời)")
        report["warnings"].append("thiếu khoá API"); return finish(1 if args.strict else 0)
    if not re.match(r"^(https://|http://127\.0\.0\.1[:/])", BASE):     # http chỉ cho máy chủ giả khi kiểm thử
        warn("TTS_API_BASE phải là https://"); report["warnings"].append("base không phải https"); return finish(1 if args.strict else 0)

    # 1) dò giọng + cách gọi
    disc, found = discover_voices()
    report["voices_found"] = found
    voices = list(dict.fromkeys(([VOICE_ENV] if VOICE_ENV else []) + disc + DEFAULT_VOICES))
    recipe = probe(model, voices)
    if not recipe:
        warn("TTS: không cách gọi/giọng nào chạy được — xem build/qa/voice/tts-log.json (đã che khoá) để chỉnh TTS_RECIPE/TTS_VOICE")
        report["warnings"].append("không dò được cách gọi"); return finish(1 if args.strict else 0)
    report["recipe"] = recipe

    # 2) mỗi đoạn 1 mp3 (cache)
    clips = []
    for i, ln in enumerate(vo["lines"]):
        fn = os.path.join(VDIR, f"{i:02d}-{ln['chapter']}.mp3"); meta = fn[:-4] + ".json"
        h = hashlib.sha1(json.dumps([ln["text"], model, SPEED, PITCH, recipe], ensure_ascii=False).encode("utf-8")).hexdigest()[:12]
        if not args.force and os.path.exists(fn) and os.path.exists(meta) and json.load(open(meta)).get("hash") == h:
            clips.append(fn); continue
        audio = None
        for k in range(4):
            audio, st, why = call(recipe, model, ln["text"], f"đoạn {i} ({ln['chapter']}) lần {k + 1}")
            if audio: break
            if k == 2:                                                     # lỗi lặp → dò lại cách khác
                r2 = probe(model, [recipe["voice"]] + [v for v in voices if v != recipe["voice"]][:3])
                if r2: recipe = report["recipe"] = r2
            time.sleep(2 * (k + 1))
        if not audio:
            report["warnings"].append(f"đoạn {i} ({ln['chapter']}) lỗi TTS — bỏ qua đoạn này"); clips.append(None); continue
        with open(fn, "wb") as f: f.write(audio)
        json.dump({"hash": h, "text": ln["text"], "recipe": recipe}, open(meta, "w", encoding="utf-8"), ensure_ascii=False)
        clips.append(fn)
    if not any(clips):
        warn("TTS: không tạo được đoạn nào — video dùng nhạc không lời"); return finish(1 if args.strict else 0)

    # 3) đo độ dài sau khi cắt lặng; khớp timeline (ưu tiên kéo dài chương)
    raw = [trim_silence(decode(c)) if c else None for c in clips]
    beat = tl["beat"]
    for it in range(2 * len(vo["lines"])):
        S = slots(vo, tl); changed = False
        for s, x in zip(S, raw):
            if x is None: continue
            d = len(x) / SR; room = s["hard"] - s["start"]
            if d > room + 1e-3 and args.fit_timeline:
                need = d - room + 0.3
                add = int(math.ceil(need / (4 * beat)) * 4)
                print(f"  ↔ {s['chapter']}: lời {d:.2f}s > chỗ {room:.2f}s → kéo dài chương +{add} phách ({add * beat:.2f}s)")
                extend_chapter(s["chapter"], add)
                report["timeline_ext"][s["chapter"]] = report["timeline_ext"].get(s["chapter"], 0) + add
                tl = load_tl(); changed = True; break
        if not changed: break

    # 4) đặt lên trục thời gian
    S = slots(vo, tl)
    dur = tl["duration"]; track = np.zeros(int((dur + 1.0) * SR))
    cursor = 0.0
    for s, x, c in zip(S, raw, clips):
        if x is None: continue
        d0 = len(x) / SR; start = max(s["start"], cursor + 0.25 if cursor else s["start"]); room = s["hard"] - start
        tempo = 1.0
        if d0 > room:
            tempo = min(args.max_tempo, d0 / max(room, 0.1))
            if tempo > 1.0005: x = trim_silence(decode(c, tempo))
        d = len(x) / SR
        if d > s["hard"] - start + 1e-3:
            msg = f"{s['chapter']}: lời dài {d:.2f}s > chỗ {s['hard'] - start:.2f}s dù atempo {tempo:.2f} → lấn {d - (s['hard'] - start):.2f}s sang sau (dời đoạn kế); nên rút lời hoặc chạy --fit-timeline"
            warn("TTS " + msg); report["warnings"].append(msg)
        y, Lin = norm16(x)
        i0 = int(round(start * SR)); i1 = min(len(track), i0 + len(y))
        track[i0:i1] += y[:i1 - i0]
        cursor = start + d
        report["lines"].append({"i": s["i"], "chapter": s["chapter"], "start": s["start"], "end": s["end"], "hard": s["hard"],
                                "placed": [round(start, 3), round(start + d, 3)], "dur": round(d, 3), "tempo": round(tempo, 4),
                                "lufs_in": round(Lin, 1), "file": os.path.relpath(c, BUILD)})
    track = track[:int((dur + 0.05) * SR)]
    Lt = lufs(track)
    if Lt > -69: track *= 10 ** ((-16.0 - Lt) / 20)
    pk = np.abs(track).max()
    if pk > 0.89: track *= 0.89 / pk
    write_wav(out_wav, track)
    report["ok"] = True; report["lufs"] = round(lufs(track), 2); report["peak_dbfs"] = round(20 * math.log10(max(1e-9, np.abs(track).max())), 2)
    report["segments"] = [l["placed"] for l in report["lines"]]
    print(f"✓ {out_wav} · {report['lufs']} LUFS · đỉnh {report['peak_dbfs']} dBFS · {len(report['lines'])} đoạn")
    return finish(0)


if __name__ == "__main__":
    sys.exit(main())
