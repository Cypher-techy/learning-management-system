import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL, e2eEnv } from "../../playwright.config";

export const PASSWORD = e2eEnv.SEED_PASSWORD;
export const USERS = {
  admin: "admin@example.test",
  instructor: "instructor@example.test",
  learner: "learner@example.test",
  learner2: "learner2@example.test",
};

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/sign-in");
}

/** Reads straight from the disposable test database. */
export async function query<T extends Record<string, unknown>>(text: string, params: (string | number)[] = []): Promise<T[]> {
  const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return (await sql.unsafe(text, params)) as unknown as T[];
  } finally {
    await sql.end();
  }
}

/** The page's own error message, ignoring the framework's hidden route announcer. */
export function alert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

export async function expectFooter(page: Page) {
  const footer = page.getByTestId("cgs-footer");
  await expect(footer).toBeVisible();
  const year = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date());
  await expect(footer.getByTestId("cgs-copyright")).toHaveText(`© ${year} Cypher Green Systems. All rights reserved.`);
  await expect(footer.getByTestId("cgs-attribution")).toHaveText("Powered by Cypher Green Systems (CGS)");
}
