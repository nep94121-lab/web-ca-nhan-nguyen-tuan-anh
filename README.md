# Web cá nhân — Nguyễn Tuấn Anh

Mã nguồn toàn bộ dự án, xuất ngày 21/10/2026 (bản 23 trên canvas).

Bản gốc đang sống trên canvas Claude Design:
https://claude.ai/artifact/H4e1Cm8TvYgDMgey7JRqeX

## Cấu trúc thư mục

```
web-ca-nhan-nguyen-tuan-anh/
├── README.md
├── project/                 ← mã nguồn 9 trang + sơ đồ
│   ├── canvas.json          ← vị trí các bảng trên canvas
│   ├── Sitemap.dc.html      ← sơ đồ trang
│   ├── Main.dc.html         ← 00 · Trang chủ
│   ├── Works.dc.html        ← 01 · Tác phẩm
│   ├── WorkDetail.dc.html   ← 01.1 · Chi tiết tác phẩm
│   ├── About.dc.html        ← 02 · Giới thiệu
│   ├── PortraitLab.dc.html  ← 02.1 · Chân dung (7 hiệu ứng ảnh)
│   ├── Journal.dc.html      ← 03 · Nhật ký
│   ├── JournalPost.dc.html  ← 03.1 · Bài viết
│   ├── Commission.dc.html   ← 04 · Đặt dự án (form 4 bước)
│   └── Thanks.dc.html       ← 04.1 · Cảm ơn
└── assets/                  ← toàn bộ 16 ảnh dùng trên web
```

## Định dạng mã nguồn

Mỗi trang là một tệp `.dc.html` theo định dạng của Claude Design. Mỗi tệp gồm:

- **HTML + CSS** nằm trong `<x-dc>` và `<helmet>`. Bạn có thể sửa chữ và màu trực tiếp ở đây.
- **Chỗ trống `{{...}}`**: giá trị do phần JavaScript cuối tệp điền vào. Ví dụ `{{accent}}` là màu nhấn.
- **`<sc-if>` / `<sc-for>`**: hiện có điều kiện và lặp danh sách.
- **JavaScript** trong `<script type="text/x-dc">`, gồm lớp `Component` và hàm `renderVals()`. Phần này chứa dữ liệu (danh sách tác phẩm, bài viết…) và các tương tác (lọc, kéo thả, hiệu ứng).

Lưu ý quan trọng:

- Các tệp chạy bên trong canvas Claude Design, nhờ tệp `support.js` của Claude. Tệp này không nằm trong gói này. Mở `.dc.html` trực tiếp bằng trình duyệt sẽ chỉ thấy khung trắng hoặc mã thô.
- Ảnh trong mã được gọi bằng đường dẫn `/_blob/<mã>`. Bảng dưới đây cho biết mỗi mã ứng với tệp nào trong `assets/`.
- Muốn đưa web lên tên miền riêng (GitHub Pages, Vercel, Netlify…) thì cần chuyển sang HTML/CSS/JS thường. Claude có thể làm việc này cho bạn.

## Bảng ảnh

| Đường dẫn trong mã | Tệp trong gói | Nội dung |
|---|---|---|
| `/_blob/2dfe8bf3b1450e792096c28c7430a508` | `assets/chan-dung-anh-goc.jpg` | Ảnh chân dung gốc (cắt 4:5) |
| `/_blob/8b3ccd25421622e7159367cc161d69b8` | `assets/chan-dung-tach-nen.webp` | Ảnh chân dung đã tách nền |
| `/_blob/618c1af3907225f2605c3d89c62bd96c` | `assets/tp02-poster-dien-vua-du.webp` | Tác phẩm 02 · Poster “Điên vừa đủ” |
| `/_blob/80535c369d55d41873b43749680ba93e` | `assets/tp03-minh-hoa-long-bien.webp` | Tác phẩm 03 · Minh họa “Long Biên, 5 giờ sáng” |
| `/_blob/b1114a6e341fee3d913c0dbc719aaae2` | `assets/tp04-nhan-dien-gac-xep.webp` | Tác phẩm 04 · Nhận diện “Gác Xép” |
| `/_blob/950d916a2103e84df23e30b44bf91101` | `assets/tp05-3d-can-bang-gia.webp` | Tác phẩm 05 · 3D “Cân bằng giả” |
| `/_blob/e6dda941d38e6e2b7ebe29d21f804cf2` | `assets/tp01-giao-dien-di-lac.webp` | Tác phẩm 01 · Giao diện “Đi lạc” |
| `/_blob/5c7bd031a4aa5734c27fc7388907c0af` | `assets/tp06-tao-sinh-dem-pho.webp` | Tác phẩm 06 · Tạo sinh “Đêm phố” |
| `/_blob/ba35d4e2d42f76a23e2811874855e02d` | `assets/trangchu-manh-xe-poster.webp` | Trang chủ · mảnh giấy xé (poster) |
| `/_blob/a423d9596a472000b5c35702848b8e4b` | `assets/trangchu-manh-xe-dem-pho.webp` | Trang chủ · mảnh giấy xé (Đêm phố) |
| `/_blob/e360ecb345186299a175c9ecb988d921` | `assets/trangchu-manh-xe-gac-xep.webp` | Trang chủ · mảnh giấy xé (Gác Xép) |
| `/_blob/ab3f89d19f728d4264d50cef9a7152af` | `assets/chandung-nhan-dan.webp` | Chân dung · nhãn dán viền trắng |
| `/_blob/bd4dc96fe2e52467804fb63ec4cbff26` | `assets/chandung-manh-thua.webp` | Chân dung · mảnh giấy thừa sau khi cắt |
| `/_blob/e2a2c579e9bc86263bfa1a879609cd4d` | `assets/chandung-muc-loang.webp` | Chân dung · bản mực xanh (hiệu ứng mực loang) |
| `/_blob/687277fe3aa253132c17187592f0686c` | `assets/chandung-riso-xanh.webp` | Chân dung · bản in riso màu xanh |
| `/_blob/768e50fd17905c1ce8a967a20115cd3d` | `assets/chandung-riso-hong.webp` | Chân dung · bản in riso màu hồng |

## Thông tin cá nhân đang dùng trên web

- Tên: Nguyễn Tuấn Anh — thiết kế nghệ thuật, Hà Nội
- Email: nguyentuananh512005@gmail.com
- Zalo / điện thoại: 0375 492 993
- Facebook: https://www.facebook.com/nguyen.tuan.anh.174068

## Chỗ còn để trống (tìm dấu ngoặc vuông `[...]`)

- `[Năm]` — các mốc trong dòng thời gian (About.dc.html)
- `[Tên dự án]` — dự án tự do đầu tiên (About.dc.html)
- `[số ngày]`, `[số tuần]` — thời gian phản hồi và thời gian làm (Commission, Thanks)
- `[mã tự sinh]` — mã yêu cầu ở trang Cảm ơn (Thanks)

## Ghi chú

- 6 tác phẩm trong `assets/tp01…tp06` là sản phẩm mẫu Claude dựng để minh họa, mỗi lĩnh vực một cái. Khi có sản phẩm thật, bạn thay ảnh và sửa danh sách tác phẩm trong phần JavaScript của Main, Works và WorkDetail.
- Bài viết trong Nhật ký là bài mẫu.
