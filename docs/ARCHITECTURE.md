# Architecture

## Shape of the system

```
Browser
  │  pages (React Server Components)        server actions / route handlers
  ▼                                          ▼
src/app  ── reads ──▶ src/server/queries ─┐   src/app/actions, src/app/api
                                          │        │ parse input, nothing else
                                          ▼        ▼
                              src/server/services      ◀── every rule and permission check
                                          │
                                          ▼
                              Drizzle ORM ──▶ PostgreSQL
                                          │
                 storage (S3 / local) · email (SMTP) · payments (provider)
```

- **Services** (`src/server/services`) hold all business rules. Each function takes the acting user and checks what that user may do before touching data. They have no dependency on Next.js, which is why the integration tests can call them directly.
- **Actions and route handlers** resolve the signed-in user from the session cookie, read the form, call one service, and translate the result. Known errors (`AppError`) become form messages; anything else is logged and replaced with a generic message.
- **Queries** (`src/server/queries`) are read models for pages. They apply the same authorization and return only what the page may show.
- **Pages** are rendered per request (`dynamic = "force-dynamic"` at the root). Nearly everything depends on who is signed in, so nothing is statically cached and one learner's data can never be served to another from a cache. This is why `cacheComponents` is switched off in `next.config.ts`.

## Decisions worth knowing

| Decision | Reason |
| --- | --- |
| Authorization inside services, not in pages or middleware | One place to get it right; UI checks are for convenience only. |
| "Not found" instead of "forbidden" for other people's records | Does not confirm that a draft course, an attempt or a file exists. |
| Sessions in the database | They can be revoked the moment a user is suspended or their role changes. |
| Role, suspension and permissions read from the database on every request | Nothing the browser sends is trusted for identity. |
| Lesson content stored as Markdown, rendered without raw HTML | Authors cannot inject script into learners' pages. |
| Files only through `/api/files/<id>` | Access is decided per request from the `files` table; storage keys are never exposed. |
| Money in integer minor units | No floating-point rounding of prices. |
| Certificate name and course title are snapshots | A certificate stays accurate if a name or title changes later. |
| Emails sent after the transaction commits | A rollback never produces a misleading email, and SMTP latency never holds a transaction open. |
| Grades have a `released_at` | Marks can be recorded without becoming visible; unreleased marks never affect what a learner sees, including completion. |

## Rules that are easy to get wrong

**Progress.** The percentage is completed lessons over countable lessons, where countable means published and inside a published module. Opening a lesson records a visit for "continue learning" and nothing else. The cached `enrollments.progress_percent` is recomputed for every learner whenever lessons are added, removed, published or hidden.

**Completion.** A course is complete when every rule enabled on the course is met: all lessons completed, every required assessment passed with a released result, every required assignment passed with a released grade. A course with no lessons can never be completed. Once completed, an enrollment stays completed even if lessons are added later.

**Who can see a course.** Published: everyone can see the public page; enrolled learners can open lessons. Unpublished: hidden from the catalog and closed to new enrollment, but learners who are already enrolled keep access. Draft, pending review, archived: only the teaching team and administrators.

**Assessment attempts.** The deadline is computed on the server when the attempt starts: the earlier of start time plus the time limit and the assessment's closing time. Every save and submit is compared against it with a 15-second network allowance. Interrupted attempts: answers are saved as the learner works, the clock keeps running, the learner may resume until the deadline, and afterwards the attempt is closed with whatever was saved the next time anyone looks at it (the learner, or the instructor opening the attempts list).

**Scoring.** Single-answer and true/false: full marks or none. Multiple-select: all-or-nothing on an exact match. Short answer: compared with the accepted answers ignoring case and spacing; with no accepted answers it is marked manually. Essays and file uploads are marked manually. Negative marking deducts the configured percentage for a wrong objective answer, never for a blank, and the total never goes below zero.

**Questions are frozen once used.** After a learner has started an assessment its question list cannot change, and a question that has been answered cannot be edited. This keeps old results gradable.

## Database schema

47 tables. Primary keys are UUIDs generated by PostgreSQL. Timestamps are `timestamptz`. Definitions live in `src/server/db/schema/`.

### Identity

