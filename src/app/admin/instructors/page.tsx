import type { Metadata } from "next";
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { reviewApplicationAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { listApplications } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Instructor applications" };

export default async function InstructorApplicationsPage() {
  const actor = await requirePermission("instructor.approve");
  const rows = await listApplications(actor);

  return (
    <>
      <PageHeader
        title="Instructor applications"
        description="Approving an application gives the user the instructor role. Rejected applicants may apply again."
      />
      {rows.length === 0 ? (
        <EmptyState icon={UserCheck} title="No applications" description="Applications from the Teach a course page appear here." />
      ) : (
        <ul className="space-y-4">
          {rows.map(({ application, name, email }) => (
            <li key={application.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/users/${application.userId}`} className="font-semibold hover:underline">
                    {name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {email} · applied <LocalTime value={application.createdAt} dateOnly />
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Expertise</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{application.expertise}</dd>
                </div>
                <div>
                  <dt className="font-medium">Wants to teach</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{application.motivation}</dd>
                </div>
              </dl>
              {application.status === "pending" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                  <ConfirmAction
                    action={reviewApplicationAction}
                    fields={{ applicationId: application.id, decision: "approve" }}
                    title={`Approve ${name} as an instructor?`}
                    description="They will be able to create courses and submit them for review."
                    reasonField={{ name: "note", label: "Note to the applicant (optional)" }}
                    confirmLabel="Approve"
                    variant="default"
                  >
                    Approve
                  </ConfirmAction>
                  <ConfirmAction
                    action={reviewApplicationAction}
                    fields={{ applicationId: application.id, decision: "reject" }}
                    title={`Reject ${name}'s application?`}
                    reasonField={{ name: "note", label: "Reason (shared with the applicant)" }}
                    confirmLabel="Reject"
                    destructive
                  >
                    Reject
                  </ConfirmAction>
                </div>
              ) : (
                application.reviewNote && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Note: {application.reviewNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
