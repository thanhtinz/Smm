# Kế hoạch nâng cấp: tính năng và giao diện

Viết sau khi tra cứu thị trường và **kiểm kê lại src**, không phải chép danh
sách tính năng của người khác. Mỗi mục kèm bằng chứng là nó đang thiếu thật.

## Nói trước: tôi tra được đến đâu

Proxy mạng của môi trường này **chặn toàn bộ tên miền `.vn`** và cả một số site
quốc tế (`folo.vn`, `socialboost.asia`, `tuongtaccheo.com`… đều trả
`EGRESS_BLOCKED`). Tôi **không xem được trực tiếp giao diện** của các panel Việt
Nam, chỉ đọc được mô tả trong kết quả tìm kiếm. Những gì viết dưới đây về thị
trường là từ mô tả đó; những gì viết về panel này là từ đọc code thật.

Repo tham chiếu `codedByCan/SpeedSmm_v3` thì tác giả **tự nói là chưa viết
xong** ("I could not complete this script and I share it halfway"). Đọc README
và cây thư mục: đa ngôn ngữ, đa tiền tệ, coupon, child panel, nhật ký, plugin,
API tương thích. **Panel này đã có đủ cả**, cộng thêm nhiều thứ repo đó không
có (drip feed, subscription, mass order, định tuyến nhiều nguồn, callback đại
lý, chống lợi dụng, theo dõi thứ hạng). Không có gì để học thêm từ đó.

## Panel này đang đứng ở đâu

Đối chiếu với những gì thị trường quảng cáo, phần **bán hàng** gần như không
thiếu gì: mass order, drip feed, subscription, bảo hành/huỷ, nhiều nguồn cho
một dịch vụ, API v2 đủ chuẩn kèm callback, child panel nhiều cấp, coupon, cấp
bậc giá, affiliate, 5 theme, đa ngôn ngữ, đa tiền tệ, 2FA.

Khoảng trống nằm ở **cổng thanh toán của thị trường này** và ở **những gì khách
nhìn thấy trước khi bấm đặt hàng**.

---

## 1. Thiếu đúng những cách người Việt trả tiền

**Bằng chứng.** `src/lib/payments/index.ts` có 5 driver: chuyển khoản (SePay),
PayPal, Stripe, crypto, và chuyển khoản tay. **Không có ví điện tử.**

Mô tả của mọi panel VN trong kết quả tìm kiếm đều liệt kê cùng một bộ: *chuyển
khoản ngân hàng, ví điện tử (Momo, ZaloPay, ViettelPay), thẻ cào điện thoại*,
rồi mới đến crypto.

**Vì sao nghiêm trọng.** Đây không phải tính năng cho đẹp — đây là **khách
không trả tiền được thì không mua được**. Khách phổ thông của thị trường này
phần lớn dùng Momo/ZaloPay chứ không mở app ngân hàng để quét QR chuyển khoản.
Mỗi khách không nạp được là một khách mất trắng, và panel không bao giờ biết đã
mất bao nhiêu.

**Làm gì.** Momo có cổng thanh toán chính thức, tài liệu công khai
(`developers.momo.vn`), một API và nhiều nguồn tiền. Dựng thêm driver theo đúng
khuôn `PaymentDriver` sẵn có — `prepare` trả `{kind:"redirect"}` như PayPal, cộng
một webhook có chữ ký như crypto. ZaloPay tương tự.

**Thẻ cào thì cẩn thận.** Nó phải đi qua đơn vị trung gian có giấy phép, và
lĩnh vực này gắn với rửa tiền và thẻ ăn cắp. Tôi dựng được driver gọi sang một
cổng đổi thẻ hợp pháp mà operator tự ký hợp đồng và tự dán khoá vào admin;
**tôi không viết phần tự dò/đối soát mã thẻ**.

**Chứng minh.** Máy chủ giả nói đúng giao thức từng cổng, chạy hết vòng: tạo
đơn nạp → chuyển hướng → webhook có chữ ký → cộng tiền một lần → gửi lại lần
hai không cộng thêm. Đúng như đã làm với SePay và crypto.

**Cỡ.** Vừa. Rủi ro nằm ở chữ ký webhook, không nằm ở phần gọi.

**Đã làm xong — MoMo và ZaloPay. Thẻ cào bỏ theo yêu cầu.**

Hai driver theo đúng khuôn `PaymentDriver` sẵn có, cấu hình trong admin, mỗi cái
một URL callback riêng theo token panel — không thêm trang admin nào.

