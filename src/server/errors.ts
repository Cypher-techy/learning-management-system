export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

/**
 * An error whose message is safe to show to the person who caused it.
 * Anything else that is thrown is logged and replaced with a generic message.
 */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (message = "You do not have permission to do that.") =>
  new AppError("FORBIDDEN", message);

export const notFound = (what = "The requested item") =>
  new AppError("NOT_FOUND", `${what} could not be found.`);

export const invalid = (message: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION", message, fieldErrors);

export const conflict = (message: string) => new AppError("CONFLICT", message);

export function statusForError(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 400;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "UNAVAILABLE":
      return 503;
  }
}
