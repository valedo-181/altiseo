import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyReportView } from "@/components/report/monthly-report";
import { requireSite } from "@/lib/app/context";
import { monthlyReport } from "@/lib/app/report";
import { localDate } from "@/lib/domain/dates";
import { pickMonth } from "@/lib/report/monthly";
import { lastMonths } from "../months";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rapport mensuel", robots: { index: false, follow: false } };

/** Le rapport du site choisi, vu depuis l'application (même page que celle du client). */
export default async function ReportPreview({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { workspace, site } = await requireSite();
  const { mois } = await searchParams;
  const today = localDate(new Date(), "Europe/Zurich");
  const r = await monthlyReport(workspace.id, site.id, pickMonth(mois, today));
  return (
    <div className="min-h-screen bg-bg text-text">
      <p className="mx-auto max-w-[860px] px-4 pt-6 text-sm md:px-8 print:hidden"><Link href="/app/rapport" className="font-semibold text-accent underline underline-offset-2">← Retour aux réglages du rapport</Link></p>
      <MonthlyReportView r={r} months={lastMonths(today.slice(0, 7), (m) => `/rapport/apercu?mois=${m}`)} />
    </div>
  );
}
