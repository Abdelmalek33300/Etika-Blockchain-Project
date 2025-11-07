import React from "react";

/**
 * HowItWorks.jsx — Page "En savoir plus / Comment ça marche"
 * Version stable, sans dépendances externes.
 */
export default function HowItWorks() {
  const container = { maxWidth: 1040, margin: "0 auto", padding: "24px 20px 40px" };
  const h1 = { color: "#0078D4", fontSize: 32, margin: "0 0 12px 0", lineHeight: 1.2 };
  const h2 = { color: "#0078D4", fontSize: 22, margin: "22px 0 10px 0", lineHeight: 1.25 };
  const p  = { textAlign: "justify", fontSize: 16, lineHeight: 1.65, margin: "10px 0" };
  const callout = { background: "#f3f8fe", border: "1px solid #d5e9fd", borderRadius: 12, padding: "14px 16px", marginTop: 12 };

  return (
    <main style={container}>
      <h1 style={h1}>Comment ça marche</h1>

      <section>
        <p style={{ ...p, fontWeight: 600 }}>
          Ça commence par des enchères communautaires d’un genre nouveau.
        </p>
        <p style={p}>
          À l’inscription, chaque consommateur reçoit gratuitement un <strong>badge pré-token</strong>.
          Lors des enchères, ce pré-token devient un <strong>Token Étika</strong> — un jeton numérique
          cédé <em>collectivement</em> aux futurs sponsors, secteur par secteur (banque, assurance,
          énergie, télécoms, VOD, etc.).
        </p>
        <p style={p}>
          Les entreprises candidates enchérissent pour devenir <strong>sponsors officiels</strong>.
          Les mises alimentent une <strong>caisse commune</strong> qui finance les avantages des
          consommateurs engagés chez les partenaires, et prépare la phase 2.
        </p>
      </section>

      <section>
        <h2 style={h2}>Rôles et flux</h2>
        <div style={callout}>
          <p style={p}>
            <strong>Consommateurs</strong> : s’inscrivent, reçoivent un badge pré-token, participent à la mise en visibilité de leur fidélité future (NFT/Token).<br />
            <strong>Entreprises candidates</strong> : enchérissent par secteur pour devenir sponsors officiels et accéder à une audience engagée.<br />
            <strong>Caisse commune</strong> : reçoit les mises et redistribue selon des règles claires (avantages, remboursements aux sponsors lors des achats chez partenaires, etc.).
          </p>
        </div>
      </section>

      <section>
        <h2 style={h2}>Étapes clés (Phase 1)</h2>
        <ol style={{ marginLeft: 18 }}>
          <li><p style={p}>Inscription → attribution d’un badge pré-token (gratuit).</p></li>
          <li><p style={p}>Ouverture des enchères par secteur → candidatures des entreprises.</p></li>
          <li><p style={p}>Sélection des sponsors officiels → constitution de la caisse commune.</p></li>
          <li><p style={p}>Activation côté consommateur → avantages chez les partenaires.</p></li>
        </ol>
      </section>

      <section>
        <h2 style={h2}>Cap sur la Phase 2</h2>
        <p style={p}>
          Si la Phase 1 est concluante, Étika évolue vers un <strong>fonds de consommateurs</strong> et une <strong>blockchain</strong> dédiée (Proof of Purchase),
          pour relier <em>consommation</em>, <em>épargne</em> et <em>investissement</em> en circuit court, avec sécurité et simplicité (mobile-first).
        </p>
      </section>
    </main>
  );
}
