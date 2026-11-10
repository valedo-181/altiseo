import { cx } from "@/lib/cx";
import { STATUS_LABEL, type Client, type Health, type Status } from "@/lib/admin/console";

const TONE: Record<Status, string> = {
  trial: "bg-info-soft text-info", trial_ended: "bg-warning-soft text-warning", active: "bg-success-soft text-success",
  past_due: "bg-danger-soft text-danger", canceled: "bg-surface-sunken text-text-muted", suspended: "bg-danger-soft text-danger",
};

export function StatusBadge({ c }: { c: Pick<Client, "status" | "trialDaysLeft"> }) {
  return (
    <span className={cx("pill", TONE[c.status])}>
      {STATUS_LABEL[c.status]}{c.status === "trial" && c.trialDaysLeft !== null ? ` · ${c.trialDaysLeft} j` : ""}
    </span>
  );
}

const DOT: Record<Health, [string, string]> = { ok: ["bg-success", "Tout va bien"], watch: ["bg-warning", "À surveiller"], risk: ["bg-danger", "À traiter"] };
export function HealthDot({ health }: { health: Health }) {
  return <span className={cx("inline-block size-2.5 shrink-0 rounded-full", DOT[health][0])} role="img" aria-label={DOT[health][1]} />;
}

const d = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" });
const dt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
export const day = (iso: string | null) => (iso ? d.format(new Date(iso)) : "—");
export const dayTime = (iso: string | null) => (iso ? dt.format(new Date(iso)) : "—");
