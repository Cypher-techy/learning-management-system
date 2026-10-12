"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { FormAction } from "@/components/kit/form";
import { Button } from "@/components/ui/button";
import { QuestionEditor, type QuestionInitial } from "./question-editor";

/** A button that expands into the question editor for a new question. */
export function NewQuestionPanel({ action, fields }: { action: FormAction; fields: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Write a new question
      </Button>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 font-semibold">New question</h3>
      <QuestionEditor action={action} fields={fields} onDone={() => setOpen(false)} />
    </div>
  );
}

/** Inline editor for an existing bank question. */
export function EditQuestionPanel({
  action,
  fields,
  question,
}: {
  action: FormAction;
  fields: Record<string, string>;
  question: QuestionInitial;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }
  return (
    <div className="mt-3 w-full basis-full rounded-lg border bg-muted/30 p-3">
      <QuestionEditor
        action={action}
        fields={{ ...fields, questionId: question.id }}
        initial={question}
        submitLabel="Save question"
        onDone={() => setOpen(false)}
      />
    </div>
  );
}
