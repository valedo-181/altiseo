import "server-only";
import { publishArticle, writeArticleForTopic } from "@/lib/app/service";
import { cronMode } from "@/lib/config";
import { db } from "@/lib/data/store";
import { selectDue, type DueTopic } from "./select";

export type DailySummary = {
  due: number; // sujets à traiter à ce passage
  written: number;
  sent: number; // envoyés au site du client (brouillon ou publié, selon son réglage)
  failed: Array<{ itemId: string; step: "write" | "send"; error: string }>;
  noQuota: number;
  postponed: number; // pas eu le temps : repris au prochain passage
};

const PARALLEL = 3;

/**
 * Publication automatique : écrit l'article de chaque sujet arrivé à son jour, puis l'envoie au site
 * si une intégration est connectée (brouillon ou publié, selon le réglage du site). Sans intégration,
 * l'article reste en brouillon dans Altiseo.
 * Un sujet est réservé avant l'écriture (pas de doublon si deux passages se croisent) ; en cas d'échec
 * il est rendu et repris au passage suivant, pendant deux jours.
 * `startBeforeMs` : on ne commence plus d'article après ce délai (un article prend une à trois minutes).
 */
export async function runDaily(now = new Date(), startBeforeMs = 120_000): Promise<DailySummary> {
  const started = Date.now();
  const { run, noQuota } = selectDue(await db.automationDue(), now, cronMode);
  const sum: DailySummary = { due: run.length, written: 0, sent: 0, failed: [], noQuota, postponed: 0 };
  const queue = [...run];

  const one = async (t: DueTopic) => {
    if (!(await db.claimTopic(t.workspaceId, t.itemId))) return; // pris par un autre passage
    let articleId: string;
    try {
      const w = await writeArticleForTopic(t.workspaceId, t.itemId);
      if (!w.ok) throw new Error(w.error);
      articleId = w.value;
    } catch (e) {
      await db.releaseTopic(t.workspaceId, t.itemId).catch(() => undefined);
      sum.failed.push({ itemId: t.itemId, step: "write", error: (e as Error).message });
      return;
    }
    sum.written++;
    try {
      const ready = (await db.listIntegrations(t.workspaceId, t.siteId)).some((i) => i.status === "ok");
      if (!ready) return;
      const p = await publishArticle(t.workspaceId, articleId);
      if (p.ok) sum.sent++;
      else sum.failed.push({ itemId: t.itemId, step: "send", error: p.error });
    } catch (e) {
      sum.failed.push({ itemId: t.itemId, step: "send", error: (e as Error).message });
    }
  };

  const worker = async () => {
    for (;;) {
      if (Date.now() - started > startBeforeMs) return;
      const t = queue.shift();
      if (!t) return;
      await one(t);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  sum.postponed = queue.length;
  return sum;
}
