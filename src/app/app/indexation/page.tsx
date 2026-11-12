import type { Metadata } from "next";
import Link from "next/link";
import { Check, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { trackedPages } from "@/lib/app/positions";
import { demoMode } from "@/lib/config";
import { db } from "@/lib/data/store";
import type { UrlInspection } from "@/lib/domain/types";
import { keyFileName, keyFileUrl } from "@/lib/rank/indexnow";
import { AutoSubmit, InspectAll, InspectOne, SubmitUrls, VerifyKey } from "./forms";

export const metadata: Metadata = { title: "Indexation" };
export const maxDuration = 60;

const when = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const dateFmt = new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname === "/" ? "Accueil" : decodeURIComponent(x.pathname); } catch { return u; } };

/** L'état Google d'une page, en texte et en couleur. */
function State({ i }: { i: UrlInspection | undefined }) {
  if (!i) return <span className="pill bg-surface-sunken text-text-muted">Pas encore vérifiée</span>;
  if (i.error) return <span className="pill bg-danger-soft text-danger" title={i.error}>Erreur</span>;
  if (i.verdict === "PASS") return <span className="pill bg-success-soft text-success">Indexée</span>;
  if (i.verdict === "PARTIAL") return <span className="pill bg-warning-soft text-warning">Indexée, avec réserves</span>;
  if (i.verdict === "FAIL") return <span className="pill bg-danger-soft text-danger">Pas indexée : erreur</span>;
  return <span className="pill bg-warning-soft text-warning">Pas indexée</span>;
}

const inspectLink = (property: string, url: string) => `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(property)}&id=${encodeURIComponent(url)}`;

