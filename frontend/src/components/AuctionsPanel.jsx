// frontend/src/components/AuctionsPanel.jsx
import { useEffect, useState } from "react";

function fmtCentsToEUR(cents) {
  if (cents === null || cents === undefined) return "—";
  const euros = Number(cents) / 100;
  return euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function sectorLabel(k) {
  const map = {
    electricity: "Électricité",
    gas: "Gaz",
    bank: "Banque",
    insurance: "Assurance",
    mutual: "Mutuelle",
    payment_card: "Carte de paiement",
    mobile: "Téléphonie mobile",
    telecom: "Télécom",
    box_internet: "Box internet",
    search_engine: "Moteur de recherche",
    vod: "VOD",
  };
  if (k === "Télécom") return "Télécom"; // tolère données déjà libellées FR
  return map[k] || k;
}

// Normalisation pour comparaisons (minuscule, sans accents)
function normalize(s) {
  return String(s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Retire "EVT-<num> " en tête de titre
function stripEvtPrefix(s) {
  return String(s || "").replace(/^\s*EVT[-\s]?\d+\s*/i, "").trim();
}

// Détecte si le titre contient déjà le libellé du secteur (pour éviter redondance)
function titleContainsSector(title, sectorKey) {
  const label = sectorLabel(sectorKey);
  const nTitle = normalize(title);
  const nLabel = normalize(label);
  if (!nTitle || !nLabel) return false;

  const aliases = new Set([nLabel]);
  if (nLabel === "electricite") aliases.add("energie"); // compat anciens titres "Énergie"
  if (nLabel === "telecom") aliases.add("telecommunications");

  for (const a of aliases) {
    if (a && nTitle.includes(a)) return true;
  }
  return false;
}

function SectorPill({ k }) {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #e6e6e6",
        fontSize: 12,
        background: "#fafafa",
        whiteSpace: "nowrap",
      }}
      title={k}
    >
      {sectorLabel(k)}
    </span>
  );
}

export default function AuctionsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/public/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="card">Chargement des enchères…</div>;
  if (err) return <div className="card">Erreur: {err}</div>;

  const best = data?.best_bids || [];
  if (!best.length)
    return (
      <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <h2 style={{ margin: 0, marginBottom: 8 }}>🏷️ Enchères</h2>
        <p style={{ marginTop: 0 }}>Aucune enchère pour le moment.</p>
        <button onClick={load} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
          Rafraîchir
        </button>
      </div>
    );

  return (
    <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>🏷️ Enchères — meilleurs bids</h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee" }}>Titre</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #eee" }}># bids</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #eee" }}>Meilleure offre</th>
            </tr>
          </thead>
          <tbody>
            {best.map((a) => {
              const baseTitle = stripEvtPrefix(a.title || "");
              const displayTitle = baseTitle || sectorLabel(a.sector);
              const showBadge = a.sector && !titleContainsSector(displayTitle, a.sector);

              return (
                <tr key={a.id}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span>{displayTitle}</span>
                      {showBadge ? <SectorPill k={a.sector} /> : null}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #f0f0f0" }}>
                    {a.bids ?? 0}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      borderBottom: "1px solid #f0f0f0",
                      fontWeight: 600,
                    }}
                  >
                    {fmtCentsToEUR(a.top_amount_cents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button onClick={load} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
        Rafraîchir
      </button>
    </div>
  );
}
