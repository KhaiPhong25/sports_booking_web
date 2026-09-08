export function renderShell() {
  return `
    <header class="site-header">
      <a class="brand" href="/">Đặt Sân</a>
      <nav aria-label="Điều hướng chính">
        <a href="/">Tìm sân</a>
        <a href="/login">Đăng nhập</a>
      </nav>
    </header>
    <main id="main-content">
      <section class="hero" aria-labelledby="hero-title">
        <p class="eyebrow">Thành phố Hồ Chí Minh</p>
        <h1 id="hero-title">Tìm sân phù hợp với lịch của bạn</h1>
        <p>Tìm bóng đá, bóng rổ và cầu lông theo khu vực và giờ trống.</p>
      </section>
    </main>`;
}
