# Sports Booking Web — Urban Performance Redesign

**Ngày:** 2026-09-14  
**Trạng thái:** Chờ duyệt trước khi lập implementation plan  
**Phạm vi:** Toàn bộ giao diện public, customer, owner và admin trong `apps/web`

## 1. Mục tiêu

Thiết kế lại toàn bộ frontend theo một design system hiện đại, tối giản và giàu tinh thần thể thao, đồng thời giữ nguyên API contract, nghiệp vụ, accessibility và các critical journey hiện có.

Kết quả cần đạt:

- Public landing/search tạo ấn tượng mạnh và giúp tìm sân nhanh.
- Customer booking flow rõ ràng, tạo cảm giác tin cậy và ít ma sát.
- Owner/admin có workspace vận hành chuyên nghiệp, đọc dữ liệu nhanh.
- Tất cả màn hình dùng chung màu sắc, typography, spacing, component và motion.
- Mobile 375 px đến desktop lớn không tràn ngang hoặc mất chức năng.
- Ảnh hero thể thao nguyên bản được tạo riêng cho dự án và lưu trong workspace.
- Không đổi backend, endpoint hoặc dữ liệu authoritative.

## 2. Hướng thiết kế đã chọn

Tên concept: **Urban Performance**.

Tinh thần hình ảnh là sân thể thao đô thị về chiều tối: nền navy sâu, bề mặt sáng sạch, đường kẻ sân và ánh đèn lime được sử dụng tiết chế. Giao diện cần mạnh mẽ nhưng không giống gaming, không neon quá mức và không dùng gradient tím phổ biến của template AI.

Ba nguyên tắc:

1. **Nhanh:** search và tác vụ chính luôn nổi bật.
2. **Rõ:** status, price, time và ownership có thứ bậc thị giác mạnh.
3. **Có nhịp:** layout, đường kẻ và motion gợi chuyển động thể thao nhưng không gây phân tâm.

## 3. Ràng buộc kỹ thuật

- Giữ Vite + HTML/CSS/JavaScript ES modules; không migrate React/Tailwind.
- Không thêm UI framework hoặc runtime dependency lớn.
- Giữ các label, role, route, `data-*` hook và hành vi mà unit/E2E tests đang dựa vào, trừ khi test được cập nhật có chủ đích cho markup mới.
- Dữ liệu API được escape trước khi đưa vào HTML.
- Access token tiếp tục ở memory; refresh cookie và route protection không đổi.
- Leaflet, API client, timezone conversion và idempotency behavior không đổi.
- Mọi ảnh project-bound phải nằm trong `apps/web/public/assets/` và được tham chiếu bằng URL local.

## 4. Design tokens

Tokens sẽ nằm ở đầu `styles/main.css` dưới dạng CSS custom properties.

### 4.1 Màu

| Token                 | Giá trị dự kiến | Dùng cho                             |
| --------------------- | --------------- | ------------------------------------ |
| `--color-primary-950` | `#081724`       | Header, hero, text đậm.              |
| `--color-primary-800` | `#12324A`       | Surface tối, hover navy.             |
| `--color-primary-600` | `#18516E`       | Link/action phụ.                     |
| `--color-accent-500`  | `#B8D93D`       | CTA chính, active marker, điểm nhấn. |
| `--color-accent-300`  | `#D8EB8A`       | Accent surface nhẹ.                  |
| `--color-surface`     | `#FFFFFF`       | Card và form.                        |
| `--color-canvas`      | `#F3F5F2`       | Nền ứng dụng.                        |
| `--color-line`        | `#DCE3DE`       | Border.                              |
| `--color-muted`       | `#61706A`       | Secondary text.                      |
| `--color-danger`      | `#B3473F`       | Destructive/error.                   |
| `--color-warning`     | `#B7791F`       | Pending/warning.                     |
| `--color-success`     | `#247A58`       | Confirmed/success.                   |

Lime chỉ dùng cho CTA, focus/active và chi tiết đường sân; body text không dùng lime trên nền sáng. Semantic colors vẫn phân biệt status, không ép mọi trạng thái về brand color.

### 4.2 Typography

