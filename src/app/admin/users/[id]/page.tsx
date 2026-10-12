import type { Metadata } from "next";
import {
  anonymizeUserAction,
  enrollmentStatusAction,
  reactivateUserAction,
  revokeSessionsAction,
  setRoleAction,
  suspendUserAction,
  updateUserAction,
} from "@/app/actions/admin";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import { PageHeader, ProgressBar, Section, StatusBadge } from "@/components/kit/primitives";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { can, ROLES } from "@/server/permissions";
import { userDetail } from "@/server/queries/admin";

export const metadata: Metadata = { title: "User" };

const ROLE_LABEL = { student: "Learner", instructor: "Instructor", admin: "Administrator" } as const;

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("user.manage");
  const data = await load(() => userDetail(actor, id));
  const { user } = data;
  const self = user.id === actor.id;
  const role = user.role as keyof typeof ROLE_LABEL;

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.email} · ${ROLE_LABEL[role] ?? user.role}`}
        back={{ href: "/admin/users", label: "Users" }}
        actions={<StatusBadge status={user.banned ? "suspended" : "active"} />}
      />
      {user.banned && user.banReason && (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span className="font-medium">Suspended:</span> {user.banReason}
        </p>
      )}
      {data.profile?.deletionRequestedAt && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          This user asked for their account to be deleted on <LocalTime value={data.profile.deletionRequestedAt} dateOnly />.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Details">
          <ActionForm action={updateUserAction} className="grid gap-4">
            <input type="hidden" name="userId" value={id} />
            <FormMessage />
            <TextField label="Full name" name="name" defaultValue={user.name} required minLength={2} maxLength={120} />
            <TextField label="Email address" name="email" type="email" defaultValue={user.email} required maxLength={200} />
            <div>
              <SubmitButton pendingLabel="Saving...">Save details</SubmitButton>
            </div>
          </ActionForm>
          <dl className="mt-5 grid grid-cols-2 gap-y-1.5 border-t pt-4 text-sm">
            <dt className="text-muted-foreground">Joined</dt>
            <dd>
              <LocalTime value={user.createdAt} />
            </dd>
            <dt className="text-muted-foreground">Email verified</dt>
            <dd>{user.emailVerified ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Active sessions</dt>
            <dd>{data.activeSessions}</dd>
            <dt className="text-muted-foreground">Certificates</dt>
            <dd>{data.certificates}</dd>
          </dl>
        </Section>

        <Section title="Access control" description="Sensitive actions ask for your password and are written to the audit log.">
          {self ? (
            <p className="text-sm text-muted-foreground">You cannot change your own role or suspend your own account.</p>
          ) : (
            <div className="space-y-5">
              {can(actor, "role.assign") && (
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ROLES.filter((r) => r !== user.role).map((r) => (
                      <ConfirmAction
                        key={r}
                        action={setRoleAction}
                        fields={{ userId: id, role: r }}
                        title={`Make ${user.name} ${r === "admin" ? "an administrator" : r === "instructor" ? "an instructor" : "a learner"}?`}
                        description={
                          r === "admin"
                            ? "Administrators have full control of the platform, including users, payments and settings."
                            : "The user is signed out and gets the new role the next time they sign in."
                        }
                        confirmLabel="Change role"
                        requirePassword
                        destructive={r === "admin"}
                      >
                        Make {ROLE_LABEL[r].toLowerCase()}
                      </ConfirmAction>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Account</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.banned ? (
                    <ActionButton action={reactivateUserAction} fields={{ userId: id }}>
                      Reactivate account
                    </ActionButton>
                  ) : (
                    <ConfirmAction
                      action={suspendUserAction}
                      fields={{ userId: id }}
                      title={`Suspend ${user.name}?`}
                      description="The user is signed out everywhere immediately and cannot sign in until reactivated."
                      reasonField={{ name: "reason", label: "Reason (shown to administrators)", required: true }}
                      requirePassword
                      confirmLabel="Suspend account"
                      destructive
                      variant="destructive"
                    >
                      Suspend account
                    </ConfirmAction>
                  )}
                  <ConfirmAction
                    action={revokeSessionsAction}
                    fields={{ userId: id }}
                    title="Sign this user out everywhere?"
                    description="All of their sessions end. They can sign in again with their password."
                    confirmLabel="Sign out everywhere"
                  >
                    Revoke sessions
                  </ConfirmAction>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Data deletion</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Removes the profile and sign-in details and anonymises the account. Grades, certificates and payment
                  records are kept without personal profile data.
                </p>
                <ConfirmAction
                  action={anonymizeUserAction}
                  fields={{ userId: id }}
                  title={`Permanently delete ${user.name}'s account?`}
                  description="This cannot be undone."
                  requirePassword
                  confirmLabel="Delete account"
                  destructive
                  variant="ghost"
                  className="mt-2"
                >
                  Delete and anonymise account
                </ConfirmAction>
              </div>
            </div>
          )}
        </Section>

        <Section title={`Enrollments (${data.enrollments.length})`} className="lg:col-span-2">
          {data.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enrolled in any course.</p>
          ) : (
            <ul className="divide-y">
              {data.enrollments.map((e) => (
                <li key={e.id} className="grid items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[1fr_7rem_10rem_auto]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(e.source)} · <LocalTime value={e.enrolledAt} dateOnly />
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  <ProgressBar value={e.progressPercent} label={`Progress in ${e.courseTitle}`} />
                  {can(actor, "enrollment.manage") && e.status !== "completed" && (
                    <ActionButton
                      action={enrollmentStatusAction}
                      fields={{ enrollmentId: e.id, status: e.status === "active" ? "suspended" : "active" }}
                      variant="ghost"
                      size="sm"
                    >
                      {e.status === "active" ? "Suspend" : "Reactivate"}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Account history" className="lg:col-span-2">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No administrative actions recorded for this account.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <span className="font-mono text-xs">{entry.action}</span>
                    <span className="text-muted-foreground"> by {entry.actorName ?? "system"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <LocalTime value={entry.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
