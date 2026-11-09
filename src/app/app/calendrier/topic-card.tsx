"use client";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { topicAction, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Difficulty, StatusPill, Volume, type Status } from "@/components/ui/status";
import { cx } from "@/lib/cx";
import { MAX_REGENERATIONS, type CalendarItem } from "@/lib/domain/types";

type OpProps = { op: string; children: React.ReactNode; variant?: "ghost" | "secondary" | "primary"; busy: string | null };
function Op({ op, children, variant = "ghost", busy }: OpProps) {
  return <Button type="submit" name="op" value={op} variant={variant} size="xs" disabled={busy !== null} loading={busy === op}>{children}</Button>;
}

const STATUS: Record<CalendarItem["status"], Status> = { proposed: "proposed", approved: "approved", generating: "generating", done: "draft", failed: "failed", skipped: "skipped" };

export function TopicCard({ item, dayLabel, today, articleId }: { item: CalendarItem; dayLabel: string; today: boolean; articleId?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(topicAction, undefined);
  const [lastOp, setLastOp] = useState<string | null>(null);
  const busy = pending ? lastOp : null;
  const open = item.status === "proposed" || item.status === "approved";
  return (
    <li className={cx("card flex flex-col gap-2 p-3", today && "ring-2 ring-accent", item.status === "skipped" && "opacity-70")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">{dayLabel}{today && " · aujourd'hui"}</p>
        <StatusPill status={item.status === "done" && articleId ? "draft" : STATUS[item.status]} />
      </div>
      <p className={cx("text-sm font-semibold leading-5", item.status === "skipped" && "line-through")}>{item.title}</p>
      <p className="text-xs text-text-muted">{item.angle}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-text-muted">Mot-clé : <span className="text-text">{item.keyword}</span></span>
        <Volume value={item.searchVolume} />
        <Difficulty value={item.difficulty} />
      </div>
      <form
        className="mt-auto flex flex-wrap gap-1 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const data = new FormData(e.currentTarget, submitter);
          setLastOp(String(data.get("op")));
          startTransition(() => run(data));
        }}
      >
        <input type="hidden" name="id" value={item.id} />
        {item.status === "proposed" && <Op busy={busy} op="approve" variant="secondary">Approuver</Op>}
        {open && <Op busy={busy} op="write" variant="primary">Écrire maintenant</Op>}
        {open && item.regenerations < MAX_REGENERATIONS && <Op busy={busy} op="regenerate">Changer ({item.regenerations}/{MAX_REGENERATIONS})</Op>}
        {open && <Op busy={busy} op="skip">Sauter</Op>}
        {item.status === "skipped" && <Op busy={busy} op="restore">Remettre</Op>}
        {articleId && <Link href={`/app/articles/${articleId}`} className="btn btn-secondary btn-xs">Ouvrir l'article</Link>}
      </form>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
    </li>
  );
}
