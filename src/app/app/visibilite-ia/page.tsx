import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Check, X } from "lucide-react";
import { removeAiQuestion } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { Card, KpiCard } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { liveEngines, thisWeek } from "@/lib/app/geo";
import { db } from "@/lib/data/store";
import { addDays } from "@/lib/domain/dates";
import type { AiCheck, AiEngineName } from "@/lib/domain/types";
import { adviceFor, AI_ENGINES, ENGINE_LABEL, topCompetitors, visibilityScore } from "@/lib/geo/analyze";
import { AddQuestion, RunVisibility, SuggestQuestions } from "./buttons";

export const metadata: Metadata = { title: "Visibilité IA" };
export const maxDuration = 300;

const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", timeZone: "UTC" });
const listFr = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`);
const place = (n: number) => (n === 1 ? "1re place" : `${n}e place`);

/** Une case du tableau : la forme (texte + couleur) dit la même chose, jamais la couleur seule. */
function Cell({ c }: { c: AiCheck | undefined }) {
  if (!c) return <span className="text-text-muted" title="Pas encore interrogée">—</span>;
  if (c.status === "error") return <span className="pill bg-danger-soft text-danger" title={c.error ?? undefined}>Erreur</span>;
  if (c.cited) return <span className="pill bg-success-soft text-success">{c.position ? place(c.position) : "Cité"}{c.linked ? " · lien" : ""}</span>;
  if (c.linked) return <span className="pill bg-info-soft text-info">En source</span>;
  return <span className="pill bg-surface-sunken text-text-muted">Absent</span>;
}

/** Visibilité IA : ce que répondent les IA aux questions des clients, chaque semaine. */
export default async function AiVisibility() {
  const { workspace, site } = await requireSite();
  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [plan, questions, runs] = await Promise.all([db.aiPlan(workspace.id), db.listAiQuestions(workspace.id, site.id), db.listAiRuns(workspace.id, site.id, 8)]);
  const header = <PageHeader title="Visibilité IA" lead={`Ce que répondent les IA quand vos clients leur posent leurs questions, et si elles citent ${host}. Mise à jour chaque semaine.`} />;

  if (!plan.maxQuestions) {
    return (<>{header}<EmptyState icon={Bot} title="Pas compris dans votre offre">La visibilité IA fait partie des offres Grow et Scale. <Link href="/app/abonnement" className="font-semibold text-accent underline underline-offset-2">Voir mon abonnement</Link></EmptyState></>);
  }

  const engines = plan.engines.length ? plan.engines : (["chatgpt"] as AiEngineName[]);
  const live = liveEngines(engines);
  const week = thisWeek();
  const current = runs.find((r) => r.week === week) ?? null;
  const shownRun = current ?? runs[0] ?? null;
  const prevRun = runs.find((r) => shownRun && r.week < shownRun.week && r.status === "done") ?? null;
  const checks = await db.listAiChecks(workspace.id, site.id, [shownRun?.week, prevRun?.week].filter(Boolean) as string[]);
  const qIds = new Set(questions.slice(0, plan.maxQuestions).map((q) => q.id));
  const cur = checks.filter((c) => c.week === shownRun?.week && qIds.has(c.questionId));
  const prev = checks.filter((c) => c.week === prevRun?.week && qIds.has(c.questionId));
  const score = visibilityScore(cur), before = visibilityScore(prev);
  const rivals = topCompetitors(cur);
  const advice = adviceFor(questions, cur, shownRun?.readiness ?? null);
  const byPair = new Map(cur.map((c) => [`${c.questionId}|${c.engine}`, c]));
  const canRun = questions.length > 0 && (!current || current.status === "running");
  const nextMonday = dayFmt.format(new Date(`${addDays(week, 7)}T12:00:00Z`));
  const otherEngines = AI_ENGINES.filter((e) => !engines.includes(e));

  const actions = canRun ? <RunVisibility again={current?.status === "running"} /> : undefined;

  return (
    <>
      <PageHeader
        title="Visibilité IA"
        lead={<>Ce que répondent {listFr(engines.map((e) => ENGINE_LABEL[e]))} quand vos clients leur posent leurs questions, et si elles citent {host}. {current?.status === "done" ? <>Prochain passage le lundi {nextMonday}.</> : <>Un passage par semaine.</>}</>}
        actions={actions}
      />
      {shownRun?.demo && <Banner tone="info"><strong className="font-semibold">Réponses d'exemple :</strong> aucune IA n'a été interrogée. Elles montrent à quoi ressemblera la page une fois les clés des IA ajoutées sur le serveur.</Banner>}
      {!shownRun?.demo && live.length < engines.length && live.length > 0 && <Banner tone="warning">{engines.filter((e) => !live.includes(e)).map((e) => ENGINE_LABEL[e]).join(", ")} : pas encore branché sur ce serveur, cette IA n'est pas interrogée.</Banner>}

      {!questions.length ? (
        <EmptyState icon={Bot} title="Quelles questions vos clients posent-ils aux IA ?" action={<SuggestQuestions primary />}>
          Par exemple « Quel déménageur recommandes-tu à Neuchâtel ? » ou « Combien coûte un nettoyage de fin de bail ? ». Altiseo peut vous en proposer d'après votre site et vos mots-clés ; vous pouvez aussi écrire les vôtres plus bas.
        </EmptyState>
      ) : !shownRun ? (
        <Card className="text-sm text-text-muted">Vos {questions.length} question{questions.length > 1 ? "s" : ""} seront posées aux IA au prochain passage automatique (chaque matin, une fois par semaine). Vous pouvez aussi lancer le premier passage tout de suite, en haut de la page : comptez une à trois minutes.</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label={`Visibilité IA, semaine du ${dayFmt.format(new Date(`${shownRun.week}T12:00:00Z`))}`}
              value={score.score == null ? "—" : `${score.score} %`}
              hint={score.total ? `Cité ou en source dans ${score.seen} réponse${score.seen > 1 ? "s" : ""} sur ${score.total}` : "Pas encore de réponse lue"}
              tone="muted"
            />
            <KpiCard
              label="Par rapport à la semaine d'avant"
              value={score.score == null || before.score == null ? "—" : `${score.score - before.score >= 0 ? "+" : "−"}${Math.abs(score.score - before.score)} pt`}
              hint={before.score == null ? "Première semaine suivie" : `Semaine d'avant : ${before.score} %`}
              tone={score.score == null || before.score == null || score.score === before.score ? "muted" : score.score > before.score ? "success" : "danger"}
            />
            <KpiCard
              label="Concurrent le plus cité"
              value={rivals[0] ? `${rivals[0].count} / ${score.total}` : "—"}
              hint={rivals[0] ? rivals[0].name : "Aucun concurrent connu cité. Ajoutez vos concurrents dans les réglages."}
              tone="muted"
            />
          </div>

          <section aria-labelledby="h-answers" className="space-y-3">
            <div>
              <h2 id="h-answers" className="text-lg">Réponses de la semaine</h2>
              <p className="text-sm text-text-muted">« 1re place » : votre entreprise est la première nommée. « En source » : l'IA s'appuie sur votre site sans vous nommer. Les réponses changent d'un jour à l'autre : regardez la tendance sur plusieurs semaines.</p>
            </div>
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border text-xs text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Question</th>
                    {engines.map((e) => <th key={e} scope="col" className="px-3 py-2 text-center font-semibold">{ENGINE_LABEL[e]}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {questions.slice(0, plan.maxQuestions).map((q) => (
                    <tr key={q.id}>
                      <th scope="row" className="max-w-[360px] px-4 py-2.5 font-medium">{q.question}</th>
                      {engines.map((e) => <td key={e} className="px-3 py-2.5 text-center"><Cell c={byPair.get(`${q.id}|${e}`)} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shownRun.status === "running" && <p className="text-xs text-text-muted">Passage en cours : les cases « — » seront remplies au prochain passage, ou tout de suite avec « Continuer le passage ».</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg">À faire</h2>
              {!advice.length ? <p className="mt-2 text-sm text-text-muted">Rien d'urgent : les IA vous citent sur toutes vos questions. Continuez à publier.</p> : (
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {advice.map((a, i) => <li key={i}>{a.text}{a.kind === "article" && <> <Link href="/app/calendrier" className="font-semibold text-accent underline underline-offset-2">Calendrier</Link></>}</li>)}
                </ol>
              )}
            </Card>
            <Card>
              <h2 className="text-lg">Votre site est-il prêt pour les IA ?</h2>
              {!shownRun.readiness ? <p className="mt-2 text-sm text-text-muted">Pas encore vérifié : ce sera fait au prochain passage.</p> : (
                <ul className="mt-2 space-y-2 text-sm">
                  {([
                    [shownRun.readiness.blockedBots.length === 0, shownRun.readiness.blockedBots.length ? `robots.txt bloque ${shownRun.readiness.blockedBots.join(", ")}` : "robots.txt laisse entrer les robots des IA"],
                    [shownRun.readiness.organization, "Entreprise décrite en JSON-LD (nom, adresse, téléphone)"],
                    [shownRun.readiness.faq, "FAQ structurée sur la page d'accueil"],
                    [shownRun.readiness.llmsTxt, "Fichier /llms.txt"],
                  ] as Array<[boolean, string]>).map(([ok, label]) => (
                    <li key={label} className="flex items-start gap-2">
                      {ok ? <Check aria-hidden="true" className="mt-0.5 size-4 text-success" /> : <X aria-hidden="true" className="mt-0.5 size-4 text-danger" />}
                      <span><span className="sr-only">{ok ? "Oui : " : "Non : "}</span>{label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {rivals.length > 0 && (
            <Card>
              <h2 className="text-lg">Concurrents cités par les IA</h2>
              <ul className="mt-2 divide-y divide-border text-sm">
                {rivals.map((r) => <li key={r.domain} className="flex justify-between gap-4 py-2"><span className="min-w-0 truncate">{r.name} <span className="text-text-muted">{r.domain}</span></span><span className="tabular-nums">{r.count} réponse{r.count > 1 ? "s" : ""}</span></li>)}
              </ul>
            </Card>
          )}

          <section aria-labelledby="h-details" className="space-y-3">
            <h2 id="h-details" className="text-lg">Le détail des réponses</h2>
            <div className="card divide-y divide-border p-0">
              {questions.slice(0, plan.maxQuestions).map((q) => (
                <details key={q.id} className="group px-4 py-3">
                  <summary className="cursor-pointer font-medium">{q.question}</summary>
                  <div className="mt-3 space-y-3">
                    {engines.map((e) => {
                      const c = byPair.get(`${q.id}|${e}`);
                      return (
                        <div key={e} className="rounded-md bg-surface-sunken p-3 text-sm">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">{ENGINE_LABEL[e]} <Cell c={c} /></p>
                          {c?.status === "ok" && c.excerpt && <p className="mt-2 whitespace-pre-line text-text-muted">{c.excerpt}</p>}
                          {c?.status === "error" && <p className="mt-2 text-danger">{c.error}</p>}
                          {c?.sources.length ? <p className="mt-2 break-all text-xs text-text-muted">Sources : {c.sources.slice(0, 6).map((u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "")).join(" · ")}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="h-questions" className="space-y-3">
        <div>
          <h2 id="h-questions" className="text-lg">Questions suivies ({questions.length} sur {plan.maxQuestions})</h2>
          <p className="text-sm text-text-muted">
            Votre offre interroge {listFr(engines.map((e) => ENGINE_LABEL[e]))}{otherEngines.length ? <> ; l'offre Scale ajoute {otherEngines.map((e) => ENGINE_LABEL[e]).join(" et ")}</> : null}. Retirer une question efface aussi ses réponses.
          </p>
        </div>
        {questions.length > 0 && (
          <ul className="card divide-y divide-border p-0">
            {questions.map((q, i) => (
              <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-sm">{q.question}{i >= plan.maxQuestions && <span className="pill ml-2 bg-warning-soft text-warning">Au-delà de votre offre : pas posée</span>}</span>
                <form action={removeAiQuestion}><input type="hidden" name="id" value={q.id} /><button className="text-xs font-semibold text-danger underline underline-offset-2">Retirer</button></form>
              </li>
            ))}
          </ul>
        )}
        <Card className="space-y-4">
          <AddQuestion disabled={questions.length >= plan.maxQuestions} />
          {questions.length > 0 && questions.length < plan.maxQuestions && <SuggestQuestions />}
        </Card>
      </section>
    </>
  );
}
