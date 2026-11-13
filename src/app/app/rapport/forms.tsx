"use client";
import { newReportLink, saveBranding, saveReportSettings } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";
import type { Branding, SiteReport } from "@/lib/domain/types";

export function BrandingForm({ b }: { b: Branding }) {
  return (
    <ActionForm action={saveBranding} className="space-y-4">
      <TextField label="Nom de l'agence" name="agencyName" defaultValue={b.agencyName} maxLength={120} placeholder="Ex. : Agence Lac & Web" />
      <TextField label="Adresse du logo" name="logoUrl" type="url" defaultValue={b.logoUrl ?? ""} placeholder="https://votre-agence.ch/logo.png" help="Une image déjà en ligne sur votre site (PNG, SVG ou JPG), en https." />
      <TextField label="Couleur de l'agence" name="accent" defaultValue={b.accent ?? ""} placeholder="#0F766E" maxLength={7} help="Titres et filet du rapport. Format #RRGGBB." />
      <TextField label="Ligne de contact" name="contact" defaultValue={b.contact} maxLength={200} placeholder="032 000 00 00 · info@votre-agence.ch" help="En bas de chaque rapport." />
      <Submit variant="secondary">Enregistrer la marque</Submit>
    </ActionForm>
  );
}

export function ReportSettings({ r }: { r: SiteReport }) {
  return (
    <ActionForm action={saveReportSettings} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="shared" defaultChecked={r.shared} className="mt-1 size-4 accent-[var(--color-accent,#0f766e)]" />
        <span><span className="font-semibold">Lien actif pour le client</span><span className="block text-text-muted">Le client lit son rapport sans compte. Décochez pour couper l'accès.</span></span>
      </label>
      <TextField label="Nom du client" name="clientName" defaultValue={r.clientName} maxLength={120} placeholder="Ex. : Madame Rochat" help="Pour la salutation de l'e-mail." />
      <TextField label="Adresses du client" name="emails" defaultValue={r.clientEmails.join(", ")} placeholder="client@exemple.ch" help="3 au plus, séparées par des virgules." />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="monthly" defaultChecked={r.monthly} className="mt-1 size-4 accent-[var(--color-accent,#0f766e)]" />
        <span><span className="font-semibold">Envoyer le rapport chaque mois</span><span className="block text-text-muted">Le 1er du mois, un e-mail avec le lien du rapport du mois passé.</span></span>
      </label>
      <Submit>Enregistrer</Submit>
    </ActionForm>
  );
}

export function NewLink() {
  return <ActionForm action={newReportLink}><Submit variant="secondary" size="sm">Créer un nouveau lien</Submit></ActionForm>;
}
