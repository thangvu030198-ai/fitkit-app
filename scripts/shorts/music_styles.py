#!/usr/bin/env python3
"""TapEasy Shorts — nhạc nền RIÊNG cho từng clip (tự tổng hợp bằng numpy, không bản quyền, tất định theo id).

Mỗi short = 1 bộ (phong cách, BPM, giọng/key, vòng hợp âm) KHÁC NHAU → 14 bản nhạc khác nhau:
  edm_drive · trap_hype · future_bass · funky_house · synthwave · lofi_bounce · cinematic_pulse · moombah
Bảng gán ở STYLE_MAP (id → phong cách, nốt gốc, BPM). id lạ → chọn theo hash (vẫn tất định).

  render(P, sid) -> np.ndarray (2, N) @ 48 kHz — chỉ phần nhạc (SFX whoosh/impact vẫn ở audio.py)
  python3 scripts/shorts/music_styles.py --demo   # in bảng gán + kiểm không trùng
"""
import math, zlib
import numpy as np

SR = 48000

# ---------------------------------------------------------------- khối âm cơ bản
def n2f(m): return 440.0 * 2 ** ((m - 69) / 12)

def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))

def adsr(n, a=.005, d=.08, s=.6, r=.05):
    e = np.full(n, s, float); ia, idd, ir = int(a * SR), int(d * SR), int(r * SR)
    ia = max(1, min(ia, n)); e[:ia] = np.linspace(0, 1, ia)
    if idd > 0 and ia < n: k = min(n, ia + idd); e[ia:k] = np.linspace(1, s, k - ia)
    if ir > 0 and n > ir: e[-ir:] *= np.linspace(1, 0, ir)
    return e

def osc(kind, f, n, ph=0.0):
    t = np.arange(n) / SR; x = (t * f + ph) % 1.0
    if kind == "sine": return np.sin(2 * np.pi * x)
    if kind == "tri": return 2 * np.abs(2 * x - 1) - 1
    if kind == "square": return np.where(x < .5, 1.0, -1.0) * .7
    if kind == "pulse": return np.where(x < .25, 1.0, -1.0) * .6
    return 2 * x - 1                                    # saw

def supersaw(f, n, voices=5, spread=.012, rng=None):
    rng = rng or np.random.default_rng(1)
    return sum(osc("saw", f * (1 + spread * (k - (voices - 1) / 2) / voices), n, rng.random()) for k in range(voices)) / voices

def lowpass(x, fc):
    a = math.exp(-2 * math.pi * fc / SR); y = np.empty_like(x); s = 0.0
    # 1 cực, 2 lần cho dốc hơn — vector hoá bằng lfilter thủ công theo khối
    for _ in range(2):
        y = _iir1(x, a); x = y
    return y

try:
    from scipy.signal import lfilter as _lf
except Exception:
    _lf = None

def _iir1(x, a):
    # y[n] = (1-a) x[n] + a y[n-1]
    if _lf is not None: return _lf([1 - a], [1, -a], x)
    y = np.empty_like(x); prev = 0.0; b = 1 - a; blk = 32            # khối nhỏ: a^32 không tràn số dưới
    if a < .05: return x * b + 0 * x
    for i in range(0, len(x), blk):
        seg = x[i:i + blk]; m = len(seg)
        pw = a ** np.arange(1, m + 1)
        acc = np.cumsum(seg * b / pw) * pw
        y[i:i + m] = acc + prev * pw
        prev = y[i + m - 1]
    return y

def highpass(x, fc): return x - lowpass(x, fc)

def noise(n, rng): return rng.standard_normal(n)

