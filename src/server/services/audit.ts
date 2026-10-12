import { db, schema, type DbOrTx } from "../db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Records a privileged or security-relevant operation. Pass the open
 * transaction so the log entry commits atomically with the change it describes.
 */
export async function logAudit(conn: DbOrTx, entry: AuditEntry) {
  await conn.insert(schema.auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: entry.ipAddress ?? null,
  });
}

export async function logAuditStandalone(entry: AuditEntry) {
  try {
    await logAudit(db, entry);
  } catch (error) {
    console.error("[audit] failed to write audit entry", entry.action, error);
  }
}
