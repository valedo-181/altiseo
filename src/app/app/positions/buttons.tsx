"use client";
import { addRankKeyword, importRankKeywords, runPositions } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function RunPositions({ again }: { again: boolean }) {
  return (
    <ActionForm action={runPositions}>
      <Submit variant={again ? "secondary" : "primary"}>{again ? "Mesurer les mots-clés restants" : "Mesurer les positions maintenant"}</Submit>
    </ActionForm>
  );
}

export function ImportKeywords({ primary }: { primary?: boolean }) {
  return <ActionForm action={importRankKeywords}><Submit variant={primary ? "primary" : "secondary"}>Reprendre mes mots-clés</Submit></ActionForm>;
}

export function AddKeyword({ disabled }: { disabled: boolean }) {
  return (
    <ActionForm action={addRankKeyword} className="space-y-3">
      <TextField label="Nouveau mot-clé" name="phrase" placeholder="Ex. : déménagement neuchâtel" maxLength={120} minLength={2} required disabled={disabled}
        help="Écrivez-le comme vos clients le tapent dans Google, avec la ville si elle compte." />
      <Submit variant="secondary" disabled={disabled}>Ajouter le mot-clé</Submit>
    </ActionForm>
  );
}
