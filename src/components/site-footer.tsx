import Link from "next/link";
import { Logo } from "@/components/brand/logo";

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
        </nav>
        <p className="ml-auto text-sm text-text-muted">© 2026 Altiseo, Suisse</p>
      </div>
    </footer>
  );
}
