import type { Metadata } from "next";
import Link from "next/link";
import {
  deleteTemplateAction,
  reinstateCertificateAction,
  revokeCertificateAction,
  saveTemplateAction,
} from "@/app/actions/admin";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { ActionForm, CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { first, LinkButton, PageHeader, pageParam, Pagination, Section, StatusBadge, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { listCertificates } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Certificates" };

const PAGE_SIZE = 25;

type Template = Awaited<ReturnType<typeof listCertificates>>["templates"][number];

function TemplateForm({ template }: { template?: Template }) {
  return (
    <ActionForm action={saveTemplateAction} resetOnSuccess={!template} className="grid gap-3">
      {template && <input type="hidden" name="templateId" value={template.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Template name" name="name" defaultValue={template?.name ?? ""} required minLength={2} maxLength={80} />
        <TextField label="Heading" name="heading" defaultValue={template?.heading ?? "Certificate of Completion"} required maxLength={80} />
      </div>
      <TextAreaField
        label="Wording"
        name="body"
        rows={2}
        required
        maxLength={400}
        defaultValue={template?.body ?? "This certifies that {{learner}} has successfully completed {{course}}."}
        hint="Use {{learner}}, {{course}} and {{date}} where those details should appear."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Issuing organization" name="issuerName" defaultValue={template?.issuerName ?? ""} maxLength={120} hint="Empty uses the platform's organization name." />
        <TextField label="Accent colour" name="accentColor" defaultValue={template?.accentColor ?? "#0f5c4d"} required pattern="#[0-9a-fA-F]{6}" />
        <TextField label="Signatory name" name="signatoryName" defaultValue={template?.signatoryName ?? ""} maxLength={80} />
        <TextField label="Signatory title" name="signatoryTitle" defaultValue={template?.signatoryTitle ?? ""} maxLength={80} />
      </div>
      <CheckboxField label="Print the final score" name="showScore" defaultChecked={template?.showScore ?? false} />
      <CheckboxField label="Use as the default template for new certificates" name="isDefault" defaultChecked={template?.isDefault ?? false} />
      <FormMessage />
      <div className="flex gap-2">
        <SubmitButton variant={template ? "outline" : "default"} pendingLabel="Saving...">
          {template ? "Save template" : "Add template"}
        </SubmitButton>
        {template && !template.isDefault && (
          <ConfirmAction
            action={deleteTemplateAction}
            fields={{ templateId: template.id }}
            title={`Delete the template "${template.name}"?`}
            description="Certificates already issued with it fall back to the default template."
            confirmLabel="Delete"
            destructive
            variant="ghost"
          >
            Delete
          </ConfirmAction>
        )}
      </div>
    </ActionForm>
  );
}

export default async function AdminCertificatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q);
  const page = pageParam(sp.page);
  const actor = await requirePermission("certificate.manage");
  const { rows, total, templates } = await listCertificates(actor, { q, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Certificates are issued automatically when a learner meets a course's completion requirements. They cannot be created by hand."
      />
      <FilterBar q={q} placeholder="Search number, learner or course" clearHref="/admin/certificates">
        <LinkButton href="/api/export/certificates" variant="outline" prefetch={false}>
          Export CSV
        </LinkButton>
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate</TableHead>
              <TableHead>Learner</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {q ? "No certificates match your search." : "No certificates have been issued yet."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell>
                  <Link href={`/verify/${cert.number}`} className="font-mono text-xs hover:underline">
                    {cert.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/users/${cert.userId}`} className="hover:underline">
                    {cert.learnerName}
                  </Link>
                </TableCell>
                <TableCell>{cert.courseTitle}</TableCell>
                <TableCell>
                  <LocalTime value={cert.issuedAt} dateOnly />
                </TableCell>
                <TableCell>
                  <StatusBadge status={cert.status} />
                  {cert.revokeReason && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{cert.revokeReason}</p>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <LinkButton href={`/api/certificates/${cert.id}/pdf`} variant="ghost" size="sm" prefetch={false}>
                      PDF
                    </LinkButton>
                    {cert.status === "valid" ? (
                      <ConfirmAction
                        action={revokeCertificateAction}
                        fields={{ certificateId: cert.id }}
                        title="Revoke this certificate?"
                        description="The public verification page will show it as revoked and the learner is notified."
                        reasonField={{ name: "reason", label: "Reason (shown to the learner)", required: true }}
                        confirmLabel="Revoke"
                        destructive
                        variant="ghost"
                        size="sm"
                      >
                        Revoke
                      </ConfirmAction>
                    ) : (
                      <ActionButton action={reinstateCertificateAction} fields={{ certificateId: cert.id }} variant="ghost" size="sm">
                        Reinstate
                      </ActionButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/certificates", { q }, { page: p })} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {templates.map((template) => (
          <Section key={template.id} title={`Template: ${template.name}`} description={template.isDefault ? "Default template" : undefined}>
            <TemplateForm template={template} />
          </Section>
        ))}
        <Section title="New certificate template" description={templates.length === 0 ? "Until a template exists, certificates use the built-in layout." : undefined}>
          <TemplateForm />
        </Section>
      </div>
    </>
  );
}
