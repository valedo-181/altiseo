"use client";
import { useState } from "react";
import { FileText, MoreHorizontal, Moon, RefreshCw, Sun } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, KpiCard, QuotaBar, ScoreGauge } from "@/components/ui/card";
import { Banner, EmptyState, Stepper, Toast } from "@/components/ui/feedback";
import { TextAreaCounter, TextField, UrlField } from "@/components/ui/field";
import { Difficulty, StatusPill, Volume, type Status } from "@/components/ui/status";
import { Switch } from "@/components/ui/switch";

const DAYS: Array<{ d: string; status: Status | null; title: string; today?: boolean; past?: boolean }> = [
  { d: "Lun 30", status: "published", title: "Préparer ses cartons sans stress", past: true },
  { d: "Mar 1", status: "generating", title: "Déménager en hiver : 7 conseils", today: true },
  { d: "Mer 2", status: "approved", title: "Garde-meubles : quelle taille choisir ?" },
  { d: "Jeu 3", status: "proposed", title: "Check-list de l'état des lieux" },
  { d: "Ven 4", status: "failed", title: "Monte-meubles : quand en louer un ?" },
  { d: "Sam 5", status: "proposed", title: "Déménager avec un piano" },
  { d: "Dim 6", status: null, title: "Pas de publication" },
];

const ROWS: Array<{ title: string; kw: string; status: Status; vol: number; diff: number; date: string }> = [
  { title: "Préparer ses cartons sans stress", kw: "cartons déménagement", status: "published", vol: 1900, diff: 22, date: "30 nov." },
  { title: "Déménager en hiver : 7 conseils", kw: "déménager en hiver", status: "draft", vol: 320, diff: 41, date: "1 déc." },
  { title: "Monte-meubles : quand en louer un ?", kw: "location monte-meubles", status: "failed", vol: 880, diff: 67, date: "4 déc." },
];

