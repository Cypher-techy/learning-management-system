import type { Course, Lesson, LessonBlock, Section } from "../db";

/** Tiny authoring DSL for W3Schools-style tutorial notes. */
export const t = (content: string): LessonBlock => ({ type: "text", content });
export const h = (content: string): LessonBlock => ({ type: "heading", content });
export const code = (c: string, language = "text"): LessonBlock => ({ type: "code", code: c.trim(), language });
export const ex = (c: string, tryit = true, language = "html"): LessonBlock => ({ type: "example", code: c.trim(), language, tryit });
export const tip = (content: string): LessonBlock => ({ type: "tip", content });
export const note = (content: string): LessonBlock => ({ type: "note", content });
export const warn = (content: string): LessonBlock => ({ type: "warning", content });
export const list = (items: string[]): LessonBlock => ({ type: "list", items });
export const steps = (items: string[]): LessonBlock => ({ type: "steps", items });
export const table = (headers: string[], rows: string[][]): LessonBlock => ({ type: "table", headers, rows });
export const exercise = (content: string, answer: string): LessonBlock => ({ type: "exercise", content, answer });

export const L = (id: string, title: string, durationMin: number, blocks: LessonBlock[], isPreview = false): Lesson => ({
  id, title, kind: "reading", durationMin, isPreview,
  body: blocks.filter((b) => b.type === "text").map((b) => b.content).join(" "),
  blocks,
});
export const S = (id: string, title: string, lessons: Lesson[]): Section => ({ id, title, lessons });

const IMG = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;
export function tutorialCourse(o: {
  id: string; title: string; subtitle: string; description: string; category: string;
  tutorId: string; image: string; objectives: string[]; requirements: string[]; sections: Section[];
}): Course {
  return {
    id: o.id, slug: o.id, title: o.title, subtitle: o.subtitle, description: o.description,
    category: o.category, level: "Beginner", access: "free", tutorId: o.tutorId,
    status: "published", image: IMG(o.image), objectives: o.objectives, requirements: o.requirements,
    sections: o.sections, createdAt: "2026-10-30T09:00:00.000Z", publishedAt: "2026-10-30T09:00:00.000Z", featured: false,
  };
}
