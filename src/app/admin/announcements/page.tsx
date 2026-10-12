import type { Metadata } from "next";
import { deletePlatformAnnouncementAction, platformAnnouncementAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { PageHeader, Section } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { listPlatformAnnouncements } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const actor = await requirePermission("announcement.platform");
  const rows = await listPlatformAnnouncements(actor);

  return (
    <>
      <PageHeader
        title="Platform announcements"
        description="Sent to every active user. Course-specific announcements are posted by instructors from their course."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="New announcement">
          <ActionForm action={platformAnnouncementAction} resetOnSuccess className="grid gap-4">
            <FormMessage />
            <TextField label="Title" name="title" required minLength={3} maxLength={160} />
            <TextAreaField label="Message" name="body" rows={6} required minLength={5} maxLength={10000} />
            <div>
              <SubmitButton pendingLabel="Sending...">Send to all users</SubmitButton>
            </div>
          </ActionForm>
        </Section>
        <Section title="Sent announcements">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platform announcements have been sent.</p>
          ) : (
            <ul className="space-y-4">
              {rows.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.authorName ?? "Administrator"} · <LocalTime value={item.createdAt} />
                    </p>
                  </div>
                  <ConfirmAction
                    action={deletePlatformAnnouncementAction}
                    fields={{ announcementId: item.id }}
                    title="Delete this announcement?"
                    description="It is removed from dashboards. Notifications already delivered stay in users' inboxes."
                    confirmLabel="Delete"
                    destructive
                    variant="ghost"
                    size="sm"
                  >
                    Delete
                  </ConfirmAction>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
