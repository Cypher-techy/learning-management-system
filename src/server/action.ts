import "server-only";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { getActor } from "./auth/session";
import { AppError } from "./errors";
import type { Actor } from "./permissions";

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  data?: Record<string, string | number | boolean | null>;
};

export type ActionResult = {
  message?: string;
  /** Navigate here after success. */
  redirect?: string;
  /** Paths whose cached render should be refreshed. */
  revalidate?: string[];
  data?: ActionState["data"];
} | void;

function fromError(error: unknown): ActionState {
  if (error instanceof AppError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const first = error.issues[0];
    return {
      ok: false,
      message: first ? `${first.path.length ? `${String(first.path[0])}: ` : ""}${first.message}` : "Please check the form.",
      fieldErrors,
    };
  }
  // Unexpected: log the detail on the server, show nothing internal to the user.
  console.error("[action] unexpected error", error);
  return { ok: false, message: "Something went wrong on our side. Please try again." };
}

/**
 * Wraps a server action: resolves the signed-in user from the session,
 * converts known errors into form state and hides everything else. The
 * services called inside `fn` perform the actual authorization checks.
 */
export async function authed(
  fn: (actor: Actor) => Promise<ActionResult>,
  options: { refresh?: boolean } = {},
): Promise<ActionState> {
  let result: ActionResult;
  try {
    const actor = await getActor();
    if (!actor) return { ok: false, message: "Your session has ended. Please sign in again." };
    result = await fn(actor);
  } catch (error) {
    unstable_rethrow(error);
    return fromError(error);
  }
  // Nothing is statically cached, so this simply makes the browser refetch
  // whatever it is showing after a successful mutation. High-frequency
  // background saves opt out with { refresh: false }.
  if (options.refresh !== false) revalidatePath("/", "layout");
  if (result?.redirect) redirect(result.redirect);
  return { ok: true, message: result?.message ?? "", data: result?.data };
}

/** Same as `authed`, for the few actions open to anonymous visitors. */
export async function open(fn: (actor: Actor | null) => Promise<ActionResult>): Promise<ActionState> {
  let result: ActionResult;
  try {
    result = await fn(await getActor());
  } catch (error) {
    unstable_rethrow(error);
    return fromError(error);
  }
  // Nothing is statically cached, so this simply makes the browser refetch
  // whatever it is showing after any successful mutation.
  revalidatePath("/", "layout");
  if (result?.redirect) redirect(result.redirect);
  return { ok: true, message: result?.message ?? "", data: result?.data };
}
