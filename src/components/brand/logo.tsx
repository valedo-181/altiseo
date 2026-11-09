/**
 * Logo provisoire d'Altiseo : une ligne qui monte en dessinant deux sommets (l'altitude, la courbe
 * de trafic), dans un carré sarcelle. Point de départ pour le graphiste, voir replica/brand.md.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path
        d="M6 23.5 12.5 15l3.5 4 4-6.5 3 3.5L26 8.5"
        fill="none"
        className="stroke-on-accent"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="8.5" r="2.4" className="fill-on-accent" />
    </svg>
  );
}

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span aria-hidden="true" className="font-semibold tracking-tight text-text" style={{ fontSize: size * 0.68 }}>
        alti<span className="text-accent">seo</span>
      </span>
      <span className="sr-only">Altiseo</span>
    </span>
  );
}
