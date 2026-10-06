import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that need a signed-in user. Checked here, before any rendering, so a
// signed-out visitor goes straight to /login instead of half-rendering a page.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/chat",
  "/feedback",
  "/opportunities",
  "/trends",
  "/personas",
  "/roadmap",
  "/competitive",
  "/executive-summary",
  "/settings",
  "/onboarding",
];

// Pages that make no sense once signed in.
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Dynamic key so Next.js doesn't inline NEXT_PUBLIC_* at build time (see lib/env.ts).
function readEnv(...names: string[]) {
  const env = process.env as Record<string, string | undefined>;
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Refreshes the Supabase session cookie on every request (Server Components
 * can't write cookies themselves, so this is the only place an expired access
 * token actually gets refreshed) and guards routes by auth state.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Supabase isn't configured in this environment. This runs on every
  // request, including pages that don't need auth at all, so it must degrade
  // to a no-op rather than take the whole site down.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let signedIn = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch (err) {
    console.error("[proxy auth refresh error]", err);
    // Auth server unreachable: let the request through so the page can show
    // a proper error instead of bouncing the user around in redirects.
    return response;
  }

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = new URL(path, request.url);
    const redirect = NextResponse.redirect(target);
    // Carry over any refreshed session cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  if (signedIn && (pathname === "/" || matches(pathname, AUTH_PAGES))) {
    const next = request.nextUrl.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return redirectTo(safeNext);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, plus the public widget (embedded on customers'
    // sites) and its ingestion API -- neither involves a signed-in session.
    "/((?!_next/static|_next/image|favicon.ico|widget/|api/widget/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
