import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 md:px-8">
      <Link href="/"><Logo size={28} /></Link>
      <nav aria-label="Site" className="ml-auto flex items-center gap-1 sm:gap-2">
        <Link href="/services" className={`${buttonClass("ghost", "sm")} hidden sm:inline-flex`}>Services</Link>
        <Link href="/tarifs" className={`${buttonClass("ghost", "sm")} hidden sm:inline-flex`}>Tarifs</Link>
        <Link href="/connexion" className={buttonClass("ghost", "sm")}>Connexion</Link>
        <Link href="/inscription" className={buttonClass("primary", "sm")}>Essai gratuit</Link>
      </nav>
    </header>
  );
}
