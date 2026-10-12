import type { Metadata } from "next";
import { saveSettingsAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/kit/confirm";
import { ActionForm, CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { LinkButton, PageHeader, Section } from "@/components/kit/primitives";
import { UploadAction } from "@/components/kit/upload";
import { env } from "@/lib/env";
import { requirePermission } from "@/server/auth/session";
import { getPaymentStatus } from "@/server/payments/providers";
import { isEmailConfigured } from "@/server/services/email";
import { getSettings } from "@/server/services/settings";
import { storageStatus } from "@/server/services/storage";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();
  const e = env();
  const payments = getPaymentStatus();
  const storage = storageStatus();

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration. Every change is written to the audit log." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="General and branding">
          <ActionForm action={saveSettingsAction} className="grid gap-4">
            <input type="hidden" name="section" value="general" />
            <TextField label="Platform name" name="platformName" defaultValue={settings.platformName} required minLength={2} maxLength={60} />
            <TextAreaField label="Platform description" name="platformDescription" defaultValue={settings.platformDescription} rows={2} maxLength={300} hint="Shown on the homepage and in search results." />
            <TextField label="Organization name" name="organizationName" defaultValue={settings.organizationName} maxLength={120} hint="Named as the issuer on certificates and in the policies." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Support email" name="supportEmail" type="email" defaultValue={settings.supportEmail} />
              <TextField label="Support phone" name="supportPhone" defaultValue={settings.supportPhone} maxLength={40} />
            </div>
            <SelectField
              label="Colour theme"
              name="theme"
              defaultValue={settings.theme}
              options={[
                { value: "evergreen", label: "Evergreen" },
                { value: "ocean", label: "Ocean blue" },
                { value: "slate", label: "Slate" },
                { value: "plum", label: "Plum" },
              ]}
            />
            <TextField
              label="Official CGS website"
              name="cgsWebsiteUrl"
              type="url"
              defaultValue={settings.cgsWebsiteUrl}
              placeholder="https://"
              hint={
                settings.cgsWebsiteUrl
                  ? "The footer attribution links here."
                  : e.CGS_WEBSITE_URL
                    ? `Empty: using the CGS_WEBSITE_URL environment value (${e.CGS_WEBSITE_URL}).`
                    : "Empty: the footer shows “Powered by Cypher Green Systems (CGS)” without a link."
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Terms of service link" name="termsUrl" type="url" defaultValue={settings.termsUrl} placeholder="https://" hint="Empty uses the built-in page." />
              <TextField label="Privacy policy link" name="privacyUrl" type="url" defaultValue={settings.privacyUrl} placeholder="https://" hint="Empty uses the built-in page." />
            </div>
            <FormMessage />
            <div>
              <SubmitButton pendingLabel="Saving...">Save general settings</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <div className="space-y-6">
          <Section title="Logo and favicon" description="PNG, JPG or WebP up to 2 MB. Used as the browser tab icon.">
            <div className="flex items-center gap-4">
              {settings.logoFileId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${settings.logoFileId}`} alt="Current logo" className="size-14 rounded-lg border object-contain" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-lg border text-xs text-muted-foreground">None</div>
              )}
              <div className="flex flex-wrap gap-2">
                <UploadAction action={saveSettingsAction} purpose="branding" fields={{ section: "logo" }} accept={["png", "jpg", "jpeg", "webp"]}>
                  {settings.logoFileId ? "Replace" : "Upload"}
                </UploadAction>
                {settings.logoFileId && (
                  <ActionButton action={saveSettingsAction} fields={{ section: "logo", fileId: "" }} variant="ghost">
                    Remove
                  </ActionButton>
                )}
              </div>
            </div>
          </Section>

          <Section title="Registration, enrollment and courses">
            <ActionForm action={saveSettingsAction} className="grid gap-3">
              <input type="hidden" name="section" value="learning" />
              <CheckboxField label="Allow public registration" name="registrationEnabled" defaultChecked={settings.registrationEnabled} hint="New accounts are always created as learners." />
              <CheckboxField label="Allow learners to enroll themselves in free courses" name="selfEnrollmentEnabled" defaultChecked={settings.selfEnrollmentEnabled} />
              <CheckboxField label="Require administrator review before a course is published" name="courseApprovalRequired" defaultChecked={settings.courseApprovalRequired} />
              <CheckboxField label="Send notification emails" name="emailNotificationsEnabled" defaultChecked={settings.emailNotificationsEnabled} hint="Password reset and email verification messages are always sent." />
              <TextField label="Default currency" name="currency" defaultValue={settings.currency} required minLength={3} maxLength={3} className="mt-1 max-w-32" hint="ISO code, for example KES. Applied to new courses." />
              <p className="mt-2 text-sm font-medium">Default completion rules for new courses</p>
              <CheckboxField label="Complete every lesson" name="defaultRequireAllLessons" defaultChecked={settings.defaultRequireAllLessons} />
              <CheckboxField label="Pass required assessments" name="defaultRequireAssessments" defaultChecked={settings.defaultRequireAssessments} />
              <CheckboxField label="Pass required assignments" name="defaultRequireAssignments" defaultChecked={settings.defaultRequireAssignments} />
              <FormMessage />
              <div>
                <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
              </div>
            </ActionForm>
          </Section>

          <Section title="File uploads">
            <ActionForm action={saveSettingsAction} className="grid gap-4">
              <input type="hidden" name="section" value="uploads" />
              <TextField label="Maximum file size (MB)" name="maxUploadMb" type="number" min={1} max={500} defaultValue={settings.maxUploadMb} required className="max-w-48" hint="Your hosting platform may impose a lower request limit." />
              <TextAreaField label="Permitted file types" name="allowedUploadExtensions" rows={2} defaultValue={settings.allowedUploadExtensions.join(", ")} hint="Extensions separated by commas. Only types the server can verify are accepted; scripts, HTML and SVG are always refused." />
              <FormMessage />
              <div>
                <SubmitButton pendingLabel="Saving...">Save upload rules</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        </div>

        <Section
          title="Integrations"
          description="Configured through environment variables on the server, so that secrets are never shown or stored here."
          className="xl:col-span-2"
          actions={<LinkButton href="/admin/health" variant="ghost" size="sm">System health</LinkButton>}
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Integration label="Email (SMTP)" ok={isEmailConfigured()} detail={isEmailConfigured() ? `Sending from ${e.EMAIL_FROM}` : "Not configured. Emails are not delivered."} />
            <Integration label="File storage" ok={storage.durable} detail={storage.note} />
            <Integration label="Payments" ok={payments.enabled && !payments.provider.isSandbox} detail={payments.enabled ? payments.provider.label : payments.reason} />
            <Integration label="Email verification" ok={e.REQUIRE_EMAIL_VERIFICATION} detail={e.REQUIRE_EMAIL_VERIFICATION ? "Required before sign-in." : "Not required (REQUIRE_EMAIL_VERIFICATION=false)."} />
          </dl>
        </Section>
      </div>
    </>
  );
}

function Integration({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="flex items-center gap-2 font-medium">
        <span className={`size-2 rounded-full ${ok ? "bg-success" : "bg-warning"}`} aria-hidden />
        {label}
        <span className="sr-only">{ok ? "(ready)" : "(needs attention)"}</span>
      </dt>
      <dd className="mt-1 text-muted-foreground">{detail}</dd>
    </div>
  );
}
