// frontend/src/App.jsx
import { useEffect, useState } from "react";
import BadgesPanel from "./components/BadgesPanel.jsx";
import AuctionsPanel from "./components/AuctionsPanel.jsx";

/**
 * App.jsx — dashboard public Étika
 * - Carte Badges (compteurs par secteur)
 * - Carte Enchères (meilleurs bids)
 */

export default function App() {
  const [boot, setBoot] = useState({ ok: false, error: null });

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch("/api/public/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!abort) setBoot({ ok: true, error: null, data: json });
      } catch (e) {
        if (!abort) setBoot({ ok: false, error: e.message || String(e) });
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Étika — Dashboard public</h1>
        <div style={{ color: "#666", fontSize: 13 }}>
          Backend: <code>https://localhost:4443</code> — Frontend: <code>http://localhost:5173</code>
        </div>
        {!boot.ok && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#a00" }}>
            {boot.error ? `Chargement initial: ${boot.error}` : "Chargement initial..."}
          </div>
        )}
      </header>

      {/* Cartes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <BadgesPanel />
        <AuctionsPanel />
      </div>

      <section style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
        <em>Astuce :</em> on ajoutera d’autres cartes (ex. détails d’une enchère) au fil de l’eau.
      </section>
    </div>
  );
}
