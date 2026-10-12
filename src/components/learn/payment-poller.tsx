"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the payment status from the server every few seconds while it is pending. */
export function PaymentPoller({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, router]);
  return null;
}
