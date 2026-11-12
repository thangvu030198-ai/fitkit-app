#!/usr/bin/env python3
"""TapEasy intro — trộn nhạc nền + giọng đọc, nhạc tự hạ khi có lời (ducking sidechain) → build/mix.wav.

Vào: build/music.wav (music.py, stereo 48 kHz) + build/voice/voice.wav (tts.py, mono −16 LUFS) + build/voice/report.json.
  - Nhạc đưa về −18 LUFS (khi không có lời), lời giữ −16 LUFS.
  - ffmpeg sidechaincompress: lời làm tín hiệu điều khiển → nhạc dưới lời còn −22…−26 LUFS (đích −24). Ngưỡng/tỉ lệ được
    dò tự động (đo lại nhạc đã hạ TRONG các đoạn có lời); không đạt sau 6 lần → hạ bằng đường bao âm lượng tính sẵn
    (cùng mục tiêu, có attack 60 ms / release 350 ms) để luôn đúng dải.
  - Ghép: nhạc đã hạ + lời (amerge + pan, không chia đôi biên độ) → đỉnh ≤ −1 dBFS.
Không có voice.wav (TTS lỗi/không khoá) → build/mix.wav = nhạc không lời + cảnh báo. finalize.py ưu tiên build/mix.wav.
Ra thêm build/qa/voice/mix-report.txt (+ --mp3: build/qa/voice/mix-preview.mp3 để nghe thử).

  python3 scripts/intro-video/mix_audio.py [--mp3]
"""
import argparse, json, os, re, shutil, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
QADIR = os.path.join(BUILD, "qa", "voice")
SR = 48000
GH = os.environ.get("GITHUB_ACTIONS") == "true"
BED, DUCK_LO, DUCK_HI, DUCK_T = -18.0, -26.0, -22.0, -24.0


def warn(m): print(("::warning::" if GH else "! ") + m, flush=True)


def ff(args):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode: raise RuntimeError(p.stderr[-600:])


def read_wav(p):
    with wave.open(p) as w:
        ch, n, sr = w.getnchannels(), w.getnframes(), w.getframerate()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768
    assert sr == SR, f"{p}: {sr} Hz ≠ {SR}"
    return x.reshape(-1, ch).T                                  # (ch, n)


def write_wav(p, x):
    x = np.atleast_2d(np.clip(x, -1, 1))
    with wave.open(p, "wb") as w:
        w.setnchannels(x.shape[0]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x.T * 32767).astype("<i2").tobytes())


def lufs_arr(x):
    x = np.atleast_2d(x)
    if x.shape[1] < SR // 2 or np.abs(x).max() < 1e-6: return -70.0
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[0]), "-i", "pipe:0",
                        "-af", "ebur128", "-f", "null", "-"], input=x.T.astype("<f4").tobytes(), capture_output=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr.decode("utf-8", "replace"))
    return float(m[-1]) if m else -70.0


def segs_mask(n, segs, pad=0.0):
    m = np.zeros(n, bool)
    for a, b in segs:
        m[max(0, int((a + pad) * SR)):min(n, int((b - pad) * SR))] = True
    return m


def level_in(x, mask):
    return lufs_arr(x[:, mask]) if mask.any() else -70.0


def sidechain(music_p, voice_p, out_p, thr, ratio):
    ff(["-i", music_p, "-i", voice_p, "-filter_complex",
        f"[1:a]aformat=sample_rates={SR}:channel_layouts=stereo[sc];"
        f"[0:a][sc]sidechaincompress=threshold={thr:.5f}:ratio={ratio:.2f}:attack=15:release=380:knee=2.5:makeup=1[d]",
        "-map", "[d]", "-c:a", "pcm_s16le", "-ar", str(SR), out_p])


