"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { FormAction } from "@/components/kit/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TYPES = [
  { value: "multiple_choice", label: "Multiple choice (one correct answer)" },
  { value: "multiple_select", label: "Multiple select (several correct answers)" },
  { value: "true_false", label: "True or false" },
  { value: "short_answer", label: "Short answer" },
  { value: "essay", label: "Essay (marked by you)" },
  { value: "file_upload", label: "File upload (marked by you)" },
] as const;

type QuestionType = (typeof TYPES)[number]["value"];

// Mirrors the server-side rules so problems are caught before submitting.
// The server validates again; this copy is only for immediate feedback.
const formSchema = z
  .object({
    type: z.enum(["multiple_choice", "multiple_select", "true_false", "short_answer", "essay", "file_upload"]),
    text: z.string().trim().min(3, "Write the question."),
    marks: z.number({ error: "Enter the marks." }).min(0.25, "At least 0.25.").max(1000),
    explanation: z.string(),
    options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })),
    trueIsCorrect: z.boolean(),
    acceptedAnswers: z.string(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "multiple_choice" || q.type === "multiple_select") {
      const filled = q.options.filter((o) => o.text.trim() !== "");
      const correct = filled.filter((o) => o.isCorrect).length;
      if (filled.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options." });
      else if (q.type === "multiple_choice" && correct !== 1) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one option as correct." });
      } else if (q.type === "multiple_select" && correct < 1) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one option as correct." });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export type QuestionInitial = {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  explanation: string;
  acceptedAnswers: string[];
  options: { text: string; isCorrect: boolean }[];
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const blankOptions = () => [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuestionEditor({
  action,
  fields,
  initial,
  onDone,
  submitLabel = "Add question",
}: {
  action: FormAction;
  /** Hidden values sent with the action, e.g. the assessment or bank id. */
  fields: Record<string, string>;
  initial?: QuestionInitial;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaults: FormValues = {
    type: initial?.type ?? "multiple_choice",
    text: initial?.text ?? "",
    marks: initial?.marks ?? 1,
    explanation: initial?.explanation ?? "",
    options:
      initial && (initial.type === "multiple_choice" || initial.type === "multiple_select") && initial.options.length > 0
        ? initial.options
        : blankOptions(),
    trueIsCorrect: initial?.type === "true_false" ? (initial.options.find((o) => o.isCorrect)?.text ?? "True") === "True" : true,
    acceptedAnswers: initial?.acceptedAnswers.join("\n") ?? "",
  };
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults });
  const { fields: optionFields, append, remove } = useFieldArray({ control, name: "options" });
  const type = useWatch({ control, name: "type" });
  const watchedOptions = useWatch({ control, name: "options" });
  const trueIsCorrect = useWatch({ control, name: "trueIsCorrect" });

  const submit = handleSubmit((values) => {
    setServerError(null);
    const usesOptions = values.type === "multiple_choice" || values.type === "multiple_select";
    const question = {
      type: values.type,
      text: values.text,
      marks: values.marks,
      explanation: values.explanation,
      options: usesOptions
        ? values.options.filter((o) => o.text.trim() !== "")
        : values.type === "true_false"
          ? [
              { text: "True", isCorrect: values.trueIsCorrect },
              { text: "False", isCorrect: !values.trueIsCorrect },
            ]
          : [],
      acceptedAnswers:
        values.type === "short_answer"
          ? values.acceptedAnswers
              .split(/\r?\n/)
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
    };
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    formData.set("question", JSON.stringify(question));
    startTransition(async () => {
      const result = await action(formData);
      if (!result) return;
      if (!result.ok) {
        setServerError(result.message);
        return;
      }
      if (result.message) toast.success(result.message);
      if (!initial) reset({ ...defaults, type: values.type, marks: values.marks, options: blankOptions() });
      onDone?.();
    });
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="q-type">Question type</Label>
          <select id="q-type" className={selectClass} {...register("type")}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="q-marks">Marks</Label>
          <Input id="q-marks" type="number" step="0.25" min={0.25} aria-invalid={!!errors.marks} {...register("marks", { valueAsNumber: true })} />
          {errors.marks && <p className="text-xs text-destructive">{errors.marks.message}</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="q-text">Question</Label>
        <Textarea id="q-text" rows={3} aria-invalid={!!errors.text} {...register("text")} />
        {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
      </div>

      {(type === "multiple_choice" || type === "multiple_select") && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Answer options
            <span className="ml-2 font-normal text-muted-foreground">
              {type === "multiple_choice" ? "Select the one correct answer." : "Tick every correct answer."}
            </span>
          </legend>
          {optionFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                type={type === "multiple_choice" ? "radio" : "checkbox"}
                name="correct-option"
                className="size-4 shrink-0 accent-primary"
                aria-label={`Option ${index + 1} is correct`}
                checked={!!watchedOptions?.[index]?.isCorrect}
                onChange={(event) => {
                  if (type === "multiple_choice") {
                    getValues("options").forEach((_, i) => setValue(`options.${i}.isCorrect`, i === index, { shouldDirty: true }));
                  } else {
                    setValue(`options.${index}.isCorrect`, event.target.checked, { shouldDirty: true });
                  }
                }}
              />
              <Input aria-label={`Option ${index + 1}`} placeholder={`Option ${index + 1}`} {...register(`options.${index}.text`)} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove option ${index + 1}`}
                disabled={optionFields.length <= 2}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {errors.options && (
            <p className="text-xs text-destructive">{errors.options.message ?? errors.options.root?.message}</p>
          )}
          {optionFields.length < 12 && (
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ text: "", isCorrect: false })}>
                <Plus aria-hidden /> Add option
              </Button>
            </div>
          )}
        </fieldset>
      )}

      {type === "true_false" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Correct answer</legend>
          <div className="flex gap-4 text-sm">
            {[true, false].map((value) => (
              <label key={String(value)} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="true-false"
                  className="size-4 accent-primary"
                  checked={trueIsCorrect === value}
                  onChange={() => setValue("trueIsCorrect", value, { shouldDirty: true })}
                />
                {value ? "True" : "False"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {type === "short_answer" && (
        <div className="grid gap-1.5">
          <Label htmlFor="q-accepted">Accepted answers</Label>
          <Textarea id="q-accepted" rows={3} {...register("acceptedAnswers")} />
          <p className="text-xs text-muted-foreground">
            One per line. Matching ignores capital letters and extra spaces. Leave empty to mark answers yourself.
          </p>
        </div>
      )}

      {(type === "essay" || type === "file_upload") && (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm">
          This question is not marked automatically. Attempts that include it wait for you to grade them.
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="q-explanation">Explanation (optional)</Label>
        <Textarea id="q-explanation" rows={2} {...register("explanation")} />
        <p className="text-xs text-muted-foreground">Shown with the results only if the assessment reveals correct answers.</p>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
