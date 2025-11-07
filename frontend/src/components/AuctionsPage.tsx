import React from "react";

const DOCS_BASE = "http://localhost:4100";
const REGISTER_BASE =
  typeof window !== "undefined" ? window.location.origin : "";

// Images existantes du projet (sécurisées)
import AuctionIntro from "../assets/images/intro-caddy.png";
import AuctionFlow from "../assets/images/strategie.png";
import AuctionSponsor from "../assets/images/blockchain.png";
import Avenir from "../assets/images/avenir.png";

const AuctionsPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <div id="auctions-page" className="page-wrap">
      {/* ===== NAVBAR ===== */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="/">Étika</a>

          <button
            className={`burger ${open ? "is-open" : ""}`}
            aria-label="Menu"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`menu ${open ? "menu-open" : ""}`}>
            <a href="/overview" onClick={() => setOpen(false)}>Accueil</a>
            <a href="/learn/auctions" onClick={() => setOpen(false)}>Enchères</a>
            <a href="/about" onClick={() => setOpen(false)}>À propos</a>
            <a href="/contact" onClick={() => setOpen(false)}>Contact</a>
            <a href="https://community.example.com" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              Communauté
            </a>
          </nav>
        </div>
      </header>

      <main className="ovw-container">
        {/* ===== HERO ===== */}
        <section className="ovw-hero">
          <h1 className="ovw-hero-title with-blue-underline">Enchères Étika</h1>
          <p className="ovw-hero-sub">Le mécanisme qui finance le démarrage du Fonds des Consommateurs.</p>
          <p className="ovw-hero-tagline ovw-hero-tagline--blue">
            Mutualiser la demande, sélectionner les sponsors, transformer la consommation en épargne.
          </p>

          <div className="ovw-hero-media">
            <img src={AuctionIntro} alt="Enchères Étika — visuel d’intro" className="ovw-hero-img" />
          </div>

          <div className="ovw-hero-spacer" aria-hidden="true" />
        </section>

        {/* ===== CONTENU ===== */}
        <div className="ovw-stream">
          {/* Bloc 1 — C’est quoi ? (texte + image) */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Pourquoi des enchères ?</h2>
              <p className="ovw-justify">
                Les enchères Étika permettent de <strong>mutualiser la demande des consommateurs</strong> pour négocier des
                <strong> sponsoring packs</strong> auprès de marques et d’enseignes. Les gagnants deviennent nos <strong>sponsors officiels</strong>
                d’un secteur (ex. alimentation, mobilité, énergie) et apportent les <strong>premiers financements</strong> du Fonds.
              </p>
              <p className="ovw-justify">
                Concrètement, les participants reçoivent des <strong>jetons d’enchères</strong> gratuits qui sont vendus au plus offrant
                pendant la campagne. Les montants levés <strong>démarrent la caisse commune</strong> du Fonds, sans dette, ni dilution.
              </p>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${DOCS_BASE}/learn/auctions/`}>Documentation</a>
              </div>
            </div>

            <div className="ovw-col ovw-col--media">
              <img className="ovw-media-img" src={AuctionFlow} alt="Schéma — fonctionnement des enchères" />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* Bloc 2 — Comment participer ? (ALT → image à gauche) */}
          <section className="ovw-row ovw-row--alt">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Comment participer ?</h2>

              <ol className="ovw-steps ovw-steps--square">
                <li>
                  <div className="step-title">Inscription</div>
                  <p className="ovw-justify">
                    Crée ton compte consommateur. Tu reçois automatiquement tes <strong>jetons d’enchères</strong> (gratuits).
                  </p>
                </li>
                <li>
                  <div className="step-title">Mise en vente des jetons</div>
                  <p className="ovw-justify">
                    Les jetons sont listés en salle d’enchères. <strong>Marques et enseignes</strong> enchérissent pour les acquérir.
                  </p>
                </li>
                <li>
                  <div className="step-title">Sélection des sponsors</div>
                  <p className="ovw-justify">
                    Les meilleurs enchérisseurs deviennent <strong>sponsors officiels</strong> d’un secteur pendant la période.
                  </p>
                </li>
                <li>
                  <div className="step-title">Alimentation du Fonds</div>
                  <p className="ovw-justify">
                    Le produit des ventes <strong>alimente la caisse du Fonds</strong>, qui investira ensuite dans l’économie réelle.
                  </p>
                </li>
              </ol>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/consumer`}>Je participe</a>
              </div>
            </div>

            <div className="ovw-col ovw-col--media">
              <img className="ovw-media-img" src={AuctionSponsor} alt="Sponsors officiels — enchères Étika" />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* Bloc 3 — Règles essentielles (texte + bullets + lien règles) */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Règles essentielles</h2>
              <ul className="ovw-bullets">
                <li>Transparence : historique des mises et gagnants <strong>publics</strong>.</li>
                <li>Plafonds anti-capture : aucun sponsor ne peut <strong>monopoliser</strong> un secteur.</li>
                <li>Intégrité : jetons et résultats traçables via <strong>Preuve d’Achat (PoP)</strong> et registre ouvert.</li>
                <li>Éthique : sponsors tenus de respecter la <strong>charte sociale & environnementale</strong>.</li>
              </ul>

              <div className="ovw-cta-row">
                <a className="ovw-btn ovw-btn--black" href={`${DOCS_BASE}/learn/auctions/rules/`}>Lire les règles</a>
              </div>
            </div>

            <div className="ovw-col ovw-col--media">
              <img className="ovw-media-img" src={Avenir} alt="Transparence & règles — enchères Étika" />
            </div>
          </section>

          <div className="ovw-section-gap" />

          {/* CTA — Créer un compte / Devenir sponsor (image à droite) */}
          <section className="ovw-row">
            <div className="ovw-col ovw-col--text">
              <h2 className="ovw-section-title with-blue-underline">Prêt à entrer en salle d’enchères ?</h2>
              <p className="ovw-justify">Rejoins la communauté, obtiens tes jetons et participe à la sélection de nos sponsors officiels.</p>
              <div className="ovw-cta-grid">
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/consumer`}>Créer mon compte</a>
                <a className="ovw-btn ovw-btn--black" href={`${REGISTER_BASE}/register/sponsor`}>Devenir sponsor</a>
              </div>
            </div>
            <div className="ovw-col ovw-col--media">
              <img className="ovw-media-img" src={Avenir} alt="Appel à l’action — enchères Étika" />
            </div>
          </section>
        </div>
      </main>

      <style>{`
        /* ====== BASE ====== */
        .page-wrap { background:#ffffff; color:#0f172a; }
        .ovw-container { max-width:1080px; margin:0 auto; padding:24px 16px; }
        .ovw-justify { text-align:justify; }

        /* ====== NAV ====== */
        .nav { position:sticky; top:0; z-index:9999; background:#fff; border-bottom:1px solid rgba(2,6,23,0.08);
               box-shadow:0 6px 20px rgba(2,6,23,0.06); }
        .nav-inner { max-width:1180px; margin:0 auto; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; }
        .brand { font-weight:800; text-decoration:none; font-size:20px; color:#0f172a; letter-spacing:.2px; }
        .brand:hover { opacity:.9; }
        .burger { width:40px; height:36px; background:transparent; border:0; display:flex; flex-direction:column; gap:6px; justify-content:center; }
        .burger span { height:2px; background:#0b61ff; transition:transform .18s ease, opacity .18s ease; }
        .burger.is-open span:nth-child(1){ transform:translateY(8px) rotate(45deg); }
        .burger.is-open span:nth-child(2){ opacity:0; }
        .burger.is-open span:nth-child(3){ transform:translateY(-8px) rotate(-45deg); }
        .menu { display:none; gap:18px; align-items:center; }
        .menu a { text-decoration:none; color:#0f172a; font-weight:700; font-size:15px; padding:10px 12px; border-radius:10px; }
        .menu a:hover { background:#0b61ff10; color:#0b61ff; }
        @media(min-width:980px){ .burger{display:none;} .menu{display:flex;} }
        .menu-open { display:flex; flex-direction:column; position:absolute; left:0; right:0; top:58px; padding:10px 16px 14px;
                     background:#fff; border-bottom:1px solid rgba(2,6,23,0.08); box-shadow:0 14px 28px rgba(2,6,23,0.08); }

        /* ====== HERO ====== */
        .ovw-hero { text-align:center; padding:18px 8px 0; }
        .ovw-hero-title { font-size:48px; line-height:1.2; margin:0; color:#0f172a; }
        .ovw-hero-sub { margin:8px 0 2px; font-size:20px; color:#475569; }
        .ovw-hero-tagline { margin:0; font-size:14px; color:#64748b; }
        .ovw-hero-tagline--blue { color:#0b61ff; font-weight:600; }
        .ovw-hero-media { margin-top:16px; }
        .ovw-hero-img { display:block; margin:0 auto; width:clamp(320px,36vw,620px); height:auto; object-fit:contain; }
        .ovw-hero-spacer { height:clamp(100px,22vh,260px); }

        /* ====== ROWS ====== */
        .ovw-row { display:flex; flex-direction:column; gap:16px; }
        @media(min-width:992px){
          .ovw-row { flex-direction:row; align-items:flex-start; gap:48px; }
          .ovw-row > .ovw-col { flex: 1 1 50%; }
          .ovw-row--alt { flex-direction:row-reverse; }
        }
        .ovw-section-gap { height:96px; }
        @media(min-width:992px){ .ovw-section-gap { height:140px; } }

        /* ====== MEDIA ====== */
        .ovw-col--media { display:flex; justify-content:flex-end; }
        @media(max-width:991px){ .ovw-col--media { justify-content:center; } }
        .ovw-media-img { width:100%; max-width:560px; height:340px; object-fit:contain; border-radius:10px; }

        /* ====== TITRES ====== */
        .ovw-section-title { font-size:30px; line-height:1.25; margin:0 0 12px 0; color:#0f172a; position:relative; }
        .with-blue-underline::after {
          content:""; display:block; height:3px; margin-top:6px; width:clamp(140px,26%,260px); border-radius:2px;
          background: linear-gradient(90deg, #0b61ff 0%, rgba(11,97,255,0.65) 55%, rgba(11,97,255,0) 100%);
        }
        .ovw-subtitle { margin:0 0 10px; font-size:18px; color:#0f172a; }

        /* ====== STEPS (numéros) ====== */
        .ovw-steps { counter-reset: step; margin: 6px 0 0; padding:0; list-style:none; }
        .ovw-steps > li { position:relative; padding-left:44px; margin:14px 0; }
        .ovw-steps > li::before {
          counter-increment: step; content: counter(step);
          position:absolute; left:0; top:2px;
          width:28px; height:28px; line-height:28px; text-align:center;
          border-radius:6px; background:#0b61ff; color:#fff; font-weight:700; font-size:14px;
        }

        .ovw-bullets { margin:8px 0; padding-left:18px; }
        .ovw-bullets li { margin:8px 0; }

        /* ====== CTA ====== */
        .ovw-cta-row { margin-top:12px; }
        .ovw-btn {
          display:inline-block; padding:8px 12px; border-radius:10px;
          text-decoration:none; font-weight:600; font-size:15px; line-height:1.2;
          transition:transform .06s ease,opacity .06s ease;
        }
        .ovw-btn--black { background:#0a0a0a; color:#fff; border:1px solid #0a0a0a; }
        .ovw-btn--black:hover { opacity:.92; transform:translateY(-1px); }
        .ovw-cta-grid { margin-top:12px; display:grid; gap:8px; }
        @media(min-width:640px){ .ovw-cta-grid{grid-template-columns:repeat(2,1fr);} }
      `}</style>
    </div>
  );
};

export default AuctionsPage;
