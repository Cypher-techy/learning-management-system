import { expect, test } from "@playwright/test";
import { alert, expectFooter, PASSWORD, query, signIn, signOut, USERS } from "./helpers";

const FREE = "demo-getting-started";
const PAID = "demo-spreadsheet-essentials";

test.describe.configure({ mode: "serial" });

test.describe("authentication", () => {
  const email = `new.learner.${Date.now()}@example.test`;
  const first = "first-password-123";
  const second = "second-password-456";

  test("a visitor can register, sign out and sign in again", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("New Learner");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(first);
    await page.getByLabel("Confirm password").fill(first);
    await page.getByRole("button", { name: "Create account" }).click();
    // Public registration always produces a learner.
    await page.waitForURL("**/learn");
    await expect(page.getByRole("heading", { name: /Welcome back, New/ })).toBeVisible();
    const [row] = await query<{ role: string }>("select role from users where email = $1", [email]);
    expect(row?.role).toBe("student");

    await signOut(page);
    await page.goto("/learn");
    await expect(page).toHaveURL(/\/sign-in/);

    await signIn(page, email, first);
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("a wrong password is rejected without revealing which part was wrong", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alert(page)).toHaveText(/email address or password is not correct/);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("access can be recovered with a single-use reset link", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");

    // The link is emailed; in tests it is read from the database instead.
    const [row] = await query<{ identifier: string }>(
      "select identifier from verifications where identifier like 'reset-password:%' order by created_at desc limit 1",
    );
    const token = row!.identifier.replace("reset-password:", "");

    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("New password", { exact: true }).fill(second);
    await page.getByLabel("Confirm new password").fill(second);
    await page.getByRole("button", { name: "Set new password" }).click();
    await page.waitForURL(/\/sign-in\?reset=1/);

    // The old password no longer works; the new one does.
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(first);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alert(page)).toBeVisible();
    await signIn(page, email, second);
    await expect(page).toHaveURL(/\/learn$/);

    // The token cannot be used a second time.
    await signOut(page);
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel("New password", { exact: true }).fill("third-password-789");
    await page.getByLabel("Confirm new password").fill("third-password-789");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(alert(page)).toHaveText(/invalid or has expired/);
  });
});

