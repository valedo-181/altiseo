"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import * as A from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { ScheduleFields } from "@/components/forms/schedule-fields";
import { WordPressFields } from "@/components/forms/wordpress-fields";
import { Button } from "@/components/ui/button";
import { TextAreaCounter, TextField, UrlField } from "@/components/ui/field";
import type { Site } from "@/lib/domain/types";

function Actions({ label = "Continuer", back }: { label?: string; back?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Submit size="lg">{label}</Submit>
      {back && <a href={back} className="btn btn-ghost">Retour</a>}
    </div>
  );
}

export function SiteStep({ url }: { url?: string }) {
  return (
    <ActionForm action={A.onboardingSite} className="space-y-6">
      <UrlField label="Adresse de votre site" name="url" large required autoFocus defaultValue={url?.replace(/^https:\/\//, "")} placeholder="votre-entreprise.ch" help="Nous lisons uniquement vos pages publiques. L'analyse peut prendre une minute." />
      <Actions label="Analyser mon site" />
    </ActionForm>
  );
}

export function ActivityStep({ site }: { site: Site }) {
  const [desc, setDesc] = useState(site.businessDescription);
  const [aud, setAud] = useState(site.targetAudience);
  return (
    <ActionForm action={A.onboardingActivity} className="space-y-5">
      <TextField label="Nom de l'entreprise" name="name" defaultValue={site.name} required maxLength={120} />
      <TextField label="Thème principal" name="theme" defaultValue={site.theme} required maxLength={60} placeholder="déménagement, plomberie, cours de yoga…" help="Le sujet de la plupart de vos articles, en un ou deux mots." />
      <TextAreaCounter label="Votre activité en quelques phrases" name="description" rows={4} maxLength={4000} value={desc} onChange={(e) => setDesc(e.target.value)} help="Ce que vous faites, où, et ce qui vous distingue." />
      <TextAreaCounter label="Vos clients" name="audience" rows={2} maxLength={2000} value={aud} onChange={(e) => setAud(e.target.value)} help="Par exemple : familles de la région lausannoise, PME du canton de Vaud." />
      <Actions back="/onboarding/site" />
    </ActionForm>
  );
}

export function CompetitorsStep({ initial }: { initial: string[] }) {
  const [rows, setRows] = useState<string[]>(initial.length ? initial : ["", "", ""]);
  return (
    <ActionForm action={A.onboardingCompetitors} className="space-y-5">
      <p className="text-sm text-text-muted">Indiquez jusqu'à 10 sites concurrents. Ils nous aident à trouver les sujets qui marchent dans votre domaine. Vous pouvez laisser vide.</p>
      <ul className="space-y-3">
        {rows.map((v, i) => (
          <li key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <UrlField label={`Concurrent ${i + 1}`} name="competitor" value={v.replace(/^https:\/\//, "")} onChange={(e) => setRows(rows.map((r, j) => (j === i ? e.target.value : r)))} />
            </div>
            <Button variant="ghost" iconOnly aria-label={`Retirer le concurrent ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="mb-[26px]">
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {rows.length < 10 && <Button variant="secondary" size="sm" onClick={() => setRows([...rows, ""])}><Plus aria-hidden="true" className="size-4" />Ajouter un concurrent</Button>}
      <Actions back="/onboarding/activite" />
    </ActionForm>
  );
}

export function LanguageStep({ site }: { site: Site }) {
  return (
    <ActionForm action={A.onboardingLanguage} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="language" className="block text-sm font-semibold">Langue des articles</label>
        <select id="language" name="language" defaultValue={site.language} className="field">
          <option value="fr">Français</option>
          <option value="de">Allemand</option>
          <option value="it">Italien</option>
          <option value="en">Anglais</option>
        </select>
        <p className="text-xs text-text-muted">L'offre Grow comprend une langue.</p>
      </div>
      <TextField label="Ton des articles" name="tone" defaultValue={site.tone} maxLength={200} help="Par exemple : chaleureux, vouvoiement, phrases courtes." />
      <Actions back="/onboarding/concurrents" />
    </ActionForm>
  );
}

export function PublishingStep({ endpoint, username }: { endpoint: string; username?: string }) {
  return (
    <ActionForm action={A.onboardingPublishing} className="space-y-5">
      <p className="text-sm text-text-muted">Altiseo publie sur WordPress sans plugin. Webflow, Shopify et les sites sur mesure arrivent bientôt.</p>
      <WordPressFields endpoint={endpoint} username={username} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Submit size="lg">Connecter WordPress</Submit>
        <button type="submit" name="skip" value="1" formNoValidate className="btn btn-ghost">Plus tard</button>
      </div>
    </ActionForm>
  );
}

export function ScheduleStep({ site }: { site: Site }) {
  return (
    <ActionForm action={A.onboardingSchedule} className="space-y-6">
      <ScheduleFields site={site} />
      <Actions back="/onboarding/publication" />
    </ActionForm>
  );
}

export function OfferStep() {
  return (
    <ActionForm action={A.onboardingFinish} className="space-y-6">
      <div className="card ring-2 ring-accent">
        <div className="flex items-start justify-between"><p className="text-lg font-semibold">Grow</p><span className="pill bg-accent-soft text-accent">Essai 3 jours</span></div>
        <p className="mt-2 text-2xl font-bold">99 CHF <span className="text-sm font-normal text-text-muted">/ mois après l'essai</span></p>
        <p className="mt-1 text-sm text-text-muted">30 articles par mois · 1 langue · 1 site · audit SEO</p>
      </div>
      <p className="text-sm text-text-muted">Aucun paiement n'est demandé pendant l'essai. Le paiement par carte arrivera avec Stripe.</p>
      <Actions label="Démarrer l'essai et préparer mes sujets" back="/onboarding/planning" />
    </ActionForm>
  );
}
