"use client";
import { startAudit } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

export function RunAudit({ again }: { again: boolean }) {
  return (
    <ActionForm action={startAudit}>
      <Submit variant={again ? "secondary" : "primary"}>{again ? "Relancer l'audit" : "Lancer l'audit"}</Submit>
      <p className="mt-2 text-xs text-text-muted">Nous lisons jusqu'à 30 pages de votre site. Comptez 30 à 60 secondes.</p>
    </ActionForm>
  );
}
