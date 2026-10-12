import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/app/chrome";
import { LinkButton } from "@/components/kit/primitives";
import { CgsFooter } from "@/components/site/footer";
import { getActor } from "@/server/auth/session";
import { homeForRole } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";

const NAV = [
  { href: "/courses", label: "Courses" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/verify", label: "Verify a certificate" },
  { href: "/contact", label: "Contact" },
];

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [platform, actor] = await Promise.all([getPlatform(), getActor()]);
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            {platform.platformName}
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {actor ? (
              <LinkButton href={homeForRole(actor.role)}>Dashboard</LinkButton>
            ) : (
              <>
                <LinkButton href="/sign-in" variant="ghost">
                  Sign in
                </LinkButton>
                {platform.registrationEnabled && <LinkButton href="/register">Register</LinkButton>}
              </>
            )}
          </div>
        </div>
        <nav aria-label="Site (mobile)" className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 md:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <CgsFooter cgsWebsiteUrl={platform.cgsWebsiteUrl} className="mt-12">
        <div className="mx-auto grid w-full max-w-7xl gap-8 border-b px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold">{platform.platformName}</p>
            <p className="mt-2 text-muted-foreground">{platform.platformDescription}</p>
          </div>
          <FooterColumn
            title="Learn"
            links={[
              { href: "/courses", label: "Course catalog" },
              { href: "/verify", label: "Verify a certificate" },
              { href: "/faq", label: "Frequently asked questions" },
            ]}
          />
          <FooterColumn
            title="Platform"
            links={[
              { href: "/about", label: "About" },
              { href: "/teach", label: "Teach a course" },
              { href: "/contact", label: "Contact and support" },
            ]}
          />
          <FooterColumn
            title="Policies"
            links={[
              { href: platform.termsUrl || "/terms", label: "Terms of service" },
              { href: platform.privacyUrl || "/privacy", label: "Privacy policy" },
              { href: "/refund-policy", label: "Refund policy" },
            ]}
          />
        </div>
      </CgsFooter>
    </>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 grid gap-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-muted-foreground hover:text-foreground hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
