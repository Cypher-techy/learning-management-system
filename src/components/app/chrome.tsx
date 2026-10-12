"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Award,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileQuestion,
  FolderTree,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  browse: Search,
  grades: ClipboardCheck,
  calendar: CalendarDays,
  bookmarks: BookMarked,
  certificates: Award,
  purchases: CreditCard,
  notifications: Bell,
  account: User,
  grading: ClipboardList,
  questions: FileQuestion,
  users: Users,
  instructors: UserCheck,
  categories: FolderTree,
  enrollments: GraduationCap,
  announcements: Megaphone,
  support: LifeBuoy,
  permissions: ShieldCheck,
  settings: Settings,
  audit: ScrollText,
  health: HeartPulse,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: number };
export type NavGroup = { heading?: string; items: NavItem[] };

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {groups.map((group, index) => (
        <div key={group.heading ?? index}>
          {group.heading && (
            <p className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.heading}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-primary px-1.5 text-[0.7rem] leading-5 font-medium text-primary-foreground tabular-nums">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({ groups, brand }: { groups: NavGroup[]; brand: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-4">
          <SheetHeader className="p-0">
            <SheetTitle>{brand}</SheetTitle>
          </SheetHeader>
          <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // False during server render and hydration, true afterwards.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

export function UserMenu({
  name,
  email,
  roleLabel,
  links,
}: {
  name: string;
  email: string;
  roleLabel: string;
  links: Array<{ href: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const { error } = await authClient.signOut();
    if (error) {
      setBusy(false);
      toast.error("Could not sign out. Please try again.");
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            >
              {initials(name) || "?"}
            </span>
            <span className="hidden max-w-32 truncate text-sm sm:inline">{name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <DropdownMenuSeparator />
        {links.map((link) => (
          <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
            {link.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={busy}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
