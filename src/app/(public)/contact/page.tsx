import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";
import { contactAction } from "@/app/actions/learner";
import { ActionForm, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { getActor } from "@/server/auth/session";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Contact and support" };

export default async function ContactPage() {
  const [platform, actor] = await Promise.all([getPlatform(), getActor()]);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="text-3xl font-semibold">Contact and support</h1>
        <p className="mt-2 text-muted-foreground">
          Send us a message and the support team will reply by email.
        </p>
        <ActionForm action={contactAction} resetOnSuccess className="mt-6 grid gap-4 rounded-xl border bg-card p-5">
          <FormMessage />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Your name" name="name" defaultValue={actor?.name ?? ""} autoComplete="name" required maxLength={120} />
            <TextField
              label="Email address"
              name="email"
              type="email"
              defaultValue={actor?.email ?? ""}
              autoComplete="email"
              required
              maxLength={200}
            />
          </div>
          <TextField label="Subject" name="subject" required maxLength={160} />
          <TextAreaField label="How can we help?" name="message" rows={6} required maxLength={5000} />
          {/* Honeypot field: hidden from people, tempting for bots. */}
          <div className="hidden" aria-hidden>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div>
            <SubmitButton pendingLabel="Sending...">Send message</SubmitButton>
          </div>
        </ActionForm>
      </div>
      <aside className="space-y-3 md:pt-16">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Other ways to reach us</p>
          {platform.supportEmail || platform.supportPhone ? (
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {platform.supportEmail && (
                <li className="flex items-center gap-2">
                  <Mail className="size-4" aria-hidden />
                  <a href={`mailto:${platform.supportEmail}`} className="hover:underline">
                    {platform.supportEmail}
                  </a>
                </li>
              )}
              {platform.supportPhone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4" aria-hidden />
                  <a href={`tel:${platform.supportPhone.replace(/\s/g, "")}`} className="hover:underline">
                    {platform.supportPhone}
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">Use the form and we will get back to you by email.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
