import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { LEGAL_UPDATED, legalReady } from "@/lib/legal";

/** Cadre des pages légales. Introuvables tant que les coordonnées de l'entreprise ne sont pas renseignées. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  if (!legalReady) notFound();
  return (
    <div data-theme="dark" className="min-h-dvh bg-bg text-text">
      <PublicHeader />
      <main className="mx-auto max-w-reading px-4 pb-24 pt-10 md:px-8">
        <h1 className="text-[32px] leading-tight md:text-[44px]">{title}</h1>
        <p className="mt-3 text-sm text-text-muted">Dernière mise à jour : {LEGAL_UPDATED}</p>
        <div className="prose-article mt-8 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_td]:align-top">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
