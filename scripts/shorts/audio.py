#!/usr/bin/env python3
"""TapEasy Shorts — nhạc nền tự tổng hợp (không bản quyền) + giọng đọc + hiệu ứng âm → build/audio/<id>.wav (48 kHz stereo).

Nhạc: dùng lại các khối âm của scripts/intro-video/music.py (kick, hat, clap, saw, whoosh, click, impact, riser — nạp như
module, không sửa file intro). 118 BPM, La thứ (Am–F–C–G), mỗi short 1 biến thể tất định (hạt giống theo id).
  - impact + nhấn ở khung đầu (hook), whoosh 2–3 khung trước mỗi cắt cảnh, tick nhẹ ở bước thẻ, riser → impact vào thẻ kết.
  - Có lời: nhạc hạ ~10 dB dưới lời (đường bao attack 60 ms / release 350 ms). Không lời (TTS lỗi): nhạc to hơn.
Lời: build/voice/<id>/<key>.mp3 (tts.py) cắt lặng, chuẩn hoá −16 LUFS, đặt đúng mốc plan (tempo nếu prep.js yêu cầu).
Chuẩn hoá cuối −14 LUFS / −1 dBTP làm ở finalize.py trên MP4.

  python3 scripts/shorts/audio.py --ids bmr-tdee,giac-ngu
"""
import argparse, importlib.util, json, math, os, sys, wave, zlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 48000
GH = os.environ.get("GITHUB_ACTIONS") == "true"


def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, "..", "intro-video", rel))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


M = load("intro_music", "music.py")
add, kick, hat, clap, saw, note, whoosh, click, impact, riser, lowpass, env_exp = (
    M.add, M.kick, M.hat, M.clap, M.saw, M.note, M.whoosh, M.click, M.impact, M.riser, M.lowpass, M.env_exp)
PROGS = [([57, 60, 64], 45), ([53, 57, 60], 41), ([48, 52, 55], 36), ([55, 59, 62], 43)]   # Am F C G


def music(P, seed):
    M.rng = np.random.default_rng(seed)                 # tất định theo short
    bpm = 118; beat = 60 / bpm; dur = P["duration"] + 0.5
    N = int(dur * SR); mus = np.zeros((2, N)); sfx = np.zeros((2, N))
    end0 = P["end"]["t0"]; rot = seed % 4
    K, HC, HO, CL = kick(), hat(), hat(True), clap()
    for b in range(int(dur / beat) + 1):
        t = b * beat; pos = b % 4; bar = b // 4
        if end0 - 0.45 <= t < end0: continue            # khoảng lặng ngắn trước impact thẻ kết
        if t < end0 - beat: add(mus, t, K, .85)
        add(mus, t + beat / 2, HC, .55, .25)
        if pos in (1, 3) and t < end0 - beat: add(mus, t, CL, .55, -.05)
        if pos == 3 and bar % 2: add(mus, t + beat / 2, HO, .4, .3)
    bar_len = beat * 4
    for k in range(int(dur / bar_len) + 1):
        t = k * bar_len; chord, root = PROGS[(k + rot) % 4]; n = int(bar_len * SR)
        pad = sum(saw(note(m), n, 8, d) for m in chord for d in (-.004, .004))
        att = np.minimum(1, np.arange(n) / (.3 * SR)); rel = np.minimum(1, (n - np.arange(n)) / (.2 * SR))
        add(mus, t, lowpass(pad * att * rel, 1400) * .06, 1.0, 0)
        if t < end0 - 0.2:
            for e in range(8):
                te = t + e * beat / 2
                if end0 - 0.45 <= te < end0: continue
                nn = int(beat / 2 * SR * .9)
                s = lowpass(saw(note(root + (12 if e in (3, 7) else 0)), nn, 10), 420) * env_exp(nn, .16) * .42
                add(mus, te, s, 1.0, 0)
        for e in range(16):                              # arp nhẹ
            te = t + e * beat / 4
            if te >= end0 + 2.0 or (end0 - 0.45 <= te < end0): continue
            m = chord[e % 3] + 12 + (12 if e % 8 >= 6 else 0); nn = int(beat / 4 * SR); tt = np.arange(nn) / SR
            s = (2 * np.abs(2 * (tt * note(m) % 1) - 1) - 1) * env_exp(nn, .05)
            add(mus, te, s * .05, 1.0, .35 if e % 2 else -.35)
    for i, d, g in ((0, .129, .2), (0, .258, .09)):
        j = int(d * SR); mus[:, j:] += mus[:, :-j] * g
    # hiệu ứng
    add(sfx, 0.0, impact(), .55)
    for ev in P["events"]:
        t = ev["t"]
        if ev["type"] == "cut":
            s, pk = whoosh(.36, .7); add(sfx, t - pk + 0.07, s, .55, .15)
        elif ev["type"] == "step": add(sfx, t, click(), .28, -.1)
    add(sfx, max(0, end0 - 2.0), riser(2.0), .45)
    add(sfx, end0, impact(), .7)
    # vào/ra
    fi = int(.05 * SR); mus[:, :fi] *= np.linspace(0, 1, fi)
    f0 = int((P["duration"] - 1.6) * SR); f1 = min(N, int((P["duration"] + .05) * SR))
    ramp = np.ones(N); ramp[f0:f1] = np.linspace(1, 0, f1 - f0); ramp[f1:] = 0
    return mus * ramp, sfx * ramp


