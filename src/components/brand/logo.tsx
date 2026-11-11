/**
 * Logo d'Altiseo, « courbes de niveau » : trois lignes de carte topographique emboîtées dessinent un
 * sommet et la lettre A ; le point corail marque le sommet atteint. Mêmes couleurs en clair et en
 * sombre (jetons brand-night, brand-cyan, highlight). Voir replica/brand.md.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" className="fill-brand-night" />
      <g fill="none" className="stroke-brand-cyan" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 24.5 16 7l10.5 17.5" />
        <path d="M10.2 24.5 16 14.6l5.8 9.9" opacity=".65" />
        <path d="M14 24.5l2-3.4 2 3.4" opacity=".35" />
      </g>
      <circle cx="16" cy="7" r="2.3" className="fill-highlight" />
    </svg>
  );
}

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span aria-hidden="true" className="font-display font-medium tracking-tight text-text" style={{ fontSize: size * 0.6 }}>altiseo</span>
      <span className="sr-only">Altiseo</span>
    </span>
  );
}
