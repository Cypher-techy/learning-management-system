"use client";
import { useEffect, useState, useCallback } from "react";

export type ApiOptions = RequestInit & { timeoutMs?: number };

export async function api(url: string, options: ApiOptions = {}) {
  const { timeoutMs = 30000, signal, headers, ...rest } = options;
  const controller = !signal && timeoutMs > 0 ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { "Content-Type": "application/json", ...(headers as Record<string, string> | undefined) },
      signal: signal || controller?.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (error) {
    if (controller && error instanceof Error && error.name === "AbortError") {
      throw new Error("The request took too long. Please try again.");
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export function useApi<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try { setData(await api(url)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}
export const kes = (n: number) => "KSh " + Math.round(n).toLocaleString("en-KE");
export const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDur = (min: number) => min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
export const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
