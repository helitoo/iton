# iton

Trình xem tài liệu tĩnh, xây dựng bằng React + Vite + TailwindCSS + React Router DOM.

## Cài đặt

```bash
npm install
```

## Chạy ở chế độ phát triển

```bash
npm run dev
```

## Build production

```bash
npm run build
npm run preview
```

## Thêm nội dung

Đặt các tệp `.md`, `.txt`, `.pdf`, hình ảnh (`.png`, `.jpg`, ...) vào thư mục
`public/content/` (có thể lồng thư mục con tuỳ ý). Khi chạy `npm run dev` hoặc
`npm run build`, một plugin Vite tuỳ chỉnh (xem `vite.config.js`) sẽ tự động
quét thư mục này và sinh ra `public/content-manifest.json` — tệp này được ứng
dụng dùng để dựng thanh điều hướng, định tuyến và tìm kiếm.

- Route `/` tương đương với `/readme` (tức tệp `README.md` ở thư mục gốc).
- Mỗi tệp trong `content/` có một route tương ứng, bỏ phần mở rộng.
- Nếu có nhiều tệp trùng tên, tệp đầu tiên tìm thấy (theo thứ tự alphabet)
  sẽ được ưu tiên hiển thị.

## Cấu trúc thư mục

```
src/
  routers/     Định tuyến ứng dụng (catch-all route -> ContentPage)
  layouts/     Navbar, Sidebar, MainLayout
  components/  Các thành phần dùng lại: SearchBar, SidebarTree, TableOfContents
  utils/       Tiện ích: manifest, cây thư mục, tìm kiếm, cấu hình Markdown...
public/
  content/     Thư mục chứa toàn bộ nội dung tài liệu (md, txt, pdf, ảnh)
```

## Cú pháp Markdown hỗ trợ

Toàn bộ quy tắc parser được tập trung tại `src/utils/markdownConfig.jsx`.

- Tiêu đề `#` đến `######`
- In đậm / in nghiêng
- Danh sách gạch đầu dòng / đánh số, hỗ trợ lồng nhau
- Liên kết ngoài `[text](url)` và nội bộ `[[tên tệp|văn bản tuỳ chọn]]`
- Ảnh ngoài `![](url)` và nội bộ `![[tên tệp]]`
- Bảng biểu (tiêu đề in đậm mặc định)
- Trích dẫn `> abc` và callout: `>[!note]`, `>[!important]`, `>[!tip]`,
  `>[!warning]`, `>[!caution]`
- Toán học: `$...$` (inline) và `$$...$$` (khối, luôn xuống dòng riêng)
- Sơ đồ Mermaid (khối code với ngôn ngữ `mermaid`)
- Đường kẻ ngang `---`
