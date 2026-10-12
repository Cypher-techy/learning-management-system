import { DISPLAY_TIMEZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

export const CGS_NAME = "Cypher Green Systems";

export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: DISPLAY_TIMEZONE }).format(now));
}

/**
 * The single source of the copyright notice and CGS attribution. Used by the
 * public site, the sign-in pages and all three dashboards.
 *
 * `cgsWebsiteUrl` comes from Admin > Settings (or CGS_WEBSITE_URL). When it is
 * not configured the attribution is plain text rather than a guessed link.
 */
export function CgsFooter({
  cgsWebsiteUrl,
  className,
  children,
}: {
  cgsWebsiteUrl: string | null;
  className?: string;
  /** Optional extra content above the notice (public site link columns). */
  children?: React.ReactNode;
}) {
  const attribution = `${CGS_NAME} (CGS)`;
  return (
    <footer className={cn("border-t bg-background", className)} data-testid="cgs-footer">
      {children}
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-x-3 gap-y-1 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <p data-testid="cgs-copyright">
          &copy; {currentYear()} {CGS_NAME}. All rights reserved.
        </p>
        <p data-testid="cgs-attribution">
          Powered by{" "}
          {cgsWebsiteUrl ? (
            <a
              href={cgsWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {attribution}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="font-medium text-foreground">{attribution}</span>
          )}
        </p>
      </div>
    </footer>
  );
}
