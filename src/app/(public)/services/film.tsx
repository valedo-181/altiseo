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
/** Position de chaque étape le long de l'itinéraire (0 = départ, 1 = sommet). */
const MARKS = [0.14, 0.31, 0.48, 0.66, 0.84];
/** Altitude affichée : du fond de vallée au sommet (4 478 m, clin d'œil au Cervin). */
const ALT_BASE = 1608, ALT_TOP = 4478;

/** Étoiles à positions fixes (pas de hasard : même rendu au serveur et dans le navigateur). */
function starField(count: number, seed: number) {
  let x = seed;
  const next = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  return Array.from({ length: count }, () => ({ left: next() * 100, top: next() * 100, size: 1 + next() * 2, o: 0.25 + next() * 0.6 }));
}
const STARS = [starField(46, 7), starField(28, 23)];

function Shot({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="shot-stage mt-8 max-w-md">
      <div role="img" aria-label={label} className="shot rounded-xl border border-border bg-surface p-4 shadow-pop">{children}</div>
    </div>
  );
}

/** Titre révélé mot par mot quand la scène arrive (lu d'un bloc par les lecteurs d'écran). */
function Words({ text }: { text: string }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((w, i) => (
          <span key={i} className="word" style={{ transitionDelay: `${80 + i * 70}ms` }}>{w}{" "}</span>
        ))}
      </span>
    </>
  );
}

