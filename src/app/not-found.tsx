import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-4 px-4">
      <Logo size={32} />
      <h1 className="text-xl">Page introuvable</h1>
      <p className="text-text-muted">Cette page n'existe pas, ou vous n'y avez pas accès.</p>
      <div><Link href="/app" className={buttonClass("primary")}>Retour à l'accueil</Link></div>
    </main>
  );
}
