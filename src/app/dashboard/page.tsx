import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { homeForRole } from "@/server/permissions";

/** Sends each signed-in user to the dashboard for their role. */
export default async function DashboardRedirect() {
  const actor = await requireActor("/dashboard");
  redirect(homeForRole(actor.role));
}
