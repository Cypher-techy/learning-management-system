import type { Metadata } from "next";
import { CurriculumBoard } from "@/components/instructor/curriculum-board";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { assertCanManageCourse, getCurriculum } from "@/server/services/courses";

export const metadata: Metadata = { title: "Curriculum" };

export default async function CurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  await load(() => assertCanManageCourse(actor, id));
  const curriculum = await getCurriculum(id);

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm text-muted-foreground">
        Drag the handle to reorder modules and lessons, or focus a handle and use the space bar and arrow keys. New
        lessons start hidden until you publish them.
      </p>
      <CurriculumBoard
        key={JSON.stringify(curriculum.map((m) => [m.id, m.updatedAt, m.lessons.map((l) => [l.id, l.updatedAt])]))}
        courseId={id}
        modules={curriculum.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          isPublished: m.isPublished,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            isPublished: l.isPublished,
            isPreview: l.isPreview,
            estimatedMinutes: l.estimatedMinutes,
          })),
        }))}
      />
    </div>
  );
}
