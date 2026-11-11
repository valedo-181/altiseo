/**
 * Quels sujets la tâche automatique doit-elle traiter maintenant ? Fonction pure, testée dans select.test.ts.
 * - mode « daily » (un passage par jour) : tout sujet dont le jour est arrivé, dans le fuseau du site ;
 * - mode « hourly » (un passage par heure) : seulement quand l'heure de publication du site est passée.
 * Jamais plus que le quota restant de l'espace, ni un sujet vieux de plus de deux jours.
 */
import { addDays, isDue, localDate } from "../domain/dates.ts";

export type DueTopic = { workspaceId: string; siteId: string; itemId: string; scheduledFor: string; publishTime: string; timezone: string; articlesLeft: number };
export type CronMode = "daily" | "hourly";
export const MAX_AGE_DAYS = 2;

export function selectDue(rows: DueTopic[], now: Date, mode: CronMode): { run: DueTopic[]; noQuota: number } {
  const left = new Map<string, number>();
  const run: DueTopic[] = [];
  let noQuota = 0;
  for (const r of [...rows].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))) {
    const today = localDate(now, r.timezone);
    if (r.scheduledFor > today || r.scheduledFor < addDays(today, -MAX_AGE_DAYS)) continue;
    if (mode === "hourly" && !isDue(r.scheduledFor, r.publishTime, now, r.timezone)) continue;
    const q = left.get(r.workspaceId) ?? r.articlesLeft;
    if (q <= 0) { noQuota++; continue; }
    left.set(r.workspaceId, q - 1);
    run.push(r);
  }
  return { run, noQuota };
}
