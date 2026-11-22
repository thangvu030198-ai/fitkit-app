# HYROX 3D — bản đồ đường đua + nhân vật (Blender → glb → meshopt → Three.js)

Trạng thái: **bản mẫu**, chưa tích hợp vào app, chưa deploy. 3D là *tuỳ chọn cho máy khoẻ*; app vẫn cần bản 2D/ảnh tĩnh làm mặc định.

## 1. Kiến trúc

```
scripts/hyrox3d/build_scene_v2.py   (Blender 4.2 LTS → 5.x, chạy nền được)
   ├─ lõi Python thuần: đường Catmull-Rom (tham số độ dài cung), hình học, bộ xương 17 xương,
   │  IK chân 2 khớp, 11 hoạt ảnh, lịch chạy video xem trước, JSON   ← kiểm bằng --selftest
   └─ phần bpy: vật liệu, mesh, armature + skin cứng, Action + NLA, xuất glb, render
        │
        ├─ hyrox_map.glb      cảnh tĩnh (đường bo cạnh, vạch kẻ, 8 bục, thiết bị, cổng, cờ) — 1 mesh/nhiều vật liệu,
        │                      không texture, không chữ; 8 node StatusRing_01..08 dùng chung 1 lưới; node rỗng Anchor_*
        ├─ hyrox_runner.glb   armature + RunnerBody (skin) + đạo cụ Prop_* gắn vào xương + 11 clip
        ├─ hyrox_path.json    200 điểm đường (glTF Y-up), độ dài, trạm (s, f, pos, work_pos, pad_center, nhãn…),
        │                      STRIDE, tên clip, đạo cụ theo clip, camera, split mẫu
        └─ preview_*.png / frames → preview_run.mp4 (chỉ xem trước)
scripts/hyrox3d/optimize.mjs        gltf-transform: dedup → weld → resample → prune → meshopt (quantize + EXT_meshopt_compression)
scripts/hyrox3d/export_pure.py      xuất glb bằng Python thuần (dự phòng khi Blender lỗi; test viewer)
media/hyrox/viewer.html             trang xem thử Three.js 0.170 (GLTFLoader + MeshoptDecoder)
.github/workflows/media-hyrox3d.yml workflow_dispatch: Blender → glb → meshopt → artifact (+ commit media/hyrox)
```

Chữ nhãn **không** nằm trong glb: app vẽ bằng HTML/canvas tại `stations[i].label_anchor` (toàn cảnh) hoặc trên `pad_center` (bám theo).
Chữ 3D chỉ có trong ảnh/clip render xem trước.

### Quy ước
- 1 đơn vị = 1 m. glTF: Y lên. Nhân vật nhìn **+Z**; `yaw = atan2(dx, dz)` → `rotation.y`.
- Hoạt ảnh **tại chỗ** (in-place). App tự di chuyển gốc nhân vật dọc đường.
- `STRIDE = 1.5 m` / chu kỳ Run (20 khung @30 fps = 0.667 s) → tốc độ tự nhiên 2.25 m/s.
  Không trượt chân: `Run.timeScale = tốcĐộThật / (STRIDE / 0.667)` (viewer giới hạn 3.2×).
- Ở trạm, nhân vật rẽ mượt sang phải `work_offset = 0.95 m` trong quãng `approach = 1.8 m` (đúng chỗ đứng trước thiết bị):
  `gốc(s) = đường(s) + phải(s) · 0.95 · smootherstep(1 − |s − s_trạm| / 1.8)`.
- Đạo cụ: `Work_Farmers` → Prop_KB_L/R, `Work_Lunge` → Prop_Sandbag, `Work_WallBall` → Prop_WallBall, `Work_Row` → Prop_RowHandle
  (ẩn mặc định; bật theo `props` trong JSON).

