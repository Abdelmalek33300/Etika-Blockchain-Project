import React from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * NavBar Étika — 14/10/2025
 * - Items: Notre projet / Discussion / Enchères (sans "Apprendre")
 * - Titre "Étika" avec style validé: Orbitron, uppercase, tracking, dégradé bleu→noir + barre d’accent
 * - Barre sticky, sobre, cohérente avec la charte
 */

const NAV_ITEMS = [
  { to: "/", label: "Notre projet" },
  { to: "/discussion", label: "Discussion" },
  { to: "/auctions", label: "Enchères" },
];

export default function NavBar() {
  const location = useLocation();

  const isActive = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <nav
        aria-label="Navigation principale Étika"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
        }}
      >
        {/* Logo / Marque avec style validé */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span
              style={{
                fontFamily: "Orbitron, system-ui, sans-serif",
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: 1,
                textTransform: "uppercase",
                // Dégradé bleu → noir appliqué au texte
                background: "linear-gradient(90deg, #0b61ff 0%, #0f172a 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                userSelect: "none",
              }}
            >
              Étika
            </span>
            {/* Barre d’accent sous le titre */}
            <span
              aria-hidden="true"
              style={{
                display: "block",
                height: 3,
                width: 46,
                borderRadius: 3,
                background: "#0b61ff",
                marginTop: 4,
              }}
            />
          </div>
        </div>

        {/* Liens centraux */}
        <ul
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  style={{
                    fontFamily: "Orbitron, system-ui, sans-serif",
                    fontSize: 14,
                    textDecoration: "none",
                    color: active ? "#0b61ff" : "#0f172a",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: active ? "1px solid #0b61ff" : "1px solid transparent",
                    transition: "all .15s ease",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Espace droit réservé (CTA ailleurs si besoin) */}
        <div style={{ width: 90 }} />
      </nav>
    </header>
  );
}
