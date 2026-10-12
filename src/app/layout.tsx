import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { getPlatform } from "@/server/queries/context";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Every page depends on the signed-in user and on live platform settings.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const platform = await getPlatform();
  return {
    title: { default: platform.platformName, template: `%s | ${platform.platformName}` },
    description: platform.platformDescription,
    icons: platform.logoFileId ? { icon: `/api/files/${platform.logoFileId}` } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const platform = await getPlatform();
  return (
    <html
      lang="en"
      data-brand={platform.theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
