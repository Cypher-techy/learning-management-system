import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/forms";
import { first, type SearchParams } from "@/components/kit/primitives";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = first(sp.token);
  const invalid = !token || !!first(sp.error);
  return (
    <>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {invalid ? (
        <>
          <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            This reset link is invalid or has expired. Reset links work once and expire after one hour.
          </p>
          <p className="mt-5 text-center text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              Request a new link
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">You will be signed out of other devices.</p>
          <ResetPasswordForm token={token} />
        </>
      )}
    </>
  );
}
