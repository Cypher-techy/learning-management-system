"use client";

import { createAuthClient } from "better-auth/react";

/** Browser client for the authentication endpoints under /api/auth. */
export const authClient = createAuthClient();

/** Only same-site, absolute-path targets are accepted for post-login redirects. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}
