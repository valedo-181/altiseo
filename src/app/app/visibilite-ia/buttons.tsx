"use client";
import { addAiQuestion, runAiVisibility, suggestAiQuestions } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function RunVisibility({ again }: { again: boolean }) {
  return (
    <ActionForm action={runAiVisibility}>
      <Submit variant={again ? "secondary" : "primary"}>{again ? "Continuer le passage" : "Interroger les IA maintenant"}</Submit>
    </ActionForm>
  );
}

export function SuggestQuestions({ primary }: { primary?: boolean }) {
  return <ActionForm action={suggestAiQuestions}><Submit variant={primary ? "primary" : "secondary"}>Proposer des questions</Submit></ActionForm>;
}

export function AddQuestion({ disabled }: { disabled: boolean }) {
  return (
    <ActionForm action={addAiQuestion} className="space-y-3">
      <TextField label="Nouvelle question" name="question" placeholder="Ex. : Quel déménageur recommandes-tu à Neuchâtel ?" maxLength={300} minLength={5} required disabled={disabled}
        help="Écrivez-la comme vos clients la posent à ChatGPT, avec la ville ou la région." />
      <Submit variant="secondary" disabled={disabled}>Ajouter la question</Submit>
    </ActionForm>
  );
}
