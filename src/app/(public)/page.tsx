import Link from "next/link";
import { Award, BookOpen, ClipboardCheck, LineChart, Search, Smartphone, UserPlus } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/kit/primitives";
import { CourseCard, CourseGrid } from "@/components/site/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActor } from "@/server/auth/session";
import { listCategories, listPublishedCourses, publicStats } from "@/server/queries/catalog";
import { getPlatform } from "@/server/queries/context";

const STEPS = [
  { icon: UserPlus, title: "Create your account", text: "Register with your email address. It takes about a minute." },
  { icon: BookOpen, title: "Enroll in a course", text: "Pick a course from the catalog and start with the first lesson." },
  { icon: ClipboardCheck, title: "Learn and be assessed", text: "Work through lessons, quizzes, assignments and examinations at your own pace." },
  { icon: Award, title: "Earn your certificate", text: "Meet the completion requirements to receive a certificate anyone can verify." },
];

const BENEFITS = [
  { icon: LineChart, title: "Progress that follows you", text: "Your place, completed lessons and grades are saved to your account and available on any device." },
  { icon: ClipboardCheck, title: "Real assessment", text: "Timed examinations, automatically graded quizzes and instructor-marked assignments with written feedback." },
  { icon: Award, title: "Verifiable certificates", text: "Each certificate carries a unique number that employers and institutions can check on this site." },
  { icon: Smartphone, title: "Built for everyday connections", text: "Lightweight pages and text-first lessons that stay usable on a phone and on slower networks." },
];

export default async function HomePage() {
  const [platform, actor, featured, recent, categories, stats] = await Promise.all([
    getPlatform(),
    getActor(),
    listPublishedCourses({ sort: "popular", pageSize: 4 }),
    listPublishedCourses({ sort: "recent", pageSize: 4 }),
    listCategories(),
    publicStats(),
  ]);
  const activeCategories = categories.filter((c) => c.courseCount > 0);

  return (
    <>
      <section className="border-b bg-accent/40">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div>
            <h1 className="text-3xl font-semibold text-balance sm:text-4xl lg:text-5xl">
              Learn practical skills. Prove what you know.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">{platform.platformDescription}</p>
            <form action="/courses" role="search" className="mt-6 flex max-w-lg gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden />
                <Input
                  name="q"
                  type="search"
                  placeholder="What would you like to learn?"
                  aria-label="Search courses"
                  className="h-9 bg-background pl-9"
                />
              </div>
              <Button type="submit" size="lg">
                Search
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-2">
              <LinkButton href="/courses" size="lg">
                Browse courses
              </LinkButton>
              {!actor && platform.registrationEnabled && (
                <LinkButton href="/register" variant="outline" size="lg">
                  Create a free account
                </LinkButton>
              )}
              {!actor && (
                <LinkButton href="/sign-in" variant="ghost" size="lg">
                  Sign in
                </LinkButton>
              )}
            </div>
          </div>
          {stats.courses > 0 && (
            <dl className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-5 text-center">
              <Stat label="Published courses" value={stats.courses} />
              <Stat label="Learners enrolled" value={stats.learners} />
              <Stat label="Certificates issued" value={stats.certificates} />
            </dl>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12">
        <section aria-labelledby="featured-heading">
          <SectionHeading id="featured-heading" title="Featured courses" href="/courses?sort=popular" />
          {featured.rows.length > 0 ? (
            <CourseGrid>
              {featured.rows.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </CourseGrid>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Courses are on the way"
              description="No courses have been published yet. Please check back soon."
            />
          )}
        </section>

        {activeCategories.length > 0 && (
          <section aria-labelledby="categories-heading">
            <SectionHeading id="categories-heading" title="Browse by category" />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activeCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/courses?category=${category.slug}`}
                    className="flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
                  >
                    <span className="font-medium">{category.name}</span>
                    {category.description && (
                      <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{category.description}</span>
                    )}
                    <span className="mt-2 text-xs text-muted-foreground">
                      {category.courseCount} {category.courseCount === 1 ? "course" : "courses"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.rows.length > 0 && (
          <section aria-labelledby="recent-heading">
            <SectionHeading id="recent-heading" title="Recently published" href="/courses" />
            <CourseGrid>
              {recent.rows.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </CourseGrid>
          </section>
        )}

        <section aria-labelledby="how-heading">
          <SectionHeading id="how-heading" title="How it works" />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <step.icon className="size-4 text-primary" aria-hidden />
                  Step {index + 1}
                </div>
                <p className="mt-2 font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="benefits-heading">
          <SectionHeading id="benefits-heading" title="Why learn here" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex gap-3 rounded-xl border bg-card p-4">
                <benefit.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">{benefit.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{benefit.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cta-heading" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 id="cta-heading" className="text-lg font-semibold">
              For learners
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a free course, track your progress and build a record of verified achievements.
            </p>
            <LinkButton href={actor ? "/learn" : "/register"} className="mt-4">
              {actor ? "Go to my learning" : "Start learning"}
            </LinkButton>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">For instructors</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your expertise. Build courses with lessons, assessments and certificates, and follow how your
              learners are doing.
            </p>
            <LinkButton href="/teach" variant="outline" className="mt-4">
              Teach on {platform.platformName}
            </LinkButton>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value.toLocaleString("en-KE")}</dd>
    </div>
  );
}

function SectionHeading({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm text-primary hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