/** Indexation : ce que Google a gardé de vos pages, et l'envoi des nouvelles pages aux autres moteurs (IndexNow). */
export default async function Indexation() {
  const { workspace, site } = await requireSite();
  const host = new URL(site.url).hostname;
  const [conn, ix, inspections, submissions, pages] = await Promise.all([
    db.searchConnection(workspace.id, site.id), db.indexingOf(workspace.id, site.id), db.listInspections(workspace.id, site.id),
    db.listSubmissions(workspace.id, site.id, 8), trackedPages(workspace.id, site.id),
  ]);
  const byUrl = new Map(inspections.map((i) => [i.url, i]));
  const extra = inspections.filter((i) => !pages.includes(i.url)).map((i) => i.url);
  const rows = [...pages, ...extra];
  const seen = rows.map((u) => byUrl.get(u)).filter((i): i is UrlInspection => Boolean(i && !i.error));
  const indexed = seen.filter((i) => i.verdict === "PASS" || i.verdict === "PARTIAL").length;
  const notIndexed = seen.length - indexed;
  const demoInspect = inspections.some((i) => i.demo);
  const fileUrl = keyFileUrl(site.url, ix.indexnowKey);

  return (
    <>
      <PageHeader title="Indexation" lead={`Quelles pages de ${host} Google a gardées dans son index, et le signalement immédiat de vos nouvelles pages à Bing et aux autres moteurs.`} actions={conn ? <InspectAll /> : undefined} />

      <section aria-labelledby="h-google" className="space-y-3">
        <h2 id="h-google" className="text-lg">Dans Google</h2>
        {!conn ? (
          <Card className="text-sm">
            <p>Google ne dit qu'au propriétaire du site si une page est indexée. Connectez Search Console une fois : Altiseo relira ensuite l'état de vos pages chaque semaine.</p>
            <p className="mt-3"><Link href="/app/mots-cles" className="font-semibold text-accent underline underline-offset-2">Connecter Search Console (page Mots-clés)</Link></p>
          </Card>
        ) : (
          <>
            {demoInspect && <Banner tone="info"><strong className="font-semibold">États d'exemple :</strong> Search Console est connecté en mode exemple, Google n'a pas été interrogé.</Banner>}
            {conn.status === "error" && <Banner tone="danger">{conn.lastError ?? "La connexion à Google a un problème."} <Link href="/app/mots-cles" className="font-semibold underline underline-offset-2">Reconnecter</Link></Banner>}
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Pages indexées" value={seen.length ? `${indexed} / ${seen.length}` : "—"} hint={seen.length ? "Parmi les pages vérifiées" : "Cliquez sur « Vérifier mes pages »"} tone="muted" />
              <KpiCard label="Pas indexées" value={seen.length ? String(notIndexed) : "—"} hint={notIndexed ? "Google ne les montre pas dans ses résultats" : "Rien à signaler"} tone={notIndexed ? "danger" : "muted"} />
              <KpiCard label="Pages suivies" value={String(rows.length)} hint="L'accueil et les articles publiés par Altiseo" tone="muted" />
            </div>
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-border text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Page</th>
                    <th scope="col" className="px-3 py-2 font-semibold">État dans Google</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Dernier passage de Google</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Vérifiée le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((u) => {
                    const i = byUrl.get(u);
                    const notOk = i && !i.error && i.verdict !== "PASS";
                    return (
                      <tr key={u}>
                        <th scope="row" className="max-w-[280px] px-4 py-2.5 font-medium"><a href={u} target="_blank" rel="noopener noreferrer" className="block truncate underline-offset-2 hover:underline">{pathOf(u)}</a></th>
                        <td className="px-3 py-2.5">
                          <State i={i} />
                          {i?.coverage && <span className="mt-1 block text-xs text-text-muted">{i.coverage}</span>}
                          {i?.error && <span className="mt-1 block text-xs text-danger">{i.error}</span>}
                          {notOk && !conn.demo && <a href={inspectLink(conn.property, u)} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold text-accent underline underline-offset-2">Demander l'indexation</a>}
                        </td>
                        <td className="px-3 py-2.5 text-text-muted">{i?.lastCrawlAt ? dateFmt.format(new Date(i.lastCrawlAt)) : i ? "Jamais" : "—"}</td>
                        <td className="px-3 py-2.5 text-text-muted">{i ? dateFmt.format(new Date(i.checkedAt)) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted">« Demander l'indexation » ouvre la page dans Search Console : cliquez sur « Demander une indexation » (Google ne permet pas de le faire depuis une autre application). Vérification automatique chaque semaine.</p>
            <Card><InspectOne placeholder={`${new URL(site.url).origin}/ma-page/`} /></Card>
          </>
        )}
      </section>

      <section aria-labelledby="h-indexnow" className="space-y-3">
        <div>
          <h2 id="h-indexnow" className="text-lg">Bing, Yandex et les autres moteurs (IndexNow)</h2>
          <p className="text-sm text-text-muted">IndexNow prévient Bing (qui alimente aussi ChatGPT et DuckDuckGo), Yandex, Seznam, Naver et Yep en quelques minutes au lieu de quelques semaines. Google ne l'utilise pas.</p>
        </div>
        {!ix.keyVerifiedAt ? (
          <Card className="space-y-4 text-sm">
            <p className="font-semibold">Une seule fois : prouvez que le site est à vous</p>
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Téléchargez votre fichier de clé : <a href="/app/indexation/cle" className="inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2"><Download aria-hidden="true" className="size-4" />{keyFileName(ix.indexnowKey)}</a>
              </li>
              <li>
                Déposez-le à la racine de votre site, pour qu'il s'ouvre à cette adresse :
                <code className="mt-1 block break-all rounded-md bg-surface-sunken px-2 py-1 text-xs">{fileUrl}</code>
                <span className="mt-1 block text-xs text-text-muted">WordPress : avec l'extension « File Manager » ou par FTP chez votre hébergeur, dans le dossier où se trouve wp-config.php. Site sur GitHub : dans le dossier public/ du dépôt.</span>
              </li>
              <li>Cliquez sur « Vérifier le fichier ».</li>
            </ol>
            {ix.keyError && <Banner tone="warning">{ix.keyError}</Banner>}
            <VerifyKey primary />
          </Card>
        ) : (
          <>
            <Card className="space-y-4">
              <p className="flex items-center gap-2 text-sm"><Check aria-hidden="true" className="size-4 text-success" /><span>Fichier de clé en ligne{demoMode ? " (mode démo)" : ""}, vérifié le {dateFmt.format(new Date(ix.keyVerifiedAt))}.</span></p>
              <AutoSubmit on={ix.autoSubmit} />
            </Card>
            <Card><SubmitUrls placeholder={`${new URL(site.url).origin}/nouvelle-page/`} /></Card>
          </>
        )}
        {submissions.length > 0 && (
          <Card>
            <h3 className="text-base font-semibold">Derniers envois</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {submissions.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">{when.format(new Date(x.sentAt))} · {x.urls.length === 1 ? pathOf(x.urls[0]) : `${x.urls.length} pages`}{x.source === "article" && <span className="text-text-muted"> · article publié</span>}{x.error && <span className="block text-xs text-danger">{x.error}</span>}</span>
                  {x.ok ? <span className="pill bg-success-soft text-success">Signalé{x.demo ? " (exemple)" : ""}</span> : <span className="pill bg-danger-soft text-danger">Refusé</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {ix.keyVerifiedAt && !demoMode && <VerifyKey primary={false} />}
      </section>
    </>
  );
}
