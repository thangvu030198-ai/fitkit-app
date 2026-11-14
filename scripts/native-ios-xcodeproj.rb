#!/usr/bin/env ruby
# TapEasy — sửa ios/App/App.xcodeproj + Podfile sau `npx cap add ios` (R3-store). Cần gem xcodeproj (có sẵn cùng CocoaPods trên macOS runner).
#
#   ruby scripts/native-ios-xcodeproj.rb [--ios-dir ios/App] [--google] [--entitlements] [--manual-profile "Tên profile" --team TEAMID]
#
#   luôn làm : thêm PrivacyInfo.xcprivacy vào target App (Copy Bundle Resources) · TARGETED_DEVICE_FAMILY = "1" (CHỈ iPhone —
#              giao diện chưa tối ưu iPad; app vẫn chạy trên iPad ở chế độ tương thích iPhone)
#   --google       : thêm GoogleService-Info.plist vào target App + subspec CapacitorFirebaseAuthentication/Google trong Podfile
#   --entitlements : CODE_SIGN_ENTITLEMENTS = App/App.entitlements (Sign in with Apple)
#   --manual-profile NAME --team ID : ký tay CHỈ cho target App (đặt trên dòng lệnh xcodebuild sẽ làm hỏng target Pods)
require "optparse"

opt = { dir: File.join("ios", "App"), google: false, entitlements: false, profile: nil, team: nil }
OptionParser.new do |o|
  o.on("--ios-dir DIR") { |v| opt[:dir] = v }
  o.on("--google") { opt[:google] = true }
  o.on("--entitlements") { opt[:entitlements] = true }
  o.on("--manual-profile NAME") { |v| opt[:profile] = v }
  o.on("--team ID") { |v| opt[:team] = v }
end.parse!

require "xcodeproj"

proj_path = File.join(opt[:dir], "App.xcodeproj")
project = Xcodeproj::Project.open(proj_path)
target = project.targets.find { |t| t.name == "App" } or abort("::error::Không thấy target App trong #{proj_path}")
group = project.main_group.find_subpath("App", false) or abort("::error::Không thấy nhóm App trong project")

add_resource = lambda do |name|
  abort("::error::Thiếu file #{name} trong #{opt[:dir]}/App") unless File.exist?(File.join(opt[:dir], "App", name))
  ref = group.files.find { |f| f.path == name } || group.new_reference(name)
  in_phase = target.resources_build_phase.files_references.include?(ref)
  target.add_resources([ref]) unless in_phase
  puts "• #{name}: #{in_phase ? 'đã có trong' : 'thêm vào'} Copy Bundle Resources"
end

add_resource.call("PrivacyInfo.xcprivacy")
add_resource.call("GoogleService-Info.plist") if opt[:google]

target.build_configurations.each do |c|
  s = c.build_settings
  s["TARGETED_DEVICE_FAMILY"] = "1"
  s["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements" if opt[:entitlements]
  if opt[:profile]
    s["CODE_SIGN_STYLE"] = "Manual"
    s["PROVISIONING_PROFILE_SPECIFIER"] = opt[:profile]
    s["CODE_SIGN_IDENTITY"] = "Apple Distribution"
    s["CODE_SIGN_IDENTITY[sdk=iphoneos*]"] = "Apple Distribution"
    s["DEVELOPMENT_TEAM"] = opt[:team] if opt[:team]
  end
end
project.save
puts "✅ App.xcodeproj: TARGETED_DEVICE_FAMILY=1#{opt[:entitlements] ? ' · entitlements' : ''}#{opt[:profile] ? ' · ký tay (' + opt[:profile] + ')' : ''}"

if opt[:google]
  podfile = File.join(opt[:dir], "Podfile")
  s = File.read(podfile)
  line = "  pod 'CapacitorFirebaseAuthentication/Google', :path => '../../node_modules/@capacitor-firebase/authentication'"
  unless s.include?("CapacitorFirebaseAuthentication/Google")
    s.sub!(/^([ \t]*capacitor_pods[ \t]*)$/) { $1 + "\n" + line } or abort("::error::Podfile không có dòng capacitor_pods trong target 'App'")
    File.write(podfile, s)
  end
  puts "• Podfile: CapacitorFirebaseAuthentication/Google"
end
