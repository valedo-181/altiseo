import { monthLabel, shiftMonth } from "@/lib/report/monthly";

/** Les 6 derniers mois, pour passer d'un rapport à l'autre. */
export function lastMonths(current: string, href: (m: string) => string) {
  return Array.from({ length: 6 }, (_, i) => shiftMonth(current, -i)).reverse().map((m) => ({ value: m, label: monthLabel(m).replace(/ \d{4}$/, ""), href: href(m) }));
}
