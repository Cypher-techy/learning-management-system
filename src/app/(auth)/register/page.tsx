import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { first, type SearchParams } from "@/components/kit/primitives";
import { env } from "@/lib/env";
import { getActor } from "@/server/auth/session";
import { homeForRole } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const actor = await getActor();
  if (actor) redirect(homeForRole(actor.role));
  const platform = await getPlatform();
  const next = first(sp.next);
  return (
    <>
      <h1 className="text-xl font-semibold">Create an account</h1>
      {platform.registrationEnabled ? (
        <>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Register as a learner. It is free and takes about a minute.
          </p>
          <RegisterForm next={next} verificationRequired={env().REQUIRE_EMAIL_VERIFICATION} />
          <p className="mt-4 text-xs text-muted-foreground">
            By creating an account you agree to the{" "}
            <Link href={platform.termsUrl || "/terms"} className="underline">
              terms of service
            </Link>{" "}
            and{" "}
            <Link href={platform.privacyUrl || "/privacy"} className="underline">
              privacy policy
            </Link>
            .
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Registration is currently closed. Please contact the administrator if you need an account.
        </p>
      )}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
