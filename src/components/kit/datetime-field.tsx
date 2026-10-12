"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * A date-time input that submits an unambiguous UTC timestamp. The visible
 * field uses the browser's local time zone; the hidden field carries the ISO
 * value the server stores.
 */
export function DateTimeField({
  name,
  defaultValue,
  id,
  required,
  "aria-describedby": describedBy,
}: {
  name: string;
  defaultValue?: string | null;
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
}) {
  const [local, setLocal] = useState(() => toLocalInput(defaultValue));
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <Input
        id={id}
        type="datetime-local"
        value={local}
        required={required}
        aria-describedby={describedBy}
        onChange={(event) => setLocal(event.target.value)}
        suppressHydrationWarning
      />
      <input type="hidden" name={name} value={Number.isNaN(Date.parse(iso)) ? "" : iso} suppressHydrationWarning />
    </>
  );
}

/** Shows a timestamp in the viewer's own time zone. */
export function LocalTime({ value, dateOnly }: { value: string | Date | null | undefined; dateOnly?: boolean }) {
  if (!value) return <span>-</span>;
  const date = new Date(value);
  const text = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  }).format(date);
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {text}
    </time>
  );
}
