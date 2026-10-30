import { getDB, persist, uid, now, canAccessCourse, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = getDB();
    const quiz = db.quizzes.find(q => q.id === id);
    if (!quiz) throw new ApiError(404, "Quiz not found.");
    const course = db.courses.find(c => c.id === quiz.courseId)!;
    if (!canAccessCourse(db, user, course)) throw new ApiError(403, "Premium access required.");
    const prior = db.quizAttempts.filter(a => a.quizId === id && a.studentId === user.id).length;
    if (prior >= quiz.maxAttempts) throw new ApiError(400, `You have used all ${quiz.maxAttempts} attempts for this quiz.`);
    const { answers } = await req.json();
    let score = 0, total = 0, manualPending = false;
    const feedback = quiz.questions.map(q => {
      if (q.type === "short") { manualPending = manualPending || !!answers?.[q.id]; return { questionId: q.id, correct: null, explanation: q.explanation, correctAnswer: q.answer || undefined }; }
      total++;
      const correct = String(answers?.[q.id] || "").trim().toLowerCase() === q.answer.trim().toLowerCase();
      if (correct) score++;
      return { questionId: q.id, correct, explanation: q.explanation, correctAnswer: q.answer };
    });
    const pct = total ? (score / total) * 100 : 0;
    const attempt = { id: uid("qa_"), quizId: id, courseId: quiz.courseId, studentId: user.id, answers: answers || {}, score, total, passed: pct >= quiz.passMark, submittedAt: now(), manualPending };
    db.quizAttempts.push(attempt);
    notify(user.id, "Quiz result ready", `"${quiz.title}": ${score}/${total} (${Math.round(pct)}%) — ${attempt.passed ? "Passed" : "Keep practising"}.`, "/dashboard/student/quizzes");
    persist();
    return Response.json({ ok: true, attempt, feedback, attemptsLeft: quiz.maxAttempts - prior - 1 });
  } catch (e) { return jsonError(e); }
}
