import { CircleCheck, CircleX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import type { VerificationResult } from "@/server/services/certificates";

export function VerifyForm({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/verify" className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="number">Certificate number</Label>
        <Input
          id="number"
          name="number"
          defaultValue={defaultValue}
          placeholder="CERT-2026-XXXXX-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={40}
          className="h-9 font-mono"
        />
      </div>
      <Button type="submit" size="lg">
        Verify
      </Button>
    </form>
  );
}

/** Shows only what is needed to establish authenticity. */
export function VerifyResult({ result, limited }: { result: VerificationResult | null; limited?: boolean }) {
  if (limited) {
    return (
      <Panel tone="amber" icon={ShieldAlert} title="Too many checks">
        Please wait a minute before verifying another certificate.
      </Panel>
    );
  }
  if (!result) return null;
  if (!result.found) {
    return (
      <Panel tone="red" icon={CircleX} title="No certificate found">
        No certificate matches that number. Check that it was entered exactly as printed, including the dashes.
      </Panel>
    );
  }
  const valid = result.status === "valid";
  return (
    <Panel
      tone={valid ? "green" : "red"}
      icon={valid ? CircleCheck : CircleX}
      title={valid ? "This certificate is valid" : "This certificate has been revoked"}
    >
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Awarded to</dt>
        <dd className="font-medium text-foreground">{result.learnerName}</dd>
        <dt className="text-muted-foreground">Course</dt>
        <dd className="font-medium text-foreground">{result.courseTitle}</dd>
        <dt className="text-muted-foreground">Issued by</dt>
        <dd className="text-foreground">{result.issuer}</dd>
        <dt className="text-muted-foreground">Issue date</dt>
        <dd className="text-foreground">{formatDate(result.issuedAt)}</dd>
        <dt className="text-muted-foreground">Certificate number</dt>
        <dd className="font-mono text-foreground">{result.number}</dd>
        {!valid && (
          <>
            <dt className="text-muted-foreground">Revoked on</dt>
            <dd className="text-foreground">{formatDate(result.revokedAt)}</dd>
          </>
        )}
      </dl>
    </Panel>
  );
}

function Panel({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "green" | "red" | "amber";
  icon: typeof CircleCheck;
  title: string;
  children: React.ReactNode;
}) {
  const color =
    tone === "green"
      ? "border-success/40 bg-success/5 text-success"
      : tone === "red"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : "border-warning/40 bg-warning/5 text-warning";
  return (
    <div role="status" data-testid="verify-result" data-status={tone} className={`mt-6 rounded-xl border p-5 ${color}`}>
      <p className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-5" aria-hidden />
        {title}
      </p>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
