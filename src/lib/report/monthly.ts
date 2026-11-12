/**
 * Rapport mensuel d'un site (offre Agence) : bornes du mois, semaines à comparer, plus fortes
 * progressions. Sans réseau ni base : testé dans monthly.test.ts.
 */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export const isMonth = (m: string) => MONTH.test(m);

/** Premier et dernier jour du mois (AAAA-MM-JJ). */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return `${NAMES[m - 1]} ${y}`; };

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mois demandé (?mois=AAAA-MM) s'il est valable et pas dans le futur, sinon le mois en cours. */
export function pickMonth(raw: string | undefined, today: string): string {
  const current = today.slice(0, 7);
  return raw && isMonth(raw) && raw <= current && raw >= "2024-01" ? raw : current;
}

/**
 * Semaines à comparer : la dernière mesurée dans le mois (« fin »), et la dernière avant le mois
 * (« début ») ; à défaut, la première du mois. `weeks` : lundis, dans n'importe quel ordre.
 */
export function compareWeeks(weeks: string[], month: string): { end: string | null; start: string | null } {
  const { from, to } = monthBounds(month);
  const sorted = [...new Set(weeks)].sort();
  const inMonth = sorted.filter((w) => w >= from && w <= to);
  const end = inMonth[inMonth.length - 1] ?? null;
  const before = sorted.filter((w) => w < from);
  const start = before[before.length - 1] ?? (inMonth.length > 1 ? inMonth[0] : null);
  return { end, start: start === end ? null : start };
}

export type Mover = { phrase: string; now: number | null; before: number | null; gain: number };

/** Plus fortes progressions (places gagnées ; entrer dans les 50 premiers compte comme 51 − place). */
export function topMovers(rows: Array<{ phrase: string; now: number | null; before: number | null }>, limit = 5): Mover[] {
  const out: Mover[] = [];
  for (const r of rows) {
    if (r.now == null) continue;
    const gain = r.before == null ? 51 - r.now : r.before - r.now;
    if (gain > 0) out.push({ ...r, gain });
  }
  return out.sort((a, b) => b.gain - a.gain || (a.now ?? 99) - (b.now ?? 99)).slice(0, limit);
}

export function totalDowntimeMs(incidents: Array<{ startedAt: string; endedAt: string | null }>, from: string, to: string, now = new Date()): number {
  const a = new Date(`${from}T00:00:00Z`).getTime(), b = new Date(`${to}T23:59:59Z`).getTime();
  let ms = 0;
  for (const i of incidents) {
    const s = Math.max(a, new Date(i.startedAt).getTime());
    const e = Math.min(b, i.endedAt ? new Date(i.endedAt).getTime() : now.getTime());
    if (e > s) ms += e - s;
  }
  return ms;
}

/** Couleur d'accent : #RRGGBB seulement (sinon celle d'Altiseo). */
export const cleanAccent = (raw: string) => (/^#[0-9a-fA-F]{6}$/.test(raw.trim()) ? raw.trim().toLowerCase() : null);

/** Logo : adresse https d'une image, 1000 caractères au plus. */
export function cleanLogoUrl(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || u.username || u.password || v.length > 1000) throw new Error();
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: "L'adresse du logo doit commencer par https:// (une image en ligne, PNG, SVG ou JPG)." };
  }
}
