"use client";
import { addAdmin, removeAdmin } from "@/app/admin/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function AddAdminForm() {
  return (
    <ActionForm action={addAdmin} className="space-y-3">
      <TextField label="Adresse e-mail de la personne" name="email" type="email" autoComplete="off" required help="Elle doit déjà s'être connectée une fois à Altiseo avec cette adresse." />
      <Submit>Donner l'accès à la console</Submit>
    </ActionForm>
  );
}

export function RemoveAdminForm({ id, email }: { id: string; email: string }) {
  return (
    <ActionForm action={removeAdmin}>
      <input type="hidden" name="id" value={id} />
      <Submit variant="danger" size="sm" aria-label={`Retirer l'accès de ${email}`}>Retirer l'accès</Submit>
    </ActionForm>
  );
}
