#!/usr/bin/env python3
"""TapEasy — vá project Android do `npx cap add android` (Capacitor 6) sinh ra, cho bản nộp Google Play.  (R3-store)

  python3 scripts/native-android-patch.py [--android-dir android] [--target-sdk 36] [--min-sdk 23]
          [--agp 8.9.1] [--gradle 8.11.1] [--gms 4.4.2] [--version-code N] [--version-name X.Y.Z] [--google] [--exact-alarm]
  (chạy SAU `npx cap sync android`; chạy lại nhiều lần không sao)
  python3 scripts/native-android-patch.py --check-merged [--android-dir android]     # SAU khi build: soát quyền thừa

Làm gì (mọi bước đều tự kiểm, sai → thoát mã 1 để CI đỏ thay vì ra bản build hỏng):
  1. variables.gradle     compileSdk/targetSdk = --target-sdk (Google Play 11/2026: API 36 — KIỂM LẠI mức yêu cầu lúc nộp:
                          https://developer.android.com/google/play/requirements/target-sdk), minSdk ≥ --min-sdk,
                          --google → rgcfaIncludeGoogle = true (SDK Google Sign-In của @capacitor-firebase/authentication)
  2. build.gradle (gốc)   Android Gradle Plugin → --agp (AGP 8.2 của Capacitor 6 không đọc được android.jar của API 35/36),
                          google-services → --gms;  gradle-wrapper.properties → Gradle --gradle (AGP 8.9 cần ≥ 8.11.1)
  3. app/build.gradle     versionCode / versionName
  4. AndroidManifest.xml  quyền TỐI THIỂU: INTERNET (sẵn có) · POST_NOTIFICATIONS (nhắc tập) · VIBRATE (rung báo hết giờ nghỉ)
                          · CAMERA (chụp ảnh tiến trình, quét QR mã PT/điểm danh — camera KHÔNG bắt buộc: uses-feature required=false)
                          KHÔNG thêm SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM (nhắc tập dùng báo thức thường, lệch vài phút chấp nhận được).
                          Muốn báo hết giờ nghỉ đúng từng giây khi khoá màn hình: --exact-alarm thêm SCHEDULE_EXACT_ALARM (Android 14+
                          người dùng phải tự cấp trong Cài đặt; lý do khai với Play: "đồng hồ nghỉ giữa hiệp do người dùng đặt"),
                          gỡ AD_ID nếu thư viện nào kéo vào (app không quảng cáo), khoá màn dọc cho điện thoại.
  5. MainActivity.java    bản xử lý edge-to-edge Android 15+ (store/native/android/MainActivity.java)
  6. gradle.properties    android.suppressUnsupportedCompileSdk (tắt cảnh báo nếu AGP chưa "kiểm định" API mới)
Không bật R8/minify (Capacitor mặc định minifyEnabled false) — bật mà thiếu luật keep sẽ hỏng cầu nối plugin.
"""
import argparse, glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

WANT_PERMISSIONS = [
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.VIBRATE",
    "android.permission.CAMERA",
]
EXACT_ALARM = "android.permission.SCHEDULE_EXACT_ALARM"   # chỉ khi chủ dự án bật --exact-alarm (báo hết giờ nghỉ đúng từng giây)
# Quyền KHÔNG được có trong bản phát hành (app không dùng → Play hỏi lý do / từ chối)
FORBIDDEN = [
    "android.permission.USE_EXACT_ALARM", "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.READ_CONTACTS", "android.permission.WRITE_CONTACTS", "android.permission.GET_ACCOUNTS",
    "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO", "android.permission.READ_MEDIA_AUDIO",
    "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.MANAGE_EXTERNAL_STORAGE",
    "android.permission.RECORD_AUDIO", "android.permission.READ_PHONE_STATE", "android.permission.READ_SMS", "android.permission.SEND_SMS",
    "android.permission.READ_CALL_LOG", "android.permission.QUERY_ALL_PACKAGES", "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.SYSTEM_ALERT_WINDOW", "android.permission.BODY_SENSORS", "android.permission.ACTIVITY_RECOGNITION",
    "android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_SCAN", "android.permission.FOREGROUND_SERVICE",
    "com.google.android.gms.permission.AD_ID",
]


class PatchError(Exception):
    pass


def patch_variables(text, target_sdk=36, min_sdk=23, google=False):
    out, n1 = re.subn(r"(compileSdkVersion\s*=\s*)\d+", lambda m: m.group(1) + str(target_sdk), text)
    out, n2 = re.subn(r"(targetSdkVersion\s*=\s*)\d+", lambda m: m.group(1) + str(target_sdk), out)
    if not n1 or not n2:
        raise PatchError("variables.gradle: không thấy compileSdkVersion/targetSdkVersion")
    m = re.search(r"(minSdkVersion\s*=\s*)(\d+)", out)
    if not m:
        raise PatchError("variables.gradle: không thấy minSdkVersion")
    if int(m.group(2)) < min_sdk:
        out = out[:m.start()] + m.group(1) + str(min_sdk) + out[m.end():]
    if google and "rgcfaIncludeGoogle" not in out:
        out, n = re.subn(r"^(\s*ext\s*\{)[ \t]*$", lambda m: m.group(1) + "\n    rgcfaIncludeGoogle = true", out, count=1, flags=re.M)
        if not n:
            raise PatchError("variables.gradle: không thấy khối ext { để bật rgcfaIncludeGoogle")
    return out


