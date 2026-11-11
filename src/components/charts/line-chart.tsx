"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Point = { day: string; value: number | null };
type Props = {
  title: string;
  points: Point[];
  /** Position Google : 1 en haut de l'axe (plus haut = mieux). */
  invert?: boolean;
  unit: (n: number) => string;
  note?: string;
};

const H = 190, PAD = { top: 12, right: 12, bottom: 26, left: 40 };
const shortDay = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const date = (d: string) => new Date(`${d}T12:00:00Z`);
const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });

/** Pas « rond » (1, 2, 5 × 10ⁿ) pour au plus quatre graduations. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag);
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Courbe d'une seule mesure dans le temps. Le pointeur (ou les flèches du clavier) choisit un jour :
 * un trait vertical, un point et une bulle donnent la valeur. Les jours sans donnée coupent la courbe.
 */
export function LineChart({ title, points, invert, unit, note }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  const [at, setAt] = useState<number | null>(null);
  const id = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const vals = points.map((p) => p.value).filter((v): v is number => v != null);
    const { top, step } = niceMax(vals.length ? Math.max(...vals) : 0);
    const lo = invert ? 1 : 0, hi = invert ? Math.max(top, 5) : top;
    const iw = w - PAD.left - PAD.right, ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2);
    const y = (v: number) => PAD.top + (invert ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo)) * ih;
    const ticks: number[] = invert ? [1, Math.round((hi + 1) / 2), hi] : Array.from({ length: Math.round(hi / step) + 1 }, (_, i) => i * step);
    let line = "", area = "", open = false, startX = 0, lastX = 0;
    const base = PAD.top + ih;
    points.forEach((p, i) => {
      if (p.value == null) { if (open) { area += `L${lastX},${base}Z`; open = false; } return; }
      const px = +x(i).toFixed(1), py = +y(p.value).toFixed(1);
      line += `${open ? "L" : "M"}${px},${py}`;
      if (!open) { startX = px; area += `M${startX},${base}L${px},${py}`; open = true; } else area += `L${px},${py}`;
      lastX = px;
    });
    if (open) area += `L${lastX},${base}Z`;
    const marks = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);
    return { x, y, ticks, line, area, marks, iw, ih, empty: !vals.length };
  }, [points, w, invert]);

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || points.length < 2) return;
    const i = Math.round(((clientX - r.left - PAD.left) / g.iw) * (points.length - 1));
    setAt(Math.min(points.length - 1, Math.max(0, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Escape") return;
    e.preventDefault();
    if (e.key === "Escape") return setAt(null);
    setAt((c) => Math.min(points.length - 1, Math.max(0, (c ?? points.length - 1) + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const cur = at != null ? points[at] : null;
  const tipLeft = at != null ? Math.min(w - 150, Math.max(0, g.x(at) - 70)) : 0;

  return (
    <figure className="card min-w-0">
      <figcaption>
        <span id={`${id}-t`} className="font-semibold">{title}</span>
        <span className="block min-h-4 text-xs text-text-muted">{note}</span>
      </figcaption>
      <div
        ref={box}
        className="relative mt-3 touch-pan-y outline-none focus-visible:shadow-focus"
        tabIndex={0}
        role="group"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setAt(null)}
        onBlur={() => setAt(null)}
        onKeyDown={onKey}
      >
        <p id={`${id}-d`} className="sr-only">Graphique. Utilisez les flèches gauche et droite pour lire la valeur de chaque jour. Les mêmes chiffres sont dans le tableau « Chiffres jour par jour ».</p>
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true" className="block max-w-full">
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={g.y(t)} y2={g.y(t)} stroke="rgb(var(--c-border))" strokeWidth={1} />
              <text x={PAD.left - 8} y={g.y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="rgb(var(--c-text-muted))">{nf.format(t)}</text>
            </g>
          ))}
          {g.marks.map((i, k) => (
            <text key={i} x={g.x(i)} y={H - 6} fontSize={11} fill="rgb(var(--c-text-muted))" textAnchor={k === 0 ? "start" : k === g.marks.length - 1 ? "end" : "middle"}>{shortDay.format(date(points[i].day))}</text>
          ))}
          {!invert && <path d={g.area} fill="rgb(var(--c-chart) / 0.1)" />}
          <path d={g.line} fill="none" stroke="rgb(var(--c-chart))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {at != null && (
            <>
              <line x1={g.x(at)} x2={g.x(at)} y1={PAD.top} y2={PAD.top + g.ih} stroke="rgb(var(--c-text-muted))" strokeWidth={1} />
              {cur?.value != null && <circle cx={g.x(at)} cy={g.y(cur.value)} r={5} fill="rgb(var(--c-chart))" stroke="rgb(var(--c-bg))" strokeWidth={2} />}
            </>
          )}
        </svg>
        {g.empty && <p className="absolute inset-0 grid place-items-center text-sm text-text-muted">Pas encore de chiffres sur cette période</p>}
        {cur && (
          <div role="status" className="pointer-events-none absolute top-0 z-10 w-[140px] rounded-md border border-border bg-bg px-3 py-2 shadow-pop" style={{ left: tipLeft }}>
            <p className="text-base font-semibold tabular-nums">{cur.value == null ? "Pas de donnée" : unit(cur.value)}</p>
            <p className="text-xs text-text-muted">{longDay.format(date(cur.day))}</p>
          </div>
        )}
      </div>
    </figure>
  );
}
