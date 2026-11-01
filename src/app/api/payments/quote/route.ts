import { canAccessCourse, getDB, isValidCoursePriceKES } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { quoteCourse } from "@/lib/fx";

export const dynamic = "force-dynamic";

/** Student-only live quote for one independently priced course. This never
 *  starts a transaction; the STK route independently derives and stores
 *  the same server-side KES amount from the course record. */
export async function GET(req: Request) {
  try {
    const user = await requireRole("student");
    const courseId = new URL(req.url).searchParams.get("courseId") || "";
    if (!courseId) throw new ApiError(400, "Choose a premium course to buy. Elimu Bora no longer sells monthly or annual all-access subscriptions.");

    const db = await getDB();
    const course = db.courses.find((c) => c.id === courseId || c.slug === courseId);
    if (!course || course.status !== "published") throw new ApiError(404, "Course not found.");
    if (course.access !== "premium") throw new ApiError(400, "This is a free course — enrol without payment.");
    if (!isValidCoursePriceKES(course.priceKES)) throw new ApiError(503, "This course's price has not been configured for sale yet. No payment has been started.");
    if (canAccessCourse(db, user, course)) {
      return Response.json({
        error: "You already have access to this course.",
        alreadyAccessible: true,
        courseId: course.id,
      }, { status: 409 });
    }

    try {
      const quote = await quoteCourse(course);
      return Response.json({ quote });
    } catch (error) {
      console.error("Elimu Bora: live USD/KES course quote failed.", error);
      throw new ApiError(503, "The live USD/KES exchange rate is temporarily unavailable. Please try again shortly; no payment has been started.");
    }
  } catch (e) { return jsonError(e); }
}
