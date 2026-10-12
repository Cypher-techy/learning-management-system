"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { FormAction } from "./form";

type Purpose = "course_thumbnail" | "lesson_resource" | "lesson_video" | "submission" | "branding";
type Uploaded = { id: string; name: string; size: number };

async function uploadOne(file: File, purpose: Purpose, courseId?: string): Promise<Uploaded> {
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  if (courseId) body.set("courseId", courseId);
  let response: Response;
  try {
    response = await fetch("/api/upload", { method: "POST", body });
  } catch {
    throw new Error("The upload could not reach the server. Check your connection and try again.");
  }
  const data = (await response.json().catch(() => ({}))) as Partial<Uploaded> & { error?: string };
  if (!response.ok || !data.id) {
    throw new Error(
      data.error ?? (response.status === 413 ? "The file is too large for the server to accept." : "The upload failed."),
    );
  }
  return { id: data.id, name: data.name ?? file.name, size: data.size ?? file.size };
}

/**
 * A list of uploaded files that submits with its surrounding form: each file
 * contributes a hidden `name` field holding its id.
 */
export function FileListInput({
  name,
  purpose,
  courseId,
  initial = [],
  maxFiles = 3,
  accept,
  disabled,
  label = "Attachments",
}: {
  name: string;
  purpose: Purpose;
  courseId?: string;
  initial?: Uploaded[];
  maxFiles?: number;
  /** Extensions without dots, for the file picker hint. */
  accept?: string[];
  disabled?: boolean;
  label?: string;
}) {
  const [files, setFiles] = useState<Uploaded[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const room = maxFiles - files.length;
    if (list.length > room) {
      setError(`You can attach at most ${maxFiles} file${maxFiles === 1 ? "" : "s"}.`);
      return;
    }
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const uploaded = await uploadOne(file, purpose, courseId);
        setFiles((current) => [...current, uploaded]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      {files.length > 0 && (
        <ul className="divide-y rounded-lg border" aria-labelledby={`${id}-label`}>
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a href={`/api/files/${file.id}?download=1`} className="min-w-0 flex-1 truncate hover:underline">
                {file.name}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              <input type="hidden" name={name} value={file.id} />
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((f) => f.id !== file.id))}
                >
                  <X aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && files.length < maxFiles && (
        <div>
          <input
            ref={input}
            id={id}
            type="file"
            multiple={maxFiles > 1}
            accept={accept?.length ? accept.map((e) => `.${e}`).join(",") : undefined}
            className="sr-only"
            onChange={(event) => void add(event.target.files)}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {busy ? "Uploading..." : "Add file"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {maxFiles} file{maxFiles === 1 ? "" : "s"}
            {accept?.length ? `. Accepted: ${accept.join(", ")}` : ""}.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Uploads one file, then hands its id to a server action. */
export function UploadAction({
  action,
  purpose,
  courseId,
  fields,
  accept,
  children,
  variant = "outline",
  size,
}: {
  action: FormAction;
  purpose: Purpose;
  courseId?: string;
  /** Extra values sent with the action alongside `fileId` and `fileName`. */
  fields?: Record<string, string>;
  accept?: string[];
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;

  async function handle(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadOne(file, purpose, courseId);
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields ?? {})) formData.set(key, value);
      formData.set("fileId", uploaded.id);
      formData.set("fileName", uploaded.name);
      startTransition(async () => {
        const result = await action(formData);
        if (!result) return;
        if (result.ok) toast.success(result.message || "Uploaded.");
        else toast.error(result.message);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept?.length ? accept.map((e) => `.${e}`).join(",") : undefined}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void handle(event.target.files?.[0])}
      />
      <Button type="button" variant={variant} size={size} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {busy ? "Uploading..." : children}
      </Button>
    </>
  );
}
