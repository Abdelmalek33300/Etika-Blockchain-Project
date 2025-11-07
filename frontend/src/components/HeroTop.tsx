import React from "react";
import IntroCaddy from "../assets/images/intro-caddy.png";

/**
 * HeroTop — image à DROITE en desktop, côte-à-côte
 * - Grid: 1 colonne (mobile) → 2 colonnes (md+)
 * - Texte colonne gauche, image colonne droite
 * - Pas d'overflow-hidden pour éviter le rognage
 * - Dimension stable pilotée par la largeur (clamp)
 */

const HeroTop: React.FC = () => {
  return (
    <section id="hero-top" className="relative bg-white">
      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 py-10 md:py-16">
        {/* ✅ 2 colonnes en desktop, items centrés verticalement */}
        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-12">
          {/* TEXTE — gauche (md: col 1) */}
          <div className="order-2 md:order-1">
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900">
              Le projet <span className="text-[#0b61ff]">Étika</span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-slate-600">
              Bâtissons le premier fonds de consommateurs engagés.
            </p>
          </div>

          {/* IMAGE — droite (md: col 2) */}
          <div className="order-1 md:order-2 md:flex md:justify-end">
            <img
              src={IntroCaddy}
              alt="Hero — caddie Étika"
              className="block mx-auto md:ml-auto"
              style={{
                // largeur pilotée (jamais minuscule ni immense)
                width: "clamp(340px, 34vw, 620px)",
                maxWidth: "100%",
                height: "auto",
                objectFit: "contain",
                objectPosition: "right center",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroTop;
