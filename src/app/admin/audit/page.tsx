import type { Metadata } from "next";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { first, PageHeader, pageParam, Pagination, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { listAudit } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q);
  const page = pageParam(sp.page);
  const actor = await requirePermission("audit.view");
  const { rows, total } = await listAudit(actor, { q, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Security audit log"
        description="An append-only record of privileged and security-relevant operations. Entries cannot be edited or deleted from the application."
      />
      <FilterBar q={q} placeholder="Search action, person or record type" clearHref="/admin/audit" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No entries.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ log, actorName, actorEmail }) => {
              const details = Object.entries(log.metadata ?? {});
              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    <LocalTime value={log.createdAt} />
                  </TableCell>
                  <TableCell>
                    {actorName ?? "System"}
                    {actorEmail && <p className="text-xs text-muted-foreground">{actorEmail}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="text-xs">
                    {log.entityType}
                    {log.entityId && <p className="max-w-40 truncate font-mono text-muted-foreground">{log.entityId}</p>}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {details.length === 0
                      ? "-"
                      : details.map(([key, value]) => (
                          <p key={key} className="truncate">
                            {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </p>
                        ))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/audit", { q }, { page: p })} />
    </>
  );
}
