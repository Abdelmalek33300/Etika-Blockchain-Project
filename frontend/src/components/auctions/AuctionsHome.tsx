import React from "react";
import { useEffect, useState } from "react";

type Auction = {
  id: string | number;
  sector?: string;
  candidate?: string;
  bid?: number;
};

export default function AuctionsHome() {
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
        // backend renvoie soit un tableau, soit {ok,data:[...]}
        const list: Auction[] = Array.isArray(json) ? json : json?.data ?? [];
        if (!Array.isArray(list)) throw new Error("Format invalide");

        if (!cancelled) setData(list);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erreur inconnue");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!data) {
    return <div style={{ color: "#6b7280" }}>Chargement…</div>;
  }

  if (data.length === 0) {
    return <div>Aucune enchère pour le moment.</div>;
  }

  return (
    <div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #e5e7eb",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={th}>ID</th>
            <th style={th}>Secteur</th>
            <th style={th}>Candidat</th>
            <th style={th}>Offre</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={td}>{String(a.id)}</td>
              <td style={td}>{a.sector ?? "-"}</td>
              <td style={td}>{a.candidate ?? "-"}</td>
              <td style={td}>
                {typeof a.bid === "number" ? `${a.bid.toLocaleString()} €` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 14,
  color: "#111827",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 14,
  color: "#111827",
};
