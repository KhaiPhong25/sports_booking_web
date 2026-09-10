import "./styles/main.css";
import "leaflet/dist/leaflet.css";
import { renderShell } from "./shell.js";
import {
  mountAuthPage,
  renderLoginPage,
  renderRegisterPage,
} from "./pages/auth.js";
import {
  mountAdminOwnerApplications,
  mountOwnerApplication,
  renderAdminOwnerApplications,
  renderOwnerApplication,
} from "./pages/owner-application.js";
import {
  mountAdminVenues,
  mountPublicVenues,
  mountPublicVenueDetail,
  renderAdminVenues,
  renderPublicVenues,
} from "./pages/venues.js";
import { authApi } from "./services/auth-api.js";
import {
  mountCustomerBookings,
  mountCustomerBookingDetail,
  renderCustomerBookings,
} from "./pages/bookings.js";
import {
  mountNotifications,
  renderNotifications,
} from "./pages/notifications.js";
import {
  mountOwnerSchedulePricing,
  renderOwnerSchedulePricing,
} from "./pages/schedule-pricing.js";
import {
  mountOwnerDashboard,
  renderOwnerDashboard,
} from "./pages/owner-dashboard.js";
import {
  mountOwnerCalendar,
  renderOwnerCalendar,
} from "./pages/owner-calendar.js";
import {
  mountOwnerBookingDetail,
  mountOwnerBookings,
  renderOwnerBookings,
} from "./pages/owner-bookings.js";
import {
  mountOwnerVenuesPage,
  renderOwnerVenuesPage,
} from "./pages/owner-venues.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("Missing #app root element");
}
const routes = {
  "/": renderPublicVenues,
  "/login": renderLoginPage,
  "/register": renderRegisterPage,
  "/owner/apply": renderOwnerApplication,
  "/admin/owner-applications": renderAdminOwnerApplications,
  "/owner": renderOwnerDashboard,
  "/owner/calendar": renderOwnerCalendar,
  "/owner/venues": renderOwnerVenuesPage,
  "/admin/venues": renderAdminVenues,
  "/owner/schedule": renderOwnerSchedulePricing,
  "/bookings": renderCustomerBookings,
  "/notifications": renderNotifications,
  "/owner/bookings": renderOwnerBookings,
};
const protectedPaths = ["/owner/", "/admin/", "/bookings", "/notifications"];

async function initialize() {
  if (
    window.location.pathname === "/owner" ||
    protectedPaths.some((prefix) => window.location.pathname.startsWith(prefix))
  ) {
    try {
      await authApi.ensureSession();
    } catch {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
  }
  const renderPage = routes[window.location.pathname];
  const venueDetailMatch =
    window.location.pathname.match(/^\/venues\/([^/]+)$/);
  const bookingDetailMatch = window.location.pathname.match(
    /^\/bookings\/([^/]+)$/,
  );
  const ownerBookingDetailMatch = window.location.pathname.match(
    /^\/owner\/bookings\/([^/]+)$/,
  );
  app.innerHTML = renderPage
    ? renderShell(renderPage())
    : renderShell(
        venueDetailMatch || bookingDetailMatch || ownerBookingDetailMatch
          ? `<p role="status">Đang tải ${venueDetailMatch ? "địa điểm" : "booking"}…</p>`
          : undefined,
      );
  if (renderPage) mountAuthPage(app);
  if (window.location.pathname === "/owner/apply") mountOwnerApplication(app);
  if (window.location.pathname === "/admin/owner-applications") {
    mountAdminOwnerApplications(app);
  }
  if (window.location.pathname === "/") mountPublicVenues(app);
  if (window.location.pathname === "/owner") mountOwnerDashboard(app);
  if (window.location.pathname === "/owner/calendar") mountOwnerCalendar(app);
  if (window.location.pathname === "/owner/venues") mountOwnerVenuesPage(app);
  if (window.location.pathname === "/admin/venues") mountAdminVenues(app);
  if (window.location.pathname === "/owner/schedule")
    mountOwnerSchedulePricing(app);
  if (window.location.pathname === "/bookings") mountCustomerBookings(app);
  if (window.location.pathname === "/notifications") mountNotifications(app);
  if (window.location.pathname === "/owner/bookings") mountOwnerBookings(app);
  if (venueDetailMatch) mountPublicVenueDetail(app, venueDetailMatch[1]);
  if (ownerBookingDetailMatch) {
    mountOwnerBookingDetail(app, ownerBookingDetailMatch[1]);
  } else if (bookingDetailMatch) {
    mountCustomerBookingDetail(app, bookingDetailMatch[1]);
  }
}

void initialize();
