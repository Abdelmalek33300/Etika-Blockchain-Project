import { useEffect, useState } from "react";

export default function BadgesPanel() {
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

  if (loading) return <div className="card">Chargement des badges…</div>;
  if (err) return <div className="card">Erreur: {err}</div>;
  if (!data?.counters) return <div className="card">Aucune donnée</div>;

  const { total_badges, per_sector = {} } = data.counters;

  return (
    <div className="card" style={{ padding: 16, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>🎖️ Badges</h2>
      <p style={{ marginTop: 0 }}>
        Total vérifiés : <strong>{total_badges}</strong>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {Object.entries(per_sector).map(([sector, count]) => (
          <div key={sector} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{sector}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{count}</div>
          </div>
        ))}
      </div>
      <button onClick={load} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd" }}>
        Rafraîchir
      </button>
    </div>
  );
}
