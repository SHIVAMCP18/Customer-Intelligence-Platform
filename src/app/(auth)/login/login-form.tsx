"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(login, undefined);
  // Controlled, because React resets uncontrolled form fields after every
  // action -- a wrong password would otherwise also wipe the email, and the
  // next submit would be silently blocked by the field's `required` check.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
