import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download } from "lucide-react";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { listMyCertificates } from "@/server/services/certificates";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const actor = await requireActor("/learn/certificates");
  const certificates = await listMyCertificates(actor);

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Certificates are issued automatically when you meet a course's completion requirements."
      />
      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Complete a course to earn a certificate you can download and share."
          action={<LinkButton href="/learn/courses">Go to my courses</LinkButton>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {certificates.map((cert) => (
            <li key={cert.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{cert.courseTitle}</p>
                  <p className="text-sm text-muted-foreground">Awarded to {cert.learnerName}</p>
                </div>
                <StatusBadge status={cert.status} />
              </div>
              <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">Issued</dt>
                <dd>{formatDate(cert.issuedAt)}</dd>
                <dt className="text-muted-foreground">Number</dt>
                <dd className="font-mono text-xs leading-5">{cert.number}</dd>
                {cert.score !== null && (
                  <>
                    <dt className="text-muted-foreground">Score</dt>
                    <dd>{cert.score}%</dd>
                  </>
                )}
              </dl>
              {cert.status === "revoked" ? (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  This certificate was revoked{cert.revokeReason ? `: ${cert.revokeReason}` : "."}
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* A plain link so the browser handles the file download. */}
                  <a href={`/api/certificates/${cert.id}/pdf`} className={buttonVariants()}>
                    <Download aria-hidden /> Download PDF
                  </a>
                  <Link href={`/verify/${cert.number}`} className={buttonVariants({ variant: "outline" })}>
                    Verification page
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
