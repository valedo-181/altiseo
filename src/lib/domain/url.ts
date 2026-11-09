/**
 * Adresse du site saisie par le client : « Atelier-Exemple.ch/ » → « https://atelier-exemple.ch ».
 * Refuse les adresses qui ne peuvent pas être un site public (IP, localhost, nom sans point).
 */
export type UrlCheck = { ok: true; url: string; host: string } | { ok: false; error: string };

export function normalizeSiteUrl(raw: string): UrlCheck {
  let s = raw.trim();
  if (!s) return { ok: false, error: "Indiquez l'adresse de votre site." };
  if (/\s/.test(s)) return { ok: false, error: "L'adresse ne doit pas contenir d'espace." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: "Cette adresse n'est pas valide. Exemple : votre-site.ch" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "L'adresse doit commencer par https://" };
  if (u.username || u.password) return { ok: false, error: "L'adresse ne doit pas contenir d'identifiant." };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "Indiquez l'adresse publique du site, sans numéro de port." };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (/^\d+(\.\d+){3}$/.test(host) || host.includes(":")) return { ok: false, error: "Indiquez un nom de domaine, pas une adresse IP." };
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || host === "localhost") {
    return { ok: false, error: "Indiquez l'adresse publique du site, par exemple votre-site.ch" };
  }
  if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((p) => !p || p.length > 63 || p.startsWith("-") || p.endsWith("-"))) {
    return { ok: false, error: "Ce nom de domaine n'est pas valide." };
  }
  const tld = host.split(".").pop()!;
  if (!/^[a-z]{2,}$/.test(tld) && !tld.startsWith("xn--")) return { ok: false, error: "Ce nom de domaine n'est pas valide." };
  return { ok: true, url: `https://${host}`, host };
}

/** « atelier-exemple.ch » → « Atelier Exemple » ; « www.mon-site.com » → « Mon Site ». */
export function siteNameFromHost(host: string): string {
  const parts = host.replace(/^www\./, "").split(".");
  const base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Langue probable d'après le domaine (à confirmer par le client). */
export function guessLanguage(host: string): "fr" | "de" | "it" | "en" {
  const tld = host.split(".").pop();
  if (tld === "de" || tld === "at") return "de";
  if (tld === "it") return "it";
  if (tld === "com" || tld === "io" || tld === "co" || tld === "uk") return "en";
  return "fr";
}
