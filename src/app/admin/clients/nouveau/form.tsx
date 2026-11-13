"use client";
import { createClient } from "@/app/admin/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function NewClientForm() {
  return (
    <ActionForm action={createClient} className="space-y-4">
      <TextField label="Nom de l'entreprise" name="name" maxLength={120} minLength={2} required />
      <TextField label="Adresse e-mail du responsable" name="email" type="email" autoComplete="off" required help="C'est avec cette adresse que la personne se connectera." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="plan" className="block text-sm font-semibold">Offre</label>
          <select id="plan" name="plan" defaultValue="grow" className="field w-full">
            <option value="grow">Grow · 99 CHF / mois</option>
            <option value="scale">Scale · 249 CHF / mois</option>
            <option value="agence">Agence · 690 CHF / mois</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="days" className="block text-sm font-semibold">Durée de l'essai</label>
          <select id="days" name="days" defaultValue="14" className="field w-full">
            {[3, 7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} jours</option>)}
          </select>
        </div>
      </div>
      <Submit>Créer le client</Submit>
    </ActionForm>
  );
}
