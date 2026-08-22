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

**Đã dựng xong rồi bỏ theo yêu cầu.** Trang
`/services/<nền-tảng>/<danh-mục>/<dịch-vụ>` đã chạy được — giá thật, ba con số
tự khai kèm số đo ở mục 2, nút mua mở thẳng form đã điền, có trong sitemap,
slug sai trả 404 — nhưng bạn quyết định **panel không cần mặt công khai nào**,
nên nó bị xoá cùng cả nhánh `/services`. Xoá luôn `Service.slug` và ba trường
SEO của Platform/Category/Service vì chúng chỉ để điền cho những trang đó.

Hệ quả cần biết: **người từ tìm kiếm không xem được giá trước khi đăng ký**, và
phần theo dõi thứ hạng giờ chỉ còn trang chủ với các trang operator tự viết để
đo. Muốn dựng lại thì đây là mô tả của nó.

---

## Thứ tự đề xuất

**1 → 3 → 4 → 2 → 5.** Cả năm đã xong; mục 5 làm xong rồi bỏ theo yêu cầu.

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

## Thêm: quay lại đúng trang, thẻ chọn dịch vụ, và đặt lịch chạy

Ba việc còn dở, bạn bảo làm nốt.

**Đăng nhập xong về đúng chỗ.** Khách xin `/dashboard/orders` bị đá sang form
đăng nhập rồi thả xuống bảng điều khiển, phải tự mò lại. Giờ hai layout có bảo
vệ đều mang theo đường dẫn bị từ chối, form nhớ nó, đăng nhập xong đi thẳng tới
— **qua cả bước 2FA**, không thì tài khoản có xác thực hai lớp lại mất chỗ vì
đã bật bảo mật.

Giá trị đó là **danh sách hình dạng được phép**, không phải danh sách mẹo bị
cấm: `next` là một lỗ open-redirect chực chờ, và cái vừa đăng nhập xong chính
là thứ làm người ta tin đích đến. Chỉ đường dẫn trên site này mới được đi theo;
`//evil.test`, `/\evil.test`, ký tự điều khiển, và chính các trang đăng nhập
(đi vòng) đều bị từ chối. **Kiểm ở action chứ không chỉ ở chỗ tạo link** —
trường ẩn cũng sửa được như mọi trường khác.

**Chọn dịch vụ bằng thẻ, kèm nhãn.** Dropdown bắt khách mở ra, đọc, đóng lại,
rồi nhớ. Cascade đã thu về một danh mục rồi, và chọn cái nào trong đó — rẻ,
nhanh, hay ít tụt — mới là quyết định. Nhãn là chữ của operator (`Hot:danger,
Giá rẻ:success, Ít tụt`), panel không biết trước từ vựng nào; chỉ **màu** bị
giới hạn trong năm màu sẵn có, không thì gõ sai sẽ tạo ra một class rỗng.

**Đặt lịch chạy.** Trừ tiền ngay, đến giờ mới gửi đi — số dư cam kết lúc khách
đang nhìn đáng tin hơn số dư kiểm lúc 3 giờ sáng. Tắt mặc định
(`order.scheduleMaxDays = 0`); panel không muốn giữ đơn đã trả tiền thì không
phải giải thích với khách vì sao đơn đứng im. Giờ đọc theo **múi giờ của
panel**, không phải của máy chủ — operator ở Hà Nội và máy chủ ở Frankfurt sẽ
lệch nhau bảy tiếng về nghĩa của "2 giờ chiều". Đơn đang chờ hiện rõ "Hẹn
lúc..." ở danh sách, không thì nó trông như đơn kẹt.

**Ba lỗi thật bắt được, hai trong số đó có từ trước.**
- **`Date.UTC` cuộn tràn thay vì từ chối**: `2026-13-40T99:99` thành một thời
  điểm có thật mà không ai gõ. Giờ kiểm khoảng giá trị và kiểm ngày có tồn tại
  trong tháng đó không (31 tháng Hai lọt qua kiểm khoảng).
- **React reset form sau khi server action trả về**, bỏ tick mọi checkbox và
  radio trong khi state vẽ chúng vẫn giữ nguyên. Màn hình và thứ sắp gửi đi bất
  đồng: **đơn bị từ chối một lần thì lần sau gửi đi không kèm dịch vụ nào**.
  Giờ những giá trị đó đi qua input ẩn — `value` là thuộc tính nên reset khôi
  phục nguyên vẹn. Nút drip-feed dính lỗi này từ trước.
- **Ô link bị xoá sạch sau mỗi lần từ chối** vì nó là ô duy nhất không do state
  giữ. Sai số lượng, trùng đơn, thiếu số dư — lần nào cũng mất cái link vừa dán.

