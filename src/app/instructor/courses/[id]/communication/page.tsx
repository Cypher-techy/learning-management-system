import type { Metadata } from "next";
import {
  createAnnouncementAction,
  createLiveSessionAction,
  deleteAnnouncementAction,
  deleteLiveSessionAction,
} from "@/app/actions/instructor";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import {
  ActionForm,
  DateTimeFormField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/kit/form";
import { LinkButton, Section } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseCommunication } from "@/server/queries/instructor";
import { assertCanManageCourse } from "@/server/services/courses";

export const metadata: Metadata = { title: "Communication" };

const PROVIDERS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "microsoft_teams", label: "Microsoft Teams" },
  { value: "jitsi", label: "Jitsi" },
  { value: "other", label: "Other" },
];

export default async function CommunicationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const course = await load(() => assertCanManageCourse(actor, id));
  const data = await courseCommunication(actor, id);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Section title="Post an announcement" description="Enrolled learners are notified in the platform and by email.">
          <ActionForm action={createAnnouncementAction} resetOnSuccess className="grid gap-4">
            <input type="hidden" name="courseId" value={id} />
            <FormMessage />
            <TextField label="Title" name="title" required minLength={3} maxLength={160} />
            <TextAreaField label="Message" name="body" rows={5} required minLength={5} maxLength={10000} />
            <div>
              <SubmitButton pendingLabel="Posting...">Post announcement</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Announcements">
          {data.announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements have been posted.</p>
          ) : (
            <ul className="space-y-4">
              {data.announcements.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.authorName ?? "Staff"} · <LocalTime value={item.createdAt} />
                    </p>
                  </div>
                  <ConfirmAction
                    action={deleteAnnouncementAction}
                    fields={{ announcementId: item.id }}
                    title="Delete this announcement?"
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

        <Section title="Discussions" description="Read and moderate what learners are saying.">
          <LinkButton href={`/learn/courses/${course.slug}/discussions`} variant="outline">
            Open course discussions
          </LinkButton>
        </Section>
      </div>

      <div className="space-y-6">
        <Section
          title="Schedule a live session"
          description="Paste the meeting link from your video service. Learners see it on their calendar."
        >
          <ActionForm action={createLiveSessionAction} resetOnSuccess className="grid gap-4">
            <input type="hidden" name="courseId" value={id} />
            <FormMessage />
            <TextField label="Title" name="title" required minLength={3} maxLength={160} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Meeting service" name="provider" options={PROVIDERS} />
              <TextField label="Duration (minutes)" name="durationMinutes" type="number" min={5} max={720} defaultValue={60} required />
            </div>
            <DateTimeFormField label="Starts" name="startsAt" required />
            <TextField label="Meeting link" name="joinUrl" type="url" required placeholder="https://" />
            <TextAreaField label="Notes for learners" name="description" rows={2} maxLength={2000} />
            <div>
              <SubmitButton pendingLabel="Scheduling...">Schedule session</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Live sessions">
          {data.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live sessions scheduled.</p>
          ) : (
            <ul className="divide-y">
              {data.sessions.map((session) => (
                <li key={session.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <LocalTime value={session.startsAt} /> · {session.durationMinutes} min ·{" "}
                      {PROVIDERS.find((p) => p.value === session.provider)?.label}
                    </p>
                    <a href={session.joinUrl} target="_blank" rel="noopener noreferrer" className="text-xs break-all text-primary hover:underline">
                      {session.joinUrl}
                    </a>
                  </div>
                  <ConfirmAction
                    action={deleteLiveSessionAction}
                    fields={{ sessionId: session.id }}
                    title="Remove this live session?"
                    confirmLabel="Remove"
                    destructive
                    variant="ghost"
                    size="sm"
                  >
                    Remove
                  </ConfirmAction>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
