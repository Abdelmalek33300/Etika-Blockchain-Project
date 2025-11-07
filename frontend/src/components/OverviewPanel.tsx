// src/components/OverviewPanel.tsx
import React from "react";

const DOCS_BASE = "http://localhost:4100";
const REGISTER_BASE =
  typeof window !== "undefined" ? window.location.origin : "";

// Images
import IntroCaddy from "../assets/images/intro-caddy.png";
import Activer from "../assets/images/activer.png";        // Pilier 1 (affichée à 50%)
import Blockchain from "../assets/images/blockchain.png";  // Pilier 2
import Dna from "../assets/images/dna.png";                // Pilier 3
import Strategie from "../assets/images/strategie.png";    // Conclusion
import Avenir from "../assets/images/avenir.png";          // CTA final

const OverviewPanel: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <div id="overview-page" className="page-wrap">
      {/* ===== NAVBAR ===== */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="/">Étika</a>

          <button
            className={`burger ${open ? "is-open" : ""}`}
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="main-menu"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav id="main-menu" className={`menu ${open ? "menu-open" : ""}`}>
            <a href="/overview" onClick={() => setOpen(false)}>Accueil</a>
            <a href="/auctions" onClick={() => setOpen(false)}>Enchères</a>
            <a href="/about" onClick={() => setOpen(false)}>À propos</a>
            <a href="/contact" onClick={() => setOpen(false)}>Contact</a>
            <a
              href="https://community.example.com"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              Communauté
            </a>
          </nav>
        </div>
      </header>

      <main className="ovw-container">
        {/* ===== HERO ===== */}
        <section className="ovw-hero">
          
          <h1 className="ovw-hero-title with-blue-underline">
            Le projet <span className="ovw-hero-brand">Étika</span>
          </h1>
          <p className="ovw-hero-sub">Bâtissons le premier Fonds de consommateurs engagés.</p>
          <p className="ovw-hero-tagline ovw-hero-tagline--blue">
            Pour que vos emplettes financent votre retraite.
          </p>

          <div className="ovw-hero-media">
            <img
              src={IntroCaddy}
              alt="Hero Étika — caddie"
              className="ovw-hero-img"
              loading="eager"
              decoding="async"
            />
          </div>

          <div className="ovw-hero-spacer" aria-hidden="true" />
        </section>

        {/* ===== 3 PILIERS ===== */}
        <div className="ovw-stream">
          {/* PILIER 1 — Modèle Éco (texte / image) */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Notre Modèle Économique</h2>
              <h3 className="ovw-subtitle">Je consomme, donc j’épargne.</h3>

              <p className="ovw-justify">
                Notre modèle repose sur la désintermédiation intégrale de la chaîne financière.
                Dès l’inscription, vous recevez des jetons que vous échangez contre une participation dans le Fonds.
              </p>
              <p className="ovw-justify">
                Chacun de vos achats auprès de nos partenaires génère de nouveaux jetons, directement convertis
                en épargne pour votre retraite et vos projets.
              </p>
              <p className="ovw-justify">
                Cette valeur, collectée en temps réel, est réinjectée et investie de façon sélective
                pour renforcer l’économie locale et auto-alimenter le système.
              </p>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${DOCS_BASE}/learn/model/`}>En savoir plus</a>
              </div>
            </div>

            <div className="ovw-col ovw-col--media">
              <img
                className="ovw-media-img ovw-media-align ovw-media-img--half" /* 50% */
                src={Activer}
                alt="Notre modèle économique — illustration"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* PILIER 2 — Technologie (ALT : image à gauche, texte à droite) */}
          <section className="ovw-row ovw-row--alt">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">
                Technologie : l’algorithme qui nous libère des intermédiaires
              </h2>
              <h3 className="ovw-subtitle">La sécurité par le Proof of Purchase (PoP).</h3>

              <p className="ovw-justify">
                Grâce à notre algorithme (le <em>Code Automatique</em>) et à la blockchain,
                nous décentralisons et automatisons les fonctions financières (flux, transactions, valorisation).
              </p>
              <p className="ovw-justify">
                Cette automatisation permet de récupérer des marges habituellement captées par la finance traditionnelle
                pour les réinjecter dans le Fonds et votre épargne.
              </p>
              <p className="ovw-justify">
                Le cœur du système est le <em>Proof of Purchase</em> (PoP), un mécanisme de validation
                qui rend le registre auditable par tous et protège l’écosystème de la fraude et de la spéculation.
              </p>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${DOCS_BASE}/learn/tech/`}>En savoir plus</a>
              </div>
            </div>
            <div className="ovw-col ovw-col--media">
              <img
                className="ovw-media-img"
                src={Blockchain}
                alt="Technologie Étika — blockchain et transparence"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* PILIER 3 — Valeurs & Stratégie (image à droite) */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">
                Valeurs &amp; Stratégie : l’ADN anti-délocalisation
              </h2>

              <p className="ovw-justify" style={{ marginTop: 6 }}>
                Le Fonds repose sur une obligation structurelle : l’investissement doit sécuriser le revenu du consommateur
                pour garantir sa propre stabilité.
              </p>

              <p className="ovw-justify">
                Notre stratégie vise à devenir actionnaire majoritaire de partenaires clés afin d’assécher
                le canal des dividendes et dériver cette valeur vers la rémunération de la fidélité.
                Le Fonds appartient à ses membres.
              </p>
              <p className="ovw-justify">
                Il est contraint d’investir dans un écosystème local diversifié :
                pas d’épargne de consommateurs durable sans emploi local. L’engagement éthique vérifié
                devient le critère de la nouvelle compétitivité.
              </p>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${DOCS_BASE}/learn/values/`}>En savoir plus</a>
              </div>
            </div>
            <div className="ovw-col ovw-col--media">
              <img
                className="ovw-media-img"
                src={Dna}
                alt="Valeurs & stratégie — ADN anti-délocalisation"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* CONCLUSION — (ALT) */}
          <section className="ovw-row ovw-row--alt">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Conclusion et intérêt général</h2>

              <h3 className="ovw-subtitle">Impact au-delà de la communauté</h3>
              <p className="ovw-justify">
                La stratégie du Fonds Étika dépasse la seule communauté. En sécurisant la production et l’emploi local,
                elle favorise des recettes fiscales plus robustes et réduit la pression pour financer le modèle social par la dette.
              </p>

              <h3 className="ovw-subtitle" style={{ marginTop: 10 }}>Vision à terme et scalabilité</h3>
              <p className="ovw-justify">
                Le Fonds des Consommateurs et sa communauté ont vocation à se dupliquer à l’identique
                (logique de “division cellulaire”) pour former des ensembles autonomes et partenaires,
                assurant la diffusion globale du paradigme.
              </p>

              <h3 className="ovw-subtitle" style={{ marginTop: 10 }}>Transition environnementale</h3>
              <p className="ovw-justify">
                Les collectifs autonomes d’Étika pourront financer des projets écologiques d’envergure
                et soutenir financièrement les agriculteurs vers des pratiques moins polluantes.
              </p>
            </div>
            <div className="ovw-col ovw-col--media">
              <img
                className="ovw-media-img"
                src={Strategie}
                alt="Conclusion — stratégie et intérêt général"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* CTA FINAL */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Prêt à rejoindre le projet ?</h2>
              <p className="ovw-justify">Choisissez votre profil et mobilisez-vous :</p>
              <div className="ovw-cta-grid">
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/consumer`}>Consommateur</a>
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/business`}>Commerçant</a>
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/industrial`}>Industriel</a>
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/sponsor`}>Sponsor</a>
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/collectivites`}>Collectivités</a>
              </div>
            </div>
            <div className="ovw-col ovw-col--media">
              <img
                className="ovw-media-img"
                src={Avenir}
                alt="Mobilisons-nous — illustration"
                loading="lazy"
                decoding="async"
              />
            </div>
          </section>
        </div>
      </main>

      {/* ====== STYLES ====== */}
      <style>{`
        :root{
          --ink:#0f172a; --muted:#475569; --line:#e8eef6; --blue:#0b61ff; --bg:#ffffff;
          --radius:12px; --container:1080px;
          --fs-kicker:12px; --fs-sub:18px;
          --fs-h1-min:26px; --fs-h1-max:42px; --fs-h1-vw:4.5vw;
          --fs-h2-min:20px; --fs-h2-max:32px; --fs-h2-vw:2.8vw;
          --lh-body:1.55; --lh-title:1.15; --lh-h2:1.25;
          --space-xxs:6px; --space-xs:8px; --space-sm:10px; --space-md:16px; --space-lg:24px; --space-xl:36px; --space-2xl:48px;
          --shadow:0 6px 18px rgba(2,6,23,.04);
        }

        /* BASE */
        .page-wrap { background:#ffffff; color:var(--ink); }
        .ovw-container { max-width:var(--container); margin:0 auto; padding:24px 16px; }
        .ovw-justify { text-align:justify; }
        body{
          font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,sans-serif;
          -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
          font-kerning:normal; letter-spacing:normal; word-spacing:normal; line-height:var(--lh-body);
        }

        /* NAV */
        .nav {
          position: sticky; top: 0; z-index: 9999; background: #fff;
          border-bottom: 1px solid rgba(2,6,23,.08);
          box-shadow: 0 6px 20px rgba(2,6,23,.06);
        }
        .nav-inner {
          max-width:1180px; margin:0 auto; padding:10px 16px;
          display:flex; align-items:center; justify-content:space-between;
        }
        .brand { font-weight:800; text-decoration:none; font-size:20px; color:var(--ink); letter-spacing:.2px; }
        .brand:hover { opacity:. Nine; }
        .burger {
          width:40px; height:36px; background:transparent; border:0;
          display:flex; flex-direction:column; gap:6px; justify-content:center;
        }
        .burger span { height:2px; background:var(--blue); transition:transform .18s ease, opacity .18s ease; }
        .burger.is-open span:nth-child(1){ transform:translateY(8px) rotate(45deg); }
        .burger.is-open span:nth-child(2){ opacity:0; }
        .burger.is-open span:nth-child(3){ transform:translateY(-8px) rotate(-45deg); }

        .menu { display:none; gap:18px; align-items:center; }
        .menu a {
          text-decoration:none; color:var(--ink); font-weight:700; font-size:15px;
          padding:10px 12px; border-radius:10px;
        }
        .menu a:hover { background:#0b61ff10; color:var(--blue); }
        @media(min-width:980px){ .burger{display:none;} .menu{display:flex;} }
        .menu-open {
          display:flex; flex-direction:column; position:absolute; left:0; right:0; top:58px; padding:10px 16px 14px;
          background:#fff; border-bottom:1px solid rgba(2,6,23,0.08); box-shadow:0 14px 28px rgba(2,6,23,0.08);
        }

        /* KICKER */
        .kicker{font-size:var(--fs-kicker); letter-spacing:.05em; text-transform:uppercase; color:#6b7280; margin:0 0 var(--space-xxs); font-weight:700;}

        /* HERO */
        .ovw-hero { text-align:center; padding:18px 8px 0; }
        .ovw-hero-title {
          font-size:clamp(var(--fs-h1-min), var(--fs-h1-vw), var(--fs-h1-max));
          line-height:var(--lh-title); margin:10px 0 var(--space-xs); color:var(--ink);
          letter-spacing:normal; word-spacing:normal;
          text-wrap:balance; word-break:keep-all;
        }
        .ovw-hero-brand { color:var(--blue); }
        .ovw-hero-sub { margin:8px 0 2px; font-size:22px; color:#475569; font-weight:600; }
        .ovw-hero-tagline { margin:0; font-size:14px; color:#64748b; }
        .ovw-hero-tagline--blue { color:var(--blue); font-weight:600; }

        .ovw-hero-media { margin-top:16px; display:flex; justify-content:center; align-items:center; overflow:hidden; }
        .ovw-hero-img { display:block; margin:0 auto; width: clamp(280px, 42vw, 560px); max-width: 100%; height: auto; object-fit: contain; }
        .ovw-hero-spacer { height: clamp(96px, 18vh, 260px); }
        @media (max-height: 700px) { .ovw-hero-spacer { height: clamp(60px, 12vh, 160px); } }
        @media (max-width: 360px) { .ovw-hero-spacer { height: clamp(48px, 12vh, 140px); } }

        /* ROWS */
        .ovw-row { display:flex; flex-direction:column; gap:16px; }
        @media(min-width:992px){
          .ovw-row { flex-direction:row; align-items:flex-start; gap:48px; }
          .ovw-row > .ovw-col { flex:1 1 50%; }
          .ovw-row--alt { flex-direction:row-reverse; }
        }
        .ovw-section-gap { height:96px; }
        @media(min-width:992px){ .ovw-section-gap { height:140px; } }

        /* MEDIA */
        .ovw-col--media { display:flex; justify-content:flex-end; }
        @media(max-width:991px){ .ovw-col--media { justify-content:center; } }
        .ovw-media-img {
          width:100%; max-width:560px; height:auto; object-fit:contain;
          max-height:min(58vh,420px); border-radius:var(--radius);
        }
        /* Activer : image réduite de moitié sur tous écrans */
        .ovw-media-img--half { max-width:280px; }

        .ovw-media-align { margin-left:0; }

        /* TITRES */
        .ovw-section-title {
          margin:0 0 var(--space-xs);
          font-size:clamp(var(--fs-h2-min), var(--fs-h2-vw), var(--fs-h2-max));
          line-height:var(--lh-h2); color:var(--ink); position:relative; font-weight:800;
          letter-spacing:normal; word-spacing:normal; text-wrap:balance; word-break:keep-all;
        }
        .with-blue-underline::after {
          content:""; display:block; height:3px; margin-top:var(--space-xxs); width:clamp(140px,26%,260px); border-radius:2px;
          background: linear-gradient(90deg, var(--blue) 0%, rgba(11,97,255,0.65) 55%, rgba(11,97,255,0) 100%);
        }
        .ovw-subtitle { margin:0 0 10px; font-size:var(--fs-sub); color:var(--ink); font-weight:700; }

        /* CTA */
        .ovw-cta-row { margin-top:12px; }
        .ovw-btn {
          display:inline-block; padding:8px 12px; border-radius:10px;
          text-decoration:none; font-weight:600; font-size:15px; line-height:1.2;
          transition:transform .06s ease, opacity .06s ease;
        }
        .ovw-btn--black { background:#0a0a0a; color:#fff; border:1px solid #0a0a0a; }
        .ovw-btn--black:hover { opacity:.92; transform:translateY(-1px); }

        .ovw-cta-grid { margin-top:12px; display:grid; gap:8px; }
        @media(min-width:640px){ .ovw-cta-grid{grid-template-columns:repeat(2,1fr);} }
        @media(min-width:992px){ .ovw-cta-grid{grid-template-columns:repeat(3,1fr);} }
      `}</style>
    </div>
  );
};

export default OverviewPanel;
