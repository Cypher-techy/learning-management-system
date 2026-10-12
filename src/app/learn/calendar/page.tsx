import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardList, FileText, Video } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader } from "@/components/kit/primitives";
import { titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { upcomingDeadlines } from "@/server/queries/learner";
import { upcomingLiveSessions } from "@/server/services/community";

export const metadata: Metadata = { title: "Calendar" };

const PROVIDERS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  jitsi: "Jitsi",
  other: "Online meeting",
};

type Entry = {
  key: string;
  at: Date;
  title: string;
  detail: string;
  href?: string;
  external?: string;
  icon: typeof Video;
};

export default async function CalendarPage() {
  const actor = await requireActor("/learn/calendar");
  const [deadlines, live] = await Promise.all([upcomingDeadlines(actor.id, 50), upcomingLiveSessions(actor.id, 50)]);

  const entries: Entry[] = [
    ...deadlines.map((d) => ({
      key: `${d.kind}-${d.id}`,
      at: d.dueAt,
      title: d.title,
      detail: `${d.kind === "assignment" ? "Assignment due" : `${titleCase(d.kind)} closes`} · ${d.courseTitle}`,
      href: d.href,
      icon: d.kind === "assignment" ? FileText : ClipboardList,
    })),
    ...live.map(({ session, courseTitle }) => ({
      key: `live-${session.id}`,
      at: session.startsAt,
      title: session.title,
      detail: `Live session (${PROVIDERS[session.provider]}, ${session.durationMinutes} min) · ${courseTitle}`,
      external: session.joinUrl,
      icon: Video,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Group by calendar day in the platform's home time zone.
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const day = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    }).format(entry.at);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Upcoming deadlines and live sessions for your courses. Times are shown in your local time zone."
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          description="Deadlines and live sessions from your courses will appear here."
        />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{day}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((entry) => (
                  <li key={entry.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <entry.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      {entry.href ? (
                        <Link href={entry.href} className="font-medium hover:underline">
                          {entry.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{entry.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{entry.detail}</p>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      <LocalTime value={entry.at} />
                    </span>
                    {entry.external && (
                      <a
                        href={entry.external}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border px-2.5 py-1 text-sm hover:bg-muted"
                      >
                        Join<span className="sr-only"> {entry.title} (opens in a new tab)</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
