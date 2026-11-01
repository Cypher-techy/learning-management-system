import { audit, getDB, notify, persist } from "@/lib/db";
import { currentUser, jsonError, ApiError } from "@/lib/auth";
import { canSetCoursePrice, validateCoursePriceKES } from "@/lib/pricing";
import { serializeCourse } from "@/lib/serialize";

/** Pricing authority is intentionally narrow: the course's own verified
 *  tutor or the owner/super admin, and only before publication. Regular
 *  administrators may moderate the content but cannot change its price. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await currentUser();
    if (!user) throw new ApiError(401, "Please sign in.");
    const db = await getDB();
    const course = db.courses.find((c) => c.id === id || c.slug === id);
    if (!course) throw new ApiError(404, "Course not found.");

    const authority = canSetCoursePrice({ actorId: user.id, actorRole: user.role, course });
    if (!authority.ok) {
      const locked = course.status === "published" && (user.role === "owner" || (user.role === "tutor" && course.tutorId === user.id));
      throw new ApiError(locked ? 400 : 403, authority.error || "Only the course tutor or super admin can set this course's price before publication.");
    }
    if (user.role === "tutor" && user.status !== "verified") {
      throw new ApiError(403, "Unverified tutors cannot price or publish courses.");
    }

    const body = await req.json().catch(() => ({}));
    const nextAccess = body?.access === undefined ? course.access : body.access;
    if (nextAccess !== "free" && nextAccess !== "premium") {
      throw new ApiError(400, "Course access must be free or premium.");
    }

    let nextPriceKES = 0;
    if (nextAccess === "premium") {
      const validation = validateCoursePriceKES(body?.priceKES ?? course.priceKES);
      if (!validation.ok) throw new ApiError(400, validation.error || "Enter a whole-shilling course price between KSh 350 and KSh 500.");
      nextPriceKES = validation.priceKES;
    }

    const previous = { access: course.access, priceKES: course.priceKES || 0 };
    course.access = nextAccess;
    course.priceKES = nextPriceKES;

    audit(
      user.id,
      "course.pricing_updated",
      course.id,
      `${previous.access}/KSh ${previous.priceKES} -> ${course.access}/KSh ${course.priceKES}; status ${course.status}`,
    );
    if (user.role === "owner" && course.tutorId !== user.id) {
      notify(
        course.tutorId,
        "Course pricing updated",
        `The super admin set "${course.title}" to ${course.access === "premium" ? `KSh ${course.priceKES!.toLocaleString("en-KE")}` : "free"} before publication. Learners see the USD equivalent at the latest exchange rate.`,
        "/dashboard/tutor/courses",
      );
    }

    await persist();
    return Response.json({ ok: true, course: serializeCourse(db, course, user) });
  } catch (e) { return jsonError(e); }
}
