"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Shown when a page fails to render. Internal details are never displayed. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <TriangleAlert className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page could not be loaded. Please try again. If the problem continues, contact support
        {error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        {/* A full page load on purpose: it also resets any broken client state. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Go to the homepage
        </a>
      </div>
    </main>
  );
}
