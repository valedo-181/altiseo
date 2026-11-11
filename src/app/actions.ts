"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAccount, requireSite, ONBOARDING_STEPS, type OnboardingSlug } from "@/lib/app/context";
import { config, siteOrigin } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";
import * as svc from "@/lib/app/service";
import { endSession, rememberSite, startSession } from "@/lib/app/session";
import { db, Conflict } from "@/lib/data/store";
import { INSTRUCTIONS_MAX, type Lang } from "@/lib/domain/types";
import { normalizeSiteUrl, siteNameFromHost } from "@/lib/domain/url";

/** État renvoyé aux formulaires (useActionState). */
export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------------------
// Compte (S03). Avec Supabase : lien de connexion par e-mail (sans mot de passe à retenir).
// En mode démo : l'e-mail suffit, sans confirmation.
// ---------------------------------------------------------------------------

/** Envoie le lien de connexion. Message identique que le compte existe ou non (pas d'énumération). */
async function sendMagicLink(email: string, name: string | null, create: boolean): Promise<FormState> {
  const h = await headers();
  const origin = siteOrigin(h.get("origin") ?? undefined);
  const { error } = await (await userClient()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: create, data: name ? { name } : undefined },
  });
  if (error) console.error("auth.signInWithOtp", { status: error.status, code: (error as { code?: string }).code, message: error.message });
  if (error && error.status === 429) return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  if (error && !/not allowed|signups not allowed|user not found/i.test(error.message)) return { error: "L'e-mail n'a pas pu être envoyé. Réessayez." };
  return { ok: `Si l'adresse est correcte, un lien de connexion vient d'être envoyé à ${email}. Il est valable une heure.` };
}

export async function signUp(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  const name = str(f, "name") || null;
  if (!EMAIL.test(email)) return { error: "Cette adresse e-mail n'est pas valide." };
  if (name && name.length > 80) return { error: "Le nom est trop long." };
  if (config.supabase) return sendMagicLink(email, name, true);
  try {
    const { user } = await db.createAccount(email, name);
    await startSession(user.id);
  } catch (e) {
    if (e instanceof Conflict) return { error: "Un compte existe déjà avec cet e-mail. Connectez-vous." };
    throw e;
  }
  redirect("/onboarding/site");
}

export async function signIn(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: "Cette adresse e-mail n'est pas valide." };
  if (config.supabase) return sendMagicLink(email, null, false);
  const user = await db.findUserByEmail(email);
  if (!user) return { error: "Aucun compte avec cet e-mail. Créez-en un." };
  await startSession(user.id);
  redirect("/app");
}

export async function signOut() {
  await endSession();
  redirect("/");
}

