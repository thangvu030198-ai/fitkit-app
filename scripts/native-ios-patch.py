#!/usr/bin/env python3
"""TapEasy — vá project iOS do `npx cap add ios` (Capacitor 6) sinh ra, cho bản nộp App Store.  (R3-store)

  python3 scripts/native-ios-patch.py [--ios-dir ios/App] [--version X.Y.Z] [--build N] [--apple-signin]
          [--google-plist ios/App/App/GoogleService-Info.plist]

Chỉ dùng plistlib (chạy được trên macOS runner lẫn Linux để kiểm thử). Phần sửa .xcodeproj: scripts/native-ios-xcodeproj.rb.
  1. Info.plist
     · Mô tả quyền (Việt + Anh trong cùng chuỗi) CHỈ cho quyền app thật sự dùng — lấy từ biến môi trường
       NS_CAMERA / NS_MICROPHONE / NS_PHOTO_ADD (workflow đặt), có mặc định bên dưới:
         NSCameraUsageDescription            chụp ảnh tiến trình, quét QR mã PT / điểm danh sự kiện (getUserMedia + <input type=file>)
         NSMicrophoneUsageDescription        chỉ khi người dùng chọn "Quay video" lúc đăng clip Khoảnh khắc (thiếu chuỗi này iOS đóng app)
         NSPhotoLibraryAddUsageDescription   lưu ảnh (chạm giữ ảnh → Lưu) vào thư viện
       KHÔNG khai NSPhotoLibraryUsageDescription (chọn ảnh qua trình chọn hệ thống, không cần quyền), KHÔNG vị trí / danh bạ /
       Bluetooth / HealthKit / theo dõi: xoá NSUserTrackingUsageDescription nếu có (app không theo dõi chéo → không hiện ATT).
     · ITSAppUsesNonExemptEncryption = false (chỉ dùng HTTPS của hệ điều hành)
     · CFBundleShortVersionString / CFBundleVersion, CFBundleDisplayName = TapEasy, CFBundleLocalizations = [vi, en]
     · Chỉ iPhone, chỉ màn dọc: bỏ UISupportedInterfaceOrientations~ipad (TARGETED_DEVICE_FAMILY = 1 đặt trong .rb)
     · --google-plist: URL scheme = REVERSED_CLIENT_ID (Google Sign-In quay lại app), không thêm trùng
  2. App.entitlements  --apple-signin → com.apple.developer.applesignin = [Default]   (App Store 4.8)
  3. PrivacyInfo.xcprivacy  chép store/native/ios/PrivacyInfo.xcprivacy vào ios/App/App/ (thêm vào target: .rb)
"""
import argparse, os, plistlib, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

USAGE_DEFAULTS = {
    "NSCameraUsageDescription": ("NS_CAMERA",
        "TapEasy dùng camera để chụp ảnh tiến trình và quét mã QR của PT hoặc sự kiện khi bạn bấm chụp/quét. / TapEasy uses the camera to take progress photos and scan trainer or event QR codes when you choose to."),
    "NSMicrophoneUsageDescription": ("NS_MICROPHONE",
        "TapEasy chỉ dùng micro để thu tiếng khi bạn tự quay video đăng lên Khoảnh khắc sự kiện. / TapEasy uses the microphone only to record sound when you film a video to post to event Moments."),
    "NSPhotoLibraryAddUsageDescription": ("NS_PHOTO_ADD",
        "TapEasy lưu ảnh vào thư viện khi bạn chọn Lưu ảnh. / TapEasy saves an image to your photo library when you choose Save."),
}
# Chuỗi quyền KHÔNG được có (app không dùng) — có thì gỡ để khỏi bị hỏi 5.1.1 / hiện hộp thoại vô cớ
REMOVE_KEYS = [
    "NSUserTrackingUsageDescription", "NSPhotoLibraryUsageDescription",
    "NSLocationWhenInUseUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription", "NSLocationAlwaysUsageDescription",
    "NSContactsUsageDescription", "NSCalendarsUsageDescription", "NSRemindersUsageDescription",
    "NSBluetoothAlwaysUsageDescription", "NSBluetoothPeripheralUsageDescription", "NSMotionUsageDescription",
    "NSHealthShareUsageDescription", "NSHealthUpdateUsageDescription", "NSFaceIDUsageDescription", "NSSpeechRecognitionUsageDescription",
]


