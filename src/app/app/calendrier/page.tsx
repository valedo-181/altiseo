import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { formatDay, localDate } from "@/lib/domain/dates";
import { CalendarActions } from "./header-actions";
import { TopicCard } from "./topic-card";

/** Rédaction et analyse par l'IA : jusqu'à quelques minutes (Vercel Pro). */
export const maxDuration = 300;

export const metadata: Metadata = { title: "Calendrier" };

/** S12 : calendrier des sujets, groupés par semaine. */
export default async function Calendar({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  const { nouveau } = await searchParams;
  const { workspace, site } = await requireSite();
  const [items, articles] = await Promise.all([db.listCalendar(workspace.id, site.id), db.listArticles(workspace.id, site.id)]);
  const byItem = new Map(articles.filter((a) => a.calendarItemId).map((a) => [a.calendarItemId!, a.id]));
  const today = localDate(new Date(), site.timezone);
  const proposed = items.filter((i) => i.status === "proposed").length;

  // Groupes par semaine (lundi)
  const weeks = new Map<string, typeof items>();
  for (const it of items) {
    const d = new Date(`${it.scheduledFor}T12:00:00Z`);
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weeks.set(key, [...(weeks.get(key) ?? []), it]);
  }

  return (
    <>
      <PageHeader
        title="Calendrier"
        lead={items.length ? `${items.length} sujets, publiés à ${site.publishTime} (${site.timezone.replace("_", " ")}). ${proposed ? `${proposed} à approuver.` : "Tout est approuvé."}` : "Vos sujets d'articles, jour par jour."}
        actions={<CalendarActions empty={!items.length} />}
      />
      {nouveau && items.length > 0 && (
        <Banner tone="success">Vos {items.length} premiers sujets sont prêts. Approuvez ceux qui vous plaisent, changez les autres, ou écrivez le premier article tout de suite.</Banner>
      )}
      {!items.length ? (
        <EmptyState icon={CalendarDays} title="Pas encore de sujets">Nous préparons 30 sujets à partir du thème de votre site. Vous pourrez les changer un par un.</EmptyState>
      ) : (
        [...weeks.entries()].map(([monday, list]) => (
          <section key={monday} aria-labelledby={`w-${monday}`} className="space-y-3">
            <h2 id={`w-${monday}`} className="text-sm font-semibold text-text-muted">Semaine du {formatDay(monday, { day: "numeric", month: "long" })}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((it) => (
                <TopicCard key={it.id} item={it} dayLabel={formatDay(it.scheduledFor)} today={it.scheduledFor === today} articleId={byItem.get(it.id)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
