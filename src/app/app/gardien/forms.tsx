"use client";
import { checkSiteNow, saveMonitorSettings } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function CheckNow() {
  return <ActionForm action={checkSiteNow}><Submit variant="secondary">Vérifier maintenant</Submit></ActionForm>;
}

export function MonitorSettings({ enabled, emails, domain, domainManual, defaultEmail }: { enabled: boolean; emails: string[]; domain: string; domainManual: boolean; defaultEmail: string }) {
  return (
    <ActionForm action={saveMonitorSettings} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-1 size-4 accent-[var(--color-accent,#0f766e)]" />
        <span><span className="font-semibold">Surveiller ce site</span><span className="block text-text-muted">Une vérification toutes les 5 minutes, jour et nuit.</span></span>
      </label>
      <TextField label="Adresses qui reçoivent les alertes" name="emails" defaultValue={emails.join(", ")} placeholder={defaultEmail}
        help="3 au plus, séparées par des virgules. Vide : les propriétaires et administrateurs de l'espace." />
      <TextField label="Échéance du nom de domaine" name="domain" type="date" defaultValue={domain}
        help={domainManual ? "Date saisie à la main. Videz le champ pour laisser Altiseo la chercher." : "Le registre des .ch ne publie pas cette date : regardez-la chez votre registraire (Infomaniak, Hostpoint…) et saisissez-la."} />
      <Submit>Enregistrer</Submit>
    </ActionForm>
  );
}
