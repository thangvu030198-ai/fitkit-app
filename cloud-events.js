/* =========================================================================
   TapEasy — SỰ KIỆN · THI ĐUA · GIAN HÀNG — lớp dữ liệu (cloud-events.js)

   Một API chung (window.cloudEvents), 2 "động cơ" giống cloud.js:
   - firebase : khi cloud.mode === "firebase" và có firebase.firestore() toàn cục
   - demo     : giả lập máy chủ bằng localStorage key "tapeasy_events_demo_v1"
                (tự gieo dữ liệu mẫu: thử thách tháng trước/này/sau, sự kiện offline,
                 sản phẩm lưu niệm; người chơi giả có tiến độ hợp lý cho bảng xếp hạng)

   Cấu trúc (giống nhau ở cả 2 động cơ — xem docs/INTEGRATION-events-shop.md):
   challenges/{id}                 { title, desc, metric, target, unit, start, end, points,
                                     giftTop, gifts[], badge{tier,glyph,label}, color, hidden }
   challenges/{id}/entries/{uid}   { uid, name, value, week, weekValue, done, joinedAt, updatedAt }
   events/{id}                     { title, sport, desc, start, end, venue, address, city, capacity,
                                     fee, points, options[], bring[], regCount, cover, organizer }
   events/{id}/private/checkin     { code }   ← mã điểm danh tại chỗ (chỉ admin đọc)
   events/{id}/regs/{uid}          { uid, name, phone, option, code, status, checkedInAt, ... }
   events/{id}/reviews/{rid}       { kind:"review"|"recap", uid, name, stars, text, media[], coverId, ts,
                                     likeCount, commentCount, reportCount, hidden, modOk }
                                   rid = uid (review: 1 người 1 bài) · "recap_…" (bài đăng sau sự kiện của BTC)
   events/{id}/reviews/{rid}/likes|reports/{uid} · /comments/{cid}
   ẢNH/CLIP (bắt buộc ≥ 1 cho sự kiện, thử thách, review, bài đăng): media[] = { id, kind:"image"|"video",
     src, thumb?, poster?, w, h, dur, size, mime, alt, credit{by,site,url} } + coverId
     demo → Blob trong IndexedDB (src "idb:<key>"), firebase → Firebase Storage (URL https)
   products/{id}                   { name, price, art, colors[], sizes[], stock, hidden, ... }
   orders/{id}                     { code, uid, items[], subtotal, discount, shipping, total,
                                     payment, address{}, status, history[], createdAt }
   gifts/{id}                      { uid, name, title, item, pid, reason, month, status, address }
   admins/{uid}                    { role:"founder" }  ← quyền quản trị thật (rules kiểm tra)
   ========================================================================= */
