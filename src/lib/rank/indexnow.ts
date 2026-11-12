/**
 * IndexNow : signale les pages nouvelles ou modifiées à Bing, Yandex, Seznam, Naver et Yep (un seul
 * envoi les prévient tous). Google ne lit pas IndexNow : pour lui, Altiseo relit l'état d'indexation
 * dans Search Console (inspection d'URL). Le site prouve qu'il est à vous par un fichier texte à sa
 * racine, nommé d'après la clé et qui contient la clé.
 */

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export const MAX_URLS = 100;

export const keyFileName = (key: string) => `${key}.txt`;
export function keyFileUrl(siteUrl: string, key: string): string {
  const u = new URL(siteUrl);
  return `${u.protocol}//${u.host}/${keyFileName(key)}`;
}

/** Le fichier lu sur le site contient-il exactement la clé ? (une ligne, espaces ignorés) */
export const keyMatches = (body: string, key: string) => body.trim() === key;

/**
 * Adresses à envoyer, collées par la personne (une par ligne, ou séparées par des espaces) :
 * seules celles du site sont gardées, sans doublon, 100 au plus.
 */
export function parseUrls(raw: string, siteUrl: string): { urls: string[]; rejected: string[] } {
  const host = new URL(siteUrl).hostname.toLowerCase();
  const urls: string[] = [], rejected: string[] = [];
  for (const part of raw.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(part) ? part : `https://${part}`);
    } catch {
      rejected.push(part);
      continue;
    }
    if (u.hostname.toLowerCase() !== host || u.username || u.password) { rejected.push(part); continue; }
    u.hash = "";
    const s = u.toString();
    if (!urls.includes(s)) urls.push(s);
  }
  return { urls: urls.slice(0, MAX_URLS), rejected };
}

/** Ce que veut dire la réponse d'IndexNow, en clair. */
export function indexNowMessage(status: number): { ok: boolean; message: string } {
  if (status === 200) return { ok: true, message: "Pages signalées." };
  if (status === 202) return { ok: true, message: "Pages reçues ; la clé est en cours de vérification chez IndexNow." };
  if (status === 400) return { ok: false, message: "Demande refusée par IndexNow (format)." };
  if (status === 403) return { ok: false, message: "Clé refusée : le fichier de clé n'est pas trouvé sur le site." };
  if (status === 422) return { ok: false, message: "Ces adresses ne sont pas sur le site de la clé." };
  if (status === 429) return { ok: false, message: "Trop d'envois : IndexNow demande d'attendre un peu." };
  return { ok: false, message: `IndexNow a renvoyé une erreur (${status}).` };
}

export async function submitIndexNow(f: Fetcher, siteUrl: string, key: string, urls: string[]): Promise<{ status: number; ok: boolean; message: string }> {
  const u = new URL(siteUrl);
  try {
    const res = await f("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: u.hostname, key, keyLocation: keyFileUrl(siteUrl, key), urlList: urls.slice(0, MAX_URLS) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    return { status: res.status, ...indexNowMessage(res.status) };
  } catch {
    return { status: 0, ok: false, message: "IndexNow ne répond pas. Réessayez dans un instant." };
  }
}
