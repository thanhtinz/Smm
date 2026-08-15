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

**Đã làm xong.** Ảnh `docs/screenshots/service-facts.png`.

- **Ba trường số** `startMinutes`, `speedPerDay`, `warrantyDays` cho operator
  khai, sửa trong Admin → Dịch vụ. **0 = không ghi và không hiện gì** — dịch vụ
  chưa bán buổi nào mà ghi "0 phút" là nói dối theo hướng ngược lại.
  `averageTime` (chuỗi tự do của nhà cung cấp) vẫn giữ làm phương án lùi.
- **Số đo thật nằm ngay dưới số tự khai**, không thay thế nó: lời hứa và thành
  tích là hai tuyên bố khác nhau. `src/lib/service-stats.ts` đọc `OrderEvent`
  và trả về *bắt đầu sau bao lâu*, *giao xong trong bao lâu*, *bao nhiêu %
  đơn xin refill*, kèm số đơn nó dựa vào.
- **Dùng trung vị chứ không phải trung bình** — một đơn kẹt một tuần kéo lệch
  trung bình. Và **dưới 10 đơn thì không nói gì**: ba đơn không phải thành
  tích, bịa một con số từ ba đơn là biến số đo thành một lời tự khai nữa.
- **Một truy vấn cho cả trang**, không phải một truy vấn mỗi dịch vụ — form đặt
  hàng có hàng trăm dòng.

**Chứng minh (9/9 điểm).** Gieo 12 đơn với mốc thời gian tự chọn, **tính trung
vị bằng tay trước** rồi mới hỏi panel: 16 phút vs 16 phút, 116 phút vs 116
phút. Dịch vụ chưa có đơn nào trả `null` chứ không phải 0. Trên màn hình hiện
đủ "30 phút / Đo thật: 16 phút (24 đơn gần nhất)", "5.000/ngày / Giao xong: 1
giờ 56 phút", "30 ngày / 8% đơn xin refill".

**Hai thứ sửa khi chụp lại.** `toLocaleString()` không truyền locale thì dùng
locale của **máy chủ** — trang tiếng Việt in ra "5,000" thay vì "5.000". Và bốn
ô xếp một hàng trong cột form nửa màn hình thì mỗi ô còn ~130px, không đủ chỗ
cho dòng số đo; giờ bốn ô xếp **2×2**.

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

**Đã làm xong.** Ảnh `docs/screenshots/order-before-after.png`.

- ~~Khung phải là bảng giá rẻ nhất mỗi nền tảng~~ — **đã bỏ theo yêu cầu.**
  Chưa chọn dịch vụ thì cột phải chỉ có thẻ tài khoản, dưới đó để trống.
- **Dải nền tảng xuống dòng thay vì cuộn ngang.** Trước đó chip cuối bị cắt ở
  mép phải mà không có dấu hiệu nào cho biết còn nữa: **Facebook, X/Twitter,
  Telegram, Spotify đều không nhìn thấy được**. Giờ cả 8 nền tảng hiện hết.

**Làm lại lần hai sau khi bạn đưa ảnh một panel VN thật.** Proxy chặn hết nên
tôi không tự xem được cái nào; ảnh bạn gửi là thứ tôi thiếu. Đọc nó ra bốn thứ
panel này không có, và lấy về đủ bốn:

- **Ô "tìm nhanh dịch vụ" trên cùng.** Gõ tên hoặc mã là nhảy thẳng tới dịch
  vụ, ba ô bên dưới tự điền theo. Cascade đúng cho người đi tìm, sai cho khách
  tuần nào cũng mua đúng một thứ họ gọi tên được. **Là ô nhập gõ thẳng được**,
  không phải dropdown phải mở ra rồi mới có chỗ gõ — cái đó là dropdown đội lốt
  ô tìm kiếm, hai lần bấm trước khi gõ được một ký tự.
- **Nền tảng là dropdown**, cùng kiểu với danh mục và dịch vụ. Trước đó nó là
  một dải chip: phải xuống dòng, không nói được cái nào đang chọn nếu không dựa
  vào màu, và làm bước đầu của cascade trông khác hẳn hai bước sau.