class PatchError(Exception):
    pass


def patch_info(info, version=None, build=None, env=None, reversed_client_id=None):
    env = os.environ if env is None else env
    for key, (var, default) in USAGE_DEFAULTS.items():
        text = (env.get(var) or default).strip()
        if len(text) < 20:
            raise PatchError("%s quá ngắn — Apple từ chối mô tả quyền chung chung (5.1.1)" % key)
        info[key] = text
    for k in REMOVE_KEYS:
        info.pop(k, None)
    info["ITSAppUsesNonExemptEncryption"] = False
    if version:
        if not re.fullmatch(r"\d+(\.\d+){0,2}", version):
            raise PatchError("CFBundleShortVersionString phải dạng 1.2.3 (đang là %r)" % version)
        info["CFBundleShortVersionString"] = version
    if build:
        if not re.fullmatch(r"\d+(\.\d+){0,2}", str(build)):
            raise PatchError("CFBundleVersion phải là số (đang là %r)" % build)
        info["CFBundleVersion"] = str(build)
    info["CFBundleDisplayName"] = "TapEasy"
    info["CFBundleLocalizations"] = ["vi", "en"]
    info["UISupportedInterfaceOrientations"] = ["UIInterfaceOrientationPortrait"]
    info.pop("UISupportedInterfaceOrientations~ipad", None)
    info["LSRequiresIPhoneOS"] = True
    if reversed_client_id:
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.+\-]*", reversed_client_id):
            raise PatchError("REVERSED_CLIENT_ID không hợp lệ")
        types = info.setdefault("CFBundleURLTypes", [])
        have = any(reversed_client_id in (t.get("CFBundleURLSchemes") or []) for t in types if isinstance(t, dict))
        if not have:
            types.append({"CFBundleURLName": "google-signin", "CFBundleURLSchemes": [reversed_client_id]})
    return info


def patch_entitlements(ent, apple_signin=False):
    if apple_signin:
        ent["com.apple.developer.applesignin"] = ["Default"]
    return ent


def _load(path, missing_ok=False):
    if missing_ok and not os.path.exists(path):
        return {}
    with open(path, "rb") as f:
        return plistlib.load(f)


def _dump(path, obj):
    with open(path, "wb") as f:
        plistlib.dump(obj, f, sort_keys=False)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--ios-dir", default=os.path.join("ios", "App"))
    ap.add_argument("--version")
    ap.add_argument("--build")
    ap.add_argument("--apple-signin", action="store_true")
    ap.add_argument("--google-plist")
    a = ap.parse_args(argv)
    app = os.path.join(a.ios_dir, "App")
    try:
        rev = None
        if a.google_plist:
            rev = _load(a.google_plist).get("REVERSED_CLIENT_ID")
            if not rev:
                raise PatchError("GoogleService-Info.plist thiếu REVERSED_CLIENT_ID — vào Firebase → Authentication bật Google rồi tải lại file")
        ip = os.path.join(app, "Info.plist")
        info = patch_info(_load(ip), a.version, a.build, None, rev)
        _dump(ip, info)
        if a.apple_signin:
            ep = os.path.join(app, "App.entitlements")
            _dump(ep, patch_entitlements(_load(ep, missing_ok=True), True))
        src = os.path.join(ROOT, "store", "native", "ios", "PrivacyInfo.xcprivacy")
        _load(src)   # phải là plist hợp lệ
        shutil.copyfile(src, os.path.join(app, "PrivacyInfo.xcprivacy"))
        print("✅ iOS Info.plist: %s (%s) · quyền: %s · ITSAppUsesNonExemptEncryption=false · PrivacyInfo.xcprivacy đã chép%s%s" % (
            info.get("CFBundleShortVersionString"), info.get("CFBundleVersion"),
            ", ".join(k for k in info if k.startswith("NS") and k.endswith("UsageDescription")),
            " · Sign in with Apple" if a.apple_signin else "", " · URL scheme Google" if rev else ""))
        return 0
    except (PatchError, OSError, plistlib.InvalidFileException, ValueError) as e:
        print("::error::native-ios-patch: %s" % e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
