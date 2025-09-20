// frontend/src/components/AuctionsPanel.jsx
import { useEffect, useRef, useState } from "react";

const DEFAULT_AUCTION_ID = "19c40454-2302-4d63-8ad4-a923417b511c"; // electricity

function formatAmount(cents) {
  const n = Number(cents ?? 0);
  return (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à linstant";
  if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
  return new Date(iso).toLocaleString("fr-FR");
}

export default function AuctionsPanel() {
  const [draftId, setDraftId] = useState(() => localStorage.getItem("auctionId") || DEFAULT_AUCTION_ID);
  const [auctionId, setAuctionId] = useState(() => localStorage.getItem("auctionId") || DEFAULT_AUCTION_ID);
  const [state, setState] = useState({ loading: true, error: null, bids: [], at: null });
  const pollRef = useRef(null);

  async function fetchBids(signal) {
    if (!auctionId) return;
    try {
      const res = await fetch(`/api/public/auctions/${encodeURIComponent(auctionId)}/bids`, { cache: "no-store", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState({ loading: false, error: null, bids: Array.isArray(json) ? json : [], at: new Date().toISOString() });
    } catch (e) {
      if (signal?.aborted) return;
      setState({ loading: false, error: e?.message || String(e), bids: [], at: new Date().toISOString() });
    }
  }

  // (Re)fetch + polling quand auctionId change
  useEffect(() => {
    localStorage.setItem("auctionId", auctionId || "");
    setState(s => ({ ...s, loading: true, error: null }));
    const ctrl = new AbortController();
    fetchBids(ctrl.signal);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchBids(ctrl.signal), 10_000);
    return () => { ctrl.abort(); clearInterval(pollRef.current); };
  }, [auctionId]);

  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Enchères  compétiteurs</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {state.at ? `MAJ ${timeAgo(state.at)}` : "Chargement"}
        </div>
      </header>

      {/* Contrôles */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label htmlFor="auctionId" style={{ fontSize: 12, color: "#374151" }}>Auction UUID :</label>
        <input
          id="auctionId"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setAuctionId(draftId.trim()); }}
          style={{ flex: "1 1 420px", minWidth: 280, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "inherit" }}
          placeholder={DEFAULT_AUCTION_ID}
        />
        <button
          onClick={() => setAuctionId(draftId.trim())}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#111827", color: "#fff", cursor: "pointer" }}
          title="Appliquer lUUID"
        >
          Appliquer
        </button>
        <button
          onClick={() => fetchBids()}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f3f4f6", cursor: "pointer" }}
          title="Rafraîchir maintenant"
        >
          Rafraîchir
        </button>
      </div>

      {/* Contenu */}
      {state.error && (
        <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>
          Erreur : {state.error}
        </div>
      )}

      {state.loading ? (
        <div style={{ padding: "12px 0", color: "#6b7280", fontSize: 14 }}>Chargement</div>
      ) : state.bids.length === 0 ? (
        <div style={{ padding: "12px 0", color: "#6b7280", fontSize: 14 }}>
          Aucun compétiteur pour le moment.
        </div>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {state.bids.map((b, idx) => (
            <li key={b.id} style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              display: "grid",
              gridTemplateColumns: "56px 1fr auto",
              alignItems: "center",
              gap: 12,
              background: idx === 0 ? "#f9fafb" : "#fff"
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, display: "grid", placeItems: "center",
                background: idx === 0 ? "#111827" : "#f3f4f6", color: idx === 0 ? "#fff" : "#111827",
                fontWeight: 700
              }}>
                {idx + 1}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {b.bidder || ""}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {new Date(b.createdAt).toLocaleString("fr-FR")}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {formatAmount(b.amountCents)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
