import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Banner } from "@/components/ui/feedback";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Créer un compte" };

/** S03 : inscription (démo : sans mot de passe ni e-mail de confirmation). */
export default function SignUp() {
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-12">
      <Link href="/"><Logo size={32} /></Link>
      <div>
        <h1 className="text-xl">Créer votre compte</h1>
        <p className="mt-1 text-sm text-text-muted">3 jours d'essai, 30 articles. Sans carte pendant l'essai.</p>
      </div>
      <Banner tone="info">Mode démo : pas de mot de passe, l'e-mail suffit.</Banner>
      <SignUpForm />
      <p className="text-sm text-text-muted">Déjà un compte ? <Link href="/connexion" className="font-semibold text-accent underline underline-offset-2">Se connecter</Link></p>
    </main>
  );
}
