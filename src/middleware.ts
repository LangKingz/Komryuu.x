import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewati rute API eksternal v1 agar aplikasi Android tetap lolos dengan x-api-key
  if (pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Proteksi rute Dashboard Admin pada level server/middleware
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get("komryuu_session")?.value;
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/v1/:path*"],
};