- **Ba ô thông số hiện ngay khi chọn xong dịch vụ**: bắt đầu sau, huỷ được,
  bảo hành. Trước đó chúng nằm dưới dạng pill xám nhỏ và một dòng trong danh
  sách — chỗ mắt nhìn tới sau cùng. Dấu X đỏ ở "không bảo hành" là câu trả lời
  thật, không phải lỗi, và khách cần thấy rõ trước khi trả tiền.
  Ban đầu là **bốn** ô, có thêm "Trạng thái: Đang bán" — nhưng dịch vụ đã tắt
  thì không bao giờ vào được danh sách này, nên đó là một dấu tích không bao giờ
  nói được điều gì khác mà chiếm một phần tư hàng. Nhãn cũng đổi từ VIẾT HOA
  giãn chữ sang chữ thường: ở một phần tư cột form thì kiểu đó bẻ mọi nhãn
  xuống hai dòng, đẩy bốn câu trả lời lên bốn đường chân khác nhau. Và dấu tích
  chuyển sang nằm cạnh **câu trả lời** chứ không cạnh câu hỏi — tích bên chữ
  "Có" thì nhấn mạnh, tích bên chữ "Huỷ được" chỉ là trang trí.
- **Thẻ tài khoản ở cột phải**: số dư, tổng đã nạp, cấp bậc kèm mức giảm, hai
  nút nạp tiền / hồ sơ. Số dư đã có trên thanh trên cùng, nhưng đây là cột
  khách đọc lúc đang cân nhắc — "đủ tiền không" nên nằm cạnh giá.
- **Giá gốc gạch ngang cạnh giá sau chiết khấu.** Panel có giá theo cấp bậc từ
  lâu nhưng chưa bao giờ cho khách thấy họ đang được giảm; một mức giảm không
  ai đối chiếu được thì không thuyết phục được ai.

Hai lỗi tự bắt khi chụp lại: khoá `dash.balance` không tồn tại nên in ra chữ
`dash.balance` thô trên màn hình, và bốn ô thông số xếp ngang thì nhãn xuống ba
dòng rồi cắt cụt mất chính câu trả lời — đã đổi sang xếp dọc.

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

**Đã làm xong.** Ảnh `docs/screenshots/order-reorder.png`,
`docs/screenshots/order-prefilled.png`, `docs/screenshots/dash-frequent.png`.

- **Nút "Đặt lại" trên mỗi dòng đơn** (và trên trang chi tiết đơn), mở form đã
  điền sẵn: dịch vụ, link, số lượng — và cả ba bậc cascade phía trên nó. Khách
  sửa gì thì sửa rồi bấm đặt.
- **Lời mời đặt lại nằm trong URL, không nằm trong bảng nào.** Nó sống sót qua
  bookmark, qua link gửi cho người khác, qua một vòng đăng nhập lại, và không có
  gì phải đồng bộ khi đơn cũ đổi. Dịch vụ đi bằng **mã công khai** — con số khách
  đã nhìn thấy — chứ không phải cuid nội bộ.
- **Dịch vụ đã ngừng bán thì không mời đặt lại.** Dòng đơn đó không có nút, và
  một link cũ trỏ tới mã không còn bán mở ra form trắng bình thường chứ không
  phải form trỏ vào thứ không mua được.
- **Đơn subscription và đơn nhỏ giọt mang theo đúng trường của nó.** Với
  subscription thì `link` là tên tài khoản chứ không phải URL và số lượng là
  trần tính từ số bài × mức tối đa — chép cả hai sang là điền sai ô bằng sai số.
- **"Dịch vụ bạn hay đặt" trên bảng điều khiển**, tính từ chính lịch sử đơn:
  không có bảng yêu thích, không có gì để khách phải đánh dấu. Chỉ hiện dịch vụ
  đã đặt **từ hai lần trở lên** — đặt một lần là một đơn, không phải một thói
  quen. Giá trên thẻ là giá **sau chiết khấu cấp bậc** của chính khách đó.

