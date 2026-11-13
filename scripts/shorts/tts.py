#!/usr/bin/env python3
"""TapEasy Shorts — giọng đọc TTS từng nhịp của từng short (nam, trầm ấm, tiếng Việt).

Dùng lại cách gọi đã chạy được của intro: nạp scripts/intro-video/tts.py như module (HTTP OpenAI-compatible
POST {base}/audio/speech, model minimax-speech-2.8-turbo, giọng Deep_Voice_Man, tự dò cách gọi/giọng khác nếu lỗi, che khoá).
KHOÁ KHÔNG BAO GIỜ nằm trong mã/log: env TTS_API_KEY (workflow: secrets.IMG_API_KEY), TTS_API_BASE (mặc định https://apivn.vn/v1).

Mỗi đoạn = build/voice/<id>/NN.mp3 (+ .json hash: lời + model + giọng + tốc độ) → có cache, chạy lại chỉ gọi đoạn đổi lời.
Ra build/voice/<id>/segs.json {"durs": {"0": giây, …, "end": giây}, "files": {...}} (độ dài SAU khi cắt lặng) → prep.js
canh nhịp theo lời thật. Short nào lỗi dù 1 đoạn → bỏ giọng cả short đó (video vẫn có nhạc + phụ đề) và GHI LOG RÕ:
build/qa/voice/report.txt, tts-log.json (đã che khoá), ::warning:: trên Actions. Mã thoát 0 (trừ --strict).

  TTS_API_KEY=… python3 scripts/shorts/tts.py [--ids a,b] [--force]
  python3 scripts/shorts/tts.py --check        # chỉ đếm từ & thời lượng ước tính, không gọi API
"""
import argparse, hashlib, importlib.util, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
VDIR = os.path.join(HERE, "build", "voice")
QADIR = os.path.join(HERE, "build", "qa", "voice")
GH = os.environ.get("GITHUB_ACTIONS") == "true"


