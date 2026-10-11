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
  const res = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const role = (user?.app_metadata?.role as string | undefined) ?? "";

  if (path === "/" || path.startsWith("/login")) {
    if (user && role) return NextResponse.redirect(new URL(HOME[role], req.url));
    return path === "/" ? NextResponse.redirect(new URL("/login", req.url)) : res;
  }
  const area = Object.keys(ALLOWED).find((p) => path.startsWith(p));
  if (!area) return res;
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!ALLOWED[area].includes(role)) return NextResponse.redirect(new URL(HOME[role] ?? "/login", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|api).*)"] };
