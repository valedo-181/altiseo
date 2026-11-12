import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runPositionsDue } from "@/lib/app/positions";
import { sendReportsDue } from "@/lib/app/report";
import { runAsSystem } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Positions Google et indexation : chaque matin, mesure les mots-clés des sites pas encore mesurés
 * cette semaine (repris le lendemain si le passage n'a pas fini), puis relit chez Google l'état
 * d'indexation des pages vues il y a plus de 7 jours. Envoie aussi, le 1er du mois, le lien du rapport
 * mensuel aux clients des agences. Appelée par Vercel Cron (vercel.json) avec
 * « Authorization: Bearer $CRON_SECRET ».
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET manquant" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const summary = await runAsSystem(async () => ({ reports: await sendReportsDue(), ...(await runPositionsDue()) }));
    console.log("cron.positions", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (e) {
    console.error("cron.positions", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche" }, { status: 500 });
  }
}
