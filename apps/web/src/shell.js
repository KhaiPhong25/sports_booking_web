export function renderShell(content, user = null) {
  const roles = user?.roles ?? [];
  const ownerNavigation = roles.includes("OWNER")
    ? `<nav class="owner-nav" aria-label="Điều hướng chủ sân">
        <a href="/owner">Tổng quan owner</a>
        <a href="/owner/calendar">Lịch booking</a>
        <a href="/owner/bookings">Quản lý booking</a>
        <a href="/owner/venues">Quản lý sân</a>
        <a href="/owner/schedule">Lịch & giá</a>
      </nav>`
    : "";
  const adminNavigation = roles.includes("ADMIN")
    ? `<nav class="admin-nav" aria-label="Điều hướng quản trị">
        <a href="/admin">Tổng quan admin</a>
        <a href="/admin/users">Người dùng</a>
        <a href="/admin/owner-applications">Hồ sơ owner</a>
        <a href="/admin/venues">Kiểm duyệt sân</a>
        <a href="/admin/audit-logs">Audit</a>
      </nav>`
    : "";
  return `
    <a class="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <header class="site-header">
      <a class="brand" href="/">Đặt Sân</a>
      <nav aria-label="Điều hướng chính">
        <a href="/">Tìm sân</a>
        <a href="/bookings">Booking của tôi</a>
        <a href="/notifications">Thông báo</a>
        <a href="/login">Đăng nhập</a>
        <a href="/register">Đăng ký</a>
        <a href="/owner/apply">Trở thành chủ sân</a>
      </nav>
      ${ownerNavigation}
      ${adminNavigation}
    </header>
    <main id="main-content">${
      content ??
      `
      <section class="hero" aria-labelledby="hero-title">
        <p class="eyebrow">Thành phố Hồ Chí Minh</p>
        <h1 id="hero-title">Tìm sân phù hợp với lịch của bạn</h1>
        <p>Tìm bóng đá, bóng rổ và cầu lông theo khu vực và giờ trống.</p>
      </section>`
    }
    </main>`;
}
