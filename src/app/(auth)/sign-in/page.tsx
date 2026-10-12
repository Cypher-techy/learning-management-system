import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/forms";
import { first, type SearchParams } from "@/components/kit/primitives";
import { getActor } from "@/server/auth/session";
import { homeForRole } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const actor = await getActor();
  if (actor) redirect(homeForRole(actor.role));
  const platform = await getPlatform();
  const next = first(sp.next);
  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">Welcome back. Enter your details to continue.</p>
      {first(sp.reset) && (
        <p role="status" className="mb-4 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          Your password was changed. Sign in with the new password.
        </p>
      )}
      <SignInForm next={next} />
      {platform.registrationEnabled && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to {platform.platformName}?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </>
  );
}
