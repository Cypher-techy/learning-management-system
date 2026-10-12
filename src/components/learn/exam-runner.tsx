"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Clock, Loader2, Paperclip, WifiOff } from "lucide-react";
import { saveAnswerAction, submitAttemptAction } from "@/app/actions/learner";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  type: "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "essay" | "file_upload";
  text: string;
  marks: number;
  options: { id: string; text: string }[];
};

type Answer = { selectedOptionIds: string[]; textAnswer: string; fileId: string | null; fileName?: string };
type SaveState = "saved" | "saving" | "dirty" | "error";

const EMPTY: Answer = { selectedOptionIds: [], textAnswer: "", fileId: null };

function isAnswered(question: Question, answer: Answer | undefined) {
  if (!answer) return false;
  if (question.type === "file_upload") return !!answer.fileId;
  if (question.type === "short_answer" || question.type === "essay") return answer.textAnswer.trim() !== "";
  return answer.selectedOptionIds.length > 0;
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * The examination screen. Every change is saved to the server as the learner
 * works, so a dropped connection or closed tab loses nothing that was saved.
 * The clock shown here is advisory: the deadline is enforced on the server.
 */
export function ExamRunner({
  attemptId,
  courseId,
  questions,
  initialAnswers,
  deadlineAt,
  serverNow,
}: {
  attemptId: string;
  courseId: string;
  questions: Question[];
  initialAnswers: Array<{ questionId: string } & Answer>;
  deadlineAt: string | null;
  serverNow: string;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, { selectedOptionIds: a.selectedOptionIds, textAnswer: a.textAnswer, fileId: a.fileId }])),
  );
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});

  const latest = useRef(answers);
  latest.current = answers;
  const timers = useRef<Record<string, number>>({});
  const inFlight = useRef<Record<string, Promise<void>>>({});
  const dirty = useRef(new Set<string>());

  // Align the countdown with the server clock rather than the device clock.
  const clockOffset = useMemo(() => new Date(serverNow).getTime() - Date.now(), [serverNow]);
  const deadline = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(deadline ? deadline - (Date.now() + clockOffset) : null);

  const persist = useCallback(
    async (questionId: string) => {
      const answer = latest.current[questionId] ?? EMPTY;
      setStatus((s) => ({ ...s, [questionId]: "saving" }));
      const run = (async () => {
        try {
          const result = await saveAnswerAction({
            attemptId,
            questionId,
            selectedOptionIds: answer.selectedOptionIds,
            textAnswer: answer.textAnswer,
            fileId: answer.fileId,
          });
          if (result?.ok) {
            // Only clear the flag if nothing changed while the request was in flight.
            if (latest.current[questionId] === answer || JSON.stringify(latest.current[questionId]) === JSON.stringify(answer)) {
              dirty.current.delete(questionId);
              setStatus((s) => ({ ...s, [questionId]: "saved" }));
            }
          } else {
            setStatus((s) => ({ ...s, [questionId]: "error" }));
            if (result && /time is up|already been submitted/i.test(result.message)) setClosed(result.message);
          }
        } catch {
          // Network failure: keep the answer locally and retry shortly.
          setStatus((s) => ({ ...s, [questionId]: "error" }));
        }
      })();
      inFlight.current[questionId] = run;
      await run;
    },
    [attemptId],
  );

  const change = useCallback(
    (questionId: string, patch: Partial<Answer>, debounce: boolean) => {
      setAnswers((current) => {
        const next = { ...current, [questionId]: { ...(current[questionId] ?? EMPTY), ...patch } };
        latest.current = next;
        return next;
      });
      dirty.current.add(questionId);
      setStatus((s) => ({ ...s, [questionId]: "dirty" }));
      window.clearTimeout(timers.current[questionId]);
      timers.current[questionId] = window.setTimeout(() => void persist(questionId), debounce ? 900 : 0);
    },
    [persist],
  );

  const flush = useCallback(async () => {
    for (const id of Object.keys(timers.current)) window.clearTimeout(timers.current[id]);
    await Promise.all(Object.values(inFlight.current));
    await Promise.all([...dirty.current].map((id) => persist(id)));
  }, [persist]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    await flush();
    const formData = new FormData();
    formData.set("attemptId", attemptId);
    try {
      const result = await submitAttemptAction(formData);
      // On success the action redirects to the result page and never returns.
      if (result && !result.ok) {
        setSubmitting(false);
        setClosed(result.message);
      }
    } catch {
      setSubmitting(false);
      setClosed("We could not reach the server. Check your connection and press Submit again; your saved answers are safe.");
    }
  }, [attemptId, flush]);

  // Retry anything that failed to save.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (submitting) return;
      for (const id of dirty.current) {
        if (!timers.current[id] || status[id] === "error") void persist(id);
      }
    }, 6000);
    return () => window.clearInterval(interval);
  }, [persist, status, submitting]);

  // Countdown and automatic submission.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = deadline - (Date.now() + clockOffset);
      setRemaining(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        void submit();
      }
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [clockOffset, deadline, submit]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty.current.size > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function upload(questionId: string, file: File) {
    setUploadError((e) => ({ ...e, [questionId]: "" }));
    setStatus((s) => ({ ...s, [questionId]: "saving" }));
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "submission");
    body.set("courseId", courseId);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json()) as { id?: string; name?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Upload failed.");
      change(questionId, { fileId: data.id, fileName: data.name }, false);
    } catch (error) {
      setStatus((s) => ({ ...s, [questionId]: "error" }));
      setUploadError((e) => ({ ...e, [questionId]: error instanceof Error ? error.message : "Upload failed." }));
    }
  }

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const unsaved = Object.values(status).some((s) => s === "error");
  const low = remaining !== null && remaining < 5 * 60_000;

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur lg:-mx-6 lg:px-6">
        <p className="text-sm" aria-live="polite">
          <span className="font-medium tabular-nums">{answeredCount}</span> of {questions.length} answered
        </p>
        {unsaved ? (
          <p role="alert" className="inline-flex items-center gap-1.5 text-sm text-destructive">
            <WifiOff className="size-4" aria-hidden /> Some answers are not saved yet. Retrying...
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-success" aria-hidden /> Answers are saved automatically
          </p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {remaining !== null && (
            <p
              role="timer"
              aria-label="Time remaining"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium tabular-nums",
                low && "border-destructive/40 bg-destructive/5 text-destructive",
              )}
            >
              <Clock className="size-4" aria-hidden />
              {formatRemaining(remaining)}
            </p>
          )}
          <Button onClick={() => setConfirming(true)} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Submit
          </Button>
        </div>
      </div>

      {closed && (
        <div role="alert" className="mb-6 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{closed}</p>
        </div>
      )}

      <ol className="space-y-5">
        {questions.map((question, index) => {
          const answer = answers[question.id] ?? EMPTY;
          const state = status[question.id];
          const name = `q-${question.id}`;
          return (
            <li key={question.id} id={name} className="scroll-mt-32 rounded-xl border bg-card p-4">
              <fieldset disabled={submitting}>
                <legend className="float-left mb-3 w-full">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium whitespace-pre-line">
                      <span className="text-muted-foreground">{index + 1}. </span>
                      {question.text}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {question.marks} {question.marks === 1 ? "mark" : "marks"}
                    </span>
                  </span>
                </legend>
                <div className="clear-both">
                  {(question.type === "multiple_choice" || question.type === "true_false") && (
                    <div className="grid gap-1.5">
                      {question.options.map((option) => (
                        <label key={option.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent/50">
                          <input
                            type="radio"
                            name={name}
                            className="mt-0.5 size-4 accent-primary"
                            checked={answer.selectedOptionIds[0] === option.id}
                            onChange={() => change(question.id, { selectedOptionIds: [option.id] }, false)}
                          />
                          <span>{option.text}</span>
                        </label>
                      ))}
                      {answer.selectedOptionIds.length > 0 && (
                        <button
                          type="button"
                          className="justify-self-start text-xs text-muted-foreground underline"
                          onClick={() => change(question.id, { selectedOptionIds: [] }, false)}
                        >
                          Clear my answer
                        </button>
                      )}
                    </div>
                  )}
                  {question.type === "multiple_select" && (
                    <div className="grid gap-1.5">
                      <p className="text-xs text-muted-foreground">Select all that apply.</p>
                      {question.options.map((option) => {
                        const checked = answer.selectedOptionIds.includes(option.id);
                        return (
                          <label key={option.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent/50">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 accent-primary"
                              checked={checked}
                              onChange={() =>
                                change(
                                  question.id,
                                  {
                                    selectedOptionIds: checked
                                      ? answer.selectedOptionIds.filter((id) => id !== option.id)
                                      : [...answer.selectedOptionIds, option.id],
                                  },
                                  false,
                                )
                              }
                            />
                            <span>{option.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {question.type === "short_answer" && (
                    <Input
                      aria-label={`Answer to question ${index + 1}`}
                      value={answer.textAnswer}
                      maxLength={500}
                      onChange={(event) => change(question.id, { textAnswer: event.target.value }, true)}
                      onBlur={() => dirty.current.has(question.id) && void persist(question.id)}
                    />
                  )}
                  {question.type === "essay" && (
                    <Textarea
                      aria-label={`Answer to question ${index + 1}`}
                      rows={8}
                      value={answer.textAnswer}
                      maxLength={50000}
                      onChange={(event) => change(question.id, { textAnswer: event.target.value }, true)}
                      onBlur={() => dirty.current.has(question.id) && void persist(question.id)}
                    />
                  )}
                  {question.type === "file_upload" && (
                    <div className="grid gap-2">
                      {answer.fileId && (
                        <p className="inline-flex items-center gap-2 text-sm">
                          <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                          <a href={`/api/files/${answer.fileId}?download=1`} className="text-primary hover:underline">
                            {answer.fileName ?? "Uploaded file"}
                          </a>
                        </p>
                      )}
                      <Input
                        type="file"
                        aria-label={`Upload a file for question ${index + 1}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void upload(question.id, file);
                        }}
                      />
                      {uploadError[question.id] && <p className="text-xs text-destructive">{uploadError[question.id]}</p>}
                    </div>
                  )}
                  <p className="mt-2 h-4 text-xs text-muted-foreground" aria-live="polite">
                    {state === "saving" && "Saving..."}
                    {state === "saved" && "Saved"}
                    {state === "dirty" && "Unsaved changes"}
                    {state === "error" && <span className="text-destructive">Not saved. Retrying...</span>}
                  </p>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={() => setConfirming(true)} disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          Submit answers
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={(open) => !submitting && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>
              {answeredCount < questions.length
                ? `You have answered ${answeredCount} of ${questions.length} questions. Unanswered questions score zero. `
                : "You have answered every question. "}
              You cannot change your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                setConfirming(false);
                void submit();
              }}
            >
              Submit now
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
