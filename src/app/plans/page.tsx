import { redirect } from "next/navigation";

/** Legacy pricing URL retained for bookmarks; per-course pricing is canonical at /pricing. */
export default function LegacyPlansPage() {
  redirect("/pricing");
}
