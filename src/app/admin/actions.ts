"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions";
import { adminContext } from "@/lib/admin/context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Double authentification : vérifie le code TOTP, la session passe en aal2. */
export async function verifyMfa(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await adminContext();
  const factorId = str(f, "factor_id");
  const code = str(f, "code").replace(/\s+/g, "");
  if (!UUID.test(factorId) || !/^\d{6}$/.test(code)) return { error: "Saisissez le code à 6 chiffres." };
  const { error } = await ctx.supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "Code incorrect ou expiré. Attendez le code suivant et réessayez." };
  redirect("/admin");
}

/** Appelle une fonction admin_* ; la base revérifie le droit et écrit le journal. */
async function run(fn: string, args: Record<string, unknown>, okMessage: string): Promise<FormState> {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return { error: "Double authentification requise." };
  const { error } = await ctx.supabase.rpc(fn, args);
  if (error) return { error: error.code === "42501" ? "Action réservée au super admin." : error.message };
  revalidatePath("/admin", "layout");
  return { ok: okMessage };
}

export async function suspendWorkspace(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const reason = str(f, "reason");
  if (!UUID.test(id)) return { error: "Client introuvable." };
  if (!reason) return { error: "Indiquez la raison : le client la verra." };
  return run("admin_suspend", { wid: id, reason }, "Client suspendu : il n'a plus accès à ses données.");
}

export async function unsuspendWorkspace(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  if (!UUID.test(id)) return { error: "Client introuvable." };
  return run("admin_unsuspend", { wid: id }, "Client réactivé.");
}

export async function extendTrial(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const days = Number(str(f, "days"));
  if (!UUID.test(id)) return { error: "Client introuvable." };
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Entre 1 et 90 jours." };
  return run("admin_extend_trial", { wid: id, days }, `Essai prolongé de ${days} jours.`);
}

export async function setPlan(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const plan = str(f, "plan");
  if (!UUID.test(id)) return { error: "Client introuvable." };
  if (plan !== "grow" && plan !== "scale" && plan !== "agence") return { error: "Offre inconnue." };
  return run("admin_set_plan", { wid: id, plan }, "Offre mise à jour.");
}

export async function retryItem(_: FormState, f: FormData): Promise<FormState> {
  const kind = str(f, "kind");
  const id = str(f, "id");
  if ((kind !== "job" && kind !== "topic") || !UUID.test(id)) return { error: "Relance impossible." };
  return run("admin_retry", { kind, item_id: id }, "Relancé.");
}
