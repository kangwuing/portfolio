# TOEIC Reading Lab

Ứng dụng ôn ETS 2026 TOEIC Reading Test 1–2, được đặt trong [`toeic-study/`](toeic-study/).

Các chức năng chính:

- dashboard và hệ thống học 4 bước;
- 360 từ/cụm B1–C1 theo nhóm đồng nghĩa;
- 75 cấu trúc ngữ pháp theo nhóm chức năng;
- flashcards, quiz 10 câu và lưu tiến độ bằng trình duyệt;
- bộ lọc Test, Part, CEFR, mức ưu tiên và trạng thái;
- giao diện responsive, triển khai tĩnh bằng GitHub Pages.

## Chạy cục bộ

Phục vụ thư mục repository bằng một static web server, sau đó mở `/toeic-study/`.

## Triển khai

Workflow `.github/workflows/deploy-toeic-pages.yml` đóng gói riêng thư mục `toeic-study/` và triển khai lên GitHub Pages khi có thay đổi trên nhánh `main`.
