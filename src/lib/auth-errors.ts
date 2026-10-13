/**
 * Turns Supabase Auth errors into messages a user can act on. Supabase's own
 * messages are terse ("Email not confirmed") or misleading for end users
 * ("email rate limit exceeded" reads like the user did something wrong).
 */
export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "rate_limited"
  | "weak_password"
  | "signups_disabled"
  | "unreachable"
  | "unknown";

type AuthLikeError = { message?: string; code?: string; status?: number; name?: string };

export function classifyAuthError(error: AuthLikeError): AuthErrorKind {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalid_credentials";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "email_not_confirmed";
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered"))
    return "user_exists";
  if (code.startsWith("over_") || error.status === 429 || message.includes("rate limit")) return "rate_limited";
  if (code === "weak_password" || message.includes("password should")) return "weak_password";
  if (code === "signup_disabled" || message.includes("signups not allowed")) return "signups_disabled";
  if (
    error.name === "AuthRetryableFetchError" ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    (error.status !== undefined && error.status >= 500)
  )
    return "unreachable";
  return "unknown";
}

export function friendlyAuthError(error: AuthLikeError): string {
  switch (classifyAuthError(error)) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email first — check your inbox for the link we sent.";
    case "user_exists":
      return "An account with this email already exists. Sign in instead.";
    case "rate_limited":
      return "Too many attempts or emails in a short time. Please wait a few minutes and try again.";
    case "weak_password":
      return error.message ?? "Please choose a stronger password.";
    case "signups_disabled":
      return "New sign-ups are currently disabled.";
    case "unreachable":
      return "The sign-in service is unavailable right now. Please try again in a moment.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/** Messages for the `?error=` codes the auth callback redirects to /login with. */
export const CALLBACK_ERRORS: Record<string, string> = {
  auth_callback_failed: "That sign-in link didn't work. Please sign in, or request a new link.",
  link_expired: "That link has expired or was already used. Sign in, or request a new confirmation email below.",
  access_denied: "That link has expired or was already used. Sign in, or request a new confirmation email below.",
  service_unavailable: "The sign-in service is unavailable right now. Please try again in a moment.",
};

export const CALLBACK_MESSAGES: Record<string, string> = {
  email_confirmed: "Your email is confirmed. Sign in to continue.",
  signed_out: "You've been signed out.",
};