**Chứng minh.** 16/16 cho phần chuyển hướng (gồm sáu đích độc hại bị từ chối và
hai lần sửa tay trường ẩn), 22/22 cho thẻ dịch vụ (gồm bảy trường hợp phân tích
nhãn và điều hướng bằng bàn phím), 27/27 cho đặt lịch — múi giờ tính tay trước
(+7, và Berlin hai mùa), tám chuỗi rác bị từ chối, tiền trừ ngay, dispatcher
bỏ qua đơn chưa tới giờ rồi nhận nó khi tới.

## Thêm: ảnh vừa upload không cần khởi động lại, và ảnh đính kèm ticket

Hai việc còn lại sau khi cả hai kế hoạch đã xong.

**Ảnh upload 404 cho tới lần khởi động lại.** `next start` đọc `public/` đúng
một lần, lúc khởi động. File upload rơi vào `public/uploads`, nên ảnh operator
vừa đổi trong admin trả 404 cho tới khi có người restart. Trước đây nó được ghi
vào README như một đặc tính của cách chạy chứ không phải lỗi — nó là lỗi: người
đổi logo không có lý do gì để đoán ra điều đó.

Giờ upload nằm ở `var/uploads`, route `/uploads/[...path]` đọc thẳng từ đĩa mỗi
lượt gọi. **Địa chỉ giữ nguyên**, cố ý: chuỗi đó đã nằm trong settings, trong
nội dung trang và bài blog, đổi đi là một migration đổi lấy không gì cả. File
ghi từ trước vẫn ở chỗ cũ và vẫn đọc được.

Kiểu file phục vụ ra quyết định bằng **đuôi mà panel đã tự đặt lúc ghi**, không
phải bằng thứ request nói — đuôi panel không ghi thì panel không phục vụ, nên
`.svg` không lọt kể cả khi nó vào được thư mục bằng đường khác.

**Chứng minh.** Trên bản production thật: PNG ghi vào `var/uploads` *sau* khi
server đã chạy trả 200 kèm `image/png`; một file thả vào `public/` sau khi khởi
động, không có route đứng sau, vẫn 404 — đúng cái hành vi đang phải đi vòng.
Traversal thô và traversal mã hoá đều 404, `.svg` nằm sẵn trong thư mục cũng
404, và host lạ cũng 404.

**Ảnh đính kèm ticket.** Ticket ở thị trường này phần lớn là một ảnh chụp màn
hình — "đơn không chạy, đây này". Không cho gửi ảnh thì mỗi ticket tốn thêm một
vòng hỏi đáp.

Cả khách và nhân viên đều đính kèm được. Số ảnh và dung lượng mỗi ảnh do
operator đặt trong Cài đặt → Hỗ trợ; tắt thì **ô chọn file biến mất**, chứ
không phải cho chọn rồi từ chối lúc gửi.

**File này không công khai.** Ảnh operator upload thì ai biết địa chỉ cũng xem
được — đó là ý định. Ảnh của khách thì chỉ chính khách đó và bộ phận hỗ trợ đọc
được, qua route kiểm người đọc; nó nằm ở `var/ticket-attachments`, ngoài tầm
với của route `/uploads` công khai. Người khác nhận **404 chứ không phải 403**:
403 là xác nhận file có thật, mà đó gần như là toàn bộ giá trị của một cái id.

**Một lỗi cũ lộ ra trong lúc làm.** Form mở ticket là form không do state giữ,
nên mỗi lần bị từ chối React reset sạch — khách gõ tiêu đề quá ngắn là mất luôn
đoạn văn vừa viết về vấn đề của mình. Lỗi này có từ trước, thêm một đường từ
chối nữa (ảnh sai kiểu, quá nặng, quá nhiều) chỉ làm nó gặp thường xuyên hơn.
Giờ mọi lần từ chối trả lại đúng thứ đã gõ. **Ô chọn file thì không trả lại
được** — trình duyệt không cho script điền vào input file — nên chỗ đó nói thẳng
là phải chọn lại, thay vì để lại một dòng gợi ý chỉ đúng ở lần đầu.

**Chứng minh.** Chạy trên bản production thật, trình duyệt thật: khách mở ticket
kèm hai ảnh, cả hai hiện trong luồng và **trình duyệt decode được** (40×25 và
16×16, đúng số đo đọc từ header). Chính khách đó tải được ảnh; khách khác 404;
chưa đăng nhập 404; id không có thật 404; admin tải được. Admin trả lời kèm ảnh,
khách nhìn thấy. `.svg` bị từ chối, ảnh 733 KB bị từ chối bằng đúng ngưỡng 512
KB của panel (chứ không phải bằng giới hạn body 2 MB của server action), bốn ảnh
vượt ngưỡng ba bị từ chối, và **không lần nào ghi ra một dòng nào**. 19/19.

