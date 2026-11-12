import "server-only";
import { config, demoMode } from "@/lib/config";
import { db, QuotaReached } from "@/lib/data/store";
import { localDate } from "@/lib/domain/dates";
import type { AiEngineName } from "@/lib/domain/types";
import { analyzeAnswer, hostOf, readiness, sampleAnswer, suggestQuestions, weekOf, type Entity } from "@/lib/geo/analyze";
import { askEngine, countryOf, engineKeys, type Fetcher } from "@/lib/geo/engines";
import { safeFetch } from "@/lib/seo/crawl";
import { AiError, proposeAiQuestions } from "@/lib/ai/claude";
import { brief, type Result } from "./service";

/**
 * Visibilité IA : questions suivies et passage de la semaine. Chaque IA est interrogée dès que sa clé
 * est sur le serveur (OPENAI_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY, ANTHROPIC_API_KEY) et que
 * l'offre la comprend. Sans aucune clé (ou en mode démo) : réponses d'exemple, marquées comme telles.
 */

const fail = (error: string): Result<never> => ({ ok: false, error });
const PARALLEL = 4;
const QUESTION_MIN = 5, QUESTION_MAX = 300, SUGGEST_AT_ONCE = 5;

export const thisWeek = (at = new Date()) => weekOf(localDate(at, "Europe/Zurich"));

/** IA réellement interrogées pour une offre : celles de l'offre dont la clé est présente. */
export function liveEngines(planEngines: AiEngineName[]): AiEngineName[] {
  if (demoMode) return [];
  const keys = engineKeys();
  return planEngines.filter((e) => Boolean(keys[e]));
}

