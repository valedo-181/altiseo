"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { ScoreGauge } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status";
import { cx } from "@/lib/cx";

/**
 * « L'ascension » : la page des services se déroule comme un film. Le défilement dessine une montagne
 * en courbes de niveau (le motif du logo) et fait grimper un point le long de l'itinéraire ; chaque
 * service est une étape. Tout le mouvement suit le doigt de la personne (rien ne bouge tout seul) ;
 * avec « réduire les animations », la montagne est affichée entière et fixe.
 */

const LINES = 8;
const ROUTE = "M70 540 L190 470 L150 400 L280 340 L235 270 L330 215 L290 150 L300 62";

const STEPS = ["Camp de base", "L'itinéraire", "La marche", "Le passage", "Le sommet"];

function Shot({ children, label }: { children: React.ReactNode; label: string }) {
  return <div role="img" aria-label={label} className="mt-8 max-w-md rounded-xl border border-border bg-surface/90 p-4 shadow-pop backdrop-blur">{children}</div>;
}

function Scene({ n, title, children, shot }: { n: number; title: string; children: React.ReactNode; shot: React.ReactNode }) {
  return (
    <section data-scene={n} aria-labelledby={`scene-${n}`} className="scene flex min-h-dvh items-center px-4 py-24 md:px-8 lg:w-1/2">
      <div className="mx-auto w-full max-w-xl lg:ml-auto lg:mr-12">
        <p className="text-sm font-semibold text-accent">Étape {n} sur {STEPS.length} : {STEPS[n - 1]}</p>
        <h2 id={`scene-${n}`} className="mt-3 font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]">{title}</h2>
        <div className="mt-4 space-y-3 text-lg font-normal leading-relaxed text-text-muted">{children}</div>
        {shot}
      </div>
    </section>
  );
}

