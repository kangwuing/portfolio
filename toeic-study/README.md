# TOEIC Reading Lab

Web app tĩnh, không có backend và không gửi dữ liệu học ra ngoài. Tiến độ được lưu trong `localStorage` của trình duyệt.

## Dữ liệu

- Test 1: 157 từ/cụm, 32 cấu trúc.
- Test 2: 203 từ/cụm, 43 cấu trúc.
- Test 3: 203 từ/cụm, 43 cấu trúc.
- Tổng: 563 từ/cụm, 118 cấu trúc, 78 mục ưu tiên.

File Excel 3 tab của Test 3 được cung cấp trực tiếp trong ứng dụng và tại `downloads/ETS_2026_Test3_Reading_Study_3Tabs.xlsx`.

CEFR trong workbook là mức ước lượng để ôn tập, không phải nhãn chính thức của ETS.

## Cấu trúc

- `index.html`: giao diện ứng dụng.
- `styles.css`: design system và responsive layout.
- `app.js`: filters, flashcards, quiz và progress tracking.
- `data/study-data.json`: dữ liệu đã chuẩn hóa từ ba bộ Test.
- `downloads/`: file Excel học ngoại tuyến có thể tải trực tiếp.

Không cần build hoặc cài package. Có thể triển khai trực tiếp bằng GitHub Pages.
