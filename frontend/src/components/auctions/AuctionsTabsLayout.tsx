import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
  { to: "/auctions", label: "Accueil", exact: true },
  { to: "/auctions/energie", label: "Énergie" },
  { to: "/auctions/banque", label: "Banque" },
  { to: "/auctions/telephonie", label: "Téléphonie" },
  { to: "/auctions/assurance", label: "Assurance" },
  { to: "/auctions/telecoms", label: "Télécoms" },
  { to: "/auctions/vod", label: "Vidéo à la demande" },
];

export default function AuctionsTabsLayout() {
  const loc = useLocation();

  return (
    <div style={{ padding: "12px 0" }}>
      <h2 style={{ margin: "0 0 12px" }}>Enchères</h2>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => {
          const isActive =
            t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              style={{
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: isActive ? "#10b981" : "white",
                color: isActive ? "white" : "#111827",
                fontWeight: 500,
              }}
              end={t.exact}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Contenu de l’onglet */}
      <div style={{ minHeight: 120 }}>
        <Outlet />
      </div>
    </div>
  );
}
