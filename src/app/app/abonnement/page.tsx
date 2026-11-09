import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, QuotaBar } from "@/components/ui/card";
import { requireSite } from "@/lib/app/context";

export const metadata: Metadata = { title: "Abonnement" };

/** S22 : abonnement (démo : essai sans paiement ; Stripe viendra avec le backend). */
export default async function Billing() {
  const { subscription } = await requireSite();
  return (
    <>
      <PageHeader title="Abonnement" />
      <Card className="max-w-xl space-y-3">
        <div className="flex items-center justify-between"><p className="text-lg font-semibold">Grow</p>
          <span className="pill bg-info-soft text-info">{subscription?.status === "trialing" ? "Essai" : subscription?.status}</span></div>
        {subscription?.trialEndsAt && <p className="text-sm text-text-muted">Fin de l'essai : {new Date(subscription.trialEndsAt).toLocaleDateString("fr-CH", { dateStyle: "long" })}</p>}
        <div>
          <p className="text-sm">Articles ce mois : <span className="font-semibold tabular-nums">{subscription?.used ?? 0} / {subscription?.articlesPerMonth ?? 0}</span></p>
          {subscription && <QuotaBar used={subscription.used} total={subscription.articlesPerMonth} />}
        </div>
        <p className="text-sm text-text-muted">Le paiement, le changement d'offre et l'annulation en un clic arriveront avec Stripe.</p>
      </Card>
    </>
  );
}
