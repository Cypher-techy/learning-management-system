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
export const usd = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2,
}).format(n);
export const usdPrice = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(n);
let usdKesRatePromise: Promise<any> | null = null;
let usdKesRateExpiresAt = 0;
export function useUsdKesRate() {
  const [fx, setFx] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!usdKesRatePromise || Date.now() >= usdKesRateExpiresAt) {
      usdKesRateExpiresAt = Date.now() + 5 * 60 * 1000;
      usdKesRatePromise = api("/api/pricing/fx").catch((e) => { usdKesRatePromise = null; usdKesRateExpiresAt = 0; throw e; });
    }
    usdKesRatePromise
      .then((data) => { if (alive) setFx(data.fx || null); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Live USD conversion unavailable"); });
    return () => { alive = false; };
  }, []);
  return { fx, rate: Number(fx?.rate) || 0, loading: !fx && !error, error };
}
export const kesToUsd = (amountKES: number, rate: number) => rate > 0 ? amountKES / rate : 0;
export const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDur = (min: number) => min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
export const initials = (name = "") => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
