import { getDB, persist, uid, now, type Course } from "@/lib/db";
import { serializeCourse } from "@/lib/serialize";
import { currentUser, jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";


export async function GET(req: Request) {
  const db = getDB();
  const user = await currentUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const category = url.searchParams.get("category") || "";
  const level = url.searchParams.get("level") || "";
  const access = url.searchParams.get("access") || "";
  const instructor = url.searchParams.get("instructor") || "";
  const sort = url.searchParams.get("sort") || "recent";
  let list = db.courses.filter(c => c.status === "published");
  if (user?.role === "teacher") list = [...list, ...db.courses.filter(c => c.instructorId === user.id && c.status !== "published")];
  if (user?.role === "administrator" || user?.role === "owner") list = db.courses;
  if (q) list = list.filter(c => (c.title + c.description + c.category).toLowerCase().includes(q));
  if (category) list = list.filter(c => c.category === category);
  if (level) list = list.filter(c => c.level === level);
  if (access) list = list.filter(c => c.access === access);
  if (instructor) list = list.filter(c => c.instructorId === instructor);
  const out = list.map(c => serializeCourse(db, c, user));
  if (sort === "popular") out.sort((a, b) => b.enrolledCount - a.enrolledCount);
  else if (sort === "rating") out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else out.sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)));
  return Response.json({ courses: out, categories: [...new Set(db.courses.map(c => c.category))] });
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("teacher");
    requireVerified(user);
    const b = await req.json();
    if (!b.title?.trim() || !b.category) throw new ApiError(400, "Course title and category are required.");
    const db = getDB();
    const id = b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + uid("").slice(0, 4);
    const course: Course = {
      id, slug: id, title: b.title.trim(), subtitle: b.subtitle || "", description: b.description || "",
      category: b.category, level: b.level || "Beginner", access: b.access === "premium" ? "premium" : "free",
      instructorId: user.id, status: b.submit ? "in_review" : "draft",
      image: b.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=70",
      objectives: (b.objectives || "").split("\n").filter(Boolean),
      requirements: (b.requirements || "").split("\n").filter(Boolean),
      sections: (b.sections || []).map((s: any, si: number) => ({
        id: uid("s_"), title: s.title || `Section ${si + 1}`,
        lessons: (s.lessons || []).map((l: any) => ({
          id: uid("l_"), title: l.title || "Untitled lesson", kind: l.kind || "video",
          durationMin: Number(l.durationMin) || 10, isPreview: !!l.isPreview,
          videoUrl: l.videoUrl || undefined, body: l.body || "", resourceUrl: l.resourceUrl || undefined, resourceName: l.resourceName || undefined,
        })),
      })),
      createdAt: now(), featured: false,
    };
    db.courses.push(course);
    if (b.submit) db.users.filter(u => u.role === "administrator" && u.status === "verified").forEach(a =>
      db.notifications.unshift({ id: uid("n_"), userId: a.id, title: "Course submitted for review", body: `"${course.title}" by ${user.fullName}.`, createdAt: now(), read: false, href: "/dashboard/admin/courses" }));
    persist();
    return Response.json({ ok: true, course: serializeCourse(db, course, user) });
  } catch (e) { return jsonError(e); }
}