| Table | Purpose |
| --- | --- |
| `users` | Account: name, unique email, `role` (student, instructor, admin), `banned`, `ban_reason`. |
| `accounts` | Credential record with the password hash (Better Auth). |
| `sessions` | Active sessions; deleting rows signs the user out. |
| `verifications` | Single-use, expiring tokens for password reset and email verification. |
| `rate_limits` | Authentication rate-limit counters. |
| `profiles` | Optional headline, bio, phone, country, notification preferences, deletion request date. |
| `role_permissions` | Administrator overrides on the default permission matrix. |
| `instructor_applications` | Applications to teach and their review outcome. |

### Catalogue

| Table | Purpose |
| --- | --- |
| `categories`, `tags`, `course_tags` | Organisation of the catalog. |
| `courses` | Slug (unique), descriptions, owner, category, level, language, duration, objectives, prerequisites, price and currency, status, enrollment settings, completion rules, review note. |
| `course_instructors` | Teaching team (owner or instructor). |
| `modules` | Ordered sections of a course, with a published flag. |
| `lessons` | Ordered lessons: Markdown content, video link or file, duration, preview and published flags. |
| `lesson_resources` | Files and links attached to a lesson. |
| `files` | Registry of every stored object: storage key, name, type, size, purpose, uploader, course. |
| `live_sessions` | Scheduled meeting links (no provider API integration). |

### Learning

| Table | Purpose |
| --- | --- |
| `enrollments` | One per learner and course (unique): status, source, cached progress, last lesson, completion date. |
| `lesson_progress` | One per learner and lesson: completion time, video position, last access. |
| `bookmarks`, `lesson_notes` | Private to the learner. |
| `activity_events` | Append-only learner activity feed. |
| `user_badges` | Milestones (first enrollment, first lesson, course completed, perfect score). |

### Assessment

| Table | Purpose |
| --- | --- |
| `question_banks` | Owned by an instructor, optionally shared with a course's team. |
| `questions`, `question_options` | Six question types; options carry the correct flag. |
| `assessments` | Quiz or examination: window, time limit, pass mark, attempt limit, shuffling, negative marking, release policy. |
| `assessment_questions` | Ordered questions of an assessment. |
| `assessment_attempts` | One per attempt (unique per learner and number): per-learner layout, deadline, status, score, release time. |
| `attempt_answers` | One per question in an attempt: selection, text or file, awarded marks, feedback. |
| `assignments` | Instructions, deadline, marks, accepted submission types, late and resubmission policy. |
| `assignment_submissions`, `submission_files` | One submission per learner and assignment (unique), with attachments, marks, feedback, release time. |

Grades and feedback live on attempts and submissions; there is no separate grades table.

### Certificates, communication, commerce, operations

| Table | Purpose |
| --- | --- |
| `certificate_templates` | Heading, wording, signatory, accent colour. |
| `certificates` | Unique number, snapshots of learner and course names, status, revocation details. One per enrollment (unique). |
| `discussions`, `discussion_replies`, `content_reports` | Course discussions and moderation. |
| `announcements` | Course-level, or platform-wide when `course_id` is null. |
| `notifications` | In-app notifications with read state. |
| `support_requests` | Contact form messages and their handling. |
| `payment_transactions` | One per payment attempt; unique on provider and provider reference. |
| `refunds` | Refund requests and decisions. |
| `audit_logs` | Append-only record of privileged operations. |
| `platform_settings` | Key and JSON value for each setting. |
| `rate_limit_hits` | Application-level rate-limit counters. |

### Deletion policy

- Deleting a course cascades to its modules, lessons, assessments and assignments, and is only permitted while nobody has ever enrolled. Otherwise courses are archived.
- Enrollments, certificates and payments restrict deletion of the course and user they refer to, so those records cannot be orphaned.
- Users are not hard-deleted. The account-deletion workflow anonymises the user and removes profile, credentials, sessions, notes, bookmarks and notifications, keeping grade, certificate and payment records.

## Permission matrix

Three roles. Administrators always hold every permission. Instructors' permissions can be adjusted by an administrator under **Admin > Roles and permissions**, except the two governance permissions. Learners have no management permissions; their abilities (enroll, study, submit, see their own records) are built into the services.

