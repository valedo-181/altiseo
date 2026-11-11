/**
 * Création d'image par l'API Higgsfield (api.higgsfield.ai) : on dépose la demande, on suit son état,
 * puis on télécharge le résultat. Clé : « Authorization: Key <id>:<secret> », côté serveur seulement.
 * Le format exact de la réponse varie selon le modèle : la lecture est tolérante (voir findImageUrl).
 * La clé ne sort jamais dans les messages d'erreur.
 */
const API = "https://api.higgsfield.ai";
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type ImageResult = { ok: true; bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp" } | { ok: false; error: string };
export type HiggsfieldOptions = {
  keyId: string; keySecret: string;
  model?: string; // chemin du modèle, ex. « z-image/turbo »
  resolution?: string;
  fetcher?: Fetcher;
  pollMs?: number; timeoutMs?: number;
  /** Vérifie que l'adresse du résultat est publique (pas d'adresse interne). */
  isPublic?: (url: string) => Promise<boolean>;
};

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const DONE = new Set(["completed", "succeeded", "success"]);
const DEAD: Record<string, string> = {
  failed: "La création de l'image a échoué chez Higgsfield. Réessayez.",
  nsfw: "L'image a été refusée par le filtre de contenu. Réessayez : une autre image sera proposée.",
  canceled: "La création de l'image a été annulée.",
  cancelled: "La création de l'image a été annulée.",
};

/** Première adresse d'image trouvée dans la réponse (images[].url, image.url, output…), hors liens de suivi. */
export function findImageUrl(body: unknown): string | null {
  const found: string[] = [];
  const walk = (v: unknown, key: string, depth: number) => {
    if (depth > 6 || found.length > 20) return;
    if (typeof v === "string") {
      if (/^https:\/\//.test(v) && !/status|cancel|webhook/i.test(key)) found.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key, depth + 1));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k, depth + 1);
  };
  walk(body, "", 0);
  return found.find((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u)) ?? found[0] ?? null;
}

/**
 * La clé telle qu'elle part dans l'en-tête. Tolère les guillemets et les espaces collés par mégarde,
 * et la clé entière « id:secret » mise dans une seule des deux variables. null = inutilisable
 * (un caractère interdit dans un en-tête ferait échouer l'envoi sans explication).
 */
export function higgsfieldKey(keyId: string, keySecret: string): string | null {
  const tidy = (v: string) => v.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  const id = tidy(keyId), secret = tidy(keySecret);
  const key = id.includes(":") ? id : secret.includes(":") ? secret : id && secret ? `${id}:${secret}` : "";
  return /^[\x21-\x7e]{8,400}$/.test(key) && /^[^:]+:[^:]+$/.test(key) ? key : null;
}

/** Pourquoi l'appel n'a pas abouti, sans rien révéler de la clé : délai, nom introuvable, connexion refusée… */
function netError(e: unknown, what: string): string {
  const err = e as { name?: string; cause?: { code?: string } };
  const code = err?.name === "TimeoutError" || err?.name === "AbortError" ? "délai dépassé" : err?.cause?.code ?? err?.name ?? "erreur réseau";
  console.error("higgsfield", what, code);
  return `Higgsfield ne répond pas (${code}). Réessayez dans un instant.`;
}

/** Message d'erreur renvoyé par l'API (pour ajuster modèle et paramètres), raccourci et sans la clé. */
function apiDetail(body: Record<string, unknown>, key: string): string {
  const raw = body.detail ?? body.message ?? body.error ?? "";
  const text = (typeof raw === "string" ? raw : JSON.stringify(raw)).split(key).join("…").replace(/\s+/g, " ").trim().slice(0, 200);
  return text ? ` : ${text}` : "";
}

export async function generateImage(prompt: string, o: HiggsfieldOptions): Promise<ImageResult> {
  const f = o.fetcher ?? fetch;
  const key = higgsfieldKey(o.keyId, o.keySecret);
  if (!key) return { ok: false, error: "La clé Higgsfield n'a pas la bonne forme. Dans Vercel, HIGGSFIELD_KEY_ID doit contenir l'identifiant et HIGGSFIELD_KEY_SECRET le secret, sans espace ni guillemet." };
  const model = (o.model || "z-image/turbo").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9._-]+(\/[a-z0-9._-]+){0,4}$/i.test(model)) return { ok: false, error: "Le modèle d'image configuré n'est pas valide." };
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "altiseo/1.0" };
  const timeoutMs = o.timeoutMs ?? 90_000, pollMs = o.pollMs ?? 3000, t0 = Date.now();
  const json = async (r: Response) => { try { return (await r.json()) as Record<string, unknown>; } catch { return {}; } };

  let res: Response;
  try {
    res = await f(`${API}/${model}`, { method: "POST", headers, body: JSON.stringify({ prompt, aspect_ratio: "16:9", resolution: o.resolution || "1k" }), signal: AbortSignal.timeout(90_000), redirect: "manual" });
  } catch (e) {
    return { ok: false, error: netError(e, "depot") };
  }
  if (res.status >= 300 && res.status < 400) return { ok: false, error: `Higgsfield renvoie vers une autre adresse (${res.status}) : le modèle « ${model} » est sans doute mal écrit.` };
  if (res.status === 401 || res.status === 403) return { ok: false, error: "Higgsfield refuse la clé d'accès. Vérifiez HIGGSFIELD_KEY_ID et HIGGSFIELD_KEY_SECRET." };
  if (res.status === 402) return { ok: false, error: "Le solde Higgsfield est épuisé : rechargez-le pour créer des images." };
  if (res.status === 429) return { ok: false, error: "Higgsfield limite les demandes pour le moment. Réessayez dans quelques minutes." };
  let body = await json(res);
  if (res.status === 404) return { ok: false, error: `Higgsfield ne connaît pas le modèle d'image « ${model} » (HIGGSFIELD_IMAGE_MODEL).` };
  if (!res.ok) return { ok: false, error: `Higgsfield a refusé la demande (${res.status})${apiDetail(body, key)}.` };

  const id = String(body.request_id ?? body.id ?? "");
  const given = typeof body.status_url === "string" ? body.status_url : "";
  const statusUrl = given.startsWith(`${API}/`) ? given : /^[A-Za-z0-9_-]{6,80}$/.test(id) ? `${API}/requests/${id}/status` : "";
  for (;;) {
    const status = String(body.status ?? "").toLowerCase();
    if (DEAD[status]) return { ok: false, error: DEAD[status] };
    if (DONE.has(status) || (!status && findImageUrl(body))) break;
    if (!statusUrl) return { ok: false, error: "Réponse inattendue de Higgsfield (pas de suivi possible)." };
    if (Date.now() - t0 > timeoutMs) return { ok: false, error: "L'image met trop de temps à arriver. Réessayez." };
    await new Promise((r) => setTimeout(r, pollMs));
    try {
      const r = await f(statusUrl, { method: "GET", headers, signal: AbortSignal.timeout(20_000), redirect: "manual" });
      if (!r.ok) return { ok: false, error: `Higgsfield a renvoyé une erreur pendant le suivi (${r.status}).` };
      body = await json(r);
    } catch (e) {
      return { ok: false, error: netError(e, "suivi") };
    }
  }

  const url = findImageUrl(body);
  if (!url) return { ok: false, error: "Higgsfield n'a pas renvoyé d'image." };
  if (o.isPublic && !(await o.isPublic(url))) return { ok: false, error: "L'adresse de l'image n'est pas valide." };
  try {
    const img = await f(url, { method: "GET", signal: AbortSignal.timeout(45_000), redirect: "follow" });
    const type = (img.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const contentType = TYPES.find((t) => t === type);
    if (!img.ok || !contentType) return { ok: false, error: "Le fichier reçu n'est pas une image utilisable." };
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return { ok: false, error: "L'image reçue est vide ou trop lourde." };
    return { ok: true, bytes, contentType };
  } catch (e) {
    netError(e, "telechargement");
    return { ok: false, error: "L'image a été créée, mais n'a pas pu être téléchargée. Réessayez." };
  }
}
