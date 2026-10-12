import type { Metadata } from "next";
import Link from "next/link";
import { resolveReportAction, updateSupportAction } from "@/app/actions/admin";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/kit/form";
import { first, PageHeader, Section, StatusBadge, type SearchParams } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { supportInbox } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Support and reports" };

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const status = first((await searchParams).status);
  const actor = await requirePermission("support.manage");
  const { requests, reports } = await supportInbox(actor, status);

  return (
    <>
      <PageHeader title="Support and reports" description="Messages from the contact form and content reported by learners." />

      <Section title={`Reported content (${reports.length})`} className="mb-6">
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open reports.</p>
        ) : (
          <ul className="divide-y">
            {reports.map(({ report, reporterName, discussionTitle, discussionBody, replyBody, replyDiscussionId }) => {
              const discussionId = report.discussionId ?? replyDiscussionId;
              return (
                <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm">
                    <span className="font-medium">{reporterName}</span> reported a {report.replyId ? "reply" : "discussion"}{" "}
                    <span className="text-muted-foreground">
                      · <LocalTime value={report.createdAt} />
                    </span>
                  </p>
                  <p className="mt-1 text-sm">Reason: {report.reason}</p>
                  <blockquote className="mt-2 line-clamp-4 border-l-2 pl-3 text-sm whitespace-pre-line text-muted-foreground">
                    {replyBody ?? `${discussionTitle ?? ""}\n${discussionBody ?? ""}`}
                  </blockquote>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {discussionId && (
                      <Link href={`/discussions/${discussionId}`} className="self-center text-sm text-primary hover:underline">
                        Open discussion
                      </Link>
                    )}
                    <ConfirmAction
                      action={resolveReportAction}
                      fields={{ reportId: report.id, action: "hide_content" }}
                      title="Hide this content?"
                      description="It is hidden from learners. Moderators can unhide it later."
                      confirmLabel="Hide content"
                      destructive
                      size="sm"
                    >
                      Hide content
                    </ConfirmAction>
                    <ActionButton action={resolveReportAction} fields={{ reportId: report.id, action: "dismiss" }} variant="ghost" size="sm">
                      Dismiss
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <h2 className="mb-3 text-lg font-semibold">Support requests</h2>
      <FilterBar
        clearHref="/admin/support"
        selects={[
          {
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "", label: "All requests" },
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In progress" },
              { value: "closed", label: "Closed" },
            ],
          },
        ]}
      />
      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">No support requests.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => (
            <li key={request.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{request.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.name} ·{" "}
                    <a href={`mailto:${request.email}`} className="hover:underline">
                      {request.email}
                    </a>{" "}
                    · <LocalTime value={request.createdAt} />
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <p className="mt-3 text-sm whitespace-pre-line">{request.message}</p>
              <ActionForm action={updateSupportAction} className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <input type="hidden" name="requestId" value={request.id} />
                <SelectField
                  label="Status"
                  name="status"
                  defaultValue={request.status}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "in_progress", label: "In progress" },
                    { value: "closed", label: "Closed" },
                  ]}
                />
                <TextAreaField label="Internal note" name="adminNote" rows={1} defaultValue={request.adminNote ?? ""} maxLength={5000} />
                <SubmitButton variant="outline" pendingLabel="Saving...">
                  Update
                </SubmitButton>
                <FormMessage className="sm:col-span-3" />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
