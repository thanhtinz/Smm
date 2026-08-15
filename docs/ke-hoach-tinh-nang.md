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

**Đã làm xong.** Bảng `OrderEvent`, ghi từ sáu chỗ đặt trạng thái (đẩy đơn,
đồng bộ nhà cung cấp, chuỗi child panel, tự động bảo hành/huỷ, yêu cầu của
khách, admin sửa tay). Dựng nhà cung cấp giả rồi chạy cron thật: đơn đi
pending → processing → inprogress → completed, dòng thời gian ghi đủ bốn mốc
kèm `startCount`/`remains` tại từng mốc. Một đơn thứ hai đi tới `partial` —
sau đó nó **không** đi tiếp được, vì `partial` là trạng thái chốt (tiền đã
hoàn), nên chuỗi bốn mốc trong kế hoạch thực tế là hai nhánh chứ không phải
một.

Trang của khách **không** hiện tên nhà cung cấp hay tên admin — mọi mốc không
do chính khách tạo đều ghi là "hệ thống". Trang admin hiện tên thật.

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

**Đã làm xong.** Bảng `Callback` là hàng đợi, không phải gọi thẳng lúc đơn
chốt — server của đại lý sẽ có lúc sập, và đó đúng là lúc cái tin nhắn này quan
trọng nhất. Hàng đợi được ghi **trong cùng transaction** với việc đổi trạng
thái, nên không có khe hở nào mà đơn đã completed còn hàng đợi thì trống. Ghi
từ đúng một chỗ: `recordOrderStep`, chính là nút thắt đã dựng ở mục 2.

Chữ ký HMAC-SHA256 trên **đúng chuỗi byte gửi đi**, khoá là API key của đại lý —
họ đã có sẵn khoá đó, không phải nhớ thêm bí mật thứ hai. Trạng thái trong
payload dùng đúng chữ hoa như action `status` trả về (`Completed`, chứ không
phải `completed`), để đại lý chỉ phải xử lý một bộ chuỗi.

Thử lại giãn theo cấp số nhân (1, 2, 4, 8… phút, trần 60), bỏ cuộc sau N lần
cấu hình được, và **mã lỗi hiện ngay trên trang API của đại lý** để họ tự sửa.

**Một thứ kế hoạch không nói tới mà bắt buộc phải có.** Địa chỉ callback do
khách gõ, còn request thì đi ra từ server của panel — nên nếu không chặn, mỗi
tài khoản đại lý trở thành một đường để dò mạng nội bộ của panel: endpoint
metadata của nhà cung cấp đám mây, database trên localhost, bất cứ thứ gì server
với tới được. Panel từ chối địa chỉ trỏ vào dải riêng, loopback, link-local
(`169.254.169.254`), CGNAT — **kiểm tra trên địa chỉ đã phân giải**, vì một tên
miền của kẻ tấn công có thể trỏ về 127.0.0.1 bất cứ lúc nào — và không đi theo
redirect. Bật sẵn; panel nào thật sự cần gọi vào mạng nhà thì tắt được.

**Chứng minh.** Gõ vào form thật trên `/dashboard/api`: loopback, metadata đám
mây, dải riêng, và `localhost` bằng tên — cả bốn đều bị từ chối, không lưu. Tắt
chặn thì lưu được. Đặt đơn qua API thật, chốt qua cron thật với nguồn giả:
callback vào hàng đợi, gửi đi, **máy chủ nhận tự kiểm chữ ký bằng API key và
khớp**; đổi một byte thì chữ ký sai. Cho máy chủ trả 500: thử lại đúng ba lần
theo cấu hình, giãn 2 → 4 phút, rồi chuyển `failed` với `HTTP 500` ghi trên
dòng, và **không thử lại nữa**.

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

**Đã làm xong.** Trạng thái đơn mới `held`: đã trừ tiền, chưa gửi đi đâu, và
**không mua hàng sỉ lên panel cha** cho tới khi có người duyệt. Admin duyệt thì
lúc đó mới dựng chuỗi đơn lên trên; từ chối thì đi qua đúng đường huỷ cũ, hoàn
tiền một lần.

Ba luật, mặc định tắt hết:
- cùng link từ N tài khoản khác nhau trong X giờ → **giữ**
- tài khoản dưới X phút tuổi, hoặc chưa nạp lần nào, đặt đơn quá mức trần →
  **giữ**
- danh sách chặn link/tài khoản → **từ chối thẳng, không trừ tiền**. Khác kế
  hoạch ban đầu: giá trị trong danh sách là do chính admin gõ vào, đưa ngược
  lại cho họ duyệt là chạy vòng tròn.