- Font stack self-host-free: `Inter`, `Avenir Next`, `Segoe UI`, system sans-serif.
- Display heading dùng weight 800–900, line-height chặt, letter-spacing âm nhẹ.
- Eyebrow/status dùng uppercase, size nhỏ và tracking rộng.
- Body giữ 16 px tối thiểu trên mobile.
- Số liệu dashboard và giá dùng tabular numerals.

Không tải Google Fonts để tránh thêm network dependency và layout shift.

### 4.3 Spacing, shape và shadow

- Spacing scale dựa trên 4 px: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Container content tối đa khoảng 1200–1280 px.
- Card radius 18–24 px; input/button 12–14 px; pill bo tròn hoàn toàn.
- Shadow mềm, thiên navy, opacity thấp; hover tăng elevation rất nhẹ.
- Border 1 px vẫn giữ để card rõ trên màn hình độ tương phản thấp.

### 4.4 Motion

- Transition 160–240 ms cho color, border, transform và shadow.
- Card hover nâng 2–4 px; CTA có press state.
- Page/section reveal nhẹ bằng opacity + translate, không stagger dài.
- Loading dùng skeleton shimmer tinh tế nếu bổ sung.
- `prefers-reduced-motion: reduce` tắt animation và gần như triệt tiêu transition.

## 5. Asset hình ảnh

Tạo một ảnh hero landscape bằng built-in image generation:

- sân thể thao đa năng đô thị lúc blue hour;
- đèn sân mạnh, bề mặt sân có đường kẻ tinh tế;
- có vận động viên ở xa để tạo năng lượng nhưng không có gương mặt nhận diện;
- vùng negative space bên trái hoặc giữa cho heading/search overlay;
- palette navy, xanh sân tự nhiên và accent lime nhẹ;
- không chữ, logo, watermark, nhãn hiệu hoặc signage.

Ảnh cuối sẽ được kiểm tra trực quan, tối ưu định dạng/kích thước hợp lý và lưu tại `apps/web/public/assets/sports-hero.*`. Venue không có ảnh sẽ dùng fallback có texture/gradient code-native thay vì lặp hero.

## 6. Information architecture và shell

### 6.1 Global shell

Desktop:

- Sticky top bar với brand mark code-native, nav chính và account actions.
- Public/customer navigation ngắn gọn: Tìm sân, Booking, Thông báo.
- Owner/admin có role switch context và secondary workspace navigation rõ ràng.
- Active route được chỉ báo bằng shape/color và `aria-current="page"`.

Mobile:

- Header hai hàng gọn; brand + account ở hàng đầu.
- Role navigation thành horizontal scroll chips hoặc compact grid, không hamburger JavaScript phức tạp.
- Touch target tối thiểu khoảng 44 px.
- Skip link và keyboard order tiếp tục hoạt động.

`renderShell()` sẽ nhận pathname hiện tại để render active state. Nếu chưa đăng nhập, CTA Đăng nhập/Đăng ký rõ ràng; nếu đã đăng nhập, hiển thị tên/role ngắn gọn nhưng không thêm endpoint mới.

### 6.2 Page primitives

Các pattern dùng chung được chuẩn hóa bằng class/markup helper khi có lợi:

- page container và section header;
- button primary/secondary/ghost/danger;
- input/select/textarea với label và hint;
- status pill;
- metric card;
- content card/list row;
- empty/error/loading state;
- toolbar/filter surface;
- pagination;
- detail definition grid.

Không tạo abstraction JavaScript cho mọi đoạn HTML. Chỉ tách helper thực sự lặp lại và có contract ổn định, ví dụ icon, status, page header hoặc empty state.

## 7. Thiết kế theo nhóm trang

### 7.1 Public landing và search

Route `/` trở thành landing có chiều sâu hơn:

1. Hero ảnh thể thao full-bleed trong container bo lớn.
2. Brand statement ngắn, CTA và trust microcopy.
3. Search panel nổi trên/đáy hero, vẫn giữ đủ sport, area, date, start/end.
4. Quick sport chips lấy từ catalog.
5. Venue result grid với media area, location, sport tags và availability indicator.
6. Value strip giải thích xác nhận rõ, giá minh bạch và lịch theo thời gian thực.

