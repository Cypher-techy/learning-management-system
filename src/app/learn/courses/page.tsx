import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState, LinkButton, PageHeader } from "@/components/kit/primitives";
import { CourseCard, CourseGrid } from "@/components/site/course-card";
import { requireActor } from "@/server/auth/session";
import { myEnrollments } from "@/server/queries/learner";

export const metadata: Metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const actor = await requireActor("/learn/courses");
  const enrolled = await myEnrollments(actor.id);
  const active = enrolled.filter((e) => e.enrollment.status === "active");
  const completed = enrolled.filter((e) => e.enrollment.status === "completed");

  return (
    <>
      <PageHeader
        title="My courses"
        description="Courses you are enrolled in. Your progress is saved to your account."
        actions={<LinkButton href="/courses" variant="outline">Browse more courses</LinkButton>}
      />
      {enrolled.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="When you enroll in a course it will appear here."
          action={<LinkButton href="/courses">Browse courses</LinkButton>}
        />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section aria-labelledby="active-heading">
              <h2 id="active-heading" className="mb-3 text-lg font-semibold">
                In progress ({active.length})
              </h2>
              <CourseGrid>
                {active.map(({ course, enrollment }) => (
                  <CourseCard key={course.id} course={course} href={`/learn/courses/${course.slug}`} progress={enrollment.progressPercent} />
                ))}
              </CourseGrid>
            </section>
          )}
          {completed.length > 0 && (
            <section aria-labelledby="completed-heading">
              <h2 id="completed-heading" className="mb-3 text-lg font-semibold">
                Completed ({completed.length})
              </h2>
              <CourseGrid>
                {completed.map(({ course }) => (
                  <CourseCard key={course.id} course={course} href={`/learn/courses/${course.slug}`} progress={100} />
                ))}
              </CourseGrid>
            </section>
          )}
        </div>
      )}
    </>
  );
}
