"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { prepareAds } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

export function PrepareAds({ id, again, small }: { id: string; again?: boolean; small?: boolean }) {
  return (
    <ActionForm action={prepareAds}>
      <input type="hidden" name="id" value={id} />
      <Submit variant={again ? "secondary" : "primary"} size={small ? "sm" : "md"}>{again ? "Refaire les annonces" : "Préparer les annonces"}</Submit>
    </ActionForm>
  );
}

/** Copie un texte dans le presse-papiers et le dit (bouton + annonce pour les lecteurs d'écran). */
export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs shrink-0"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
      }}
    >
      {done ? <Check aria-hidden="true" className="size-3.5 text-success" /> : <Copy aria-hidden="true" className="size-3.5" />}
      <span aria-live="polite">{done ? "Copié" : label}</span>
    </button>
  );
}
