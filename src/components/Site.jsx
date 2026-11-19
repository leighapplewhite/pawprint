// Shared site chrome: logo, header, footer, and Jean Grey's heart tag.

export function Logo({ onClick }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Pawprint home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <circle cx="16" cy="5.5" r="3.2" fill="none" stroke="var(--lav)" strokeWidth="1.8" />
        <path fill="var(--plum)" d="M16 30C9.5 25.8 5.5 21.5 5.5 17a5.3 5.3 0 0 1 10.5-1.4A5.3 5.3 0 0 1 26.5 17c0 4.5-4 8.8-10.5 13z" />
      </svg>
      <span>Pawprint</span>
    </button>
  );
}

export function SiteHeader({ onHome, children }) {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Logo onClick={onHome} />
        <nav className="bar-nav">{children}</nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap foot">
        <span>© 2026 Pawprint. Made for Jean Grey.</span>
        <span>Built with Supabase</span>
      </div>
    </footer>
  );
}

// The purple heart tag from Jean Grey's collar.
export function HeartTag({ line1, line2 }) {
  return (
    <svg className="heart-tag" viewBox="0 0 120 138" role="img" aria-label={`Collar tag reading ${line1} ${line2}`}>
      <circle cx="60" cy="14" r="11" fill="none" stroke="var(--lav)" strokeWidth="5" />
      <path fill="var(--plum)" d="M60 134C28 112 8 90 8 64a28 28 0 0 1 52-14 28 28 0 0 1 52 14c0 26-20 48-52 70z" />
      <path fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinecap="round" d="M24 56a18 18 0 0 1 14-14" />
      <text x="60" y="70" textAnchor="middle" className="tag-text">{line1}</text>
      <text x="60" y="94" textAnchor="middle" className="tag-text">{line2}</text>
    </svg>
  );
}

export function Arch({ src, alt, className = '' }) {
  return (
    <div className={`arch ${className}`}>
      <img src={src} alt={alt} />
    </div>
  );
}
