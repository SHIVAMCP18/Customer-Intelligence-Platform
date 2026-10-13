import { describe, expect, it } from "vitest";
import { classifyAuthError, friendlyAuthError } from "./auth-errors";

describe("classifyAuthError", () => {
  it.each([
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "invalid_credentials"],
    [{ message: "Invalid login credentials" }, "invalid_credentials"],
    [{ code: "email_not_confirmed", message: "Email not confirmed" }, "email_not_confirmed"],
    [{ code: "user_already_exists", message: "User already registered" }, "user_exists"],
    [{ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" }, "rate_limited"],
    [{ code: "weak_password", message: "Password should be at least 8 characters." }, "weak_password"],
    [{ name: "AuthRetryableFetchError", message: "fetch failed" }, "unreachable"],
    [{ status: 503, message: "upstream" }, "unreachable"],
    [{ message: "something odd" }, "unknown"],
  ])("%j -> %s", (error, kind) => {
    expect(classifyAuthError(error)).toBe(kind);
  });
});

describe("friendlyAuthError", () => {
  it("never leaks a raw rate-limit message", () => {
    expect(friendlyAuthError({ message: "email rate limit exceeded", status: 429 })).toMatch(/wait a few minutes/);
  });
  it("falls back to the original message", () => {
    expect(friendlyAuthError({ message: "something odd" })).toBe("something odd");
  });
});
