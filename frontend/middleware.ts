import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const passThrough = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Only protect /admin routes (except /admin/login)
  if (!pathname.startsWith("/admin")) return passThrough;
  if (pathname.startsWith("/admin/login")) return passThrough;

  const sessionCookie =
    request.cookies.get("sessionid") || request.cookies.get("session");

  if (!sessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return passThrough;
}

export const config = {
  matcher: [
    /*
     * Inyecta x-pathname para el layout raíz (admin sin header de tienda).
     * Excluye estáticos y API.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
