# Implementation status

Last updated: 12 October 2026.

Legend: **Done** means built and exercised by automated tests or by hand against a real database. **Built, not verified** means the code exists but has not been proven against the real external service. **Not built** means exactly that.

## Verification summary

| Check | Result |
| --- | --- |
| Type check (`npm run typecheck`) | Passes |
| Lint (`npm run lint`) | Passes, no warnings |
| Production build (`npm run build`) | Passes |
| Migrations | Apply cleanly to an empty PostgreSQL 17 database (47 tables) |
| Unit and integration tests (`npm test`) | 84 of 84 pass |
| Browser tests (`npm run test:e2e`) | All 22 scenarios have passed, across three partial runs. See "Browser test results". |

## Features

### Accounts and access

| Feature | Status |
| --- | --- |
| Registration, sign-in, sign-out | Done |
| Password recovery with single-use, expiring link | Done |
| Change password, revoke other sessions | Done |
| Email verification | Built; needs SMTP to deliver the link. Off by default. |
| Three roles with separate dashboards | Done |
| Server-side authorization for every operation | Done |
| Adjustable permission matrix for instructors | Done |
| Instructor application and approval | Done |
| User creation, editing, suspension, reactivation, session revocation | Done |
| Password re-entry for sensitive administrator actions | Done |
| Account deletion request and anonymisation | Done |
| Two-factor authentication | Not built |
| Social sign-in | Not built |

### Public site

| Feature | Status |
| --- | --- |
| Homepage with search, featured and recent courses, categories, live totals | Done |
| Catalog with search, filters (category, level, price, instructor), sorting, pagination | Done |
| Course detail page, free lesson previews | Done |
| About, FAQ, contact form, privacy, terms, refund policy | Done. Policy text should be reviewed by your legal adviser. |
| Certificate verification | Done |
| Custom not-found and error pages | Done |
| Testimonials | Not built, deliberately: there are no genuine testimonials to show. |

### Courses and learning

| Feature | Status |
| --- | --- |
| Course, module and lesson management | Done |
| Markdown lessons, video by link (YouTube, Vimeo, direct file) or upload, file and link resources | Done |
| Drag-and-drop and keyboard reordering, saved on the server | Done for reordering modules and for reordering lessons inside a module. Dragging a lesson into a different module is not built, although the service supports it. |
| Draft, review, publish, unpublish, archive, restore | Done |
| Publication validation | Done |
| Thumbnails, categories, tags, objectives, prerequisites, level, language, price | Done |
| Multiple instructors per course | Done |
| Free enrollment, seat limits, closed enrollment | Done |
| Lesson player with outline, previous and next, progress | Done |
| Progress from explicit completion only, restored across devices | Done |
| Video resume position | Done for uploaded and directly linked video files. Not possible for embedded YouTube or Vimeo players. |
| Bookmarks and private notes | Done |
| Learner dashboard: continue learning, deadlines, announcements, activity, certificates | Done |
| Calendar of deadlines and live sessions | Done as a dated list. No month grid and no export to external calendars. |
| Badges | Done (four milestones) |

### Assessment

| Feature | Status |
| --- | --- |
| Multiple choice, multiple select, true or false, short answer, essay, file upload | Done. "Single-answer" and "multiple choice" are the same type. |
| Question banks and reuse across assessments | Done |
| Windows, time limits, pass marks, attempt limits, shuffling, negative marking | Done |
| Autosave, resume after interruption, automatic close at the deadline | Done |
| Automatic grading on the server | Done |
| Manual grading with per-answer and overall feedback | Done |
| Immediate or instructor-controlled release of results | Done |
| Correct answers hidden unless the assessment allows them | Done |
| Assignments: text and files, drafts, deadlines, late policy and penalty, resubmission | Done |
| Media attached to questions | Not built (the column exists; there is no upload control) |
| Proctoring, browser lockdown | Not built. See the security notes. |

### Certificates

| Feature | Status |
| --- | --- |
| Automatic issue when completion rules are met | Done |
| Unique, unguessable certificate number | Done |
| PDF download | Done. Standard fonts only: non-Latin names are transliterated. |
| Configurable templates (wording, signatory, colour, score) | Done. Text and colour only; no background image or signature image. |
| Public verification, revocation, reinstatement | Done |

### Communication

| Feature | Status |
| --- | --- |
| In-app notifications with read state | Done |
| Notification preferences per category and channel | Done |
| Email notifications | Built; needs SMTP. Without it, emails are printed to the console in development and not sent in production. |
| Course and platform announcements | Done |
| Course discussions, replies, pin, lock, hide, report | Done |
| Live session links | Done as scheduled links. No provider API integration. |
| Deadline reminder notifications | Not built. Learners are notified when an assessment or assignment is published and see deadlines on the dashboard and calendar, but nothing is sent as a deadline approaches. That needs a scheduled job. |

### Payments

| Feature | Status |
| --- | --- |
| Paid course pricing, checkout, transaction records, purchase history | Done |
| Verified, idempotent callback handling; enrollment only after confirmed payment | Done, covered by tests with a stand-in provider |
| Sandbox provider for development and tests | Done. Refused in production. |
| M-Pesa Daraja STK Push | **Built, not verified.** Needs Safaricom credentials. Never run against live or sandbox Daraja. |
| Refund requests and decisions | Done as a record-keeping workflow. **The system does not return money**; do that in the provider's portal. |
| Printable receipts | Not built. The receipt number is shown in the purchase history. |

### Administration

