# Kế hoạch tính năng tiếp theo

Viết sau khi kiểm kê panel hiện tại, không phải liệt kê tính năng chung của thị
trường. Mỗi mục dưới đây kèm **bằng chứng** là nó đang thiếu thật.

## Panel đã có gì

Cần nói trước, vì nó quyết định cái gì đáng làm tiếp:

- **Đơn hàng**: drip feed (`runs`/`interval`), subscription theo bài mới
  (`posts`/`minPerPost`/`delay`/`expiry`), mass order, dịch vụ nhận comment,
  ghi `cost` từng đơn nên báo cáo lãi/lỗ là số thật.
- **Bảo hành & huỷ**: `OrderRequest` có tự động duyệt theo cấu hình.
- **Nhà cung cấp**: nhiều nguồn cho một dịch vụ, định tuyến rẻ nhất trước,
  bảng sức khoẻ nguồn, đồng bộ catalogue theo lịch, cảnh báo giá nhảy.
- **API v2**: `services` `add` `status` `orders` `refill` `refill_status`
  `cancel` `balance` — đủ chuẩn de-facto, kể cả nhiều đơn một lần.
- **Tiền**: SePay, PayPal, Link, crypto, chuyển khoản tay; cấp bậc khách hàng
  có bảng giá riêng; mã giảm giá; affiliate có rút tiền.
- **Child panel** nhiều cấp, tính tiền thuê, khoá theo hạn.
- **Hỗ trợ**: ticket có mức ưu tiên, người xử lý, gộp trùng; hộp thư đa kênh
  (Telegram chạy thật).
- **Vận hành**: 5 theme, đa ngôn ngữ, đa tiền tệ, 2FA, captcha, chế độ bảo
  trì, nhật ký hoạt động, SEO đầy đủ.

Nói cách khác: phần "bán hàng" gần như xong. Cái còn thiếu nằm ở **vận hành khi
có sự cố** và **khi bị lợi dụng**.

---

## 1. Không có gì ghi lại rằng vòng đồng bộ đã chạy

**Bằng chứng.** `runSyncCycle()` trả kết quả trong response HTTP của
`POST /api/cron/sync` rồi thôi. Không có bảng nào lưu. `Provider.lastSyncAt`
có tồn tại nhưng đó là đồng bộ *catalogue*, không phải vòng chạy đơn.
`/admin` hiện doanh thu, đơn đang chạy, số người dùng — **không có chỗ nào nói
cỗ máy còn sống hay không**.

**Vì sao nghiêm trọng nhất.** Vòng này là thứ đẩy đơn sang nhà cung cấp và kéo
trạng thái về. Nếu scheduler bên ngoài ngừng gọi — hết hạn cron, đổi server,
sai `CRON_SECRET` — thì đơn **ngừng chạy trong im lặng**. Khách vẫn đặt được,
tiền vẫn trừ, không ai biết cho tới khi có người mở ticket. Đây là chế độ hỏng
tệ nhất một panel có thể có.

**Làm gì.** Bảng `SyncRun` ghi mỗi lượt: bắt đầu, kết thúc, số đơn đẩy, số
trạng thái cập nhật, danh sách lỗi. Trên `/admin` một dòng duy nhất: lần chạy
gần nhất cách đây bao lâu, và **cảnh báo đỏ khi quá ngưỡng cấu hình được**.
Kèm nút chạy tay để chẩn đoán.

**Chứng minh.** Đẩy `startedAt` về quá khứ → trang admin chuyển cảnh báo; gọi
cron → cảnh báo tắt; ép một nguồn lỗi → lỗi hiện ra kèm tên nguồn.

**Cỡ.** Nhỏ. Một bảng, một widget, một setting ngưỡng.

---

## 2. Đơn hàng không có lịch sử trạng thái

**Bằng chứng.** Không có model `OrderEvent`/`OrderHistory` trong schema
(`grep` trả 0). `Order` chỉ giữ trạng thái *hiện tại* và `settledAt`.

**Vì sao đáng làm.** Khách nói "đơn không chạy" — hỗ trợ không có gì để đối
chiếu. Quyết định bảo hành cũng dựa vào "lúc nào nó bắt đầu, tụt từ mốc nào".
Hiện cả hai đều là lời khai. Chuỗi child panel còn tệ hơn: một đơn đi qua ba
cấp, hỏng ở cấp nào thì không lần ra được.

**Làm gì.** Bảng `OrderEvent` ghi mỗi lần đổi trạng thái: từ gì sang gì, ai
hoặc cái gì làm, `startCount`/`remains` tại thời điểm đó. Hiện thành dòng thời
gian trên trang đơn của khách **và** của admin. Ghi từ đúng một chỗ — nơi trạng
thái được đặt — chứ không rải rác.

**Chứng minh.** Đặt đơn qua nhà cung cấp giả, đẩy nó qua pending → processing →
partial → completed, đọc lại dòng thời gian thấy đủ bốn mốc kèm số liệu.