def load_intro_tts():
    spec = importlib.util.spec_from_file_location("intro_tts", os.path.join(HERE, "..", "intro-video", "tts.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def warn(m): print(("::warning::" if GH else "! ") + m, flush=True)


def segments(s, end_say):
    out = [(str(i), b.get("say", "")) for i, b in enumerate(s["beats"]) if b.get("say")]
    if end_say: out.append(("end", end_say))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()
    series = json.load(open(os.path.join(HERE, "series.json"), encoding="utf-8"))
    ids = [x for x in args.ids.split(",") if x]
    shorts = [s for s in series["shorts"] if not ids or s["id"] in ids]
    end_say = (series.get("end_card") or {}).get("say", "")
    wps = series.get("wps", 2.4)
    if args.check:
        for s in shorts:
            w = sum(len(t.split()) for _, t in segments(s, end_say))
            print(f"  {s['id']:<20} {w:3d} từ ≈ {w / wps:5.1f} s lời")
        return 0
    os.makedirs(QADIR, exist_ok=True)
    T = load_intro_tts()
    model = (os.environ.get("TTS_MODEL") or (series.get("voice") or {}).get("model") or "minimax-speech-2.8-turbo").strip()
    pref = (os.environ.get("TTS_VOICE") or (series.get("voice") or {}).get("voice") or "Deep_Voice_Man").strip()
    VS = series.get("voice") or {}
    # chất giọng (series.json → voice): tốc độ / cao độ / cảm xúc; biến môi trường TTS_* vẫn được ưu tiên
    if not os.environ.get("TTS_SPEED") and VS.get("speed") is not None: T.SPEED = float(VS["speed"])
    if not os.environ.get("TTS_PITCH") and VS.get("pitch") is not None: T.PITCH = int(VS["pitch"])
    if not os.environ.get("TTS_EMOTION") and VS.get("emotion"): T.EMOTION = str(VS["emotion"])
    if not os.environ.get("TTS_RECIPE") and VS.get("how"): os.environ["TTS_RECIPE"] = str(VS["how"])
    rep = {"ok": [], "failed": {}, "model": model, "recipe": None, "warnings": []}

    def finish(code):
        with open(os.path.join(QADIR, "tts-log.json"), "w", encoding="utf-8") as f: json.dump(T.LOG, f, ensure_ascii=False, indent=1)
        with open(os.path.join(QADIR, "report.json"), "w", encoding="utf-8") as f: json.dump(rep, f, ensure_ascii=False, indent=1)
        lines = [f"Giọng đọc shorts · model {model} · recipe {rep['recipe']}",
                 f"  CÓ giọng ({len(rep['ok'])}): {', '.join(rep['ok']) or '—'}",
                 f"  KHÔNG giọng — chỉ nhạc + phụ đề ({len(rep['failed'])}): " + (", ".join(f"{k} ({v})" for k, v in rep["failed"].items()) or "—")]
        lines += [f"  ! {w}" for w in rep["warnings"]]
        with open(os.path.join(QADIR, "report.txt"), "w", encoding="utf-8") as f: f.write("\n".join(lines) + "\n")
        print("\n".join(lines))
        if rep["failed"]: warn(f"TTS: {len(rep['failed'])} short KHÔNG có giọng đọc (dùng nhạc + phụ đề): {', '.join(rep['failed'])} — xem build/qa/voice/report.txt")
        return code

    if not T.KEY:
        warn("TTS: thiếu TTS_API_KEY/IMG_API_KEY — mọi short chỉ có nhạc + phụ đề")
        for s in shorts: rep["failed"][s["id"]] = "thiếu khoá"
        return finish(1 if args.strict else 0)
    recipe = None
    if os.environ.get("TTS_RECIPE"): recipe = {"how": os.environ["TTS_RECIPE"], "voice": pref}
    else:
        recipe = T.probe(model, [pref])                                   # đường đã chạy ở intro: openai + Deep_Voice_Man
        if not recipe:
            disc, _ = T.discover_voices()
            recipe = T.probe(model, list(dict.fromkeys([pref] + disc + T.DEFAULT_VOICES)))
    if not recipe:
        warn("TTS: không cách gọi/giọng nào chạy được — xem build/qa/voice/tts-log.json (đã che khoá)")
        for s in shorts: rep["failed"][s["id"]] = "không dò được cách gọi"
        return finish(1 if args.strict else 0)
    rep["recipe"] = recipe
    for s in shorts:
        d = os.path.join(VDIR, s["id"]); os.makedirs(d, exist_ok=True)
        segp = os.path.join(d, "segs.json")
        if os.path.exists(segp): os.remove(segp)
        durs, files, bad = {}, {}, None
        for key, text in segments(s, end_say):
            fn = os.path.join(d, f"{key}.mp3"); meta = fn[:-4] + ".json"
            h = hashlib.sha1(json.dumps([text, model, recipe, T.SPEED, T.PITCH, getattr(T, "EMOTION", "")], ensure_ascii=False).encode("utf-8")).hexdigest()[:14]
            cached = not args.force and os.path.exists(fn) and os.path.exists(meta) and json.load(open(meta)).get("hash") == h
            if not cached:
                audio = None
                for k in range(3):
                    audio, st, why = T.call(recipe, model, text, f"{s['id']}#{key} lần {k + 1}")
                    if audio: break
                    if st in (401, 403): break
                    time.sleep(2 * (k + 1))
                if not audio: bad = f"đoạn {key} lỗi"; break
                with open(fn, "wb") as f: f.write(audio)
                json.dump({"hash": h, "text": text}, open(meta, "w", encoding="utf-8"), ensure_ascii=False)
            try:
                x = T.trim_silence(T.decode(fn))
            except Exception as e:
                bad = f"đoạn {key} không giải mã được: {T.redact(e)[:80]}"; break
            durs[key] = round(len(x) / T.SR, 3); files[key] = os.path.relpath(fn, HERE)
        if bad:
            rep["failed"][s["id"]] = bad; continue
        json.dump({"durs": durs, "files": files, "model": model, "recipe": recipe}, open(segp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        rep["ok"].append(s["id"])
        print(f"  ✓ {s['id']:<20} {len(durs)} đoạn · lời {sum(durs.values()):.1f} s")
    return finish(1 if (args.strict and rep["failed"]) else 0)


if __name__ == "__main__":
    sys.exit(main())
