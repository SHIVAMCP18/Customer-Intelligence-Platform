/**
 * The origin the *browser* used to reach the app, e.g. https://app.example.com.
 *
 * Don't build redirects from `request.url` in route handlers: in a
 * standalone/Docker deployment (HOSTNAME=0.0.0.0, as on Railway) it is the
 * server's bind address -- http://0.0.0.0:8080 -- so redirects would send
 * users to an address that doesn't exist. Proxies (Railway, Vercel, nginx)
 * put the real host and scheme in X-Forwarded-Host / X-Forwarded-Proto.
 */
export function publicOrigin(headers: Headers, fallbackUrl?: string): string {
  const host = firstValue(headers.get("x-forwarded-host")) ?? firstValue(headers.get("host"));
  if (!host) return fallbackUrl ? new URL(fallbackUrl).origin : "http://localhost:3000";

  const forwardedProto = firstValue(headers.get("x-forwarded-proto"));
  const proto = forwardedProto ?? (isLocalHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function isLocalHost(host: string): boolean {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "0.0.0.0" || name === "::1" || name.startsWith("127.");
}

function firstValue(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first || undefined;
}
