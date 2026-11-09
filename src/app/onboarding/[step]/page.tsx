import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Stepper } from "@/components/ui/feedback";
import { requireAccount, ONBOARDING_STEPS, type OnboardingSlug } from "@/lib/app/context";
import { currentSiteId } from "@/lib/app/session";
import { db } from "@/lib/data/store";
import { ActivityStep, CompetitorsStep, LanguageStep, OfferStep, PublishingStep, ScheduleStep, SiteStep } from "./forms";

/** Rédaction et analyse par l'IA : jusqu'à quelques minutes (Vercel Pro). */
export const maxDuration = 300;

export const metadata: Metadata = { title: "Configuration" };

const TITLES: Record<OnboardingSlug, [string, string]> = {
  site: ["Quel est votre site ?", "Nous partons de votre site pour comprendre votre activité."],
  activite: ["Parlez-nous de votre activité", "Nous avons prérempli ce que nous avons pu deviner. Corrigez si besoin."],
  concurrents: ["Vos concurrents", "Facultatif, mais utile pour choisir les bons sujets."],
  langue: ["Langue et ton", "Comment vos articles doivent-ils sonner ?"],
  publication: ["Où publier vos articles ?", "Connectez votre site pour que les articles y arrivent tout seuls."],
  planning: ["Votre rythme de publication", "Quels jours, à quelle heure, et avec ou sans relecture."],
  offre: ["Démarrer votre essai", "3 jours pour essayer, sans engagement."],
};

/** S04–S10 : onboarding en 7 étapes. On peut revenir en arrière, pas sauter en avant. */
export default async function Onboarding({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const idx = ONBOARDING_STEPS.findIndex((s) => s.slug === step);
  if (idx < 0) notFound();
  const slug = step as OnboardingSlug;
  const { workspace } = await requireAccount();
  const sites = await db.listSites(workspace.id);
  const wanted = await currentSiteId();
  const site = sites.find((s) => s.id === wanted) ?? sites[0] ?? null;
  if (!site && slug !== "site") redirect("/onboarding/site");
  if (site && site.onboardingStep < 8 && idx + 1 > site.onboardingStep) redirect(`/onboarding/${ONBOARDING_STEPS[site.onboardingStep - 1].slug}`);

  let form: React.ReactNode;
  switch (slug) {
    case "site": form = <SiteStep url={site && site.onboardingStep < 8 ? site.url : undefined} />; break;
    case "activite": form = <ActivityStep site={site!} />; break;
    case "concurrents": form = <CompetitorsStep initial={(await db.listCompetitors(workspace.id, site!.id)).map((c) => c.url)} />; break;
    case "langue": form = <LanguageStep site={site!} />; break;
    case "publication": {
      const wp = (await db.listIntegrations(workspace.id, site!.id)).find((i) => i.kind === "wordpress");
      form = <PublishingStep endpoint={wp?.config.endpoint ?? site!.url} username={wp?.config.username} />;
      break;
    }
    case "planning": form = <ScheduleStep site={site!} />; break;
    case "offre": form = <OfferStep />; break;
  }
  const [title, lead] = TITLES[slug];
  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex h-16 max-w-3xl items-center px-4">
        <Link href={site?.onboardingStep === 8 ? "/app" : "/"}><Logo size={28} /></Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16">
        <Stepper steps={ONBOARDING_STEPS.map((s) => s.label)} current={idx + 1} />
        <section className="card space-y-6 p-6 md:p-8" aria-labelledby="onb-title">
          <div>
            <h1 id="onb-title" className="text-xl">{title}</h1>
            <p className="mt-1 text-sm text-text-muted">{lead}</p>
          </div>
          {form}
        </section>
      </main>
    </div>
  );
}
