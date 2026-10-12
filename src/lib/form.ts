/** Small, explicit readers for FormData. Validation itself happens in the services (Zod). */

export const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export const optStr = (fd: FormData, key: string): string | null => {
  const v = str(fd, key).trim();
  return v === "" ? null : v;
};

export const bool = (fd: FormData, key: string): boolean => {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
};

export const num = (fd: FormData, key: string): number => {
  const v = str(fd, key).trim();
  return v === "" ? Number.NaN : Number(v);
};

export const optNum = (fd: FormData, key: string): number | null => {
  const v = str(fd, key).trim();
  return v === "" ? null : Number(v);
};

/** Values of repeated fields, e.g. checkbox groups. */
export const list = (fd: FormData, key: string): string[] =>
  fd.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");

/** One entry per non-empty line of a textarea. */
export const lines = (fd: FormData, key: string): string[] =>
  str(fd, key)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Comma- or space-separated tokens. */
export const tokens = (fd: FormData, key: string): string[] =>
  str(fd, key)
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);

/** ISO timestamp produced by the DateTimeField component (already in UTC). */
export const date = (fd: FormData, key: string): Date | null => {
  const v = str(fd, key).trim();
  if (v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Major units (e.g. 1500.50) to minor units (150050). */
export const money = (fd: FormData, key: string): number => {
  const v = optNum(fd, key);
  return v === null || Number.isNaN(v) ? 0 : Math.round(v * 100);
};