**Chứng minh.** 23/23 điểm trong trình duyệt thật: thẻ hiện đúng số lần đã đặt,
mọi thẻ trỏ tới dịch vụ còn bán, link đặt lại lấy đúng dịch vụ của dòng đó, form
mở ra đã điền nền tảng + danh mục + dịch vụ + link + số lượng, và **bấm đặt ngay
mà không chạm vào cascade thì sinh đúng một đơn, đúng dịch vụ, đúng link, đúng số
lượng**. Mã dịch vụ không tồn tại mở ra form trắng; số lượng sửa tay thành chữ
bị bỏ.

**Ba lỗi probe bắt được — đều là lỗi của probe, không phải của sản phẩm.**
`publicId` là duy nhất **theo từng panel** chứ không phải toàn hệ thống, nên đếm
dịch vụ không giới hạn panel thì 4 thành 7; dòng đầu bảng và link đầu bảng không
phải cùng một đơn khi dòng đầu có dịch vụ đã ngừng bán; và trang có **hai** form
(đơn lẻ và hàng loạt) nên `locator("form")` là nhập nhằng.

**Một thứ sửa thêm khi chụp lại.** Cột ngày dùng dấu thời gian đầy đủ, bị bóp
lại còn ~90px nên **xuống bốn dòng** và kéo cao mọi dòng của bảng. Đổi sang
ngày/tháng + giờ: bảng còn một nửa chiều cao. Năm vẫn có trên trang chi tiết đơn
và trong file CSV xuất ra.

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

## Thêm: trang lịch chạy tự động trong admin

Không nằm trong kế hoạch ban đầu, bạn yêu cầu thêm — và đúng chỗ thiếu.

**Bằng chứng.** Panel không tự chạy: nó mở một endpoint và phải có thứ bên
ngoài gọi. Đó là hình dạng đúng cho một web app, nhưng phần cấu hình thì **vô
hình**: địa chỉ không có trong tài liệu nào, secret nằm trong biến môi trường,
và việc có ai đang gọi hay không chỉ suy ra được từ một dòng trên trang tổng
quan. Có sẵn nút "chạy cả vòng" nhưng **không chạy được từng việc** — callback
kẹt thì operator phải chọn giữa chạy tất cả (đẩy đơn, thu tiền thuê, gửi mail)
hoặc không chạy gì.

**Đã làm.** `/admin/cron`: trạng thái scheduler, địa chỉ endpoint, **dòng
crontab dán được thẳng**, cho biết `CRON_SECRET` đã đặt hay chưa, 10 việc mỗi
việc một nút chạy riêng kèm mô tả nó làm gì, và 8 vòng chạy gần nhất.

Mỗi việc có nhãn cho biết nó **động tới tiền** hay **gửi đơn đi**, để người
đang chẩn đoán biết nút nào bấm vô hại và nút nào tiêu tiền. Kết quả in ngay
dưới đúng dòng vừa bấm chứ không dồn vào một banner chung — bấm liên tiếp mấy
lần thì banner chung sẽ ghi đè câu trả lời trước.

**Secret vẫn nằm ở biến môi trường, cố ý.** Nó bảo vệ chính cái endpoint chạy
mọi thứ; một giá trị sửa được ngay từ màn hình mà nó bảo vệ là một secret yếu
hơn.

**Chứng minh.** Bấm thật cả 10 nút trong trình duyệt, mỗi nút in ra kết quả của
chính nó; "chạy tất cả" ghi một dòng `SyncRun` mới, đóng lại, và đóng dấu tên
người bấm.

## Thêm: menu nền tảng và trang đặt đơn theo danh mục

Bạn yêu cầu thêm, không nằm trong kế hoạch ban đầu.

**Đã làm.** Ảnh `docs/screenshots/cat-page-order.png`,
`docs/screenshots/cat-page-guest.png`.

- **Menu trên cùng là các nền tảng**, mỗi nền tảng thả xuống **danh mục của
  nó**. Bấm một danh mục là vào `/services/<nền-tảng>/<danh-mục>`.
- **Trang đó có form đặt đơn thật**, không phải danh sách rồi bấm sang chỗ
  khác. Hai bước đầu của cascade đã được trả lời bằng chính việc tới được
  trang này, nên form bỏ chúng đi và mở thẳng ở bước còn lại: chọn dịch vụ nào.
  Dưới form là bảng giá của danh mục — thứ để quyết định chọn cái nào.
