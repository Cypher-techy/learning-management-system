import { courseLessons, courseDurationMin, canAccessCourse, type Course } from "./db";

export function serializeCourse(db: any, c: Course, user: any) {
  const instructor = db.users.find((u: any) => u.id === c.instructorId);
  const reviews = db.reviews.filter((r: any) => r.courseId === c.id);
  const unlocked = canAccessCourse(db, user, c);
  return {
    ...c,
    instructorName: instructor?.fullName || "EDVORA Instructor",
    instructorTitle: instructor?.title || "", instructorColor: instructor?.avatarColor || "#2563eb",
    lessonCount: courseLessons(c).length, durationMin: courseDurationMin(c),
    enrolledCount: db.enrollments.filter((e: any) => e.courseId === c.id).length,
    rating: reviews.length ? reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length : null,
    reviewCount: reviews.length, unlocked,
    sections: c.sections.map(s => ({ ...s, lessons: s.lessons.map(l => unlocked || l.isPreview ? l : { ...l, videoUrl: undefined, resourceUrl: undefined, body: "" }) })),
  };
}
