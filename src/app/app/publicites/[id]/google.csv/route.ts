import { NextResponse, type NextRequest } from "next/server";
import { googleEditorCsv, landingUrl } from "@/lib/ads/format";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";

/** Fichier à importer dans Google Ads Editor : l'annonce et ses mots-clés, dans une campagne en pause. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, site } = await requireSite();
  const article = await db.getArticle(workspace.id, id).catch(() => null);
  const d = article && article.siteId === site.id ? await db.adDraftOf(workspace.id, article.id) : null;
  if (!article || !d) return new NextResponse("Introuvable", { status: 404 });
  const csv = googleEditorCsv({ campaign: `Altiseo - ${site.name}`.slice(0, 120), adGroup: article.title.slice(0, 120), url: landingUrl(d.landingUrl, "google", article.slug), ad: d.google });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="google-ads-${article.slug.slice(0, 60)}.csv"`, "cache-control": "no-store" } });
}
