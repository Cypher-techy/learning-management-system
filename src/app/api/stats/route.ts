import { getDB, courseLessons } from "@/lib/db";
export async function GET() {
  const db = getDB();
  const published = db.courses.filter(c => c.status === "published");
  return Response.json({
    courses: published.length,
    lessons: published.reduce((a, c) => a + courseLessons(c).length, 0),
    students: db.users.filter(u => u.role === "student").length,
    teachers: db.users.filter(u => u.role === "teacher" && u.status === "verified").length,
    certificates: db.certificates.filter(c => !c.revoked).length,
    categories: [...new Set(published.map(c => c.category))],
  });
}
