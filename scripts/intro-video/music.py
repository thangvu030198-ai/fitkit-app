#!/usr/bin/env python3
"""TapEasy intro — nhạc nền tự tổng hợp (không bản quyền) + hiệu ứng âm, khớp timeline.

116 BPM, La thứ (Am–F–C–G). Kick 4/4, hi-hat móc, clap phách 2 & 4, bass móc 8 nốt, pad, arp ở cao trào.
Hiệu ứng: whoosh 2–3 khung trước chuyển cảnh (đặt theo đỉnh của chính âm), click đúng khung chạm,
1 riser + 1 impact cho khoảnh khắc chính (chương giao diện), ~0,4 s gần lặng trước impact.
Ra build/music.wav (48 kHz stereo). Chuẩn hoá -14 LUFS làm ở finalize.py (trên MP4).

  python3 scripts/intro-video/music.py
"""
import json, math, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
SR = 48000
rng = np.random.default_rng(116)          # hạt giống cố định → tất định


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))


def highpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    r = (f / fc) ** 2
    return np.fft.irfft(X * r / np.sqrt(1 + r * r), len(x))


def bandpass(x, lo, hi):
    return lowpass(highpass(x, lo), hi)


def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= buf.shape[1] or i + len(sig) <= 0: return
    a = max(0, i); b = min(buf.shape[1], i + len(sig)); s = sig[a - i:b - i] * gain
    buf[0, a:b] += s * math.cos((pan + 1) * math.pi / 4) * 1.41
    buf[1, a:b] += s * math.sin((pan + 1) * math.pi / 4) * 1.41


def kick():
    n = int(.42 * SR); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / .045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env_exp(n, .16)
    s[:200] += rng.standard_normal(200) * .25 * np.linspace(1, 0, 200)
    return np.tanh(s * 1.6) * .9


def hat(open_=False):
    n = int((.22 if open_ else .05) * SR)
    s = highpass(rng.standard_normal(n), 7000) * env_exp(n, .07 if open_ else .012)
    return s * .35


def clap():
    n = int(.3 * SR)
    s = bandpass(rng.standard_normal(n), 900, 4200)
    e = np.zeros(n)
    for k, d in enumerate([0, .011, .022]):
        i = int(d * SR); e[i:] += env_exp(n - i, .012 if k < 2 else .09)
    return s * e * .55


def saw(freq, n, harmonics=12, detune=0.0):
    t = np.arange(n) / SR; s = np.zeros(n)
    for h in range(1, harmonics + 1):
        s += np.sin(2 * np.pi * h * freq * (1 + detune) * t) / h
    return s * .55


def note(f):  # MIDI → Hz
    return 440 * 2 ** ((f - 69) / 12)


CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]     # Am F C G
ROOTS = [45, 41, 36, 43]


def whoosh(dur=.42, peak=.75, lo=300, hi=6000):
    n = int(dur * SR); x = rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    e = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / (1 - peak) * 4))
    # quét bộ lọc: trộn băng thấp → cao theo thời gian
    a = bandpass(x, lo, hi * .35); b = bandpass(x, hi * .3, hi)
    s = (a * (1 - t) + b * t) * e
    return s / (np.abs(s).max() + 1e-9) * .5, peak * dur


def click():
    n = int(.03 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 2400 * t) * env_exp(n, .004) + highpass(rng.standard_normal(n), 3000) * env_exp(n, .002) * .4
    return s * .35


def pop():
    n = int(.12 * SR); t = np.arange(n) / SR
    f = 520 + 520 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, .035) * .3


