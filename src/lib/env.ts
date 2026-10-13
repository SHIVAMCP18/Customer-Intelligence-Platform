import "server-only";
import { headers } from "next/headers";
import { isLocalHost, publicOrigin } from "@/lib/public-origin";

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
 * confirmation, invite links, the widget embed snippet). Uses APP_URL /
 * NEXT_PUBLIC_APP_URL when set, otherwise the origin of the current request.
 * A configured localhost URL is ignored when the request comes from a real
 * domain -- copying .env.example's value to production would otherwise send
 * every confirmation email to http://localhost:3000.
 */
export async function getAppUrl(): Promise<string> {
  const h = await headers();
  const requestOrigin = publicOrigin(h);
  const configured = readEnv("APP_URL", "NEXT_PUBLIC_APP_URL")?.replace(/\/+$/, "");

  if (configured) {
    let configuredIsLocal = false;
    try {
      configuredIsLocal = isLocalHost(new URL(configured).host);
    } catch {
      configuredIsLocal = true; // malformed -- don't trust it
    }
    const requestIsLocal = isLocalHost(new URL(requestOrigin).host);
    if (!configuredIsLocal || requestIsLocal) return configured;
  }
  return requestOrigin;
}
