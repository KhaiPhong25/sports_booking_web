const exactProtectedPaths = new Set([
  "/admin",
  "/owner",
  "/bookings",
  "/notifications",
]);
const protectedPrefixes = ["/admin/", "/owner/", "/bookings/"];

export function requiresSession(pathname) {
  return (
    exactProtectedPaths.has(pathname) ||
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}
