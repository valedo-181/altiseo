import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion" };

export default function SignIn() {
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-12">
      <Link href="/"><Logo size={32} /></Link>
      <h1 className="text-xl">Se connecter</h1>
      <SignInForm />
      <p className="text-sm text-text-muted">Pas encore de compte ? <Link href="/inscription" className="font-semibold text-accent underline underline-offset-2">Essai gratuit</Link></p>
    </main>
  );
}
