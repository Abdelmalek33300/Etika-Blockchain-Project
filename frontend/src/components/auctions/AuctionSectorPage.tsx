import React from "react";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

type Auction = {
  id: string | number;
  sector?: string;
  candidate?: string;
  bid?: number;
};

export default function AuctionSectorPage() {
  const { sectorSlug = "" } = useParams();
  const [data, setData] = useState<Auction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setData(null);

        const res = await fetch("/api/auctions", { credentials: "include" });
        const ct = res.headers.get("content-type") || "";

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error("Réponse non-JSON: " + text.slice(0, 120));
        }

        const json = await res.json();
        const list: Auction[] = Array.isArray(json) ? json : json?.data ?? [];
        if (!Array.isArray(list)) throw new Error("Format invalide");

        const filtered = list.filter(
          (a) => (a.sector || "").toLowerCase() === sectorSlug.toLowerCase()
        );

        if (!cancelled) setData(filtered);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erreur inconnue");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sectorSlug]);

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          border: "1px solid #fecaca",
          background: "#fee2e2",
          color: "#991b1b",
          borderRadius: 8,
        }}
      >
        Erreur : {error}
      </div>
    );
  }

  if (!data) return <div style={{ color: "#6b7280" }}>Chargement…</div>;
  if (data.length === 0)
    return <div>Aucune enchère pour « {sectorSlug} » pour le moment.</div>;

  return (
    <ul style={{ paddingLeft: 18 }}>
      {data.map((a) => (
        <li key={a.id}>
          <strong>{a.candidate ?? "-"}</strong> —{" "}
          {typeof a.bid === "number" ? `${a.bid.toLocaleString()} €` : "-"}
        </li>
      ))}
    </ul>
  );
}

