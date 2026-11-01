import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght-italic.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./globals.css";
import Splash from "@/components/Splash";
import SmoothScroll from "@/components/SmoothScroll";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Elimu Bora",
  title: { default: "Elimu Bora — Learn Beyond Limits", template: "%s | Elimu Bora" },
  description: "Elimu Bora is Kenya's premium learning platform. Free and premium courses from verified tutors, real progress tracking and verifiable certificates.",
  icons: {
    icon: "/brand/elimu-bora-mark.png",
    apple: "/brand/elimu-bora-logo.png",
  },
  openGraph: {
    title: "Elimu Bora — Learn Beyond Limits",
    description: "Free and premium courses from verified tutors, with real progress tracking and verifiable certificates.",
    siteName: "Elimu Bora",
    images: [{ url: "/brand/elimu-bora-logo.png", width: 1024, height: 1024, alt: "Elimu Bora — Learn Beyond Limits" }],
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Splash />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