- **Chưa đăng nhập vẫn là một trang thật**: giá vẫn hiện, vì giá là lý do người
  ta từ tìm kiếm đi vào đây. Chỉ form là không có, kèm lời mời đăng nhập.
- **Danh mục có `slug` riêng**, unique theo **từng nền tảng** chứ không theo cả
  panel — để TikTok và Instagram cùng có "follow" mà không phải đổi tên một cái
  thành "follow-2". Sửa được trong Admin → Danh mục.
- **Form đặt đơn vẫn chỉ có một cái.** Trang danh mục dùng đúng component mà
  bảng điều khiển dùng, không phải bản sao: một bộ giới hạn, một cách tính
  tiền, một lần kiểm số dư. Bản sao trông giống nhau đúng tới lần đầu một trong
  hai cái được sửa. Danh sách nhãn cũng gộp về `src/lib/order-form-labels.ts`
  vì giờ có hai trang dùng.

**Ba lỗi thật bắt được khi kiểm.**
- **Header tràn.** 8 nền tảng cộng Trang chủ/API/Điều khoản không vừa một màn
  1440px — chúng đè lên nút đăng nhập. Số nền tảng là do catalogue quyết định
  chứ không phải file này, nên thanh menu **tự đo mình** và đẩy phần không vừa
  vào một menu "Thêm". Bản đo được vẽ ẩn, ngoài luồng, vì đo bản đang hiện thì
  phải giãn nó ra hết cỡ trước — đúng cái nháy mà nó sinh ra để tránh.
- **Hover mở menu rồi click lại đóng ngay.** Chuột rê vào là mở, bấm vào là
  toggle → tự đóng cái mà chính nó vừa mở. Giờ tách hẳn: máy có chuột thì rê để
  xem danh mục, bấm là vào trang nền tảng; máy cảm ứng không có hover nên chạm
  là mở/đóng. Vẫn là thẻ link ở cả hai kiểu nên HTML server và client giống
  nhau, và bàn phím tới được cả hai (focus mở, Escape đóng).
- **Seed sẽ hỏng ở lần cài mới**: nó tạo danh mục không có slug, mọi danh mục
  cùng một nền tảng sẽ đụng nhau ở giá trị mặc định rỗng.

**Migration đi hai bước** — thêm cột, chạy `scripts/backfill-category-slug.mjs`,
rồi mới thêm unique index. Gộp một bước thì mọi dòng đang có đều đụng nhau ở
chuỗi rỗng.

**Chứng minh.** 21/21 điểm trong trình duyệt thật: menu không tràn, mỗi mục có
ảnh nền tảng, danh mục trong menu **khớp đúng catalogue** (không phải bản chép
cũ), Escape đóng; trang khách chưa đăng nhập có giá mà không có form; trang đã
đăng nhập có form, **không còn bước nền tảng/danh mục/tìm nhanh**, và chỉ chào
bán dịch vụ của đúng danh mục đó; **đặt thật một đơn từ trang đó** và đơn rơi
đúng dịch vụ đã chọn; slug không tồn tại trả 404 chứ không phải trang trắng.

**Làm lại trong panel theo yêu cầu.** Bạn nói đúng: khách đã đăng nhập và nạp
tiền rồi thì không đi xem trang giới thiệu, họ đi mua — nên chỗ để điều hướng
đó là **sidebar của panel**, không phải header trang ngoài.

- **Sidebar có mục "Dịch vụ"**: mỗi nền tảng một dòng kèm ảnh, bấm mở ra danh
  mục của nó, bấm danh mục là vào `/dashboard/order/<nền-tảng>/<danh-mục>`.
  **Mỗi lúc chỉ mở một nền tảng** — tám nền tảng mở hết cùng lúc là cái sidebar
  không ai đọc nổi. Nền tảng của trang đang xem thì tự mở sẵn.
- **Trang đặt đơn nằm trong panel**, cột phải là: thẻ tài khoản (số dư, tổng đã
  nạp, cấp bậc), **thẻ "Lưu ý trước khi mua hàng"**, và **thẻ "Hỗ trợ nhanh"**.
