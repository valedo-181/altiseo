/**
 * Dates « locales » du site (AAAA-MM-JJ) : le calendrier vit dans le fuseau du site, pas en UTC,
 * pour que le changement d'heure ne décale rien.
 */

/** Jour local (AAAA-MM-JJ) d'un instant, dans un fuseau IANA. */
export function localDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Heure locale « HH:MM » d'un instant, dans un fuseau IANA. */
export function localTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-CH", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Jour ISO de la semaine : 1 = lundi … 7 = dimanche. */
export function isoWeekday(day: string): number {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Les `count` prochains jours de publication à partir de `from` (inclus). */
export function publishDates(from: string, count: number, days: number[]): string[] {
  const allowed = new Set(days.length ? days : [1, 2, 3, 4, 5, 6, 7]);
  const out: string[] = [];
  for (let d = from, guard = 0; out.length < count && guard < 400; d = addDays(d, 1), guard++) {
    if (allowed.has(isoWeekday(d))) out.push(d);
  }
  return out;
}

/** « 2026-12-03 » → « jeu. 3 déc. » */
export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("fr-CH", { ...opts, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** L'heure de publication du jour `day` est-elle passée, dans le fuseau du site ? */
export function isDue(day: string, publishTime: string, now: Date, timeZone: string): boolean {
  const today = localDate(now, timeZone);
  if (day < today) return true;
  if (day > today) return false;
  return localTime(now, timeZone) >= publishTime;
}