test.describe("role-based access", () => {
  test("anonymous visitors are sent to sign in", async ({ page }) => {
    for (const path of ["/learn", "/instructor", "/admin", "/account"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in/);
    }
  });

  test("each role lands on its own dashboard", async ({ page }) => {
    for (const [email, home] of [
      [USERS.learner, "/learn"],
      [USERS.instructor, "/instructor"],
      [USERS.admin, "/admin"],
    ] as const) {
      await signIn(page, email);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      await signOut(page);
    }
  });

  test("learners cannot open instructor or administrator routes", async ({ page }) => {
    await signIn(page, USERS.learner);
    for (const path of ["/instructor", "/instructor/courses", "/admin", "/admin/users", "/admin/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/learn$/);
    }
    const response = await page.request.get("/api/export/users");
    expect(response.status()).toBe(403);
  });

  test("instructors cannot open administrator routes or other instructors' courses", async ({ page }) => {
    await signIn(page, USERS.instructor);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/instructor$/);
    // A course id that is not theirs is indistinguishable from one that does not exist.
    const response = await page.goto("/instructor/courses/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
  });
});

test.describe("public site", () => {
  test("draft courses are not reachable", async ({ page }) => {
    const [draft] = await query<{ slug: string; id: string }>("select slug, id from courses where status = 'draft' limit 1");
    expect(draft).toBeTruthy();
    expect((await page.goto(`/courses/${draft!.slug}`))?.status()).toBe(404);
    await page.goto("/courses");
    await expect(page.getByText("[Demo] Unpublished Draft Course")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "[Demo] Getting Started with Online Learning" })).toBeVisible();

    await signIn(page, USERS.learner);
    expect((await page.goto(`/learn/courses/${draft!.slug}`))?.status()).toBe(404);
  });

  test("unknown pages show the custom not-found page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    await expectFooter(page);
  });

  test("pages fit a phone screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    for (const path of ["/", "/courses", `/courses/${FREE}`, "/sign-in"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("learning journey", () => {
  let certificateNumber = "";

  test("a learner enrolls, and progress persists across sessions", async ({ page }) => {
    await signIn(page, USERS.learner);
    await page.goto(`/courses/${FREE}`);
    await page.getByRole("button", { name: "Enroll for free" }).click();
    await page.waitForURL(`**/learn/courses/${FREE}`);
    await expect(page.getByText("0 of 3 lessons completed")).toBeVisible();

    // Opening a lesson must not count as completing it.
    await page.getByRole("link", { name: "Welcome to the course" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to the course" })).toBeVisible();
    await page.goto(`/learn/courses/${FREE}`);
    await expect(page.getByText("0 of 3 lessons completed")).toBeVisible();

    await page.getByRole("link", { name: "Welcome to the course" }).click();
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await expect(page.getByRole("button", { name: /Completed/ })).toBeVisible();

    await signOut(page);
    await signIn(page, USERS.learner);
    await page.goto(`/learn/courses/${FREE}`);
    await expect(page.getByText("1 of 3 lessons completed")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "33");
  });

  test("completing the lessons alone does not issue a certificate", async ({ page }) => {
    await signIn(page, USERS.learner);
    for (const title of ["How progress works", "Putting it together"]) {
      await page.goto(`/learn/courses/${FREE}`);
      await page.getByRole("link", { name: title }).click();
      await page.getByRole("button", { name: "Mark lesson complete" }).click();
      await expect(page.getByRole("button", { name: /Completed/ })).toBeVisible();
    }
    await page.goto("/learn/certificates");
    await expect(page.getByText("No certificates yet")).toBeVisible();
  });

  test("exam answers are saved, survive a reload, and are graded on submit", async ({ page }) => {
    await signIn(page, USERS.learner);
    await page.goto(`/learn/courses/${FREE}`);
    await page.getByRole("link", { name: "[Demo] Course quiz" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.waitForURL(/\/learn\/attempts\//);

    await page.getByLabel("Marking a lesson complete").check();
    await page.getByLabel("True", { exact: true }).check();
    await expect(page.getByText("2 of 3 answered")).toBeVisible();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    // Simulate an interruption: reload and find the saved answers intact.
    await page.reload();
    await expect(page.getByLabel("Marking a lesson complete")).toBeChecked();
    await expect(page.getByLabel("True", { exact: true })).toBeChecked();

    for (const option of ["Lessons", "Quizzes", "Assignments"]) await page.getByLabel(option, { exact: true }).check();
    await expect(page.getByText("3 of 3 answered")).toBeVisible();
    await page.getByRole("button", { name: "Submit answers" }).click();
    await page.getByRole("button", { name: "Submit now" }).click();

    await page.waitForURL(/\/result$/);
    await expect(page.getByText("Passed", { exact: true })).toBeVisible();
    await expect(page.getByText("5 / 5")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
  });

  test("the certificate is issued once requirements are met and can be verified publicly", async ({ page, browser }) => {
    await signIn(page, USERS.learner);
    await page.goto("/learn/certificates");
    await expect(page.getByText("[Demo] Getting Started with Online Learning")).toBeVisible();
    certificateNumber = (await page.locator("dd.font-mono").first().innerText()).trim();
    expect(certificateNumber).toMatch(/^CERT-\d{4}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const pdf = await page.request.get(await page.getByRole("link", { name: "Download PDF" }).getAttribute("href").then((h) => h!));
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Verification needs no account.
    const anonymous = await browser.newContext();
    const visitor = await anonymous.newPage();
    await visitor.goto("/verify");
    await visitor.getByLabel("Certificate number").fill(certificateNumber);
    await visitor.getByRole("button", { name: "Verify" }).click();
    await expect(visitor.getByTestId("verify-result")).toHaveAttribute("data-status", "green");
    await expect(visitor.getByTestId("verify-result")).toContainText("Demo Learner");
    await expect(visitor.getByTestId("verify-result")).not.toContainText("learner@example.test");

    await visitor.goto("/verify/CERT-2026-AAAAA-AAAAA");
    await expect(visitor.getByTestId("verify-result")).toHaveAttribute("data-status", "red");
    await expect(visitor.getByTestId("verify-result")).toContainText("No certificate found");

    // Another person's certificate PDF is not downloadable.
    const [cert] = await query<{ id: string }>("select id from certificates where number = $1", [certificateNumber]);
    expect((await visitor.request.get(`/api/certificates/${cert!.id}/pdf`)).status()).toBe(401);
    await anonymous.close();
  });

  test("an administrator can revoke the certificate and verification reflects it", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/admin/certificates");
    await page.getByRole("button", { name: "Revoke" }).click();
    await page.getByLabel("Reason (shown to the learner)").fill("Revoked during automated testing.");
    await page.getByRole("button", { name: "Revoke", exact: true }).last().click();
    await expect(page.getByText("Revoked during automated testing.")).toBeVisible();

    await page.goto(`/verify/${certificateNumber}`);
    await expect(page.getByTestId("verify-result")).toHaveAttribute("data-status", "red");
    await expect(page.getByTestId("verify-result")).toContainText("has been revoked");
  });

  test("private records of one learner are not visible to another", async ({ page }) => {
    const [attempt] = await query<{ id: string }>(
      "select a.id from assessment_attempts a join users u on u.id = a.user_id where u.email = $1 limit 1",
      [USERS.learner],
    );
    await signIn(page, USERS.learner2);
    expect((await page.goto(`/learn/attempts/${attempt!.id}/result`))?.status()).toBe(404);
    // Not enrolled, so course material is closed as well.
    await page.goto(`/learn/courses/${FREE}`);
    await expect(page).toHaveURL(new RegExp(`/courses/${FREE}$`));
  });
});

test.describe("paid courses", () => {
  test("access is granted only after the payment is confirmed", async ({ page }) => {
    await signIn(page, USERS.learner2);
    await page.goto(`/courses/${PAID}`);
    await page.getByRole("link", { name: "Buy this course" }).click();
    await expect(page.getByText("Test mode.")).toBeVisible();
    await page.getByLabel("Phone number").fill("0712345678");
    await page.getByRole("button", { name: /^Pay / }).click();
    await page.waitForURL(/\/checkout\/status\//);
    await expect(page.getByTestId("payment-status")).toHaveAttribute("data-status", "pending");

    // While the payment is pending there is no enrollment and no access.
    const pending = await query<{ n: string }>(
      "select count(*) as n from enrollments e join users u on u.id = e.user_id join courses c on c.id = e.course_id where u.email = $1 and c.slug = $2",
      [USERS.learner2, PAID],
    );
    expect(Number(pending[0]!.n)).toBe(0);
    const statusUrl = page.url();
    await page.goto(`/learn/courses/${PAID}`);
    await expect(page).toHaveURL(new RegExp(`/courses/${PAID}$`));

    await page.goto(statusUrl);
    await page.getByRole("button", { name: "Simulate successful payment" }).click();
    await expect(page.getByTestId("payment-status")).toHaveAttribute("data-status", "succeeded");
    await page.getByRole("link", { name: "Start learning" }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/courses/${PAID}$`));

    const rows = await query<{ status: string }>(
      "select t.status from payment_transactions t join users u on u.id = t.user_id where u.email = $1",
      [USERS.learner2],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("succeeded");
  });

  test("a forged callback is rejected", async ({ request }) => {
    const response = await request.post("/api/payments/sandbox/callback/anything", {
      data: { providerReference: "SBX-forged", outcome: "succeeded" },
      headers: { "x-sandbox-signature": "0".repeat(64) },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("instructor and administrator workflows", () => {
  test("an instructor builds a course and an administrator approves it", async ({ page }) => {
    await signIn(page, USERS.instructor);
    await page.goto("/instructor/courses");
    await page.getByLabel("Course title").fill("Automated Test Course");
    await page.getByRole("button", { name: "Create course" }).click();
    await page.waitForURL(/\/instructor\/courses\/[0-9a-f-]{36}$/);
    const courseId = page.url().split("/").pop()!;

    // An incomplete course cannot be submitted.
    await expect(page.getByText("Before this course can be published:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();

    await page.getByLabel("Short description").fill("A course created by the automated browser tests.");
    await page.getByLabel("Full description").fill("This course exists to prove that the authoring and review workflow works from end to end.");
    await page.getByLabel("Category").selectOption({ label: "Technology" });
    await page.getByLabel("Learning objectives").fill("Verify the authoring workflow");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Course details saved.")).toBeVisible();

    await page.goto(`/instructor/courses/${courseId}/curriculum`);
    await page.getByLabel("Module title").fill("Module one");
    await page.getByRole("button", { name: "Add module" }).click();
    await expect(page.getByText("1. Module one")).toBeVisible();
    await page.getByRole("button", { name: "Add lesson" }).click();
    await page.getByLabel("Lesson title").fill("First lesson");
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/lessons\//);
    await page.getByLabel("Lesson content").fill("# Hello\n\nLesson body written by the test.");
    await page.getByLabel("Published", { exact: true }).check();
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.getByText("Lesson saved.")).toBeVisible();

    await page.goto(`/instructor/courses/${courseId}`);
    await expect(page.getByText("Ready to publish.")).toBeVisible();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Waiting for an administrator to review this course.")).toBeVisible();
    // Not public until approved.
    const [row] = await query<{ slug: string }>("select slug from courses where id = $1", [courseId]);
    expect((await page.goto(`/courses/${row!.slug}`))?.status()).toBe(404);
    await page.goto("/instructor");
    await signOut(page);

    await signIn(page, USERS.admin);
    await page.goto(`/admin/courses/${courseId}`);
    await page.getByRole("button", { name: "Approve" }).click();
    await page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(page.getByText("Course approved and published.")).toBeVisible();
    expect((await page.goto(`/courses/${row!.slug}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Automated Test Course" })).toBeVisible();
  });

  test("an administrator can suspend a user, which ends their sessions", async ({ page, browser }) => {
    const learnerContext = await browser.newContext();
    const learnerPage = await learnerContext.newPage();
    await signIn(learnerPage, USERS.learner2);

    await signIn(page, USERS.admin);
    await page.goto("/admin/users?q=learner2");
    await page.getByRole("link", { name: "Second Demo Learner" }).click();
    await page.getByRole("button", { name: "Suspend account" }).click();
    await page.getByLabel("Reason (shown to administrators)").fill("Suspended by the automated tests.");
    // The sensitive action is refused without the administrator's own password.
    await page.getByLabel("Your password").fill("not-my-password-000");
    await page.getByRole("button", { name: "Suspend account" }).last().click();
    await expect(alert(page)).toHaveText(/password is not correct/);
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Suspend account" }).last().click();
    await expect(page.getByText("Suspended", { exact: true })).toBeVisible();

    // The suspended user's existing session no longer works, and they cannot sign in again.
    await learnerPage.goto("/learn");
    await expect(learnerPage).toHaveURL(/\/sign-in/);
    await learnerPage.getByLabel("Email address").fill(USERS.learner2);
    await learnerPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await learnerPage.getByRole("button", { name: "Sign in" }).click();
    await expect(alert(learnerPage)).toBeVisible();
    await expect(learnerPage).toHaveURL(/\/sign-in/);
    await learnerContext.close();

    const audit = await query<{ action: string }>("select action from audit_logs where action = 'user.suspend'");
    expect(audit.length).toBeGreaterThan(0);
  });
});

test.describe("branding", () => {
  test("the CGS footer appears on public, sign-in and all three dashboards", async ({ page }) => {
    for (const path of ["/", "/courses", "/sign-in"]) {
      await page.goto(path);
      await expectFooter(page);
    }
    for (const [email, path] of [
      [USERS.learner, "/learn"],
      [USERS.instructor, "/instructor"],
      [USERS.admin, "/admin"],
    ] as const) {
      await signIn(page, email);
      await page.goto(path);
      await expectFooter(page);
      // With no official URL configured, the attribution must not be a link.
      await expect(page.getByTestId("cgs-attribution").getByRole("link")).toHaveCount(0);
      await signOut(page);
    }
  });

  test("the attribution becomes a link once the official URL is configured", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/admin/settings");
    await page.getByLabel("Official CGS website").fill("https://example.org/cgs");
    await page.getByRole("button", { name: "Save general settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await page.goto("/");
    const link = page.getByTestId("cgs-attribution").getByRole("link");
    await expect(link).toHaveAttribute("href", "https://example.org/cgs");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });
});