export function ServicesFilm() {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = root.current, s = svg.current;
    if (!el || !s) return;
    const lines = [...s.querySelectorAll<SVGPathElement>("[data-line]")];
    const route = s.querySelector<SVGPathElement>("[data-route]")!;
    const dot = s.querySelector<SVGCircleElement>("[data-dot]")!;
    const summit = s.querySelector<SVGGElement>("[data-summit]")!;
    const total = route.getTotalLength();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const paint = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = reduce ? 1 : Math.min(1, Math.max(0, span > 0 ? -rect.top / span : 0));
      // Les courbes se tracent de la base vers le sommet.
      lines.forEach((l, i) => {
        const local = Math.min(1, Math.max(0, p * (LINES - 0.3) - i * 0.9)); // la dernière courbe se ferme vers 95 %
        l.style.strokeDashoffset = String(1 - local);
      });
      route.style.strokeDashoffset = String(1 - p);
      const pt = route.getPointAtLength(total * p);
      dot.setAttribute("cx", String(pt.x));
      dot.setAttribute("cy", String(pt.y));
      summit.style.opacity = String(Math.min(1, Math.max(0, (p - 0.9) * 10)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Chaque scène s'éclaire quand elle arrive à l'écran.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        e.target.classList.toggle("is-in", e.isIntersecting);
        // L'étiquette sous la montagne suit la scène réellement à l'écran.
        const n = (e.target as HTMLElement).dataset.scene;
        if (e.isIntersecting && n !== undefined) setStep(Number(n));
      }
    }, { threshold: 0.35 });
    el.querySelectorAll(".scene").forEach((x) => io.observe(x));
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={root} className="film relative">
      {/* Plan fixe : la montagne. À droite sur grand écran, en fond estompé sur téléphone. */}
      <div className="pointer-events-none sticky top-0 flex h-dvh items-center justify-center overflow-hidden lg:ml-[50%]" aria-hidden="true">
        <svg ref={svg} viewBox="0 0 600 600" className="h-[82%] w-auto max-w-none opacity-30 lg:opacity-100">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-cyan">
            {Array.from({ length: LINES }, (_, i) => (
              <path key={i} data-line pathLength={1} strokeDasharray="1" strokeDashoffset="1" strokeWidth={i === 0 ? 3 : 2}
                opacity={1 - i * 0.1} d={`M${40 + i * 32} 560 L300 ${60 + i * 58} L${560 - i * 32} 560`} />
            ))}
          </g>
          <path data-route d={ROUTE} pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-highlight" />
          <g data-summit style={{ opacity: 0 }}>
            <circle cx="300" cy="60" r="26" className="fill-highlight" opacity=".18" />
            <circle cx="300" cy="60" r="14" className="fill-highlight" opacity=".3" />
          </g>
          <circle data-dot cx="70" cy="540" r="8" className="fill-highlight" />
        </svg>
        <p className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-sm text-text-muted lg:block">
          {step === 0 ? "Départ" : `${STEPS[step - 1]} · étape ${step} sur ${STEPS.length}`}
        </p>
      </div>

      <div className="relative -mt-[100dvh]">
        <section data-scene={0} className="scene is-in flex min-h-dvh items-center px-4 pb-24 pt-10 md:px-8 lg:w-1/2">
          <div className="mx-auto w-full max-w-xl lg:ml-auto lg:mr-12">
            <p className="text-sm font-semibold text-accent">Nos services</p>
            <h1 className="mt-3 text-[34px] leading-[1.1] md:text-display">De votre site au sommet, étape par étape.</h1>
            <p className="mt-5 text-lg font-normal leading-relaxed text-text-muted">Voici ce qu'Altiseo fait pour votre blog, dans l'ordre où le travail se fait. Vous gardez la main à chaque étape.</p>
            <p className="mt-10 inline-flex items-center gap-2 text-sm text-text-muted"><ChevronDown aria-hidden="true" className="size-4" />Faites défiler pour commencer l'ascension</p>
          </div>
        </section>

        <Scene n={1} title="Nous lisons votre site" shot={
          <Shot label="Exemple de fiche d'analyse d'un site">
            <p className="text-xs text-text-muted">demenagements-leman.ch</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-text-muted">Activité</dt><dd>Déménagements et garde-meubles</dd>
              <dt className="text-text-muted">Clients</dt><dd>Familles et PME de l'arc lémanique</dd>
              <dt className="text-text-muted">Ton</dt><dd>Chaleureux, vouvoiement</dd>
              <dt className="text-text-muted">Langue</dt><dd>Français</dd>
            </dl>
          </Shot>}>
          <p>Vous donnez l'adresse de votre site. Altiseo lit vos pages publiques et en tire votre activité, vos clients, votre ton et vos concurrents.</p>
          <p>Vous corrigez ce qui doit l'être. Tout le reste part de là.</p>
        </Scene>

        <Scene n={2} title="Un mois de sujets, choisis pour vos clients" shot={
          <Shot label="Exemple de calendrier de sujets">
            <ul className="space-y-2.5 text-sm">
              {[["Lun 16", "Déménager en hiver : nos conseils", "approved"], ["Mar 17", "Garde-meubles : quelle taille choisir ?", "proposed"], ["Mer 18", "Comment lire un devis de déménagement ?", "proposed"]].map(([d, t, st]) => (
                <li key={d} className="flex items-center gap-3"><span className="w-12 shrink-0 text-xs text-text-muted">{d}</span><span className="min-w-0 flex-1 truncate font-semibold">{t}</span><StatusPill status={st as "approved" | "proposed"} /></li>
              ))}
            </ul>
          </Shot>}>
          <p>Trente idées d'articles, une par jour de publication, chacune avec la recherche Google qu'elle vise.</p>
          <p>Vous approuvez, vous changez un sujet, vous sautez un jour. Rien ne s'écrit sans votre accord.</p>
        </Scene>

        <Scene n={3} title="Un article par jour, dans votre ton" shot={
          <Shot label="Exemple d'article rédigé">
            <p className="font-serif text-lg font-semibold leading-snug">Déménager en hiver : nos conseils</p>
            <div className="mt-3 space-y-2" aria-hidden="true">{[100, 92, 97, 60].map((w, i) => <div key={i} className="h-2 rounded-pill bg-surface-sunken" style={{ width: `${w}%` }} />)}</div>
            <p className="mt-3 text-xs text-text-muted">1 480 mots, 4 liens vers vos autres pages, titre et description pour Google</p>
          </Shot>}>
          <p>Chaque article répond à une vraie question de vos clients, avec des intertitres clairs, des liens vers vos autres pages et une partie « questions fréquentes ».</p>
          <p>Vos consignes s'appliquent à chaque texte. Aucun chiffre, prix ou témoignage n'est inventé.</p>
        </Scene>

        <Scene n={4} title="Vous relisez, il part sur votre site" shot={
          <Shot label="Exemple d'envoi vers WordPress">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-xs font-bold text-text-muted" aria-hidden="true">WP</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">WordPress</p><p className="text-xs text-text-muted">Envoyé en brouillon à 08:00</p></div>
              <StatusPill status="draft" />
            </div>
          </Shot>}>
          <p>L'article arrive en brouillon dans votre WordPress, sans rien installer. Vous le relisez, vous le corrigez, vous le publiez.</p>
          <p>Vous préférez ne pas y penser ? Choisissez la publication directe, à l'heure et aux jours que vous fixez.</p>
        </Scene>

        <Scene n={5} title="Un audit qui dit quoi corriger" shot={
          <Shot label="Exemple de résultat d'audit">
            <div className="flex items-center gap-4">
              <ScoreGauge value={74} />
              <ul className="space-y-1 text-sm">
                <li><span className="pill mr-2 bg-danger-soft text-danger">Critique</span>4 pages sans titre</li>
                <li><span className="pill mr-2 bg-warning-soft text-warning">Moyen</span>12 descriptions manquantes</li>
              </ul>
            </div>
            <p className="mt-3"><span className="pill bg-accent-soft text-accent">Bientôt disponible</span></p>
          </Shot>}>
          <p>La santé technique de votre site, notée sur 100 : titres, descriptions, liens cassés, images, vitesse sur téléphone.</p>
          <p>Chaque problème vient avec les pages concernées et la correction à faire, du plus grave au moins grave.</p>
        </Scene>

        <section data-scene={STEPS.length} className="scene flex min-h-[80dvh] items-center px-4 py-24 md:px-8 lg:w-1/2">
          <div className="mx-auto w-full max-w-xl lg:ml-auto lg:mr-12">
            <h2 className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]">Prêt pour la première étape ?</h2>
            <p className="mt-4 text-lg font-normal text-text-muted">Trois jours d'essai, trente sujets proposés dès aujourd'hui. Sans carte bancaire.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
              <Link href="/tarifs" className={cx(buttonClass("secondary", "lg"))}>Voir les tarifs</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
