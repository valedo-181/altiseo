"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { saveStatsSettings, verifyStatsInstall } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { buttonClass } from "@/components/ui/button";

/** Le bout de code, avec un bouton pour le copier. */
export function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* le texte reste sélectionnable */ }
  };
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs"><code>{code}</code></pre>
      <button type="button" onClick={copy} className={buttonClass("secondary", "sm")}>
        {copied ? <Check aria-hidden="true" className="size-4 text-success" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "Copié" : "Copier le code"}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? "Code copié" : ""}</span>
    </div>
  );
}

export function VerifyInstall() {
  return <ActionForm action={verifyStatsInstall}><Submit variant="secondary">Vérifier l'installation</Submit></ActionForm>;
}

export function StatsSettings({ enabled }: { enabled: boolean }) {
  return (
    <ActionForm action={saveStatsSettings} className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-1 size-4 accent-[var(--color-accent,#0f766e)]" />
        <span><span className="font-semibold">Compter les visites</span><span className="block text-text-muted">Décoché : le script reste sur le site mais rien n'est plus compté.</span></span>
      </label>
      <Submit variant="secondary">Enregistrer</Submit>
    </ActionForm>
  );
}