### Hoạt ảnh (11 clip, lặp liền mạch: khung cuối ≡ khung đầu)
| Clip | Khung | Ghi chú |
|---|---|---|
| Run | 20 | quỹ đạo bàn chân → IK: chạm gót, lăn, kiễng mũi đạp; chân trụ trượt < 0.02 m/s (tự kiểm); đánh tay ngược pha, xoay hông/vai ngược chiều, nhấp nhô 2 lần/chu kỳ, nghiêng hông |
| Idle | 60 | thở (ngực), nhún, dồn trọng tâm |
| Celebrate | 48 | giơ tay chữ V, bật nhảy, đấm tay |
| Work_SkiErg | 40 | kéo từ trên xuống, gập hông, gối khuỵu; kéo nhanh – hồi chậm |
| Work_SledPush | 24 | người đổ 54°, tay đẩy, chân đạp luân phiên |
| Work_SledPull | 30 | ngả sau, kéo dây tay-qua-tay, xoay ngực |
| Work_Burpee | 72 | ngồi xổm → plank → ngực chạm sàn → plank → thu chân → bật nhảy |
| Work_Row | 48 | catch → đạp chân → ngả người → kéo tay (chân cố định trên bàn đạp nhờ IK) |
| Work_Farmers | 32 | bước tại chỗ, tay thẳng cầm tạ ấm |
| Work_Lunge | 64 | bao cát trên vai, lunge trái/phải |
| Work_WallBall | 40 | ôm bóng – squat – bật ném lên – đỡ |

Nội suy: khoá tư thế → Hermite tuần hoàn có kẹp ở cực trị (tương đương Bezier auto-clamped) → IK mỗi khung →
key quaternion mỗi khung, Bezier AUTO_CLAMPED + F-modifier Cycles (lặp không giật). Video xem trước trong Blender:
NLA 2 track (Run dưới, Idle/Work/Celebrate trên, hoà trộn 8 khung), thời gian dải Run gắn theo quãng đường thật
(`strip_time` động) → không trượt chân cả lúc tăng/giảm tốc; gốc đi theo độ dài cung với tăng/giảm tốc (1−cos)/2,
hướng nhìn look-ahead + làm mượt, nghiêng khi vào cua, cúi nhẹ khi tăng tốc. Marker: START, S1..S8, Sk_DONE, FINISH.

## 2. Chạy workflow (GitHub Actions)
Actions → **Media — bản đồ HYROX 3D** → Run workflow:
- `render`: `preview` (ảnh toàn cảnh + 90 khung clip trạm 4→5 + 11 ảnh tư thế) hoặc `none` (chỉ glb, ~3 phút).
- `res` 540 (→ 540×960), `samples` 24 (Cycles CPU + OIDN), `blender` 4.2.23, `commit` true/false.
- Kết quả: artifact `hyrox3d` (glb gốc + `opt/` nén + bản `.draco.glb` để so sánh, json, png, mp4, `size-report.md`, `.blend`, `blender.log`);
  bảng dung lượng hiện ở **Summary** của lần chạy. `commit=true` → `media/hyrox/` (glb nén, json, preview_*.jpg, preview_run.mp4 360p, size-report.md).
- Blender lỗi → workflow vẫn xuất glb bằng `export_pure.py` (có cảnh báo, file `FALLBACK_PURE_PYTHON.txt`).
- Xem thử: mở `media/hyrox/viewer.html` qua HTTP (GitHub Pages hoặc `npx serve media/hyrox`), không mở bằng file://.

## 3. Chạy trên máy anh Thắng (Windows, Blender 5.2, RTX)
**Cách 1 — giao diện:** Blender → tab *Scripting* → *Open* `scripts/hyrox3d/build_scene_v2.py` → *Run Script*.
Không tham số → xuất vào `hyrox_out` (cạnh file .blend nếu đã lưu, không thì `Documents\hyrox_out`), không render.
Sau đó bấm Space để xem hoạt ảnh; đổi camera: chọn `FollowCam`/`MapCam` → Ctrl+Numpad0.

**Cách 2 — dòng lệnh (render đẹp bằng GPU):**
```bat
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python-exit-code 1 ^
  --python scripts\hyrox3d\build_scene_v2.py -- --out D:\hyrox_out --render preview --res 1080 --samples 128 --gpu
:: hoặc EEVEE (nhanh): --engine eevee --res 1080 --samples 64
ffmpeg -framerate 30 -pattern_type glob -i "D:/hyrox_out/frames/*.png" -c:v libx264 -crf 18 -pix_fmt yuv420p preview_run.mp4
```
(Trên Windows ffmpeg không có glob: dùng `-start_number <khung đầu> -i D:/hyrox_out/frames/f_%04d.png`.)

Kiểm phần toán học không cần Blender: `python scripts/hyrox3d/build_scene_v2.py --selftest`.

### Nén trên máy
```bash
cd scripts/hyrox3d && npm install
node optimize.mjs --in D:/hyrox_out --out D:/hyrox_out/opt --draco
# hoặc CLI một lệnh:
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress false --join false --flatten false --instance false   # tên cờ có thể khác theo phiên bản: xem --help
# hoặc gltfpack (meshoptimizer): gltfpack -i in.glb -o out.glb -cc -kn   (-kn giữ tên node StatusRing_xx / Prop_*)
```
Lưu ý: KHÔNG bật join/flatten/instance cho bản đồ (gộp mất 8 node vòng sáng riêng), KHÔNG để gltfpack đổi tên/gộp node (`-kn`).

