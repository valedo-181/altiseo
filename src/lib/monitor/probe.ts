import { connect } from "node:tls";
import { lookup } from "node:dns/promises";
import { privateIp, publicUrl, safeFetch } from "../seo/crawl.ts";
import { isUp, rdapExpiry, type CheckResult } from "./watch.ts";

/**
 * Gardien du site : vérifications réseau, côté serveur seulement. Mêmes protections que l'audit :
 * seules les adresses publiques sont lues (pas de réseau interne), délais courts.
 */

/** Le site répond-il ? GET de la page d'accueil, redirections suivies, 10 secondes au plus. */
export async function checkSite(url: string): Promise<CheckResult> {
  const r = await safeFetch(url, 10_000);
  if (r.status === 0) return { ok: false, code: null, ms: null, error: "error" in r ? r.error : "Site injoignable" };
  return { ok: isUp(r.status), code: r.status, ms: "ms" in r ? r.ms : null, error: isUp(r.status) ? null : `Erreur ${r.status}` };
}

/** Date d'expiration du certificat HTTPS du site (ISO), ou null s'il n'a pas pu être lu. */
export async function certificateExpiry(url: string, timeoutMs = 8000): Promise<string | null> {
  const u = await publicUrl(url);
  if (!u || u.protocol !== "https:") return null;
  const host = u.hostname;
  let ip: string;
  try {
    const a = await lookup(host);
    if (privateIp(a.address)) return null;
    ip = a.address;
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const sock = connect({ host: ip, port: 443, servername: host, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      const d = cert?.valid_to ? new Date(cert.valid_to) : null;
      resolve(d && !Number.isNaN(d.getTime()) ? d.toISOString() : null);
    });
    sock.on("timeout", () => { sock.destroy(); resolve(null); });
    sock.on("error", () => resolve(null));
  });
}

/**
 * Échéance du nom de domaine par RDAP (rdap.org renvoie vers le registre du domaine). Certains
 * registres, dont celui des .ch, ne publient pas cette date : null, le client la saisit alors.
 */
export async function domainExpiry(domain: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return rdapExpiry(await res.json());
  } catch {
    return null;
  }
}

/** Envoi d'une alerte par Resend (RESEND_API_KEY + ALERT_FROM). Rend false si l'envoi n'est pas configuré ou a échoué. */
export async function sendAlertEmail(to: string[], subject: string, text: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim(), from = process.env.ALERT_FROM?.trim();
  if (!key || !from || !to.length) return false;
  try {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
