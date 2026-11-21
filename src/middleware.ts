import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and internal Next.js assets are excluded by config matcher,
  // but let's ensure API auth endpoints never get redirected
  if (pathname.startsWith("/api/v1/auth")) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtectedPage =
    pathname === "/" ||
    pathname === "/today" ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/journal") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/memories") ||
    pathname.startsWith("/analyst") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/settings");

  // If user is already authenticated and visits login/signup, redirect to dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  // If user is NOT authenticated and attempts to access a protected page
  if (!user && isProtectedPage) {
    // Only enforce redirect if Supabase auth is configured and not running in automated vitest
    const hasSupabaseConfig = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (hasSupabaseConfig && process.env.NODE_ENV === "production") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      if (pathname !== "/") {
        url.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