## Thêm: cài được lên điện thoại (PWA)

Bạn hỏi "làm PWA chưa" — chưa có gì cả: không manifest, không service worker,
không icon ứng dụng.

**Vì sao đáng làm ở đúng panel này.** Khách của thị trường này gần như toàn bộ
dùng điện thoại, và người mua SMM là người **quay lại mỗi ngày** để xem đơn
chạy tới đâu. Đó đúng là kiểu người mà một cái icon trên màn hình chính có
nghĩa. Không có gì trong đây cần app store.

**Không có file tĩnh nào cả**, vì một deployment phục vụ nhiều panel và mỗi
panel cần một bộ khác nhau. Manifest dựng theo từng request từ tên, tagline,
theme và ngôn ngữ của chính panel đó; icon **vẽ ra** từ chữ cái đầu và màu chính
của panel khi chưa ai upload file nào. Manifest tĩnh của Next (`app/manifest.ts`)
sinh một lần lúc build, nên nó sẽ đưa tên và màu của panel gốc lên điện thoại
của đại lý — đúng thứ một manifest không được phép sai.

Operator ghi đè được: tên ứng dụng, mười hai ký tự nằm dưới icon, file icon
vuông, trang mà icon mở ra, và khung của cửa sổ. Tất cả nằm cạnh phần thương
hiệu trong Cài đặt, không thêm trang admin nào.

**Hai công tắc, vì đó là hai cam kết khác nhau.** "Cài được lên điện thoại" là
manifest, icon và lời mời cài — nó không để lại gì trên máy ai. "Chạy được khi
mất mạng" là service worker, thứ **sống lâu hơn lượt truy cập**.

**Service worker không cache trang nào.** Gần như mọi byte panel gửi đi đều phụ
thuộc vào người hỏi — số dư, đơn hàng, hàng chờ ticket của nhân viên — nên nó
chỉ giữ tài nguyên build (đã băm, công khai, giống nhau với mọi người) và **một
trang offline**. Điều hướng đi ra mạng trước, mất mạng mới rơi về trang đó.
`/api` không đụng tới. Cách còn lại — cache trang để mở app tức thì khi offline
— nghĩa là số dư của một khách nằm trong cache mà **người tiếp theo đăng nhập
trên chính cái điện thoại đó** có thể được phục vụ từ đấy. Panel SMM không đáng
đánh đổi như vậy.

**Tắt công tắc offline không chỉ là ngừng đăng ký mới**: nó bảo những worker đã
nằm ngoài kia xoá cache và tự gỡ. Một công tắc chỉ áp dụng cho người chưa từng
ghé thì không phải công tắc.

**Chứng minh (23/23 + 7/7).** Trên bản production thật, trình duyệt thật:
manifest được link, parse ra đúng tên panel, `start_url` là `/dashboard`,
`scope` là `/`, có icon `maskable`; icon sinh ra vẽ chữ đầu trên đúng màu chính;
worker cài xong và **nắm quyền điều khiển trang**; `/offline` nằm trong precache
và tài nguyên build được cache, **không một trang đăng nhập nào lọt vào cache**
và không có gì từ `/api`; tắt công tắc thì worker bị gỡ (0 registration), cache
bị xoá (0 cache) và `/sw.js` trả 404; tắt cả tính năng thì không còn thẻ link và
route manifest trả 404; ghi đè của operator ra đúng manifest, và `start_url` trỏ
sang tên miền khác **bị từ chối chứ không xuất bản** — một manifest có
`start_url` khác origin bị trình duyệt bỏ nguyên cái, nên lỗi đó sẽ làm panel
lặng lẽ hết cài được mà không có gì trên màn hình nói ra.

**Phần offline phải thử bằng cách tắt hẳn server.** `context.setOffline` của
Playwright đặt trên target của trang, **không chạm tới target của service
worker**, nên `fetch` trong worker vẫn ra được mạng: bài test kiểu đó xanh mà
không chứng minh gì. Thử lại bằng cách `SIGKILL` server thật — kiểm chắc chắn
không còn ai nghe cổng 3000 — rồi điều hướng: trang offline hiện ra, **giữ
nguyên địa chỉ khách vừa xin** (nên bấm thử lại là thử lại đúng trang đó), có
nút thử lại, **không nói gì về người đọc** (một bản cache dùng chung cho tất
cả), và giao diện vẫn đúng màu panel vì CSS nằm trong cache tài nguyên.

**Cố ý không làm:** đẩy thông báo (push). Nó cần khoá VAPID, một chỗ lưu
subscription và quyền hỏi ngay lần đầu ghé — và panel đã có thông báo trong ứng
dụng lẫn email. Muốn có thì nó là một mục riêng, không phải phần đuôi của mục
này.

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
