import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cx } from "@/lib/cx";

type Tone = "info" | "warning" | "danger" | "success";
const TONE: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "bg-info-soft text-info", Icon: Info },
  warning: { cls: "bg-warning-soft text-warning", Icon: AlertTriangle },
  danger: { cls: "bg-danger-soft text-danger", Icon: XCircle },
  success: { cls: "bg-success-soft text-success", Icon: CheckCircle2 },
};

/** Bannière en haut de page (essai, quota, paiement). Une seule à la fois : la plus grave. */
export function Banner({ tone = "info", children, action }: { tone?: Tone; children: React.ReactNode; action?: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <div role="status" className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-4 py-3 text-sm", t.cls)}>
      <t.Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: typeof Info; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card py-8 text-center">
      <Icon aria-hidden="true" className="mx-auto size-6 text-text-muted" />
      <p className="mt-3 font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Notification brève (affichage seul ; la file des toasts viendra avec l'app). */
export function Toast({ children, action, tone = "info" }: { children: React.ReactNode; action?: React.ReactNode; tone?: "info" | "danger" }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className="inline-flex items-center gap-4 rounded-lg bg-text px-4 py-3 text-sm text-bg shadow-pop">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Étapes de l'onboarding : barre complète dès md, « Étape n sur 7 » sur mobile. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Étapes">
      <p className="mb-2 text-sm text-text-muted md:hidden">Étape {current} sur {steps.length} · <span className="font-semibold text-text">{steps[current - 1]}</span></p>
      <div className="h-1.5 rounded-pill bg-surface-sunken md:hidden" aria-hidden="true">
        <div className="h-1.5 rounded-pill bg-accent" style={{ width: `${(current / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden gap-2 md:flex">
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 flex-col gap-2">
              <span className={cx("h-1.5 rounded-pill", state === "todo" ? "bg-surface-sunken" : "bg-accent")} aria-hidden="true" />
              <span className={cx("text-xs", state === "current" ? "font-semibold text-text" : "text-text-muted")}>
                {state === "done" && <span aria-hidden="true">✓ </span>}{s}
                {state === "done" && <span className="sr-only"> (fait)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
