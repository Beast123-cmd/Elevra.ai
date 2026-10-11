import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const HOME: Record<string, string> = { admin: "/admin", faculty: "/faculty", student: "/student" };
const ALLOWED: Record<string, string[]> = {
  "/admin": ["admin"],
  "/faculty": ["faculty", "admin"],
  "/insights": ["admin", "faculty"],
  "/student": ["student"],
  "/demo": ["admin", "faculty", "student"],
};

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const area = Object.keys(ALLOWED).find((p) => path.startsWith(p));
  const shouldCheckAuth = Boolean(area) || path === "/" || path.startsWith("/login");

  // Most public routes do not need an Auth lookup at all.
  if (!shouldCheckAuth) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => res.headers.set(name, value));
      },
    },
  });
  const { data: claimsResult, error } = await supabase.auth.getClaims();
  const claims = claimsResult?.claims;
  const userId = claims?.sub;
  const role = (claims?.app_metadata?.role as string | undefined) ?? "";

  const redirectWithAuthCookies = (destination: string) => {
    const redirect = NextResponse.redirect(new URL(destination, req.url));
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = res.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    return redirect;
  };

  if (path === "/" || path.startsWith("/login")) {
    if (userId && role) return redirectWithAuthCookies(HOME[role] ?? "/login");
    return path === "/" ? redirectWithAuthCookies("/login") : res;
  }
  if (!area) return res;
  if (!userId || error) return redirectWithAuthCookies("/login");
  if (!ALLOWED[area].includes(role)) return redirectWithAuthCookies(HOME[role] ?? "/login");
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|api).*)"] };
