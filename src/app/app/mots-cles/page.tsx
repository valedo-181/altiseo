import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowDownRight, ArrowUpRight, LineChart as ChartIcon, Minus, Sparkles } from "lucide-react";
import { disconnectSearch } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { syncSearch } from "@/lib/app/service";
import { config } from "@/lib/config";
import { db } from "@/lib/data/store";
import type { SearchQuery } from "@/lib/domain/types";
import { findQuery, percentChange, positionGain } from "@/lib/search/report";
import { ConnectDemo, RefreshSearch } from "./buttons";
import { SearchCharts } from "./charts";

export const metadata: Metadata = { title: "Mots-clés" };
export const maxDuration = 60;

const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const when = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Zurich" });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", timeZone: "UTC" });
const STALE_MS = 24 * 3600_000;
const TABLE_ROWS = 50;

/** Évolution d'une position : la flèche et le texte disent la même chose (jamais la couleur seule). */
function Trend({ q }: { q: Pick<SearchQuery, "position" | "prevPosition"> }) {
  const gain = positionGain(q);
  if (gain == null) return <span className="pill bg-info-soft text-info"><Sparkles aria-hidden="true" className="size-3" />Nouveau</span>;
  if (Math.abs(gain) < 0.5) return <span className="inline-flex items-center gap-1 text-text-muted"><Minus aria-hidden="true" className="size-4" />Stable</span>;
  const up = gain > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const places = nf.format(Math.abs(gain));
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-success" : "text-danger"}`}>
      <Icon aria-hidden="true" className="size-4" />
      <span className="text-text">{up ? "+" : "−"}{places}</span>
      <span className="sr-only">{up ? "monté" : "descendu"} de {places} place{Math.abs(gain) >= 2 ? "s" : ""}</span>
    </span>
  );
}

function delta(now: number, before: number): { hint: string; tone: "success" | "danger" | "muted" } {
  const p = percentChange(now, before);
  if (p == null) return { hint: "Pas de comparaison possible", tone: "muted" };
  if (p === 0) return { hint: "Comme les 28 jours d'avant", tone: "muted" };
  return { hint: `${p > 0 ? "+" : "−"}${Math.abs(p)} % par rapport aux 28 jours d'avant`, tone: p > 0 ? "success" : "danger" };
}

