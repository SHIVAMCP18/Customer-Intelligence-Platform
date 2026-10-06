import "server-only";
import { headers } from "next/headers";

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at *build* time. The Docker
 * image is built once and configured at runtime (Railway, Compose), so when
 * the build ran without those build args every server-side Supabase call
 * silently got `undefined` and sign-in failed with a connection error.
 * Reading through a dynamic key skips the inlining, so runtime values always
 * win; the non-public `SUPABASE_URL` / `SUPABASE_ANON_KEY` names work too.
 */
function readEnv(...names: string[]): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getSupabaseUrl(): string | undefined {
  return readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string | undefined {
  return readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * The public origin of the app, for links that leave the app (email
 * confirmation, invite links, the widget embed snippet). Prefers the
 * configured APP_URL, and otherwise falls back to the origin of the current
 * request -- so a missing env var degrades to a working link instead of
 * "undefined/auth/callback".
 */
export async function getAppUrl(): Promise<string> {
  const configured = readEnv("APP_URL", "NEXT_PUBLIC_APP_URL");
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