| Permission | Learner | Instructor (default) | Admin |
| --- | :---: | :---: | :---: |
| `course.create`: create courses and manage those they teach | | ✓ | ✓ |
| `course.publish_direct`: publish without review | | grantable | ✓ |
| `course.manage_any`: manage every course | | grantable | ✓ |
| `course.review`: approve or reject submitted courses | | grantable | ✓ |
| `question_bank.manage` | | ✓ | ✓ |
| `grading.manage`: grade in courses they teach | | ✓ | ✓ |
| `discussion.moderate`: in courses they teach | | ✓ | ✓ |
| `announcement.course` | | ✓ | ✓ |
| `announcement.platform` | | grantable | ✓ |
| `live_session.manage` | | ✓ | ✓ |
| `report.export` | | ✓ | ✓ |
| `user.manage` | | grantable | ✓ |
| `instructor.approve` | | grantable | ✓ |
| `category.manage` | | grantable | ✓ |
| `enrollment.manage` | | grantable | ✓ |
| `assessment.oversee` | | grantable | ✓ |
| `certificate.manage` | | grantable | ✓ |
| `support.manage` | | grantable | ✓ |
| `payment.manage` | | grantable | ✓ |
| `audit.view` | | grantable | ✓ |
| `role.assign`: change roles, edit this matrix | | never | ✓ |
| `settings.manage` | | never | ✓ |

The `/admin` area itself is restricted to the administrator role. A granted permission lets an instructor perform that operation through the services; it does not open the administration console.

**Ownership is checked separately from permissions.** Holding `course.create` lets an instructor manage only courses where they are on the teaching team. Holding `grading.manage` lets them grade only in those courses. Every course-management function goes through `assertCanManageCourse`.

## Routes

| Area | Routes |
| --- | --- |
| Public | `/`, `/courses`, `/courses/[slug]`, `/courses/[slug]/preview/[lessonId]`, `/about`, `/faq`, `/contact`, `/teach`, `/privacy`, `/terms`, `/refund-policy`, `/verify`, `/verify/[number]` |
| Authentication | `/sign-in`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard` (redirects by role) |
| Any signed-in user | `/account`, `/notifications`, `/discussions/[id]`, `/checkout/[slug]`, `/checkout/status/[id]` |
| Learner | `/learn`, `/learn/courses`, `/learn/courses/[slug]`, `.../lessons/[lessonId]`, `.../discussions`, `/learn/assessments/[id]`, `/learn/attempts/[id]`, `/learn/attempts/[id]/result`, `/learn/assignments/[id]`, `/learn/grades`, `/learn/calendar`, `/learn/bookmarks`, `/learn/certificates`, `/learn/purchases` |
| Instructor | `/instructor`, `/instructor/courses`, `/instructor/courses/[id]` (details, curriculum, lessons, assessments, assignments, learners, communication, analytics), `/instructor/assessments/[id]`, `.../attempts`, `/instructor/attempts/[id]`, `/instructor/assignments/[id]`, `/instructor/submissions/[id]`, `/instructor/grading`, `/instructor/question-banks`, `/instructor/question-banks/[id]` |
| Administrator | `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/instructors`, `/admin/enrollments`, `/admin/permissions`, `/admin/courses`, `/admin/courses/[id]`, `/admin/categories`, `/admin/assessments`, `/admin/certificates`, `/admin/announcements`, `/admin/support`, `/admin/payments`, `/admin/settings`, `/admin/audit`, `/admin/health` |
| API | `/api/auth/*`, `/api/upload`, `/api/files/[id]`, `/api/certificates/[id]/pdf`, `/api/export/[report]`, `/api/payments/[provider]/callback/[token]`, `/api/health` |

## Branding

`src/components/site/footer.tsx` is the single footer component, used by the public site, the sign-in pages and all three dashboards. It prints `© <current year> Cypher Green Systems. All rights reserved.` and `Powered by Cypher Green Systems (CGS)`. The year is computed at request time. The attribution links to the URL set in **Admin > Settings** (or `CGS_WEBSITE_URL`); when neither is set it is plain text, so there is never a guessed or broken link.

The platform has its own name (default "CGS Academy", changeable in Settings), colour theme and logo.

## Extending

The schema and services already leave room for the optional features that were deliberately deferred:

- **Multiple instructors per course**: implemented (`course_instructors`).
- **Other payment providers**: implement `PaymentProvider`.
- **Live classrooms through a provider API**: `live_sessions` stores links today; add provider fields and a creation call.
- **Learning paths and prerequisites**: add a `course_prerequisites` table and one check in `enrollInFreeCourse` and `startCheckout`.
- **Group enrollments and organisational portals**: add an organisations table and use `grantEnrollment`, which already exists for administrators.
- **Additional languages**: interface strings are in the components; introduce a message catalogue.
- **AI-assisted features**: nothing in learning, assessment, grading or certification depends on AI, and nothing should.
