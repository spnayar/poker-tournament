export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/tournament/:path*", "/profile/:path*"],
};
