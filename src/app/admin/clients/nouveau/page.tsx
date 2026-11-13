import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminContext } from "@/lib/admin/context";
import { MfaScreen } from "../../mfa";
import { NewClientForm } from "./form";

export const metadata: Metadata = { title: "Nouveau client" };

/** Créer une entreprise à la main, sans passer par l'inscription. */
export default async function NewClient() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  return (
    <>
      <div className="space-y-2">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden="true" className="size-4" />Clients</Link>
        <h1 className="text-xl md:text-2xl">Nouveau client</h1>
        <p className="max-w-reading text-sm text-text-muted">Crée le compte de la personne, son espace et son essai. Aucun e-mail n'est envoyé : indiquez-lui ensuite de se connecter sur la page de connexion avec son adresse. Elle configurera son site elle-même.</p>
      </div>
      <Card className="max-w-xl"><NewClientForm /></Card>
    </>
  );
}
