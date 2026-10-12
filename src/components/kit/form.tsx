"use client";

import { createContext, useContext, useId, useRef, useState, useTransition } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeField } from "./datetime-field";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/server/action";

export type FormAction = (formData: FormData) => Promise<ActionState>;

type Ctx = { state: ActionState | null; pending: boolean };
const FormCtx = createContext<Ctx>({ state: null, pending: false });
export const useFormCtx = () => useContext(FormCtx);

type ActionFormProps = Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: FormAction;
  /** Clear the inputs after a successful submit. */
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  /** Show the returned message as a toast (default true). */
  toastOnSuccess?: boolean;
};

/**
 * Submits to a server action and keeps the user's input when the server
 * rejects it. Field errors and the summary message come from the action.
 */
export function ActionForm({
  action,
  resetOnSuccess,
  onSuccess,
  toastOnSuccess = true,
  className,
  children,
  ...props
}: ActionFormProps) {
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      noValidate={false}
      className={className}
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const formData = new FormData(event.currentTarget);
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) formData.set(submitter.name, submitter.value);
        startTransition(async () => {
          const result = await action(formData);
          // A redirecting action never returns.
          if (!result) return;
          setState(result);
          if (result.ok) {
            if (toastOnSuccess && result.message) toast.success(result.message);
            if (resetOnSuccess) ref.current?.reset();
            onSuccess?.(result);
          }
        });
      }}
    >
      <FormCtx value={{ state, pending }}>{children}</FormCtx>
    </form>
  );
}

/** Summary of a failed submit, announced to assistive technology. */
export function FormMessage({ className }: { className?: string }) {
  const { state } = useFormCtx();
  if (!state || state.ok || !state.message) return null;
  const extra = state.fieldErrors?.publish;
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p>{state.message}</p>
        {extra && (
          <ul className="mt-1 list-disc pl-4">
            {extra.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FieldError({ name, id }: { name: string; id?: string }) {
  const { state } = useFormCtx();
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {errors.join(" ")}
    </p>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: string;
  className?: string;
  /** Receives the ids to wire up label and descriptions. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
};

function Field({ label, name, hint, className, children }: FieldProps) {
  const id = useId();
  const { state } = useFormCtx();
  const invalid = !!(state && !state.ok && state.fieldErrors?.[name]?.length);
  const describedBy = [hint ? `${id}-hint` : null, invalid ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, describedBy, invalid })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError name={name} id={`${id}-error`} />
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

type Common = { label: string; name: string; hint?: string; className?: string };

export function TextField({ label, name, hint, className, ...props }: Common & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props} />
      )}
    </Field>
  );
}

export function TextAreaField({ label, name, hint, className, ...props }: Common & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <Textarea id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props} />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  name,
  hint,
  className,
  options,
  ...props
}: Common & { options: Array<{ value: string; label: string }> } & Omit<React.ComponentProps<"select">, "name" | "id">) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <select id={id} name={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={selectClass} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function DateTimeFormField({ label, name, hint, className, defaultValue, required }: Common & { defaultValue?: string | null; required?: boolean }) {
  return (
    <Field label={label} name={name} hint={hint ?? "Shown in your local time zone."} className={className}>
      {({ id, describedBy }) => (
        <DateTimeField id={id} name={name} defaultValue={defaultValue} required={required} aria-describedby={describedBy} />
      )}
    </Field>
  );
}

export function CheckboxField({ label, name, hint, className, ...props }: Common & Omit<React.ComponentProps<"input">, "name" | "id" | "type">) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input id={id} name={name} type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary" aria-describedby={hint ? id + "-hint" : undefined} {...props} />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="leading-5 font-normal">
          {label}
        </Label>
        {hint && (
          <p id={id + "-hint"} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <FieldError name={name} />
      </div>
    </div>
  );
}
