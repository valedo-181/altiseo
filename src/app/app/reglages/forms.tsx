"use client";
import { useState } from "react";
import { saveSchedule, saveWriting } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { ScheduleFields } from "@/components/forms/schedule-fields";
import { TextAreaCounter, TextField } from "@/components/ui/field";
import { INSTRUCTIONS_MAX, type Site } from "@/lib/domain/types";

export function WritingForm({ site }: { site: Site }) {
  const [instr, setInstr] = useState(site.customInstructions);
  return (
    <ActionForm action={saveWriting} className="space-y-5">
      <TextAreaCounter label="Consignes pour chaque article" name="customInstructions" rows={5} maxLength={INSTRUCTIONS_MAX} value={instr} onChange={(e) => setInstr(e.target.value)}
        help="Par exemple : citer nos 3 agences, ne jamais parler de prix, toujours finir par un appel à nous contacter." />
      <TextField label="Ton" name="tone" defaultValue={site.tone} maxLength={200} />
      <div className="space-y-1.5">
        <label htmlFor="targetWords" className="block text-sm font-semibold">Longueur visée</label>
        <select id="targetWords" name="targetWords" defaultValue={String(site.targetWords)} className="field max-w-xs">
          {[[900, "Court (~900 mots)"], [1500, "Moyen (~1500 mots)"], [2200, "Long (~2200 mots)"], [3000, "Très long (~3000 mots)"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {![900, 1500, 2200, 3000].includes(site.targetWords) && <option value={site.targetWords}>{site.targetWords} mots</option>}
        </select>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="mentionCompetitors" defaultChecked={site.mentionCompetitors} className="mt-1 size-4 accent-[rgb(var(--c-accent))]" />
        <span><span className="block text-sm font-semibold">Citer les concurrents quand c'est utile</span><span className="block text-xs text-text-muted">Dans les comparatifs et les listes seulement.</span></span>
      </label>
      <Submit>Enregistrer</Submit>
    </ActionForm>
  );
}

export function ScheduleForm({ site }: { site: Site }) {
  return (
    <ActionForm action={saveSchedule} className="space-y-6">
      <ScheduleFields site={site} />
      <Submit>Enregistrer</Submit>
    </ActionForm>
  );
}
