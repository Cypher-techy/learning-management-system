import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

type Q = {
  type: string;
  text: string;
  marks: number;
  explanation: string;
  acceptedAnswers: string[];
  options: { id: string; text: string; isCorrect: boolean }[];
};

/** Staff-only rendering of a question, including its correct answers. */
export function QuestionView({ question, index }: { question: Q; index?: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{titleCase(question.type)}</Badge>
        <span>
          {question.marks} {question.marks === 1 ? "mark" : "marks"}
        </span>
      </div>
      <p className="mt-1.5 font-medium whitespace-pre-line">
        {index !== undefined && <span className="text-muted-foreground">{index + 1}. </span>}
        {question.text}
      </p>
      {question.options.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {question.options.map((o) => (
            <li key={o.id} className="flex items-start gap-2">
              <span className="mt-0.5 w-4 shrink-0">
                {o.isCorrect && <Check className="size-4 text-success" aria-label="Correct answer" />}
              </span>
              <span className={o.isCorrect ? "font-medium" : "text-muted-foreground"}>{o.text}</span>
            </li>
          ))}
        </ul>
      )}
      {question.type === "short_answer" && (
        <p className="mt-2 text-sm text-muted-foreground">
          {question.acceptedAnswers.length > 0 ? `Accepted: ${question.acceptedAnswers.join(", ")}` : "Marked manually"}
        </p>
      )}
      {question.explanation && <p className="mt-2 text-sm text-muted-foreground">Explanation: {question.explanation}</p>}
    </div>
  );
}
