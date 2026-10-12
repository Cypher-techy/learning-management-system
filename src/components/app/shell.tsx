import Link from "next/link";
import { Bell, GraduationCap, Search } from "lucide-react";
import { CgsFooter } from "@/components/site/footer";
import { Input } from "@/components/ui/input";
import { can, type Actor } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";
import { openSupportCount } from "@/server/services/community";
import { unreadCount } from "@/server/services/notifications";
import { MobileNav, SidebarNav, ThemeToggle, UserMenu, type NavGroup } from "./chrome";

export type Area = "learn" | "instructor" | "admin";

const ROLE_LABEL = { student: "Learner", instructor: "Instructor", admin: "Administrator" } as const;

async function navFor(area: Area, actor: Actor): Promise<NavGroup[]> {
  if (area === "admin") {
    const support = can(actor, "support.manage") ? await openSupportCount() : 0;
    return [
      { items: [{ href: "/admin", label: "Overview", icon: "dashboard", exact: true }] },
      {
        heading: "People",
        items: [
          { href: "/admin/users", label: "Users", icon: "users" },
          { href: "/admin/instructors", label: "Instructor applications", icon: "instructors" },
          { href: "/admin/enrollments", label: "Enrollments", icon: "enrollments" },
          { href: "/admin/permissions", label: "Roles and permissions", icon: "permissions" },
        ],
      },
      {
        heading: "Learning",
        items: [
          { href: "/admin/courses", label: "Courses", icon: "courses" },
          { href: "/admin/categories", label: "Categories and tags", icon: "categories" },
          { href: "/admin/assessments", label: "Assessments", icon: "grading" },
          { href: "/admin/certificates", label: "Certificates", icon: "certificates" },
          { href: "/admin/announcements", label: "Announcements", icon: "announcements" },
        ],
      },
      {
        heading: "Operations",
        items: [
          { href: "/admin/support", label: "Support and reports", icon: "support", badge: support },
          { href: "/admin/payments", label: "Payments", icon: "purchases" },
          { href: "/admin/settings", label: "Settings", icon: "settings" },
          { href: "/admin/audit", label: "Audit log", icon: "audit" },
          { href: "/admin/health", label: "System health", icon: "health" },
        ],
      },
    ];
  }
  if (area === "instructor") {
    return [
      {
        items: [
          { href: "/instructor", label: "Overview", icon: "dashboard", exact: true },
          { href: "/instructor/courses", label: "My courses", icon: "courses" },
          { href: "/instructor/grading", label: "Grading", icon: "grading" },
          { href: "/instructor/question-banks", label: "Question banks", icon: "questions" },
        ],
      },
      { heading: "Learning", items: [{ href: "/learn", label: "My learning", icon: "enrollments" }] },
    ];
  }
  return [
    {
      items: [
        { href: "/learn", label: "Dashboard", icon: "dashboard", exact: true },
        { href: "/learn/courses", label: "My courses", icon: "courses" },
        { href: "/courses", label: "Browse courses", icon: "browse" },
      ],
    },
    {
      heading: "Progress",
      items: [
        { href: "/learn/grades", label: "Grades", icon: "grades" },
        { href: "/learn/calendar", label: "Calendar", icon: "calendar" },
        { href: "/learn/bookmarks", label: "Bookmarks and notes", icon: "bookmarks" },
        { href: "/learn/certificates", label: "Certificates", icon: "certificates" },
        { href: "/learn/purchases", label: "Purchases", icon: "purchases" },
      ],
    },
  ];
}

/** Layout shared by the learner, instructor and administrator dashboards. */
export async function AppShell({ area, actor, children }: { area: Area; actor: Actor; children: React.ReactNode }) {
  const [platform, groups, unread] = await Promise.all([getPlatform(), navFor(area, actor), unreadCount(actor.id)]);
  const areaLabel = area === "admin" ? "Administration" : area === "instructor" ? "Instructor" : "Learning";

  const links = [
    { href: "/account", label: "Account settings" },
    { href: "/notifications", label: "Notifications" },
    ...(area !== "learn" ? [{ href: "/learn", label: "Learner dashboard" }] : []),
    ...(area !== "instructor" && can(actor, "course.create") ? [{ href: "/instructor", label: "Instructor dashboard" }] : []),
    ...(area !== "admin" && actor.role === "admin" ? [{ href: "/admin", label: "Administration" }] : []),
  ];

  const brand = (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <GraduationCap className="size-4" aria-hidden />
      </span>
      <span className="truncate">{platform.platformName}</span>
    </Link>
  );

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-sidebar p-4 lg:flex">
        {brand}
        <p className="-mt-2 text-xs text-muted-foreground">{areaLabel}</p>
        <SidebarNav groups={groups} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:px-6">
          <MobileNav groups={groups} brand={platform.platformName} />
          <div className="lg:hidden">{brand}</div>
          <form action="/courses" role="search" className="relative ml-auto hidden w-full max-w-xs sm:block lg:ml-0">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input name="q" type="search" placeholder="Search courses" aria-label="Search courses" className="pl-8" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
            >
              <Bell className="size-4" aria-hidden />
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[0.65rem] leading-4 font-medium text-white tabular-nums">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <UserMenu name={actor.name} email={actor.email} roleLabel={ROLE_LABEL[actor.role]} links={links} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">
          {children}
        </main>
        <CgsFooter cgsWebsiteUrl={platform.cgsWebsiteUrl} />
      </div>
    </div>
  );
}