/** S24 : suivi des mots-clés, d'après Google Search Console. */
export default async function Keywords() {
  const { workspace, site } = await requireSite();
  const host = site.url.replace("https://", "");
  const flashRaw = (await cookies()).get("altiseo_gsc_message")?.value;
  const flash = flashRaw ? decodeURIComponent(flashRaw).slice(0, 400) : null;
  let conn = await db.searchConnection(workspace.id, site.id);

  if (!conn) {
    return (
      <>
        <PageHeader title="Mots-clés" lead={`Les recherches Google qui amènent des visiteurs sur ${host}, et leur évolution.`} />
        {flash && <Banner tone="danger">{flash}</Banner>}
        <EmptyState
          icon={ChartIcon}
          title="Connectez Google Search Console"
          action={config.search
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            ? <a href="/app/mots-cles/google/connect" className={buttonClass("primary")}>Connecter mon compte Google</a>
            : <ConnectDemo />}
        >
          Search Console est l'outil gratuit de Google qui sait sur quelles recherches votre site apparaît. Altiseo y lit vos positions, vos clics et vos affichages. Accès en lecture seule : rien n'est modifié chez Google.
        </EmptyState>
        {!config.search && <p className="text-center text-xs text-text-muted">La connexion à Google n'est pas encore configurée sur ce serveur : vous pouvez voir la page avec des chiffres d'exemple.</p>}
        <Card>
          <h2 className="font-semibold">Avant de connecter</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
            <li>Votre site doit être ajouté et validé dans Google Search Console (search.google.com/search-console).</li>
            <li>Connectez le compte Google qui gère ce site.</li>
            <li>Un site tout juste ajouté n'a pas encore de chiffres : Google met quelques jours à les montrer.</li>
          </ul>
        </Card>
      </>
    );
  }

  // Google actualise ses chiffres une fois par jour : on les relit au plus une fois par 24 heures.
  if (conn.status === "ok" && (!conn.lastSyncedAt || Date.now() - new Date(conn.lastSyncedAt).getTime() > STALE_MS)) {
    await syncSearch(workspace.id, site.id, { force: true }).catch(() => undefined);
    conn = (await db.searchConnection(workspace.id, site.id)) ?? conn;
  }
  const [report, calendar, articles] = await Promise.all([db.searchReport(workspace.id, site.id), db.listCalendar(workspace.id, site.id), db.listArticles(workspace.id, site.id)]);

  const actions = (
    <>
      {conn.status === "ok" && <RefreshSearch />}
      <form action={disconnectSearch}><button className={buttonClass("ghost")}>Déconnecter Google</button></form>
    </>
  );
  const property = conn.property.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (conn.status === "error" || !report) {
    return (
      <>
        <PageHeader title="Mots-clés" lead={`Google Search Console, ${property}.`} actions={actions} />
        <Banner tone="danger" action={config.search
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          ? <a href="/app/mots-cles/google/connect" className={buttonClass("secondary", "sm")}>Reconnecter Google</a> : undefined}>
          {conn.lastError ?? flash ?? "Les chiffres n'ont pas pu être lus chez Google."}
        </Banner>
      </>
    );
  }

  const { current: cur, previous: prev } = report;
  const clicks = delta(cur.clicks, prev.clicks), imps = delta(cur.impressions, prev.impressions);
  const posGain = cur.position != null && prev.position != null ? Math.round((prev.position - cur.position) * 10) / 10 : null;
  const byItem = new Map(articles.filter((a) => a.calendarItemId).map((a) => [a.calendarItemId!, a]));
  const targets = calendar.filter((c) => c.keyword.trim()).map((c) => ({ item: c, article: byItem.get(c.id) ?? null, hit: findQuery(report.queries, c.keyword) }))
    .filter((t) => t.article || t.hit).sort((a, b) => (a.hit?.position ?? 999) - (b.hit?.position ?? 999)).slice(0, 30);
  const rows = report.queries.slice(0, TABLE_ROWS);

  return (
    <>
      <PageHeader
        title="Mots-clés"
        lead={<>Google Search Console, {property}. Chiffres jusqu'au {dayFmt.format(new Date(`${report.to}T12:00:00Z`))}{conn.lastSyncedAt ? <>, lus le {when.format(new Date(conn.lastSyncedAt))}</> : null}.</>}
        actions={actions}
      />
      {flash && <Banner tone="danger">{flash}</Banner>}
      {conn.demo && <Banner tone="info"><strong className="font-semibold">Chiffres d'exemple :</strong> ils ne viennent pas de Google. Ils montrent à quoi ressemblera la page une fois votre compte connecté.</Banner>}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Clics, 28 derniers jours" value={nf.format(cur.clicks)} hint={clicks.hint} tone={clicks.tone} />
        <KpiCard label="Affichages dans Google" value={nf.format(cur.impressions)} hint={imps.hint} tone={imps.tone} />
        <KpiCard
          label="Position moyenne"
          value={cur.position == null ? "—" : nf.format(cur.position)}
          hint={posGain == null ? "Pas de comparaison possible" : Math.abs(posGain) < 0.1 ? "Comme les 28 jours d'avant" : `${posGain > 0 ? "Monté" : "Descendu"} de ${nf.format(Math.abs(posGain))} place${Math.abs(posGain) >= 2 ? "s" : ""}`}
          tone={posGain == null || Math.abs(posGain) < 0.1 ? "muted" : posGain > 0 ? "success" : "danger"}
        />
      </div>

      <SearchCharts days={report.days} />

      <section aria-labelledby="h-queries" className="space-y-3">
        <div>
          <h2 id="h-queries" className="text-lg">Vos mots-clés</h2>
          <p className="text-sm text-text-muted">Les recherches sur lesquelles votre site est apparu ces 28 derniers jours, comparées aux 28 jours d'avant. La position 1 est la première place dans Google.</p>
        </div>
        {!rows.length ? (
          <EmptyState icon={ChartIcon} title="Pas encore de recherche à montrer">Google met quelques jours à quelques semaines avant de classer de nouvelles pages. Les premières recherches apparaîtront ici d'elles-mêmes.</EmptyState>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Recherche</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Position</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Évolution</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Clics</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Affichages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((q) => (
                  <tr key={q.query}>
                    <th scope="row" className="max-w-[320px] truncate px-4 py-2.5 font-medium" title={q.query}>{q.query}</th>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{nf.format(q.position)}</td>
                    <td className="px-4 py-2.5 tabular-nums"><Trend q={q} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(q.clicks)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf.format(q.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {report.queries.length > TABLE_ROWS && <p className="text-xs text-text-muted">Les {TABLE_ROWS} premières recherches sur {report.queries.length}, classées par clics.</p>}
      </section>

      <section aria-labelledby="h-targets" className="space-y-3">
        <div>
          <h2 id="h-targets" className="text-lg">Mots-clés visés par vos articles</h2>
          <p className="text-sm text-text-muted">Pour chaque article, la recherche qu'il vise et la place de votre site sur cette recherche exacte.</p>
        </div>
        {!targets.length ? (
          <Card className="text-sm text-text-muted">Aucun article écrit pour l'instant. <Link href="/app/calendrier" className="font-semibold text-accent underline underline-offset-2">Ouvrir le calendrier</Link></Card>
        ) : (
          <ul className="card divide-y divide-border p-0">
            {targets.map(({ item, article, hit }) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.keyword}</p>
                  <p className="truncate text-xs text-text-muted">{article ? <Link href={`/app/articles/${article.id}`} className="underline underline-offset-2">{article.title}</Link> : item.title}</p>
                </div>
                {hit ? (
                  <p className="flex items-center gap-3 text-sm tabular-nums"><span>Position <strong className="font-semibold">{nf.format(hit.position)}</strong></span><Trend q={hit} /></p>
                ) : (
                  <span className="pill bg-surface-sunken text-text-muted">Pas encore classé</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
