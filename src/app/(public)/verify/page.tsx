import type { Metadata } from "next";
import { first, type SearchParams } from "@/components/kit/primitives";
import { VerifyForm, VerifyResult } from "@/components/site/verify";
import { lookupCertificate } from "@/server/queries/verify";

export const metadata: Metadata = { title: "Verify a certificate", robots: { index: true, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const number = first((await searchParams).number);
  const { result, limited } = await lookupCertificate(number);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Verify a certificate</h1>
      <p className="mt-2 text-muted-foreground">
        Enter the certificate number printed on the certificate to confirm that it is genuine and still valid.
      </p>
      <VerifyForm defaultValue={number} />
      <VerifyResult result={result} limited={limited} />
    </div>
  );
}
