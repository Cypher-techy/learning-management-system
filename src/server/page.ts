import "server-only";
import { notFound, redirect } from "next/navigation";
import { AppError } from "./errors";

/**
 * Runs a data loader for a page and turns authorization failures into the
 * right navigation outcome. Forbidden resources are shown as "not found"
 * unless a more helpful destination is given, so their existence is not
 * confirmed to people who may not see them.
 */
export async function load<T>(fn: () => Promise<T>, options: { forbidden?: string } = {}): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHENTICATED") redirect("/sign-in");
      if (error.code === "FORBIDDEN" && options.forbidden) redirect(options.forbidden);
      if (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") notFound();
    }
    throw error;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params that should be ids: anything else is a 404, not a database error. */
export function uuidParam(value: string): string {
  if (!UUID.test(value)) notFound();
  return value;
}
