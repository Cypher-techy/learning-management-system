import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export const checkboxClass = "size-4 shrink-0 rounded border-input accent-primary";

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-sm";
};

export function LinkButton({ variant = "default", size = "default", className, ...props }: LinkButtonProps) {
  // API routes return files (CSV, PDF), not pages: use a plain link so the
  // browser handles the download instead of the client-side router.
  if (typeof props.href === "string" && props.href.startsWith("/api/")) {
    return (
      <a href={props.href} className={cn(buttonVariants({ variant, size }), className)}>
        {props.children}
      </a>
    );
  }
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold break-words">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
}) {
  const body = (
    <div className="depth-card rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center", className)}>
      {Icon && <Icon className="mb-3 size-8 text-muted-foreground" aria-hidden />}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{clamped}%</span>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "border-success/30 bg-success/10 text-success",
  amber: "border-warning/30 bg-warning/10 text-warning",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  gray: "border-border bg-muted text-muted-foreground",
  blue: "border-primary/30 bg-primary/10 text-primary",
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  published: "green",
  active: "green",
  completed: "blue",
  valid: "green",
  succeeded: "green",
  approved: "green",
  graded: "green",
  passed: "green",
  resolved: "green",
  closed: "gray",
  draft: "gray",
  unpublished: "gray",
  archived: "gray",
  cancelled: "gray",
  dismissed: "gray",
  pending: "amber",
  pending_review: "amber",
  submitted: "amber",
  in_progress: "amber",
  requested: "amber",
  open: "amber",
  late: "amber",
  suspended: "red",
  revoked: "red",
  failed: "red",
  rejected: "red",
  refunded: "red",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", TONES[STATUS_TONE[status] ?? "gray"])}>
      {label ?? titleCase(status)}
    </Badge>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Showing {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <LinkButton href={hrefFor(page - 1)} variant="outline" size="sm">
            <ChevronLeft aria-hidden /> Previous
          </LinkButton>
        ) : null}
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <LinkButton href={hrefFor(page + 1)} variant="outline" size="sm">
            Next <ChevronRight aria-hidden />
          </LinkButton>
        ) : null}
      </div>
    </nav>
  );
}

/**
 * Renders author-written Markdown. Raw HTML is not rendered and link targets
 * are sanitised by react-markdown, so stored content cannot inject script.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-lms", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Builds a query string from the current filters plus overrides. */
export function withParams(base: string, current: Record<string, string | undefined>, patch: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function pageParam(value: string | string[] | undefined): number {
  const n = Number.parseInt(first(value) ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 1;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
