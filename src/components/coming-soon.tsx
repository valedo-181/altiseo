import { Hammer } from "lucide-react";
import { PageHeader } from "./page-header";

/** Écran prévu (replica/recon.md) mais pas encore construit : on le dit, sans faux contenu. */
export function ComingSoon({ id, title, lead, items }: { id: string; title: string; lead: string; items: string[] }) {
  return (
    <>
      <PageHeader title={title} lead={lead} />
      <div className="card">
        <div className="flex items-center gap-2 text-sm font-semibold"><Hammer aria-hidden="true" className="size-4 text-warning" />En construction <span className="font-normal text-text-muted">({id})</span></div>
        <p className="mt-2 text-sm text-text-muted">Ce qui arrivera ici :</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      </div>
    </>
  );
}
