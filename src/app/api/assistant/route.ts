import { getDB, canAccessCourse, courseLessons } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";

/** Study assistant. Answers ONLY from course material the student is entitled
 *  to access (free/preview lessons, or premium while subscribed). Uses an
 *  external model when OPENAI_API_KEY is configured; otherwise falls back to
 *  on-platform retrieval + practice-question generation from the same
 *  authorised material — never inventing access to restricted content. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const db = await getDB();
    const { courseId, question, mode } = await req.json();
    const course = db.courses.find(c => c.id === courseId && c.status === "published");
    if (!course) throw new ApiError(404, "Course not found.");
    const unlocked = canAccessCourse(db, user, course);
    const accessible = courseLessons(course).filter(l => unlocked || l.isPreview);
    if (!accessible.length) throw new ApiError(403, "Subscribe to Premium to use the study assistant with this course's materials.");
    const corpus = accessible.map(l => `## ${l.title}\n${l.body}`).join("\n\n");

    if (mode === "practice") {
      const src = accessible[Math.floor(Math.random() * accessible.length)];
      return Response.json({ answer: `Practice from "${src.title}":\n\n1. Explain the main idea of this lesson in your own words.\n2. ${src.body.split(".")[0]}. — why does this matter in practice?\n3. Give one real-world example (ideally Kenyan) that applies this concept.\n\nWrite short answers, then re-read the lesson to check yourself.` });
    }
    if (mode === "summarise") {
      return Response.json({ answer: `Summary of the material you can access in "${course.title}":\n\n` + accessible.map(l => `• ${l.title}: ${l.body.split(".")[0]}.`).join("\n") });
    }
    if (!question?.trim()) throw new ApiError(400, "Ask a question about this course.");

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: `You are the EDVORA study assistant. Answer using ONLY the provided authorised course material. If the material does not cover the question, say so and point to the closest lesson. Be concise and encouraging.\n\nCOURSE MATERIAL:\n${corpus.slice(0, 12000)}` },
            { role: "user", content: question },
          ],
        }),
      });
      if (res.ok) { const data = await res.json(); return Response.json({ answer: data.choices?.[0]?.message?.content || "I could not generate an answer just now." }); }
    }
    // Retrieval fallback: rank accessible lessons by keyword overlap.
    const words = question.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
    const ranked = accessible.map(l => ({ l, score: words.reduce((a: number, w: string) => a + ((l.title + " " + l.body).toLowerCase().includes(w) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score === 0)
      return Response.json({ answer: `That topic is not covered in the lessons you currently have access to in "${course.title}". Try the lesson list, or ask your tutor from the Messages page. (Connect an AI provider via OPENAI_API_KEY for free-form explanations.)` });
    return Response.json({ answer: `From "${best.l.title}" in ${course.title}:\n\n${best.l.body}\n\nTip: open that lesson to work through the full explanation and examples.` });
  } catch (e) { return jsonError(e); }
}
