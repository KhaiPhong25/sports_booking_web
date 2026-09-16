const exactProtectedPaths = new Set([
  "/admin",
  "/owner",
  "/bookings",
  "/notifications",
  "/profile",
]);
const protectedPrefixes = ["/admin/", "/owner/", "/bookings/"];
const rolePriority = ["ADMIN", "OWNER", "CUSTOMER"];

function matchesRoute(pathname, exactPath, prefix = `${exactPath}/`) {
  return pathname === exactPath || pathname.startsWith(prefix);
}

export function effectiveRole(roles = []) {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function workspaceHome(roles = []) {
  const role = effectiveRole(roles);
  if (role === "ADMIN") return "/admin";
  if (role === "OWNER") return "/owner";
  if (role === "CUSTOMER") return "/";
  return null;
}

export function canAccessRoute(pathname, roles = []) {
  const role = effectiveRole(roles);
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isDiscoveryRoute =
    pathname === "/" || matchesRoute(pathname, "/venues");

  if (!role) return isAuthRoute || isDiscoveryRoute;
  if (pathname === "/profile") return true;
  if (isAuthRoute) return false;
  if (matchesRoute(pathname, "/admin")) return role === "ADMIN";
  if (pathname === "/owner/apply") return role === "CUSTOMER";
  if (matchesRoute(pathname, "/owner")) return role === "OWNER";
  if (
    matchesRoute(pathname, "/bookings") ||
    pathname === "/notifications" ||
    isDiscoveryRoute
  ) {
    return role === "CUSTOMER";
  }
  return false;
}

export function redirectForRoute(pathname, search = "", user = null) {
  if (!user) {
    const returnTo = `${pathname}${search}`;
    return requiresSession(pathname)
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : null;
  }

  const roles = user.roles ?? [];
  const home = workspaceHome(roles);
  if (!home) return "/login?reason=invalid-role";
  return canAccessRoute(pathname, roles) ? null : home;
}

export function requiresSession(pathname) {
  return (
    exactProtectedPaths.has(pathname) ||
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}
