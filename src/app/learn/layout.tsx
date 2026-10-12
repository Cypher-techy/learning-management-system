import { AppShell } from "@/components/app/shell";
import { requireActor } from "@/server/auth/session";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("/learn");
  return (
    <AppShell area="learn" actor={actor}>
      {children}
    </AppShell>
  );
}
