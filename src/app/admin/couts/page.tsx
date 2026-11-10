import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { chf, totals } from "@/lib/admin/console";
import { adminContext, loadClients, usdChf } from "@/lib/admin/context";
import { cx } from "@/lib/cx";
import { MfaScreen } from "../mfa";
import { StatusBadge } from "../ui";

export const metadata: Metadata = { title: "Coûts IA" };

/** Coût de la rédaction par client, comparé à ce qu'il paie. */
export default async function Costs() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const { clients } = await loadClients(ctx, new Date());
  const t = totals(clients);
  const list = [...clients].sort((a, b) => b.aiCost30Chf - a.aiCost30Chf);
  const perArticle = t.articles30 ? t.cost30 / t.articles30 : null;
  return (
    <>
      <PageHeader title="Coûts IA" lead={`Coût de la rédaction (Claude) sur 30 jours, converti à ${usdChf()} CHF pour 1 $ (taux indicatif, réglable : USD_CHF). Hors hébergement et mots-clés.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Coût IA (30 jours)" value={chf(t.cost30, true)} />
        <KpiCard label="Revenu mensuel" value={chf(t.mrr)} />
        <KpiCard label="Marge" value={chf(t.margin)} tone={t.margin < 0 ? "danger" : "muted"} hint={t.mrr ? `${Math.round((t.margin / t.mrr) * 100)} % du revenu` : "Pas encore de revenu"} />
        <KpiCard label="Coût moyen par article" value={perArticle != null ? chf(perArticle, true) : "—"} hint={`${t.articles30} articles en 30 jours`} />
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Coût et marge par client</caption>
          <thead className="bg-surface text-left text-text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Client</th><th className="px-4 py-2 font-semibold">État</th>
              <th className="px-4 py-2 text-right font-semibold">Articles 30 j</th><th className="px-4 py-2 text-right font-semibold">Coût 30 j</th>
              <th className="px-4 py-2 text-right font-semibold">Par article</th><th className="px-4 py-2 text-right font-semibold">Revenu</th><th className="px-4 py-2 text-right font-semibold">Marge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-surface">
                <td className="px-4 py-3"><Link href={`/admin/clients/${c.id}`} className="font-semibold hover:underline">{c.name}</Link></td>
                <td className="px-4 py-3"><StatusBadge c={c} /></td>
                <td className="px-4 py-3 text-right tabular-nums">{c.articles30d}</td>
                <td className="px-4 py-3 text-right tabular-nums">{chf(c.aiCost30Chf, true)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.costPerArticleChf != null ? chf(c.costPerArticleChf, true) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.revenueChf ? chf(c.revenueChf) : "—"}</td>
                <td className={cx("px-4 py-3 text-right tabular-nums", c.marginChf < 0 && "font-semibold text-danger")}>{chf(c.marginChf, true)}{c.marginPct != null ? ` (${c.marginPct} %)` : ""}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">Pas encore de client.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
