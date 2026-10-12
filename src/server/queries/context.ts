import "server-only";
import { cache } from "react";
import { env } from "@/lib/env";
import { getSettings } from "../services/settings";

/** Platform settings, read once per request. */
export const getPlatform = cache(async () => {
  const settings = await getSettings();
  // The admin setting wins; the environment variable is the fallback. When
  // neither is set the footer shows the attribution without a link.
  const cgsWebsiteUrl = settings.cgsWebsiteUrl || env().CGS_WEBSITE_URL || null;
  return { ...settings, cgsWebsiteUrl };
});

export type Platform = Awaited<ReturnType<typeof getPlatform>>;