const cloudEvents = (() => {
  "use strict";
  const DEMO_KEY = "tapeasy_events_demo_v1";
  const SEED_VERSION = 4;          // v4: ảnh/clip + nội dung đầy đủ cho mọi sự kiện/thử thách mẫu, bảng tin Khoảnh khắc
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  /* ---------------- tiện ích ---------------- */
  const now = () => Date.now();
  const rid = (p="id") => `${p}${now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const genCode = (n=6) => Array.from({length:n}, ()=> CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");
  const p2 = n => String(n).padStart(2,"0");
  const ds = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const parse = s => { const a = String(s).slice(0,10).split("-").map(Number); return new Date(a[0], a[1]-1, a[2], 12); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return ds(d); };
  const mondayOf = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return ds(d); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const obj = o => (o && typeof o === "object") ? o : {};
  function dErr(code, msg){ const e = new Error(msg || code); e.code = code; e.vi = true; return e; }
  const delay = (ms=60) => new Promise(r=> setTimeout(r, ms));

  /* Số ngẫu nhiên tất định (mulberry32) + băm chuỗi → người chơi giả ổn định giữa các lần mở */
  function hashStr(s){ let h = 2166136261 >>> 0; for(const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed){ let s = seed >>> 0; return ()=>{ s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const r01 = (...k) => rng(hashStr(k.join("|")))();

  /* Người dùng hiện tại: tài khoản cloud.js nếu đã đăng nhập, không thì mã cục bộ (demo) */
  function me(){
    let u = null; try{ u = (typeof cloud !== "undefined" && cloud.user) ? cloud.user : null; }catch(e){}
    let st = null; try{ st = (typeof state !== "undefined") ? state : null; }catch(e){}
    let name = "";
    if(st && st.profile && st.profile.name) name = String(st.profile.name).trim();
    if(!name && u && u.name) name = u.name;
    if(u) return { uid: u.uid, name: name || "Bạn", email: u.email || "", local:false };
    let lid = null;
    if(st){ st.tapEvents = obj(st.tapEvents); lid = st.tapEvents.localId; if(!lid){ lid = st.tapEvents.localId = "local_" + Math.random().toString(36).slice(2,10); try{ saveState(); }catch(e){} } }
    return { uid: lid || "local_guest", name: name || "Bạn", email:"", local:true };
  }

  /* =====================================================================
     DỮ LIỆU MẪU (gieo theo ngày hiện tại → luôn có tháng này/tháng sau)
     ===================================================================== */
  const BOT_NAMES = ["Nguyễn Minh Anh","Trần Thu Hà","Lê Quốc Bảo","Phạm Ngọc Trâm","Hoàng Gia Huy","Vũ Thanh Tâm","Đặng Hải Yến","Bùi Đức Thịnh",
    "Đỗ Khánh Linh","Hồ Tuấn Kiệt","Ngô Phương Thảo","Dương Hoàng Nam","Lý Mai Chi","Phan Nhật Quang","Trịnh Bảo Ngọc","Mai Anh Tuấn",
    "Đinh Thảo Vy","Tạ Minh Khôi","Lâm Thuỳ Dung","Cao Văn Lực","Châu Ngọc Hân","Kiều Đức Anh","Lương Thị Hồng","Quách Trọng Nghĩa",
    "Hà My","Võ Thành Đạt","Tôn Nữ Diệu","Âu Gia Bảo","Nghiêm Hữu Phước","Triệu Lan Anh","La Quang Vinh","Mạc Thu Trang",
    "Huỳnh Kim Ngân","Thái Bình An","Từ Hải Đăng","Giang Thanh Mai","Phùng Quốc Việt","Hứa Mỹ Duyên","Ông Tiến Dũng","Diệp Bảo Châu"];

  /* ---------- Ảnh/clip mẫu: Pexels (giấy phép Pexels — miễn phí, dùng thương mại; app vẫn ghi tên tác giả) ---------- */
  const PX = (id, by, alt)=> ({ id:"px"+id, kind:"image", alt,
    src:`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`,
    thumb:`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640`,
    credit:{ by, site:"Pexels", url:`https://www.pexels.com/photo/${id}/` } });
  const PXV = (id, file, dur, alt)=> ({ id:"pxv"+id, kind:"video", alt, dur,
    src:`https://videos.pexels.com/video-files/${id}/${file}`,
    poster:`https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1280`,
    thumb:`https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640`,
    credit:{ by:"", site:"Pexels", url:`https://www.pexels.com/video/${id}/` } });
  const withMedia = (media, coverIdx)=>{ const c = media[coverIdx||0]; return { media, coverId: c.id, cover: c.kind === "video" ? c.poster : c.src }; };
  /* Nội dung đầy đủ cho sự kiện mẫu: lịch trình · điều kiện · quà/quyền lợi · quy định an toàn · ảnh/clip */
  const EV_CONTENT = {
    ev_run_hoguom: Object.assign(withMedia([
        PXV(38667750, "16424700_960_540_25fps.mp4", 13.1, "Nhóm runner chạy buổi sáng"),
        PX(37191727, "Cara Denison", "Nhóm chạy bộ lúc bình minh, mặc áo phản quang"),
        PX(16211481, "tu nguyen", "Tháp Rùa giữa Hồ Gươm trong sương sớm"),
        PX(17979277, "Pexels LATAM", "Khởi động động cùng coach trước giờ chạy"),
        PX(5319396, "cottonbro studio", "Nhóm chạy bộ nhịp nhẹ trên cầu")]), {
      agenda:[{ t:"05:15", x:"Điểm danh bằng vé QR tại Tượng đài Lý Thái Tổ, nhận số đeo, gửi đồ" }, { t:"05:30", x:"Khởi động động 10 phút cùng coach" },
        { t:"05:40", x:"Xuất phát theo 3 nhóm nhịp 7:30 · 6:30 · 5:30 phút/km, có người dẫn nhịp" }, { t:"06:30", x:"Về đích, giãn cơ 10 phút" },
        { t:"06:45", x:"Chụp ảnh chung, bốc thăm quà" }, { t:"07:00", x:"Kết thúc" }],
      requirements:["Từ 16 tuổi (dưới 18 tuổi đi cùng người giám hộ)", "Đi bộ nhanh/chạy chậm liên tục được 30 phút", "Đăng ký trước trong app, mang vé QR"],
      perks:["Số đeo + khăn lạnh TapEasy", "Ảnh chụp buổi chạy đăng trong mục Khoảnh khắc", "+150 Điểm TapEasy khi điểm danh", "Bốc thăm 3 bình nước TapEasy 750 ml"],
      safety:["Chạy trên vỉa hè/làn đường BTC phân luồng, không chạy dưới lòng đường khi chưa có marshal", "Nhân viên y tế + túi sơ cứu ở điểm xuất phát/về đích",
        "Đau ngực, chóng mặt, khó thở → dừng ngay, báo marshal áo cam", "Không đeo tai nghe cả 2 bên để nghe hiệu lệnh", "Mưa giông → BTC báo hoãn qua app trước 04:30"] }),
    ev_group_thongnhat: Object.assign(withMedia([
        PX(31216262, "Ozan Yavuz", "Lớp tập nhóm ngoài trời có coach hướng dẫn"),
        PX(6150627, "AirFit", "Nhóm chạy tại chỗ khởi động trong công viên"),
        PX(7266744, "Sarah Chai", "Giãn cơ tay vai trong công viên"),
        PX(5319491, "cottonbro studio", "Nhóm khởi động trước buổi tập")]), {
      agenda:[{ t:"06:15", x:"Điểm danh, nhận thảm (nếu đăng ký mượn)" }, { t:"06:30", x:"Khởi động khớp 10 phút" },
        { t:"06:40", x:"Circuit 1: squat, hít đất, lunge — 3 vòng × 40 giây" }, { t:"07:05", x:"Circuit 2: plank, glute bridge, burpee nhẹ" },
        { t:"07:30", x:"Giãn cơ & hít thở" }, { t:"07:45", x:"Chụp ảnh, kết thúc" }],
      requirements:["Mọi trình độ, từ 16 tuổi", "Không có chấn thương cấp trong 4 tuần gần đây", "Đau gối/lưng: báo coach để nhận bài thay thế"],
      perks:["Miễn phí, coach chỉnh kỹ thuật trực tiếp", "+100 Điểm TapEasy khi điểm danh", "Giáo án 4 tuần tập tại nhà gửi trong app"],
      safety:["Tập theo sức mình — gắng sức tối đa 7/10 (vẫn nói được câu ngắn)", "Uống nước giữa 2 circuit", "Cỏ ướt → chuyển lên sân bê tông có thảm",
        "Coach có chứng chỉ sơ cứu, có túi sơ cứu tại chỗ"] }),
    ev_hyrox_sim: Object.assign(withMedia([
        PX(29859465, "Ardit Mbrati", "Vận động viên chèo máy trong giải thể lực trong nhà"),
        PX(32830368, "TSquared Lab", "Đẩy xe trượt (sled push) có huấn luyện viên"),
        PX(9545914, "TUBARONES PHOTOGRAPHY", "Khu máy SkiErg, chèo và tạ"),
        PX(4853898, "Ketut Subiyanto", "Tập wall ball với bóng tạ")]), {
      agenda:[{ t:"07:15", x:"Điểm danh, chọn hạng Open/Pro, nhận số" }, { t:"07:30", x:"Phổ biến luật + chuẩn động tác (no-rep)" },
        { t:"07:45", x:"Khởi động theo nhóm" }, { t:"08:00", x:"Xuất phát lượt 1 — mỗi lượt 8 người, cách nhau 15 phút" },
        { t:"10:00", x:"Trao giải Top 3 mỗi hạng" }, { t:"10:30", x:"Giãn cơ, kết thúc" }],
      requirements:["Từ 18 tuổi, đã tập sức bền/tạ ≥ 3 tháng", "Chạy liên tục được 4 km", "Hạng Open dùng mức tạ giảm (wall ball 6 kg nam / 4 kg nữ); Pro theo chuẩn thi đấu (9 kg / 6 kg)"],
      perks:["Bấm giờ từng trạm, kết quả gửi trong app", "Huy chương hoàn thành", "Top 3 mỗi hạng: áo TapEasy + voucher Cửa hàng", "+200 Điểm TapEasy khi điểm danh"],
      safety:["Trọng tài được quyền dừng VĐV có dấu hiệu kiệt sức", "Được nghỉ giữa trạm (vẫn tính giờ) — đừng cố quá sức", "Giày bám tốt, không tập chân trần",
        "Khai báo bệnh tim mạch/huyết áp khi đăng ký", "Nước + điện giải sau mỗi 2 trạm"] }),
    ev_powerlifting: Object.assign(withMedia([
        PX(16966303, "Ardit Mbrati", "Các lực sĩ deadlift trong giải đấu"),
        PX(16966307, "Ardit Mbrati", "Vận động viên chuẩn bị cử tạ, trọng tài theo dõi"),
        PX(841125, "Victor Freitas", "Deadlift với thanh đòn"),
        PX(13822300, "Jonathan", "Nữ vận động viên deadlift")]), {
      agenda:[{ t:"07:00", x:"Cân ký theo hạng cân, đăng ký mức mở đầu" }, { t:"08:00", x:"Khởi động tại khu riêng" },
        { t:"08:30", x:"Squat — 3 lượt cử" }, { t:"09:45", x:"Bench press — 3 lượt cử" }, { t:"10:45", x:"Deadlift — 3 lượt cử" }, { t:"11:45", x:"Trao giải theo điểm IPF GL" }],
      requirements:["Từ 18 tuổi, tập tạ ≥ 6 tháng", "Thực hiện đúng kỹ thuật 3 bài (squat xuống dưới song song, bench chạm ngực có dừng)", "Thể thức classic/raw: được dùng đai, băng cổ tay, ống gối; không dùng băng quấn gối hay áo bench"],
      perks:["Huy chương Top 3 mỗi hạng cân + giấy chứng nhận", "Video các lượt cử gửi trong app", "+250 Điểm TapEasy khi điểm danh"],
      safety:["Luôn có 2–3 người đỡ tạ (spotter) cho squat và bench; giá đỡ có thanh chặn an toàn", "Bắt buộc kẹp khoá tạ", "Chỉ cử khi có lệnh trọng tài",
        "Mức mở đầu nên khoảng 90% 1RM hiện tại để chắc chắn qua lượt"] }),
    ev_workshop_dam: Object.assign(withMedia([
        PX(38939130, "Youn Seung Jin", "Lớp thực hành nấu ăn có chuyên gia hướng dẫn"),
        PX(1640771, "Ella Olsson", "Hộp cơm chuẩn bị sẵn giàu đạm và rau"),
        PX(8844379, "Yaroslav Shuraev", "Trao đổi thực đơn với bảng dinh dưỡng"),
        PX(3850841, "ready made", "Nguyên liệu tươi cho bữa ăn cân bằng")]), {
      agenda:[{ t:"08:45", x:"Điểm danh, nhận sổ tay" }, { t:"09:00", x:"Tính nhu cầu đạm theo cân nặng & mục tiêu" },
        { t:"09:30", x:"Thực hành ước lượng khẩu phần bằng bàn tay với đồ ăn thật" }, { t:"10:00", x:"Đọc nhãn dinh dưỡng: sữa chua, sữa hạt, whey" },
        { t:"10:30", x:"Hỏi đáp 1-1 + tiệc trà healthy" }, { t:"11:00", x:"Kết thúc" }],
      requirements:["Mọi người quan tâm dinh dưỡng, không cần kiến thức trước", "Mang 1–2 ảnh bữa ăn thường ngày để được góp ý", "Đang điều trị bệnh thận/gout: hỏi bác sĩ trước khi tăng đạm"],
      perks:["Sổ tay thực đơn 7 ngày", "Bảng quy đổi đạm món Việt (gửi trong app)", "Tiệc trà healthy", "+80 Điểm TapEasy khi điểm danh"],
      safety:["Khai báo dị ứng (hải sản, đậu phộng, sữa…) khi đăng ký", "Đồ ăn thử đều ghi thành phần", "Nội dung mang tính giáo dục, không thay thế tư vấn y khoa"] }),
    ev_picnic_ecopark: Object.assign(withMedia([
        PX(35652755, "N Sopyan", "Nhóm bạn picnic trên bãi cỏ"),
        PX(35773483, "Nadirsyah Nadirsyah", "Bữa trưa picnic cùng nhau trong công viên"),
        PX(1472887, "Rui Dias", "Yoga nhẹ trên bãi cỏ dưới tán cây")]), {
      agenda:[{ t:"08:00", x:"Tập trung, điểm danh" }, { t:"08:20", x:"Đi bộ 3 km quanh hồ" }, { t:"09:15", x:"Yoga nhẹ 30 phút" },
        { t:"10:00", x:"Mini game đồng đội" }, { t:"11:30", x:"Bữa trưa lành mạnh" }, { t:"12:30", x:"Chụp ảnh chung, dọn dẹp" }, { t:"13:00", x:"Kết thúc" }],
      requirements:["Mọi lứa tuổi — trẻ dưới 12 tuổi đi cùng người lớn", "Ghi số người đi cùng ở phần ghi chú khi đăng ký"],
      perks:["Bữa trưa lành mạnh + nước (đã gồm trong phí)", "Quà cho đội thắng mini game", "+100 Điểm TapEasy khi điểm danh"],
      safety:["Đội mũ, kem chống nắng, uống nước thường xuyên", "Trẻ em không chơi gần mép hồ khi không có người lớn", "Mang rác về hoặc bỏ đúng điểm phân loại",
        "Có túi sơ cứu và người phụ trách an toàn"] }),
    ev_run_hotay: Object.assign(withMedia([
        PX(29840338, "Stephen Leonardi", "Runner chạy trong sương sớm"),
        PX(2526885, "RUN 4 FFWPU", "Đoàn runner trên đường"),
        PXV(5319351, "5319351-sd_960_540_25fps.mp4", 20.6, "Runner chạy trên con đường vắng")]), {
      desc:"Cung đường ven Hồ Tây rút gọn 10 km (cả vòng hồ khoảng 17 km), mặt đường phẳng, ít dốc — hợp để chinh phục 10 km đầu tiên. Có trạm nước ở km 5, người dẫn nhịp 60 và 70 phút, giãn cơ cùng coach sau khi về đích.",
      agenda:[{ t:"05:15", x:"Điểm danh tại Phủ Tây Hồ" }, { t:"05:30", x:"Xuất phát 5 km và 10 km" }, { t:"06:45", x:"Giãn cơ, chụp ảnh" }, { t:"07:30", x:"Kết thúc" }],
      requirements:["Từ 16 tuổi", "Cự ly 10 km: đã chạy liên tục ≥ 6 km"], perks:["Huy chương hoàn thành", "+150 Điểm TapEasy khi điểm danh"],
      safety:["Trạm nước + y tế ở km 5", "Chạy sát lề phải, nhường đường xe đạp"] }),
    ev_yoga_giadinh: Object.assign(withMedia([
        PX(36715224, "Vitaly Gariev", "Nhóm tập yoga ngoài trời trong công viên"),
        PX(36715610, "Vitaly Gariev", "Buổi yoga nhóm trong công viên"),
        PX(8692128, "Yaroslav Shuraev", "Tư thế thăng bằng bên hồ lúc hoàng hôn")]), {
      agenda:[{ t:"05:45", x:"Điểm danh, trải thảm" }, { t:"06:00", x:"Khởi động khớp, chào mặt trời nhẹ" }, { t:"06:20", x:"Chuỗi giãn hông, gân kheo, bắp chân, cột sống ngực" },
        { t:"06:55", x:"Thở hộp 4-4-4-4 và thư giãn" }, { t:"07:15", x:"Kết thúc" }],
      requirements:["Mọi trình độ, không cần dẻo", "Đang mang thai hoặc có chấn thương cột sống: báo HLV để có tư thế thay thế"],
      perks:["Mượn thảm miễn phí", "+80 Điểm TapEasy khi điểm danh"],
      safety:["Không ép giãn tới mức đau nhói", "Ăn nhẹ trước buổi tập ít nhất 1 giờ hoặc tập lúc bụng đói nhẹ"] }),
  };
  /* Nội dung + ảnh cho thử thách mẫu (theo chỉ số) */
  const CH_CONTENT = {
    sessions: { media:[PX(703012, "Victor Freitas", "Buổi tập tạ trong phòng gym")],
      rules:["Mỗi ngày tính tối đa 1 buổi", "Buổi được tính khi bấm “Kết thúc buổi” trong màn Tập luyện (buổi 20 phút cũng tính)", "Buổi tập ngoài app (lớp nhóm, PT, thể thao) → nhập tay và tích xác nhận trung thực, tối đa 2 buổi/ngày"],
      eligibility:["Mọi thành viên TapEasy", "Người mới: bắt đầu 3 buổi/tuần rồi tăng dần"],
      safety:["Ngủ ≥ 7 giờ và có 1–2 ngày nghỉ mỗi tuần", "Đau nhói khớp → dừng bài đó, đổi bài khác", "Khởi động 5–10 phút trước mỗi buổi"] },
    sessions_next: { media:[PX(4944980, "Anastasia Shuraeva", "Hai người tập luyện cùng nhau trong phòng gym")] },
    run: { media:[PX(2526885, "RUN 4 FFWPU", "Đoàn runner chạy trên đường phố")],
      rules:["Tự cộng bài chạy đã hoàn thành trong giáo án (theo km/m; bài theo phút ước tính 7 phút/km)", "Chạy ngoài app (đồng hồ, Strava) → nhập km tay, tối đa 60 km/ngày", "Ban tổ chức có thể yêu cầu ảnh chụp đồng hồ/ứng dụng để đối chiếu khi trao giải"],
      eligibility:["Mọi thành viên chạy được liên tục 20 phút", "Mới chạy: xen kẽ chạy 2 phút – đi bộ 1 phút"],
      safety:["Tăng tổng quãng đường không quá 10%/tuần", "Chạy nơi có vỉa hè, mặc áo phản quang khi trời tối", "Đau ống quyển/gối kéo dài > 3 ngày → nghỉ và hỏi chuyên gia"] },
    water: { media:[PX(4853255, "Ketut Subiyanto", "Uống nước sau buổi tập ngoài trời")],
      rules:["Một ngày tính khi lượng nước ghi trong app đạt mục tiêu cá nhân (mặc định 35 ml × cân nặng)", "Nước lọc, trà không đường, sữa đều được tính"],
      eligibility:["Mọi thành viên"],
      safety:["Uống rải đều cả ngày, không quá 1 lít/giờ", "Người bệnh thận, suy tim: hỏi bác sĩ về lượng nước phù hợp"] },
    weight: { media:[PX(6550832, "Andres Ayrton", "Bước lên cân điện tử vào buổi sáng")],
      rules:["Cân lúc tham gia là mốc; các lần cân sau ghi vào app (sáng, sau vệ sinh, trước ăn)", "Bảng xếp hạng chỉ tính tối đa 1% cân nặng mỗi tuần"],
      eligibility:["Từ 18 tuổi, BMI ≥ 18,5", "Không dành cho người đang mang thai/cho con bú"],
      safety:["Không nhịn ăn, không dùng thuốc giảm cân", "Thâm hụt 300–500 kcal/ngày, ăn đủ đạm 1,6 g/kg để giữ cơ", "Có bệnh mạn tính: hỏi bác sĩ trước khi bắt đầu"] },
    food: { media:[PX(760719, "Bich Tran", "Sổ kế hoạch ăn uống và bút màu")],
      rules:["Ngày có ít nhất 1 món ghi trong nhật ký Dinh dưỡng được tính", "Ghi ngay sau bữa ăn để nhớ đúng khẩu phần"],
      eligibility:["Mọi thành viên"],
      safety:["Ghi chép để hiểu thói quen, không phải để ăn kiêng quá mức", "Nếu việc ghi chép gây căng thẳng, lo âu về ăn uống — hãy tạm dừng và trò chuyện với chuyên gia"] },
  };
  const chContent = (key, opt)=>{ const b = CH_CONTENT[key] || CH_CONTENT.sessions, extra = opt && opt.next && CH_CONTENT[key + "_next"]; const media = (extra && extra.media) || b.media;
    return { media, coverId: media[0].id, cover: media[0].src, rules: b.rules || [], eligibility: b.eligibility || [], safety: b.safety || [] }; };
  /* Ảnh cho review mẫu (người chơi giả) */
  const RV_MEDIA = {
    rv1:[PX(1073101, "Brett Sayles", "Khoe huy chương sau khi về đích")],
    rv2:[PX(17979591, "Pexels LATAM", "Ăn mừng ở vạch đích")],
    rv3:[PX(35812359, "Margo Evardson", "Đông đảo người khởi động trước giờ chạy"), PX(2567044, "RUN 4 FFWPU", "Hai runner giơ ngón cái ở vạch đích")],
    rv4:[PX(5319491, "cottonbro studio", "Giãn cơ sau buổi chạy")],
    ry1:[PX(36715608, "Vitaly Gariev", "Nhóm tập yoga trong công viên mùa thu")],
    ry2:[PX(8692128, "Yaroslav Shuraev", "Thăng bằng một chân bên hồ")],
  };

  function monthInfo(d, off){
    const x = new Date(d.getFullYear(), d.getMonth()+off, 1, 12);
    const last = new Date(x.getFullYear(), x.getMonth()+1, 0, 12);
    return { ym: `${x.getFullYear()}-${p2(x.getMonth()+1)}`, m: x.getMonth()+1, y: x.getFullYear(), start: ds(x), end: ds(last), days: last.getDate() };
  }
  const GIFTS_DEFAULT = [
    { title:"Áo tập TapEasy", pid:"p_tee" },
    { title:"Bình nước TapEasy 750 ml", pid:"p_bottle" },
    { title:"Khăn tập TapEasy", pid:"p_towel" },
  ];
  function seedChallenges(today){
    const cur = monthInfo(today, 0), nxt = monthInfo(today, 1), prv = monthInfo(today, -1);
    const C = {};
    const add = (mi, key, o) => { const id = `ch_${mi.ym.replace("-","")}_${key}`; C[id] = Object.assign({ id, start: mi.start, end: mi.end, month: mi.ym,
      points: 300, giftTop: 3, gifts: clone(GIFTS_DEFAULT), createdBy:"seed", createdAt: now(), updatedAt: now(), hidden:false }, clone(chContent(key, { next: mi === nxt })), o); };
    add(cur, "sessions", { title:`Tháng ${cur.m}: Tập đủ 20 buổi`, metric:"sessions", target:20, unit:"buổi", color:"coral",
      badge:{ tier:2, glyph:"dumbbell", label:"20" },
      desc:"Mỗi buổi được tính khi bạn bấm “Kết thúc buổi” trong màn Tập luyện (buổi 20 phút cũng tính). 20 buổi/tháng ≈ 4–5 buổi/tuần — đủ để vừa tăng sức mạnh vừa giữ nhịp tim khoẻ, vẫn còn 2–3 ngày hồi phục mỗi tuần." });
    add(cur, "run", { title:`Chạy 50 km trong tháng ${cur.m}`, metric:"run_km", target:50, unit:"km", color:"mint", points:300,
      badge:{ tier:2, glyph:"runner", label:"50K" },
      desc:"Tự cộng các bài chạy đã hoàn thành trong giáo án (bài ghi theo km/m, hoặc theo phút — ước tính 7 phút/km). Chạy ngoài app (Strava, đồng hồ) thì nhập tay và xác nhận. Gợi ý: 3 buổi/tuần × 4 km, tăng tổng quãng đường không quá 10%/tuần." });
    add(cur, "water", { title:`Uống đủ nước ${cur.days-5}/${cur.days} ngày`, metric:"water_days", target:cur.days-5, unit:"ngày", color:"mint", points:200, giftTop:3,
      badge:{ tier:1, glyph:"drop", label:String(cur.days-5) },
      desc:"Một ngày được tính khi lượng nước ghi trong app đạt mục tiêu cá nhân (mặc định 35 ml × cân nặng). Uống rải đều cả ngày, tăng thêm 0,5–1 lít vào ngày tập nặng hoặc trời nóng." });
    add(cur, "weight", { title:"Giảm 2 kg an toàn", metric:"weight_loss", target:2, unit:"kg", color:"coral", points:300, giftTop:3,
      badge:{ tier:2, glyph:"scale", label:"−2" },
      desc:"Cân lúc mới tham gia là mốc. Mỗi lần cân (buổi sáng, sau vệ sinh, trước ăn) ghi vào app. Để an toàn, bảng xếp hạng chỉ tính tối đa 1% cân nặng mỗi tuần — giảm nhanh hơn thường là mất nước/mất cơ. Không dành cho người có BMI < 18,5, đang mang thai hoặc dưới 18 tuổi." });
    add(nxt, "sessions", { title:`Tháng ${nxt.m} bền bỉ: 16 buổi`, metric:"sessions", target:16, unit:"buổi", color:"coral", points:250,
      badge:{ tier:1, glyph:"flame", label:"16" },
      desc:"Mục tiêu vừa sức cho tháng bận rộn: 4 buổi/tuần là đủ để giữ sức mạnh và thể lực. Buổi 20 phút cũng được tính — bận thì tập ngắn, miễn là đều đặn. Nghỉ ít nhất 1–2 ngày mỗi tuần để cơ thể hồi phục." });
    add(nxt, "food", { title:"Ghi nhật ký ăn 25 ngày", metric:"food_days", target:25, unit:"ngày", color:"mint", points:200,
      badge:{ tier:1, glyph:"notebook", label:"25" },
      desc:"Ngày có ít nhất 1 món ghi trong Dinh dưỡng được tính. Ghi chép đều đặn là cách hiệu quả nhất để hiểu mình ăn gì và kiểm soát cân nặng — không cần hoàn hảo, ghi gần đúng khẩu phần là đủ." });
    add(prv, "sessions", { title:`Tháng ${prv.m}: Tập đủ 20 buổi`, metric:"sessions", target:20, unit:"buổi", color:"coral",
      badge:{ tier:2, glyph:"dumbbell", label:"20" }, desc:`Thử thách tháng ${prv.m}: 20 buổi tập (≈ 4–5 buổi/tuần). Mỗi buổi tính khi bấm “Kết thúc buổi” trong màn Tập luyện, buổi 20 phút cũng tính; buổi ngoài app nhập tay có xác nhận.` });
    add(prv, "run", { title:`Chạy 40 km tháng ${prv.m}`, metric:"run_km", target:40, unit:"km", color:"mint",
      badge:{ tier:1, glyph:"runner", label:"40K" }, desc:`Thử thách chạy tháng ${prv.m}: cộng dồn 40 km từ bài chạy trong giáo án và km nhập tay từ đồng hồ/Strava. Khoảng 3 buổi × 3–4 km mỗi tuần, tăng quãng đường không quá 10%/tuần.` });
    return C;
  }
  function nextDow(today, dow, extraWeeks){ // dow: 0=CN … 6=T7
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    let add = (dow - d.getDay() + 7) % 7; if(add === 0) add = 7;
    d.setDate(d.getDate() + add + 7*(extraWeeks||0)); return ds(d);
  }
  function seedEvents(today, ym, withPast){
    const E = {}, sfx = "_" + String(ym || ds(today).slice(0,7)).replace("-","");
    const add = (id0, o) => { if(o.demoPast && !withPast) return; const id = id0 + sfx; E[id] = Object.assign({ id, seed:true, organizer:"TapEasy", cover:"", createdAt: now(), updatedAt: now(), hidden:false, options:[], bring:[], checkinCode: genCode() }, o, clone(EV_CONTENT[id0] || {})); };
    const sun1 = nextDow(today, 0), sat1 = nextDow(today, 6), sat2 = nextDow(today, 6, 1), sun2 = nextDow(today, 0, 1), sat3 = nextDow(today, 6, 2), sun3 = nextDow(today, 0, 2);
    const past = addD(ds(today), -12), past2 = addD(ds(today), -5);
    add("ev_run_hoguom", { title:"Chạy bộ bình minh 5 km quanh Hồ Gươm", sport:"run", start:`${sun1}T05:30`, end:`${sun1}T07:00`,
      venue:"Tượng đài Lý Thái Tổ (điểm tập trung)", address:"Tượng đài Lý Thái Tổ, Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội", city:"Hà Nội",
      capacity:120, fee:0, points:150, seedRegs:87, options:["3 km — đi bộ nhanh","5 km — chạy nhẹ","10 km — 2 vòng mở rộng"],
      bring:["Giày chạy", "Bình nước cá nhân (giảm rác nhựa)", "Áo khoác mỏng — sáng sớm trời lạnh"],
      desc:"Khởi động động 10 phút cùng coach, chạy theo nhóm tốc độ (7:30 · 6:30 · 5:30 phút/km) có người dẫn nhịp. Kết thúc bằng giãn cơ và chụp ảnh chung. Phù hợp cả người mới — có nhóm đi bộ nhanh 3 km." });
    add("ev_group_thongnhat", { title:"Tập nhóm Full-body miễn phí — Công viên Thống Nhất", sport:"group", start:`${sat1}T06:30`, end:`${sat1}T07:45`,
      venue:"Cổng Trần Nhân Tông, Công viên Thống Nhất", address:"Công viên Thống Nhất, Trần Nhân Tông, Hai Bà Trưng, Hà Nội", city:"Hà Nội",
      capacity:50, fee:0, points:100, seedRegs:31, options:["Người mới","Đã tập ≥ 6 tháng"],
      bring:["Thảm tập", "Khăn", "Nước"],
      desc:"45 phút circuit không dụng cụ: squat, hít đất, lunge, plank, burpee biến thể nhẹ — chia 2 nhóm cường độ. Coach hướng dẫn kỹ thuật, có phương án thay thế cho người đau gối/lưng." });
    add("ev_hyrox_sim", { title:"Hyrox Simulation — 8 trạm phối hợp", sport:"hyrox", start:`${sat2}T08:00`, end:`${sat2}T10:30`,
      venue:"Phòng tập đối tác TapEasy (địa điểm mẫu)", address:"Phú Mỹ Hưng, TP. Hồ Chí Minh", city:"TP. Hồ Chí Minh",
      capacity:40, fee:150000, points:200, seedRegs:33, options:["Đơn — Open","Đơn — Pro","Đôi (Doubles)"],
      bring:["Giày tập có độ bám", "Găng tay (tuỳ chọn)", "Đồ thay"],
      desc:"Mô phỏng thể thức Hyrox rút gọn: 8 × (chạy 500 m + 1 trạm): SkiErg, đẩy xe trượt, kéo xe trượt, burpee bật xa, chèo thuyền, farmer carry, lunge bao cát, wall ball. Có trọng tài đếm lần và bấm giờ từng trạm. Mức tạ giảm cho hạng Open." });
    add("ev_powerlifting", { title:"Powerlifting nội bộ: Squat · Bench · Deadlift", sport:"powerlifting", start:`${sun2}T08:30`, end:`${sun2}T12:00`,
      venue:"Phòng tập đối tác TapEasy (địa điểm mẫu)", address:"Cầu Giấy, Hà Nội", city:"Hà Nội",
      capacity:32, fee:200000, points:250, seedRegs:24,
      options:["Nam ≤ 66 kg","Nam ≤ 74 kg","Nam ≤ 83 kg","Nam ≤ 93 kg","Nam ≤ 105 kg","Nam > 105 kg","Nữ ≤ 52 kg","Nữ ≤ 57 kg","Nữ ≤ 63 kg","Nữ ≤ 69 kg","Nữ ≤ 76 kg","Nữ > 76 kg"],
      bring:["Đai lưng, băng cổ tay (nếu có)", "Giày đế phẳng/giày cử tạ", "Áo ôm che vai, tất dài cho deadlift"],
      desc:"Luật IPF rút gọn: mỗi bài 3 lần cử, 3 trọng tài, lệnh “Squat/Rack”, “Start/Press/Rack”, “Down”. Xếp hạng chung theo điểm IPF GL. Cân ký 1 giờ trước giờ thi. Có khu khởi động và spotter cho bench/squat." });
    add("ev_workshop_dam", { title:"Workshop dinh dưỡng: Ăn đủ đạm kiểu Việt", sport:"workshop", start:`${sat3}T09:00`, end:`${sat3}T11:00`,
      venue:"Không gian cộng đồng (địa điểm mẫu)", address:"Hải Châu, Đà Nẵng", city:"Đà Nẵng",
      capacity:40, fee:99000, points:80, seedRegs:18, options:["Tăng cơ","Giảm mỡ","Giữ dáng"],
      bring:["Sổ tay/điện thoại để ghi chú", "Ảnh 1–2 bữa ăn thường ngày để được góp ý"],
      desc:"Tính nhu cầu đạm 1,6–2,2 g/kg, chia đều 3–5 bữa (20–40 g/bữa); xây thực đơn từ đồ chợ Việt (trứng, đậu phụ, cá, ức gà, thịt nạc, sữa chua); đọc nhãn dinh dưỡng; thực hành ước lượng khẩu phần bằng bàn tay. Có tiệc trà healthy nhẹ." });
    add("ev_picnic_ecopark", { title:"Picnic sống khoẻ cuối tuần — Ecopark", sport:"picnic", start:`${sun3}T08:00`, end:`${sun3}T13:00`,
      venue:"Bãi cỏ ven hồ, Ecopark", address:"Ecopark, Văn Giang, Hưng Yên", city:"Hưng Yên",
      capacity:60, fee:50000, points:100, seedRegs:22, options:["Đi một mình","Đi cùng gia đình (ghi số người ở ghi chú)"],
      bring:["Thảm picnic", "Mũ, kem chống nắng", "Hộp đựng đồ ăn cá nhân"],
      desc:"Đi bộ 3 km quanh hồ, yoga nhẹ 30 phút, mini game đồng đội và bữa trưa lành mạnh (phí 50.000đ bao gồm đồ ăn). Trẻ em đi cùng miễn phí." });
    add("ev_run_hotay", { demoPast:true, title:"Chạy 10 km Hồ Tây", sport:"run", start:`${past}T05:30`, end:`${past}T07:30`,
      venue:"Phủ Tây Hồ (điểm tập trung)", address:"Phủ Tây Hồ, Tây Hồ, Hà Nội", city:"Hà Nội",
      capacity:100, fee:0, points:150, seedRegs:64, options:["5 km","10 km"], bring:["Giày chạy","Nước"],
      desc:"Một vòng Hồ Tây rút gọn 10 km, có trạm nước ở km 5." });
    add("ev_yoga_giadinh", { demoPast:true, title:"Yoga bình minh & giãn cơ cho dân chạy bộ", sport:"yoga", start:`${past2}T06:00`, end:`${past2}T07:15`,
      venue:"Bãi cỏ trung tâm, Công viên Gia Định", address:"Công viên Gia Định, Hoàng Minh Giám, TP. Hồ Chí Minh", city:"TP. Hồ Chí Minh",
      capacity:40, fee:0, points:80, seedRegs:29, options:["Người mới","Đã tập yoga"], bring:["Thảm yoga (BTC có thảm cho mượn)", "Khăn nhỏ", "Nước"],
      desc:"75 phút yoga Hatha nhẹ nhàng tập trung vào hông, gân kheo, bắp chân và cột sống ngực — những vùng dễ căng cứng ở người chạy bộ và người ngồi văn phòng. Kết thúc bằng 10 phút thở hộp và thư giãn sâu." });
    return E;
  }
  const C_NAVY = { id:"navy", name:"Xanh navy", hex:"#0B2A33" }, C_MINT = { id:"teal", name:"Teal TapEasy", hex:"#02BCB3" },
        C_CORAL = { id:"coral", name:"Cam san hô", hex:"#FF7A45" }, C_WHITE = { id:"white", name:"Trắng", hex:"#F2F5F6" },
        C_BLACK = { id:"black", name:"Đen", hex:"#17191C" };
  function seedProducts(){
    const P = {};
    const add = (id, o) => { P[id] = Object.assign({ id, hidden:false, sizes:[], stock:50, demo:true, createdAt: now(), updatedAt: now() }, o); };   // R3: hàng MẪU — shop.js không bày cho khách
    add("p_tee", { name:"Áo tập TapEasy Dry-fit", short:"Tập dễ dàng. Tiến bộ mỗi ngày.", art:"tee", cat:"wear", price:249000, compareAt:299000, badge:"Bán chạy",
      colors:[C_NAVY, C_MINT, C_WHITE], sizes:["S","M","L","XL","XXL"], stock:80,
      material:"Vải polyester thun lạnh 160 gsm, thoát mồ hôi nhanh, co giãn 4 chiều. In logo chuyển nhiệt không bong tróc.",
      care:"Giặt máy nước lạnh, lộn trái, không dùng thuốc tẩy, phơi trong bóng râm." });
    add("p_cap", { name:"Mũ lưỡi trai TapEasy", short:"Chạy bộ, đi nắng", art:"cap", cat:"wear", price:159000,
      colors:[C_NAVY, C_CORAL, C_BLACK], sizes:[], stock:60,
      material:"Vải dù nhẹ, lỗ thoáng khí, quai sau khoá dán chỉnh cỡ 54–60 cm. Logo thêu nổi.", care:"Giặt tay nhẹ, không vắt." });
    add("p_bottle", { name:"Bình nước TapEasy 750 ml", short:"Có vạch nhắc uống theo giờ", art:"bottle", cat:"gear", price:149000, badge:"Mới",
      colors:[C_MINT, C_NAVY, C_CORAL], sizes:[], stock:100,
      material:"Nhựa Tritan không BPA, nắp bật một tay, quai xách. Vạch chia 8:00 → 18:00 giúp uống đủ nước mỗi ngày.", care:"Rửa tay bằng nước ấm, không dùng máy rửa bát." });
    add("p_band", { name:"Bộ dây kháng lực mini (3 mức)", short:"Nhẹ · Vừa · Nặng", art:"band", cat:"gear", price:129000,
      colors:[{ id:"set", name:"Bộ 3 màu", hex:"#5EE6C7" }], sizes:[], stock:70,
      material:"Cao su latex tự nhiên dày 1,2 mm, vòng 60 × 5 cm. Mức kháng ~5 / 10 / 15 kg. Kèm túi đựng và hướng dẫn 12 bài khởi động mông – vai.", care:"Tránh nắng gắt, lau khô sau khi dùng." });
    add("p_towel", { name:"Khăn tập TapEasy microfiber", short:"30 × 90 cm, khô nhanh", art:"towel", cat:"gear", price:89000,
      colors:[C_NAVY, C_MINT], sizes:[], stock:90,
      material:"Sợi microfiber thấm hút gấp 3 lần cotton, có túi kéo khoá nhỏ đựng chìa khoá.", care:"Giặt máy, không dùng nước xả vải để giữ độ thấm." });
    add("p_sticker", { name:"Bộ sticker TapEasy (12 miếng)", short:"Chống nước, dán bình/laptop", art:"sticker", cat:"souvenir", price:39000,
      colors:[{ id:"mix", name:"Nhiều màu", hex:"#FF7A45" }], sizes:[], stock:200,
      material:"Decal vinyl cán màng mờ, chống nước, bóc không để keo.", care:"Dán lên bề mặt sạch, khô." });
    add("p_bag", { name:"Túi gym dây rút TapEasy", short:"Ngăn giày riêng", art:"bag", cat:"gear", price:199000,
      colors:[C_NAVY, C_BLACK], sizes:[], stock:50,
      material:"Vải polyester 600D chống thấm nhẹ, ngăn giày thoáng khí phía dưới, túi khoá kéo ngoài. Kích thước 45 × 35 cm.", care:"Giặt tay." });
    add("p_socks", { name:"Tất thể thao cổ trung (combo 2 đôi)", short:"Đệm gót, chống trượt", art:"socks", cat:"wear", price:79000,
      colors:[C_WHITE, C_BLACK], sizes:["35–39","40–44"], stock:120,
      material:"Cotton pha spandex, đệm dày ở gót và mũi, bo cổ chống tuột.", care:"Giặt máy, không sấy nóng." });
    add("p_lanyard", { name:"Dây đeo thẻ & móc khoá TapEasy", short:"Dây đeo in slogan", art:"lanyard", cat:"souvenir", price:49000,
      colors:[C_MINT, C_CORAL], sizes:[], stock:150,
      material:"Dây polyester bản 2 cm in slogan “Tập dễ dàng · Chạm là tập”, móc kim loại xoay 360°.", care:"—" });
    return P;
  }
  /* Review mẫu + bài đăng sau sự kiện của BTC — mọi bài đều có ảnh/clip và nội dung */
  const RV_SEED = {
    ev_run_hotay: [
      { id:"rv1", uid:"bot_3", name:"Phạm Ngọc Trâm", stars:5, text:"Lần đầu chạy 10 km mà không bị bỏ lại phía sau nhờ có người dẫn nhịp. Trạm nước ở km 5 rất đúng lúc!", like:24 },
      { id:"rv2", uid:"bot_7", name:"Bùi Đức Thịnh", stars:4, text:"Tổ chức gọn gàng, điểm danh nhanh bằng QR. Mong lần sau có chỗ gửi đồ.", like:9 },
      { id:"rv3", uid:"bot_12", name:"Ngô Phương Thảo", stars:5, text:"Không khí sáng sớm Hồ Tây quá đẹp, mọi người cổ vũ nhau nhiệt tình.", like:31 },
      { id:"rv4", uid:"bot_20", name:"Châu Ngọc Hân", stars:5, text:"Phần giãn cơ cuối buổi rất có ích, hôm sau chân không bị đau.", like:12 },
    ],
    ev_yoga_giadinh: [
      { id:"ry1", uid:"bot_5", name:"Vũ Thanh Tâm", stars:5, text:"Bài giãn hông và gân kheo đúng thứ dân chạy cần. Cô hướng dẫn kỹ, có tư thế thay thế cho người cứng như mình.", like:17 },
      { id:"ry2", uid:"bot_14", name:"Trịnh Bảo Ngọc", stars:4, text:"Buổi sáng trong lành, thở hộp cuối buổi rất thư giãn. Lần sau mong có thêm khu để xe.", like:6 },
    ],
  };
  function seedReviews(evs){
    const R = {};
    Object.values(evs).filter(e=> e.demoPast).forEach(ev=>{
      const base = ev.id.replace(/_\d{6}$/, ""), list = RV_SEED[base]; if(!list) return;
      const t = new Date(ev.end).getTime() + 3*3600e3;
      R[ev.id] = list.map((r, i)=> ({ id:r.id, kind:"review", uid:r.uid, name:r.name, stars:r.stars, text:r.text, media: clone(RV_MEDIA[r.id] || []), coverId:(RV_MEDIA[r.id]||[{}])[0].id, likeBase:r.like, ts: t + i*1800e3 }));
      if(base === "ev_run_hotay") R[ev.id].push({ id:"recap_hotay", kind:"recap", uid:"tapeasy", name:"TapEasy", staff:true, likeBase:58, ts: t + 5*3600e3,
        text:`Cảm ơn ${ev.seedRegs || 64} runner đã có mặt từ 5:15 sáng! 82% hoàn thành cự ly đăng ký, nhóm 70 phút về đích đủ người. Ảnh và clip buổi chạy ở đây — tag bạn bè và hẹn gặp ở buổi chạy Hồ Gươm cuối tuần này nhé.`,
        media: clone([EV_CONTENT.ev_run_hotay.media[2], EV_CONTENT.ev_run_hotay.media[0], EV_CONTENT.ev_run_hotay.media[1], RV_MEDIA.rv3[0]]), coverId:"pxv5319351" });
    });
    return R;
  }
  /* bình luận mẫu (bảng tin Khoảnh khắc) */
  function seedComments(evs){
    const C = {}, past = Object.values(evs).find(e=> /^ev_run_hotay_/.test(e.id));
    if(past){ const t = new Date(past.end).getTime() + 6*3600e3;
      C[`${past.id}/recap_hotay`] = [{ id:"c1", uid:"bot_9", name:"Đỗ Khánh Linh", text:"Clip đẹp quá! Lần sau mình rủ thêm 2 bạn cùng công ty.", ts:t }, { id:"c2", uid:"bot_3", name:"Phạm Ngọc Trâm", text:"Cảm ơn nhóm pacer 70 phút nha, nhờ mọi người mà mình về đích.", ts:t + 900e3 }];
      C[`${past.id}/rv1`] = [{ id:"c3", uid:"bot_11", name:"Dương Hoàng Nam", text:"Chúc mừng 10 km đầu tiên!", ts:t + 1200e3 }]; }
    return C;
  }

  /* =====================================================================
     NGƯỜI CHƠI GIẢ (chỉ chế độ demo) — tiến độ hợp lý theo từng chỉ số
     ===================================================================== */
  function botCount(ch){ return 18 + Math.floor(r01("n", ch.id) * 22); }   // 18–39 người
  function botDay(ch, i, d){
    const c = 0.3 + 0.68 * r01("c", ch.id, i);                 // độ chăm chỉ của người chơi
    const r = r01("d", ch.id, i, d);
    switch(ch.metric){
      case "sessions": { const dow = parse(d).getDay(); const restBias = dow === 0 ? 0.45 : 1; return r < c*0.78*restBias ? 1 : 0; }
      case "water_days": return r < c*0.97 ? 1 : 0;
      case "food_days": return r < c*0.92 ? 1 : 0;
      case "sleep_days": return r < c*0.8 ? 1 : 0;
      case "run_km": return r < c*0.42 ? Math.round((3 + r01("k", ch.id, i, d)*7.5)*10)/10 : 0;
      case "weight_loss": return 0;   // xử lý riêng
      default: return r < c*0.7 ? 1 : 0;
    }
  }
  function botWeightLoss(ch, i, from, to){
    // giảm ~ c × 0,07 kg/ngày, dao động ±0,3 kg, cân mỗi 3–4 ngày, trần 1%/tuần của ~68 kg
    const c = 0.3 + 0.68 * r01("c", ch.id, i);
    const days = Math.max(0, Math.round((parse(to) - parse(ch.start))/864e5) + 1);
    const daysFrom = Math.max(0, Math.round((parse(from) - parse(ch.start))/864e5));
    const f = n => { const step = Math.floor(n/3.5)*3.5; const noise = (r01("w", ch.id, i, Math.floor(n/3.5)) - .5)*0.5; return Math.max(0, Math.min(0.68*(step/7)+0.3, c*0.075*step + noise)); };
    return { total: Math.round(f(days)*10)/10, before: Math.round(f(daysFrom)*10)/10 };
  }
  function botEntries(ch, todayS){
    const n = botCount(ch), out = [];
    const until = ch.end < todayS ? ch.end : todayS;
    if(ch.start > todayS) {
      // sắp diễn ra: chỉ có người đã đăng ký, tiến độ 0
      const k = Math.floor(n * 0.45);
      for(let i=0;i<k;i++) out.push({ uid:`bot_${i}`, name: BOT_NAMES[(i + hashStr(ch.id)) % BOT_NAMES.length], bot:true, value:0, weekValue:0, joinedAt: ch.start });
      return out;
    }
    const wk0 = mondayOf(until) < ch.start ? ch.start : mondayOf(until);
    for(let i=0;i<n;i++){
      let v = 0, wv = 0;
      if(ch.metric === "weight_loss"){
        const w = botWeightLoss(ch, i, wk0, until); v = w.total; wv = Math.max(0, Math.round((w.total - w.before)*10)/10);
      } else {
        for(let d = ch.start; d <= until; d = addD(d, 1)){
          if(d === todayS && r01("t", ch.id, i, d) > 0.45) continue;  // hôm nay: chưa ai cũng cập nhật
          const x = botDay(ch, i, d); v += x; if(d >= wk0) wv += x;
        }
        v = Math.round(v*10)/10; wv = Math.round(wv*10)/10;
      }
      out.push({ uid:`bot_${i}`, name: BOT_NAMES[(i + hashStr(ch.id)) % BOT_NAMES.length], bot:true, value:v, weekValue:wv,
        done: v >= ch.target, joinedAt: ch.start, updatedAt: parse(until).getTime() - Math.floor(r01("u", ch.id, i)*864e5) });
    }
    return out;
  }
  function fakeRegs(ev){
    const n = Math.max(0, Math.min(ev.capacity||0, ev.seedRegs||0)), out = [];
    for(let i=0;i<n;i++){
      const name = BOT_NAMES[(i*7 + hashStr(ev.id)) % BOT_NAMES.length];
      const ph = "09" + String(10000000 + Math.floor(r01("p", ev.id, i)*89999999)).slice(0,8);
      const past = new Date(ev.end).getTime() < now();
      out.push({ uid:`bot_${i}`, name, phone: ph, bot:true, option: (ev.options||[])[Math.floor(r01("o", ev.id, i)*(ev.options||[]).length)] || "",
        code: Array.from({length:6}, (_,k)=> CODE_CHARS[Math.floor(r01("c", ev.id, i, k)*CODE_CHARS.length)]).join(""),
        status: past && r01("ci", ev.id, i) < 0.82 ? "checked_in" : "registered",
        createdAt: new Date(ev.start).getTime() - (2 + Math.floor(r01("t", ev.id, i)*12))*864e5 });
    }
    return out;
  }

  /* =====================================================================
     ĐỘNG CƠ DEMO (localStorage)
     ===================================================================== */
  function emptyDB(){ return { v:0, challenges:{}, entries:{}, events:{}, regs:{}, reviews:{}, products:{}, orders:{}, gifts:{}, mlikes:{}, mcomments:{}, mreports:{}, vclaims:{}, vused:{}, seededMonth:"" }; }
  function dLoad(){ try{ return Object.assign(emptyDB(), JSON.parse(localStorage.getItem(DEMO_KEY) || "{}")); }catch(e){ return emptyDB(); } }
  function dSave(db){
    try{ localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
    catch(e){ throw dErr("quota", "Bộ nhớ máy đầy — hãy xoá bớt ảnh review cũ rồi thử lại."); }
  }
  function ensureSeed(db, today){
    const tdy = today || new Date();
    const curYM = ds(tdy).slice(0,7);
    let changed = false;
    const upgrading = db.v !== SEED_VERSION;
    if(upgrading){ db.v = SEED_VERSION; db.products = Object.assign(seedProducts(), obj(db.products)); db.seededMonth = ""; changed = true; }
    ["mlikes","mcomments","mreports"].forEach(k=>{ db[k] = obj(db[k]); });
    if(db.seededMonth !== curYM){   // lần đầu / sang tháng mới: thêm thử thách & sự kiện mẫu của tháng (giữ nguyên dữ liệu cũ)
      const first = !db.seededMonth && !Object.keys(obj(db.events)).length;   // nâng cấp phiên bản: không gieo lại sự kiện đã qua (tránh trùng)
      const ch = seedChallenges(tdy); for(const k in ch) if(!db.challenges[k]) db.challenges[k] = ch[k];
      const ev = seedEvents(tdy, curYM, first); for(const k in ev) if(!db.events[k]) db.events[k] = ev[k];
      if(first){ db.reviews = Object.assign(seedReviews(ev), obj(db.reviews)); db.mcomments = Object.assign(seedComments(ev), db.mcomments); }
      db.seededMonth = curYM; changed = true;
    }
    if(upgrading) upgradeContent(db, tdy);
    return changed;
  }
  /* Nâng cấp dữ liệu demo cũ (v ≤ 3): bổ sung ảnh/clip + nội dung đầy đủ cho sự kiện/thử thách/review mẫu đã có */
  function upgradeContent(db, tdy){
    const tl = s=> String(s||"").replace(/\s+/g," ").trim().length;
    const fill = (doc, tpl)=>{ for(const k of ["media","coverId","cover","agenda","requirements","perks","safety","rules","eligibility"]) if(tpl[k] != null && (doc[k] == null || (Array.isArray(doc[k]) && !doc[k].length) || doc[k] === "")) doc[k] = clone(tpl[k]);
      if(tpl.desc && tl(doc.desc) < 80) doc.desc = tpl.desc; };
    const evT = seedEvents(tdy, ds(tdy).slice(0,7), true), byBase = {};
    Object.values(evT).forEach(e=>{ byBase[e.id.replace(/_\d{6}$/, "")] = e; });
    Object.values(db.events).forEach(e=>{ if(!e || !e.seed) return; const t = byBase[String(e.id).replace(/_\d{6}$/, "")]; if(t) fill(e, t); });
    const chT = seedChallenges(tdy), chBy = {};
    Object.values(chT).forEach(c=>{ chBy[c.id.replace(/^ch_\d{6}_/, "")] = c; });
    Object.values(db.challenges).forEach(c=>{ if(!c || c.createdBy !== "seed") return; const k = String(c.id).replace(/^ch_\d{6}_/, ""); if(chBy[k]) fill(c, Object.assign({}, chBy[k], { desc: tl(c.desc) < 80 ? chBy[k].desc.replace(/tháng \d+/g, "tháng " + Number(String(c.month||c.start||"").slice(5,7))) : c.desc })); });
    /* review mẫu cũ ("art:run1") → ảnh thật + đếm thích; thêm sự kiện yoga + bài đăng của BTC nếu chưa có */
    Object.keys(db.reviews).forEach(evId=>{
      const base = evId.replace(/_\d{6}$/, ""), tpl = RV_SEED[base] || [];
      (db.reviews[evId]||[]).forEach(r=>{ const t = tpl.find(x=> x.id === r.id && x.uid === r.uid); if(t && !(Array.isArray(r.media) && r.media.length)){ r.media = clone(RV_MEDIA[t.id] || []); r.coverId = (r.media[0]||{}).id; r.likeBase = t.like; r.kind = "review"; delete r.photos; } });
      if(base === "ev_run_hotay" && db.events[evId] && !(db.reviews[evId]||[]).some(r=> r.kind === "recap")){ const s = seedReviews({ [evId]: Object.assign({}, db.events[evId], { demoPast:true }) })[evId]; const rc = s && s.find(r=> r.kind === "recap"); if(rc) db.reviews[evId].push(rc);
        Object.assign(db.mcomments, seedComments({ [evId]: db.events[evId] }), db.mcomments); }
    });
    if(!Object.keys(db.events).some(id=> /^ev_yoga_giadinh_/.test(id))){
      const y = Object.values(evT).find(e=> /^ev_yoga_giadinh_/.test(e.id));
      if(y){ db.events[y.id] = y; db.reviews[y.id] = seedReviews({ [y.id]: y })[y.id] || []; }
    }
  }

  /* ---------- Nội dung bắt buộc (cùng luật với form — TapMedia.validate) + bảng tin Khoảnh khắc ---------- */
  const arr = a=> Array.isArray(a) ? a : [];
  function rbacX(){ try{ const R = typeof window !== "undefined" ? window.TE_RBAC : null; return R && typeof R.legacyAdmin === "function" ? R : null; }catch(e){ return null; } }   // rbac.js (vòng 3)
  function TMx(){ try{ if(typeof TapMedia !== "undefined" && TapMedia) return TapMedia; }catch(e){} try{ return (typeof window !== "undefined" && window.TapMedia) || null; }catch(e){ return null; } }
  /* chỉ lưu nguồn bền vững: https (Storage/Pexels), idb: (IndexedDB demo), art: (minh hoạ mẫu) — blob: là ảnh xem trước chưa tải lên */
  function cleanMedia(list){ return arr(list).filter(m=> m && (m.kind === "image" || m.kind === "video") && /^(https:\/\/[^\s"'<>]+|idb:[\w\-]+|art:[\w\-]+)$/.test(String(m.src||""))).slice(0, 12).map(m=>{
    const x = {}; ["id","kind","src","thumb","poster","w","h","dur","size","mime","alt","credit"].forEach(k=>{ if(m[k] != null && m[k] !== "") x[k] = clone(m[k]); });
    ["thumb","poster"].forEach(k=>{ if(x[k] && !/^(https:\/\/[^\s"'<>]+|idb:[\w\-]+)$/.test(x[k])) delete x[k]; }); x.id = String(x.id || rid("m")); return x; }); }
  function checkContent(kind, doc){
    const T = TMx(); let r;
    if(T && T.validate) r = T.validate(kind, doc);
    else { const tl = s=> String(s||"").replace(/\s+/g," ").trim().length, post = kind === "review" || kind === "recap", E = [];
      if(post ? tl(doc.text) < 20 : (tl(doc.title) < 4 || tl(doc.desc) < 80)) E.push({ msg: post ? "Nội dung cần ít nhất 20 ký tự." : "Cần tên và mô tả ít nhất 80 ký tự." });
      if(!arr(doc.media).length) E.push({ msg:"Cần ít nhất 1 ảnh hoặc 1 video." });
      r = { ok: !E.length, errors: E }; }
    if(!r.ok) throw dErr("content", r.errors[0].msg);
  }
  function canDo(perm){ try{ if(typeof teCan === "function") return !!teCan(perm); }catch(e){} try{ return !!(typeof state !== "undefined" && state && state.isAdmin); }catch(e){ return false; } }
  const canMod = ()=> canDo("community.moderate") || canDo("reviews.moderate");
  const REPORT_HIDE = 3;
  /* fix-commerce QC-08/QS-19: tự ẩn theo TRỌNG SỐ báo cáo (tài khoản < 3 ngày tuổi = 0) — số báo cáo thô vẫn hiển thị cho kiểm duyệt */
  const repWeight = p=> p && p.reportWeight != null ? Number(p.reportWeight)||0 : Number(p && p.reportCount)||0;
  const hiddenPost = p=> !!p && (p.hidden === true || (!p.modOk && repWeight(p) >= REPORT_HIDE));
  function cleanPost(p, kind){ p = obj(p); const o = { kind, text: String(p.text||"").trim().slice(0, 2000), media: cleanMedia(p.media) };
    o.coverId = o.media.some(m=> m.id === p.coverId) ? String(p.coverId) : (o.media[0] ? o.media[0].id : "");
    if(kind === "review") o.stars = Math.max(1, Math.min(5, Math.round(Number(p.stars)||0))); return o; }
  function decoPost(db, evId, r, uid){
    const key = `${evId}/${r.id}`, L = obj(db.mlikes[key]), R = obj(db.mreports[key]);
    const x = clone(r); x.evId = evId; x.kind = x.kind || "review";
    x.likeCount = (Number(r.likeBase)||0) + Object.keys(L).length; x.liked = !!L[uid];
    x.commentCount = arr(db.mcomments[key]).length; x.reportCount = Object.keys(R).length; x.reportedByMe = !!R[uid];
    x.reportWeight = Object.values(R).reduce((a, v)=> a + (v && v.w != null ? Number(v.w)||0 : 1), 0);
    x.name = cleanName(x.name);
    delete x.likeBase; return x;
  }

  /* =====================================================================
     fix-commerce — LUẬT "MÁY CHỦ" (động cơ demo tự thực thi; bản Firebase: Cloud Function
     đối soát — đặc tả + mã đề xuất trong docs/qa/FIX-commerce.md §Chuyển giao)
     ===================================================================== */
  /* Tên hiển thị người khác nhập: bỏ ký tự điều khiển/thẻ, ≤ 40 ký tự (QS-01 — vẫn escape khi vẽ) */
  function cleanName(s){ return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  const isoTs = iso=>{ const m = String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); if(!m) return NaN; return new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0)).getTime(); };
  const isDs = s=> typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const endOfDay = s=> { const a = String(s).slice(0,10).split("-").map(Number); return new Date(a[0], a[1]-1, a[2], 23, 59, 59, 999).getTime(); };
  const r1 = x=> Math.round((Number(x)||0)*10)/10;
  /* Thi đua (QC-01/04/05 · QS-09): trần mỗi ngày theo chỉ số — tổng tiến độ ≤ số ngày đã qua × trần/ngày */
  const CH_DAILY = { sessions:2, run_km:60, water_days:1, food_days:1, sleep_days:1, manual:100 };
  const PUSH_GRACE_MS = 48*3600e3;          // sau ngày kết thúc: còn 48 giờ để máy gửi số chốt
  function chDays(ch, todayS){ const to = todayS < ch.end ? todayS : ch.end; if(!isDs(ch.start) || to < ch.start) return 0; return Math.round((parse(to) - parse(ch.start))/864e5) + 1; }
  function progressCap(ch, entry, todayS){
    const days = chDays(ch, todayS); if(!days) return 0;
    if(ch.metric === "weight_loss"){ const b = Number(entry && entry.baseline) > 20 ? Number(entry.baseline) : 120; return Math.floor(b*0.01*Math.max(1, days/7)*10 + 1e-9)/10; }
    return days * (CH_DAILY[ch.metric] || CH_DAILY.manual);
  }
  function joinedLate(ch, e){ const j = Number(e && e.joinedAt) || 0; return !!j && ds(new Date(j)) > ch.end; }
  /** Chuẩn hoá tiến độ tự khai: số hữu hạn ≥ 0, ≤ trần theo ngày, tăng mỗi lần đẩy ≤ trần × (số ngày từ lần trước + 2) */
  function sanitizeProgress(ch, e, p, todayS){
    e = obj(e); p = obj(p);
    const per = ch.metric === "weight_loss" ? 1 : (CH_DAILY[ch.metric] || CH_DAILY.manual);
    const cap = progressCap(ch, e, todayS);
    let v = Number(p.value); if(!isFinite(v) || v < 0) v = 0;
    let limit = cap;
    if(e.pushes && ch.metric !== "weight_loss"){ const since = Math.max(0, Math.floor((now() - (Number(e.pushedAt)||0))/864e5)); limit = Math.min(cap, (Number(e.value)||0) + per*(since + 2)); }
    const value = r1(Math.min(v, limit));
    let wv = Number(p.weekValue); if(!isFinite(wv) || wv < 0) wv = 0;
    const weekValue = r1(Math.min(wv, value, ch.metric === "weight_loss" ? value : per*7));
    let man = Number(p.manual); if(!isFinite(man) || man < 0) man = 0; man = r1(Math.min(man, value));
    const flags = [];
    if(v > value + 0.05) flags.push("capped");
    if(value > 0 && man / value > 0.3) flags.push("manual_hi");
    return { value, weekValue, week: /^\d{4}-W\d{2}$/.test(String(p.week||"")) ? String(p.week) : "", done: value >= (Number(ch.target)||1), manual: man, flags, claimed: v > value ? r1(v) : null };
  }
  /* Check-in (QC-08): chỉ trong khung [bắt đầu − 2 giờ, kết thúc + 6 giờ]; review chỉ sau check-in hợp lệ */
  const CI_EARLY_MS = 2*3600e3, CI_LATE_MS = 6*3600e3;
  function ciWindow(ev){ const s = isoTs(ev && ev.start), e = isoTs(ev && (ev.end || ev.start)); const st = isFinite(s) ? s : 0, en = isFinite(e) && e >= st ? e : st + 2*3600e3; return { from: st - CI_EARLY_MS, to: en + CI_LATE_MS, start: st, end: en }; }
  const hhmm = t=>{ const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth()+1)}`; };
  function checkWindow(ev){ const w = ciWindow(ev), t = now();
    if(t < w.from) throw dErr("too-early", `Chưa tới giờ điểm danh — mở từ ${hhmm(w.from)} (2 giờ trước giờ bắt đầu).`);
    if(t > w.to) throw dErr("too-late", "Đã quá giờ điểm danh của sự kiện này (6 giờ sau khi kết thúc)."); }
  const validCheckin = (ev, r)=>{ if(!r || r.status !== "checked_in") return false; const t = Number(r.checkedInAt)||0; if(!t) return true; const w = ciWindow(ev); return t >= w.from && t <= w.to; };
  /* Uy tín tài khoản: tuổi (ngày) từ hồ sơ cloud.js — tài khoản < 3 ngày: báo cáo không tính vào ngưỡng tự ẩn, review không vào điểm trung bình */
  const TRUST_DAYS = 3;
  function accountAgeDays(){
    let t = 0;
    try{ const p = typeof cloud !== "undefined" ? cloud.profile : null; t = Number(p && p.createdAt) || 0; }catch(e){}
    try{ if(!t && typeof firebase !== "undefined" && firebase.auth && firebase.auth().currentUser) t = Date.parse(firebase.auth().currentUser.metadata.creationTime) || 0; }catch(e){}
    return t ? Math.max(0, (now() - t)/864e5) : 0;
  }
  const trusted = ()=> accountAgeDays() >= TRUST_DAYS;

  /* Gian hàng (QC-03/06/07 · QS-06/08): tính lại giá từ danh mục máy chủ, tồn kho không âm, SL nguyên 1–10, voucher 1 lượt */
  const EXPRESS_OK = ["Hà Nội", "TP. Hồ Chí Minh"];
  const ORDER_FLOW = { awaiting_payment:["pending","confirmed","cancelled"], pending:["awaiting_payment","confirmed","cancelled"], confirmed:["shipping","delivered","cancelled"],
    shipping:["delivered","cancelled"], delivered:["cancelled"], cancelled:["pending","awaiting_payment"] };
  const STOCK_STATUSES = ["awaiting_payment","pending","confirmed","shipping","delivered"];
  function shopCfg(){
    const c = { shippingFee:30000, freeShipFrom:499000, expressFee:45000 };
    try{ const T = typeof window !== "undefined" && window.TapShop && window.TapShop.core && window.TapShop.core.CFG; if(T) ["shippingFee","freeShipFrom","expressFee"].forEach(k=>{ if(Number(T[k]) >= 0) c[k] = Number(T[k]); }); }catch(e){}
    return c;
  }
  const vkey = (c, z)=> String(c||"") + "|" + String(z||"");
  const sumObj = o=> Object.values(obj(o)).reduce((a, b)=> a + (Number(b)||0), 0);
  function availOf(p, k){ if(p.stockBy && typeof p.stockBy === "object") return Math.max(0, Number(p.stockBy[k])||0); return typeof p.stock === "number" ? Math.max(0, p.stock) : 99; }
  function moveStock(p, lines, sign){
    lines.forEach(l=>{ if(l.pid !== p.id) return;
      if(p.stockBy && typeof p.stockBy === "object"){ p.stockBy[l.k] = Math.max(0, (Number(p.stockBy[l.k])||0) + sign*l.qty); p.stock = sumObj(p.stockBy); }
      else if(typeof p.stock === "number") p.stock = Math.max(0, p.stock + sign*l.qty); });
  }
  const str = (s, n)=> String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
  function cleanAddr(a){ a = obj(a); return { name: str(a.name, 60), phone: String(a.phone||"").replace(/[^\d+]/g, "").slice(0, 14), province: str(a.province, 40), ward: str(a.ward, 60), street: str(a.street, 120), note: str(a.note, 120) }; }
  /* Chữ ký voucher trong ví (đổi điểm / quà): chống sửa giá trị bằng localStorage — muối riêng của "máy chủ" demo */
  function salt(db){ if(!db.salt){ db.salt = Array.from({length:4}, ()=> Math.random().toString(36).slice(2)).join(""); try{ dSave(db); }catch(e){} } return db.salt; }
  function signSpec(db, v){ v = obj(v); return hashStr([salt(db), v.id, v.kind, Number(v.value)||0, Number(v.min)||0, Number(v.max)||0, v.exp||"", v.ref||""].join("|")).toString(36) + hashStr([v.id, salt(db), v.kind, v.value].join("~")).toString(36); }
  function voucherDiscount(v, subtotal, shipping){
    const min = Number(v.min)||0; if(subtotal < min) return { d:0, err:`Đơn tối thiểu ${min.toLocaleString("vi-VN")} ₫ để dùng voucher này` };
    if(v.kind === "ship") return { d: Math.min(shipping, Number(v.value)||0), err: shipping ? "" : "Đơn đã được miễn phí giao hàng" };
    if(v.kind === "amount") return { d: Math.min(Number(v.value)||0, subtotal), err:"" };
    if(v.kind === "pct") return { d: Math.min(Math.round(subtotal * (Number(v.value)||0) / 100), Number(v.max)||Infinity, subtotal), err:"" };
    return { d:0, err:"Voucher không hợp lệ" };
  }
  function adminVoucherStore(){ try{ const A = typeof window !== "undefined" && window.cloudAdmin && window.cloudAdmin._demo; if(A && typeof A.load === "function") return A; }catch(e){} return null; }
  function adminVoucher(code){ const A = adminVoucherStore(); if(!A) return null; try{ return obj(A.load().vouchers)[code] || null; }catch(e){ return null; } }
  function pruneClaims(C){ for(const id in C){ if(!C[id].order && now() - (Number(C[id].ts)||0) > 30*60e3) delete C[id]; } }
  /** Tính đơn phía máy chủ → { ok, lines, subtotal, shipping, discount, total, voucher } hoặc { ok:false, code, error } */
  function priceOrder(db, o, uid){
    o = obj(o);
    const byK = new Map();
    let dropped = 0;
    arr(o.items).slice(0, 30).forEach(it=>{
      it = obj(it); const q = Number(it.qty);
      if(!Number.isInteger(q) || q < 1 || q > 10){ dropped++; return; }
      const p = db.products[String(it.pid||"")];
      if(!p || p.deleted || p.hidden){ dropped++; return; }
      let color = String(it.color||""), size = String(it.size||""), k = vkey(color, size), legacy = false;
      if(p.stockBy && typeof p.stockBy === "object" && !(k in p.stockBy)){
        if(color || size) return byK.set("bad:" + p.id, { bad:true, name: p.name });
        const pick = Object.keys(p.stockBy).find(x=> (Number(p.stockBy[x])||0) >= q); if(!pick){ return byK.set("stock:" + p.id, { stock:true, name:p.name, avail: totalOf(p) }); }
        k = pick; [color, size] = pick.split("|"); legacy = true;
      }
      const cur = byK.get(p.id + "#" + k);
      if(cur) cur.qty = Math.min(10, cur.qty + q);
      else { const col = arr(p.colors).find(c=> c.id === color) || {};
        byK.set(p.id + "#" + k, { pid:p.id, k, color, size, colorName: String(col.name||"").slice(0, 30), name: String(p.name||"Sản phẩm").slice(0, 80), qty:q, price: Math.max(0, Math.round(Number(p.price)||0)), p, legacy }); }
    });
    function totalOf(p){ return p.stockBy && typeof p.stockBy === "object" ? sumObj(p.stockBy) : (typeof p.stock === "number" ? p.stock : 99); }
    const vals = Array.from(byK.values());
    const bad = vals.find(x=> x.bad); if(bad) return { ok:false, code:"variant", error:`${bad.name}: màu/size không còn bán — chọn lại trong giỏ hàng.` };
    const so = vals.find(x=> x.stock); if(so) return { ok:false, code:"stock", error:`${so.name}: chỉ còn ${so.avail} sản phẩm.` };
    const lines = vals.filter(x=> x.pid);
    if(!lines.length) return { ok:false, code:"empty", error: dropped ? "Đơn hàng không có sản phẩm hợp lệ (số lượng phải là số nguyên 1–10)." : "Giỏ hàng trống." };
    for(const l of lines){ const av = availOf(l.p, l.k); if(l.qty > av) return { ok:false, code:"stock", error:`${l.name}${l.colorName || l.size ? ` (${[l.colorName, l.size].filter(Boolean).join(", ")})` : ""}: chỉ còn ${av} sản phẩm.` }; }
    const cfg = shopCfg(), addr = cleanAddr(o.address), express = o.shipMethod === "express";
    if(express && !EXPRESS_OK.includes(addr.province)) return { ok:false, code:"express", error:"Hoả tốc chỉ áp dụng nội thành Hà Nội, TP. Hồ Chí Minh." };
    const subtotal = lines.reduce((a, l)=> a + l.price*l.qty, 0);
    const shipping = express ? cfg.expressFee : (subtotal === 0 || subtotal >= cfg.freeShipFrom ? 0 : cfg.shippingFee);
    let discount = 0, voucher = null;
    const V = o.voucher && typeof o.voucher === "object" ? o.voucher : null;
    if(V){
      const today = ds(new Date());
      if(V.claimId || V.src === "admin"){
        const code = String(V.code||"").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
        const adm = adminVoucher(code) || (V.spec && typeof V.spec === "object" ? V.spec : null);
        const C = db.vclaims[code] = obj(db.vclaims[code]); pruneClaims(C);
        const mine = V.claimId && C[V.claimId] && C[V.claimId].uid === uid && !C[V.claimId].order ? C[V.claimId] : null;
        const others = Object.keys(C).filter(id=> !C[id].order && id !== V.claimId).length;
        if(!adm || adm.revoked || (adm.exp && adm.exp < today)) return { ok:false, code:"voucher", error:"Mã giảm giá không hợp lệ hoặc đã hết hạn — bỏ mã rồi đặt lại." };
        if(!mine && (Number(adm.used)||0) + others >= (Number(adm.uses)||1)) return { ok:false, code:"voucher", error:"Mã giảm giá đã hết lượt dùng — bỏ mã rồi đặt lại." };
        const kind = adm.kind === "freeship" ? "ship" : adm.kind === "percent" ? "pct" : adm.kind === "amount" ? "amount" : adm.kind;
        const r = voucherDiscount({ kind, value: kind === "ship" ? 1e9 : adm.value, min: adm.min, max: adm.cap || adm.max }, subtotal, shipping);
        if(r.err && !r.d) return { ok:false, code:"voucher", error: r.err };
        discount = r.d; voucher = { code, title: str(adm.title || ("Mã " + code), 60), src:"admin", claimId: V.claimId || "" };
      } else {
        const vid = String(V.id||"");
        if(!vid || V.sig !== signSpec(db, V)) return { ok:false, code:"voucher", error:"Voucher không hợp lệ (dữ liệu trên máy đã bị thay đổi) — bỏ voucher rồi đặt lại." };
        if(db.vused[vid]) return { ok:false, code:"voucher", error:"Voucher này đã được dùng cho một đơn khác." };
        if(V.exp && V.exp < today) return { ok:false, code:"voucher", error:"Voucher đã hết hạn." };
        const r = voucherDiscount(V, subtotal, shipping);
        if(r.err && !r.d) return { ok:false, code:"voucher", error: r.err };
        discount = r.d; voucher = { code: str(V.code, 16), title: str(V.title, 60), id: vid, src: str(V.src, 12) || "wallet" };
      }
    }
    discount = Math.max(0, Math.round(discount));
    return { ok:true, lines, subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount), voucher, addr, dropped };
  }
  const findPost = (db, evId, pid)=> arr(db.reviews[evId]).find(r=> r.id === pid) || null;
  async function dropMedia(list){ const T = TMx(); if(!T || !T.idb) return; for(const m of arr(list)) for(const s of [m.src, m.thumb, m.poster]) if(/^idb:/.test(String(s||""))) try{ await T.idb.del(String(s).slice(4)); }catch(e){} }

  const demo = {
    name:"demo",
    async init(){ const db = dLoad(); if(ensureSeed(db)) dSave(db); },
    async isAdmin(){ try{ const R = rbacX(); if(R) return !!R.legacyAdmin(); return !!(typeof state !== "undefined" && state.isAdmin); }catch(e){ return false; } },   // RBAC (vòng 3) · dự phòng khi chạy rời
    /* ---- Thử thách ---- */
    async listChallenges(){ const db = dLoad(); return Object.values(db.challenges).map(clone); },
    async saveChallenge(c){ const db = dLoad(); const id = c.id || rid("ch_");
      const next = Object.assign({}, db.challenges[id] || { createdAt: now() }, clone(c), { id, updatedAt: now() });
      next.media = cleanMedia(next.media); if(!next.media.some(m=> m.id === next.coverId)) next.coverId = next.media[0] ? next.media[0].id : "";
      checkContent("challenge", next);
      db.challenges[id] = next; dSave(db); return clone(next); },
    async deleteChallenge(id){ const db = dLoad(); delete db.challenges[id]; delete db.entries[id]; dSave(db); },
    async joinChallenge(id, data){ const db = dLoad(); const ch = db.challenges[id]; if(!ch) throw dErr("not-found", "Thử thách không còn tồn tại.");
      const u = me(); db.entries[id] = db.entries[id] || {};
      const prev = db.entries[id][u.uid];
      if(ds(new Date()) > ch.end) throw dErr("ended", "Thử thách đã kết thúc — không tham gia được nữa. Hãy chọn thử thách đang diễn ra nhé!");   // QC-05
      const d = obj(data), extra = {};
      if(Number(d.baseline) >= 30 && Number(d.baseline) <= 250){ extra.baseline = r1(d.baseline); extra.baselineTs = Number(d.baselineTs) || now(); }   // chỉ nhận trường cho phép
      db.entries[id][u.uid] = Object.assign({ value:0, weekValue:0, done:false }, prev || {}, extra, { uid:u.uid, name: cleanName(u.name), joinedAt: (prev||{}).joinedAt || now(), updatedAt: now() });
      dSave(db); return clone(db.entries[id][u.uid]); },
    async leaveChallenge(id){ const db = dLoad(); const u = me(); if(db.entries[id]) delete db.entries[id][u.uid]; dSave(db); },
    /* QC-01/QS-09: máy chủ không tin số tự khai — kẹp theo trần/ngày, khoá sau khi kết thúc + 48 giờ, bỏ qua người vào sau ngày kết thúc */
    async pushProgress(id, p){ const db = dLoad(); const u = me(); const ch = db.challenges[id]; const e = db.entries[id] && db.entries[id][u.uid]; if(!e || !ch) return null;
      if(joinedLate(ch, e) || now() > endOfDay(ch.end) + PUSH_GRACE_MS) return Object.assign(clone(e), { locked:true });
      const s = sanitizeProgress(ch, e, p, ds(new Date()));
      Object.assign(e, { value: s.value, week: s.week, weekValue: s.weekValue, done: s.done, manual: s.manual, flags: s.flags, name: cleanName(u.name), updatedAt: now(), pushedAt: now(), pushes: (Number(e.pushes)||0) + 1 });
      if(s.claimed != null) e.claimedMax = Math.max(Number(e.claimedMax)||0, s.claimed); else delete e.claimedMax;
      dSave(db); return clone(e); },
    async listEntries(id, todayS){ const db = dLoad(); const ch = db.challenges[id]; if(!ch) return [];
      const real = Object.values(db.entries[id] || {}).map(e=> Object.assign(clone(e), { name: cleanName(e.name) }));
      return real.concat(botEntries(ch, todayS || ds(new Date()))); },
    async myEntries(){ const db = dLoad(); const u = me(); const out = {}; for(const id in db.entries){ if(db.entries[id][u.uid]) out[id] = clone(db.entries[id][u.uid]); } return out; },
    /* ---- Sự kiện ---- */
    async listEvents(){ const db = dLoad(); return Object.values(db.events).map(e=>{ const x = clone(e); const regs = Object.values(db.regs[e.id]||{}).filter(r=> r.status !== "cancelled").length;
      delete x.checkinCode;                                     // QC-08: mã tại chỗ chỉ đọc qua getCheckinCode (quyền quản lý/điểm danh)
      x.regCount = Math.min(x.capacity || 1e9, (x.seedRegs||0) + regs);
      const all = arr(db.reviews[e.id]).map(r=> decoPost(db, e.id, r, "")), rv = all.filter(r=> r.kind !== "recap" && !hiddenPost(r));
      const rated = rv.filter(r=> !r.lowTrust);                 // review của tài khoản < 3 ngày tuổi vẫn hiện nhưng không vào điểm trung bình
      x.reviewCount = rv.length; x.momentCount = all.filter(r=> !hiddenPost(r)).length;
      x.rating = rated.length ? Math.round((rated.reduce((a,r)=> a + (Number(r.stars)||0), 0) / rated.length)*10)/10 : 0; return x; }); },
    async saveEvent(ev){ const db = dLoad(); const id = ev.id || rid("ev_"); const prev = db.events[id] || { createdAt: now(), checkinCode: genCode() };
      const next = Object.assign({}, prev, clone(ev), { id, updatedAt: now() });
      next.media = cleanMedia(next.media); if(!next.media.some(m=> m.id === next.coverId)) next.coverId = next.media[0] ? next.media[0].id : "";
      checkContent("event", next);
      delete next.reviewCount; delete next.momentCount; delete next.rating; delete next.regCount;
      db.events[id] = next; if(!next.checkinCode) next.checkinCode = genCode(); dSave(db); return clone(next); },
    async deleteEvent(id){ const db = dLoad(); const ev = db.events[id]; delete db.events[id]; delete db.regs[id];
      const inUse = new Set(); Object.values(db.events).forEach(e=> arr(e && e.media).forEach(m=> [m.src, m.thumb, m.poster].forEach(s=> s && inUse.add(s))));   // bản nhân bản dùng chung ảnh
      if(ev && !ev.seed) await dropMedia(arr(ev.media).filter(m=> !inUse.has(m.src))); for(const r of arr(db.reviews[id])) if(!/^bot_|^tapeasy$/.test(r.uid)) await dropMedia(r.media);
      delete db.reviews[id]; dSave(db); },
    async getCheckinCode(id){ const db = dLoad(); return (db.events[id] || {}).checkinCode || ""; },
    async register(evId, info){ const db = dLoad(); const ev = db.events[evId]; if(!ev) throw dErr("not-found", "Sự kiện không còn tồn tại.");
      const u = me(); db.regs[evId] = db.regs[evId] || {};
      const cur = db.regs[evId][u.uid];
      if(cur && cur.status !== "cancelled") return clone(cur);
      const taken = (ev.seedRegs||0) + Object.values(db.regs[evId]).filter(r=> r.status !== "cancelled").length;
      if(ev.capacity && taken >= ev.capacity) throw dErr("full", "Sự kiện đã đủ chỗ.");
      let code; const used = new Set(Object.values(db.regs[evId]).map(r=> r.code)); do{ code = genCode(); }while(used.has(code));
      db.regs[evId][u.uid] = Object.assign({}, clone(info||{}), { uid:u.uid, name: (info && info.name) || u.name, code, status:"registered", paid: !ev.fee, createdAt: now(), updatedAt: now() });
      dSave(db); return clone(db.regs[evId][u.uid]); },
    async cancelReg(evId){ const db = dLoad(); const u = me(); const r = db.regs[evId] && db.regs[evId][u.uid]; if(r){ r.status = "cancelled"; r.updatedAt = now(); dSave(db); } },
    async myRegs(){ const db = dLoad(); const u = me(); const out = {}; for(const id in db.regs){ const r = db.regs[id][u.uid]; if(r) out[id] = clone(r); } return out; },
    async listRegs(evId){ const db = dLoad(); const ev = db.events[evId]; if(!ev) return [];
      return Object.values(db.regs[evId]||{}).map(clone).concat(fakeRegs(ev)); },
    async checkIn(evId, code){ const db = dLoad(); const ev = db.events[evId]; const u = me();
      const r = db.regs[evId] && db.regs[evId][u.uid];
      if(!ev || !r || r.status === "cancelled") throw dErr("no-reg", "Bạn chưa đăng ký sự kiện này.");
      if(r.status === "checked_in") return clone(r);
      const want = String(ev.checkinCode||"").toUpperCase();
      if(!want || String(code||"").toUpperCase() !== want) throw dErr("bad-code", "Mã điểm danh không đúng. Hỏi lại ban tổ chức nhé.");
      checkWindow(ev);                                          // QC-08: mã đúng nhưng ngoài khung giờ sự kiện → báo giờ mở điểm danh
      Object.assign(r, { status:"checked_in", checkedInAt: now(), updatedAt: now(), method:"code" }); dSave(db); return clone(r); },
    async adminCheckIn(evId, ticketCode){ const db = dLoad(); const ev = db.events[evId]; if(!ev) throw dErr("not-found", "Không tìm thấy sự kiện.");
      checkWindow(ev);
      const code = String(ticketCode||"").toUpperCase();
      const r = Object.values(db.regs[evId]||{}).find(x=> x.code === code && x.status !== "cancelled");
      if(r){ if(r.status !== "checked_in"){ Object.assign(r, { status:"checked_in", checkedInAt: now(), updatedAt: now(), by:"admin" }); dSave(db); } return clone(r); }
      const f = fakeRegs(ev).find(x=> x.code === code);
      if(f) return Object.assign(f, { status:"checked_in", checkedInAt: now() });
      throw dErr("bad-ticket", "Vé không hợp lệ cho sự kiện này."); },
    async addReview(evId, rv){ const db = dLoad(); const u = me(); db.reviews[evId] = db.reviews[evId] || [];
      const r = db.regs[evId] && db.regs[evId][u.uid], ev = db.events[evId];
      if(!r || r.status !== "checked_in") throw dErr("no-checkin", "Chỉ người đã điểm danh mới viết được review.");
      if(ev && !validCheckin(ev, r)) throw dErr("no-checkin", "Lượt điểm danh không hợp lệ (ngoài giờ sự kiện) — chỉ người điểm danh tại sự kiện mới viết được review.");   // QC-08
      if(ev && now() < ciWindow(ev).start) throw dErr("too-early", "Sự kiện chưa bắt đầu — review sau khi tham gia nhé.");
      const clean = cleanPost(rv, "review"); checkContent("review", Object.assign({}, clean, { stars: rv && rv.stars }));
      const prev = db.reviews[evId].find(x=> x.uid === u.uid && x.kind !== "recap");   // 1 người 1 review — sửa giữ nguyên lượt thích/bình luận
      db.reviews[evId] = db.reviews[evId].filter(x=> x !== prev);
      const doc = Object.assign({}, clean, { id: prev ? prev.id : rid("rv"), uid:u.uid, name: cleanName(u.name), ts: now(), createdAt: prev ? (prev.createdAt || prev.ts) : now() });
      if(!trusted()) doc.lowTrust = true; else delete doc.lowTrust;
      if(prev && prev.hidden) doc.hidden = true;            // tác giả sửa bài không tự gỡ được lệnh ẩn của kiểm duyệt
      if(prev){ const old = new Set(arr(prev.media).map(m=> m.src)); clean.media.forEach(m=> old.delete(m.src)); await dropMedia(arr(prev.media).filter(m=> old.has(m.src))); }
      db.reviews[evId].push(doc); dSave(db); return decoPost(db, evId, doc, u.uid); },
    async listReviews(evId){ const db = dLoad(); const u = me(), mod = canMod();
      return arr(db.reviews[evId]).map(r=> decoPost(db, evId, r, u.uid)).filter(x=> mod || x.uid === u.uid || !hiddenPost(x)).sort((a,b)=> b.ts - a.ts); },
    /* ---- Bài đăng sau sự kiện (BTC) + bảng tin Khoảnh khắc ---- */
    async addPost(evId, p){ const db = dLoad(); const u = me(); if(!db.events[evId]) throw dErr("not-found", "Sự kiện không còn tồn tại.");
      if(!canDo("events.manage")) throw dErr("permission-denied", "Chỉ ban tổ chức (quyền quản lý sự kiện) mới đăng bài sau sự kiện.");
      const clean = cleanPost(p, "recap"); checkContent("recap", clean);
      db.reviews[evId] = arr(db.reviews[evId]);
      const prev = p && p.id ? db.reviews[evId].find(x=> x.id === p.id && x.kind === "recap") : null;
      const doc = Object.assign(prev || { id: rid("recap_"), createdAt: now() }, clean, { uid:u.uid, name: "TapEasy · " + u.name, staff:true, ts: now() });
      if(!prev) db.reviews[evId].push(doc); dSave(db); return decoPost(db, evId, doc, u.uid); },
    async deletePost(evId, pid){ const db = dLoad(); const u = me(); const r = findPost(db, evId, pid); if(!r) return;
      if(r.uid !== u.uid && !canMod() && !(r.kind === "recap" && canDo("events.manage"))) throw dErr("permission-denied", "Bạn chỉ xoá được bài của mình.");
      db.reviews[evId] = arr(db.reviews[evId]).filter(x=> x !== r); const key = `${evId}/${pid}`;
      delete db.mlikes[key]; delete db.mcomments[key]; delete db.mreports[key];
      if(!/^bot_|^tapeasy$/.test(r.uid)) await dropMedia(r.media); dSave(db); },
    async listMoments(opt){ opt = obj(opt); const db = dLoad(); const u = me(), mod = canMod(), out = [];
      for(const evId in db.reviews){ const ev = db.events[evId]; if(!ev || (ev.hidden && !canDo("events.manage"))) continue;
        arr(db.reviews[evId]).forEach(r=>{ const x = decoPost(db, evId, r, u.uid);
          if(!(arr(x.media).length || arr(x.photos).length)) return;                       // bảng tin chỉ gồm bài có ảnh/clip
          if(hiddenPost(x) && !(mod && opt.all) && x.uid !== u.uid) return;
          if(opt.evId && opt.evId !== evId) return;
          Object.assign(x, { evTitle: ev.title, evSport: ev.sport, evStart: ev.start, evCity: ev.city }); out.push(x); }); }
      out.sort((a,b)=> b.ts - a.ts); return out.slice(0, opt.limit || 60); },
    async toggleLike(evId, pid){ const db = dLoad(); const u = me(); const r = findPost(db, evId, pid); if(!r) throw dErr("not-found", "Bài đăng không còn tồn tại.");
      const key = `${evId}/${pid}`, L = db.mlikes[key] = obj(db.mlikes[key]); let liked;
      if(L[u.uid]){ delete L[u.uid]; liked = false; } else { L[u.uid] = now(); liked = true; }
      dSave(db); return { liked, likeCount: (Number(r.likeBase)||0) + Object.keys(L).length }; },
    async listComments(evId, pid){ const db = dLoad(); return arr(db.mcomments[`${evId}/${pid}`]).map(clone).sort((a,b)=> a.ts - b.ts); },
    async addComment(evId, pid, text){ const db = dLoad(); const u = me(); const r = findPost(db, evId, pid); if(!r) throw dErr("not-found", "Bài đăng không còn tồn tại.");
      const t = String(text||"").replace(/\s+/g, " ").trim(); if(t.length < 1 || t.length > 300) throw dErr("content", "Bình luận từ 1 đến 300 ký tự.");
      const key = `${evId}/${pid}`; db.mcomments[key] = arr(db.mcomments[key]);
      const c = { id: rid("c"), uid:u.uid, name:u.name, text:t, ts: now() }; db.mcomments[key].push(c); dSave(db); return clone(c); },
    async deleteComment(evId, pid, cid){ const db = dLoad(); const u = me(); const key = `${evId}/${pid}`; const L = arr(db.mcomments[key]); const c = L.find(x=> x.id === cid); if(!c) return;
      if(c.uid !== u.uid && !canMod()) throw dErr("permission-denied", "Bạn chỉ xoá được bình luận của mình.");
      db.mcomments[key] = L.filter(x=> x !== c); dSave(db); },
    async report(evId, pid, reason){ const db = dLoad(); const u = me(); const r = findPost(db, evId, pid); if(!r) throw dErr("not-found", "Bài đăng không còn tồn tại.");
      if(r.uid === u.uid) throw dErr("own", "Đây là bài của bạn — bạn có thể sửa hoặc xoá thay vì báo cáo.");
      const key = `${evId}/${pid}`, R = db.mreports[key] = obj(db.mreports[key]); const already = !!R[u.uid];
      const w = trusted() ? 1 : 0;                              // tài khoản < 3 ngày: báo cáo vẫn tới đội kiểm duyệt nhưng không tự ẩn bài
      if(!already) R[u.uid] = { reason: String(reason||"").slice(0, 200), ts: now(), w };
      r.reported = true; r.reportCount = Object.keys(R).length;
      r.reportWeight = Object.values(R).reduce((a, v)=> a + (v && v.w != null ? Number(v.w)||0 : 1), 0); dSave(db);
      return { already, reportCount: r.reportCount, reportWeight: r.reportWeight, counted: !already && w > 0, hidden: hiddenPost(r) }; },
    async moderate(evId, pid, action){ if(!canMod()) throw dErr("permission-denied", "Cần quyền kiểm duyệt cộng đồng.");
      const db = dLoad(); const r = findPost(db, evId, pid); if(!r) throw dErr("not-found", "Bài đăng không còn tồn tại.");
      const u = me();
      if(action === "delete"){ await demo.deletePost(evId, pid); return null; }
      if(action === "hide") Object.assign(r, { hidden:true, modOk:false });
      else if(action === "keep" || action === "restore") Object.assign(r, { hidden:false, modOk:true });
      else throw dErr("invalid", "Thao tác kiểm duyệt không hợp lệ.");
      Object.assign(r, { moderatedBy: u.uid, moderatedAt: now() }); dSave(db); return decoPost(db, evId, r, u.uid); },
    /* ---- Ảnh/clip: IndexedDB (không dùng localStorage) ---- */
    async newId(kind){ return rid(kind === "challenge" ? "ch_" : kind === "event" ? "ev_" : "m"); },
    async putMedia(path, blob){ const T = TMx(); if(!T || !T.idb) throw dErr("no-media", "Thiếu events-media.js — chưa lưu được ảnh/video.");
      const key = String(path).replace(/[^\w\-]+/g, "_").slice(-120);
      const where = await T.idb.put(key, blob);
      /* QC-10: IndexedDB thiếu/không phản hồi → ảnh chỉ nằm trong bộ nhớ tạm, mở lại app sẽ mất → báo lỗi để người dùng thử lại (không "thành công giả") */
      if(where !== "idb"){ try{ T.idb._mem && T.idb._mem.delete(key); }catch(e){} throw dErr("media-unsaved", "Máy chưa lưu được ảnh/video lâu dài (bộ nhớ trình duyệt không phản hồi). Bấm “Thử lại” sau vài giây, hoặc mở app bằng trình duyệt khác."); }
      return "idb:" + key; },
    async deleteMedia(src){ await dropMedia([{ src }]); },
    /* ---- Gian hàng ---- */
    async listProducts(){ const db = dLoad(); return Object.values(db.products).map(clone); },
    async saveProduct(p){ const db = dLoad(); const id = p.id || rid("p_"); db.products[id] = Object.assign({}, db.products[id] || { createdAt: now() }, clone(p), { id, updatedAt: now() }); dSave(db); return clone(db.products[id]); },
    async deleteProduct(id){ const db = dLoad(); delete db.products[id]; dSave(db); },
    /* QC-03/06 · QS-06/08: "máy chủ" tính lại giá từ danh mục, kiểm tồn kho + voucher, trừ kho trong cùng lần ghi.
       Từ chối nghiệp vụ → trả { ok:false, rejected:true, code, error } (không có status) để giao diện báo đúng lý do. */
    async placeOrder(o){ const db = dLoad(); const u = me(); o = obj(o);
      const pr = priceOrder(db, o, u.uid);
      if(!pr.ok) return { ok:false, rejected:true, code: pr.code, error: pr.error };
      const id = rid("o"), d = new Date(), code = `TE${p2(d.getDate())}${p2(d.getMonth()+1)}-${genCode(4)}`;
      const payVia = ["cod","bank","vietqr"].includes(o.payVia) ? o.payVia : (o.payment === "bank" ? "bank" : "cod");
      const payment = payVia === "cod" ? "cod" : "bank", status = payment === "bank" ? "awaiting_payment" : "pending";
      const items = pr.lines.map(l=> ({ pid:l.pid, name:l.name, color:l.color, colorName:l.colorName, size:l.size, qty:l.qty, price:l.price }));
      const doc = { id, code, uid:u.uid, items, subtotal: pr.subtotal, shipping: pr.shipping, discount: pr.discount, total: pr.total, voucher: pr.voucher ? { code: pr.voucher.code, title: pr.voucher.title } : null,
        voucherRef: pr.voucher ? { src: pr.voucher.src || "wallet", id: pr.voucher.id || "", code: pr.voucher.code || "" } : null,
        payment, payVia, shipMethod: o.shipMethod === "express" ? "express" : "standard", address: pr.addr, note: pr.addr.note, name: pr.addr.name,
        status, history:[{ s:status, ts: now() }], stockApplied:true, createdAt: now(), updatedAt: now() };
      const ct = Number(o.total);
      if(isFinite(ct) && Math.round(ct) !== pr.total){ doc.clientTotal = Math.round(ct); doc.priceMismatch = true; }   // cờ cho quản trị: máy khách khai giá khác
      if(pr.dropped) doc.droppedLines = pr.dropped;
      if(pr.lines.some(l=> l.legacy)) doc.variantGuessed = true;
      const touched = new Set(); pr.lines.forEach(l=>{ moveStock(l.p, [l], -1); touched.add(l.pid); });
      if(pr.voucher){
        if(pr.voucher.src === "admin"){ const C = db.vclaims[pr.voucher.code] = obj(db.vclaims[pr.voucher.code]); const cid = pr.voucher.claimId && C[pr.voucher.claimId] ? pr.voucher.claimId : rid("vc");
          C[cid] = Object.assign(C[cid] || { uid:u.uid, ts: now() }, { order:id, usedAt: now() });
          const A = adminVoucherStore(); if(A){ try{ const ad = A.load(); const v = obj(ad.vouchers)[pr.voucher.code]; if(v){ v.used = (Number(v.used)||0) + 1; A.save(ad); } }catch(e){} } }
        else db.vused[pr.voucher.id] = id;
      }
      db.orders[id] = doc; dSave(db); return clone(doc); },
    async myOrders(){ const db = dLoad(); const u = me(); return Object.values(db.orders).filter(o=> o.uid === u.uid).map(clone).sort((a,b)=> b.createdAt - a.createdAt); },
    async allOrders(){ const db = dLoad(); return Object.values(db.orders).map(clone).sort((a,b)=> b.createdAt - a.createdAt); },
    /* QC-07: máy trạng thái + cờ stockApplied → huỷ chỉ hoàn kho 1 lần; mở lại đơn đã huỷ = trừ kho lại (thiếu hàng thì từ chối) */
    async updateOrder(id, partial){ const db = dLoad(); const o = db.orders[id]; if(!o) throw dErr("not-found", "Không tìm thấy đơn.");
      partial = obj(partial); const patch = {};
      ["note","tracking","carrier","adminNote","paid","paidAt","refund","refundedAt"].forEach(k=>{ if(partial[k] !== undefined) patch[k] = typeof partial[k] === "string" ? str(partial[k], 200) : clone(partial[k]); });
      const to = partial.status;
      if(to && to !== o.status){
        if(!ORDER_FLOW[to]) throw dErr("bad-status", "Trạng thái đơn không hợp lệ.");
        if(!(ORDER_FLOW[o.status] || []).includes(to)) throw dErr("bad-transition", "Không chuyển đơn từ “" + o.status + "” sang “" + to + "” được.");
        const applied = o.stockApplied !== false;          // đơn cũ (trước bản sửa) coi như đã trừ kho
        const lines = arr(o.items).map(it=>{ const p = db.products[it.pid]; const k = vkey(it.color, it.size); return { pid: it.pid, k: p && p.stockBy && !(k in p.stockBy) ? null : k, qty: Math.max(0, Math.round(Number(it.qty)||0)), p }; }).filter(l=> l.p && l.k != null && l.qty > 0);
        if(to === "cancelled" && applied){ lines.forEach(l=> moveStock(l.p, [l], +1)); patch.stockApplied = false; }
        /* huỷ đơn CHƯA xác nhận → trả lượt voucher đúng 1 lần (khớp Function orderStockSync) */
        if(to === "cancelled" && ["pending","awaiting_payment"].includes(o.status) && o.voucherRef && !o.voucherRestored){
          const R = o.voucherRef;
          if(R.src === "admin"){ const C = obj(db.vclaims[R.code]); Object.keys(C).forEach(cid=>{ if(C[cid] && C[cid].order === id) delete C[cid]; });
            const A = adminVoucherStore(); if(A){ try{ const ad = A.load(); const v = obj(ad.vouchers)[R.code]; if(v){ v.used = Math.max(0, (Number(v.used)||0) - 1); A.save(ad); } }catch(e){} } }
          else if(R.id && db.vused[R.id] === id) delete db.vused[R.id];
          patch.voucherRestored = true;
        }
        else if(o.status === "cancelled" && STOCK_STATUSES.includes(to) && !applied){
          const short = lines.find(l=> availOf(l.p, l.k) < l.qty);
          if(short) throw dErr("stock", `Không đủ tồn kho để mở lại đơn (${short.p.name || short.pid}: còn ${availOf(short.p, short.k)}).`);
          lines.forEach(l=> moveStock(l.p, [l], -1)); patch.stockApplied = true;
        }
        patch.status = to; o.history = arr(o.history).concat([{ s: to, ts: now() }]);
      }
      Object.assign(o, patch, { updatedAt: now() }); dSave(db); return clone(o); },
    async cancelOrder(id){ const db = dLoad(); const o = db.orders[id]; const u = me();
      if(!o || o.uid !== u.uid) throw dErr("not-found", "Không tìm thấy đơn.");
      if(!["pending","awaiting_payment"].includes(o.status)) throw dErr("locked", "Đơn đã được xác nhận — liên hệ hotline để huỷ.");
      return demo.updateOrder(id, { status:"cancelled" }); },
    /* Mã giảm giá toàn hệ thống: "giữ chỗ" 1 lượt khi áp vào giỏ (30 phút) → tiêu thụ khi đặt đơn. uses:1 = đúng 1 đơn trên mọi máy */
    async claimVoucher(code, spec){ const db = dLoad(); const u = me();
      code = String(code||"").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
      const adm = adminVoucher(code) || (spec && typeof spec === "object" ? spec : null), today = ds(new Date());
      if(!adm || adm.revoked || (adm.exp && adm.exp < today)) return { ok:false, error:"Mã không hợp lệ hoặc đã hết hạn" };
      const C = db.vclaims[code] = obj(db.vclaims[code]); pruneClaims(C);
      const active = Object.keys(C).filter(id=> !C[id].order).length;
      if((Number(adm.used)||0) + active >= (Number(adm.uses)||1)) return { ok:false, error: active ? "Mã đã hết lượt (đang được giữ cho một đơn khác — thử lại sau 30 phút)" : "Mã đã hết lượt dùng" };
      const id = rid("vc"); C[id] = { uid:u.uid, ts: now() }; dSave(db);
      return { ok:true, claimId:id, code, until: now() + 30*60e3 }; },
    async releaseVoucher(code, claimId){ const db = dLoad(); const u = me(); const C = obj(db.vclaims[String(code||"").toUpperCase()]);
      if(C[claimId] && !C[claimId].order && C[claimId].uid === u.uid){ delete C[claimId]; dSave(db); } return true; },
    signVoucher(v){ const db = dLoad(); return signSpec(db, v); },
    async redeemPoints(){ return null; },                         // demo: sổ điểm trên máy (events.js) — Firebase: callable redeemPoints
    /* integrator (FIX-security vòng 2 #2): demo — voucher hoàn thành thử thách cấp trên máy (events.js settleAll) → không có bản ghi máy chủ */
    async claimChallengeVoucher(){ return null; },
    async myVouchers(){ return []; },
    /* ---- Quà tặng ---- */
    async myGifts(){ const db = dLoad(); const u = me(); return Object.values(db.gifts).filter(g=> g.uid === u.uid).map(clone).sort((a,b)=> b.createdAt - a.createdAt); },
    async allGifts(){ const db = dLoad(); return Object.values(db.gifts).map(clone).sort((a,b)=> b.createdAt - a.createdAt); },
    async createGift(g){ const db = dLoad(); const key = g.key || rid("g");
      if(db.gifts[key]) return clone(db.gifts[key]);                          // chống trao trùng (key = nguồn + người nhận)
      db.gifts[key] = Object.assign({ status:"new", freeShip:true }, clone(g), { id:key, createdAt: now(), updatedAt: now() }); dSave(db); return clone(db.gifts[key]); },
    async updateGift(id, partial){ const db = dLoad(); const g = db.gifts[id]; if(!g) throw dErr("not-found", "Không tìm thấy quà.");
      Object.assign(g, clone(partial), { updatedAt: now() }); dSave(db); return clone(g); },
    /* chỉ dùng cho kiểm thử / quản trị demo */
    _db: dLoad, _save: dSave, _reset(){ localStorage.removeItem(DEMO_KEY); },
  };

  /* =====================================================================
     ĐỘNG CƠ FIREBASE (Firestore compat, dùng firebase.firestore() toàn cục)
     ===================================================================== */
  let fs = null;
  /* QS-02 (cùng mẫu cloud.js): trường "id" trong dữ liệu KHÔNG được ghi đè doc.id (id chèn vào thuộc tính data-id) */
  const qData = q => q.docs.map(d=> Object.assign({}, d.data(), { id: d.id }));
  const docData = d => d.exists ? Object.assign({}, d.data(), { id: d.id }) : null;
  function needUser(){ let u = null; try{ u = cloud.user; }catch(e){} if(!u) throw dErr("auth", "Hãy đăng nhập để dùng tính năng này."); return me(); }
  function strip(o){ const x = Object.assign({}, o); delete x.id; Object.keys(x).forEach(k=> x[k] === undefined && delete x[k]); return x; }

  /* đánh dấu "mình đã thích" (collectionGroup mlikes theo uid) + chuẩn hoá bài đăng Firestore */
  const _marks = { mlikes:null, ts:0 };
  async function myMarks(kind){ const u = cloud.user; if(!u) return new Set(); if(_marks[kind] && Date.now() - _marks.ts < 30000) return _marks[kind];
    try{ const snap = await fs.collectionGroup(kind).where("uid","==",u.uid).limit(500).get();
      const s = new Set(); snap.docs.forEach(d=>{ const p = d.ref.path.split("/"); if(p[0] === "events" && p[2] === "reviews") s.add(p[1] + "/" + p[3]); });
      _marks[kind] = s; _marks.ts = Date.now(); return s; }catch(e){ return new Set(); } }
  function fireDeco(r, evId, liked){ const x = Object.assign({}, r); x.evId = evId; x.kind = x.kind || "review";
    x.likeCount = Math.max(0, Number(r.likeCount)||0); x.commentCount = Math.max(0, Number(r.commentCount)||0); x.reportCount = Math.max(0, Number(r.reportCount)||0);
    x.liked = !!(liked && liked.has(evId + "/" + r.id)); return x; }
  /* Gọi Cloud Function (callable). Chưa triển khai / không có SDK functions → { ok:false } để dùng đường dự phòng; lỗi nghiệp vụ → ném lỗi tiếng Việt */
  /* FIX-security #4 (vòng 2): đường dự phòng "ghi thẳng" khi Function chưa triển khai đã bỏ — rules từ chối, nên báo rõ thay vì ghi */
  const SERVER_NEEDED = "Cần máy chủ — thử lại sau";
  async function sha256hex(s){ try{ const c = (typeof crypto !== "undefined" && crypto && crypto.subtle) ? crypto.subtle : null; if(!c || typeof TextEncoder === "undefined") return "";
    const b = await c.digest("SHA-256", new TextEncoder().encode(String(s))); return Array.from(new Uint8Array(b), x=> x.toString(16).padStart(2, "0")).join(""); }catch(e){ return ""; } }
  async function callFn(name, data){
    let call = null;
    try{ if(typeof firebase !== "undefined" && typeof firebase.app === "function" && typeof firebase.app().functions === "function") call = firebase.app().functions("asia-southeast1").httpsCallable(name); }catch(e){ call = null; }
    if(!call) return { ok:false, missing:true };
    try{ const res = await call(data || {}); return { ok:true, data: res && res.data }; }
    catch(e){ const c = String(e && e.code || "").replace(/^functions\//, "");
      if(["not-found","unimplemented","internal","unavailable"].includes(c)) return { ok:false, error:e };
      throw dErr(c || "fn", (e && e.message) || "Máy chủ từ chối yêu cầu."); }
  }
  let _st = null;
  function loadJS(src){ return new Promise((res, rej)=>{ try{ const s = document.createElement("script"); s.src = src; s.async = true; s.onload = ()=> res(); s.onerror = ()=> rej(dErr("unavailable", "Không tải được thư viện lưu ảnh (Firebase Storage) — kiểm tra mạng rồi thử lại.")); document.head.appendChild(s); }catch(e){ rej(e); } }); }
  async function storage(){ if(_st) return _st; if(typeof firebase.storage !== "function") await loadJS(`https://www.gstatic.com/firebasejs/${firebase.SDK_VERSION || "10.12.2"}/firebase-storage-compat.js`); _st = firebase.storage(); return _st; }

  const fire = {
    name:"firebase",
    async init(){ fs = firebase.firestore(); },
    // vòng 3: rules dùng hasPerm() (claims + roles/{uid}) — collection admins/{uid} không còn cấp quyền
    async isAdmin(){ try{ const R = rbacX(); if(R) return !!R.legacyAdmin(); const u = cloud.user; if(!u) return false; return (await fs.collection("admins").doc(u.uid).get()).exists; }catch(e){ return false; } },
    async listChallenges(){ return qData(await fs.collection("challenges").get()); },
    async saveChallenge(c){ const ref = c.id ? fs.collection("challenges").doc(c.id) : fs.collection("challenges").doc(); const data = Object.assign(strip(c), { updatedAt: now() }); if(!c.id) data.createdAt = now();
      data.media = cleanMedia(data.media); if(!data.media.some(m=> m.id === data.coverId)) data.coverId = data.media[0] ? data.media[0].id : ""; checkContent("challenge", data);
      await ref.set(data, { merge:true }); return Object.assign({ id: ref.id }, data); },
    async deleteChallenge(id){ await fs.collection("challenges").doc(id).delete(); },
    async joinChallenge(id, data){ const u = needUser(); const ref = fs.collection("challenges").doc(id).collection("entries").doc(u.uid);
      const ch = docData(await fs.collection("challenges").doc(id).get()); if(!ch) throw dErr("not-found", "Thử thách không còn tồn tại.");
      if(ds(new Date()) > ch.end) throw dErr("ended", "Thử thách đã kết thúc — không tham gia được nữa. Hãy chọn thử thách đang diễn ra nhé!");   // rules: request.time < endAt (QS-09)
      const prev = docData(await ref.get()), d = obj(data), extra = {};
      if(prev){ const nm = cleanName(u.name); if(nm && nm !== prev.name) await ref.update({ name: nm, updatedAt: now() }); return Object.assign({}, prev, { name: nm || prev.name }); }   // rules: bản ghi cũ chỉ đổi được tên
      if(Number(d.baseline) >= 30 && Number(d.baseline) <= 250){ extra.baseline = r1(d.baseline); extra.baselineTs = Number(d.baselineTs) || now(); }
      const doc = Object.assign({ value:0, weekValue:0, done:false }, prev ? strip(prev) : {}, extra, { uid:u.uid, name: cleanName(u.name), joinedAt: prev && prev.joinedAt || now(), updatedAt: now() });
      await ref.set(doc); return doc; },
    async leaveChallenge(id){ const u = needUser(); await fs.collection("challenges").doc(id).collection("entries").doc(u.uid).delete(); },
    /* Máy khách cũng kẹp số như "máy chủ" demo; bản chốt thật do Cloud Function onEntryWrite tính lại (docs/qa/FIX-commerce.md) */
    async pushProgress(id, p){ const u = needUser(); const ref = fs.collection("challenges").doc(id).collection("entries").doc(u.uid);
      const [ch, e] = await Promise.all([fs.collection("challenges").doc(id).get().then(docData), ref.get().then(docData)]);
      if(!ch || !e) return null;
      if(joinedLate(ch, e) || now() > endOfDay(ch.end) + PUSH_GRACE_MS) return Object.assign({}, e, { locked:true });
      const s = sanitizeProgress(ch, e, p, ds(new Date()));
      /* QS-09/QC-01: rules chỉ cho Cloud Function ghi tiến độ — gửi số đã kẹp, máy chủ kẹp lại theo trần/ngày (capAggregate) */
      const fn = await callFn("recordChallengeProgress", { challengeId: id, value: s.value, weekValue: s.weekValue, week: s.week, manual: s.manual, baseline: Number(e.baseline) || undefined });
      if(fn.ok) return Object.assign({}, s, obj(fn.data));
      /* FIX-security #4: rules không cho client ghi value/weekValue → không ghi thẳng; lần đồng bộ sau thử lại */
      throw dErr("server-needed", SERVER_NEEDED + " (ghi tiến độ thử thách)"); },
    async listEntries(id){ const snap = await fs.collection("challenges").doc(id).collection("entries").orderBy("value","desc").limit(200).get(); return qData(snap).map(e=> Object.assign(e, { uid: e.uid || e.id, name: cleanName(e.name) })); },
    async myEntries(){ const u = needUser(); const out = {};
      const snap = await fs.collectionGroup("entries").where("uid","==",u.uid).get();
      snap.docs.forEach(d=>{ const chId = d.ref.parent.parent.id; out[chId] = Object.assign({}, d.data(), { id:d.id }); }); return out; },
    async listEvents(){ return qData(await fs.collection("events").get()).map(e=>{ delete e.checkinCode; return e; }); },
    /* FIX-security #4 (vòng 2): KHÔNG lưu mã điểm danh dạng rõ. Ưu tiên mã XOAY VÒNG 60 giây (Function checkinCodeNow tạo secret
       chỉ máy chủ đọc; checkInEvent so mã). Function chưa triển khai → lưu BĂM codeHash = sha256(id:code) (checkInEvent so băm),
       xoá trường `code` rõ cũ; ô mã để trống khi sửa = giữ mã cũ. */
    async saveEvent(ev){ const ref = ev.id ? fs.collection("events").doc(ev.id) : fs.collection("events").doc();
      const data = Object.assign(strip(ev), { updatedAt: now() });
      const want = String(data.checkinCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); delete data.checkinCode;
      ["regCount","reviewCount","momentCount","rating"].forEach(k=> delete data[k]);   // bộ đếm do máy chủ/Cloud Function giữ
      data.media = cleanMedia(data.media); if(!data.media.some(m=> m.id === data.coverId)) data.coverId = data.media[0] ? data.media[0].id : ""; checkContent("event", data);
      if(!ev.id) data.createdAt = now();
      await ref.set(data, { merge:true });
      const pref = ref.collection("private").doc("checkin");
      const cn = await callFn("checkinCodeNow", { eventId: ref.id });
      if(cn.ok && cn.data && cn.data.code){
        try{ await pref.set({ code: firebase.firestore.FieldValue.delete() }, { merge:true }); }catch(e){}
        return Object.assign({ id: ref.id, checkinCode: String(cn.data.code), checkinRotating: true, checkinExpiresAt: Number(cn.data.expiresAt) || 0 }, data);
      }
      const code = want || (ev.id ? "" : genCode());
      if(code){ const h = await sha256hex(`${ref.id}:${code}`);
        if(!h) throw dErr("unavailable", "Máy này không tạo được mã điểm danh an toàn (thiếu WebCrypto). Mở bằng trình duyệt mới hơn rồi thử lại.");
        await pref.set({ codeHash: h, code: firebase.firestore.FieldValue.delete(), updatedAt: now() }, { merge:true }); }
      return Object.assign({ id: ref.id, checkinCode: code, checkinRotating: false }, data); },
    async deleteEvent(id){ await fs.collection("events").doc(id).delete(); },
    async checkinInfo(id){
      const cn = await callFn("checkinCodeNow", { eventId: id });
      if(cn.ok && cn.data && cn.data.code) return { code: String(cn.data.code), rotating: true, expiresAt: Number(cn.data.expiresAt) || 0 };
      const d = await fs.collection("events").doc(id).collection("private").doc("checkin").get(); const p = d.exists ? obj(d.data()) : {};
      return { code: p.code ? String(p.code) : "", rotating: false, hidden: !p.code && !!p.codeHash };   // mã cũ dạng rõ (trước bản sửa) vẫn đọc được
    },
    async getCheckinCode(id){ return (await fire.checkinInfo(id)).code; },
    async register(evId, info){ const u = needUser(); const ref = fs.collection("events").doc(evId).collection("regs").doc(u.uid);
      const prev = docData(await ref.get()); if(prev && prev.status !== "cancelled") return prev;
      /* QC-19: sức chứa chỉ đáng tin khi máy chủ giữ regCount — callable "registerEvent" (transaction) nếu đã triển khai */
      const inf = obj(info), fn = await callFn("registerEvent", { evId, info: { name: cleanName(inf.name), phone: String(inf.phone||"").replace(/[^\d+]/g, "").slice(0, 14), option: str(inf.option, 60), sos: str(inf.sos, 80), note: str(inf.note, 120) } });
      if(fn.ok) return fn.data;
      /* FIX-security #4: rules không cho client tự tạo regs (sức chứa do máy chủ giữ) → không ghi thẳng, báo cần máy chủ */
      throw dErr("server-needed", SERVER_NEEDED + " (đăng ký sự kiện)"); },
    async cancelReg(evId){ const u = needUser(); await fs.collection("events").doc(evId).collection("regs").doc(u.uid).update({ status:"cancelled", updatedAt: now() }); },
    async myRegs(){ const u = needUser(); const out = {}; const snap = await fs.collectionGroup("regs").where("uid","==",u.uid).get();
      snap.docs.forEach(d=>{ out[d.ref.parent.parent.id] = Object.assign({}, d.data(), { id:d.id }); }); return out; },
    async listRegs(evId){ return qData(await fs.collection("events").doc(evId).collection("regs").get()); },
    async checkIn(evId, code){ const u = needUser(); const ref = fs.collection("events").doc(evId).collection("regs").doc(u.uid);
      const ev = docData(await fs.collection("events").doc(evId).get()); if(!ev) throw dErr("not-found", "Không tìm thấy sự kiện.");
      checkWindow(ev);                                          // báo sớm phía máy; máy chủ kiểm lại khung giờ
      /* QC-08: rules không cho học viên tự ghi checked_in — Function checkInEvent so mã (băm / mã xoay vòng 60 giây) + cộng điểm */
      const fn = await callFn("checkInEvent", { eventId: evId, code: String(code||"").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) });
      if(!fn.ok) throw dErr("unavailable", "Điểm danh bằng mã tạm thời chưa dùng được — nhờ ban tổ chức quét vé QR của bạn nhé.");
      return docData(await ref.get()) || { status:"checked_in", checkedInAt: now() }; },
    async adminCheckIn(evId, ticketCode){ const snap = await fs.collection("events").doc(evId).collection("regs").where("code","==",String(ticketCode||"").toUpperCase()).limit(1).get();
      if(snap.empty) throw dErr("bad-ticket", "Vé không hợp lệ cho sự kiện này.");
      const d = snap.docs[0]; const data = d.data(); if(data.status === "cancelled") throw dErr("bad-ticket", "Vé đã bị huỷ.");
      if(data.status !== "checked_in") await d.ref.update({ status:"checked_in", checkedInAt: now(), by:"admin" });
      return Object.assign({}, data, { id:d.id, status:"checked_in" }); },
    async addReview(evId, rv){ const u = needUser(); const col = fs.collection("events").doc(evId).collection("reviews");
      const [ev, reg] = await Promise.all([fs.collection("events").doc(evId).get().then(docData), fs.collection("events").doc(evId).collection("regs").doc(u.uid).get().then(docData)]);
      if(!reg || reg.status !== "checked_in" || (ev && !validCheckin(ev, reg))) throw dErr("no-checkin", "Chỉ người đã điểm danh tại sự kiện mới viết được review.");
      const clean = cleanPost(rv, "review"); checkContent("review", Object.assign({}, clean, { stars: rv && rv.stars }));
      const doc = Object.assign({}, clean, { uid:u.uid, name: cleanName(u.name), ts: now(), lowTrust: !trusted() });
      await col.doc(u.uid).set(doc, { merge:true });                   // merge: giữ bộ đếm thích/bình luận khi sửa review
      return Object.assign({ id:u.uid, evId }, doc); },
    async listReviews(evId){ const u = cloud.user, liked = u ? await myMarks("mlikes") : new Set(), mod = canMod();
      return qData(await fs.collection("events").doc(evId).collection("reviews").orderBy("ts","desc").limit(50).get())
        .map(r=> fireDeco(r, evId, liked)).filter(x=> mod || (u && x.uid === u.uid) || !hiddenPost(x)); },
    /* ---- Bài đăng sau sự kiện + Khoảnh khắc (thích, bình luận, báo cáo, kiểm duyệt) ---- */
    async addPost(evId, p){ const u = needUser(); const clean = cleanPost(p, "recap"); checkContent("recap", clean);
      const ref = fs.collection("events").doc(evId).collection("reviews").doc(p && p.id && /^recap_/.test(p.id) ? p.id : "recap_" + rid(""));
      const doc = Object.assign({}, clean, { uid:u.uid, name:"TapEasy · " + u.name, staff:true, ts: now() }); await ref.set(doc, { merge:true }); return Object.assign({ id: ref.id, evId }, doc); },
    async deletePost(evId, pid){ await fs.collection("events").doc(evId).collection("reviews").doc(pid).delete(); },   // Cloud Function dọn likes/comments/reports + tệp Storage
    async listMoments(opt){ opt = obj(opt); const u = cloud.user, mod = canMod();
      let q = fs.collectionGroup("reviews").orderBy("ts","desc").limit(opt.limit || 60);
      const [snap, liked] = await Promise.all([q.get(), u ? myMarks("mlikes") : Promise.resolve(new Set())]);
      return snap.docs.map(d=> fireDeco(Object.assign({}, d.data(), { id:d.id }), d.ref.parent.parent.id, liked))
        .filter(x=> (arr(x.media).length || arr(x.photos).length) && (!opt.evId || x.evId === opt.evId) && (!hiddenPost(x) || (mod && opt.all) || (u && x.uid === u.uid))); },
    async toggleLike(evId, pid){ const u = needUser(); const rref = fs.collection("events").doc(evId).collection("reviews").doc(pid), lref = rref.collection("mlikes").doc(u.uid);
      const inc = firebase.firestore.FieldValue.increment;
      const liked = await fs.runTransaction(async t=>{ const r = await t.get(rref); if(!r.exists) throw dErr("not-found", "Bài đăng không còn tồn tại."); const l = await t.get(lref);
        if(l.exists){ t.delete(lref); t.update(rref, { likeCount: inc(-1) }); return false; } t.set(lref, { uid:u.uid, ts: now() }); t.update(rref, { likeCount: inc(1) }); return true; });
      _marks.mlikes = null; const r = docData(await rref.get()); return { liked, likeCount: Math.max(0, Number(r && r.likeCount) || 0) }; },
    async listComments(evId, pid){ return qData(await fs.collection("events").doc(evId).collection("reviews").doc(pid).collection("mcomments").orderBy("ts","asc").limit(200).get()); },
    async addComment(evId, pid, text){ const u = needUser(); const t = String(text||"").replace(/\s+/g, " ").trim(); if(t.length < 1 || t.length > 300) throw dErr("content", "Bình luận từ 1 đến 300 ký tự.");
      const rref = fs.collection("events").doc(evId).collection("reviews").doc(pid), cref = rref.collection("mcomments").doc(), c = { uid:u.uid, name:u.name, text:t, ts: now() };
      const b = fs.batch(); b.set(cref, c); b.update(rref, { commentCount: firebase.firestore.FieldValue.increment(1) }); await b.commit(); return Object.assign({ id: cref.id }, c); },
    async deleteComment(evId, pid, cid){ const rref = fs.collection("events").doc(evId).collection("reviews").doc(pid);
      const b = fs.batch(); b.delete(rref.collection("mcomments").doc(cid)); b.update(rref, { commentCount: firebase.firestore.FieldValue.increment(-1) }); await b.commit(); },
    /* integrator (FIX-security vòng 2 #1): rules chỉ nhận mreports/{uid} = { uid, reason, ts } + bài { reportCount +1, reported } —
       KHÔNG ghi trọng số (w / reportWeight: Function momentReportHeal tính theo tuổi tài khoản, tự ẩn khi ≥ 3) và KHÔNG đọc mreports
       (chỉ kiểm duyệt đọc được → đọc trong transaction bị từ chối). Báo cáo lần 2: rules từ chối (doc đã có) → coi là "đã báo cáo". */
    async report(evId, pid, reason){ const u = needUser(); const rref = fs.collection("events").doc(evId).collection("reviews").doc(pid), pref = rref.collection("mreports").doc(u.uid);
      let d0 = null;
      try{
        const res = await fs.runTransaction(async t=>{ const r = await t.get(rref); if(!r.exists) throw dErr("not-found", "Bài đăng không còn tồn tại."); const d = d0 = r.data();
          if(d.uid === u.uid) throw dErr("own", "Đây là bài của bạn — bạn có thể sửa hoặc xoá thay vì báo cáo.");
          const n = (Number(d.reportCount)||0) + 1, w = trusted() ? 1 : 0, wt = repWeight(d) + w;   // ước tính để vẽ ngay — số thật do Function ghi
          t.set(pref, { uid:u.uid, reason: String(reason||"").slice(0, 200), ts: now() });
          t.update(rref, { reportCount: firebase.firestore.FieldValue.increment(1), reported:true });
          return { already:false, reportCount: n, reportWeight: wt, counted: w > 0, hidden: hiddenPost(Object.assign({}, d, { reportCount: n, reportWeight: wt })) }; });
        return res;
      }catch(e){
        if(d0 && String(e && e.code || "").replace(/^firestore\//, "") === "permission-denied")
          return { already:true, reportCount: Number(d0.reportCount)||0, reportWeight: repWeight(d0), counted:false, hidden: hiddenPost(d0) };
        throw e;
      } },
    async moderate(evId, pid, action){ const u = needUser(); const rref = fs.collection("events").doc(evId).collection("reviews").doc(pid);
      if(action === "delete"){ await rref.delete(); return null; }
      if(!["hide","keep","restore"].includes(action)) throw dErr("invalid", "Thao tác kiểm duyệt không hợp lệ.");
      await rref.update({ hidden: action === "hide", modOk: action !== "hide", moderatedBy: u.uid, moderatedAt: now() });
      return fireDeco(docData(await rref.get()), evId, new Set()); },
    /* ---- Ảnh/clip → Firebase Storage (tải SDK storage-compat khi cần) ---- */
    async newId(kind){ return fs.collection(kind === "challenge" ? "challenges" : "events").doc().id; },
    async putMedia(path, blob, meta){ const st = await storage(); const ref = st.ref().child("media/" + String(path).replace(/[^\w\-\/.]+/g, "_"));
      const snap = await ref.put(blob, { contentType: (meta && meta.contentType) || blob.type || "application/octet-stream", cacheControl:"public,max-age=31536000" });
      return await snap.ref.getDownloadURL(); },
    async deleteMedia(src){ if(!/^https:\/\/firebasestorage\.googleapis\.com\//.test(String(src||""))) return; try{ const st = await storage(); await st.refFromURL(src).delete(); }catch(e){} },
    async listProducts(){ return qData(await fs.collection("products").get()); },
    async saveProduct(p){ const ref = p.id ? fs.collection("products").doc(p.id) : fs.collection("products").doc(); const data = Object.assign(strip(p), { updatedAt: now() }); if(!p.id) data.createdAt = now(); await ref.set(data, { merge:true }); return Object.assign({ id:ref.id }, data); },
    async deleteProduct(id){ await fs.collection("products").doc(id).delete(); },
    /* Ưu tiên callable "placeOrder" (Cloud Function tính giá/tồn kho/voucher trong transaction — FIX-commerce §Chuyển giao).
       Chưa triển khai Function → ghi đơn đã chuẩn hoá (giá lấy từ products, SL nguyên 1–10); trigger onCreate orders đối soát lại. */
    async placeOrder(o){ const u = needUser(); o = obj(o);
      const V = o.voucher && typeof o.voucher === "object" ? o.voucher : null;
      if(V && V.src !== "admin" && !V.server) return { ok:false, rejected:true, code:"voucher", error:"Voucher này chưa được máy chủ xác nhận — bỏ chọn voucher rồi đặt lại (điểm/quà chưa đồng bộ lên máy chủ)." };
      const payload = { items: arr(o.items).slice(0, 30).map(i=> ({ pid: String(obj(i).pid||""), color: String(obj(i).color||""), size: String(obj(i).size||""), qty: Number(obj(i).qty) })),
        voucher: V ? { code: String(V.code||""), claimId: String(V.claimId||"") } : null, payVia: o.payVia, shipMethod: o.shipMethod, address: cleanAddr(o.address), note: str(o.note, 120), clientTotal: Number(o.total)||0 };
      const fn = await callFn("placeOrder", payload);
      if(fn.ok) return fn.data && fn.data.rejected ? { ok:false, rejected:true, code: fn.data.code, error: fn.data.error } : fn.data;
      /* rules: orders create = false → không còn đường ghi thẳng. Function chưa triển khai / lỗi tạm → báo rõ, giữ giỏ */
      return { ok:false, rejected:true, code:"server-needed", error: SERVER_NEEDED + ". Cửa hàng chưa nhận được đơn — giỏ hàng vẫn được giữ." }; },
    async myOrders(){ const u = needUser(); return qData(await fs.collection("orders").where("uid","==",u.uid).get()).sort((a,b)=> b.createdAt - a.createdAt); },
    async allOrders(){ return qData(await fs.collection("orders").orderBy("createdAt","desc").limit(500).get()); },
    async updateOrder(id, partial){ const ref = fs.collection("orders").doc(id); const cur = docData(await ref.get()); if(!cur) throw dErr("not-found", "Không tìm thấy đơn.");
      partial = obj(partial); const data = {};
      ["note","tracking","status"].forEach(k=>{ if(partial[k] !== undefined) data[k] = typeof partial[k] === "string" ? str(partial[k], 200) : partial[k]; });   // khớp rules orders.update (onlyKeys)
      if(cur.status === "cancelled" && data.status && data.status !== "cancelled") throw dErr("bad-transition", "Đơn đã huỷ là trạng thái cuối — tạo đơn mới nếu khách muốn mua lại.");   // QC-07
      if(data.status && data.status !== cur.status){
        if(!(ORDER_FLOW[cur.status] || []).includes(data.status)) throw dErr("bad-transition", "Không chuyển đơn từ “" + cur.status + "” sang “" + data.status + "” được.");
        data.history = (cur.history||[]).concat([{ s: data.status, ts: now() }]);   // hoàn/trừ kho: trigger onUpdate orders (cờ stockApplied)
      }
      data.updatedAt = now(); await ref.update(data); return Object.assign(cur, data); },
    async claimVoucher(code, spec){ const fn = await callFn("claimVoucher", { code }); if(fn.ok) return fn.data;
      return { ok:true, claimId:"", code: String(code||"").toUpperCase(), server:false };   // Function chưa triển khai: kiểm lượt khi tạo đơn (onCreate orders)
    },
    async releaseVoucher(){ return true; },
    signVoucher(){ return ""; },
    /* QC-02: đổi điểm = callable redeemPoints (trừ điểm trong transaction + vouchers/{code} 1 lượt) → voucher máy chủ; chưa triển khai → null */
    async redeemPoints(rewardId){ const fn = await callFn("redeemPoints", { rewardId: String(rewardId||"").slice(0, 20) }); return fn.ok ? obj(fn.data) : null; },
    /* integrator (FIX-security vòng 2 #2): voucher hoàn thành thử thách = bản ghi MÁY CHỦ vouchers/{code} (Function claimChallengeVoucher,
       idempotent theo voucherGrants/fin_{ch}_{uid}). Function chưa triển khai → { ok:false, pending:true } (thử lại lần sau, không cấp voucher trên máy). */
    async claimChallengeVoucher(chId){ const fn = await callFn("claimChallengeVoucher", { challengeId: String(chId||"").slice(0, 128) });
      return fn.ok ? obj(fn.data) : { ok:false, pending:true }; },
    /** Voucher cá nhân còn dùng (đổi điểm + hoàn thành thử thách, server:true) → mảng; Function chưa có → null */
    async myVouchers(){ const fn = await callFn("myVouchers", {}); return fn.ok ? arr(obj(fn.data).vouchers) : null; },
    async cancelOrder(id){ return fire.updateOrder(id, { status:"cancelled" }); },
    async myGifts(){ const u = needUser(); return qData(await fs.collection("gifts").where("uid","==",u.uid).get()).sort((a,b)=> b.createdAt - a.createdAt); },
    async allGifts(){ return qData(await fs.collection("gifts").orderBy("createdAt","desc").limit(500).get()); },
    async createGift(g){ const id = g.key || undefined; const ref = id ? fs.collection("gifts").doc(id) : fs.collection("gifts").doc();
      const prev = docData(await ref.get()); if(prev) return prev;
      const doc = Object.assign({ status:"new", freeShip:true }, strip(g), { createdAt: now(), updatedAt: now() }); delete doc.key; await ref.set(doc); return Object.assign({ id: ref.id }, doc); },
    async updateGift(id, partial){ const ref = fs.collection("gifts").doc(id); await ref.update(Object.assign(strip(partial), { updatedAt: now() })); return docData(await ref.get()); },
  };

  /* =====================================================================
     API CÔNG KHAI
     ===================================================================== */
  let engine = demo, ready = null, _admin = null;
  function nice(e){ if(e && e.vi) return e;
    const map = { "permission-denied":"Bạn không có quyền thực hiện thao tác này.", "unavailable":"Máy chủ tạm thời không truy cập được, kiểm tra mạng.", "not-found":"Không tìm thấy dữ liệu." };
    const err = new Error(map[e && e.code] || (e && e.message) || "Đã có lỗi xảy ra."); err.code = e && e.code; return err; }
  const wrap = fn => async (...a) => { await api.init(); try{ return await fn(...a); }catch(e){ throw nice(e); } };

  const api = {
    get mode(){ return engine.name; },
    me,
    init(){
      if(ready) return ready;
      ready = (async ()=>{
        try{ if(typeof cloud !== "undefined" && cloud.init) await cloud.init(); }catch(e){}
        let useFire = false;
        try{ useFire = typeof cloud !== "undefined" && cloud.mode === "firebase" && typeof firebase !== "undefined" && firebase.apps && firebase.apps.length && typeof firebase.firestore === "function"; }catch(e){}
        engine = useFire ? fire : demo;
        try{ await engine.init(); }catch(e){ console.warn("[cloud-events] firebase lỗi → demo", e); engine = demo; await demo.init(); }
        return engine.name;
      })();
      return ready;
    },
    /** Quyền quản trị thật (firebase: có doc admins/{uid}; demo: state.isAdmin) */
    isAdminRemote: wrap(async ()=>{ if(_admin !== null && engine === fire) return _admin; _admin = await engine.isAdmin(); return _admin; }),
    listChallenges: wrap(()=> engine.listChallenges()),
    saveChallenge: wrap(c=> engine.saveChallenge(c)),
    deleteChallenge: wrap(id=> engine.deleteChallenge(id)),
    joinChallenge: wrap((id, data)=> engine.joinChallenge(id, data)),
    leaveChallenge: wrap(id=> engine.leaveChallenge(id)),
    pushProgress: wrap((id, p)=> engine.pushProgress(id, p)),
    listEntries: wrap((id, todayS)=> engine.listEntries(id, todayS)),
    myEntries: wrap(()=> engine.myEntries()),
    listEvents: wrap(()=> engine.listEvents()),
    saveEvent: wrap(ev=> engine.saveEvent(ev)),
    deleteEvent: wrap(id=> engine.deleteEvent(id)),
    getCheckinCode: wrap(id=> engine.getCheckinCode(id)),
    /** { code, rotating, expiresAt?, hidden? } — Firebase: mã xoay vòng 60 giây (Function checkinCodeNow) hoặc mã băm (hidden) */
    checkinInfo: wrap(async id=> engine.name === "firebase" ? engine.checkinInfo(id) : { code: await api.getCheckinCode(id), rotating:false }),   // demo: qua getCheckinCode (đã bọc quyền RBAC)
    register: wrap((id, info)=> engine.register(id, info)),
    cancelReg: wrap(id=> engine.cancelReg(id)),
    myRegs: wrap(()=> engine.myRegs()),
    listRegs: wrap(id=> engine.listRegs(id)),
    checkIn: wrap((id, code)=> engine.checkIn(id, code)),
    adminCheckIn: wrap((id, code)=> engine.adminCheckIn(id, code)),
    addReview: wrap((id, rv)=> engine.addReview(id, rv)),
    listReviews: wrap(id=> engine.listReviews(id)),
    /* bài đăng sau sự kiện (BTC) + bảng tin Khoảnh khắc */
    addPost: wrap((id, p)=> engine.addPost(id, p)),
    deletePost: wrap((id, pid)=> engine.deletePost(id, pid)),
    listMoments: wrap(opt=> engine.listMoments(opt)),
    toggleLike: wrap((id, pid)=> engine.toggleLike(id, pid)),
    listComments: wrap((id, pid)=> engine.listComments(id, pid)),
    addComment: wrap((id, pid, t)=> engine.addComment(id, pid, t)),
    deleteComment: wrap((id, pid, cid)=> engine.deleteComment(id, pid, cid)),
    report: wrap((id, pid, reason)=> engine.report(id, pid, reason)),
    moderate: wrap((id, pid, action)=> engine.moderate(id, pid, action)),
    /* ảnh/clip: demo → IndexedDB "idb:<key>" · firebase → Storage (URL https) */
    newId: wrap(kind=> engine.newId(kind)),
    putMedia: wrap((path, blob, meta)=> engine.putMedia(path, blob, meta)),
    deleteMedia: wrap(src=> engine.deleteMedia(src)),
    checkContent, cleanMedia, isHiddenPost: hiddenPost,
    listProducts: wrap(()=> engine.listProducts()),
    saveProduct: wrap(p=> engine.saveProduct(p)),
    deleteProduct: wrap(id=> engine.deleteProduct(id)),
    placeOrder: wrap(o=> engine.placeOrder(o)),
    myOrders: wrap(()=> engine.myOrders()),
    allOrders: wrap(()=> engine.allOrders()),
    updateOrder: wrap((id, p)=> engine.updateOrder(id, p)),
    cancelOrder: wrap(id=> engine.cancelOrder(id)),
    claimVoucher: wrap((code, spec)=> engine.claimVoucher(code, spec)),
    releaseVoucher: wrap((code, id)=> engine.releaseVoucher(code, id)),
    redeemPoints: wrap(id=> engine.redeemPoints(id)),
    claimChallengeVoucher: wrap(id=> engine.claimChallengeVoucher(id)),
    myVouchers: wrap(()=> engine.myVouchers()),
    /** chữ ký voucher trong ví (đồng bộ — gọi lúc cấp voucher) */
    signVoucher: v=>{ try{ return engine.signVoucher(v); }catch(e){ return ""; } },
    /* luật "máy chủ" dùng chung (kiểm thử + đặc tả Cloud Function) */
    policy: { sanitizeProgress, progressCap, chDays, priceOrder, voucherDiscount, ciWindow, CH_DAILY, ORDER_FLOW, CI_EARLY_MS, CI_LATE_MS, TRUST_DAYS, cleanName, accountAgeDays },
    myGifts: wrap(()=> engine.myGifts()),
    allGifts: wrap(()=> engine.allGifts()),
    createGift: wrap(g=> engine.createGift(g)),
    updateGift: wrap((id, p)=> engine.updateGift(id, p)),
    /* dùng cho kiểm thử Node / harness */
    _demo: demo, _seed: { seedChallenges, seedEvents, seedProducts, seedReviews, botEntries, fakeRegs, botCount, EV_CONTENT, CH_CONTENT, upgradeContent, ensureSeed }, _u: { ds, parse, addD, mondayOf, hashStr, r01, genCode },
  };
  return api;
})();
if(typeof window !== "undefined") window.cloudEvents = cloudEvents;
if(typeof module !== "undefined" && module.exports) module.exports = cloudEvents;