Khi đã search, kết quả là trọng tâm và criteria tiếp tục ở URL. Empty state phân biệt “chưa có venue” với “không còn sân trong khung giờ”. Không đưa số liệu giả có thể gây hiểu nhầm.

### 7.2 Venue detail và booking widget

- Gallery lớn nếu venue có ảnh; fallback brand surface nếu không có.
- Tên, địa chỉ, amenity và sport hierarchy rõ.
- Layout desktop hai cột: nội dung/map bên trái, booking/quote card sticky bên phải.
- Mobile xếp booking card ngay sau thông tin offering.
- Confirmation mode, giá quote và login requirement được diễn giải trực tiếp.
- Map giữ region label và fallback khi tile/provider lỗi.

### 7.3 Authentication và owner application

- Split layout desktop: ảnh/brand story và form card; mobile chỉ giữ header hình ảnh compact.
- Input lớn, hierarchy rõ, copy chân thực.
- Register giải thích phone chưa OTP trong MVP mà không làm yếu cảm giác an toàn.
- Return path sau login giữ nguyên.
- Owner application có progress/context panel giải thích quy trình review.

### 7.4 Customer workspace

- Booking list dùng card/row responsive với time, venue, sport, price và status nổi bật.
- Filter bar gọn, có thể wrap tự nhiên trên tablet/mobile.
- Detail có summary band và action zone tách khỏi metadata.
- Notification list giống activity feed; unread có marker và surface khác biệt, không chỉ dựa vào màu.
- Empty/error state đều có hành động quay về tìm sân hoặc retry.

### 7.5 Owner workspace

- Dashboard: dark welcome band + metric grid + operational shortcuts.
- Calendar: desktop 7 cột; tablet/mobile chuyển sang day stack, không ép bảng thu nhỏ.
- Booking management: filter toolbar, operational cards, detail action panel.
- Venue inventory: venue accordion/card có summary trước, form edit trong details; offering/court nested hierarchy rõ.
- Schedule/pricing: tách ba section giờ hoạt động, closure và giá bằng tab-like visual sections hoặc stacked panels, giữ form semantics hiện tại.
- Các destructive actions luôn khác biệt và vẫn có confirm hiện tại.

### 7.6 Admin workspace

- Dashboard dùng cùng workspace shell với owner nhưng accent/context “System control”.
- User list hiển thị identity, role, account state và action thành row/card responsive.
- Moderation tạo review queue rõ ràng; approve là primary, reject/hide là danger secondary.
- Audit log dùng timeline/data-card, before/after JSON trong expandable panel với monospace surface.
- Pagination và filters dùng component style chung.

## 8. Responsive behavior

Các breakpoint định hướng, không phụ thuộc cứng vào thiết bị:

- Mobile: dưới 640 px, một cột, full-width action, navigation scroll/stack.
- Tablet: 640–959 px, grid hai cột khi phù hợp.
- Desktop: từ 960 px, hero/detail split và workspace navigation đầy đủ.
- Wide: từ 1280 px chỉ tăng khoảng trắng/container, không kéo line length quá dài.

Yêu cầu bắt buộc:

- Không horizontal overflow ở 375 px.
- Form controls không nhỏ hơn touch target.
- Calendar/list đổi layout thay vì shrink chữ.
- Hình ảnh dùng `object-fit`, aspect ratio và responsive sizing.
- Sticky element tự bỏ sticky trên màn hình thấp/hẹp nếu gây che nội dung.

## 9. Accessibility

- Giữ semantic landmarks, heading order, form label, live region và skip link.
- Focus ring lime/vàng nhạt có contrast rõ trên cả nền tối/sáng.
- Status luôn có text/icon/shape, không truyền nghĩa chỉ bằng màu.
- `aria-current` cho route active; icon trang trí có `aria-hidden`.
- Button/link giữ đúng semantic, không dùng clickable `<div>`.
- Ảnh hero là decorative nếu không bổ sung thông tin; venue image dùng alt text từ API.
- Color combinations chính phải đạt WCAG AA cho normal text.
- Reduced motion được tôn trọng.

