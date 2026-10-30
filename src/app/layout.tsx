import type { Metadata } from "next";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Splash />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
