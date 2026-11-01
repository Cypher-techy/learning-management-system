import { redirect } from "next/navigation";

/** Legacy bookmark/notification route. Course purchases now live at the
 *  canonical Purchases & Payments URL; preserve any selected-course query. */
export default async function LegacySubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(`/dashboard/student/purchases${suffix ? `?${suffix}` : ""}`);
}