def add(buf, t, sig, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= buf.shape[1] or i + len(sig) <= 0: return
    j0 = max(0, -i); i = max(0, i); m = min(len(sig) - j0, buf.shape[1] - i)
    if m <= 0: return
    s = sig[j0:j0 + m] * gain
    buf[0, i:i + m] += s * math.sqrt(.5 * (1 - pan)) * 1.414
    buf[1, i:i + m] += s * math.sqrt(.5 * (1 + pan)) * 1.414

# ---------------------------------------------------------------- trống
def kick(punch=1.0, tail=.32, f0=150, f1=45):
    n = int(tail * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / .03); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(np.sin(ph) * env_exp(n, tail / 3.2) * 2.2 * punch) * .9

def k808(f, dur=.7, glide_from=None):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = np.full(n, f) if glide_from is None else f + (glide_from - f) * np.exp(-t / .06)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.tanh(np.sin(ph) * 2.4) * env_exp(n, dur / 2.4) * .75

def snare(rng, tone=190, dur=.22, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * tone * t) * env_exp(n, .05)
    nz = highpass(noise(n, rng), 1200 * bright) * env_exp(n, dur / 3.5)
    return (body * .6 + nz * .7) * .8

def clap(rng):
    n = int(.25 * SR); out = np.zeros(n)
    for k, d in enumerate((0, .011, .022)):
        i = int(d * SR); m = n - i; out[i:] += highpass(noise(m, rng), 900) * env_exp(m, .018 if k < 2 else .09)
    return out * .55

def hat(rng, open_=False):
    n = int((.32 if open_ else .05) * SR)
    return highpass(noise(n, rng), 7000) * env_exp(n, .09 if open_ else .012) * .5

def shaker(rng):
    n = int(.08 * SR); e = np.minimum(1, np.arange(n) / (.02 * SR)) * env_exp(n, .025)
    return highpass(noise(n, rng), 5000) * e * .35

def tom(f, rng):
    n = int(.45 * SR); t = np.arange(n) / SR; fr = f * (1 + .6 * np.exp(-t / .04))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(n, .14) * .8 + highpass(noise(n, rng), 2000) * env_exp(n, .02) * .1

# ---------------------------------------------------------------- nhạc cụ
def pluck(f, dur, bright=3500, kind="saw"):
    n = int(dur * SR); return lowpass(osc(kind, f, n) * env_exp(n, .12), bright) * adsr(n, .002, .05, .9, .03)

def stab(fs, dur, rng, cutoff=2600):
    n = int(dur * SR); x = sum(supersaw(f, n, 5, .015, rng) for f in fs) / len(fs)
    return lowpass(x, cutoff) * adsr(n, .004, .12, .35, .05)

def pad(fs, dur, rng, cutoff=1500, kind="saw"):
    n = int(dur * SR)
    x = sum((supersaw(f, n, 4, .008, rng) if kind == "saw" else osc(kind, f, n)) for f in fs) / len(fs)
    return lowpass(x, cutoff) * adsr(n, .25, .2, .85, .3)

def keys(fs, dur):
    """rhodes-ish: sine + quãng 2 bội nhỏ, tremolo nhẹ"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t) * env_exp(n, .3) for f in fs) / len(fs)
    return x * (1 + .12 * np.sin(2 * np.pi * 5 * t)) * adsr(n, .01, .4, .55, .2)

def bass(f, dur, kind="saw", cutoff=500):
    n = int(dur * SR); return lowpass(osc(kind, f, n) + .5 * osc("sine", f / 2, n), cutoff) * adsr(n, .004, .08, .8, .03)

def lead(f, dur, kind="square", cutoff=3200, vib=True):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + (.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / .25) if vib else 0))
    ph = np.cumsum(fr) / SR % 1.0
    x = np.where(ph < .5, 1.0, -1.0) * .6 if kind == "square" else 2 * ph - 1
    return lowpass(x, cutoff) * adsr(n, .01, .1, .7, .06)

def chop(f, dur):
    """'vocal chop' tổng hợp: formant đơn giản (2 bandpass) trên saw — đặc trưng future bass"""
    n = int(dur * SR); x = osc("saw", f, n)
    fm = lowpass(x, 1800) - lowpass(x, 600)
    return fm * adsr(n, .005, .08, .5, .04) * 1.6

# ---------------------------------------------------------------- hoà âm
MINOR = {"i": [0, 3, 7], "VI": [-4, 0, 3], "III": [3, 7, 10], "VII": [-2, 2, 5], "iv": [5, 8, 12], "v": [7, 10, 14], "ii°": [2, 5, 8]}
MAJOR = {"I": [0, 4, 7], "V": [7, 11, 14], "vi": [9, 12, 16], "IV": [5, 9, 12], "ii": [2, 5, 9], "iii": [4, 7, 11]}
PROGRESSIONS = {
    "epic_min":  (MINOR, ["i", "VI", "III", "VII"]),
    "dark_min":  (MINOR, ["i", "iv", "VI", "v"]),
    "drive_min": (MINOR, ["VI", "VII", "i", "i"]),
    "pop_maj":   (MAJOR, ["I", "V", "vi", "IV"]),
    "lift_maj":  (MAJOR, ["vi", "IV", "I", "V"]),
    "bright_maj": (MAJOR, ["IV", "I", "V", "vi"]),
    "soul_maj":  (MAJOR, ["ii", "V", "I", "vi"]),
}
NOTE = {"C": 48, "C#": 49, "D": 50, "D#": 51, "E": 52, "F": 53, "F#": 54, "G": 55, "G#": 56, "A": 57, "A#": 58, "B": 59}

# id → (phong cách, key, BPM, vòng hợp âm). 14 bộ khác nhau, hợp nội dung (kiến thức: tự tin; demo: tươi; hành trình: dâng trào; teaser: tương lai)
STYLE_MAP = {
    "bmr-tdee":           ("edm_drive",       "A",  124, "epic_min"),
    "tang-co-giam-mo":    ("trap_hype",       "F#", 140, "dark_min"),
    "giac-ngu":           ("lofi_bounce",     "D",   92, "soul_maj"),
    "sai-lam-calo":       ("funky_house",     "G",  122, "drive_min"),
    "protein-bao-nhieu":  ("future_bass",     "C",  150, "lift_maj"),
    "demo-ghi-set":       ("moombah",         "E",  108, "drive_min"),
    "demo-thuc-don":      ("funky_house",     "A#", 120, "soul_maj"),
    "demo-tim-pt":        ("edm_drive",       "D#", 126, "pop_maj"),
    "demo-16-theme":      ("future_bass",     "F",  148, "bright_maj"),
    "hanh-trinh-12-tuan": ("cinematic_pulse", "C#", 100, "epic_min"),
    "suc-manh-12-tuan":   ("trap_hype",       "B",  144, "epic_min"),
    "tap-bung-giam-mo":   ("moombah",         "G#", 105, "dark_min"),
    "mo-hoi-dot-mo":      ("lofi_bounce",     "F",   95, "pop_maj"),
    "sap-ra-mat":         ("synthwave",       "E",  112, "drive_min"),
}
STYLES = ["edm_drive", "trap_hype", "future_bass", "funky_house", "synthwave", "lofi_bounce", "cinematic_pulse", "moombah"]


def spec(sid):
    if sid in STYLE_MAP: return STYLE_MAP[sid]
    h = zlib.crc32(sid.encode())
    return (STYLES[h % len(STYLES)], list(NOTE)[(h >> 4) % 12], 100 + (h >> 8) % 40, list(PROGRESSIONS)[(h >> 12) % len(PROGRESSIONS)])


def chords_for(key, prog):
    table, names = PROGRESSIONS[prog]; root = NOTE[key]
    return [[root + 12 + iv for iv in table[nm]] for nm in names]        # quãng 4 (C4 vùng)


def pump(n_total, beat, depth=.55, start=0.0):
    """sidechain 'thở' theo phách — đặc trưng EDM/future bass"""
    t = np.arange(n_total) / SR; ph = ((t - start) % beat) / beat
    return 1 - depth * np.exp(-ph * 9)


# ---------------------------------------------------------------- dựng 1 bản
def render(P, sid):
    style, key, bpm, prog = spec(sid)
    rng = np.random.default_rng(zlib.crc32(sid.encode()))
    beat = 60.0 / bpm; bar = 4 * beat
    dur = P["duration"] + 0.5; N = int(dur * SR)
    end0 = P["end"]["t0"]
    drums = np.zeros((2, N)); harm = np.zeros((2, N)); bas = np.zeros((2, N)); top = np.zeros((2, N))
    CH = chords_for(key, prog); root = NOTE[key]
    K = kick(); SN = snare(rng); CL = clap(rng); HC = hat(rng); HO = hat(rng, True); SH = shaker(rng)
    hook_end = 1.6                                         # hook: nhạc mỏng, chừa chỗ cho câu mở
    gap0, gap1 = end0 - 0.45, end0                         # khoảng lặng ngắn trước thẻ kết
    nbars = int(dur / bar) + 1

    def ok(t): return not (gap0 <= t < gap1) and t < P["duration"]
    def busy(t): return t >= hook_end and t < end0         # phần chính: đủ trống

    half = style in ("trap_hype", "future_bass")          # nhịp nửa (snare phách 3)
    for b in range(nbars * 4):
        t = b * beat; pos = b % 4; br = b // 4
        if not ok(t): continue
        main = busy(t)
        if style in ("edm_drive", "funky_house", "synthwave", "cinematic_pulse") or (style == "lofi_bounce" and pos in (0, 2)):
            if main or pos == 0: add(drums, t, K, .9 if style != "lofi_bounce" else .7)
        if style == "moombah":                               # dembow: kick 1&3, snare 'tà-tạch'
            if pos in (0, 2): add(drums, t, K, .9)
            if main and pos in (1, 3): add(drums, t - beat / 4, SN, .45, .1); add(drums, t, SN, .55, -.1)
        if style in ("trap_hype", "future_bass"):
            if pos == 0 or (pos == 2 and br % 2 and style == "trap_hype"): add(drums, t, K, .8)
            if main and pos == 2: add(drums, t, CL if style == "future_bass" else SN, .75)
        if style in ("edm_drive", "funky_house"):
            if main and pos in (1, 3): add(drums, t, CL, .6)
            if main: add(drums, t + beat / 2, HO if style == "edm_drive" else HC, .35 if style == "edm_drive" else .45, .3)
            if style == "funky_house" and main:
                for s in (.25, .75): add(drums, t + s * beat, SH, .5, -.3)
        if style == "synthwave" and main and pos in (1, 3):
            g = snare(rng, 170, .35, .8); add(drums, t, g * np.concatenate([np.ones(int(.18 * SR)), np.zeros(len(g) - int(.18 * SR))]), .7)
        if style == "lofi_bounce":
            if main and pos in (1, 3): add(drums, t + .02, SN * .7, .5)
            sw = beat * (.58 if True else .5)
            if main: add(drums, t, HC, .3, .2); add(drums, t + sw, HC, .22, .2)
        if style == "cinematic_pulse":
            if main and pos == 3 and br % 2: [add(drums, t + k * beat / 4, tom(n2f(root - 12 - 3 * k), rng), .5, -.3 + .2 * k) for k in range(4)]
            if main and pos in (1, 3): add(drums, t, CL, .4)
        if style == "trap_hype" and main:                   # hi-hat 1/8 + cuộn 1/16, 1/32 cuối ô nhịp
            step = beat / 2 if pos < 3 else beat / 4
            k = 0
            while k * step < beat:
                add(drums, t + k * step, HC, .35, .25); k += 1
            if pos == 3 and br % 2: [add(drums, t + beat / 2 + j * beat / 8, HC, .25, .25) for j in range(4)]
        if style == "future_bass" and main:
            add(drums, t + beat / 2, HC, .3, .25)

    for k in range(nbars):
        t = k * bar; ch = CH[k % len(CH)]; bass_root = ch[0] - 24
        while bass_root > root - 10: bass_root -= 12
        if not ok(t) and t >= end0: pass
        main = busy(t) or busy(t + bar - .01)
        fs = [n2f(m) for m in ch]
        n_bar = bar
        if style == "edm_drive":
            add(harm, t, pad(fs, n_bar, rng, 1600) * .32)
            for e in range(8):                                  # bass offbeat 'pumping'
                te = t + e * beat / 2
                if ok(te) and main: add(bas, te, bass(n2f(bass_root + 12), beat / 2 * .9, "saw", 700), .5)
            for e in range(16):
                te = t + e * beat / 4
                if ok(te) and main: add(top, te, pluck(n2f(ch[e % 3] + 12), beat / 4, 4200), .14, .35 if e % 2 else -.35)
        elif style == "trap_hype":
            add(harm, t, pad(fs, n_bar, rng, 1100, "saw") * .22)
            if main:
                add(bas, t, k808(n2f(bass_root), beat * 2.2, n2f(bass_root + 12) if k % 2 else None), .8)
                add(bas, t + beat * 2.5, k808(n2f(bass_root + (3 if k % 2 else 0)), beat * 1.4), .65)
                mel = [ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12]
                for e, m in enumerate(mel):                     # bell melody
                    add(top, t + e * beat, pluck(n2f(m), beat * .9, 6000, "tri"), .18, .2)
        elif style == "future_bass":
            if main:
                for e in (0, 1.5, 3):                            # supersaw chord 'swell' kèm pump
                    s = stab(fs + [n2f(ch[0] + 12)], beat * 1.4, rng, 3200)
                    add(harm, t + e * beat, s, .36)
                for e in range(8):
                    te = t + e * beat / 2
                    if ok(te): add(top, te, chop(n2f(ch[(e * 2) % 3] + 12), beat / 2 * .8), .12, .3 if e % 2 else -.3)
                add(bas, t, bass(n2f(bass_root), bar * .95, "saw", 260), .55)
            else:
                add(harm, t, pad(fs, n_bar, rng, 1200) * .22)
        elif style == "funky_house":
            if main:
                for e in range(8):                              # hợp âm stab nhịp nghịch
                    if e % 2: add(harm, t + e * beat / 2, stab(fs, beat * .35, rng, 3000), .26)
                line = [0, 0, 12, 0, 7, 0, 10, 12]
                for e, iv in enumerate(line):
                    te = t + e * beat / 2 + (beat / 4 if e % 2 else 0) * .0
                    if ok(te): add(bas, te, bass(n2f(bass_root + iv), beat / 2 * .7, "square", 900), .5)
            else:
                add(harm, t, keys(fs, n_bar) * .3)
        elif style == "synthwave":
            add(harm, t, pad(fs, n_bar, rng, 1800) * .3)
            for e in range(8):
                te = t + e * beat / 2
                if ok(te) and main: add(bas, te, bass(n2f(bass_root + (12 if e % 2 else 0)), beat / 2 * .85, "saw", 900), .48)
            if main:
                arp = [ch[0], ch[1], ch[2], ch[1] + 12]
                for e in range(16): add(top, t + e * beat / 4, pluck(n2f(arp[e % 4] + 12), beat / 4, 3000, "square"), .1, .4 if e % 2 else -.4)
                if k % 2: add(top, t, lead(n2f(ch[2] + 12), bar * .9), .12)
        elif style == "lofi_bounce":
            add(harm, t, keys(fs, n_bar) * .42)
            if main:
                add(bas, t, bass(n2f(bass_root), beat * 1.5, "sine", 400), .7)
                add(bas, t + beat * 2.5, bass(n2f(bass_root + 7), beat, "sine", 400), .55)
                for e, m in enumerate([ch[2] + 12, ch[1] + 12, ch[2] + 14]):
                    add(top, t + (e * 1.33) * beat, pluck(n2f(m), beat * .6, 2400, "tri"), .14, .25)
        elif style == "cinematic_pulse":
            add(harm, t, pad(fs + [n2f(ch[0] - 12)], n_bar, rng, 1300) * .38)
            for e in range(16):                                 # ostinato 1/16 dâng dần
                te = t + e * beat / 4
                if ok(te) and main:
                    g = .06 + .1 * min(1, (te - hook_end) / max(1, end0 - hook_end))
                    add(top, te, pluck(n2f(ch[0] + (12 if e % 4 == 2 else 0)), beat / 4, 2200), g, .3 if e % 2 else -.3)
            if main: add(bas, t, bass(n2f(bass_root), bar * .95, "saw", 220), .6)
        elif style == "moombah":
            add(harm, t, pad(fs, n_bar, rng, 1500) * .2)
            if main:
                for e in (0, .75, 1.5, 2, 2.75, 3.5):                # plucky reggaeton rhythm
                    add(top, t + e * beat, stab(fs, beat * .3, rng, 3800), .22, .15)
                add(bas, t, k808(n2f(bass_root), beat * 1.6), .7); add(bas, t + beat * 2, k808(n2f(bass_root + 5), beat * 1.6), .6)

    if style in ("edm_drive", "future_bass", "synthwave", "moombah"):
        pm = pump(N, beat, .5 if style != "synthwave" else .3)
        harm *= pm; top *= pm
    # thẻ kết: giữ hợp âm cuối ngân dài (outro), trống tắt
    ch = CH[0]; fs = [n2f(m) for m in ch]
    add(harm, end0, pad(fs, max(.5, P["duration"] - end0 + .5), rng, 1600) * .35)
    mix = drums * .9 + harm * .8 + bas * .85 + top * .9
    # vang nhẹ (2 tap)
    for d, g in ((.11, .16), (.23, .08)):
        j = int(d * SR); mix[:, j:] += mix[:, :-j] * g
    pk = np.abs(mix).max()
    if pk > 0: mix *= .9 / pk
    return mix


if __name__ == "__main__":
    import sys
    if "--demo" in sys.argv:
        seen = set()
        for k, v in STYLE_MAP.items():
            print(f"  {k:<20} {v[0]:<16} {v[1]:<3} {v[2]:>3} BPM  {v[3]}")
            assert v not in seen, "trùng bộ nhạc " + k; seen.add(v)
        print("14 bộ, không trùng" if len(seen) == len(STYLE_MAP) else "")
