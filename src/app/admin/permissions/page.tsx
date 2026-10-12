import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { savePermissionsAction } from "@/app/actions/admin";
import { PermissionsForm } from "@/components/admin/permissions-form";
import { PageHeader, Section } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { ALL_PERMISSIONS, DELEGABLE, PERMISSIONS, resolvePermissions } from "@/server/permissions";

export const metadata: Metadata = { title: "Roles and permissions" };

export default async function PermissionsPage() {
  await requirePermission("role.assign");
  const overrides = await db.select().from(schema.rolePermissions);
  const instructor = resolvePermissions("instructor", overrides);
  const student = resolvePermissions("student", overrides);

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="What each role may do. Ownership rules still apply on top: an instructor can only manage courses they teach."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Permission matrix" description="Current effective permissions.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Permission
                  </th>
                  {["Learner", "Instructor", "Admin"].map((h) => (
                    <th key={h} scope="col" className="w-20 py-2 text-center font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((p) => (
                  <tr key={p} className="border-b last:border-b-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {PERMISSIONS[p]}
                    </th>
                    {[student.has(p), instructor.has(p), true].map((granted, i) => (
                      <td key={i} className="py-2 text-center">
                        {granted ? (
                          <Check className="mx-auto size-4 text-success" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Learners can enroll, study, submit work and view their own records; those abilities are built in and are not
            listed here. Administrators always hold every permission.
          </p>
        </Section>

        <Section
          title="Instructor permissions"
          description="Grant or withdraw individual capabilities for all instructors. Platform governance cannot be delegated."
        >
          <PermissionsForm
            action={savePermissionsAction}
            role="instructor"
            rows={ALL_PERMISSIONS.map((p) => ({
              key: p,
              label: PERMISSIONS[p],
              granted: instructor.has(p),
              delegable: (DELEGABLE.instructor as string[]).includes(p),
            }))}
          />
        </Section>
      </div>
    </>
  );
}