| Feature | Status |
| --- | --- |
| Overview with live totals, trends, alerts, recent activity | Done |
| Users, instructor applications, enrollments, roles and permissions | Done |
| Course review and management, categories and tags | Done |
| Assessment oversight, certificate management and templates | Done |
| Announcements, support requests, reported content | Done |
| Payments and refunds | Done (see Payments) |
| Settings: name, description, contacts, theme, logo, CGS URL, policy links, registration, enrollment, approval, currency, completion defaults, upload rules | Done |
| Email and payment provider settings | By environment variable only, on purpose, so secrets are never stored or shown in the application. The settings page shows their status. |
| Audit log | Done |
| CSV exports (users, enrollments, payments, certificates, course learners, assessment and assignment results) | Done |
| System health page and `/api/health` | Done |
| Database backup status | Not available from inside the application. The health page says so and points to the provider. |

### Branding

| Feature | Status |
| --- | --- |
| Reusable CGS footer on public pages, sign-in pages and all three dashboards | Done |
| Copyright year computed at request time | Done |
| Attribution links to the configured CGS URL, plain text when none is set | Done |
| Light and dark themes, four colour themes | Done |

## What the automated tests prove

Mapped to the 20 verification items in the project brief.

| # | Requirement | Where it is tested |
| --- | --- | --- |
| 1 | Register, authenticate, log out, recover access | Browser |
| 2 | Redirect to the correct dashboard per role | Browser, unit |
| 3 | Learners cannot reach instructor or administrator routes | Browser, integration |
| 4 | Instructors cannot modify courses they do not control | Integration, browser |
| 5 | Draft and unpublished courses stay closed | Integration, browser |
| 6 | Learners can enroll in eligible courses | Integration, browser |
| 7 | Progress persists across sessions | Integration, browser |
| 8 | Examination answers save correctly | Integration, browser |
| 9 | Expired examinations and attempt limits are enforced | Integration |
| 10 | Objective questions are graded correctly | Unit, integration, browser |
| 11 | Manual grading and feedback work | Integration |
| 12 | Assignment files are protected | Integration |
| 13 | Certificates only when requirements are met | Integration, browser |
| 14 | Certificate verification returns the correct status | Integration, browser |
| 15 | Callbacks cannot activate enrollment without verified payment | Integration, browser |
| 16 | Duplicate callbacks create nothing twice | Integration |
| 17 | Unauthorized users cannot view private records | Integration, browser |
| 18 | Footer attribution and year on every layout | Browser |
| 19 | Migrations apply | Integration (every test file), browser setup |
| 20 | Production build and type check | Build and typecheck commands |

## Browser test results

22 scenarios in `tests/e2e/lms.spec.ts`, run in Chromium against a production build and a freshly seeded database. **All 22 have passed**, on 12 and 13 October 2026.

They did not pass in one uninterrupted run. The development machine (8 GB of memory, almost all in use) is slow enough that the full suite takes longer than the ten minutes a single command was allowed, so it was run in three parts: scenarios 1 to 19 together, then 20 and 21, then 21 and 22 after a fix. Run `npm run test:e2e` on your own machine to see a single complete run.

| Area | Scenarios |
| --- | --- |
| Authentication | Register, sign out, sign in; wrong password rejected with a general message; password recovery with a single-use link |
| Roles | Anonymous visitors redirected; each role reaches its own dashboard; learners blocked from instructor and administrator routes; instructors blocked from administration and from courses that are not theirs |
| Public site | Draft courses unreachable; custom not-found page; no horizontal scrolling at phone width |
| Learning | Enroll; opening a lesson does not count; progress survives signing out and in; no certificate from lessons alone; exam answers autosave and survive a reload; grading; certificate issued, downloaded as PDF and verified publicly; revocation shown on the verification page; another learner cannot see the records |
| Payments | No access while a payment is pending; access after the verified callback; a forged callback is rejected |
| Staff workflows | Instructor creates a course, adds a module and lesson, submits it; administrator approves and it appears publicly; administrator suspends a user (refused without the correct password), ending their session and blocking sign-in |
| Branding | Footer text and current year on public pages, sign-in and all three dashboards; attribution is plain text until the CGS URL is set, then a link |

### Defects the tests found, now fixed

1. **Saving one settings section rewrote every setting.** The save validated the whole settings object with defaults filled in, so it failed on the empty logo field and would otherwise have reset unrelated settings. It now writes only the submitted keys. Five integration tests cover this.
2. **A sign-up hook wrote to the database from a second connection inside the sign-up transaction.** Removed; profile rows are created on first use.
3. Three mistakes in the test scripts themselves (a locator that also matched the framework's hidden announcer, a sign-out attempted from a 404 page, and timeouts too short for this machine).

## Not covered by any automated test

Stated so that nobody assumes otherwise.

- Sending real email over SMTP.
- S3 storage (uploads, signed URLs). Tests use an in-memory driver and local disk.
- M-Pesa against Safaricom's API.
- The instructor screens for assignments grading, question banks, announcements, live sessions and analytics are exercised at the service level only, not through the browser.
- The administrator screens for permissions, categories, enrollments, support, payments and health have no browser test; the services behind them are tested.
- Accessibility has been built for (labels, keyboard operation, contrast tokens, text alternatives for charts) but has not been audited with a screen reader or an automated checker.
- Browsers other than Chromium, and real mobile devices. One test checks for horizontal overflow at 375 px.
- Load and concurrency beyond the specific races the integration tests create.
