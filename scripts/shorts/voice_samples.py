#!/usr/bin/env python3
"""TapEasy — tạo bộ GIỌNG MẪU để chủ dự án nghe & chọn (cùng 1 câu, nhiều giọng/tốc độ/cảm xúc MiniMax qua apivn).

Ra media/voice-samples/NN-<voice>-<speed>.mp3 + index.json + index.html (trang nghe thử, mở trên GitHub Pages).
Khoá: IMG_API_KEY (secret) — không in ra log (dùng redact() của intro tts.py).

  python3 scripts/shorts/voice_samples.py
"""
import html, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "media", "voice-samples")

spec = importlib.util.spec_from_file_location("intro_tts", os.path.join(HERE, "..", "intro-video", "tts.py"))
T = importlib.util.module_from_spec(spec); spec.loader.exec_module(T)

TEXT = ("Tập mãi mà không lên cơ? Khoan đã! Có thể bạn đang ăn sai calo đấy. "
        "Mở TapEasy, nhập chiều cao, cân nặng, một chạm là ra ngay TDEE của bạn. Quá dễ luôn! Thử ngay nhé!")

# (nhãn, model, voice, speed, pitch, emotion) — 01 = giọng hiện tại để so sánh
CANDS = [
    ("Giọng hiện tại (nam trầm, tốc độ vừa)", "minimax-speech-2.8-turbo", "Deep_Voice_Man", 1.0, -2, ""),
    ("Nam trầm — nhanh, hào hứng",            "minimax-speech-2.8-turbo", "Deep_Voice_Man", 1.12, 0, "happy"),
    ("Nam quyết đoán — hào hứng",             "minimax-speech-2.8-turbo", "Determined_Man", 1.12, 0, "happy"),
    ("Nam trẻ năng lượng",                    "minimax-speech-2.8-turbo", "Young_Knight", 1.12, 0, "happy"),
    ("Nam trẻ tự nhiên, kiểu TikToker",       "minimax-speech-2.8-turbo", "Casual_Guy", 1.15, 0, "happy"),
    ("Nam trẻ lịch sự, sáng",                 "minimax-speech-2.8-turbo", "Decent_Boy", 1.12, 0, "happy"),
    ("Nam thân thiện",                        "minimax-speech-2.8-turbo", "Friendly_Person", 1.12, 0, "happy"),
    ("Nam lịch lãm",                          "minimax-speech-2.8-turbo", "Elegant_Man", 1.1, 0, "happy"),
    ("Nam uy lực (kiểu trailer)",             "minimax-speech-2.8-turbo", "Imposing_Manner", 1.08, 0, "surprised"),
    ("Nam trầm — bản HD, hào hứng",           "minimax-speech-2.8-hd",    "Deep_Voice_Man", 1.12, 0, "happy"),
    ("Nam trẻ năng lượng — bản HD",           "minimax-speech-2.8-hd",    "Young_Knight", 1.15, 1, "happy"),
    ("Nam quyết đoán — nhanh nhất",           "minimax-speech-2.8-turbo", "Determined_Man", 1.2, 1, "surprised"),
]


def main():
    if not T.KEY:
        print("thiếu IMG_API_KEY"); return 1
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for i, (label, model, voice, speed, pitch, emo) in enumerate(CANDS, 1):
        T.SPEED, T.PITCH, T.EMOTION = speed, pitch, emo
        ok = None
        for how in (("openai_vs", "openai") if emo or pitch else ("openai", "openai_vs")):
            audio, st, why = T.call({"how": how, "voice": voice}, model, TEXT, f"mẫu {i}")
            if audio: ok = (how, audio); break
        fn = f"{i:02d}-{voice}-{speed:g}.mp3"
        if ok:
            open(os.path.join(OUT, fn), "wb").write(ok[1])
            rows.append({"n": i, "label": label, "model": model, "voice": voice, "speed": speed, "pitch": pitch, "emotion": emo, "how": ok[0], "file": fn})
            print(f"  ✓ {fn}  ({label}, {ok[0]})", flush=True)
        else:
            rows.append({"n": i, "label": label, "model": model, "voice": voice, "speed": speed, "pitch": pitch, "emotion": emo, "error": "không tạo được"})
            print(f"  ✗ {voice} {model}", flush=True)
    json.dump({"text": TEXT, "samples": rows}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    items = "\n".join(
        f'<li><b>Giọng số {r["n"]:02d}</b> — {html.escape(r["label"])}<br><small>{html.escape(r["voice"])} · {html.escape(r["model"])} · tốc độ {r["speed"]} · cảm xúc {html.escape(r["emotion"] or "—")}</small><br>'
        + (f'<audio controls preload="none" src="{html.escape(r["file"])}"></audio>' if r.get("file") else "<i>lỗi tạo giọng</i>") + "</li>"
        for r in rows)
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TapEasy — chọn giọng đọc</title>
<style>body{{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;background:#061A24;color:#eef}}li{{margin:14px 0;list-style:none;padding:12px;border-radius:12px;background:#0d2a36}}audio{{width:100%;margin-top:6px}}small{{color:#9ad}}</style>
<h2>TapEasy — nghe & chọn giọng đọc</h2><p>Câu mẫu: “{html.escape(TEXT)}”</p><p>Chọn số giọng ưng nhất và báo lại.</p><ul>{items}</ul>"""
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)
    good = sum(1 for r in rows if r.get("file"))
    print(f"xong: {good}/{len(rows)} giọng")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
