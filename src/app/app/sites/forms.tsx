"use client";
import { addSite } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function AddSite({ disabled }: { disabled: boolean }) {
  return (
    <ActionForm action={addSite} className="space-y-3">
      <TextField label="Adresse du nouveau site" name="url" placeholder="exemple-client.ch" required disabled={disabled}
        help="Altiseo lit la page d'accueil, puis vous guide pour l'activité, la langue et le rythme de publication." />
      <Submit disabled={disabled}>Ajouter ce site</Submit>
    </ActionForm>
  );
}