export async function switchSite(f: FormData) {
  const { workspace } = await requireAccount();
  const id = str(f, "siteId");
  if ((await db.listSites(workspace.id)).some((s) => s.id === id)) await rememberSite(id);
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Onboarding (S04–S10)
// ---------------------------------------------------------------------------

function nextStep(current: OnboardingSlug): string {
  const i = ONBOARDING_STEPS.findIndex((s) => s.slug === current);
  return i + 1 < ONBOARDING_STEPS.length ? `/onboarding/${ONBOARDING_STEPS[i + 1].slug}` : "/app/calendrier";
}

async function advance(workspaceId: string, siteId: string, current: OnboardingSlug) {
  const i = ONBOARDING_STEPS.findIndex((s) => s.slug === current);
  const site = await db.getSite(workspaceId, siteId);
  if (site.onboardingStep < i + 2) await db.updateSite(workspaceId, siteId, { onboardingStep: i + 2 });
}

export async function onboardingSite(_: FormState, f: FormData): Promise<FormState> {
  const { workspace } = await requireAccount();
  const r = await svc.createSiteFromUrl(workspace.id, str(f, "url"));
  if (!r.ok) return { error: r.error };
  await rememberSite(r.value.id);
  redirect(nextStep("site"));
}

export async function onboardingActivity(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  const theme = str(f, "theme");
  const name = str(f, "name");
  const description = str(f, "description");
  const audience = str(f, "audience");
  if (!name) return { error: "Indiquez le nom de votre entreprise." };
  if (theme.length < 3) return { error: "Indiquez le thème principal de votre site (par exemple : déménagement)." };
  if (theme.length > 60) return { error: "Le thème doit rester court (60 caractères au plus)." };
  if (description.length > 4000 || audience.length > 2000) return { error: "Le texte est trop long." };
  await db.updateSite(workspace.id, site.id, { name, theme, businessDescription: description, targetAudience: audience });
  await advance(workspace.id, site.id, "activite");
  redirect(nextStep("activite"));
}

export async function onboardingCompetitors(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  const raw = f.getAll("competitor").map((v) => String(v).trim()).filter(Boolean);
  const list: Array<{ url: string; name: string }> = [];
  for (const r of raw) {
    const u = normalizeSiteUrl(r);
    if (!u.ok) return { error: `« ${r} » : ${u.error}` };
    if (u.url === site.url) return { error: "Indiquez des concurrents, pas votre propre site." };
    list.push({ url: u.url, name: siteNameFromHost(u.host) });
  }
  if (list.length > 10) return { error: "10 concurrents au plus." };
  await db.setCompetitors(workspace.id, site.id, list);
  await advance(workspace.id, site.id, "concurrents");
  redirect(nextStep("concurrents"));
}

const LANGS: Lang[] = ["fr", "de", "it", "en"];
export async function onboardingLanguage(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  const language = str(f, "language") as Lang;
  const tone = str(f, "tone");
  if (!LANGS.includes(language)) return { error: "Choisissez une langue." };
  if (tone.length > 200) return { error: "Le ton doit tenir en 200 caractères." };
  await db.updateSite(workspace.id, site.id, { language, tone });
  await advance(workspace.id, site.id, "langue");
  redirect(nextStep("langue"));
}

export async function onboardingPublishing(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  if (str(f, "skip") !== "1") {
    const r = await svc.connectWordPress(workspace.id, site.id, { endpoint: str(f, "endpoint"), username: str(f, "username"), appPassword: str(f, "appPassword") });
    if (!r.ok) return { error: r.error };
  }
  await advance(workspace.id, site.id, "publication");
  redirect(nextStep("publication"));
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function readSchedule(f: FormData): { error: string } | { publishTime: string; timezone: string; publishDays: number[]; publishMode: "draft" | "publish" } {
  const publishTime = str(f, "publishTime");
  const timezone = str(f, "timezone");
  const publishDays = f.getAll("days").map(Number).filter((d) => d >= 1 && d <= 7);
  const publishMode = str(f, "publishMode") === "publish" ? "publish" : "draft";
  if (!TIME.test(publishTime)) return { error: "Heure invalide (format 08:00)." };
  try { new Intl.DateTimeFormat("fr", { timeZone: timezone }); } catch { return { error: "Fuseau horaire inconnu." }; }
  if (!publishDays.length) return { error: "Cochez au moins un jour de publication." };
  return { publishTime, timezone, publishDays: [...new Set(publishDays)].sort(), publishMode };
}

export async function onboardingSchedule(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  const s = readSchedule(f);
  if ("error" in s) return s;
  await db.updateSite(workspace.id, site.id, s);
  await advance(workspace.id, site.id, "planning");
  redirect(nextStep("planning"));
}

/** Dernière étape : l'essai est déjà actif (démo, sans paiement) ; on prépare le calendrier. */
export async function onboardingFinish(_s?: FormState, _f?: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite({ allowOnboarding: true });
  await db.updateSite(workspace.id, site.id, { onboardingStep: 8 });
  const r = await svc.buildCalendar(workspace.id, site.id);
  if (!r.ok) return { error: r.error };
  redirect("/app/calendrier?nouveau=1");
}

// ---------------------------------------------------------------------------
// Calendrier (S12)
// ---------------------------------------------------------------------------

export async function rebuildCalendar(): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const r = await svc.buildCalendar(workspace.id, site.id);
  revalidatePath("/app/calendrier");
  return r.ok ? { ok: `${r.value} sujets au calendrier.` } : { error: r.error };
}

export async function approveAllTopics(): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const n = await db.approveAll(workspace.id, site.id);
  revalidatePath("/app/calendrier");
  return { ok: n ? `${n} sujets approuvés.` : "Tous les sujets sont déjà approuvés." };
}

