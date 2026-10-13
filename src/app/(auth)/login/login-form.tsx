"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, resendConfirmation } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export function LoginForm({
  next,
  notice,
  noticeIsError = false,
}: {
  next?: string;
  notice?: string;
  noticeIsError?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(login, undefined);
  const [resendState, resendAction, isResending] = useActionState(resendConfirmation, undefined);
  // Controlled, because React resets uncontrolled form fields after every
  // action -- a wrong password would otherwise also wipe the email, and the
  // next submit would be silently blocked by the field's `required` check.
  const [email, setEmail] = useState("");

  // Offer a resend when sign-in says the email isn't confirmed, or when the
  // user arrived from an expired/failed confirmation link.
  const showResend = Boolean(state?.unconfirmed || (noticeIsError && notice));

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {notice && !state && (
        <p
          role={noticeIsError ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            noticeIsError
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {notice}
        </p>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state?.error && <FieldError>{state.error}</FieldError>}
      <Button type="submit" loading={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      {showResend && (
        <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
          {resendState?.message ? (
            <p role="status" className="text-foreground">
              {resendState.message}
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">Didn&apos;t get the confirmation email?</p>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="mt-2"
                formAction={resendAction}
                formNoValidate
                loading={isResending}
              >
                Resend confirmation email
              </Button>
              {resendState?.error && <FieldError>{resendState.error}</FieldError>}
            </>
          )}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-primary hover:text-primary-hover"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
