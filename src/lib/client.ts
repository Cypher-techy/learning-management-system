"use client";
import { useEffect, useState, useCallback } from "react";

export async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
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
