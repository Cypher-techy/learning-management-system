import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import {
  EmptyState,
  first,
  LinkButton,
  pageParam,
  Pagination,
  selectClass,
  withParams,
  type SearchParams,
} from "@/components/kit/primitives";
import { CourseCard, CourseGrid } from "@/components/site/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCategories, listPublicInstructors, listPublishedCourses } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Course catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = {
    q: first(sp.q),
    category: first(sp.category),
    level: first(sp.level),
    price: first(sp.price),
    instructor: first(sp.instructor),
    sort: first(sp.sort),
  };
  const [result, categories, instructors] = await Promise.all([
    listPublishedCourses({ ...filters, page: pageParam(sp.page) }),
    listCategories(),
    listPublicInstructors(),
  ]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Course catalog</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? "course" : "courses"} {filtered ? "match your filters" : "available"}
      </p>

      <form className="mt-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Title, topic or instructor" />
        </div>
        <FilterSelect id="category" label="Category" value={filters.category}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="level" label="Difficulty" value={filters.level}>
          <option value="">Any level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="all_levels">All levels</option>
        </FilterSelect>
        <FilterSelect id="price" label="Price" value={filters.price}>
          <option value="">Free and paid</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </FilterSelect>
        <FilterSelect id="instructor" label="Instructor" value={filters.instructor}>
          <option value="">Any instructor</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="sort" label="Sort by" value={filters.sort}>
          <option value="">Newest</option>
          <option value="popular">Most enrolled</option>
          <option value="title">Title (A-Z)</option>
          <option value="price">Price (low to high)</option>
        </FilterSelect>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Apply filters</Button>
          {filtered && (
            <LinkButton href="/courses" variant="ghost">
              Clear
            </LinkButton>
          )}
        </div>
      </form>

      <div className="mt-6">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={filtered ? "No courses match your filters" : "No courses have been published yet"}
            description={filtered ? "Try a different search term or remove a filter." : "Please check back soon."}
            action={filtered ? <LinkButton href="/courses">Show all courses</LinkButton> : undefined}
          />
        ) : (
          <>
            <CourseGrid>
              {result.rows.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </CourseGrid>
            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              hrefFor={(page) => withParams("/courses", filters, { page })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  children,
}: {
  id: string;
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} defaultValue={value ?? ""} className={selectClass}>
        {children}
      </select>
    </div>
  );
}