function Scene({ n, title, children, shot }: { n: number; title: string; children: React.ReactNode; shot: React.ReactNode }) {
  return (
    <section data-scene={n} aria-labelledby={`scene-${n}`} className="scene relative flex min-h-dvh items-center px-4 py-24 md:px-8 lg:w-1/2">
      <span data-parallax="0.22" aria-hidden="true" className="ghost pointer-events-none absolute right-2 top-[12%] select-none font-display text-[38vw] font-bold leading-none lg:right-8 lg:text-[19vw]">{n}</span>
      <div className="relative mx-auto w-full max-w-xl lg:ml-auto lg:mr-12">
        <p className="text-sm font-semibold text-accent">Étape {n} sur {STEPS.length} : {STEPS[n - 1]}</p>
        <h2 id={`scene-${n}`} className="mt-3 font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Words text={title} /></h2>
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
    const dotHalo = s.querySelector<SVGCircleElement>("[data-dot-halo]")!;
    const summit = s.querySelector<SVGGElement>("[data-summit]")!;
    const total = route.getTotalLength();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camera = s.querySelector<SVGGElement>("[data-camera]")!;
    const marks = [...s.querySelectorAll<SVGGElement>("[data-mark]")];
    const rays = s.querySelector<SVGGElement>("[data-rays]")!;
    const stars = [...el.querySelectorAll<HTMLElement>("[data-stars]")];
    const glows = [...el.querySelectorAll<HTMLElement>("[data-glow]")];
    const ghosts = [...el.querySelectorAll<HTMLElement>("[data-parallax]")];
    const alt = el.querySelector<HTMLElement>("[data-alt]")!;
    const rail = el.querySelector<HTMLElement>("[data-rail]")!;
    // Un jalon par étape, posé sur l'itinéraire.
    marks.forEach((m, i) => {
      const pt = route.getPointAtLength(total * MARKS[i]);
      m.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    });
    let raf = 0;

    const paint = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = reduce ? 1 : Math.min(1, Math.max(0, span > 0 ? -rect.top / span : 0));
      // Les courbes se tracent de la base vers le sommet.
      lines.forEach((l) => {
        const i = Number(l.dataset.i);
        const local = Math.min(1, Math.max(0, p * (LINES - 0.3) - i * 0.9)); // la dernière courbe se ferme vers 95 %
        l.style.strokeDashoffset = String(1 - local);
      });
      route.style.strokeDashoffset = String(1 - p);
      const pt = route.getPointAtLength(total * p);
      for (const d of [dot, dotHalo]) { d.setAttribute("cx", String(pt.x)); d.setAttribute("cy", String(pt.y)); }
      summit.style.opacity = String(Math.min(1, Math.max(0, (p - 0.9) * 10)));
      rays.style.opacity = String(Math.min(1, Math.max(0, (p - 0.94) * 16)));
      rays.style.transform = `rotate(${(1 - p) * 90}deg) scale(${0.4 + Math.min(1, Math.max(0, (p - 0.94) * 16)) * 0.6})`;
      marks.forEach((m, i) => m.classList.toggle("is-on", p >= MARKS[i]));
      // Caméra : gros plan sur le grimpeur au départ, puis recul jusqu'à la montagne entière.
      const zoom = reduce ? 1 : 1 + 0.9 * Math.pow(1 - p, 1.6);
      const k = (zoom - 1) / 0.9;
      const fx = 300 + (pt.x - 300) * k, fy = 300 + (pt.y - 300) * k;
      camera.setAttribute("transform", `translate(300 300) scale(${zoom.toFixed(4)}) translate(${(-fx).toFixed(2)} ${(-fy).toFixed(2)})`);
      // Profondeur : les étoiles et les lueurs défilent à des vitesses différentes.
      stars.forEach((st, i) => { st.style.transform = `translate3d(0, ${(-p * (60 + i * 140)).toFixed(1)}px, 0)`; });
      glows.forEach((g, i) => { g.style.transform = `translate3d(${((i ? -1 : 1) * p * 120).toFixed(1)}px, ${(-p * (180 + i * 160)).toFixed(1)}px, 0) scale(${(1 + p * 0.4).toFixed(3)})`; });
      alt.textContent = `${Math.round(ALT_BASE + p * (ALT_TOP - ALT_BASE)).toLocaleString("fr-CH")} m`;
      rail.style.transform = `scaleY(${p.toFixed(4)})`;
      if (!reduce) {
        const vh = window.innerHeight;
        ghosts.forEach((g) => {
          const r = g.parentElement!.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          g.style.transform = `translate3d(0, ${(((r.top + r.height / 2) - vh / 2) * -Number(g.dataset.parallax)).toFixed(1)}px, 0)`;
        });
      }
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
      <div className="pointer-events-none sticky top-0 h-dvh overflow-hidden" aria-hidden="true">
        {/* Lueurs d'aurore et ciel étoilé, sur toute la largeur */}
        <div data-glow className="absolute -left-[10%] top-[55%] size-[70vmax] rounded-full opacity-30 will-change-transform" style={{ background: "radial-gradient(closest-side, rgb(var(--c-brand-cyan) / .45), rgb(var(--c-brand-cyan) / .12) 55%, transparent)" }} />
        <div data-glow className="absolute -right-[15%] top-[85%] size-[60vmax] rounded-full opacity-25 will-change-transform" style={{ background: "radial-gradient(closest-side, rgb(var(--c-highlight) / .4), rgb(var(--c-highlight) / .1) 55%, transparent)" }} />
        {STARS.map((layer, i) => (
          <div key={i} data-stars className="absolute inset-x-0 top-0 h-[160%]">
            {layer.map((st, j) => <i key={j} className="absolute rounded-full bg-text" style={{ left: `${st.left}%`, top: `${st.top}%`, width: st.size, height: st.size, opacity: st.o * (i ? 1 : 0.6) }} />)}
          </div>
        ))}
        <div className="absolute inset-0 flex items-center justify-center lg:left-1/2">
          <svg ref={svg} viewBox="0 0 600 600" className="h-[82%] w-auto max-w-none overflow-visible opacity-35 lg:opacity-100">
            <g data-camera>
              <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="mountain stroke-brand-cyan">
                {/* Halo : un second trait large et pâle (bien plus léger à dessiner qu'un filtre de lueur). */}
                {Array.from({ length: LINES }, (_, i) => (
                  <path key={`g${i}`} data-line data-i={i} pathLength={1} strokeDasharray="1" strokeDashoffset="1" strokeWidth={10}
                    opacity={0.13 - i * 0.012} d={`M${40 + i * 32} 560 L300 ${60 + i * 58} L${560 - i * 32} 560`} />
                ))}
                {Array.from({ length: LINES }, (_, i) => (
                  <path key={i} data-line data-i={i} pathLength={1} strokeDasharray="1" strokeDashoffset="1" strokeWidth={i === 0 ? 3 : 2}
                    opacity={1 - i * 0.1} d={`M${40 + i * 32} 560 L300 ${60 + i * 58} L${560 - i * 32} 560`} />
                ))}
              </g>
              <path data-route d={ROUTE} pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-highlight" />
              {MARKS.map((_, i) => (
                <g key={i} data-mark className="mark">
                  <circle r="11" fill="none" strokeWidth="1.5" className="ring stroke-highlight" />
                  <circle r="4.5" className="fill-bg stroke-highlight" strokeWidth="2" />
                </g>
              ))}
              <g data-rays className="origin-center stroke-highlight" style={{ opacity: 0, transformBox: "fill-box", transformOrigin: "center" }} strokeWidth="2" strokeLinecap="round">
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i * Math.PI) / 6;
                  return <line key={i} x1={300 + Math.cos(a) * 34} y1={60 + Math.sin(a) * 34} x2={300 + Math.cos(a) * (i % 2 ? 52 : 66)} y2={60 + Math.sin(a) * (i % 2 ? 52 : 66)} />;
                })}
              </g>
              <g data-summit style={{ opacity: 0 }}>
                <circle cx="300" cy="60" r="26" className="summit-halo fill-highlight" opacity=".18" />
                <circle cx="300" cy="60" r="14" className="fill-highlight" opacity=".3" />
              </g>
              <circle data-dot-halo cx="70" cy="540" r="18" className="fill-highlight" opacity=".22" />
              <circle data-dot cx="70" cy="540" r="8" className="fill-highlight" />
            </g>
          </svg>
        </div>
        {/* Altitude et progression */}
        <div className="absolute right-4 top-20 text-right md:right-8">
          <p className="text-xs text-text-muted">Altitude</p>
          <p data-alt className="font-display text-xl font-medium tabular-nums md:text-2xl">1 608 m</p>
        </div>
        <div className="absolute bottom-10 right-4 top-40 w-px bg-border md:right-8"><div data-rail className="h-full w-px origin-top bg-highlight" style={{ transform: "scaleY(0)" }} /></div>
        <p className="absolute bottom-6 left-1/2 hidden text-sm text-text-muted lg:left-3/4 lg:block lg:-translate-x-1/2">
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
