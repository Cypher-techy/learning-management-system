import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { markAllReadAction, markReadAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, LinkButton, PageHeader, pageParam, Pagination, type SearchParams } from "@/components/kit/primitives";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/auth/session";
import { listNotifications, NOTIFICATION_CATEGORIES } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireActor("/notifications");
  const page = pageParam((await searchParams).page);
  const { rows, total } = await listNotifications(actor, page, PAGE_SIZE);
  const anyUnread = rows.some((n) => !n.readAt);

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <>
            <LinkButton href="/account#notifications" variant="ghost">
              Preferences
            </LinkButton>
            {anyUnread && <ActionButton action={markAllReadAction}>Mark all as read</ActionButton>}
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" description="Updates about your courses, grades and account appear here." />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {rows.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-accent/40")}>
                <span
                  className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.readAt && "font-medium")}>
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                    {!n.readAt && <span className="sr-only"> (unread)</span>}
                  </p>
                  {n.body && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {NOTIFICATION_CATEGORIES[n.category as keyof typeof NOTIFICATION_CATEGORIES] ?? "Update"} ·{" "}
                    <LocalTime value={n.createdAt} />
                  </p>
                </div>
                {!n.readAt && (
                  <ActionButton action={markReadAction} fields={{ id: n.id }} variant="ghost" size="sm">
                    Mark read
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/notifications?page=${p}`} />
        </>
      )}
    </>
  );
}
