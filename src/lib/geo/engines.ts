/**
 * Questions posées aux IA par leurs API officielles, avec la recherche web activée (comme le fait un
 * vrai utilisateur) : ChatGPT (OpenAI Responses + web_search), Gemini (Google Search), Perplexity
 * (Sonar), Claude (outil web_search). Chaque fonction rend le texte de la réponse et les adresses
 * citées. Les clés ne sortent jamais dans les messages d'erreur. Testé dans geo.test.ts (faux réseau).
 */
import type { AiAnswer, AiEngine } from "./analyze.ts";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type EngineKeys = Partial<Record<AiEngine, string>>;
export type AskResult = { ok: true; value: AiAnswer } | { ok: false; error: string };

const TIMEOUT_MS = 90_000;

/** Modèles utilisés (réglables par variable d'environnement). */
export const MODELS: Record<AiEngine, string> = {
  chatgpt: process.env.OPENAI_GEO_MODEL?.trim() || "gpt-5-mini",
  gemini: process.env.GEMINI_GEO_MODEL?.trim() || "gemini-2.5-flash",
  perplexity: process.env.PERPLEXITY_GEO_MODEL?.trim() || "sonar",
  claude: process.env.CLAUDE_GEO_MODEL?.trim() || "claude-sonnet-5-5",
};

/** Clés présentes sur ce serveur. Claude reprend la clé de la rédaction. */
export function engineKeys(env: Record<string, string | undefined> = process.env): EngineKeys {
  const k = (v?: string) => v?.trim() || undefined;
  return { chatgpt: k(env.OPENAI_API_KEY), gemini: k(env.GEMINI_API_KEY), perplexity: k(env.PERPLEXITY_API_KEY), claude: k(env.ANTHROPIC_API_KEY) };
}

/** Pays approximatif du site, d'après son domaine (pour que la recherche se fasse « depuis » ce pays). */
export function countryOf(domain: string): string | null {
  const tld = domain.split(".").pop()?.toLowerCase();
  return ({ ch: "CH", fr: "FR", de: "DE", it: "IT", at: "AT", be: "BE", lu: "LU" } as Record<string, string>)[tld ?? ""] ?? null;
}

type J = Record<string, unknown>;
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function post(f: Fetcher, url: string, headers: Record<string, string>, body: unknown, who: string): Promise<{ ok: true; json: J } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await f(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? `${who} n'a pas répondu à temps.` : `${who} ne répond pas.` };
  }
  const json = (await res.json().catch(() => ({}))) as J;
  if (res.status === 401 || res.status === 403) return { ok: false, error: `Clé API ${who} refusée.` };
  if (res.status === 429) return { ok: false, error: `${who} est très demandé ou le crédit est épuisé (429).` };
  if (!res.ok) return { ok: false, error: `${who} a renvoyé une erreur (${res.status}).` };
  return { ok: true, json };
}

/** ChatGPT : API Responses d'OpenAI, outil web_search. Sources = annotations url_citation. */
export async function askChatGpt(f: Fetcher, key: string, question: string, country: string | null): Promise<AskResult> {
  const r = await post(f, "https://api.openai.com/v1/responses", { authorization: `Bearer ${key}` }, {
    model: MODELS.chatgpt,
    input: question,
    tools: [{ type: "web_search", ...(country ? { user_location: { type: "approximate", country } } : {}) }],
  }, "ChatGPT");
  if (!r.ok) return r;
  let text = "";
  const sources: string[] = [];
  for (const item of arr(r.json.output)) {
    if (item.type !== "message") continue;
    for (const c of arr(item.content)) {
      if (c.type !== "output_text") continue;
      text += str(c.text);
      for (const a of arr(c.annotations)) if (a.type === "url_citation" && str(a.url)) sources.push(str(a.url));
    }
  }
  return text ? { ok: true, value: { text, sources } } : { ok: false, error: "ChatGPT n'a pas donné de réponse." };
}

/**
 * Gemini : generateContent avec l'outil google_search. Google donne des adresses de redirection ;
 * le titre de chaque source est le domaine du site cité : on le garde comme adresse.
 */
export async function askGemini(f: Fetcher, key: string, question: string): Promise<AskResult> {
  const r = await post(f, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODELS.gemini)}:generateContent`, { "x-goog-api-key": key }, {
    contents: [{ role: "user", parts: [{ text: question }] }],
    tools: [{ google_search: {} }],
  }, "Gemini");
  if (!r.ok) return r;
  const cand = arr(r.json.candidates)[0] ?? {};
  const text = arr((cand.content as J | undefined)?.parts).map((p) => str(p.text)).join("");
  const sources = arr((cand.groundingMetadata as J | undefined)?.groundingChunks)
    .map((c) => (c.web as J | undefined) ?? {})
    .map((w) => { const t = str(w.title).trim(); return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) ? `https://${t}/` : str(w.uri); })
    .filter(Boolean);
  return text ? { ok: true, value: { text, sources } } : { ok: false, error: "Gemini n'a pas donné de réponse." };
}

/** Perplexity : API Sonar (compatible chat). Sources = search_results, sinon citations. */
export async function askPerplexity(f: Fetcher, key: string, question: string, country: string | null): Promise<AskResult> {
  const r = await post(f, "https://api.perplexity.ai/chat/completions", { authorization: `Bearer ${key}` }, {
    model: MODELS.perplexity,
    messages: [{ role: "user", content: question }],
    ...(country ? { web_search_options: { user_location: { country } } } : {}),
  }, "Perplexity");
  if (!r.ok) return r;
  const msg = (arr(r.json.choices)[0]?.message as J | undefined) ?? {};
  const text = str(msg.content);
  const fromResults = arr(r.json.search_results).map((s) => str(s.url)).filter(Boolean);
  const sources = fromResults.length ? fromResults : (Array.isArray(r.json.citations) ? (r.json.citations as unknown[]).map(str).filter(Boolean) : []);
  return text ? { ok: true, value: { text, sources } } : { ok: false, error: "Perplexity n'a pas donné de réponse." };
}

/** Claude : API Messages d'Anthropic, outil web_search. Sources = citations du texte et résultats de recherche. */
export async function askClaude(f: Fetcher, key: string, question: string, country: string | null): Promise<AskResult> {
  const r = await post(f, "https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
    model: MODELS.claude,
    max_tokens: 2000,
    messages: [{ role: "user", content: question }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, ...(country ? { user_location: { type: "approximate", country } } : {}) }],
  }, "Claude");
  if (!r.ok) return r;
  let text = "";
  const cited: string[] = [];
  const found: string[] = [];
  for (const b of arr(r.json.content)) {
    if (b.type === "text") {
      text += str(b.text);
      for (const c of arr(b.citations)) if (str(c.url)) cited.push(str(c.url));
    }
    if (b.type === "web_search_tool_result") for (const x of arr(b.content)) if (str(x.url)) found.push(str(x.url));
  }
  return text ? { ok: true, value: { text, sources: [...cited, ...found] } } : { ok: false, error: "Claude n'a pas donné de réponse." };
}

export function askEngine(engine: AiEngine, f: Fetcher, key: string, question: string, country: string | null): Promise<AskResult> {
  switch (engine) {
    case "chatgpt": return askChatGpt(f, key, question, country);
    case "gemini": return askGemini(f, key, question);
    case "perplexity": return askPerplexity(f, key, question, country);
    case "claude": return askClaude(f, key, question, country);
  }
}
