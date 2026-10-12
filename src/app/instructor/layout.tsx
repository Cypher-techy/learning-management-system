import { AppShell } from "@/components/app/shell";
import { requirePermission } from "@/server/auth/session";

/**
 * Instructor area. Learners are redirected to their own dashboard here; every
 * page and service underneath repeats the check for the specific course.
 */
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePermission("course.create");
  return (
    <AppShell area="instructor" actor={actor}>
      {children}
    </AppShell>
  );
}
