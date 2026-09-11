# Ma trận phân quyền

| Hành động                                 | Public | Customer |                          Owner |                       Admin |
| ----------------------------------------- | -----: | -------: | -----------------------------: | --------------------------: |
| Xem venue đã duyệt và search availability |     Có |       Có |                             Có |                          Có |
| Quote giá public                          |     Có |       Có |                             Có |                          Có |
| Tạo/hủy booking của chính mình            |  Không |       Có |        Có với tư cách customer |              Không mặc định |
| Gửi owner application                     |  Không |       Có |          Không nếu đã là owner |                       Không |
| CRUD venue/offering/court                 |  Không |    Không |          Chỉ tài nguyên sở hữu | Không; admin chỉ moderation |
| Xử lý booking                             |  Không |    Không | Chỉ booking thuộc venue sở hữu |              Không mặc định |
| Duyệt owner/venue, lock user              |  Không |    Không |                          Không |              Có, luôn audit |
| Xem lịch sử audit quản trị                |  Không |    Không |                          Không |                          Có |

Mỗi policy nhận `principal.userId`, `principal.roles` và resource đã load từ database. Không dùng `ownerId` do client gửi để ra quyết định.

Admin có thể khóa/mở khóa tài khoản khác nhưng không được tự khóa tài khoản đang thực hiện request. Response danh sách user không bao giờ chứa password hash, refresh session hoặc security version. Query audit chỉ là read-only và vẫn bắt buộc access token hiện hành cùng role `ADMIN`.
