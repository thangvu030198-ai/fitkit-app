#!/usr/bin/env python3
"""TapEasy — dò & tạo mẫu GIỌNG TIẾNG VIỆT BẢN NGỮ (giọng Bắc) qua apivn để thay giọng tiếng Anh nói tiếng Việt (bị lơ lớ).

1) Dò danh sách model/giọng của apivn (GET /models, /audio/voices…) → media/voice-samples/vn/discovered.json (không chứa khoá).
2) Thử các ứng viên: giọng Việt có sẵn của MiniMax + mọi giọng dò được có chữ viet/vi_/vn, + model TTS khác (Gemini/OpenAI…) nếu có.
3) Ghi mp3 + index.html nghe thử. Khoá: IMG_API_KEY (không in ra log).
"""
import html, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "media", "voice-samples", "vn")
spec = importlib.util.spec_from_file_location("intro_tts", os.path.join(HERE, "..", "intro-video", "tts.py"))
T = importlib.util.module_from_spec(spec); spec.loader.exec_module(T)

TEXT = ("Tập mãi mà không lên cơ? Khoan đã! Có thể bạn đang ăn sai calo đấy. "
        "Mở TapEasy, nhập chiều cao, cân nặng, một chạm là ra ngay lượng calo mỗi ngày của bạn. Thử ngay nhé!")
STYLE = ("Read the following Vietnamese text aloud in a native Hanoi (Northern Vietnamese) accent, as a young Vietnamese man "
         "around 25 who is a popular TikTok product reviewer: energetic, warm and conversational like talking to a friend, "
         "punchy emphasis on key words, crisp clear articulation of every tone, natural pace with short natural pauses at commas "
         "and periods, never robotic. Only speak the Vietnamese text")
MM = "minimax-speech-2.8-turbo"
MMHD = "minimax-speech-2.8-hd"


def dur(b):
    try: return round(len(T.decode(bytes(b))) / T.SR, 2)
    except Exception: return None


def pcm_wav(pcm, sr=24000):
    import struct
    return (b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16)
            + b"data" + struct.pack("<I", len(pcm)) + pcm)


def http_goog(url, body, timeout=180):
    """POST kiểu Gemini gốc: khoá ở header (Bearer + x-goog-api-key), KHÔNG để trong URL."""
    import urllib.request, urllib.error
    req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST", headers={
        "Authorization": f"Bearer {T.KEY}", "x-goog-api-key": T.KEY, "Content-Type": "application/json", "User-Agent": "tapeasy-tts/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, (r.headers.get("Content-Type") or ""), r.read()
    except urllib.error.HTTPError as e:
        try: b = e.read()
        except Exception: b = b""
        return e.code, (e.headers.get("Content-Type") or "") if e.headers else "", b
    except Exception as e:
        return 0, "", T.redact(f"{type(e).__name__}: {e}").encode("utf-8")


