import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isTransientAuthError } from "@/components/shared/authErrors";

const HOME: Record<string, string> = { admin: "/admin", faculty: "/faculty", student: "/student" };
const ALLOWED: Record<string, string[]> = {
  "/admin": ["admin"],
  "/faculty": ["faculty", "admin"],
  "/insights": ["admin", "faculty"],
  "/student": ["student"],
  "/demo": ["admin", "faculty", "student"],
};

/** Protected pages must never be cached or restored from the back/forward cache after signing out. */
const NO_STORE = "private, no-store, must-revalidate";
const inArea = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const area = Object.keys(ALLOWED).find((p) => inArea(path, p));
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
  let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>["data"] = null;
  let error: { name?: string; message?: string; status?: number } | null = null;
  try {
    ({ data: claimsResult, error } = await supabase.auth.getClaims());
  } catch (e) {
    error = { name: "Error", message: e instanceof Error ? e.message : "fetch failed" };
  }
  const claims = claimsResult?.claims;
  const userId = claims?.sub;
  const role = (claims?.app_metadata?.role as string | undefined) ?? "";

  // If the auth server could not be reached we cannot tell whether this person is signed in. A network blip must not
  // sign anyone out: let the request through (the database still enforces what they may read) and check again next time.
  const hasSessionCookie = req.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (error && hasSessionCookie && isTransientAuthError(error)) {
    if (area) res.headers.set("Cache-Control", NO_STORE);
    return res;
  }

  const redirectWithAuthCookies = (destination: string) => {
    const redirect = NextResponse.redirect(new URL(destination, req.url));
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = res.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    redirect.headers.set("Cache-Control", NO_STORE); // a redirect away from a protected page must not be cached either
    return redirect;
  };

  if (path === "/" || path.startsWith("/login")) {
    if (userId && role) return redirectWithAuthCookies(HOME[role] ?? "/login");
    return res;
  }
  if (!area) return res;
  if (!userId || error) return redirectWithAuthCookies("/login");
  if (!ALLOWED[area].includes(role)) return redirectWithAuthCookies(HOME[role] ?? "/login");
  res.headers.set("Cache-Control", NO_STORE);
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|api).*)"] };