Hai cổng ký khác nhau và chỗ đó là chỗ dễ sai nhất:
- **MoMo** ký HMAC-SHA256 trên chuỗi `key=value&…` **sắp xếp theo tên trường**.
  Panel *sắp xếp bằng code* theo đúng quy tắc cổng công bố, chứ không viết tay
  chuỗi — viết tay thì sai một dấu là mọi thanh toán bị từ chối mà không biết vì
  sao. `accessKey` được ký nhưng **không gửi đi**.
- **ZaloPay** ký nối bằng `|` theo **thứ tự cố định, không phải a→z**, và dùng
  **hai khoá khác nhau**: key1 cho đơn panel gửi, key2 cho callback panel nhận.
  Dùng nhầm một khoá cho cả hai là lỗi tích hợp kinh điển.

Cả hai webhook **từ chối khi chưa có khoá**, theo đúng bài học từ lỗ SePay đã
sửa hôm nay.

**Chứng minh.** Không gọi được cổng thật (phải có hợp đồng doanh nghiệp, và
proxy ở đây chặn cả host tài liệu của họ), nên mỗi cổng được thay bằng một máy
chủ nói đúng giao thức và **tự kiểm chữ ký panel ký** — chứ không phải mock gật
đầu với chính nó. 25/25 điểm: cổng chấp nhận chữ ký; số tiền là số nguyên đồng;
URL callback gọi đúng panel; `app_trans_id` đúng dạng `yymmdd_<mã nạp>`;
callback giả mạo bị từ chối và không cộng đồng nào; callback ZaloPay ký bằng
key1 thay vì key2 bị từ chối; callback thật cộng đúng một lần; gửi lại không
cộng lần hai; trả thiếu tiền thì không cộng và ghi lại phần thiếu.

**Hai lỗi thật probe bắt được trước khi commit.** `orderId` gửi sang MoMo mang
tiền tố (`NOVA100124`) còn webhook đọc nó như số thuần — **không callback nào
khớp được đơn nạp**. Và webhook trả 204 **kèm body**, thứ mà HTTP không cho
phép: nó ném lỗi, cổng thấy 500 và **thử lại một khoản đã cộng rồi**.

---

## 2. Thông tin dịch vụ quá mỏng so với thứ thị trường rao

**Bằng chứng.** `model Service` (schema dòng 359) chỉ có:
`refill Boolean`, `cancel Boolean`, `dripfeed Boolean`, `averageTime String`.

`averageTime` là **chuỗi tự do**. Tôi đã vấp đúng chỗ này khi làm trang chủ:
không tính được "dịch vụ nhanh nhất" vì không có số, phải bỏ và thay bằng đếm
số dịch vụ có ghi thời gian.

Trong khi đó mô tả của các panel VN đều rao ba con số cụ thể cho từng dịch vụ:
**bảo hành 30–90 ngày**, **bắt đầu sau 0–30 phút**, **tốc độ N/ngày**.

**Vì sao đáng làm — và chỗ panel này có lợi thế thật.** Ba con số kia ở các
panel khác là **lời tự khai**: họ gõ vào và không có gì đối chiếu. Panel này thì
từ mục 2 của kế hoạch trước đã có bảng `OrderEvent` ghi từng mốc trạng thái kèm
`startCount`/`remains` và thời điểm. Nghĩa là nó **đo được thật**:

- *bắt đầu sau bao lâu* = từ lúc tạo đơn tới mốc `processing`/`inprogress` đầu tiên
- *giao xong trong bao lâu* = từ lúc tạo tới mốc `completed`
- *tỷ lệ tụt* = số yêu cầu bảo hành trên số đơn đã hoàn tất

**Làm gì.** Thêm trường cấu hình được (`warrantyDays`, `startMinutes`,
`speedPerDay`) cho operator khai — vì dịch vụ mới chưa có dữ liệu — **và** một
bảng thống kê tính từ đơn thật, hiện song song: *"nhà cung cấp hứa 30 phút — 200
đơn gần nhất trung bình 12 phút"*. Con số đo được luôn đứng cạnh con số tự khai,
không thay thế nó.

Chỗ nào không đủ dữ liệu thì **không hiện gì**, chứ không hiện số 0 — một dịch
vụ mới bán mà ghi "0 phút" là nói dối theo hướng ngược lại.

**Chứng minh.** Đẩy một loạt đơn qua nguồn giả với các mốc thời gian khác nhau,
đối chiếu con số panel tính ra với con số tính tay từ chính các mốc đó.

**Cỡ.** Vừa.

---

## 3. Trang đặt hàng: giá xuất hiện quá muộn, màn hình phần lớn để trống

**Bằng chứng.** Ảnh `docs/screenshots/ui-order.png`, chụp đúng trạng thái khách
mở trang lần đầu:

- **Hai phần ba màn hình trống.** Khung bên phải chỉ có một dòng "Chọn nền tảng
  trước"; form bên trái ngắn, phần dưới màn hình trống hoàn toàn.
