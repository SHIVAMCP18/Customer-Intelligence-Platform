"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectTarget } from "@/lib/safe-redirect";
import { logError } from "@/lib/log-error";
import { getAppUrl } from "@/lib/env";
import { friendlyAuthError } from "@/lib/auth-errors";

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  next: z.string().optional(),
});

export type SignupState =
  | { error?: string; message?: undefined }
  | { error?: undefined; message: string }
  | undefined;

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { fullName, email, password, next } = parsed.data;
  const target = safeRedirectTarget(next);
  let data;
  try {
    const supabase = await createClient();
    const appUrl = await getAppUrl();
    const res = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(target)}`,
      },
    });
    if (res.error) {
      logError("auth.signup", res.error);
      return { error: friendlyAuthError(res.error) };
    }
    data = res.data;
  } catch (err) {
    logError("auth.signup", err);
    return { error: friendlyAuthError({ name: "AuthRetryableFetchError" }) };
  }

  // With email confirmation on, Supabase deliberately doesn't reveal whether
  // an address is taken: signing up again "succeeds" but returns a user with
  // no identities and sends no email. Say so instead of promising an email
  // that will never arrive.
  if (data?.user && !data.session && data.user.identities?.length === 0) {
    return { error: friendlyAuthError({ code: "user_already_exists" }) };
  }

  if (data?.session) {
    redirect(target);
  }

  return {
    message: `We sent a confirmation link to ${email}. Open it to activate your account, then sign in. (Check your spam folder if it doesn't arrive within a few minutes.)`,
  };
}