export async function topicAction(_: FormState, f: FormData): Promise<FormState> {
  const { workspace } = await requireSite();
  const id = str(f, "id");
  const op = str(f, "op");
  let r: svc.Result<unknown>;
  if (op === "approve") r = await svc.setTopicStatus(workspace.id, id, "approved");
  else if (op === "skip") r = await svc.setTopicStatus(workspace.id, id, "skipped");
  else if (op === "restore") r = await svc.setTopicStatus(workspace.id, id, "proposed");
  else if (op === "regenerate") r = await svc.regenerateTopic(workspace.id, id);
  else if (op === "write") {
    r = await svc.writeArticleForTopic(workspace.id, id);
    if (r.ok) redirect(`/app/articles/${r.value}?ecrit=1`);
  } else return { error: "Action inconnue." };
  revalidatePath("/app/calendrier");
  revalidatePath("/app");
  return r.ok ? { ok: "C'est fait." } : { error: r.error };
}

// ---------------------------------------------------------------------------
// Articles (S13, S14)
// ---------------------------------------------------------------------------

export async function saveArticle(_: FormState, f: FormData): Promise<FormState> {
  const { workspace } = await requireSite();
  const id = str(f, "id");
  const r = await svc.saveArticle(workspace.id, id, {
    title: str(f, "title"), slug: str(f, "slug"), metaTitle: str(f, "metaTitle"), metaDescription: str(f, "metaDescription"),
    bodyMd: String(f.get("bodyMd") ?? ""),
  });
  revalidatePath(`/app/articles/${id}`);
  revalidatePath("/app/articles");
  return r.ok ? { ok: "Modifications enregistrées." } : { error: r.error };
}

export async function publishArticle(_: FormState, f: FormData): Promise<FormState> {
  const { workspace } = await requireSite();
  const id = str(f, "id");
  const r = await svc.publishArticle(workspace.id, id);
  revalidatePath(`/app/articles/${id}`);
  revalidatePath("/app/articles");
  revalidatePath("/app");
  if (!r.ok) return { error: r.error };
  const sim = r.value.simulated ? " (simulation)" : "";
  return { ok: r.value.mode === "draft" ? `Envoyé en brouillon sur WordPress${sim}.` : `Publié sur WordPress${sim}.` };
}

// ---------------------------------------------------------------------------
// Intégrations (S17) et réglages (S18, S20)
// ---------------------------------------------------------------------------

export async function connectWordPress(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const r = await svc.connectWordPress(workspace.id, site.id, { endpoint: str(f, "endpoint"), username: str(f, "username"), appPassword: str(f, "appPassword") });
  revalidatePath("/app/integrations");
  return r.ok ? { ok: config.cms ? "WordPress est connecté : la connexion a été testée." : "WordPress est connecté (simulation : rien n'est envoyé)." } : { error: r.error };
}

export async function disconnectIntegration(f: FormData) {
  const { workspace } = await requireSite();
  await db.disableIntegration(workspace.id, str(f, "id"));
  revalidatePath("/app/integrations");
}

export async function saveWriting(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const customInstructions = String(f.get("customInstructions") ?? "");
  const tone = str(f, "tone");
  const targetWords = Number(str(f, "targetWords"));
  if ([...customInstructions].length > INSTRUCTIONS_MAX) return { error: `Les consignes dépassent ${INSTRUCTIONS_MAX} caractères.` };
  if (tone.length > 200) return { error: "Le ton doit tenir en 200 caractères." };
  if (!Number.isInteger(targetWords) || targetWords < 600 || targetWords > 5000) return { error: "Longueur entre 600 et 5000 mots." };
  await db.updateSite(workspace.id, site.id, { customInstructions: customInstructions.trim(), tone, targetWords, mentionCompetitors: f.get("mentionCompetitors") === "on" });
  revalidatePath("/app/reglages");
  return { ok: "Réglages enregistrés. Ils s'appliquent aux prochains articles." };
}

export async function saveSchedule(_: FormState, f: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const s = readSchedule(f);
  if ("error" in s) return s;
  await db.updateSite(workspace.id, site.id, s);
  revalidatePath("/app/reglages");
  return { ok: "Planning enregistré." };
}

// ---------------------------------------------------------------------------
// Audit (S15)
// ---------------------------------------------------------------------------

export async function startAudit(_s?: FormState, _f?: FormData): Promise<FormState> {
  const { workspace, site } = await requireSite();
  const r = await svc.runAudit(workspace.id, site.id);
  revalidatePath("/app/audit");
  revalidatePath("/app");
  return r.ok ? { ok: `Audit terminé : ${r.value.score} sur 100.` } : { error: r.error };
}
