import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runMonitorsDue } from "@/lib/app/monitor";
import { runAsSystem } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Gardien du site : vérifie les sites dont la dernière vérification date de plus de 4 minutes.
 * Appelée toutes les 5 minutes par Supabase (pg_cron + pg_net, voir le guide) avec
 * « Authorization: Bearer $CRON_SECRET ». Accepte GET et POST.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET manquant" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const summary = await runAsSystem(() => runMonitorsDue());
    console.log("cron.gardien", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (e) {
    console.error("cron.gardien", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Échec de la tâche" }, { status: 500 });
  }
}

export const POST = GET;
