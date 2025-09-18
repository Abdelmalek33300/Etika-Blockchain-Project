import { useEffect, useState } from "react";

function Euro({ cents }) {
  if (cents == null) return <span></span>;
  const euros = (Number(cents) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span>{euros} €</span>;
}

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
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

  useEffect(() => { load(); }, []);

  const body = !data ? (
    <div>Chargement</div>
  ) : (
    (() => {
      const { counters, best_bids } = data;
      return (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Compteurs</h2>
            <div>Seuil de lancement: {counters.threshold.toLocaleString("fr-FR")}</div>
            <div>Total badges: {counters.total_badges.toLocaleString("fr-FR")}</div>
            <div>Avancement: {counters.percent}%</div>
            <h3>Par secteur (vérifiés)</h3>
            <ul>
              {Object.entries(counters.per_sector).map(([sector, n]) => (
                <li key={sector}>
                  <strong>{sector}</strong>: {n}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Meilleures offres (enchères actives)</h2>
            <table cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th align="left">Titre</th>
                  <th align="left">Secteur</th>
                  <th align="right">Nb d'offres</th>
                  <th align="right">Meilleure offre</th>
                  <th align="left">ID</th>
                </tr>
              </thead>
              <tbody>
                {best_bids.map(a => (
                  <tr key={a.id} style={{ borderTop: "1px solid #ddd" }}>
                    <td>{a.title}</td>
                    <td>{a.sector}</td>
                    <td align="right">{a.bids}</td>
                    <td align="right"><Euro cents={a.top_amount_cents} /></td>
                    <td style={{ fontFamily: "monospace" }}>{a.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      );
    })()
  );

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 24 }}>
      <h1>Étika  Public Dashboard</h1>
      <div style={{ marginBottom: 16 }}>
        <button onClick={load} disabled={loading} style={{ padding: "8px 12px", cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Rafraîchissement..." : "Rafraîchir"}
        </button>
        {err ? <span style={{ color: "crimson", marginLeft: 12 }}>Erreur: {err}</span> : null}
      </div>
      {body}
    </div>
  );
}
