import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Respects RLS as the signed-in user. Create a fresh one per
 * request -- never cache or share this across requests.
 */
export async function createClient() {
  // Read cookies first: it's what marks every page using this client as
  // dynamic, so nothing user-specific is ever prerendered at build time.
  const cookieStore = await cookies();

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component, which can't set cookies --
          // the proxy refreshes the session instead, so this is safe to
          // ignore here.
        }
      },
    },
  });
}

/**
 * The signed-in user, verified against Supabase Auth. Memoized per request
 * with React's cache(): the layout, the page and the membership lookups all
 * need the user, and each un-memoized call is a network round-trip to the
 * Auth server.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
