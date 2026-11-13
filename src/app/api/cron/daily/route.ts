import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/data/store";
import { runDaily } from "@/lib/jobs/daily";
import { runAsSystem } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Tâche quotidienne de publication automatique, appelée par Vercel Cron (vercel.json) avec
 * « Authorization: Bearer $CRON_SECRET ». Sans secret configuré, ou avec un mauvais secret : refus.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET manquant" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    // Ménage des statistiques (empreintes du jour effacées après deux jours) : ne bloque pas la publication.
    await runAsSystem(() => db.analyticsPurge()).catch((e) => console.error("cron.stats.menage", e instanceof Error ? e.message : e));
    const summary = await runAsSystem(() => runDaily());
    console.log("cron.daily", JSON.stringify({ ...summary, failed: summary.failed.length }));
    for (const f of summary.failed) console.error("cron.daily.echec", f.step, f.itemId, f.error);
    return NextResponse.json({ ...summary, failed: summary.failed.length });
  } catch (e) {
    console.error("cron.daily", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche" }, { status: 500 });
  }
}
