import { AppShell } from "@/components/app/shell";
import { requireRole } from "@/server/auth/session";

/**
 * Administration area. Non-administrators are redirected to their own
 * dashboard; each page and every service underneath checks again.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireRole("admin");
  return (
    <AppShell area="admin" actor={actor}>
      {children}
    </AppShell>
  );
}
