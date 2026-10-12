"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createLessonAction,
  createModuleAction,
  deleteModuleAction,
  reorderLessonsAction,
  reorderModulesAction,
  updateModuleAction,
} from "@/app/actions/instructor";
import { ConfirmAction } from "@/components/kit/confirm";
import { ActionForm, CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LessonItem = { id: string; title: string; isPublished: boolean; isPreview: boolean; estimatedMinutes: number };
type ModuleItem = { id: string; title: string; description: string; isPublished: boolean; lessons: LessonItem[] };

function Handle({ label, attributes, listeners }: { label: string } & Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) {
  return (
    <button
      type="button"
      className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function SortableLesson({ lesson, courseId }: { lesson: LessonItem; courseId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-card px-2 py-2 text-sm", isDragging && "relative z-10 shadow-md")}
    >
      <Handle label={`Reorder lesson ${lesson.title}`} attributes={attributes} listeners={listeners} />
      <Link href={`/instructor/courses/${courseId}/lessons/${lesson.id}`} className="min-w-0 flex-1 truncate hover:underline">
        {lesson.title}
      </Link>
      {lesson.isPreview && <Badge variant="secondary">Preview</Badge>}
      {lesson.isPublished ? (
        <Eye className="size-4 shrink-0 text-muted-foreground" aria-label="Published" />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <EyeOff className="size-4" aria-hidden /> Hidden
        </span>
      )}
      <Link
        href={`/instructor/courses/${courseId}/lessons/${lesson.id}`}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label={`Edit lesson ${lesson.title}`}
      >
        <Pencil className="size-4" aria-hidden />
      </Link>
    </li>
  );
}

function SortableModule({
  module,
  index,
  courseId,
  onLessonsReordered,
}: {
  module: ModuleItem;
  index: number;
  courseId: string;
  onLessonsReordered: (moduleId: string, lessons: LessonItem[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id });
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = module.lessons.findIndex((l) => l.id === active.id);
    const to = module.lessons.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    onLessonsReordered(module.id, arrayMove(module.lessons, from, to));
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-xl border bg-card", isDragging && "relative z-10 shadow-lg")}
    >
      <div className="flex items-center gap-2 border-b px-2 py-2.5">
        <Handle label={`Reorder module ${module.title}`} attributes={attributes} listeners={listeners} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {index + 1}. {module.title}
          </p>
          {module.description && <p className="truncate text-xs text-muted-foreground">{module.description}</p>}
        </div>
        {!module.isPublished && <Badge variant="outline">Hidden</Badge>}
        <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="border-b bg-muted/30 p-3">
          <ActionForm action={updateModuleAction} className="grid gap-3" onSuccess={() => setEditing(false)}>
            <input type="hidden" name="moduleId" value={module.id} />
            <FormMessage />
            <TextField label="Module title" name="title" defaultValue={module.title} required minLength={2} maxLength={120} />
            <TextAreaField label="Description" name="description" defaultValue={module.description} rows={2} maxLength={1000} />
            <CheckboxField
              label="Visible to learners"
              name="isPublished"
              defaultChecked={module.isPublished}
              hint="Hiding a module hides all of its lessons."
            />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Saving...">Save module</SubmitButton>
              <ConfirmAction
                action={deleteModuleAction}
                fields={{ moduleId: module.id }}
                title={`Delete "${module.title}"?`}
                description="The module and all of its lessons are permanently deleted, including learners' progress in them."
                confirmLabel="Delete module"
                destructive
                variant="ghost"
              >
                Delete module
              </ConfirmAction>
            </div>
          </ActionForm>
        </div>
      )}

      {module.lessons.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No lessons in this module yet.</p>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={module.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {module.lessons.map((lesson) => (
                <SortableLesson key={lesson.id} lesson={lesson} courseId={courseId} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="border-t p-2">
        {adding ? (
          <ActionForm action={createLessonAction} className="grid gap-3 p-1">
            <input type="hidden" name="moduleId" value={module.id} />
            <FormMessage />
            <TextField label="Lesson title" name="title" required minLength={2} maxLength={160} autoFocus />
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Creating...">Create and edit</SubmitButton>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </ActionForm>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Add lesson
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Course outline editor. Modules and lessons can be reordered by dragging the
 * handle or, with the keyboard, by focusing a handle and using space and the
 * arrow keys. Every change is saved to the server immediately.
 *
 * The parent passes a `key` derived from the server data, so this component
 * remounts with fresh state whenever the saved outline changes.
 */
export function CurriculumBoard({ courseId, modules: initial }: { courseId: string; modules: ModuleItem[] }) {
  const [modules, setModules] = useState(initial);
  const [, startTransition] = useTransition();
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(run: () => Promise<{ ok: boolean; message: string } | undefined>, previous: ModuleItem[]) {
    startTransition(async () => {
      const result = await run();
      if (result && !result.ok) {
        setModules(previous);
        toast.error(result.message);
      } else if (result?.message) {
        toast.success(result.message);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = modules.findIndex((m) => m.id === active.id);
    const to = modules.findIndex((m) => m.id === over.id);
    if (from < 0 || to < 0) return;
    const previous = modules;
    const next = arrayMove(modules, from, to);
    setModules(next);
    persist(() => reorderModulesAction(courseId, next.map((m) => m.id)), previous);
  }

  function onLessonsReordered(moduleId: string, lessons: LessonItem[]) {
    const previous = modules;
    setModules(modules.map((m) => (m.id === moduleId ? { ...m, lessons } : m)));
    persist(() => reorderLessonsAction(moduleId, lessons.map((l) => l.id)), previous);
  }

  return (
    <div className="space-y-4">
      {modules.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          This course has no modules yet. Add the first module below, then add lessons to it.
        </p>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-4">
              {modules.map((module, index) => (
                <SortableModule
                  key={module.id}
                  module={module}
                  index={index}
                  courseId={courseId}
                  onLessonsReordered={onLessonsReordered}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <section className="rounded-xl border bg-card p-4" aria-labelledby="add-module-heading">
        <h2 id="add-module-heading" className="text-base font-semibold">
          Add a module
        </h2>
        <ActionForm action={createModuleAction} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="courseId" value={courseId} />
          <TextField label="Module title" name="title" required minLength={2} maxLength={120} />
          <SubmitButton pendingLabel="Adding...">
            <Plus aria-hidden /> Add module
          </SubmitButton>
          <FormMessage className="sm:col-span-2" />
        </ActionForm>
      </section>
    </div>
  );
}