**Cỡ.** Vừa. Rủi ro chính là bỏ sót một chỗ đặt trạng thái.

---

## 3. API không gọi ngược về cho đại lý

**Bằng chứng.** `src/app/api/v2/route.ts` không có `callback`/`webhookUrl`;
schema cũng không. Đại lý chỉ có cách gọi `status` lặp lại.

**Vì sao đáng làm.** Đại lý là khách mua sỉ — họ chạy site riêng và cần biết
đơn xong để trả kết quả cho khách của họ. Không có callback thì hoặc họ hỏi
mỗi phút (tải vô ích cho cả hai bên), hoặc khách của họ chờ lâu. Panel nào
nghiêm túc cũng có.

**Làm gì.** Mỗi user một `callbackUrl` đặt trong trang API. Khi đơn chốt, POST
sang đó `{order, status, start_count, remains}` kèm chữ ký HMAC bằng API key
của họ. Hàng đợi có thử lại theo cấp số nhân, bỏ sau N lần, và **hiện lần gửi
gần nhất cùng lỗi** để họ tự sửa mà không cần mở ticket.

**Chứng minh.** Dựng máy chủ nhận cục bộ, chốt một đơn, đối chiếu chữ ký; cho
máy chủ trả 500 và xem nó thử lại rồi bỏ cuộc.

**Cỡ.** Vừa. Phần khó là hàng đợi thử lại, không phải phần gửi.

---

## 4. Chỉ có hai lớp chống lợi dụng

**Bằng chứng.** `src/lib/order-guard.ts` có đúng hai hàm: `duplicateOrder`
(cùng user, cùng dịch vụ, cùng link, trong cửa sổ thời gian) và
`orderRateLimit` (số đơn mỗi phút mỗi user).

**Vì sao đáng làm.** Không có gì chặn **cùng một link đặt từ nhiều tài khoản** —
cách rẻ nhất để lách giới hạn. Không có danh sách chặn link hoặc username. Không
có tuổi tài khoản tối thiểu, nên một tài khoản mới tạo, nạp bằng thẻ ăn cắp, có
thể rút hết nguồn hàng trong vài phút. Ở thị trường này chargeback là chuyện có
thật.

**Làm gì.** Ba luật, tất cả cấu hình được và **mặc định tắt** — panel sạch
không nên bị làm phiền:
- cùng link từ N tài khoản khác nhau trong X giờ → giữ lại chờ duyệt
- danh sách chặn link/username, sửa trong admin
- tài khoản dưới X phút tuổi hoặc chưa nạp lần nào → giới hạn giá trị đơn

Đơn bị giữ vào một hàng chờ duyệt, **không tự huỷ** — chặn nhầm khách thật còn
tệ hơn bị lừa một đơn.

**Chứng minh.** Ba tài khoản cùng đặt một link, cái thứ ba bị giữ; duyệt tay
thì nó chạy tiếp.

**Cỡ.** Vừa.

---

## 5. Nạp tiền không có biên lai

**Bằng chứng.** Nạp tiền tạo một dòng `Transaction`. Không có route in ấn, không
có mẫu biên lai.

**Vì sao đáng làm.** Khách doanh nghiệp ở VN cần chứng từ để hạch toán. Hiện họ
phải chụp màn hình lịch sử giao dịch.

**Làm gì.** Một trang in được cho mỗi giao dịch nạp: tên panel, mã giao dịch,
số tiền, thời điểm, phương thức. Thông tin xuất hoá đơn (tên công ty, mã số
thuế) đặt trong hồ sơ khách. **Không** tự nhận đây là hoá đơn VAT hợp lệ — nó
là biên lai; hoá đơn điện tử là việc của đơn vị phát hành.

**Cỡ.** Nhỏ.

---

## Thứ tự đề xuất

1 → 2 → 4 → 3 → 5.

Lý do: (1) là chế độ hỏng im lặng, sửa trước mọi thứ. (2) là thứ (4) và bộ phận
hỗ trợ đều cần để làm việc. (3) mang lại doanh thu đại lý nhưng không cứu ai khi
hỏng. (5) nhỏ, làm lúc nào cũng được.

## Đã loại, và vì sao

- **Tool buff / kịch bản seeding / spam fanpage** — gian lận nền tảng, tôi
  không viết.
- **Bóc link video 23 nền tảng** — vi phạm ToS và thường là công cụ vi phạm bản
  quyền. Khung công cụ thì dựng được, phần bóc link thì không.
- **Marketing AI** — bạn đã bảo bỏ.
- **Công cụ miễn phí** — đã làm rồi bạn bảo bỏ, đã xoá sạch.
- **Rank tracker** — chờ bạn chọn: Search Console (chính xác, cần OAuth bạn tự
  tạo) hay SERP API trả phí (bạn cấp key).