def patch_root_gradle(text, agp="8.9.1", gms="4.4.2"):
    out, n = re.subn(r"(com\.android\.tools\.build:gradle:)[0-9][0-9A-Za-z.\-]*", lambda m: m.group(1) + agp, text)
    if not n:
        raise PatchError("build.gradle: không thấy classpath com.android.tools.build:gradle")
    out = re.sub(r"(com\.google\.gms:google-services:)[0-9][0-9A-Za-z.\-]*", lambda m: m.group(1) + gms, out)
    return out


def patch_wrapper(text, gradle="8.11.1"):
    out, n = re.subn(r"(distributionUrl=.*?/gradle-)[0-9][0-9.]*(-(?:all|bin)\.zip)", lambda m: m.group(1) + gradle + m.group(2), text)
    if not n:
        raise PatchError("gradle-wrapper.properties: không thấy distributionUrl")
    return out


def patch_app_gradle(text, version_code=None, version_name=None):
    out = text
    if version_code is not None:
        if not (1 <= int(version_code) <= 2100000000):
            raise PatchError("versionCode phải trong 1..2100000000 (giới hạn Google Play)")
        out, n = re.subn(r"(\bversionCode\s+)\d+", lambda m: m.group(1) + str(int(version_code)), out, count=1)
        if not n:
            raise PatchError("app/build.gradle: không thấy versionCode")
    if version_name is not None:
        if not re.fullmatch(r"[0-9A-Za-z.\-+_]{1,40}", version_name):
            raise PatchError("versionName không hợp lệ: %r" % version_name)
        out, n = re.subn(r'(\bversionName\s+)"[^"]*"', lambda m: m.group(1) + '"' + version_name + '"', out, count=1)
        if not n:
            raise PatchError("app/build.gradle: không thấy versionName")
    return out


def patch_manifest(text, exact_alarm=False):
    out = text
    if "<application" not in out or "<manifest" not in out:
        raise PatchError("AndroidManifest.xml: thiếu <manifest>/<application>")
    if "xmlns:tools=" not in out:
        out = re.sub(r"<manifest\b", '<manifest xmlns:tools="http://schemas.android.com/tools"', out, count=1)
    add = []
    for p in WANT_PERMISSIONS + ([EXACT_ALARM] if exact_alarm else []):
        if not re.search(r'<uses-permission[^>]*android:name="%s"' % re.escape(p), out):
            add.append('<uses-permission android:name="%s" />' % p)
    if 'android:name="android.hardware.camera"' not in out:
        add.append('<uses-feature android:name="android.hardware.camera" android:required="false" />')
    if 'android:name="android.hardware.camera.autofocus"' not in out:
        add.append('<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />')
    if "com.google.android.gms.permission.AD_ID" not in out:
        add.append('<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />')
    if add:
        block = "    <!-- TapEasy (native-android-patch.py): quyền tối thiểu — xem docs/RELEASE-CHECKLIST.md -->\n" + "".join("    %s\n" % a for a in add)
        i = out.index("<application")
        j = out.rfind("\n", 0, i) + 1
        out = out[:j] + block + out[j:]
    # màn dọc trên điện thoại (bố cục web 320–430 px); Android 16 tự bỏ qua trên màn lớn ≥ 600dp
    def act(m):
        tag = m.group(0)
        if "android:screenOrientation" in tag:
            return tag
        return tag.replace("<activity", '<activity android:screenOrientation="portrait"', 1)
    out = re.sub(r"<activity\b[^>]*android:name=\"[^\"]*MainActivity\"[^>]*>", act, out, count=1)
    return out


def manifest_permissions(text):
    """Quyền thật sự được khai (bỏ dòng tools:node="remove")."""
    perms = []
    for m in re.finditer(r"<uses-permission(?:-sdk-\d+)?\b[^>]*>", text):
        tag = m.group(0)
        if 'tools:node="remove"' in tag:
            continue
        n = re.search(r'android:name="([^"]+)"', tag)
        if n:
            perms.append(n.group(1))
    return sorted(set(perms))


def forbidden_in(text, allow=()):
    return [p for p in manifest_permissions(text) if p in FORBIDDEN and p not in allow]


def main_activity_source(package):
    src = open(os.path.join(ROOT, "store", "native", "android", "MainActivity.java"), encoding="utf8").read()
    if not re.fullmatch(r"[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)+", package):
        raise PatchError("package không hợp lệ: %r" % package)
    out, n = re.subn(r"^package\s+[\w.]+;", "package %s;" % package, src, count=1, flags=re.M)
    if not n:
        raise PatchError("MainActivity.java mẫu thiếu dòng package")
    return out


def _rw(path, fn):
    with open(path, encoding="utf8") as f:
        old = f.read()
    new = fn(old)
    if new != old:
        with open(path, "w", encoding="utf8") as f:
            f.write(new)
    return new


