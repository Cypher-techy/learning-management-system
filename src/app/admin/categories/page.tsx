import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { createTagAction, deleteCategoryAction, deleteTagAction, saveCategoryAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/kit/confirm";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import { PageHeader, Section } from "@/components/kit/primitives";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { listCategories } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Categories and tags" };

export default async function CategoriesPage() {
  await requirePermission("category.manage");
  const [categories, tags] = await Promise.all([listCategories(), db.select().from(schema.tags).orderBy(asc(schema.tags.name))]);

  return (
    <>
      <PageHeader title="Categories and tags" description="Subjects used to organise the course catalog. Difficulty levels are fixed: beginner, intermediate, advanced and all levels." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Categories">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet. Courses need a category before they can be published.</p>
          ) : (
            <ul className="space-y-3">
              {categories.map((category) => (
                <li key={category.id} className="rounded-lg border p-3">
                  <ActionForm action={saveCategoryAction} className="grid gap-3 sm:grid-cols-[1fr_5rem]">
                    <input type="hidden" name="categoryId" value={category.id} />
                    <TextField label="Name" name="name" defaultValue={category.name} required minLength={2} maxLength={60} />
                    <TextField label="Order" name="position" type="number" min={0} max={1000} defaultValue={category.position} />
                    <TextField label="Description" name="description" defaultValue={category.description ?? ""} maxLength={300} className="sm:col-span-2" />
                    <FormMessage className="sm:col-span-2" />
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <SubmitButton variant="outline" size="sm" pendingLabel="Saving...">
                        Save
                      </SubmitButton>
                      <ConfirmAction
                        action={deleteCategoryAction}
                        fields={{ categoryId: category.id }}
                        title={`Delete "${category.name}"?`}
                        description="Courses in this category become uncategorised."
                        confirmLabel="Delete"
                        destructive
                        variant="ghost"
                        size="sm"
                      >
                        Delete
                      </ConfirmAction>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {category.courseCount} published {category.courseCount === 1 ? "course" : "courses"}
                      </span>
                    </div>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={saveCategoryAction} resetOnSuccess className="mt-5 grid gap-3 border-t pt-4">
            <p className="text-sm font-medium">Add a category</p>
            <FormMessage />
            <TextField label="Name" name="name" required minLength={2} maxLength={60} />
            <TextField label="Description" name="description" maxLength={300} />
            <div>
              <SubmitButton pendingLabel="Adding...">Add category</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Tags" description="Optional keywords instructors can attach to courses.">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center gap-1">
                  <Badge variant="secondary">{tag.name}</Badge>
                  <ConfirmAction
                    action={deleteTagAction}
                    fields={{ tagId: tag.id }}
                    title={`Delete the tag "${tag.name}"?`}
                    confirmLabel="Delete"
                    destructive
                    variant="ghost"
                    size="xs"
                    aria-label={`Delete tag ${tag.name}`}
                  >
                    Delete
                  </ConfirmAction>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={createTagAction} resetOnSuccess className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <TextField label="New tag" name="name" required minLength={2} maxLength={40} />
            <SubmitButton pendingLabel="Adding...">Add tag</SubmitButton>
            <FormMessage className="sm:col-span-2" />
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
