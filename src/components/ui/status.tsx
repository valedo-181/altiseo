import { AlertTriangle, Check, CircleDashed, Clock, FileText, PenLine, SkipForward, ThumbsUp } from "lucide-react";
import { cx } from "@/lib/cx";

/** États d'un sujet du calendrier et d'un article (voir replica/schema.sql). */
export type Status = "proposed" | "approved" | "generating" | "draft" | "scheduled" | "published" | "failed" | "skipped";

const STATUS: Record<Status, { label: string; tone: string; Icon: typeof Check }> = {
  proposed: { label: "Proposé", tone: "bg-surface-sunken text-text-muted", Icon: CircleDashed },
  approved: { label: "Approuvé", tone: "bg-info-soft text-info", Icon: ThumbsUp },
  generating: { label: "En rédaction", tone: "bg-warning-soft text-warning", Icon: PenLine },
  draft: { label: "Brouillon", tone: "bg-surface-sunken text-text", Icon: FileText },
  scheduled: { label: "Planifié", tone: "bg-info-soft text-info", Icon: Clock },
  published: { label: "Publié", tone: "bg-success-soft text-success", Icon: Check },
  failed: { label: "Échec", tone: "bg-danger-soft text-danger", Icon: AlertTriangle },
  skipped: { label: "Sauté", tone: "bg-surface-sunken text-text-muted line-through", Icon: SkipForward },
};

/** La couleur n'est jamais seule : texte + icône. */
export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={cx("pill", s.tone)}>
      <s.Icon aria-hidden="true" className={cx("size-3", status === "generating" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

/** Difficulté d'un mot-clé (0–100) : facile < 30, moyenne < 60, difficile au-delà. */
export function Difficulty({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-text-muted" aria-label="Difficulté inconnue">—</span>;
  const [label, tone] = value < 30 ? ["facile", "bg-success-soft text-success"] : value < 60 ? ["moyenne", "bg-warning-soft text-warning"] : ["difficile", "bg-danger-soft text-danger"];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" aria-label={`Difficulté ${value} sur 100, ${label}`}>
      <span className={cx("pill tabular-nums", tone)} aria-hidden="true">{value}</span>
      <span aria-hidden="true" className="capitalize">{label}</span>
    </span>
  );
}

/** Volume de recherche mensuel : nombre arrondi + barre de 4 segments. */
export function Volume({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-text-muted" aria-label="Volume inconnu">—</span>;
  const short = value >= 1000 ? `${(value / 1000).toLocaleString("fr-CH", { maximumFractionDigits: 1 })} k` : String(value);
  const level = value >= 5000 ? 4 : value >= 1000 ? 3 : value >= 200 ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text-muted" aria-label={`${value.toLocaleString("fr-CH")} recherches par mois`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <i key={i} className={cx("block h-3 w-1.5 rounded-sm", i <= level ? "bg-accent" : "bg-surface-sunken")} />)}
      </span>
      <span aria-hidden="true">{short} / mois</span>
    </span>
  );
}
