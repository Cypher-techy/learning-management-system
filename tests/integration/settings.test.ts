import { describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "@/server/services/settings";
import { expectAppError, makeUser } from "../helpers";

describe("platform settings", () => {
  it("returns defaults when nothing has been saved", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("can only be changed by an administrator", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    await expectAppError(updateSettings(instructor, { platformName: "Hijacked" }), "FORBIDDEN");
    await expectAppError(updateSettings(student, { registrationEnabled: false }), "FORBIDDEN");
    expect((await getSettings()).platformName).toBe(DEFAULT_SETTINGS.platformName);
  });

  it("saves only the submitted keys and leaves every other setting alone", async () => {
    const admin = await makeUser("admin");
    await updateSettings(admin, { maxUploadMb: 40, courseApprovalRequired: false });
    // Saving a different section must not reset the values above to defaults.
    await updateSettings(admin, { platformName: "Test Academy", cgsWebsiteUrl: "https://example.org/cgs", supportEmail: "" });

    const settings = await getSettings();
    expect(settings).toMatchObject({
      platformName: "Test Academy",
      cgsWebsiteUrl: "https://example.org/cgs",
      maxUploadMb: 40,
      courseApprovalRequired: false,
      registrationEnabled: true,
    });
    const rows = await db.select().from(schema.platformSettings);
    expect(rows.map((r) => r.key).sort()).toEqual(
      ["cgsWebsiteUrl", "courseApprovalRequired", "maxUploadMb", "platformName", "supportEmail"].sort(),
    );
    const audit = await db.select().from(schema.auditLogs);
    expect(audit.filter((a) => a.action === "settings.update")).toHaveLength(2);
  });

  it("clears a nullable setting without failing", async () => {
    const admin = await makeUser("admin");
    const logo = crypto.randomUUID();
    await updateSettings(admin, { logoFileId: logo });
    expect((await getSettings()).logoFileId).toBe(logo);
    await updateSettings(admin, { logoFileId: null });
    expect((await getSettings()).logoFileId).toBeNull();
  });

  it("rejects invalid values and unsafe links without saving anything", async () => {
    const admin = await makeUser("admin");
    const before = await getSettings();
    await expectAppError(updateSettings(admin, { cgsWebsiteUrl: "javascript:alert(1)" }), "VALIDATION");
    await expectAppError(updateSettings(admin, { maxUploadMb: 0 }), "VALIDATION");
    await expectAppError(updateSettings(admin, { platformName: "OK name", theme: "neon" as never }), "VALIDATION");
    expect(await getSettings()).toEqual(before);
  });
});
