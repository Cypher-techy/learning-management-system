import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { CgsFooter } from "@/components/site/footer";
import { getPlatform } from "@/server/queries/context";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const platform = await getPlatform();
  return (
    <>
      <main id="main" className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-10">
        <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          {platform.platformName}
        </Link>
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs">{children}</div>
      </main>
      <CgsFooter cgsWebsiteUrl={platform.cgsWebsiteUrl} />
    </>
  );
}