export function cleanQuestion(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export async function addAiQuestion(workspaceId: string, siteId: string, raw: string): Promise<Result> {
  const q = cleanQuestion(raw);
  if (q.length < QUESTION_MIN) return fail("Écrivez une question d'au moins 5 caractères.");
  if (q.length > QUESTION_MAX) return fail(`La question est trop longue (${QUESTION_MAX} caractères au plus).`);
  const plan = await db.aiPlan(workspaceId);
  if (!plan.maxQuestions) return fail("Votre offre ne comprend pas la visibilité IA.");
  const existing = await db.listAiQuestions(workspaceId, siteId);
  if (existing.some((e) => e.question.toLowerCase() === q.toLowerCase())) return fail("Cette question est déjà suivie.");
  if (existing.length >= plan.maxQuestions) return fail(`Votre offre suit ${plan.maxQuestions} questions au plus. Retirez-en une ou passez à l'offre supérieure.`);
  try {
    const n = await db.addAiQuestions(workspaceId, siteId, [{ question: q, source: "manual" }]);
    return n ? { ok: true, value: undefined } : fail(`Votre offre suit ${plan.maxQuestions} questions au plus.`);
  } catch (e) {
    if (e instanceof QuotaReached) return fail(`Votre offre suit ${plan.maxQuestions} questions au plus.`);
    throw e;
  }
}

/** Ajoute des questions proposées d'après le sujet du site et les mots-clés du calendrier, jusqu'au quota. */
export async function suggestAiQuestions(workspaceId: string, siteId: string): Promise<Result<number>> {
  const [site, plan, existing, calendar] = await Promise.all([
    db.getSite(workspaceId, siteId), db.aiPlan(workspaceId), db.listAiQuestions(workspaceId, siteId), db.listCalendar(workspaceId, siteId),
  ]);
  if (!plan.maxQuestions) return fail("Votre offre ne comprend pas la visibilité IA.");
  const room = plan.maxQuestions - existing.length;
  if (room <= 0) return fail(`Vous suivez déjà ${plan.maxQuestions} questions, le maximum de votre offre.`);
  // 5 à la fois : le client relit et garde celles qui lui ressemblent, plutôt que de remplir tout le quota.
  const want = Math.min(room, SUGGEST_AT_ONCE);
  const keywords = calendar.map((c) => c.keyword).filter(Boolean);
  let list: string[] = [];
  if (config.ai) {
    try {
      list = (await proposeAiQuestions(await brief(workspaceId, site), keywords, want, existing.map((e) => e.question))).questions;
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      console.error("geo.suggest", e.message);
    }
  }
  if (!list.length) list = suggestQuestions({ theme: site.theme, keywords, language: site.language, existing: existing.map((e) => e.question) }, want);
  if (!list.length) return fail("Pas de question à proposer : indiquez le sujet du site dans les réglages, ou écrivez vos questions.");
  const n = await db.addAiQuestions(workspaceId, siteId, list.map((question) => ({ question, source: "suggested" as const })));
  return { ok: true, value: n };
}

async function siteReadiness(url: string) {
  const base = url.replace(/\/+$/, "");
  const [robots, llms, home] = await Promise.all([safeFetch(`${base}/robots.txt`), safeFetch(`${base}/llms.txt`), safeFetch(base)]);
  const ok = (r: Awaited<ReturnType<typeof safeFetch>>) => r.status >= 200 && r.status < 300 && "body" in r;
  return readiness({
    robots: ok(robots) && "body" in robots ? robots.body : null,
    llmsTxt: ok(llms) && "body" in llms && llms.body.trim().length > 20 && !/<html/i.test(llms.body),
    homeHtml: ok(home) && "body" in home ? home.body : null,
  });
}

export type AiRunSummary = { asked: number; errors: number; remaining: number; demo: boolean };

/**
 * Passage de la semaine pour un site : pose chaque question suivie à chaque IA, et garde la réponse lue.
 * Reprend là où un passage précédent s'est arrêté (seules les paires question × IA sans réponse de la
 * semaine sont posées). `budgetMs` : on ne lance plus de question après ce délai.
 */
export async function runAiVisibility(workspaceId: string, siteId: string, opts: { budgetMs?: number; fetcher?: Fetcher; now?: Date } = {}): Promise<Result<AiRunSummary>> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const plan = await db.aiPlan(workspaceId);
  if (!plan.maxQuestions || !plan.engines.length) return fail("Votre offre ne comprend pas la visibilité IA.");
  const [site, questionsAll, rivals] = await Promise.all([db.getSite(workspaceId, siteId), db.listAiQuestions(workspaceId, siteId), db.listCompetitors(workspaceId, siteId)]);
  const questions = questionsAll.slice(0, plan.maxQuestions);
  if (!questions.length) return fail("Ajoutez d'abord les questions à poser aux IA.");

  const live = liveEngines(plan.engines);
  const demo = live.length === 0;
  const engines = demo ? plan.engines : live;
  const week = thisWeek(opts.now);
  const run = await db.claimAiRun(workspaceId, siteId, week, demo);
  if (!run) return fail("Les IA ont déjà été interrogées cette semaine. Prochain passage lundi.");

  const domain = hostOf(site.url) ?? site.url;
  const me: Entity = { name: site.name || domain, domain };
  const competitors: Entity[] = rivals.map((c) => ({ name: c.name || hostOf(c.url) || c.url, domain: hostOf(c.url) ?? "" })).filter((c) => c.domain);

  if (!run.readiness) {
    const r = demo && demoMode ? { blockedBots: [], llmsTxt: false, faq: false, organization: true } : await siteReadiness(site.url).catch(() => null);
    if (r) await db.updateAiRun(workspaceId, siteId, run.id, { readiness: r });
  }

  const done = new Set((await db.listAiChecks(workspaceId, siteId, [week])).map((c) => `${c.questionId}|${c.engine}`));
  const queue = questions.flatMap((q) => engines.map((engine) => ({ q, engine }))).filter((p) => !done.has(`${p.q.id}|${p.engine}`));
  const keys = engineKeys();
  const f: Fetcher = opts.fetcher ?? ((u, i) => fetch(u, i));
  const country = countryOf(domain);
  const sum: AiRunSummary = { asked: 0, errors: 0, remaining: 0, demo };

  const one = async ({ q, engine }: (typeof queue)[number]) => {
    const answer = demo
      ? { ok: true as const, value: sampleAnswer(q.question, engine, me, competitors, week) }
      : await askEngine(engine, f, keys[engine]!, q.question, country);
    sum.asked++;
    if (!answer.ok) {
      sum.errors++;
      await db.saveAiCheck(workspaceId, siteId, { questionId: q.id, engine, week, status: "error", cited: false, position: null, linked: false, competitors: [], sources: [], excerpt: null, error: answer.error, demo });
      return;
    }
    const r = analyzeAnswer(answer.value, me, competitors);
    await db.saveAiCheck(workspaceId, siteId, { questionId: q.id, engine, week, status: "ok", cited: r.cited, position: r.position, linked: r.linked, competitors: r.competitors, sources: r.sources, excerpt: r.excerpt, error: null, demo });
  };
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > budget) return;
      const p = queue.shift();
      if (!p) return;
      await one(p).catch((e) => { sum.errors++; console.error("geo.question", p.engine, e instanceof Error ? e.message : e); });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  sum.remaining = queue.length;
  if (!sum.remaining) await db.updateAiRun(workspaceId, siteId, run.id, { status: "done", finished: true });
  return { ok: true, value: sum };
}

export type AiVisibilityPass = { sites: number; asked: number; errors: number; unfinished: number };

/** Tâche de fond : tous les sites à interroger cette semaine, tant qu'il reste du temps. */
export async function runAiVisibilityDue(budgetMs = 250_000): Promise<AiVisibilityPass> {
  const started = Date.now();
  const due = await db.aiVisibilityDue();
  const out: AiVisibilityPass = { sites: 0, asked: 0, errors: 0, unfinished: 0 };
  for (const d of due) {
    const left = budgetMs - (Date.now() - started);
    if (left < 20_000) { out.unfinished++; continue; }
    const r = await runAiVisibility(d.workspaceId, d.siteId, { budgetMs: left - 15_000 }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    out.sites++;
    if (!r.ok) { out.errors++; console.error("geo.site", d.siteId, r.error); continue; }
    out.asked += r.value.asked;
    out.errors += r.value.errors;
    if (r.value.remaining) out.unfinished++;
  }
  return out;
}

export const geoConfigured = () => !demoMode && Object.values(engineKeys()).some(Boolean) && config.supabaseAdmin;
