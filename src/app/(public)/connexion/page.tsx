import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Banner } from "@/components/ui/feedback";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  lien: "Ce lien de connexion n'est plus valable (il sert une seule fois, pendant une heure). Demandez-en un nouveau.",
  espace: "Votre compte est ouvert, mais l'espace n'a pas pu être créé. Réessayez ; si cela continue, écrivez-nous.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-12">
      <Link href="/"><Logo size={32} /></Link>
      <h1 className="text-xl">Se connecter</h1>
      {erreur && ERRORS[erreur] && <Banner tone="danger">{ERRORS[erreur]}</Banner>}
      <SignInForm />
      <p className="text-sm text-text-muted">Pas encore de compte ? <Link href="/inscription" className="font-semibold text-accent underline underline-offset-2">Essai gratuit</Link></p>
    </main>
  );
}