def gemini_call(model, voice, text, style):
    """Gemini TTS qua apivn: thử /audio/speech (mp3/wav/pcm) — PCM thô 24 kHz → bọc WAV."""
    import base64
    inp = (style + ": " + text) if style else text
    root = T.BASE[:-3] if T.BASE.endswith("/v1") else T.BASE
    gen = {"contents": [{"role": "user", "parts": [{"text": inp}]}],
           "generationConfig": {"responseModalities": ["AUDIO"],
                                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    # 1) định dạng gốc Gemini (v1beta generateContent) — apivn /audio/speech báo "not implemented" cho Gemini
    for url in (root + f"/v1beta/models/{model}:generateContent", T.BASE + f"/models/{model}:generateContent"):
        st, ct, b = http_goog(url, gen)
        T.log_attempt("gemini/native", url, voice, st, ct, b, model)
        if st == 200:
            try:
                j = json.loads(b.decode("utf-8"))
                cands = j if isinstance(j, list) else [j]                    # có thể trả nhiều khối (stream gộp)
                pcm = b""
                for blk in cands:
                    for c in blk.get("candidates", []):
                        for p in (c.get("content") or {}).get("parts", []):
                            d = (p.get("inlineData") or p.get("inline_data") or {}).get("data")
                            if d: pcm += base64.b64decode(d)
                print(f"  gemini {voice}: {len(pcm)} byte PCM ≈ {len(pcm) / 48000:.1f} s", flush=True)
                if len(pcm) > 48000: return pcm if T.looks_audio(pcm) else pcm_wav(pcm)
            except Exception as e:
                print("  gemini parse:", T.redact(e)[:120])
    # 2) chat/completions kiểu OpenAI có audio
    body = {"model": model, "messages": [{"role": "user", "content": inp}], "modalities": ["audio"], "audio": {"voice": voice, "format": "wav"}}
    st, ct, b = T.http("POST", T.BASE + "/chat/completions", body)
    T.log_attempt("gemini/chat", T.BASE + "/chat/completions", voice, st, ct, b, model)
    if st == 200:
        try:
            j = json.loads(b.decode("utf-8"))
            d = j["choices"][0]["message"].get("audio", {}).get("data")
            if d:
                raw = base64.b64decode(d)
                return raw if T.looks_audio(raw) else pcm_wav(raw)
        except Exception as e:
            print("  gemini chat parse:", T.redact(e)[:120])
    for fmt in ("mp3", "wav", "pcm"):
        body = {"model": model, "input": inp, "voice": voice, "response_format": fmt}
        st, ct, b = T.http("POST", T.BASE + "/audio/speech", body)
        T.log_attempt("gemini/" + fmt, T.BASE + "/audio/speech", voice, st, ct, b, model)
        if st != 200 or not b or len(b) < 2000: continue
        if T.looks_audio(b): return b
        if b[:1] in (b"{", b"["):
            a, why = T.extract_audio(st, ct, b)
            if a: return a
            continue
        return pcm_wav(b)                                                  # PCM thô (audio/L16, audio/pcm…)
    return None


def models_list():
    st, ct, b = T.http("GET", T.BASE + "/models", timeout=40)
    try: j = json.loads(b.decode("utf-8"))
    except Exception: return []
    data = j.get("data", j) if isinstance(j, dict) else j
    return [str(x.get("id")) for x in data if isinstance(x, dict) and x.get("id")]


def main():
    if not T.KEY: print("thiếu IMG_API_KEY"); return 1
    os.makedirs(OUT, exist_ok=True)
    ids = models_list()
    tts_models = list(dict.fromkeys([m for m in ids if re.search(r"speech|tts|t2a|audio|voice", m, re.I)] + ["gemini-3.1-flash-tts-preview"]))
    _, found = T.discover_voices()
    vn_voices = [v["id"] for v in found if re.search(r"viet|vi[_-]|vn|vietnam", v["id"] + json.dumps(v.get("raw", {}), ensure_ascii=False), re.I)]
    json.dump({"tts_models": tts_models, "all_models_count": len(ids), "voices_found": found[:200], "vn_voices": vn_voices},
              open(os.path.join(OUT, "discovered.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"model TTS: {tts_models}\ngiọng Việt dò được: {vn_voices}", flush=True)

    # (nhãn, model, voice, speed, emotion, how-order)
    # Ưu tiên: nam trẻ giọng Bắc, kiểu reviewer TikTok, tự nhiên như người thật → Gemini TTS (điều khiển giọng bằng lời dặn)
    GM = "gemini-3.1-flash-tts-preview"
    C = []
    for v, tag in [("Puck", "sôi nổi"), ("Fenrir", "hào hứng"), ("Achird", "thân thiện"), ("Sadachbia", "lanh lợi"),
                   ("Zubenelgenubi", "thoải mái"), ("Umbriel", "dễ nghe"), ("Iapetus", "rõ ràng"), ("Algieba", "mượt")]:
        C.append((f"Gemini · {v} · nam trẻ Hà Nội kiểu reviewer ({tag})", GM, v, 1.0, "GEMINI", ()))
    C.append(("Tham khảo: MiniMax nam tiếng Việt (Vietnamese_male_1)", MM, "Vietnamese_male_1", 1.0, "happy", ("openai_vs",)))

    rows, seen = [], set()
    for i, (label, model, voice, speed, emo, hows) in enumerate(C, 1):
        if (model, voice) in seen: continue
        seen.add((model, voice))
        T.SPEED, T.PITCH, T.EMOTION = speed, 0, emo
        ok = None
        if emo == "GEMINI":
            T.EMOTION = ""
            a = gemini_call(model, voice, TEXT, STYLE)
            if a: ok = ("gemini", a)
        for how in hows:
            audio, st, why = T.call({"how": how, "voice": voice}, model, TEXT, f"vn {i}")
            if audio and len(audio) > 2000: ok = (how, audio); break
        if not ok:
            print(f"  ✗ {model} · {voice}", flush=True); continue
        ext = ".wav" if ok[1][:4] == b"RIFF" else ".mp3"
        fn = re.sub(r"[^A-Za-z0-9._-]+", "_", f"{len(rows) + 1:02d}-{model}-{voice}")[:80] + ext
        open(os.path.join(OUT, fn), "wb").write(ok[1])
        rows.append({"n": len(rows) + 1, "label": label, "model": model, "voice": voice, "how": ok[0], "file": fn, "dur": dur(ok[1])})
        print(f"  ✓ {fn} ({ok[0]}, {rows[-1]['dur']} s)", flush=True)
    json.dump(T.LOG, open(os.path.join(OUT, "tts-log.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)   # đã che khoá
    json.dump({"text": TEXT, "samples": rows}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    items = "\n".join(
        f'<li><b>Giọng số {r["n"]:02d}</b> — {html.escape(r["label"])}<br><small>{html.escape(r["voice"])} · {html.escape(r["model"])}</small><br>'
        f'<audio controls preload="none" src="{html.escape(r["file"])}"></audio></li>' for r in rows)
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TapEasy — giọng tiếng Việt bản ngữ</title>
<style>body{{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;background:#061A24;color:#eef}}li{{margin:14px 0;list-style:none;padding:12px;border-radius:12px;background:#0d2a36}}audio{{width:100%;margin-top:6px}}small{{color:#9ad}}</style>
<h2>TapEasy — giọng tiếng Việt bản ngữ</h2><p>Câu mẫu: “{html.escape(TEXT)}”</p><p>Chọn giọng chuẩn Bắc ưng nhất và báo lại số.</p><ul>{items}</ul>"""
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)
    print(f"xong: {len(rows)} giọng")
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
