/* =========================================================================
   Vòng R3 (14/11/2026) — agent STORE: đóng gói 3 nền tảng + tuân thủ Google Play / App Store
   Hồi quy cho các lỗi R3-STORE-nn (docs/qa/R3-store.md). Kiểm tĩnh + chạy bộ vá trên project mẫu
   (không cần Android SDK / Xcode / mạng).  Chạy riêng: node tests/run.js --only 85-r3-store
   ========================================================================= */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const cp = require("child_process");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = f=> fs.existsSync(path.join(ROOT, f));
const WF = f=> read(".github/workflows/" + f);

/** chạy python3; máy không có python3 → trả null (test bỏ qua phần chạy, vẫn kiểm tĩnh) */
function py(args, opt){
  try{ return { code: 0, out: cp.execFileSync("python3", args, Object.assign({ timeout: 30000, stdio: ["pipe", "pipe", "pipe"] }, opt || {})).toString() }; }
  catch(e){ if(e.code === "ENOENT") return null; return { code: e.status, out: String(e.stdout || "") + String(e.stderr || "") }; }
}
const tmpdir = p=> fs.mkdtempSync(path.join(os.tmpdir(), p));
const rm = d=> fs.rmSync(d, { recursive: true, force: true });

/* ---- project Android mẫu (đúng dạng `npx cap add android` của Capacitor 6) ---- */
function androidFixture(){
  const d = tmpdir("fkand-"), A = path.join(d, "android");
  const w = (f, s)=>{ const p = path.join(A, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  w("variables.gradle", "ext {\n    minSdkVersion = 22\n    compileSdkVersion = 34\n    targetSdkVersion = 34\n    androidxAppCompatVersion = '1.6.1'\n}\n");
  w("build.gradle", "buildscript {\n    dependencies {\n        classpath 'com.android.tools.build:gradle:8.2.1'\n        classpath 'com.google.gms:google-services:4.4.0'\n    }\n}\n");
  w("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2.1-all.zip\n");
  w("capacitor-cordova-android-plugins/build.gradle", "buildscript {\n    dependencies {\n        classpath 'com.android.tools.build:gradle:8.2.1'\n    }\n}\n");
  w("app/build.gradle", 'android {\n    namespace "vn.thangvu.fitkit"\n    defaultConfig {\n        applicationId "vn.thangvu.fitkit"\n        versionCode 1\n        versionName "1.0"\n    }\n    buildTypes { release { minifyEnabled false } }\n}\n');
  w("app/src/main/AndroidManifest.xml", '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n\n    <application\n        android:allowBackup="true">\n\n        <activity\n            android:configChanges="orientation|keyboardHidden"\n            android:name=".MainActivity"\n            android:exported="true">\n        </activity>\n    </application>\n\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n');
  w("app/src/main/java/vn/thangvu/fitkit/MainActivity.java", "package vn.thangvu.fitkit;\nimport com.getcapacitor.BridgeActivity;\npublic class MainActivity extends BridgeActivity {}\n");
  return { d, A, r: f=> fs.readFileSync(path.join(A, f), "utf8"), w };
}
const PATCH_AND = path.join(ROOT, "scripts", "native-android-patch.py");
const PATCH_IOS = path.join(ROOT, "scripts", "native-ios-patch.py");

/** khối Node sinh fk-build.js trong prepare-www.sh */
function fkBuildNode(){
  const m = /node - <<'FKBUILD_EOF'[^\n]*\n([\s\S]*?)\nFKBUILD_EOF/.exec(read("scripts/prepare-www.sh"));
  assert.ok(m, "prepare-www.sh thiếu khối node - <<'FKBUILD_EOF'");
  return m[1];
}
function runFkBuild(env, html){
  const d = tmpdir("fkbuild-");
  try{
    fs.mkdirSync(path.join(d, "www"));
    fs.writeFileSync(path.join(d, "www", "index.html"), html || read("index.html"));
    fs.copyFileSync(path.join(ROOT, "package.json"), path.join(d, "package.json"));
    fs.copyFileSync(path.join(ROOT, "capacitor.config.json"), path.join(d, "capacitor.config.json"));
    const run = ()=> cp.execFileSync(process.execPath, ["-"], { cwd: d, input: fkBuildNode(), env: Object.assign({}, process.env, { FK_PLATFORM: "web", STORE_BUILD: "0", FK_BUILD_NUMBER: "0", FK_AUTH_PROVIDERS: "" }, env) }).toString();
    const out = run(); run();   // chạy 2 lần: không chèn trùng
    const js = fs.readFileSync(path.join(d, "www", "fk-build.js"), "utf8");
    const www = fs.readFileSync(path.join(d, "www", "index.html"), "utf8");
    const attrs = {}, styles = [];
    const doc = { documentElement: { setAttribute: (k, v)=>{ attrs[k] = v; } }, head: { appendChild: s=> styles.push(s) },
      createElement: ()=> ({ setAttribute(){}, textContent: "" }) };
    const sb = { window: {}, document: doc }; sb.window.document = doc;
    vm.runInNewContext(js, sb);
    return { out, js, www, B: sb.window.FK_BUILD, attrs, css: styles.map(s=> s.textContent).join("") };
  } finally { rm(d); }
}

module.exports = {
  name: "Vòng R3 — Store: đóng gói Web/Android/iOS + tuân thủ Google Play & App Store",
  area: "capacitor.config.json · package.json · workflows build-android/build-ios/ios-appstore/tests/deploy-bundle · scripts/prepare-www.sh · scripts/native-* · scripts/store-* · store/ · docs/RELEASE-CHECKLIST.md",
  async define(t){

    t.test("R3-STORE-01: CapacitorHttp TẮT (bật = vá fetch/XHR toàn cục → hỏng realtime Firestore + upload Storage trên app native); WebView vẫn khoá debug/mixed content", ()=>{
      const c = JSON.parse(read("capacitor.config.json"));
      assert.equal(c.plugins.CapacitorHttp.enabled, false);
      assert.equal(c.appId, "vn.thangvu.fitkit"); assert.equal(c.webDir, "www");
      assert.equal(c.android.webContentsDebuggingEnabled, false); assert.equal(c.android.allowMixedContent, false);
      assert.equal(c.server.androidScheme, "https"); assert.equal(c.server.cleartext, false);
      assert.deepEqual(c.plugins.FirebaseAuthentication.providers, ["apple.com", "google.com"]);
    });

    t.test("R3-STORE-02: bộ vá Android — compileSdk/targetSdk 36, AGP 8.9.1 + Gradle 8.11.1 (AGP 8.2 không đọc được SDK 35/36), minSdk ≥ 23, versionCode/versionName, rgcfaIncludeGoogle; chạy lại không đổi", ()=>{
      const fx = androidFixture();
      try{
        const r = py([PATCH_AND, "--android-dir", fx.A, "--version-code", "57", "--version-name", "2.0.0", "--google"]);
        if(!r) return;
        assert.equal(r.code, 0, r.out);
        const v = fx.r("variables.gradle");
        assert.match(v, /compileSdkVersion = 36/); assert.match(v, /targetSdkVersion = 36/); assert.match(v, /minSdkVersion = 23/);
        assert.equal((v.match(/rgcfaIncludeGoogle = true/g) || []).length, 1);
        assert.match(fx.r("build.gradle"), /com\.android\.tools\.build:gradle:8\.9\.1/); assert.match(fx.r("build.gradle"), /google-services:4\.4\.2/);
        assert.match(fx.r("capacitor-cordova-android-plugins/build.gradle"), /gradle:8\.9\.1/);
        assert.match(fx.r("gradle/wrapper/gradle-wrapper.properties"), /gradle-8\.11\.1-all\.zip/);
        const g = fx.r("app/build.gradle");
        assert.match(g, /versionCode 57\b/); assert.match(g, /versionName "2\.0\.0"/); assert.match(g, /minifyEnabled false/);
        assert.match(fx.r("gradle.properties"), /android\.suppressUnsupportedCompileSdk=36/);
        const snap = ["variables.gradle", "build.gradle", "app/build.gradle", "app/src/main/AndroidManifest.xml", "gradle.properties"].map(fx.r).join("\u0000");
        const r2 = py([PATCH_AND, "--android-dir", fx.A, "--version-code", "57", "--version-name", "2.0.0", "--google"]);
        assert.equal(r2.code, 0, r2.out);
        assert.equal(["variables.gradle", "build.gradle", "app/build.gradle", "app/src/main/AndroidManifest.xml", "gradle.properties"].map(fx.r).join("\u0000"), snap, "bộ vá không idempotent");
        // target < 35 bị từ chối; project lạ (thiếu versionCode) → mã 1 chứ không im lặng
        assert.equal(py([PATCH_AND, "--android-dir", fx.A, "--target-sdk", "34"]).code, 1);
        fx.w("app/build.gradle", "android { }\n");
        assert.equal(py([PATCH_AND, "--android-dir", fx.A, "--version-code", "3"]).code, 1);
      } finally { rm(fx.d); }
      const wa = WF("build-android.yml");
      assert.match(wa, /python3 scripts\/native-android-patch\.py --android-dir android --target-sdk "\$TARGET_SDK"/);
      assert.ok(wa.indexOf("npx cap sync android") < wa.indexOf("native-android-patch.py --android-dir android --target-sdk"), "bộ vá phải chạy SAU cap sync (file cordova-plugins sinh lại khi sync)");
      assert.match(wa, /java-version: 21/);
    }, { timeout: 60000 });

    t.test("R3-STORE-03: edge-to-edge Android 15+ — MainActivity đệm inset thanh hệ thống + tai thỏ + bàn phím, chỉ từ API 35; bộ vá chép đúng package", ()=>{
      const src = read("store/native/android/MainActivity.java");
      assert.match(src, /extends BridgeActivity/); assert.match(src, /setOnApplyWindowInsetsListener/);
      assert.match(src, /Type\.systemBars\(\) \| WindowInsetsCompat\.Type\.displayCutout\(\)/); assert.match(src, /Type\.ime\(\)/);
      assert.match(src, /Build\.VERSION\.SDK_INT < EDGE_TO_EDGE_ENFORCED_API\) return;/); assert.match(src, /EDGE_TO_EDGE_ENFORCED_API = 35/);
      assert.match(src, /super\.onCreate\(savedInstanceState\);/); assert.match(src, /#061A24/);
      assert.equal((src.match(/\{/g) || []).length, (src.match(/\}/g) || []).length, "ngoặc nhọn lệch");
      const fx = androidFixture();
      try{
        const r = py([PATCH_AND, "--android-dir", fx.A]); if(!r) return;
        assert.equal(r.code, 0, r.out);
        const out = fx.r("app/src/main/java/vn/thangvu/fitkit/MainActivity.java");
        assert.match(out, /^package vn\.thangvu\.fitkit;/); assert.match(out, /setOnApplyWindowInsetsListener/);
      } finally { rm(fx.d); }
    }, { timeout: 30000 });

    t.test("R3-STORE-04/13: iOS Info.plist — đủ Camera + Microphone (quay video Khoảnh khắc: thiếu là văng app) + PhotoLibraryAdd, Việt + Anh; gỡ PhotoLibrary/Tracking/Location; mã hoá = false; chỉ màn dọc; URL scheme Google không thêm trùng", ()=>{
      assert.match(read("events-media.js"), /accept="video\/mp4,video\/quicktime/, "app còn cho chọn/quay video → cần NSMicrophoneUsageDescription");
      const ia = WF("ios-appstore.yml");
      for(const k of ["NS_CAMERA", "NS_MICROPHONE", "NS_PHOTO_ADD"]) assert.match(ia, new RegExp(k + ": 'TapEasy [^'\\n]+ / TapEasy [^'\\n]+'"), k + " phải có 2 ngôn ngữ");
      assert.doesNotMatch(ia, /NSPhotoLibraryUsageDescription|NSUserTrackingUsageDescription|NSLocation/);
      const d = tmpdir("fkios-");
      try{
        const app = path.join(d, "ios", "App", "App"); fs.mkdirSync(app, { recursive: true });
        const plist = body=> '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>' + body + "</dict></plist>\n";
        fs.writeFileSync(path.join(app, "Info.plist"), plist("<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string>" +
          "<key>NSPhotoLibraryUsageDescription</key><string>x</string><key>NSUserTrackingUsageDescription</key><string>x</string><key>NSLocationWhenInUseUsageDescription</key><string>x</string>" +
          "<key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string><string>UIInterfaceOrientationLandscapeLeft</string></array>" +
          "<key>UISupportedInterfaceOrientations~ipad</key><array><string>UIInterfaceOrientationPortrait</string></array>"));
        fs.writeFileSync(path.join(app, "GoogleService-Info.plist"), plist("<key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.123-abc</string><key>BUNDLE_ID</key><string>vn.thangvu.fitkit</string>"));
        const args = [PATCH_IOS, "--ios-dir", path.join(d, "ios", "App"), "--version", "2.0.0", "--build", "57", "--apple-signin", "--google-plist", path.join(app, "GoogleService-Info.plist")];
        const env = Object.assign({}, process.env); delete env.NS_CAMERA; delete env.NS_MICROPHONE; delete env.NS_PHOTO_ADD;
        let r = py(args, { env }); if(!r) return;
        assert.equal(r.code, 0, r.out);
        r = py(args, { env }); assert.equal(r.code, 0, r.out);                       // chạy lại
        const dump = f=> JSON.parse(py(["-c", "import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", path.join(app, f)]).out);
        const info = dump("Info.plist");
        for(const k of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription", "NSPhotoLibraryAddUsageDescription"]){
          assert.ok(/^TapEasy .{20,} \/ TapEasy .{20,}$/.test(info[k]), k + ": " + info[k]);
        }
        for(const k of ["NSPhotoLibraryUsageDescription", "NSUserTrackingUsageDescription", "NSLocationWhenInUseUsageDescription", "UISupportedInterfaceOrientations~ipad"]) assert.ok(!(k in info), "còn " + k);
        assert.strictEqual(info.ITSAppUsesNonExemptEncryption, false);
        assert.equal(info.CFBundleShortVersionString, "2.0.0"); assert.equal(info.CFBundleVersion, "57"); assert.equal(info.CFBundleDisplayName, "TapEasy");
        assert.equal(info.CFBundleIdentifier, "$(PRODUCT_BUNDLE_IDENTIFIER)");
        assert.deepEqual(info.UISupportedInterfaceOrientations, ["UIInterfaceOrientationPortrait"]);
        assert.deepEqual(info.CFBundleLocalizations, ["vi", "en"]);
        assert.equal(info.CFBundleURLTypes.length, 1, "URL scheme Google bị thêm trùng"); assert.deepEqual(info.CFBundleURLTypes[0].CFBundleURLSchemes, ["com.googleusercontent.apps.123-abc"]);
        assert.deepEqual(dump("App.entitlements")["com.apple.developer.applesignin"], ["Default"]);
        assert.ok(fs.existsSync(path.join(app, "PrivacyInfo.xcprivacy")), "chưa chép PrivacyInfo.xcprivacy");
        // phiên bản sai dạng → dừng
        assert.equal(py([PATCH_IOS, "--ios-dir", path.join(d, "ios", "App"), "--version", "2.0-beta"], { env }).code, 1);
      } finally { rm(d); }
    }, { timeout: 60000 });

    t.test("R3-STORE-05: privacy manifest PrivacyInfo.xcprivacy — không tracking, 13 loại dữ liệu khớp App Privacy, required-reason API UserDefaults CA92.1 + FileTimestamp C617.1; được thêm vào target + kiểm trong bản archive", ()=>{
      const x = read("store/native/ios/PrivacyInfo.xcprivacy");
      assert.match(x, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
      const types = [...x.matchAll(/<string>NSPrivacyCollectedDataType([A-Za-z]+)<\/string>/g)].map(m=> m[1]).filter(s=> !/^Purpose/.test(s));
      assert.deepEqual(types.sort(), ["CustomerSupport", "EmailAddress", "EmailsOrTextMessages", "Fitness", "Health", "Name", "OtherUserContent", "PhoneNumber", "PhotosorVideos", "PhysicalAddress", "ProductInteraction", "PurchaseHistory", "UserID"]);
      assert.doesNotMatch(x, /NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/);
      assert.match(x, /NSPrivacyAccessedAPICategoryUserDefaults[\s\S]*?CA92\.1/); assert.match(x, /NSPrivacyAccessedAPICategoryFileTimestamp[\s\S]*?C617\.1/);
      assert.doesNotMatch(x, /Location|AdvertisingData|DeviceID/);
      const priv = read("store/app-store/app-privacy.md");
      for(const k of ["Name", "Email Address", "Phone Number", "Physical Address", "Purchase History", "Emails or Text Messages", "Photos or Videos", "Customer Support", "Other User Content", "User ID", "Product Interaction", "Health", "Fitness"]) assert.ok(priv.includes("**" + k + "**"), "app-privacy.md thiếu " + k);
      const rb = read("scripts/native-ios-xcodeproj.rb");
      assert.match(rb, /add_resource\.call\("PrivacyInfo\.xcprivacy"\)/);
      assert.match(WF("ios-appstore.yml"), /test -f "\$A\/PrivacyInfo\.xcprivacy" \|\| \{ echo "::error::/);
      const r = py(["-c", "import plistlib,sys; d=plistlib.load(open(sys.argv[1],'rb')); assert d['NSPrivacyTracking'] is False and d['NSPrivacyTrackingDomains']==[]; print(len(d['NSPrivacyCollectedDataTypes']))", path.join(ROOT, "store/native/ios/PrivacyInfo.xcprivacy")]);
      if(r){ assert.equal(r.code, 0, r.out); assert.equal(r.out.trim(), "13"); }
    });

    t.test("R3-STORE-06: iOS chỉ iPhone (TARGETED_DEVICE_FAMILY = 1) — giao diện chưa tối ưu iPad; không ATT; entitlement Sign in with Apple chỉ ở bản nộp", ()=>{
      const rb = read("scripts/native-ios-xcodeproj.rb");
      assert.match(rb, /s\["TARGETED_DEVICE_FAMILY"\] = "1"/);
      assert.match(rb, /s\["CODE_SIGN_ENTITLEMENTS"\] = "App\/App\.entitlements" if opt\[:entitlements\]/);
      const ia = WF("ios-appstore.yml"), bi = WF("build-ios.yml");
      assert.match(ia, /RB_ARGS=\(--ios-dir ios\/App --entitlements\)/); assert.match(ia, /--apple-signin/);
      assert.doesNotMatch(bi, /--entitlements|--apple-signin/, "bản chưa ký không gắn entitlement");
      for(const w of [ia, bi]){ assert.match(w, /ruby scripts\/native-ios-xcodeproj\.rb/); assert.match(w, /python3 scripts\/native-ios-patch\.py/); assert.match(w, /FK_PLATFORM=ios /); }
      assert.doesNotMatch(read("scripts/native-ios-patch.py").replace(/REMOVE_KEYS = \[[\s\S]*?\]/, ""), /info\["NSUserTrackingUsageDescription"\]/);
    });

    t.test("R3-STORE-07: bản nộp App Store DỪNG khi thiếu GoogleService-Info.plist (nút Apple/Google chết = từ chối 2.1/4.8), trừ khi allow_no_social; kiểm đúng bundle id", ()=>{
      const ia = WF("ios-appstore.yml");
      assert.match(ia, /if \[ "\$HAS_GSI" != "true" \] && \[ "\$ALLOW_NO_SOCIAL" != "true" \]; then\s*\n\s*echo "::error::Thiếu secret IOS_GOOGLE_SERVICE_INFO_PLIST[^\n]*\n\s*exit 1/);
      assert.match(ia, /\[ "\$B" = "vn\.thangvu\.fitkit" \] \|\| \{ echo "::error::/);
      assert.match(ia, /allow_no_social:[\s\S]{0,200}default: false/);
      assert.match(ia, /"method": "app-store-connect"/); assert.match(ia, /"manageAppVersionAndBuildNumber": False/);
      for(const s of ["APPSTORE_KEY_ID", "APPSTORE_ISSUER_ID", "APPSTORE_KEY_P8", "APPLE_TEAM_ID", "IOS_DIST_CERT_P12_BASE64", "IOS_DIST_CERT_PASSWORD", "IOS_PROVISIONING_PROFILE_BASE64"]) assert.ok(ia.includes("secrets." + s), "thiếu secret " + s);
      assert.match(ia, /security delete-keychain/); assert.match(ia, /rm -rf ~\/private_keys/);
      const wa = WF("build-android.yml");
      assert.match(wa, /secrets\.GOOGLE_SERVICES_JSON_BASE64 \|\| secrets\.ANDROID_GOOGLE_SERVICES_JSON/);
      assert.match(wa, /pk\.includes\("vn\.thangvu\.fitkit"\)/);
    });

    t.test("R3-STORE-08: secrets không chèn thẳng vào lệnh shell (chỉ qua env:) ở 3 workflow build; AAB ký bằng Gradle + jarsigner -verify; thiếu khoá → APK debug + cảnh báo rõ", ()=>{
      for(const f of ["build-android.yml", "build-ios.yml", "ios-appstore.yml"]){
        const bad = WF(f).split("\n").filter(l=> /\$\{\{\s*secrets\./.test(l) && !/^\s*#/.test(l) && !/^\s*[A-Za-z_][A-Za-z0-9_]*:\s*\$\{\{[^}]*\}\}\s*(#.*)?$/.test(l));
        assert.deepEqual(bad, [], f + ": secret nội suy trong lệnh");
      }
      const wa = WF("build-android.yml");
      for(const s of ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) assert.ok(wa.includes("secrets." + s), s);
      assert.match(wa, /bundleRelease assembleRelease --no-daemon \\\s*\n\s*-Pandroid\.injected\.signing\.store\.file="\$KS"/);
      assert.match(wa, /jarsigner -verify "\$AAB" \| grep -q "jar verified"/);
      assert.match(wa, /Chưa có 4 secret ANDROID_KEYSTORE_\* → CHỈ tạo APK debug/);
      assert.match(wa, /if: env\.HAS_KEY == 'true'/); assert.match(wa, /assembleDebug/);
      assert.match(wa, /rm -f "\$KS"/);
      assert.match(wa, /permissions:\s*\n\s*contents: read/);
    });

    t.test("R3-STORE-09/17: manifest Android — quyền tối thiểu (POST_NOTIFICATIONS, VIBRATE, CAMERA không bắt buộc phần cứng), gỡ AD_ID, khoá dọc, XML hợp lệ, không exact alarm mặc định; soát merged manifest bắt quyền thừa", ()=>{
      const fx = androidFixture();
      try{
        let r = py([PATCH_AND, "--android-dir", fx.A]); if(!r) return;
        assert.equal(r.code, 0, r.out);
        const m = fx.r("app/src/main/AndroidManifest.xml");
        const perms = [...m.matchAll(/<uses-permission android:name="([^"]+)" \/>/g)].map(x=> x[1]).sort();
        assert.deepEqual(perms, ["android.permission.CAMERA", "android.permission.INTERNET", "android.permission.POST_NOTIFICATIONS", "android.permission.VIBRATE"]);
        assert.match(m, /<uses-feature android:name="android\.hardware\.camera" android:required="false" \/>/);
        assert.match(m, /<uses-permission android:name="com\.google\.android\.gms\.permission\.AD_ID" tools:node="remove" \/>/);
        assert.match(m, /<manifest xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
        assert.match(m, /<activity android:screenOrientation="portrait"/);
        assert.doesNotMatch(m, /EXACT_ALARM|LOCATION|CONTACTS|READ_MEDIA|RECORD_AUDIO/);
        const x = py(["-c", "import sys,xml.dom.minidom as d; d.parse(sys.argv[1])", path.join(fx.A, "app/src/main/AndroidManifest.xml")]); assert.equal(x.code, 0, x.out);
        // --exact-alarm là lựa chọn có chủ ý
        r = py([PATCH_AND, "--android-dir", fx.A, "--exact-alarm"]); assert.equal(r.code, 0, r.out);
        assert.match(fx.r("app/src/main/AndroidManifest.xml"), /android\.permission\.SCHEDULE_EXACT_ALARM/);
        // merged manifest có quyền thừa → mã 1; sạch → 0
        const mm = "app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml";
        fx.w(mm, '<manifest><uses-sdk android:targetSdkVersion="36"/><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/></manifest>');
        r = py([PATCH_AND, "--check-merged", "--android-dir", fx.A]); assert.equal(r.code, 1, r.out); assert.match(r.out, /Quyền thừa[^\n]*ACCESS_FINE_LOCATION/);
        fx.w(mm, '<manifest><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/></manifest>');
        r = py([PATCH_AND, "--check-merged", "--android-dir", fx.A]); assert.equal(r.code, 0, r.out);
        fx.w(mm, '<manifest><uses-permission android:name="com.google.android.gms.permission.AD_ID"/></manifest>');
        assert.equal(py([PATCH_AND, "--check-merged", "--android-dir", fx.A]).code, 1);
      } finally { rm(fx.d); }
      assert.match(WF("build-android.yml"), /native-android-patch\.py --check-merged --android-dir android/);
    }, { timeout: 60000 });

    t.test("R3-STORE-10: bản phát hành không được dùng icon mặc định của Capacitor — tạo icon/splash lỗi thì dừng; đủ ảnh nguồn adaptive + splash", ()=>{
      assert.match(WF("build-android.yml"), /if ! npm run assets -- --android; then\s*\n\s*if \[ "\$HAS_KEY" = "true" \]; then echo "::error::/);
      assert.match(WF("ios-appstore.yml"), /npm run assets -- --ios \|\| \{ echo "::error::[^\n]*exit 1; \}/);
      for(const f of ["icon-only.png", "icon-foreground.png", "icon-background.png", "splash.png", "splash-dark.png", "icon-512.png", "icon-1024.png"]) assert.ok(exists("assets/" + f), "thiếu assets/" + f);
      assert.match(JSON.parse(read("package.json")).scripts.assets, /capacitor-assets generate --iconBackgroundColor/);
    });

    t.test("R3-STORE-11: cờ nền tảng window.FK_BUILD — prepare-www.sh sinh www/fk-build.js, chèn làm script ĐẦU TIÊN (không trùng), đúng platform/store/hide; bản store tự ẩn .role-card.soon + [data-store-hide]", ()=>{
      let r = runFkBuild({ FK_PLATFORM: "ios", STORE_BUILD: "1", FK_BUILD_NUMBER: "57" });
      assert.match(r.out, /FK_BUILD: platform=ios store=true version=\d+\.\d+\.\d+ build=57/);
      assert.equal(r.B.platform, "ios"); assert.strictEqual(r.B.store, true); assert.equal(r.B.build, "57");
      assert.equal(r.B.version, JSON.parse(read("package.json")).version);
      assert.deepEqual(Array.from(r.B.authProviders), ["apple", "google"]);
      assert.deepEqual(Object.assign({}, r.B.hide), { comingSoon: true, emptyShop: true, externalDigitalPay: true });
      assert.ok(Object.isFrozen(r.B) && Object.isFrozen(r.B.hide));
      assert.equal(r.attrs["data-fk-platform"], "ios"); assert.equal(r.attrs["data-fk-store"], "1");
      assert.match(r.css, /\.role-card\.soon\{display:none !important\}/); assert.match(r.css, /\[data-store-hide~="ios"\]/);
      assert.equal((r.www.match(/<script src="fk-build\.js"><\/script>/g) || []).length, 1, "chèn trùng / thiếu thẻ fk-build.js");
      const firstScript = /<script\b[^>]*\bsrc="([^"]+)"/.exec(r.www)[1];
      assert.equal(firstScript, "fk-build.js", "fk-build.js phải là script đầu tiên");
      // Android store: không ẩn thanh toán ngoài (chỉ iOS 3.1.1); thiếu google-services → authProviders rỗng
      r = runFkBuild({ FK_PLATFORM: "android", STORE_BUILD: "1", FK_AUTH_PROVIDERS: "none" });
      assert.equal(r.B.platform, "android"); assert.strictEqual(r.B.hide.externalDigitalPay, false); assert.strictEqual(r.B.hide.comingSoon, true);
      assert.deepEqual(Array.from(r.B.authProviders), []);
      // bản thử / web: không ẩn gì, không gắn data-fk-store, không chèn CSS
      r = runFkBuild({});
      assert.equal(r.B.platform, "web"); assert.strictEqual(r.B.store, false); assert.strictEqual(r.B.authProviders, null);
      assert.deepEqual(Object.assign({}, r.B.hide), { comingSoon: false, emptyShop: false, externalDigitalPay: false });
      assert.ok(!("data-fk-store" in r.attrs)); assert.equal(r.css, "");
      const sh = read("scripts/prepare-www.sh");
      assert.match(sh, /case "\$FK_PLATFORM" in web\|android\|ios\) ;; \*\) echo "❌ FK_PLATFORM/);
      assert.ok(sh.indexOf("FKBUILD_EOF") < sh.indexOf("node - <<'NODE_EOF'"), "fk-build.js phải được chèn TRƯỚC bước sinh ASSETS của sw.js (để được precache)");
      assert.match(WF("build-android.yml"), /FK_PLATFORM=android FK_BUILD_NUMBER=\$\{\{ github\.run_number \}\}/);
      assert.match(WF("ios-appstore.yml"), /FK_PLATFORM=ios [^\n]*STORE_BUILD=1 bash scripts\/prepare-www\.sh/);
      // mã nguồn web gốc KHÔNG phụ thuộc file này (GitHub Pages chạy thẳng từ gốc repo)
      assert.doesNotMatch(read("index.html"), /fk-build\.js/);
    }, { timeout: 60000 });

    t.test("R3-STORE-12: deploy-bundle không chép đè .git / thư mục build native, tự bỏ tệp bí mật, từ chối symlink", ()=>{
      const w = WF("deploy-bundle.yml");
      assert.match(w, /rm -rf \/tmp\/bundle\/\.git \/tmp\/bundle\/\.github/);
      for(const d of ["www", "android", "ios", "node_modules", "_test"]) assert.ok(w.includes("/tmp/bundle/" + d), "không loại " + d);
      for(const s of ["*.keystore", "*.jks", "*.p12", "*.p8", "*.mobileprovision", "google-services.json", "GoogleService-Info.plist", ".env"]) assert.ok(w.includes('-name "' + s + '"'), "không lọc " + s);
      assert.match(w, /find \/tmp\/bundle -type l \| grep -q \. ; then|find \/tmp\/bundle -type l \| grep -q \.; then/);
    });

    t.test("R3-STORE-14: metadata store/ — đúng giới hạn ký tự, mô tả ≤ 4000 có miễn trừ y khoa, không nhắc Facebook (chưa có SDK native) / store khác / 'sắp ra mắt'; ghi chú phát hành Play ≤ 500", ()=>{
      const M = JSON.parse(read("store/metadata.json"));
      assert.equal(M.bundleId, "vn.thangvu.fitkit"); assert.equal(M.packageName, "vn.thangvu.fitkit");
      assert.equal(M.version, JSON.parse(read("package.json")).version, "store/metadata.json lệch version với package.json");
      const len = s=> Array.from(s).length;
      for(const l of ["vi", "en"]) for(const [k, lim] of [["name", 30], ["subtitle", 30], ["shortDescription", 80], ["promotionalText", 170], ["keywords", 100]])
        assert.ok(len(M[l][k]) > 0 && len(M[l][k]) <= lim, l + "." + k + " = " + len(M[l][k]) + " > " + lim);
      for(const u of Object.values(M.urls)) assert.match(u, /^https:\/\/thangvu030198-ai\.github\.io\/fitkit-app\/[a-z-]+\.html$/);
      for(const f of ["privacy-policy.html", "delete-account.html", "landing.html"]) assert.ok(exists(f), "thiếu " + f);
      const pairs = [["app-store/vi", "vi"], ["app-store/en-US", "en"]];
      for(const [dir, l] of pairs){
        assert.equal(read("store/" + dir + "/name.txt").trim(), M[l].name); assert.equal(read("store/" + dir + "/subtitle.txt").trim(), M[l].subtitle);
        assert.equal(read("store/" + dir + "/keywords.txt").trim(), M[l].keywords);
        const d = read("store/" + dir + "/description.txt");
        assert.ok(len(d) <= 4000, dir + " mô tả " + len(d));
        assert.doesNotMatch(d, /android|google play|facebook|sắp ra mắt|coming soon|beta|demo/i, dir + "/description.txt");
        assert.doesNotMatch(read("store/" + dir + "/release-notes.txt"), /facebook/i);
      }
      for(const [dir, l] of [["google-play/vi-VN", "vi"], ["google-play/en-US", "en"]]){
        assert.equal(read("store/" + dir + "/title.txt").trim(), M[l].name); assert.equal(read("store/" + dir + "/short-description.txt").trim(), M[l].shortDescription);
        const d = read("store/" + dir + "/full-description.txt");
        assert.ok(len(d) <= 4000); assert.doesNotMatch(d, /facebook|app store|iphone|sắp ra mắt|coming soon/i, dir);
        assert.ok(len(read("store/" + dir + "/release-notes.txt").trim()) <= 500, dir + " release notes > 500");
      }
      assert.match(read("store/app-store/vi/description.txt"), /không phải thiết bị y tế/); assert.match(read("store/app-store/en-US/description.txt"), /not a medical device/);
      assert.match(read("store/google-play/vi-VN/full-description.txt"), /chỉ gửi cho PT khi bạn chọn chia sẻ/);
      const ds = read("store/google-play/data-safety.md");
      for(const k of ["Name", "Email address", "User IDs", "Address", "Phone number", "Purchase history", "Health info", "Fitness info", "Other in-app messages", "Photos", "Videos", "App interactions", "Other user-generated content"]) assert.ok(ds.includes("**" + k + "**"), "data-safety.md thiếu " + k);
      assert.match(ds, /delete-account\.html/);
      const rn = read("store/app-store/review-notes-en.md");
      const note = /```text\n([\s\S]*?)\n```/.exec(rn)[1];
      assert.ok(len(note) <= 4000, "ghi chú review " + len(note) + " > 4000");
      for(const k of ["1.2", "4.2", "4.8", "5.1.1(v)", "1.4.1", "3.1", "Sign in with Apple", "delete-account.html", "not a medical device"]) assert.ok(note.includes(k), "review notes thiếu " + k);
      assert.doesNotMatch(note, /[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]{3,}/i);
    });

    t.test("R3-STORE-15/16/18: tài liệu + workflow nhất quán — tên workflow đúng trong README, bảng secrets, versionCode có offset, chọn Xcode mới nhất; bản sao wf/ khớp .github/workflows", ()=>{
      const name = /^name: (.+)$/m.exec(WF("build-ios.yml"))[1];
      assert.ok(read("README-ios-build.md").includes('"' + name + '"'), "README-ios-build.md ghi sai tên workflow");
      const wa = WF("build-android.yml");
      assert.match(wa, /CODE=\$\(\( \$\{\{ github\.run_number \}\} \+ VERSION_CODE_OFFSET \)\)/); assert.match(wa, /vars\.ANDROID_VERSION_CODE_OFFSET \|\| '0'/);
      assert.match(wa, /V=\$\(node -p "require\('\.\/package\.json'\)\.version"\)/);
      for(const f of ["build-ios.yml", "ios-appstore.yml"]) assert.match(WF(f), /xcode-select -s "\$X"/);
      const rc = read("docs/RELEASE-CHECKLIST.md");
      for(const s of ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD", "GOOGLE_SERVICES_JSON_BASE64", "APPSTORE_KEY_ID", "APPSTORE_ISSUER_ID", "APPSTORE_KEY_P8", "APPLE_TEAM_ID", "IOS_GOOGLE_SERVICE_INFO_PLIST", "IOS_DIST_CERT_P12_BASE64", "IOS_PROVISIONING_PROFILE_BASE64"])
        assert.ok(rc.includes("`" + s + "`"), "RELEASE-CHECKLIST thiếu secret " + s);
      for(const k of ["## A. Pipeline 3 bản", "## B1. Google Play", "## B2. App Store", "## D. Cờ nền tảng", "## E. Việc chủ dự án BẮT BUỘC", "## F. Kiểm trên máy thật", "Data safety", "Health apps", "12 người", "14 ngày", "25 USD", "99 USD", "**1.2**", "**1.4.1**", "**2.1**", "**3.1.1**", "**4.2**", "**4.8**", "**5.1.1(v)**", "delete-account.html", "FK_BUILD"])
        assert.ok(rc.includes(k), "RELEASE-CHECKLIST thiếu: " + k);
      const wfDir = path.resolve(ROOT, "..", "wf");
      if(fs.existsSync(wfDir)) for(const f of ["build-android.yml", "build-ios.yml", "ios-appstore.yml", "tests.yml", "deploy-bundle.yml"])
        assert.equal(fs.readFileSync(path.join(wfDir, f), "utf8"), WF(f), "wf/" + f + " khác .github/workflows/" + f + " — copy lại");
    });

    t.test("R3-STORE-22: prepare-www.sh tự chép module mới mà index.html tham chiếu (kể cả nạp lười, thư mục con), từ điển i18n*.js và terms.html — không chép đường dẫn thoát ra ngoài; từ điển vào precache", ()=>{
      const sh = read("scripts/prepare-www.sh");
      const m = /# R3-store \(R3-STORE-22\)[\s\S]*?\n(for f in \$\(grep[\s\S]*?\ndone\nfor f in i18n\*\.js terms\.html; do\n[\s\S]*?\ndone)\n/.exec(sh);
      assert.ok(m, "thiếu khối tự chép");
      assert.ok(sh.indexOf("R3-STORE-22") < sh.indexOf("\nmissing=0\n"), "phải tự chép TRƯỚC bước kiểm thiếu file");
      assert.match(sh, /if\(\/\^i18n\[\\w\.-\]\*\\\.js\$\/\.test\(f\) && !extra\.includes\(f\)\) extra\.push\(f\);/);
      const d = tmpdir("fkcopy-");
      try{
        fs.mkdirSync(path.join(d, "www")); fs.mkdirSync(path.join(d, "lazy"));
        fs.writeFileSync(path.join(d, "index.html"), '<link rel="stylesheet" href="have.css"><link rel="stylesheet" href="newmod.css">\n<script src="newmod.js"></script><script type="text/fk-lazy" data-group="x" src="lazy/x.js"></script>\n<script src="../evil.js"></script><script src="https://cdn.example/x.js"></script>');
        for(const f of ["have.css", "newmod.css", "newmod.js", "lazy/x.js", "i18n.js", "i18n-en.js", "terms.html"]) fs.writeFileSync(path.join(d, f), "/* " + f + " */");
        fs.writeFileSync(path.join(d, "..", path.basename(d) + "-evil.js"), "x");
        fs.writeFileSync(path.join(d, "www", "have.css"), "/* bản đã chép */");
        let out;
        try{ out = cp.execFileSync("bash", ["-c", "set -e\n" + m[1] + "\necho XONG"], { cwd: d }).toString(); }
        catch(e){ if(e.code === "ENOENT") return; throw new Error(String(e.stdout) + String(e.stderr)); }
        finally { try{ fs.unlinkSync(path.join(d, "..", path.basename(d) + "-evil.js")); }catch(e){} }
        assert.match(out, /XONG/);
        for(const f of ["newmod.css", "newmod.js", "lazy/x.js", "i18n.js", "i18n-en.js", "terms.html"]) assert.ok(fs.existsSync(path.join(d, "www", f)), "không tự chép " + f);
        assert.equal(fs.readFileSync(path.join(d, "www", "have.css"), "utf8"), "/* bản đã chép */", "không được chép đè file đã có");
        assert.deepEqual(fs.readdirSync(path.join(d, "www")).filter(f=> /evil/.test(f)), []);
      } finally { rm(d); }
    }, { timeout: 30000 });

    t.test("R3-STORE-19: kiểm tĩnh bộ đóng gói — script bash/python/ruby đúng cú pháp, JSON hợp lệ, mọi đường dẫn workflow gọi đều tồn tại, script ảnh chụp ra đúng kích thước store", ()=>{
      try{ cp.execFileSync("bash", ["-n", path.join(ROOT, "scripts/prepare-www.sh")], { stdio: "pipe" }); }catch(e){ if(e.code !== "ENOENT") throw new Error("prepare-www.sh: " + e.stderr); }
      try{ cp.execFileSync("ruby", ["-c", path.join(ROOT, "scripts/native-ios-xcodeproj.rb")], { stdio: "pipe" }); }catch(e){ if(e.code !== "ENOENT") throw new Error("native-ios-xcodeproj.rb: " + e.stderr); }
      for(const f of ["package.json", "capacitor.config.json", "store/metadata.json", "store/screenshots/seed-state.json"]) JSON.parse(read(f));
      const c = py(["-c", "import ast,sys\nfor f in sys.argv[1:]: ast.parse(open(f,encoding='utf8').read(), f)", ...["native-android-patch.py", "native-ios-patch.py", "store-screenshots.py", "build-single-html.py"].map(f=> path.join(ROOT, "scripts", f))]);
      if(c) assert.equal(c.code, 0, c.out);
      for(const f of ["build-android.yml", "build-ios.yml", "ios-appstore.yml", "tests.yml"]){
        const w = WF(f);
        assert.doesNotMatch(w, /\t/, f + " có ký tự tab (YAML hỏng)");
        for(const m of w.matchAll(/(?:bash|python3|ruby|py_compile)\s+((?:scripts|tests)\/[\w./-]+\.(?:sh|py|rb|js))/g)) assert.ok(exists(m[1]), f + " gọi file không có: " + m[1]);
        for(const m of w.matchAll(/(scripts\/[\w-]+\.(?:sh|py|rb))/g)) assert.ok(exists(m[1]), f + " nhắc file không có: " + m[1]);
      }
      const pkg = JSON.parse(read("package.json"));
      for(const d of ["@capacitor/android", "@capacitor/ios", "@capacitor/core", "@capacitor/app", "@capacitor/haptics", "@capacitor/share", "@capacitor/browser", "@capacitor/local-notifications", "@capacitor-firebase/authentication"]) assert.match(pkg.dependencies[d], /^\^6\./, d + " phải cùng major 6");
      const r = py([path.join(ROOT, "scripts/store-screenshots.py"), "--dry-run"]);
      if(r){
        assert.equal(r.code, 0, r.out);
        for(const [d, w, h] of [["ios-6.9", 1320, 2868], ["ios-6.7", 1290, 2796], ["ios-6.5", 1242, 2688], ["ios-5.5", 1242, 2208], ["android-phone", 1080, 1920]])
          assert.match(r.out, new RegExp(d.replace(".", "\\.") + "\\s+" + w + " × " + h + " px"), d);
        assert.doesNotMatch(r.out, /không hợp lệ với Google Play/);
        assert.equal(py([path.join(ROOT, "scripts/store-screenshots.py"), "--dry-run", "--only", "ipad"]).code, 2);
      }
    }, { timeout: 60000 });
  },
};