- **Lưu ý là lời của operator, không phải của file này**: lấy từ setting
  `order.notes` (mỗi dòng một mục, `Tiêu đề | Nội dung`). **Để trống thì thẻ
  biến mất hẳn** chứ không hiện khung rỗng — khung rỗng đọc ra thành "panel
  quên điền", tệ hơn là không có.
- **Hai nút liên hệ nổi giờ có trong panel**, không chỉ ngoài trang giới thiệu.
  Cần hỗ trợ nhất là lúc đã có tiền trong ví: đơn kẹt, số dư sai. Trên điện
  thoại nó được nâng lên khỏi thanh dưới cùng — thanh đó thay sidebar ở màn
  hẹp, và nút nằm đè lên nó là nút bấm không được.
- Thẻ "Hỗ trợ nhanh" trong cột phải **đã bỏ**: nút nổi đã có mặt ở mọi trang
  của panel, nên cái thẻ chỉ là ba đường link đó lần thứ hai trên cùng một màn.

**Toàn bộ phần dịch vụ ngoài trang giới thiệu đã xoá theo yêu cầu.** Bốn route
`/services`, `/services/<nền-tảng>`, `/services/<nền-tảng>/<danh-mục>` và trang
riêng từng dịch vụ đều không còn — cùng với mọi link trỏ tới chúng (header,
footer, sidebar panel), các URL đó trong sitemap, và **ba trường SEO** ở
Platform/Category/Service vốn chỉ để điền cho những trang đó. Còn để lại thì
operator điền tiêu đề SEO cho một địa chỉ không ai mở được.

`Category.slug` **giữ lại** — panel định tuyến bằng nó
(`/dashboard/order/<nền-tảng>/<danh-mục>`). `Service.slug` bỏ, không còn gì
dùng. Catalogue giờ chỉ sống trong panel, sau đăng nhập.

Trang giới thiệu vẫn còn và vẫn khoe nền tảng/bảng giá; các link đó giờ trỏ vào
form đặt hàng, và khách chưa đăng nhập được chuyển sang trang đăng nhập — chỗ
mà một trang giới thiệu vốn muốn đưa họ tới.

**Trước đó: menu nền tảng ngoài trang giới thiệu đã xoá.** Header công khai trở lại bốn
mục như cũ (Trang chủ / Dịch vụ / API / Điều khoản), và toàn bộ phần đo bề rộng
+ menu tràn + dropdown hover dựng cho nó cũng xoá theo — code chết còn tệ hơn
không có. Trang `/services/<nền-tảng>/<danh-mục>` **vẫn còn** vì đó là mặt SEO,
chỗ người từ tìm kiếm rơi vào; nó chỉ không còn nằm trên thanh menu.

Hai trang, hai mục đích, nhưng **chỉ một form đặt đơn** — cùng một component.

**Chứng minh.** 20/20 điểm: sidebar liệt kê đúng số nền tảng đang bán, mở ra
đúng số danh mục, mở cái thứ hai thì cái thứ nhất đóng, đánh dấu đúng trang
đang xem; trang đặt đơn có form + thẻ lưu ý + thẻ hỗ trợ với link thật, chỉ
chào bán dịch vụ của đúng danh mục, **đặt thật một đơn**; xoá setting lưu ý thì
thẻ biến mất chứ không còn cái tiêu đề trơ ra; slug sai trả 404.

---

## Đã cân nhắc và loại

- **Tool buff trực tiếp / kịch bản seeding / spam fanpage** — gian lận nền
  tảng, tôi không viết. Không đổi.
- **Bóc link video** — vi phạm ToS, không viết. Không đổi.
- **Dò và đối soát mã thẻ cào** — gắn với thẻ ăn cắp và rửa tiền. Driver gọi
  sang cổng có giấy phép thì dựng được; phần dò mã thì không.
- **Chép giao diện của một panel cụ thể** — tôi không xem được site nào của
  thị trường này (proxy chặn), nên mọi khẳng định "giống trang X" sẽ là bịa.
  Những gì đề xuất ở mục 3 là từ ảnh chụp **trang của chính panel này**.
