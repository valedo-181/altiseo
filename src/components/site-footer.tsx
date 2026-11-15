import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { COMPANY, LEGAL_PAGES, legalReady } from "@/lib/legal";

/** Pied de page des pages publiques. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-8 gap-y-4 px-4 py-10 md:px-8">
        <Logo size={24} />
        <nav aria-label="Pied de page" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          <Link href="/services" className="hover:text-text">Services</Link>
          <Link href="/tarifs" className="hover:text-text">Tarifs</Link>
          <Link href="/connexion" className="hover:text-text">Connexion</Link>
          {legalReady && LEGAL_PAGES.map(([href, label]) => <Link key={href} href={href} className="hover:text-text">{label}</Link>)}
        </nav>
        <p className="ml-auto text-sm text-text-muted">{legalReady ? `© 2026 Altiseo · ${COMPANY.name}, ${COMPANY.forum}` : "© 2026 Altiseo, Suisse"}</p>
      </div>
    </footer>
  );
}
