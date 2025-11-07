import type { OverviewResponse } from "@/types/public";

function abortableFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

export async function getOverview(): Promise<OverviewResponse> {
  const res = await abortableFetch("/api/public/overview", {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET /api/public/overview ${res.status} ${res.statusText} ${text}`);
  }
  const data = (await res.json()) as OverviewResponse;

  // Sécurise percent si non fourni
  if ((!data.seuil.percent || Number.isNaN(data.seuil.percent)) && data.kpi?.participants_total != null && data.seuil?.target) {
    const pct = (data.kpi.participants_total / data.seuil.target) * 100;
    data.seuil.percent = Math.max(0, Math.min(100, Number(pct.toFixed(2))));
  }
  return data;
}
