import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { LinkButton } from "@/components/kit/primitives";
import { CgsFooter } from "@/components/site/footer";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Page not found" };

export default async function NotFound() {
  const platform = await getPlatform();
  return (
    <>
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <Compass className="size-10 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold">We could not find that page</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The page may have been moved or removed, or you may not have access to it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton href="/">Go to the homepage</LinkButton>
          <LinkButton href="/courses" variant="outline">
            Browse courses
          </LinkButton>
          <LinkButton href="/dashboard" variant="ghost">
            My dashboard
          </LinkButton>
        </div>
      </main>
      <CgsFooter cgsWebsiteUrl={platform.cgsWebsiteUrl} />
    </>
  );
}
