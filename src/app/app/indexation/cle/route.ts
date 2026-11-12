import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { keyFileName } from "@/lib/rank/indexnow";

export const dynamic = "force-dynamic";

/** Fichier de clé IndexNow du site, à déposer à la racine du site (téléchargement). */
export async function GET() {
  const { workspace, site } = await requireSite();
  const ix = await db.indexingOf(workspace.id, site.id);
  return new Response(ix.indexnowKey, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${keyFileName(ix.indexnowKey)}"`,
      "cache-control": "no-store",
    },
  });
}
