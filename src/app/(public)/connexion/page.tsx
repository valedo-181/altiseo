import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Banner } from "@/components/ui/feedback";
import { demoMode } from "@/lib/config";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion", description: "Connectez-vous à Altiseo pour retrouver votre calendrier, vos articles et le suivi de vos mots-clés." };

const ERRORS: Record<string, string> = {
  lien: "Ce lien de connexion n'est plus valable (il sert une seule fois, pendant une heure). Demandez-en un nouveau.",
  espace: "Votre compte est ouvert, mais l'espace n'a pas pu être créé. Réessayez ; si cela continue, écrivez-nous.",
};

/** S03 : connexion. Lien envoyé par e-mail (pas de mot de passe) ; en mode démo l'e-mail suffit. */
export default async function SignIn({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <AuthShell
      title="Content de vous revoir."
      lead={demoMode ? "Mode démo : votre adresse e-mail suffit pour entrer." : "Indiquez votre adresse : nous vous envoyons un lien de connexion. Pas de mot de passe à retenir."}
      footer={<>Pas encore de compte ? <Link href="/inscription" className="font-semibold text-accent underline underline-offset-2">Essayer 3 jours gratuitement</Link></>}
      aside={{ quote: "Vos articles vous attendent, là où vous les avez laissés.", points: ["Le calendrier du mois, sujet par sujet", "Les brouillons à relire avant publication", "La position de vos mots-clés dans Google"] }}
    >
      {erreur && ERRORS[erreur] && <div className="mb-4"><Banner tone="danger">{ERRORS[erreur]}</Banner></div>}
      <SignInForm />
      {!demoMode && <p className="mt-4 text-xs text-text-muted">Le lien arrive en une minute, sert une seule fois et reste valable une heure. Pensez à regarder dans les courriers indésirables.</p>}
    </AuthShell>
  );
}
