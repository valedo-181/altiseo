import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { demoMode } from "@/lib/config";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { alternates: { canonical: "/inscription" }, title: "Créer un compte", description: "Essayez Altiseo 3 jours gratuitement, sans carte bancaire : trente sujets d'articles proposés dès aujourd'hui." };

/** S03 : inscription (démo : sans mot de passe ni e-mail de confirmation). */
export default function SignUp() {
  return (
    <AuthShell
      title="Commencez l'ascension."
      lead="3 jours d'essai gratuit, sans carte bancaire. Vos trente premiers sujets arrivent en une minute."
      footer={<>Déjà un compte ? <Link href="/connexion" className="font-semibold text-accent underline underline-offset-2">Se connecter</Link></>}
      aside={{ quote: "Un blog qui avance, même quand vous n'avez pas le temps.", points: ["Trente sujets tirés de votre activité", "Un article par jour, dans votre ton", "Vous relisez avant que rien ne paraisse"] }}
    >
      <SignUpForm />
      <p className="mt-4 text-xs text-text-muted">{demoMode ? "Mode démo : pas de mot de passe, l'e-mail suffit." : "Pas de mot de passe à retenir : nous vous envoyons un lien de connexion par e-mail."}</p>
    </AuthShell>
  );
}
