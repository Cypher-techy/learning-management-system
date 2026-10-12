import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Check, Clock, Eye, Globe, Lock, Signal, Users } from "lucide-react";
import { enrollAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { LinkButton, Markdown } from "@/components/kit/primitives";
import { CourseThumb } from "@/components/site/course-card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatMoney, titleCase } from "@/lib/format";
import { db } from "@/server/db";
import { getActor } from "@/server/auth/session";
import { getPaymentStatus } from "@/server/payments/providers";
import { getPublishedCourse } from "@/server/queries/catalog";
import { getPlatform } from "@/server/queries/context";
import { getEnrollment } from "@/server/services/enrollment";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublishedCourse((await params).slug);
  if (!data) return { title: "Course not found" };
  return { title: data.course.title, description: data.course.shortDescription };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  // Drafts, unpublished and archived courses do not exist as far as this page is concerned.
  const data = await getPublishedCourse(slug);
  if (!data) notFound();
  const { course } = data;
  const [actor, platform] = await Promise.all([getActor(), getPlatform()]);
  const enrollment = actor ? await getEnrollment(db, actor.id, course.id) : null;
  const enrolled = enrollment && (enrollment.status === "active" || enrollment.status === "completed");
  const lessonTotal = data.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const full = course.enrollmentLimit !== null && data.enrolledCount >= course.enrollmentLimit;
  const paid = course.priceCents > 0;
  const payments = getPaymentStatus();

  let cta: React.ReactNode;
  if (enrolled) {
    cta = (
      <LinkButton href={`/learn/courses/${course.slug}`} size="lg" className="w-full">
        {enrollment.status === "completed" ? "Review course" : "Continue learning"}
      </LinkButton>
    );
  } else if (enrollment?.status === "suspended") {
    cta = <Notice>Your enrollment in this course is suspended. Please contact support.</Notice>;
  } else if (!course.enrollmentOpen) {
    cta = <Notice>Enrollment for this course is currently closed.</Notice>;
  } else if (full) {
    cta = <Notice>This course is full.</Notice>;
  } else if (!actor) {
    cta = (
      <>
        <LinkButton href={`/sign-in?next=/courses/${course.slug}`} size="lg" className="w-full">
          Sign in to {paid ? "buy" : "enroll"}
        </LinkButton>
        {platform.registrationEnabled && (
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={`/register?next=/courses/${course.slug}`} className="text-primary hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </>
    );
  } else if (paid) {
    cta = payments.enabled ? (
      <LinkButton href={`/checkout/${course.slug}`} size="lg" className="w-full">
        Buy this course
      </LinkButton>
    ) : (
      <Notice>
        {payments.reason} <Link href="/contact" className="text-primary hover:underline">Contact us</Link> to arrange access.
      </Notice>
    );
  } else if (!platform.selfEnrollmentEnabled) {
    cta = <Notice>Self-enrollment is disabled. Contact the administrator to be enrolled.</Notice>;
  } else {
    cta = (
      <ActionButton action={enrollAction} fields={{ courseId: course.id }} variant="default" size="lg" className="w-full">
        Enroll for free
      </ActionButton>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/courses" className="hover:text-foreground hover:underline">
          Courses
        </Link>
        {data.categoryName && (
          <>
            {" / "}
            <Link href={`/courses?category=${data.categorySlug}`} className="hover:text-foreground hover:underline">
              {data.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <header>
            <h1 className="text-3xl font-semibold text-balance">{course.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{course.shortDescription}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Meta icon={Signal}>{titleCase(course.level)}</Meta>
              <Meta icon={Clock}>{formatDuration(course.estimatedMinutes)}</Meta>
              <Meta icon={BookOpen}>
                {lessonTotal} {lessonTotal === 1 ? "lesson" : "lessons"}
              </Meta>
              <Meta icon={Globe}>{course.language}</Meta>
              {data.enrolledCount > 0 && <Meta icon={Users}>{data.enrolledCount} enrolled</Meta>}
            </div>
            {data.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          {course.objectives.length > 0 && (
            <section aria-labelledby="objectives-heading" className="rounded-xl border bg-card p-5">
              <h2 id="objectives-heading" className="text-lg font-semibold">
                What you will learn
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {course.objectives.map((objective) => (
                  <li key={objective} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="mb-3 text-lg font-semibold">
              About this course
            </h2>
            <Markdown>{course.description}</Markdown>
          </section>

          {course.prerequisites.length > 0 && (
            <section aria-labelledby="prerequisites-heading">
              <h2 id="prerequisites-heading" className="mb-3 text-lg font-semibold">
                Prerequisites
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {course.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="curriculum-heading">
            <h2 id="curriculum-heading" className="mb-3 text-lg font-semibold">
              Course content
            </h2>
            <div className="space-y-3">
              {data.modules.map((module, index) => (
                <div key={module.id} className="rounded-xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <p className="font-medium">
                      {index + 1}. {module.title}
                    </p>
                    {module.description && <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>}
                  </div>
                  <ul className="divide-y">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        {lesson.isPreview ? (
                          <Eye className="size-4 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          {lesson.isPreview && !enrolled ? (
                            <Link href={`/courses/${course.slug}/preview/${lesson.id}`} className="text-primary hover:underline">
                              {lesson.title}
                            </Link>
                          ) : (
                            lesson.title
                          )}
                          {lesson.isPreview && <span className="ml-2 text-xs text-muted-foreground">Free preview</span>}
                        </span>
                        {lesson.estimatedMinutes > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(lesson.estimatedMinutes)}</span>
                        )}
                      </li>
                    ))}
                    {module.lessons.length === 0 && (
                      <li className="px-4 py-2.5 text-sm text-muted-foreground">Lessons coming soon.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="instructors-heading">
            <h2 id="instructors-heading" className="mb-3 text-lg font-semibold">
              {data.team.length > 1 ? "Your instructors" : "Your instructor"}
            </h2>
            <ul className="space-y-3">
              {data.team.map((person) => (
                <li key={person.id} className="rounded-xl border bg-card p-4">
                  <p className="font-medium">{person.name}</p>
                  {person.headline && <p className="text-sm text-muted-foreground">{person.headline}</p>}
                  {person.bio && <p className="mt-2 text-sm whitespace-pre-line">{person.bio}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border bg-card">
            <CourseThumb fileId={course.thumbnailFileId} title={course.title} />
            <div className="space-y-3 p-4">
              <p className="text-2xl font-semibold">{formatMoney(course.priceCents, course.currency)}</p>
              {cta}
              <ul className="space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
                <li>Progress tracking across your devices</li>
                {course.certificateEnabled && <li>Verifiable certificate on completion</li>}
                {course.enrollmentLimit !== null && <li>Limited to {course.enrollmentLimit} learners</li>}
                {course.publishedAt && <li>Published {formatDate(course.publishedAt)}</li>}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-4" aria-hidden />
      {children}
    </span>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border bg-muted px-3 py-2 text-sm">{children}</p>;
}