## 4. Nén: Draco vs meshopt vs texture
| | Draco | meshopt (`EXT_meshopt_compression`) | KTX2 / WebP |
|---|---|---|---|
| Đối tượng | chỉ hình học | hình học **+ hoạt ảnh** + morph | texture |
| Tỉ lệ (riêng) | tốt nhất cho lưới lớn | kém Draco một chút; **+gzip/brotli gần bằng hoặc hơn** | KTX2 nhẹ VRAM, WebP nhẹ tải |
| Giải nén | WASM ~300 KB + worker, tốn RAM (từng crash trên di động) | ~20 KB JS/WASM, rất nhanh, giải thẳng vào buffer GPU | KTX2 cần transcoder Basis (~400 KB) |
| Khuyến nghị | so sánh số liệu thôi | **mặc định** | không cần (dự án không dùng texture, màu vật liệu) |

Kèm theo: `KHR_mesh_quantization` (vị trí/pháp tuyến/trọng số 8–16 bit), `resample` bỏ khoá thừa của hoạt ảnh.
Máy chủ / Capacitor nên phục vụ `.glb` có gzip/brotli (Firebase Hosting tự nén).

### Mục tiêu / ước tính (sau meshopt + gzip)
| File | Tam giác | Gốc (ước, export_pure) | Mục tiêu | Ước tính |
|---|---:|---:|---:|---:|
| hyrox_map.glb | ~17.9k (17.2k + vòng 768 dùng chung) | 446 KB (gzip 170 KB) | < 150 KB | ~70–100 KB |
| hyrox_runner.glb | 3.05k + đạo cụ 1.9k, 11 clip | 333 KB (gzip 76 KB) | < 120 KB | ~40–70 KB |
| hyrox_path.json | – | 8.5 KB | – | ~3 KB gzip |
Số thật xem `size-report.md` sau lần chạy workflow đầu. Vượt mục tiêu → giảm `lathe` (bục 40→32 cạnh), bỏ cờ caro bay, hoặc lấy mẫu hoạt ảnh 15 fps.

## 5. Tích hợp vào app (sau này)
- Bố cục đã chốt: bản đồ hoạt ảnh phía trên, nút "Xong chặng" phía dưới; bấm → chạy sang trạm kế ~1.5 s rồi phát `Work_x`;
  màn tổng kết phát lại 15–30 s theo split thật (viewer có sẵn logic `replay()`).
- Nạp lười (`import()`), chỉ khi máy đủ khoẻ (deviceMemory > 4, WebGL2) và người dùng bật; còn lại dùng `preview_map.jpg`.
- pixelRatio ≤ 2 (máy yếu ≤ 1.25), tắt bóng trên máy yếu, tự hạ chất lượng khi FPS < 40 trong 3 s (đã có trong viewer).
- Three.js + GLTFLoader + MeshoptDecoder nên tự host (vendor) thay vì CDN khi đóng gói Capacitor.

## 6. Thay nhân vật bằng Mixamo
Tên xương đã đặt theo Mixamo (bỏ tiền tố `mixamorig:`): Hips, Spine, Spine1, Neck, Head, Left/RightUpLeg, Left/RightLeg,
Left/RightFoot, Left/RightArm, Left/RightForeArm, Left/RightHand. Cách làm:
1. Mixamo: tải nhân vật + các animation (Running *In Place*, Idle, Victory, …) dạng FBX, "Without Skin" cho animation.
2. Blender: import FBX, xoá tiền tố `mixamorig:` (Edit → Batch Rename), áp scale (Ctrl+A), hướng nhìn −Y.
3. Retarget sang armature `RunnerRig` (cùng tên xương → dùng add-on *Rokoko Retargeting* hoặc *Auto-Rig Pro Remap*,
   hoặc Copy Rotation constraint theo tên rồi Bake Action). Đặt tên action đúng 11 tên ở trên; đo lại STRIDE của Running.
4. Thay `RunnerBody` bằng lưới Mixamo (≤ 10k tam giác, giảm bằng Decimate), xuất lại bằng cùng tham số; app không cần sửa.
Lưu ý bản quyền: nhân vật/animation Mixamo được dùng trong sản phẩm, nhưng không phân phối file gốc rời.
