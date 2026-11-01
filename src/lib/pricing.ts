import {
  COURSE_PRICE_MAX_KES,
  COURSE_PRICE_MIN_KES,
  coursePriceKES,
  isValidCoursePriceKES,
  type Course,
} from "./db";

export { COURSE_PRICE_MAX_KES, COURSE_PRICE_MIN_KES };

export interface CoursePriceValidation {
  ok: boolean;
  priceKES: number;
  error?: string;
}

/**
 * Course prices are canonical in whole Kenyan shillings because M-Pesa is
 * the settlement rail. USD is a display conversion only, calculated from
 * the latest server-fetched USD/KES rate at viewing/checkout time.
 */
export function validateCoursePriceKES(value: unknown): CoursePriceValidation {
  const priceKES = Number(value);
  if (!Number.isInteger(priceKES)) {
    return { ok: false, priceKES: 0, error: "Enter the course price as a whole number of Kenyan shillings." };
  }
  if (!isValidCoursePriceKES(priceKES)) {
    return {
      ok: false,
      priceKES,
      error: `Premium course prices must currently be between KSh ${COURSE_PRICE_MIN_KES} and KSh ${COURSE_PRICE_MAX_KES}.`,
    };
  }
  return { ok: true, priceKES };
}

export function coursePricing(course: Course) {
  return {
    access: course.access,
    priceKES: coursePriceKES(course),
    transactionCurrency: "KES" as const,
    displayCurrency: "USD" as const,
    priceBandKES: { min: COURSE_PRICE_MIN_KES, max: COURSE_PRICE_MAX_KES },
  };
}

export function canSetCoursePrice(args: {
  actorId: string;
  actorRole: string;
  course: Pick<Course, "tutorId" | "status">;
}): { ok: boolean; error?: string } {
  const isOwningTutor = args.actorRole === "tutor" && args.course.tutorId === args.actorId;
  const isSuperAdmin = args.actorRole === "owner";
  if (!isOwningTutor && !isSuperAdmin) {
    return { ok: false, error: "Only the course tutor or the super admin can decide this course's price." };
  }
  if (args.course.status === "published") {
    return { ok: false, error: "Course pricing is locked while the course is published. Unpublish it before changing the price for a future publication." };
  }
  return { ok: true };
}
