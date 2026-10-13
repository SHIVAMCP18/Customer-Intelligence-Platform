"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectTarget } from "@/lib/safe-redirect";
import { logError } from "@/lib/log-error";
import { getAppUrl } from "@/lib/env";
import { classifyAuthError, friendlyAuthError } from "@/lib/auth-errors";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export type LoginState = { error?: string; unconfirmed?: boolean } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      if (classifyAuthError(error) === "unreachable") logError("auth.login", error);
      return {
        error: friendlyAuthError(error),
        unconfirmed: classifyAuthError(error) === "email_not_confirmed",
      };
    }
  } catch (err) {
    logError("auth.login", err);
    return { error: friendlyAuthError({ name: "AuthRetryableFetchError" }) };
  }

  redirect(safeRedirectTarget(parsed.data.next));
}

export type ResendState = { error?: string; message?: string } | undefined;

/** Re-sends the sign-up confirmation email (the first one expired, was lost, or went to spam). */
export async function resendConfirmation(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter your email address above first." };
  const next = safeRedirectTarget(formData.get("next") as string | null);

  try {
    const supabase = await createClient();
    const appUrl = await getAppUrl();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.data,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return { error: friendlyAuthError(error) };
  } catch (err) {
    logError("auth.resend", err);
    return { error: friendlyAuthError({ name: "AuthRetryableFetchError" }) };
  }

  return { message: `If ${email.data} has an unconfirmed account, a new confirmation link is on its way.` };
}
