import { getDB, courseLessons } from "@/lib/db";
export async function GET() {
  const db = await getDB();
  const published = db.courses.filter(c => c.status === "published");
  return Response.json({
    courses: published.length,
    lessons: published.reduce((a, c) => a + courseLessons(c).length, 0),
    students: db.users.filter(u => u.role === "student").length,
    tutors: db.users.filter(u => u.role === "tutor" && u.status === "verified").length,
    certificates: db.certificates.filter(c => !c.revoked).length,
    categories: [...new Set(published.map(c => c.category))],
  });
}
