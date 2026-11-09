import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-6 px-4 py-16">
      <Logo size={40} />
      <h1 className="text-2xl md:text-display">Votre blog SEO, écrit et publié pour vous.</h1>
      <p className="text-lg font-normal text-text-muted">Altiseo analyse votre site, prépare un mois de sujets et publie un article relu par jour. En construction.</p>
      <div><Link href="/design" className={buttonClass("primary", "lg")}>Voir le système de design</Link></div>
    </main>
  );
}