def impact():
    n = int(1.8 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / .08)) / SR) * env_exp(n, .5)
    noise = lowpass(rng.standard_normal(n), 2500) * env_exp(n, .25) * .5
    return np.tanh((boom + noise) * 1.3) * .8


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR; p = t / dur
    f = 180 + 1400 * p ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .25
    nz = highpass(rng.standard_normal(n), 1500) * .35
    return (tone + nz * p) * p ** 2.4 * .6


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    beat = tl["beat"]; dur = tl["duration"] + 2.0
    N = int(dur * SR); mus = np.zeros((2, N)); sfx = np.zeros((2, N))
    ch = tl["chapters"]
    intro_end = ch[0]["t1"]; slam = ch[0].get("slogan", [["", 2.07]])[0][1]
    hero = next((c for c in ch if c["id"] == tl.get("hero")), None)
    hero_t = hero["t0"] if hero else -99
    outro = ch[-1]; end_t = tl["duration"]
    K, HC, HO, CL = kick(), hat(), hat(True), clap()
    nbeats = int(tl["duration"] / beat) + 1
    for b in range(nbeats):
        t = b * beat; bar = b // 4; pos = b % 4
        if hero_t - .45 <= t < hero_t: continue             # khoảng lặng trước impact
        full = t >= slam - 1e-3
        if full and t < end_t - beat * 4: add(mus, t, K, .9)
        hgain = .45 if t < slam else .7
        if t < end_t - beat * 2:
            add(mus, t + beat / 2, HC, hgain, .25)
            if full: add(mus, t, HC, hgain * .5, -.2)
            if pos == 3 and bar % 2 == 1 and full: add(mus, t + beat / 2, HO, .5, .3)
        if full and pos in (1, 3) and t < end_t - beat * 4: add(mus, t, CL, .7, -.05)
    # bass + pad + arp theo ô nhịp
    bar_len = beat * 4
    nbars = int(tl["duration"] / bar_len) + 1
    for k in range(nbars):
        t = k * bar_len; ci = k % 4
        n = int(bar_len * SR)
        # pad
        pad = sum(saw(note(m), n, 8, d) for m in CHORDS[ci] for d in (-.004, .004))
        att = np.minimum(1, np.arange(n) / (.35 * SR)); rel = np.minimum(1, (n - np.arange(n)) / (.25 * SR))
        pad = lowpass(pad * att * rel, 900 if t < slam else 1500) * .07
        add(mus, t, pad, 1.0, 0)
        # bass móc 8 nốt
        if t >= slam - .01 and t < end_t - bar_len:
            for e in range(8):
                te = t + e * beat / 2
                if hero_t - .45 <= te < hero_t: continue
                nn = int(beat / 2 * SR * .92)
                f = note(ROOTS[ci] + (12 if e in (3, 7) else 0))
                s = lowpass(saw(f, nn, 10), 420) * env_exp(nn, .18) * .45
                add(mus, te, s, 1.0, 0)
        # arp ở chương cao trào và các chương giữa phim
        if t >= ch[4]["t0"] and t < end_t - bar_len * 2:
            g = .16 if hero and hero["t0"] <= t < hero["t1"] else .07
            for e in range(16):
                te = t + e * beat / 4
                if hero_t - .45 <= te < hero_t: continue
                m = CHORDS[ci][e % 3] + 12 + (12 if e % 8 >= 6 else 0)
                nn = int(beat / 4 * SR)
                tt = np.arange(nn) / SR
                s = (2 * np.abs(2 * (tt * note(m) % 1) - 1) - 1) * env_exp(nn, .06)
                add(mus, te, s * g, 1.0, .35 if e % 2 else -.35)
    # vang nhẹ (2 tiếng dội)
    for d, g in ((.129, .22), (.258, .1)):
        i = int(d * SR); mus[:, i:] += mus[:, :-i] * g if i < N else 0
    # hiệu ứng âm
    for ev in tl["events"]:
        t = ev["t"]; ty = ev["type"]
        if ty == "whoosh":
            s, pk = whoosh(.45 if ev.get("kind") != "whip" else .32); add(sfx, t - pk + 0.07, s, .9)
        elif ty == "swish":
            s, pk = whoosh(.22, .6, 800, 9000); add(sfx, t - pk + .05, s, .35, .2)
        elif ty == "tap": add(sfx, t, click(), .9, .1)
        elif ty == "pop": add(sfx, t, pop(), .8, -.1)
        elif ty == "tick": add(sfx, t, click(), .6)
        elif ty == "impact": add(sfx, t, impact(), .9)
        elif ty == "riser": add(sfx, t, riser(ev.get("dur", 3.0)), .8)
    # nhỏ dần cuối phim
    fade0 = int((end_t - 2.2) * SR); fade1 = int((end_t + .2) * SR)
    ramp = np.ones(N); ramp[fade0:fade1] = np.linspace(1, 0, fade1 - fade0); ramp[fade1:] = 0
    mus *= ramp
    # mở đầu: tăng dần trong 0,6 s đầu
    mus[:, :int(.6 * SR)] *= np.linspace(0, 1, int(.6 * SR))
    mix = mus * .8 + sfx
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix[:, :int((tl["duration"] + .05) * SR)]
    mix /= max(1e-9, np.abs(mix).max()) / .89
    pcm = (mix.T * 32767).astype("<i2")
    out = os.path.join(BUILD, "music.wav")
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("nhạc:", out, f"{len(pcm) / SR:.1f}s")


if __name__ == "__main__":
    main()
