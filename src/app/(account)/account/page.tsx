import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requestDeletionAction, updatePrefsAction, updateProfileAction } from "@/app/actions/learner";
import { ChangePasswordForm } from "@/components/auth/forms";
import { ConfirmAction } from "@/components/kit/confirm";
import { ActionForm, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { checkboxClass, PageHeader, Section } from "@/components/kit/primitives";
import { formatDate, titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { LOCKED_CATEGORIES, NOTIFICATION_CATEGORIES } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const actor = await requireActor("/account");
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, actor.id));
  const prefs = profile?.notificationPrefs ?? { emailOff: [], inAppOff: [] };

  return (
    <>
      <PageHeader title="Account settings" description={`Signed in as ${actor.email} (${titleCase(actor.role)})`} />
      <div className="space-y-6">
        <Section title="Profile" description="Your name appears on certificates and next to your discussion posts.">
          <ActionForm action={updateProfileAction} className="grid max-w-2xl gap-4">
            <FormMessage />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" name="name" defaultValue={actor.name} required maxLength={120} autoComplete="name" />
              <TextField label="Email address" name="email-display" defaultValue={actor.email} disabled hint="Contact support to change your email address." />
            </div>
            <TextField label="Headline" name="headline" defaultValue={profile?.headline ?? ""} maxLength={120} hint="For example your profession or field of study." />
            <TextAreaField label="About you" name="bio" defaultValue={profile?.bio ?? ""} rows={4} maxLength={2000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Phone number" name="phone" type="tel" defaultValue={profile?.phone ?? ""} maxLength={30} autoComplete="tel" hint="Optional. Never shown to other learners." />
              <TextField label="Country" name="country" defaultValue={profile?.country ?? ""} maxLength={80} autoComplete="country-name" />
            </div>
            <div>
              <SubmitButton pendingLabel="Saving...">Save profile</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <div id="notifications" className="scroll-mt-20">
          <Section title="Notification preferences" description="Choose how you hear about each kind of update.">
            <ActionForm action={updatePrefsAction} className="grid max-w-2xl gap-4">
              <FormMessage />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th scope="col" className="py-2 font-medium">
                        Category
                      </th>
                      <th scope="col" className="w-20 py-2 text-center font-medium">
                        In app
                      </th>
                      <th scope="col" className="w-20 py-2 text-center font-medium">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => {
                      const locked = (LOCKED_CATEGORIES as string[]).includes(key);
                      return (
                        <tr key={key} className="border-b last:border-b-0">
                          <th scope="row" className="py-2 text-left font-normal">
                            {label}
                            {locked && <span className="block text-xs text-muted-foreground">Always on for your security</span>}
                          </th>
                          {(["inApp", "email"] as const).map((channel) => (
                            <td key={channel} className="py-2 text-center">
                              <input
                                type="checkbox"
                                name={`${channel}:${key}`}
                                aria-label={`${label}: ${channel === "inApp" ? "in app" : "email"}`}
                                className={checkboxClass}
                                defaultChecked={locked || !(channel === "inApp" ? prefs.inAppOff : prefs.emailOff).includes(key)}
                                disabled={locked}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <SubmitButton pendingLabel="Saving...">Save preferences</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        </div>

        <Section title="Password" description="Changing your password signs you out on your other devices.">
          <ChangePasswordForm />
        </Section>

        <Section title="Delete account" description="Ask for your account and personal data to be removed.">
          {profile?.deletionRequestedAt ? (
            <p className="text-sm">
              You asked for your account to be deleted on {formatDate(profile.deletionRequestedAt)}. An administrator
              will process the request.
            </p>
          ) : (
            <>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Your profile and sign-in details are removed and the account is anonymised. Grade, certificate and
                payment records are retained where required, without your personal profile.
              </p>
              <ConfirmAction
                action={requestDeletionAction}
                title="Request account deletion?"
                description="An administrator will review and process your request. This cannot be undone once completed."
                confirmLabel="Send request"
                destructive
                variant="destructive"
                className="mt-3"
              >
                Request account deletion
              </ConfirmAction>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