export function Showcase() {
  const [draft, setDraft] = useState(true);
  const [rivals, setRivals] = useState(false);
  const [instr, setInstr] = useState("Vouvoyer le lecteur. Citer des exemples suisses. Jamais de superlatifs.");
  const setTheme = (t: "light" | "dark") => { document.documentElement.dataset.theme = t; };

  return (
    <main id="main" className="mx-auto max-w-content space-y-12 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Logo size={36} />
          <div>
            <h1 className="text-2xl">Système de design</h1>
            <p className="max-w-reading text-sm text-text-muted">Les composants d'Altiseo. Couleurs, tailles et rayons viennent des jetons (<code className="font-mono text-xs">replica/design/tokens.json</code>).</p>
          </div>
        </div>
        <div className="flex gap-2" role="group" aria-label="Thème">
          <Button variant="secondary" size="sm" onClick={() => setTheme("light")}><Sun aria-hidden="true" className="size-4" />Clair</Button>
          <Button variant="secondary" size="sm" onClick={() => setTheme("dark")}><Moon aria-hidden="true" className="size-4" />Sombre</Button>
        </div>
      </header>

      <Banner tone="info" action={<a href="#" className="font-semibold underline underline-offset-2">Choisir une offre</a>}>
        <strong className="font-semibold">Essai gratuit :</strong> 2 jours restants. Vos articles continuent si vous gardez l'offre.
      </Banner>

      <section aria-labelledby="h-brand" className="space-y-4">
        <h2 id="h-brand" className="text-lg">Marque</h2>
        <div className="flex flex-wrap items-center gap-8">
          <Logo size={40} />
          <Logo size={24} />
          <LogoMark size={48} />
          <LogoMark size={16} />
          <div className="flex gap-2">
            {["bg-accent", "bg-accent-hover", "bg-accent-soft", "bg-text", "bg-surface", "bg-success", "bg-warning", "bg-danger", "bg-info"].map((c) => (
              <span key={c} title={c} className={`size-8 rounded-md border border-border ${c}`} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="h-btn" className="space-y-4">
        <h2 id="h-btn" className="text-lg">Boutons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Approuver les 30 sujets</Button>
          <Button variant="secondary"><RefreshCw aria-hidden="true" className="size-4" />Régénérer</Button>
          <Button variant="ghost">Annuler</Button>
          <Button variant="danger">Déconnecter</Button>
          <Button disabled>Désactivé</Button>
          <Button loading>Rédaction…</Button>
          <Button size="sm">Petit</Button>
          <Button size="lg">Analyser mon site</Button>
          <Button variant="secondary" iconOnly aria-label="Plus d'actions"><MoreHorizontal aria-hidden="true" className="size-4" /></Button>
        </div>
      </section>

      <section aria-labelledby="h-onb" className="space-y-4">
        <h2 id="h-onb" className="text-lg">Onboarding</h2>
        <Stepper steps={["Site", "Activité", "Concurrents", "Langue", "Publication", "Planning", "Offre"]} current={3} />
      </section>

      <section aria-labelledby="h-fields" className="grid gap-6 md:grid-cols-2">
        <h2 id="h-fields" className="text-lg md:col-span-2">Champs</h2>
        <UrlField label="Adresse de votre site" defaultValue="atelier-exemple.ch" help="Nous lisons vos pages publiques pour comprendre votre activité." />
        <TextField label="E-mail" type="email" defaultValue="nom@exemple" error="Il manque la fin de l'adresse (par exemple .ch)." />
        <div className="md:col-span-2">
          <TextAreaCounter label="Consignes de rédaction" rows={3} maxLength={1000} value={instr} onChange={(e) => setInstr(e.target.value)} help="Appliquées à chaque article." />
        </div>
        <Switch label="Publier en brouillon" help="Vous relisez chaque article avant sa mise en ligne." checked={draft} onChange={setDraft} />
        <Switch label="Citer les concurrents" help="Dans les comparatifs et les listes seulement." checked={rivals} onChange={setRivals} />
      </section>

      <section aria-labelledby="h-status" className="space-y-4">
        <h2 id="h-status" className="text-lg">États, difficulté, volume</h2>
        <div className="flex flex-wrap gap-2">
          {(["proposed", "approved", "generating", "draft", "scheduled", "published", "failed", "skipped"] as Status[]).map((s) => <StatusPill key={s} status={s} />)}
        </div>
        <div className="flex flex-wrap gap-6">
          <Difficulty value={18} /><Difficulty value={42} /><Difficulty value={71} /><Difficulty value={null} />
          <Volume value={1240} /><Volume value={90} />
        </div>
      </section>

      <section aria-labelledby="h-kpi" className="space-y-4">
        <h2 id="h-kpi" className="text-lg">Indicateurs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Articles publiés" value="12" hint="↑ 4 cette semaine" tone="success" />
          <KpiCard label="Prochain article" value={<span className="text-lg">Demain, 08:00</span>} hint="Combien coûte un déménagement ?" />
          <Card>
            <p className="text-sm text-text-muted">Quota du mois</p>
            <p className="text-2xl tabular-nums">18 <span className="text-sm font-normal text-text-muted">/ 30</span></p>
            <QuotaBar used={18} total={30} />
          </Card>
          <Card className="flex items-center gap-4">
            <ScoreGauge value={74} />
            <div><p className="text-sm text-text-muted">Santé SEO</p><p className="text-sm font-semibold text-warning">3 problèmes critiques</p></div>
          </Card>
          <KpiCard label="Visites (30 jours)" value="" loading />
        </div>
      </section>

      <section aria-labelledby="h-cal" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-cal" className="text-lg">Calendrier</h2>
          <div className="flex gap-2"><Button variant="secondary" size="sm">Liste</Button><Button size="sm">Tout approuver</Button></div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7" role="grid" aria-label="Semaine du 30 novembre">
          {DAYS.map((d) => (
            <div key={d.d} role="gridcell" className={`min-h-[132px] rounded-lg border bg-bg p-3 ${d.today ? "border-accent ring-1 ring-accent" : "border-border"} ${d.past ? "opacity-60" : ""} ${d.status ? "" : "border-dashed"}`}>
              <p className="mb-2 text-xs text-text-muted">{d.d}{d.today && " · aujourd'hui"}</p>
              {d.status && <StatusPill status={d.status} />}
              <p className={`mt-2 text-sm leading-5 ${d.status ? "font-semibold" : "text-text-muted"}`}>{d.title}</p>
              {d.status === "proposed" && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="ghost" size="xs">Approuver</Button>
                  <Button variant="ghost" size="xs">Régénérer</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-table" className="space-y-4">
        <h2 id="h-table" className="text-lg">Articles</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold" aria-sort="descending"><button className="inline-flex items-center gap-1">Titre <span aria-hidden="true">↓</span></button></th>
                <th className="px-4 py-2 font-semibold">Mot-clé</th>
                <th className="px-4 py-2 font-semibold">Volume</th>
                <th className="px-4 py-2 font-semibold">Difficulté</th>
                <th className="px-4 py-2 font-semibold">État</th>
                <th className="px-4 py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((r) => (
                <tr key={r.title}>
                  <td className="px-4 py-3 font-semibold">{r.title}</td>
                  <td className="px-4 py-3 text-text-muted">{r.kw}</td>
                  <td className="px-4 py-3"><Volume value={r.vol} /></td>
                  <td className="px-4 py-3"><Difficulty value={r.diff} /></td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-text-muted">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="h-plans" className="grid gap-4 md:grid-cols-2">
        <h2 id="h-plans" className="text-lg md:col-span-2">Offres et intégrations</h2>
        <label className="card block cursor-pointer self-start has-[:checked]:ring-2 has-[:checked]:ring-accent">
          <input type="radio" name="plan" className="sr-only" defaultChecked />
          <span className="flex items-start justify-between"><span className="text-lg font-semibold">Grow</span><span className="pill bg-accent-soft text-accent">Recommandée</span></span>
          <span className="mt-2 block text-2xl font-bold">99 CHF <span className="text-sm font-normal text-text-muted">/ mois</span></span>
          <span className="mt-1 block text-sm text-text-muted">30 articles par mois · 1 langue · 1 site</span>
        </label>
        <div className="grid gap-3">
          {[
            { k: "WP", n: "WordPress", d: "mon-site.ch", s: <StatusPill status="published" /> },
            { k: "WF", n: "Webflow", d: <span className="text-danger">Clé refusée : reconnectez le site.</span>, s: <Button variant="secondary" size="sm">Reconnecter</Button> },
            { k: "{ }", n: "Webhook", d: "Pour un site fait sur mesure", s: <Button size="sm">Connecter</Button> },
          ].map((i) => (
            <Card key={i.n} className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-xs font-bold text-text-muted" aria-hidden="true">{i.k}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold">{i.n}</p><p className="text-xs text-text-muted">{i.d}</p></div>
              {i.s}
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-misc" className="grid gap-4 md:grid-cols-2">
        <h2 id="h-misc" className="text-lg md:col-span-2">Audit, état vide, notification</h2>
        <Card className="divide-y divide-border p-0">
          {[
            ["Critique", "bg-danger-soft text-danger", "Pages sans titre", "4 sur 48"],
            ["Moyen", "bg-warning-soft text-warning", "Descriptions manquantes", "12 sur 48"],
            ["Info", "bg-info-soft text-info", "Images sans texte alternatif", "9 sur 130"],
          ].map(([lvl, tone, label, n]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <span className={`pill ${tone}`}>{lvl}</span>
              <p className="flex-1 text-sm">{label}</p>
              <span className="text-xs text-text-muted">{n}</span>
            </div>
          ))}
        </Card>
        <EmptyState icon={FileText} title="Pas encore d'article" action={<a href="#" className={buttonClass("primary", "sm")}>Écrire le premier article</a>}>
          Le premier arrive demain à 08:00. Vous pouvez aussi l'écrire maintenant.
        </EmptyState>
        <div className="flex justify-end md:col-span-2">
          <Toast action={<a href="#" className="font-semibold underline underline-offset-2">Voir</a>}>Article publié en brouillon sur WordPress.</Toast>
        </div>
      </section>
    </main>
  );
}
