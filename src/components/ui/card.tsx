import { cx } from "@/lib/cx";

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card", className)} {...rest} />;
}

type KpiProps = { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "muted" | "success" | "danger"; loading?: boolean };

export function KpiCard({ label, value, hint, tone = "muted", loading }: KpiProps) {
  return (
    <Card>
      <p className="text-sm text-text-muted">{label}</p>
      {loading ? (
        <div className="mt-2 space-y-2" aria-busy="true" aria-label="Chargement">
          <div className="h-7 w-20 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-3 w-28 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      ) : (
        <>
          <p className="text-2xl tabular-nums">{value}</p>
          {hint && <p className={cx("text-xs", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-text-muted")}>{hint}</p>}
        </>
      )}
    </Card>
  );
}

/** Score d'audit sur 100 : rouge < 50, orange < 90, vert au-delà. */
export function ScoreGauge({ value, size = 64, label = "Score d'audit" }: { value: number | null; size?: number; label?: string }) {
  if (value == null) {
    return (
      <div className="grid shrink-0 place-items-center rounded-full border-2 border-dashed border-border-input text-xs text-text-muted" style={{ width: size, height: size }}>—</div>
    );
  }
  const color = value < 50 ? "var(--c-danger)" : value < 90 ? "var(--c-warning)" : "var(--c-success)";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(rgb(${color}) ${value}%, rgb(var(--c-surface-sunken)) 0)` }}
    >
      <span className="absolute inset-1.5 rounded-full bg-bg" />
      <span className="relative font-bold tabular-nums" style={{ fontSize: size * 0.28 }}>{value}</span>
    </div>
  );
}

/** Barre de quota (articles utilisés sur le mois). */
export function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const tone = used >= total ? "bg-danger" : pct >= 90 ? "bg-warning" : "bg-accent";
  return (
    <div role="meter" aria-label="Articles utilisés ce mois" aria-valuenow={used} aria-valuemin={0} aria-valuemax={total} className="mt-2 h-2 rounded-pill bg-surface-sunken">
      <div className={cx("h-2 rounded-pill", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}
