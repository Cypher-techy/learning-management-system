import { AppShell, type Area } from "@/components/app/shell";
import { requireActor } from "@/server/auth/session";

/** Pages every signed-in user has, shown inside the dashboard for their role. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const area: Area = actor.role === "admin" ? "admin" : actor.role === "instructor" ? "instructor" : "learn";
  return (
    <AppShell area={area} actor={actor}>
      {children}
    </AppShell>
  );
}