def lufs(x):
    import subprocess, re
    x = np.atleast_2d(x)
    if x.shape[1] < SR // 2 or np.abs(x).max() < 1e-6: return -70.0
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[0]), "-i", "pipe:0",
                        "-af", "ebur128", "-f", "null", "-"], input=x.T.astype("<f4").tobytes(), capture_output=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr.decode("utf-8", "replace"))
    return float(m[-1]) if m else -70.0


def gain_to(x, target):
    L = lufs(x); return x * (10 ** ((target - L) / 20)) if L > -69 else x


def voice_track(P, sid):
    segp = os.path.join(BUILD, "voice", sid, "segs.json")
    if not os.path.exists(segp): return None, "không có segs.json (TTS lỗi/không khoá)"
    T = load("intro_tts", "tts.py")
    seg = json.load(open(segp, encoding="utf-8")); tempo = float(P.get("tempo") or 1.0)
    N = int((P["duration"] + 0.5) * SR); v = np.zeros(N)
    slots = [(str(b["i"]), b["voice"]) for b in P["beats"] if b.get("voice")] + ([("end", P["end"]["voice"])] if P["end"].get("voice") else [])
    for key, vo in slots:
        f = seg["files"].get(key)
        if not f: return None, f"thiếu đoạn {key}"
        x = T.trim_silence(T.decode(os.path.join(HERE, f), tempo))
        x, _ = T.norm16(x)
        i0 = int(round(vo["t0"] * SR)); i1 = min(N, i0 + len(x)); v[i0:i1] += x[:i1 - i0]
    return v, ""


def envelope(v, att=0.06, rel=0.35):
    a = np.abs(v); win = int(.02 * SR); a = np.convolve(a, np.ones(win) / win, mode="same")
    thr = 10 ** (-40 / 20) * max(1e-9, a.max()); g = (a > thr).astype(float)
    out = np.zeros_like(g); ka, kr = 1 / (att * SR), 1 / (rel * SR); y = 0.0
    # theo khối 10 ms cho nhanh
    blk = int(.01 * SR)
    for i in range(0, len(g), blk):
        tgt = g[i:i + blk].max() if len(g[i:i + blk]) else 0
        y = min(1, y + ka * blk) if tgt > y else max(0, y - kr * blk)
        out[i:i + blk] = y
    return out


def write_wav(p, x):
    x = np.clip(np.atleast_2d(x), -1, 1)
    with wave.open(p, "wb") as w:
        w.setnchannels(x.shape[0]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x.T * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    args = ap.parse_args()
    ids = [x for x in args.ids.split(",") if x] or [f[:-5] for f in sorted(os.listdir(os.path.join(BUILD, "plans"))) if f.endswith(".json") and f != "index.json"]
    os.makedirs(os.path.join(BUILD, "audio"), exist_ok=True); os.makedirs(os.path.join(BUILD, "qa"), exist_ok=True)
    rep = []
    for sid in ids:
        P = json.load(open(os.path.join(BUILD, "plans", sid + ".json"), encoding="utf-8"))
        mus, sfx = music(P, zlib.crc32(sid.encode()) % 100000)
        v, why = voice_track(P, sid)
        N = mus.shape[1]
        if v is not None:
            v = v[:N]
            if len(v) < N: v = np.pad(v, (0, N - len(v)))
            mus = gain_to(mus, -24.0)                                   # nền ~8 dB dưới lời (−16) …
            duck = 1 - 0.55 * envelope(v)                                # … và hạ thêm ~7 dB khi đang có lời
            mix = mus * duck + sfx * 0.5 + np.vstack([v, v]) * 0.92
            note_ = "nhạc + giọng đọc (hạ nhạc dưới lời)"
        else:
            mus = gain_to(mus, -16.0)
            mix = mus + sfx * 0.6
            note_ = "CHỈ NHẠC + phụ đề — " + why
            print(("::warning::" if GH else "! ") + f"{sid}: {note_}")
        mix = mix[:, :int((P["duration"] + 0.02) * SR)]
        pk = np.abs(mix).max()
        if pk > 0.89: mix *= 0.89 / pk
        out = os.path.join(BUILD, "audio", sid + ".wav"); write_wav(out, mix)
        rep.append(f"{sid:<20} {P['duration']:5.1f}s · {note_} · {lufs(mix):.1f} LUFS trước chuẩn hoá")
        print("  ✓", rep[-1], flush=True)
    with open(os.path.join(BUILD, "qa", "audio-report.txt"), "a", encoding="utf-8") as f: f.write("\n".join(rep) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
