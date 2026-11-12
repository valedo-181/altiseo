import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthlyReportView } from "@/components/report/monthly-report";
import { monthlyReport, reportPath } from "@/lib/app/report";
import { db } from "@/lib/data/store";
import { localDate } from "@/lib/domain/dates";
import { pickMonth } from "@/lib/report/monthly";
import { runAsSystem } from "@/lib/supabase/server";
import { lastMonths } from "../months";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rapport mensuel", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Lien du client final : lecture seule, sans compte, tant que l'agence garde le partage actif. */
export default async function SharedReport({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ mois?: string }> }) {
  const [{ token }, { mois }] = await Promise.all([params, searchParams]);
  const at = await db.reportByToken(token);
  if (!at) notFound();
  const today = localDate(new Date(), "Europe/Zurich");
  const month = pickMonth(mois, today);
  const r = await runAsSystem(() => monthlyReport(at.workspaceId, at.siteId, month));
  return <div className="min-h-screen bg-bg text-text"><MonthlyReportView r={r} months={lastMonths(today.slice(0, 7), (m) => reportPath(token, m))} /></div>;
}