## 10. Data flow và error handling

API calls, payload và state mutations giữ nguyên. Redesign chỉ thay presentation và một số helper markup.

Mỗi trang phải có đủ:

- loading state không gây layout collapse;
- empty state có hướng đi tiếp;
- error state dùng `role="alert"` hoặc live status phù hợp;
- disabled/busy state ngăn double submit;
- success feedback không biến mất quá nhanh;
- fallback hình ảnh/map khi asset hoặc provider lỗi.

Không thêm dữ liệu giả vào response runtime. Nội dung marketing tĩnh chỉ mô tả khả năng thực sự của MVP.

## 11. Phạm vi file dự kiến

Chỉnh sửa:

- `apps/web/index.html` cho metadata/theme color và asset hints nếu cần.
- `apps/web/src/styles/main.css` để triển khai tokens, components và responsive system.
- `apps/web/src/shell.js`, `main.js` cho shell/active navigation/page chrome.
- Tất cả file `apps/web/src/pages/*.js` để áp dụng hierarchy/class mới.
- Helper trong `apps/web/src/components/` và `services/` chỉ khi cần cho UI dùng chung.
- Unit tests cùng page/service và Playwright tests nếu markup contract thay đổi có chủ đích.
- `apps/web/public/assets/` cho ảnh được tạo.

Không chỉnh sửa:

- API/worker/database schema và contract.
- Auth/session model.
- Booking, pricing, scheduling hoặc notification business rules.

## 12. Chiến lược triển khai

Triển khai theo lát cắt để mỗi bước vẫn chạy được:

1. Design tokens, reset, primitives và shell.
2. Hero asset + public landing/search/venue detail.
3. Auth, owner application, customer booking/notification.
4. Owner workspace.
5. Admin workspace.
6. Responsive/accessibility/motion polish.
7. Full verification và browser visual inspection.

Không giữ song song CSS cũ/mới lâu dài. Class cũ chỉ được giữ khi là test/behavior hook; style legacy không còn dùng sẽ bị loại để tránh specificity drift.

## 13. Kiểm thử và tiêu chí chấp nhận

### Automated

- `npm test -w @sports-booking/web` đạt.
- `npm run typecheck -w @sports-booking/web` đạt.
- `npm run lint -w @sports-booking/web` đạt.
- `npm run build -w @sports-booking/web` đạt.
- `npm run test:e2e -w @sports-booking/web` đạt cả customer, owner, admin và mobile.
- Root `npm run format:check` đạt.

### Visual/UX

- Kiểm tra tối thiểu ở 375×812, 768×1024, 1440×900.
- Không overflow, clipped control, unreadable text hoặc sticky overlap.
- Landing có focal point rõ và search dùng được ngay.
- Public/customer/owner/admin nhìn cùng một thương hiệu nhưng khác mật độ phù hợp.
- Các status/action quan trọng nhận biết được khi nhìn nhanh.
- Keyboard focus luôn thấy; reduced-motion không có animation đáng kể.
- Asset hero tải local, không có chữ/logo/watermark và không làm chữ overlay khó đọc.

## 14. Ngoài phạm vi redesign

- Không thêm payment, review, chat hoặc tính năng backend mới.
- Không thay router bằng SPA framework.
- Không tạo dark-mode toggle; hero/workspace có dark surfaces nhưng application canvas vẫn light-first.
- Không thêm chart library; dashboard metric dùng CSS/HTML hiện có.
- Không thay Leaflet/map provider.
- Không đổi nội dung dữ liệu seed hay API chỉ để làm giao diện trông nhiều dữ liệu hơn.

## 15. Quyết định cuối cùng

Redesign sẽ dùng **vanilla HTML/CSS/JavaScript hiện tại**, một **Urban Performance design system thống nhất**, một **hero image nguyên bản**, và áp dụng toàn bộ route trong cùng initiative. Hành vi nghiệp vụ/API được bảo toàn; thay đổi tập trung vào hierarchy, visual language, responsive interaction, accessibility và perceived quality.
