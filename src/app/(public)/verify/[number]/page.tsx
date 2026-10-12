import type { Metadata } from "next";
import { VerifyForm, VerifyResult } from "@/components/site/verify";
import { lookupCertificate } from "@/server/queries/verify";

export const metadata: Metadata = { title: "Verify a certificate", robots: { index: false, follow: false } };

/** Direct link printed on each certificate PDF. */
export default async function VerifyNumberPage({ params }: { params: Promise<{ number: string }> }) {
  const number = decodeURIComponent((await params).number).slice(0, 40);
  const { result, limited } = await lookupCertificate(number);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Verify a certificate</h1>
      <VerifyForm defaultValue={number} />
      <VerifyResult result={result} limited={limited} />
    </div>
  );
}
