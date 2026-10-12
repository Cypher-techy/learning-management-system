"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormAction } from "./form";

type ButtonProps = Pick<React.ComponentProps<typeof Button>, "variant" | "size" | "className" | "disabled">;

type ConfirmActionProps = ButtonProps & {
  action: FormAction;
  /** Hidden values sent with the action. */
  fields?: Record<string, string>;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask the user to re-enter their password (sensitive operations). */
  requirePassword?: boolean;
  /** Ask for a written reason; sent as the given field name. */
  reasonField?: { name: string; label: string; required?: boolean };
  children: React.ReactNode;
  "aria-label"?: string;
};

/** A button that asks for confirmation before running a server action. */
export function ConfirmAction({
  action,
  fields,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  requirePassword,
  reasonField,
  children,
  variant = "outline",
  size,
  className,
  disabled,
  ...rest
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              for (const [key, value] of Object.entries(fields ?? {})) formData.set(key, value);
              startTransition(async () => {
                const result = await action(formData);
                if (!result) return;
                if (result.ok) {
                  if (result.message) toast.success(result.message);
                  setOpen(false);
                } else {
                  setError(result.message);
                }
              });
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
            </AlertDialogHeader>
            {reasonField && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-reason`}>{reasonField.label}</Label>
                <Textarea id={`${id}-reason`} name={reasonField.name} rows={3} required={reasonField.required} />
              </div>
            )}
            {requirePassword && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-password`}>Your password</Label>
                <Input
                  id={`${id}-password`}
                  name="confirmPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <p className="text-xs text-muted-foreground">Required to confirm this sensitive action.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {confirmLabel}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type ActionButtonProps = ButtonProps & {
  action: FormAction;
  fields?: Record<string, string>;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  title?: string;
};

/** Runs a server action immediately, with pending and error feedback. */
export function ActionButton({ action, fields, children, variant = "outline", size, className, disabled, ...rest }: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      {...rest}
      onClick={() => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields ?? {})) formData.set(key, value);
        startTransition(async () => {
          const result = await action(formData);
          if (!result) return;
          if (result.ok) {
            if (result.message) toast.success(result.message);
          } else {
            toast.error(result.message);
          }
        });
      }}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
