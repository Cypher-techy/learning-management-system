import type { Metadata } from "next";
import Link from "next/link";
import { createUserAction } from "@/app/actions/admin";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "@/components/kit/form";
import { first, LinkButton, PageHeader, pageParam, Pagination, Section, StatusBadge, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/permissions";
import { listUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = { q: first(sp.q), role: first(sp.role), status: first(sp.status) };
  const page = pageParam(sp.page);
  const actor = await requirePermission("user.manage");
  const { rows, total } = await listUsers(actor, { ...filters, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Users" description={`${total} ${total === 1 ? "account" : "accounts"}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <FilterBar
            q={filters.q}
            placeholder="Search by name or email"
            clearHref="/admin/users"
            selects={[
              {
                name: "role",
                label: "Role",
                value: filters.role,
                options: [
                  { value: "", label: "All roles" },
                  { value: "student", label: "Learners" },
                  { value: "instructor", label: "Instructors" },
                  { value: "admin", label: "Administrators" },
                ],
              },
              {
                name: "status",
                label: "Status",
                value: filters.status,
                options: [
                  { value: "", label: "Any status" },
                  { value: "active", label: "Active" },
                  { value: "suspended", label: "Suspended" },
                ],
              },
            ]}
          >
            <LinkButton href="/api/export/users" variant="outline" prefetch={false}>
              Export CSV
            </LinkButton>
          </FilterBar>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No users match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link href={`/admin/users/${user.id}`} className="font-medium hover:underline">
                        {user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>{titleCase(user.role === "student" ? "learner" : user.role)}</TableCell>
                    <TableCell>
                      <StatusBadge status={user.banned ? "suspended" : "active"} />
                    </TableCell>
                    <TableCell>
                      <LocalTime value={user.createdAt} dateOnly />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/users", filters, { page: p })} />
        </div>

        <Section title="Create a user" description="The account can sign in immediately with the password you set.">
          <ActionForm action={createUserAction} className="grid gap-4">
            <FormMessage />
            <TextField label="Full name" name="name" required minLength={2} maxLength={120} />
            <TextField label="Email address" name="email" type="email" required maxLength={200} autoComplete="off" />
            <TextField
              label="Initial password"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              hint="At least 10 characters. Ask the user to change it after signing in."
            />
            <SelectField
              label="Role"
              name="role"
              options={[
                { value: "student", label: "Learner" },
                ...(can(actor, "role.assign")
                  ? [
                      { value: "instructor", label: "Instructor" },
                      { value: "admin", label: "Administrator" },
                    ]
                  : []),
              ]}
            />
            <div>
              <SubmitButton pendingLabel="Creating...">Create user</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