Khách **không** thấy đơn mình đang bị soi: `held` hiện ra là "Chờ xử lý" ở mọi
chỗ khách nhìn thấy, kể cả API v2 — nói ra là chỉ đường cho người muốn lách, và
là buộc tội nhầm số đông khách thật vướng luật do vô tình. Khách vẫn tự huỷ được
đơn đang giữ, vì lúc đó chưa mua gì cả.

**Chứng minh.** Ba tài khoản cùng đặt một link qua API thật, ngưỡng 3: hai cái
đầu chạy, cái thứ ba bị giữ, không có mã đơn nhà cung cấp và không sinh đơn
chuỗi nào. Link khác của cùng tài khoản đó vẫn chạy. Link/tài khoản trong danh
sách chặn bị từ chối và **không tạo đơn**. Tài khoản 5 phút tuổi và tài khoản
chưa nạp bao giờ đều bị giữ khi vượt trần, tài khoản cũ thì không, và đơn nhỏ
của chính tài khoản mới đó cũng không. Bấm nút trong admin thật: duyệt → đơn về
`pending`, dòng thời gian ghi `held -> pending by admin`; từ chối → huỷ và tiền
về ví đủ.

---

## 6. Theo dõi thứ hạng tìm kiếm

**Làm gì.** Admin nhập từ khoá; cron sẵn có tự đi đo theo lịch cấu hình được.
Hai nguồn, chọn trong admin, **không hardcode gì cả**:

- **Search Console** — Google nói về chính site của bạn. Miễn phí, chính xác,
  nhưng chỉ thấy từ khoá bạn **đã** có mặt; nó không nói được "bạn không nằm ở
  đâu cả". Xác thực bằng **service account**, không phải OAuth cá nhân — báo
  cáo chạy không người trông, mà token gắn với tài khoản Google của một người
  thì hỏng đúng hôm người đó nghỉ việc.
- **SERP API trả phí** — thấy cả từ khoá bạn chưa lọt top. Không gắn cứng vào
  hãng nào: endpoint có `{query}`, `{country}`, `{key}`, thêm hai ô chỉ đường
  tới danh sách kết quả trong JSON. Bạn mua dịch vụ nào cũng trỏ vào được.

**Cố ý không có nguồn thứ ba tự vào google.com đọc.** Vi phạm điều khoản của
Google, bị chặn sau vài chục lượt, và một panel để IP máy chủ của mình bị gắn
cờ là đã đổi một bản báo cáo lấy chính khả năng hiển thị của nó.

**Chứng minh.** Dựng hai máy chủ nói đúng giao thức của từng nguồn. Phía Google:
sinh khoá RSA thật, **máy chủ tự xác minh chữ ký JWT panel ký** — đúng chữ ký,
đúng scope read-only, đúng property, đúng chiều `["query","page"]`, và cửa sổ
ngày kết thúc **trước hôm nay** (Search Console trễ vài ngày). Hạng 4,4 làm tròn
thành 4; một từ khoá ra hai trang thì trang tốt hơn thắng. Chạy cron lần hai
trong khoảng thời gian chờ: **không gọi lại**, không ghi trùng lịch sử. Đẩy
`checkedAt` về quá khứ rồi chạy lại: hạng mới thay hạng cũ, hạng cũ giữ lại để
vẽ mũi tên. Làm hỏng cấu hình: lý do hiện trên đúng dòng đó, **hạng tốt cuối
cùng không bị xoá**. Đổi sang SERP API: mỗi từ khoá một lượt tìm, `{country}` và
`{key}` truyền đúng, tìm ra site trong danh sách, lỗi cũ tự hết, và bản ghi mới
ghi tên đúng nguồn chứ không phải Google.

**Cỡ.** Vừa.

---

## Thứ tự đề xuất

1 → 2 → 4 → 3, rồi (6). **Đã làm xong cả năm.**

Lý do thứ tự: (1) là chế độ hỏng im lặng, sửa trước mọi thứ. (2) là thứ (4) và
bộ phận hỗ trợ đều cần để làm việc. (3) mang lại doanh thu đại lý nhưng không
cứu ai khi hỏng.

## Đã loại, và vì sao

- **Tool buff / kịch bản seeding / spam fanpage** — gian lận nền tảng, tôi
  không viết.
- **Bóc link video 23 nền tảng** — vi phạm ToS và thường là công cụ vi phạm bản
  quyền. Khung công cụ thì dựng được, phần bóc link thì không.
- **Marketing AI** — bạn đã bảo bỏ.
- **Công cụ miễn phí** — đã làm rồi bạn bảo bỏ, đã xoá sạch.
- **Biên lai nạp tiền** — làm xong rồi bạn bảo bỏ, đã gỡ sạch: trang in, cột
  thông tin xuất biên lai trên `User`, cấu hình bên phát hành, và migration.
- **Rank tracker** — **đã làm**, không bắt bạn chọn nữa: cả hai nguồn đều cấu
  hình trong admin, điền xong là cron tự chạy. Xem mục 6.
