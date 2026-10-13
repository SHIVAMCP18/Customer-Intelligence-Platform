import { describe, expect, it } from "vitest";
import { isLocalHost, publicOrigin } from "./public-origin";

describe("publicOrigin", () => {
  it("prefers forwarded host and proto (Railway, Vercel)", () => {
    const h = new Headers({
      host: "0.0.0.0:8080",
      "x-forwarded-host": "frontend-production-b159.up.railway.app",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(h)).toBe("https://frontend-production-b159.up.railway.app");
  });

  it("takes the first value of comma-separated forwarded headers", () => {
    const h = new Headers({ "x-forwarded-host": "a.example.com, b.internal", "x-forwarded-proto": "https,http" });
    expect(publicOrigin(h)).toBe("https://a.example.com");
  });

  it("uses http for local hosts and https otherwise", () => {
    expect(publicOrigin(new Headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
    expect(publicOrigin(new Headers({ host: "app.example.com" }))).toBe("https://app.example.com");
  });
});

describe("isLocalHost", () => {
  it.each(["localhost:3000", "127.0.0.1", "0.0.0.0:8080", "[::1]:3000"])("%s is local", (h) => {
    expect(isLocalHost(h)).toBe(true);
  });
  it("public hosts are not local", () => {
    expect(isLocalHost("frontend-production-b159.up.railway.app")).toBe(false);
  });
});
