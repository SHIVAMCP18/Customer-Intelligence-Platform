import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { CALLBACK_ERRORS, CALLBACK_MESSAGES } from "@/lib/auth-errors";

export const metadata: Metadata = { title: "Sign in — VoiceIQ Enterprise" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const { next, error, message } = await searchParams;
  const errorText = error ? (CALLBACK_ERRORS[error] ?? CALLBACK_ERRORS.auth_callback_failed) : undefined;
  const messageText = message ? CALLBACK_MESSAGES[message] : undefined;

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Sign in</h1>
      <LoginForm next={next} notice={errorText ?? messageText} noticeIsError={Boolean(errorText)} />
    </>
  );
}
