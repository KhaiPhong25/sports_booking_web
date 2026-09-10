export function renderShell(content) {
  return `
    <header class="site-header">
      <a class="brand" href="/">Đặt Sân</a>
      <nav aria-label="Điều hướng chính">
        <a href="/">Tìm sân</a>
        <a href="/login">Đăng nhập</a>
        <a href="/register">Đăng ký</a>
        <a href="/owner/apply">Trở thành chủ sân</a>
        <a href="/owner/venues">Quản lý sân</a>
        <a href="/owner/schedule">Lịch & giá</a>
        <a href="/bookings">Booking của tôi</a>
        <a href="/owner/bookings">Duyệt booking</a>
      </nav>
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
