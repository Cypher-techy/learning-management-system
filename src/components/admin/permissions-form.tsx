"use client";

import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import type { FormAction } from "@/components/kit/form";

type Row = { key: string; label: string; granted: boolean; delegable: boolean };

/** Editable permission list for one role. Saving requires the administrator's password. */
export function PermissionsForm({ action, role, rows }: { action: FormAction; role: string; rows: Row[] }) {
  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="role" value={role} />
      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.key}>
            <label className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                name="permissions"
                value={row.key}
                defaultChecked={row.granted}
                disabled={!row.delegable}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              />
              <span>
                <span className="block">{row.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.key}
                  {!row.delegable && " · administrators only"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <TextField
        label="Your password"
        name="confirmPassword"
        type="password"
        autoComplete="current-password"
        required
        className="max-w-xs"
        hint="Required to change permissions."
      />
      <FormMessage />
      <div>
        <SubmitButton pendingLabel="Saving...">Save permissions</SubmitButton>
      </div>
    </ActionForm>
  );
}
