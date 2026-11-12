import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runAiVisibilityDue } from "@/lib/app/geo";
import { runAsSystem } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Visibilité IA : pose chaque jour les questions des sites pas encore interrogés cette semaine (un
 * passage par site et par semaine, repris le lendemain s'il n'a pas fini). Appelée par Vercel Cron
 * (vercel.json) avec « Authorization: Bearer $CRON_SECRET ».
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET manquant" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const summary = await runAsSystem(() => runAiVisibilityDue());
    console.log("cron.visibilite_ia", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (e) {
    console.error("cron.visibilite_ia", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche" }, { status: 500 });
  }
}
