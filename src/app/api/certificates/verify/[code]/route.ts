import { getDB } from "@/lib/db";
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await getDB();
  const cert = db.certificates.find(c => c.code === code);
  if (!cert) return Response.json({ valid: false, message: "No certificate with this reference exists." });
  const student = db.users.find(u => u.id === cert.studentId);
  const course = db.courses.find(c => c.id === cert.courseId);
  const tutor = db.users.find(u => u.id === course?.tutorId);
  return Response.json({
    valid: !cert.revoked, revoked: !!cert.revoked, code: cert.code, issuedAt: cert.issuedAt,
    studentName: student?.fullName, courseTitle: course?.title, tutorName: tutor?.fullName,
  });
}
