"use client";
import { extendTrial, setPlan, suspendWorkspace, unsuspendWorkspace } from "@/app/admin/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function TrialForm({ id }: { id: string }) {
  return (
    <ActionForm action={extendTrial} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="days" className="block text-sm font-semibold">Prolonger l'essai de</label>
          <select id="days" name="days" defaultValue="7" className="field w-40">
            {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} jours</option>)}
          </select>
        </div>
        <Submit variant="secondary">Prolonger</Submit>
      </div>
    </ActionForm>
  );
}

export function PlanForm({ id, plan }: { id: string; plan: string | null }) {
  return (
    <ActionForm action={setPlan} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="plan" className="block text-sm font-semibold">Offre</label>
          <select id="plan" name="plan" defaultValue={plan ?? "grow"} className="field w-56">
            <option value="grow">Grow · 30 articles / mois</option>
            <option value="scale">Scale · 60 articles / mois</option>
            <option value="agence">Agence · 25 sites, 300 articles / mois</option>
          </select>
        </div>
        <Submit variant="secondary">Changer</Submit>
      </div>
      <p className="text-xs text-text-muted">Change le quota tout de suite. Le prix facturé suivra avec Stripe.</p>
    </ActionForm>
  );
}

export function SuspendForm({ id, suspended }: { id: string; suspended: boolean }) {
  if (suspended) {
    return (
      <ActionForm action={unsuspendWorkspace}>
        <input type="hidden" name="id" value={id} />
        <Submit>Réactiver le client</Submit>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={suspendWorkspace} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <TextField label="Raison de la suspension" name="reason" maxLength={300} required help="Le client la verra à sa prochaine connexion. Ses données sont gardées." />
      <Submit variant="danger">Suspendre le client</Submit>
    </ActionForm>
  );
}
