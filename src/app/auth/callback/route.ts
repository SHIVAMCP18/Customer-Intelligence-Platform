import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectTarget } from "@/lib/safe-redirect";
import { logError } from "@/lib/log-error";
import { publicOrigin } from "@/lib/public-origin";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Where email links land (sign-up confirmation, invites, password reset).
 * Handles both link styles Supabase can send:
 *
 *   ?code=...                     PKCE. Only works in the browser that
 *                                 started the sign-up (the code verifier is a
 *                                 cookie there), so it fails when the email is
 *                                 opened on a phone or another browser.
 *   ?token_hash=...&type=signup   Works from any device. Used when the email
 *                                 template links to
 *                                 {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * plus Supabase's own `?error=...&error_code=otp_expired` redirects for
 * expired or already-used links.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeRedirectTarget(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const origin = publicOrigin(request.headers, request.url);

  const toLogin = (params: Record<string, string>) => {
    const target = new URL("/login", origin);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    if (next !== "/dashboard") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  };

  const supabaseError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (supabaseError) {
    return toLogin({
      error: supabaseError === "otp_expired" || supabaseError === "access_denied" ? "link_expired" : "auth_callback_failed",
    });
  }

  try {
    const supabase = await createClient();

    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(next, origin));
      logError("auth.callback.verify_otp", error);
      return toLogin({ error: "link_expired" });
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
      logError("auth.callback.exchange_code", error);
      // The account *is* confirmed by now even if this browser can't finish
      // the PKCE exchange (link opened on another device) -- so the useful
      // next step is simply to sign in, not an error.
      return toLogin({ message: "email_confirmed" });
    }
  } catch (error) {
    logError("auth.callback", error);
    return toLogin({ error: "service_unavailable" });
  }

  return toLogin({ error: "auth_callback_failed" });
}
