import type { Metadata } from "next";
import "./globals.css";
import Splash from "@/components/Splash";
import SmoothScroll from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: { default: "EDVORA — Learn Beyond Limits", template: "%s | EDVORA" },
  description: "EDVORA is Kenya's premium learning platform. Free and premium courses from verified instructors, real progress tracking and verifiable certificates.",
  icons: { icon: "/brand/edvora-logo.png" },
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
