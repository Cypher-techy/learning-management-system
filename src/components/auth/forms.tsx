"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, safeNext } from "@/lib/auth-client";

type Status = { kind: "idle" } | { kind: "error"; message: string } | { kind: "done"; message: string };

function Message({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  const error = status.kind === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${
        error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"
      }`}
    >
      {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <p>{status.message}</p>
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

function TextInput({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof Input> & { id: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{label}</Label>
      <Input className="h-9" aria-describedby={hint ? `${props.id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${props.id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Authentication failures are reported with deliberately general wording so
 * that the form cannot be used to discover which email addresses have accounts.
 */
function signInError(code: string | undefined, fallback: string | undefined) {
  if (code === "EMAIL_NOT_VERIFIED") return "Please confirm your email address first. We have sent you a new link.";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_EMAIL" || code === "INVALID_PASSWORD") {
    return "The email address or password is not correct.";
  }
  if (fallback && /suspended/i.test(fallback)) return fallback;
  if (fallback && /too many/i.test(fallback)) return "Too many attempts. Please wait a minute and try again.";
  return "We could not sign you in. Please try again.";
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        setStatus({ kind: "idle" });
        const { error } = await authClient.signIn.email({
          email: String(data.get("email")).trim().toLowerCase(),
          password: String(data.get("password")),
        });
        if (error) {
          setPending(false);
          setStatus({ kind: "error", message: signInError(error.code, error.message) });
          return;
        }
        router.push(safeNext(next));
        router.refresh();
      }}
    >
      <Message status={status} />
      <TextInput id="email" name="email" type="email" label="Email address" autoComplete="email" required />
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-9" />
      </div>
      <Submit pending={pending}>Sign in</Submit>
    </form>
  );
}

export function RegisterForm({ next, verificationRequired }: { next?: string; verificationRequired: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  if (status.kind === "done") return <Message status={status} />;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password"));
        if (password !== String(data.get("confirm"))) {
          setStatus({ kind: "error", message: "The two passwords do not match." });
          return;
        }
        setPending(true);
        setStatus({ kind: "idle" });
        const { error } = await authClient.signUp.email({
          name: String(data.get("name")).trim(),
          email: String(data.get("email")).trim().toLowerCase(),
          password,
          callbackURL: safeNext(next),
        });
        if (error) {
          setPending(false);
          const message =
            error.code === "PASSWORD_TOO_SHORT"
              ? "Use a password of at least 10 characters."
              : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
                ? "An account with this email address already exists. Try signing in instead."
                : error.message && /registration is currently closed/i.test(error.message)
                  ? error.message
                  : "We could not create your account. Please check your details and try again.";
          setStatus({ kind: "error", message });
          return;
        }
        if (verificationRequired) {
          setPending(false);
          setStatus({
            kind: "done",
            message: "Account created. Check your inbox for a link to confirm your email address, then sign in.",
          });
          return;
        }
        router.push(safeNext(next));
        router.refresh();
      }}
    >
      <Message status={status} />
      <TextInput id="name" name="name" label="Full name" autoComplete="name" required minLength={2} maxLength={120} hint="Shown on your certificates." />
      <TextInput id="email" name="email" type="email" label="Email address" autoComplete="email" required maxLength={200} />
      <TextInput
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        hint="At least 10 characters."
      />
      <TextInput id="confirm" name="confirm" type="password" label="Confirm password" autoComplete="new-password" required minLength={10} maxLength={128} />
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  if (status.kind === "done") return <Message status={status} />;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        const { error } = await authClient.requestPasswordReset({
          email: String(data.get("email")).trim().toLowerCase(),
          redirectTo: "/reset-password",
        });
        setPending(false);
        if (error && error.status === 429) {
          setStatus({ kind: "error", message: "Too many requests. Please wait a few minutes and try again." });
          return;
        }
        // The same message is shown whether or not the address has an account.
        setStatus({
          kind: "done",
          message: "If an account exists for that address, we have emailed a link to reset the password. It expires in one hour.",
        });
      }}
    >
      <Message status={status} />
      <TextInput id="email" name="email" type="email" label="Email address" autoComplete="email" required />
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password"));
        if (password !== String(data.get("confirm"))) {
          setStatus({ kind: "error", message: "The two passwords do not match." });
          return;
        }
        setPending(true);
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        if (error) {
          setPending(false);
          setStatus({
            kind: "error",
            message:
              error.code === "PASSWORD_TOO_SHORT"
                ? "Use a password of at least 10 characters."
                : "This reset link is invalid or has expired. Request a new one.",
          });
          return;
        }
        router.push("/sign-in?reset=1");
      }}
    >
      <Message status={status} />
      <TextInput
        id="password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        hint="At least 10 characters."
      />
      <TextInput id="confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" required minLength={10} maxLength={128} />
      <Submit pending={pending}>Set new password</Submit>
    </form>
  );
}

export function ChangePasswordForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid max-w-md gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const password = String(data.get("newPassword"));
        if (password !== String(data.get("confirm"))) {
          setStatus({ kind: "error", message: "The two new passwords do not match." });
          return;
        }
        setPending(true);
        const { error } = await authClient.changePassword({
          currentPassword: String(data.get("currentPassword")),
          newPassword: password,
          revokeOtherSessions: true,
        });
        setPending(false);
        if (error) {
          setStatus({
            kind: "error",
            message:
              error.code === "PASSWORD_TOO_SHORT"
                ? "Use a password of at least 10 characters."
                : "Your current password is not correct.",
          });
          return;
        }
        form.reset();
        setStatus({ kind: "done", message: "Password changed. Your other sessions have been signed out." });
      }}
    >
      <Message status={status} />
      <TextInput id="currentPassword" name="currentPassword" type="password" label="Current password" autoComplete="current-password" required />
      <TextInput id="newPassword" name="newPassword" type="password" label="New password" autoComplete="new-password" required minLength={10} maxLength={128} hint="At least 10 characters." />
      <TextInput id="confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" required minLength={10} maxLength={128} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Change password
        </Button>
      </div>
    </form>
  );
}
