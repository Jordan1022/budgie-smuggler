import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/auth/callback", "/offline"];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    PUBLIC_PATHS.some((path) => request.nextUrl.pathname === path) || request.nextUrl.pathname === "/api/plaid/webhook";

  if (!user && !isPublic && !request.nextUrl.pathname.startsWith("/_next") && !request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (user && (request.nextUrl.pathname === "/sign-in" || request.nextUrl.pathname === "/sign-up" || request.nextUrl.pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