def envelope_duck(m, voice, depth_db):
    """đường bao: hạ depth_db khi có lời (cửa sổ 30 ms > −45 dBFS), attack 60 ms, release 350 ms"""
    a = np.abs(voice[0]); w = int(0.03 * SR)
    env = np.convolve(a, np.ones(w) / w, mode="same") > 10 ** (-45 / 20)
    g = np.where(env, 10 ** (-depth_db / 20), 1.0)
    out = np.empty_like(g); cur = 1.0
    ka, kr = 1 - np.exp(-1 / (0.06 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    for i in range(0, len(g), 64):                                  # mượt theo khối 64 mẫu (đủ mịn, nhanh)
        tgt = g[i:i + 64].min(); k = ka if tgt < cur else kr
        cur += (tgt - cur) * (1 - (1 - k) ** 64); out[i:i + 64] = cur
    return m * out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mp3", action="store_true", help="xuất thêm build/qa/voice/mix-preview.mp3")
    args = ap.parse_args()
    os.makedirs(QADIR, exist_ok=True)
    music_p, voice_p, out_p = os.path.join(BUILD, "music.wav"), os.path.join(BUILD, "voice", "voice.wav"), os.path.join(BUILD, "mix.wav")
    rep_p = os.path.join(BUILD, "voice", "report.json")
    if not os.path.exists(music_p): subprocess.run([sys.executable, os.path.join(HERE, "music.py")], check=True)
    lines = []
    if not os.path.exists(voice_p):
        warn("Không có giọng đọc (build/voice/voice.wav) — video dùng nhạc không lời. Xem build/qa/voice/report.txt")
        shutil.copyfile(music_p, out_p)
        open(os.path.join(QADIR, "mix-report.txt"), "w", encoding="utf-8").write("Trộn: KHÔNG có lời → nhạc nền nguyên bản\n")
        return 0
    rep = json.load(open(rep_p, encoding="utf-8")) if os.path.exists(rep_p) else {}
    m = read_wav(music_p); v = read_wav(voice_p)
    n = m.shape[1]
    v = np.pad(v, ((0, 0), (0, max(0, n - v.shape[1]))))[:, :n]
    segs = rep.get("segments") or []
    if not segs:                                                     # không có report → tự tìm đoạn có lời
        act = np.convolve(np.abs(v[0]), np.ones(int(.05 * SR)) / int(.05 * SR), mode="same") > 10 ** (-45 / 20)
        d = np.diff(np.r_[0, act.astype(int), 0]); segs = [[a / SR, b / SR] for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0])]
    mask = segs_mask(n, segs, pad=0.15); free = ~segs_mask(n, segs, pad=-0.6)
    # 1) nhạc về −18 LUFS, lời −16 LUFS
    Lm = lufs_arr(m); m *= 10 ** ((BED - Lm) / 20)
    Lv = lufs_arr(v); v *= 10 ** ((-16.0 - Lv) / 20) if Lv > -69 else 1
    tmp_m, tmp_v, tmp_d = (os.path.join(QADIR, f) for f in ("_m.wav", "_v.wav", "_d.wav"))
    peak = np.abs(m).max()
    if peak > 0.98: m *= 0.98 / peak
    write_wav(tmp_m, m); write_wav(tmp_v, v)
    # 2) dò ngưỡng/tỉ lệ sidechain cho nhạc dưới lời ≈ −24 LUFS
    thr, ratio, how, ducked, L_under = 0.03, 6.0, "sidechaincompress", None, 0
    tries = []
    for k in range(6):
        sidechain(tmp_m, tmp_v, tmp_d, thr, ratio)
        d = read_wav(tmp_d)
        d = np.pad(d, ((0, 0), (0, max(0, n - d.shape[1]))))[:, :n]   # ffmpeg có thể trả thiếu vài trăm ms → đệm về đúng n mẫu
        L_under = level_in(d, mask); tries.append((round(thr, 4), round(ratio, 2), round(L_under, 1)))
        if DUCK_LO <= L_under <= DUCK_HI: ducked = d; break
        if L_under > DUCK_HI: ratio = min(20, ratio * 1.6); thr = max(0.002, thr * 0.6)
        else: ratio = max(1.5, ratio / 1.5); thr = min(0.5, thr * 1.5)
    if ducked is None:
        how = "đường bao (dự phòng)"; depth = 6.0
        for k in range(5):
            ducked = envelope_duck(m, v, depth); L_under = level_in(ducked, mask)
            if DUCK_LO <= L_under <= DUCK_HI: break
            depth += (L_under - DUCK_T)
        tries.append(("envelope", round(depth, 1), round(L_under, 1)))
    L_free = level_in(ducked, free)
    # 3) ghép (amerge + pan: cộng thẳng, không chia đôi biên độ) → đỉnh ≤ −1 dBFS
    write_wav(tmp_d, ducked)
    ff(["-i", tmp_d, "-i", tmp_v, "-filter_complex",
        "[1:a]aformat=channel_layouts=stereo[v];[0:a][v]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3,alimiter=limit=0.89:level=0[o]",
        "-map", "[o]", "-c:a", "pcm_s16le", "-ar", str(SR), out_p])
    mix = read_wav(out_p)
    L_mix, L_voice = lufs_arr(mix), level_in(v, mask)
    ok = DUCK_LO <= L_under <= DUCK_HI
    txt = [f"Trộn nhạc + lời: {'ĐẠT' if ok else 'LỆCH'} · cách hạ nhạc: {how}",
           f"  lời {L_voice:.1f} LUFS (đích −16) · nhạc dưới lời {L_under:.1f} LUFS (đích {DUCK_LO:.0f}…{DUCK_HI:.0f}) · nhạc lúc không lời {L_free:.1f} LUFS",
           f"  bản trộn {L_mix:.1f} LUFS · đỉnh {20 * np.log10(max(1e-9, np.abs(mix).max())):.1f} dBFS · {len(segs)} đoạn lời · finalize.py chuẩn hoá −14 LUFS cuối",
           f"  các lần dò (ngưỡng, tỉ lệ, LUFS dưới lời): {tries}"]
    print("\n".join(txt))
    open(os.path.join(QADIR, "mix-report.txt"), "w", encoding="utf-8").write("\n".join(txt) + "\n")
    for f in (tmp_m, tmp_v, tmp_d):
        try: os.remove(f)
        except OSError: pass
    if args.mp3:
        ff(["-i", out_p, "-c:a", "libmp3lame", "-b:a", "192k", os.path.join(QADIR, "mix-preview.mp3")])
    if not ok: warn(f"Nhạc dưới lời {L_under:.1f} LUFS ngoài dải {DUCK_LO}…{DUCK_HI}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