def check_merged(android_dir, allow=()):
    pats = [os.path.join(android_dir, "app", "build", "intermediates", d, "**", "AndroidManifest.xml")
            for d in ("merged_manifests", "merged_manifest", "bundle_manifest", "packaged_manifests")]
    files = sorted({f for p in pats for f in glob.glob(p, recursive=True)})
    if not files:
        print("::warning::Không tìm thấy merged manifest để soát quyền (đường dẫn AGP đổi?) — soát tay bằng Play Console → App bundle explorer → Permissions")
        return 0
    bad = {}
    for f in files:
        text = open(f, encoding="utf8", errors="replace").read()
        print("• %s\n    quyền: %s" % (os.path.relpath(f, android_dir), ", ".join(manifest_permissions(text)) or "(không)"))
        for p in forbidden_in(text, allow):
            bad.setdefault(p, f)
        m = re.search(r'android:targetSdkVersion="(\d+)"', text)
        if m:
            print("    targetSdkVersion = %s" % m.group(1))
    if bad:
        for p, f in bad.items():
            print("::error::Quyền thừa trong bản build: %s (%s) — gỡ bằng tools:node=\"remove\" hoặc khai lý do trên Play Console" % (p, os.path.relpath(f, android_dir)))
        return 1
    print("✅ Không có quyền thừa (vị trí, danh bạ, bộ nhớ, micro, báo thức chính xác, AD_ID…)")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--android-dir", default="android")
    ap.add_argument("--target-sdk", type=int, default=36)
    ap.add_argument("--min-sdk", type=int, default=23)
    ap.add_argument("--agp", default="8.9.1")
    ap.add_argument("--gradle", default="8.11.1")
    ap.add_argument("--gms", default="4.4.2")
    ap.add_argument("--version-code", type=int)
    ap.add_argument("--version-name")
    ap.add_argument("--google", action="store_true")
    ap.add_argument("--check-merged", action="store_true")
    ap.add_argument("--exact-alarm", action="store_true", help="thêm SCHEDULE_EXACT_ALARM (mặc định KHÔNG)")
    a = ap.parse_args(argv)
    A = a.android_dir
    allow = (EXACT_ALARM,) if a.exact_alarm else ()
    try:
        if a.check_merged:
            return check_merged(A, allow)
        if a.target_sdk < 35:
            raise PatchError("--target-sdk < 35: Google Play không nhận bản mới target thấp hơn API 35")
        v = _rw(os.path.join(A, "variables.gradle"), lambda s: patch_variables(s, a.target_sdk, a.min_sdk, a.google))
        _rw(os.path.join(A, "build.gradle"), lambda s: patch_root_gradle(s, a.agp, a.gms))
        _rw(os.path.join(A, "gradle", "wrapper", "gradle-wrapper.properties"), lambda s: patch_wrapper(s, a.gradle))
        cdv = os.path.join(A, "capacitor-cordova-android-plugins", "build.gradle")     # sinh lại mỗi lần cap sync → chạy script SAU cap sync
        if os.path.exists(cdv):
            _rw(cdv, lambda s: re.sub(r"(com\.android\.tools\.build:gradle:)[0-9][0-9A-Za-z.\-]*", lambda m: m.group(1) + a.agp, s))
        g = _rw(os.path.join(A, "app", "build.gradle"), lambda s: patch_app_gradle(s, a.version_code, a.version_name))
        mf = _rw(os.path.join(A, "app", "src", "main", "AndroidManifest.xml"), lambda s: patch_manifest(s, a.exact_alarm))
        bad = forbidden_in(mf, allow)
        if bad:
            raise PatchError("AndroidManifest.xml có quyền thừa: " + ", ".join(bad))
        m = re.search(r'(?:applicationId|namespace)\s*=?\s*"([^"]+)"', g)
        package = m.group(1) if m else "vn.thangvu.fitkit"
        jdir = os.path.join(A, "app", "src", "main", "java", *package.split("."))
        os.makedirs(jdir, exist_ok=True)
        with open(os.path.join(jdir, "MainActivity.java"), "w", encoding="utf8") as f:
            f.write(main_activity_source(package))
        gp = os.path.join(A, "gradle.properties")
        props = open(gp, encoding="utf8").read() if os.path.exists(gp) else ""
        if "android.suppressUnsupportedCompileSdk" not in props:
            with open(gp, "a", encoding="utf8") as f:
                f.write(("" if props.endswith("\n") or not props else "\n") + "android.suppressUnsupportedCompileSdk=%d\n" % a.target_sdk)
        print("✅ Android: compileSdk/targetSdk %d · AGP %s · Gradle %s · package %s" % (a.target_sdk, a.agp, a.gradle, package))
        for line in v.splitlines():
            if re.search(r"SdkVersion|rgcfa", line):
                print("    " + line.strip())
        for line in g.splitlines():
            if re.search(r"\bversion(Code|Name)\b", line):
                print("    " + line.strip())
        print("    quyền: " + ", ".join(manifest_permissions(mf)))
        return 0
    except (PatchError, OSError) as e:
        print("::error::native-android-patch: %s" % e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
