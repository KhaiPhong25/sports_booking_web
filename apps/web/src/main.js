import "./styles/main.css";
import "leaflet/dist/leaflet.css";
import { mountShell, renderShell } from "./shell.js";
import {
  mountAuthPage,
  renderLoginPage,
  renderRegisterPage,
} from "./pages/auth.js";
import {
  mountOwnerApplication,
  renderOwnerApplication,
} from "./pages/owner-application.js";
import {
  mountPublicVenues,
  mountPublicVenueDetail,
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
import {
  mountAdminDashboard,
  renderAdminDashboard,
} from "./pages/admin-dashboard.js";
import { mountAdminUsers, renderAdminUsers } from "./pages/admin-users.js";
import {
  mountAdminOwnerApplications,
  mountAdminVenues,
  renderAdminOwnerApplications,
  renderAdminVenues,
} from "./pages/admin-moderation.js";
import {
  mountAdminAuditLogs,
  renderAdminAuditLogs,
} from "./pages/admin-audit.js";
import { mountProfilePage, renderProfilePage } from "./pages/profile.js";
import {
  redirectForRoute,
  workspaceHome,
} from "./services/route-access.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("Missing #app root element");
}
const routes = {
  "/": renderPublicVenues,
  "/login": renderLoginPage,
  "/register": renderRegisterPage,
  "/owner/apply": renderOwnerApplication,
  "/admin": renderAdminDashboard,
  "/admin/users": renderAdminUsers,
  "/admin/owner-applications": renderAdminOwnerApplications,
  "/owner": renderOwnerDashboard,
  "/owner/calendar": renderOwnerCalendar,
  "/owner/venues": renderOwnerVenuesPage,
  "/admin/venues": renderAdminVenues,
  "/admin/audit-logs": renderAdminAuditLogs,
  "/owner/schedule": renderOwnerSchedulePricing,
  "/bookings": renderCustomerBookings,
  "/notifications": renderNotifications,
  "/owner/bookings": renderOwnerBookings,
  "/profile": () => renderProfilePage(authApi.user()),
};
async function initialize() {
  try {
    await authApi.ensureSession();
  } catch {
    authApi.clearSession();
  }
  const user = authApi.user();
  const redirect = redirectForRoute(
    window.location.pathname,
    window.location.search,
    user,
  );
  if (redirect) {
    if (user && !workspaceHome(user.roles ?? [])) {
      await authApi.logout().catch(() => authApi.clearSession());
    }
    window.location.assign(redirect);
    return;
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
    ? renderShell(renderPage(), authApi.user(), window.location.pathname)
    : renderShell(
        venueDetailMatch || bookingDetailMatch || ownerBookingDetailMatch
          ? `<p role="status">Đang tải ${venueDetailMatch ? "địa điểm" : "booking"}…</p>`
          : undefined,
        authApi.user(),
        window.location.pathname,
      );
  mountShell(app);
  if (renderPage) mountAuthPage(app);
  if (window.location.pathname === "/owner/apply") mountOwnerApplication(app);
  if (window.location.pathname === "/admin/owner-applications") {
    mountAdminOwnerApplications(app);
  }
  if (window.location.pathname === "/admin") mountAdminDashboard(app);
  if (window.location.pathname === "/admin/users") mountAdminUsers(app);
  if (window.location.pathname === "/admin/audit-logs")
    mountAdminAuditLogs(app);
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
  if (window.location.pathname === "/profile") void mountProfilePage(app);
  if (venueDetailMatch) mountPublicVenueDetail(app, venueDetailMatch[1]);
  if (ownerBookingDetailMatch) {
    mountOwnerBookingDetail(app, ownerBookingDetailMatch[1]);
  } else if (bookingDetailMatch) {
    mountCustomerBookingDetail(app, bookingDetailMatch[1]);
  }
}

void initialize();
