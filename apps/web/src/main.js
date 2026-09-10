import "./styles/main.css";
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
  mountOwnerVenues,
  mountPublicVenues,
  mountPublicVenueDetail,
  renderAdminVenues,
  renderOwnerVenues,
  renderPublicVenues,
} from "./pages/venues.js";
import { authApi } from "./services/auth-api.js";
import {
  mountCustomerBookings,
  mountOwnerBookings,
  renderCustomerBookings,
  renderOwnerBookings,
} from "./pages/bookings.js";
import {
  mountOwnerSchedulePricing,
  renderOwnerSchedulePricing,
} from "./pages/schedule-pricing.js";

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
  "/owner/venues": renderOwnerVenues,
  "/admin/venues": renderAdminVenues,
  "/owner/schedule": renderOwnerSchedulePricing,
  "/bookings": renderCustomerBookings,
  "/owner/bookings": renderOwnerBookings,
};
const protectedPaths = ["/owner/", "/admin/", "/bookings"];

async function initialize() {
  if (
    protectedPaths.some((prefix) => window.location.pathname.startsWith(prefix))
  ) {
    try {
      await authApi.ensureSession();
    } catch {
      window.location.assign("/login");
      return;
    }
  }
  const renderPage = routes[window.location.pathname];
  const venueDetailMatch =
    window.location.pathname.match(/^\/venues\/([^/]+)$/);
  app.innerHTML = renderPage
    ? renderShell(renderPage())
    : renderShell(
        venueDetailMatch
          ? '<p role="status">Đang tải địa điểm…</p>'
          : undefined,
      );
  if (renderPage) mountAuthPage(app);
  if (window.location.pathname === "/owner/apply") mountOwnerApplication(app);
  if (window.location.pathname === "/admin/owner-applications") {
    mountAdminOwnerApplications(app);
  }
  if (window.location.pathname === "/") mountPublicVenues(app);
  if (window.location.pathname === "/owner/venues") mountOwnerVenues(app);
  if (window.location.pathname === "/admin/venues") mountAdminVenues(app);
  if (window.location.pathname === "/owner/schedule")
    mountOwnerSchedulePricing(app);
  if (window.location.pathname === "/bookings") mountCustomerBookings(app);
  if (window.location.pathname === "/owner/bookings") mountOwnerBookings(app);
  if (venueDetailMatch) mountPublicVenueDetail(app, venueDetailMatch[1]);
}

void initialize();
