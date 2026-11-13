"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions";
import { EMAIL } from "@/lib/admin/console";
import { adminContext } from "@/lib/admin/context";
import { adminClient } from "@/lib/supabase/server";

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

/** La base n'a pas encore reçu la dernière mise à jour de la console (fonction inconnue de l'API). */
const NOT_INSTALLED = "PGRST202";
const PENDING = "Cette action demande une mise à jour de la base qui n'a pas encore été appliquée.";

/** Appelle une fonction admin_* ; la base revérifie le droit et écrit le journal. */
async function run(fn: string, args: Record<string, unknown>, okMessage: string): Promise<FormState> {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return { error: "Double authentification requise." };
  const { error } = await ctx.supabase.rpc(fn, args);
  if (error) return { error: error.code === "42501" ? "Action réservée au super admin." : error.code === NOT_INSTALLED ? PENDING : error.message };
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

// ---------------------------------------------------------------------------
// Créer et supprimer un client
// ---------------------------------------------------------------------------

const PLANS = ["grow", "scale", "agence"];

/**
 * Crée le compte de la personne s'il n'existe pas (API d'administration de Supabase, côté serveur),
 * puis son espace et son essai (la base revérifie le droit et écrit le journal). Aucun e-mail n'est
 * envoyé : la personne se connecte ensuite avec son adresse, comme tout le monde.
 */
export async function createClient(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return { error: "Double authentification requise." };
  const name = str(f, "name"), email = str(f, "email").toLowerCase(), plan = str(f, "plan"), days = Number(str(f, "days"));
  if (name.length < 2 || name.length > 120) return { error: "Indiquez le nom de l'entreprise (2 à 120 caractères)." };
  if (!EMAIL.test(email) || email.length > 200) return { error: "Adresse e-mail invalide." };
  if (!PLANS.includes(plan)) return { error: "Offre inconnue." };
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Essai entre 1 et 90 jours." };
  // Le droit est revérifié ici, avant toute écriture avec la clé du serveur.
  const { data: allowed } = await ctx.supabase.rpc("is_platform_admin");
  if (allowed !== true) return { error: "Action réservée au super admin." };

  const made = await adminClient().auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  const createdId = made.data?.user?.id ?? null;
  if (made.error && !/already|registered|exists/i.test(made.error.message)) return { error: "Le compte n'a pas pu être créé. Réessayez." };

  const { data: wid, error } = await ctx.supabase.rpc("admin_create_workspace", { owner_email: email, ws_name: name, plan, trial_days: days });
  if (error) {
    if (createdId) await adminClient().auth.admin.deleteUser(createdId).catch(() => undefined); // pas de compte orphelin
    return { error: error.code === NOT_INSTALLED ? PENDING : error.code === "23505" ? "Cette adresse a déjà un espace Altiseo." : error.code === "42501" ? "Action réservée au super admin." : error.message };
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/clients/${wid}?cree=1`);
}

/** Supprime un client et toutes ses données. Le nom doit être retapé ; la base refuse l'espace d'un administrateur. */
export async function deleteClient(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return { error: "Double authentification requise." };
  const id = str(f, "id"), confirm = str(f, "confirm");
  if (!UUID.test(id)) return { error: "Client introuvable." };
  if (!confirm) return { error: "Retapez le nom du client pour confirmer." };
  const { data: orphans, error } = await ctx.supabase.rpc("admin_delete_workspace", { wid: id, confirm_name: confirm });
  if (error) return { error: error.code === NOT_INSTALLED ? PENDING : error.code === "22023" ? "Le nom saisi ne correspond pas : rien n'a été supprimé." : error.code === "42501" ? error.message : error.code === "P0002" ? "Client introuvable." : error.message };
  // La base a tout effacé. Restent les fichiers (images des articles) et les comptes sans espace.
  const ad = adminClient();
  try {
    const { data: files } = await ad.storage.from("article-images").list(id, { limit: 1000 });
    if (files?.length) await ad.storage.from("article-images").remove(files.map((x) => `${id}/${x.name}`));
  } catch { /* les fichiers restants ne sont liés à plus rien */ }
  for (const uid of (orphans ?? []) as string[]) if (UUID.test(uid)) await ad.auth.admin.deleteUser(uid).catch(() => undefined);
  revalidatePath("/admin", "layout");
  redirect("/admin?supprime=1");
}

export async function setNote(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  const note = String(f.get("note") ?? "");
  if (!UUID.test(id)) return { error: "Client introuvable." };
  if ([...note].length > 4000) return { error: "La note dépasse 4000 caractères." };
  return run("admin_set_note", { wid: id, body: note }, note.trim() ? "Note enregistrée." : "Note effacée.");
}

// ---------------------------------------------------------------------------
// Autres administrateurs
// ---------------------------------------------------------------------------

export async function addAdmin(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Adresse e-mail invalide." };
  return run("admin_add_admin", { admin_email: email }, `${email} a maintenant accès à la console. À sa première visite sur /admin, cette personne configurera sa double authentification.`);
}

export async function removeAdmin(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  if (!UUID.test(id)) return { error: "Administrateur introuvable." };
  return run("admin_remove_admin", { uid: id }, "Accès retiré.");
}