- **Dải nền tảng bị cắt.** Sau "YouTube" là một chip bị cắt mất ở mép phải,
  không có dấu hiệu gì cho biết còn cuộn được. Khách có thể không biết panel có
  bán Facebook.
- **Không có giá ở bất cứ đâu** cho tới khi chọn xong ba cấp. Ở thị trường này
  giá/lượt là câu hỏi khách mang theo khi vào trang — bắt họ chọn ba lần mới trả
  lời là trả lời sai câu hỏi.
- Không thấy bảo hành, thời gian bắt đầu, min/max, cho tới khi đã chọn dịch vụ.

**Làm gì.**
- Khung phải, khi chưa chọn gì, hiện **bảng giá rẻ nhất mỗi nền tảng** — biến
  chỗ trống thành câu trả lời cho câu hỏi khách đang có.
- Dải nền tảng: xuống dòng thay vì cuộn ngang, hoặc thêm mờ dần + nút ở mép.
- Mỗi lựa chọn dịch vụ hiện luôn giá/lượt, bảo hành, thời gian bắt đầu ngay
  trong dòng, chứ không đợi chọn xong.
- Thành tiền cập nhật ngay khi gõ số lượng, ngay cạnh ô số lượng.

**Chứng minh.** Chụp lại đúng trạng thái đó và đặt cạnh ảnh cũ.

**Cỡ.** Nhỏ–vừa. Không đụng schema.

---

## 4. Đặt lại một đơn cũ vẫn phải chọn lại từ đầu

**Bằng chứng.** `grep` toàn bộ `src/` không có `favourite`, `reorder`, hay bất
kỳ đường nào đi từ một đơn cũ sang form đặt hàng đã điền sẵn.

**Vì sao đáng làm.** Khách của panel là khách **mua lại**, không phải mua một
lần: cùng một dịch vụ, cùng một kênh, tuần nào cũng đặt. Bắt họ đi lại bốn bước
mỗi lần là chỗ mất khách vào tay panel nào bấm hai lần là xong.

**Làm gì.** Nút "Đặt lại" trên mỗi đơn, mở form đã điền sẵn dịch vụ + link +
số lượng, để khách sửa gì thì sửa. Cộng một mục "dịch vụ bạn hay đặt" trên bảng
điều khiển, tính từ chính lịch sử đơn — không cần bảng mới, không cần khách
phải đánh dấu gì.

**Cỡ.** Nhỏ.

---

## 5. Mỗi dịch vụ chưa có trang riêng để lên tìm kiếm

**Bằng chứng.** `src/app/(public)/services/` chỉ có `page.tsx` và
`[platform]/page.tsx`. Tức là có trang cho *Instagram*, không có trang cho
*tăng follow Instagram người Việt*.

**Vì sao đáng làm bây giờ, không phải trước đây.** Mục 6 kế hoạch trước vừa
dựng xong theo dõi thứ hạng: panel giờ **đo được** một từ khoá đứng thứ mấy.
Trang riêng cho từng dịch vụ là thứ để đo — không có nó thì rank tracker chỉ
theo dõi được vài trang chung.

**Làm gì.** `/services/<nền-tảng>/<dịch-vụ>` sinh từ chính catalogue, mô tả và
tiêu đề lấy từ dịch vụ (operator đã sửa được trong admin), kèm giá thật, bảo
hành thật, và số đo ở mục 2. Nối vào sitemap và IndexNow sẵn có.

**Cỡ.** Nhỏ. Hạ tầng SEO đã xong từ trước.

---

## Thứ tự đề xuất

**1 → 3 → 4 → 2 → 5.**

Lý do: (1) là khách không trả tiền được, mất doanh thu ngay hôm nay, sửa trước
mọi thứ. (3) và (4) rẻ và chạm vào mọi khách, mọi lần đặt. (2) là thứ làm panel
này khác phần còn lại nhưng cần (3) đã xong mới có chỗ hiển thị. (5) phụ thuộc
(2) để có nội dung đáng đọc.

## Đã cân nhắc và loại

- **Tool buff trực tiếp / kịch bản seeding / spam fanpage** — gian lận nền
  tảng, tôi không viết. Không đổi.
- **Bóc link video** — vi phạm ToS, không viết. Không đổi.
- **Dò và đối soát mã thẻ cào** — gắn với thẻ ăn cắp và rửa tiền. Driver gọi
  sang cổng có giấy phép thì dựng được; phần dò mã thì không.
- **Chép giao diện của một panel cụ thể** — tôi không xem được site nào của
  thị trường này (proxy chặn), nên mọi khẳng định "giống trang X" sẽ là bịa.
  Những gì đề xuất ở mục 3 là từ ảnh chụp **trang của chính panel này**.
