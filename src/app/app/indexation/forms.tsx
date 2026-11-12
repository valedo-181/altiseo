"use client";
import { inspectPages, setIndexNowAuto, submitIndexNowUrls, verifyIndexNowKey } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function VerifyKey({ primary }: { primary: boolean }) {
  return <ActionForm action={verifyIndexNowKey}><Submit variant={primary ? "primary" : "secondary"}>Vérifier le fichier</Submit></ActionForm>;
}

export function SubmitUrls({ placeholder }: { placeholder: string }) {
  return (
    <ActionForm action={submitIndexNowUrls} className="space-y-3">
      <label className="block space-y-1.5 text-sm">
        <span className="font-semibold">Adresses à signaler</span>
        <textarea name="urls" rows={4} required className="field w-full" placeholder={placeholder} aria-describedby="urls-help" />
        <span id="urls-help" className="block text-xs text-text-muted">Une adresse par ligne, 100 au plus, toutes sur votre site. Pour une page nouvelle ou modifiée.</span>
      </label>
      <Submit variant="secondary">Signaler ces pages</Submit>
    </ActionForm>
  );
}

export function AutoSubmit({ on }: { on: boolean }) {
  return (
    <ActionForm action={setIndexNowAuto} className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 items-start gap-3 text-sm">
        <input type="checkbox" name="auto" defaultChecked={on} className="mt-1 size-4 accent-[var(--color-accent,#0f766e)]" />
        <span><span className="font-semibold">Signaler chaque article publié</span><span className="block text-text-muted">Dès qu'Altiseo met un article en ligne.</span></span>
      </label>
      <Submit variant="secondary" size="sm">Enregistrer</Submit>
    </ActionForm>
  );
}

export function InspectAll() {
  return <ActionForm action={inspectPages}><Submit variant="secondary">Vérifier mes pages</Submit></ActionForm>;
}

export function InspectOne({ placeholder }: { placeholder: string }) {
  return (
    <ActionForm action={inspectPages} className="space-y-3">
      <TextField label="Vérifier une autre page" name="url" type="url" placeholder={placeholder} required help="Une page de votre site qu'Altiseo n'a pas publiée." />
      <Submit variant="secondary">Vérifier cette page</Submit>
    </ActionForm>
  );
}
