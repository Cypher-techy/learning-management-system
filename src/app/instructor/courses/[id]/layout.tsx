import { Eye } from "lucide-react";
import { TabsNav } from "@/components/app/tabs-nav";
import { LinkButton, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { assertCanManageCourse } from "@/server/services/courses";

export default async function CourseEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  // Someone else's course is reported as not found.
  const course = await load(() => assertCanManageCourse(actor, id));
  const base = `/instructor/courses/${id}`;

  return (
    <>
      <PageHeader
        title={course.title}
        back={{ href: actor.role === "admin" ? "/admin/courses" : "/instructor/courses", label: "All courses" }}
        description={<StatusBadge status={course.status} />}
        actions={
          <LinkButton href={`/learn/courses/${course.slug}`} variant="outline">
            <Eye aria-hidden /> Preview as learner
          </LinkButton>
        }
      />
      <TabsNav
        label="Course sections"
        tabs={[
          { href: base, label: "Details", exact: true },
          { href: `${base}/curriculum`, label: "Curriculum" },
          { href: `${base}/assessments`, label: "Assessments" },
          { href: `${base}/assignments`, label: "Assignments" },
          { href: `${base}/learners`, label: "Learners" },
          { href: `${base}/communication`, label: "Communication" },
          { href: `${base}/analytics`, label: "Analytics" },
        ]}
      />
      {children}
    </>
  );
}
