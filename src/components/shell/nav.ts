import { CalendarDays, FileText, Gauge, LayoutDashboard, LineChart, Plug, Settings } from "lucide-react";

/** Menu de l'application (partagé par le serveur et le navigateur). */
export const NAV = [
  { href: "/app", label: "Tableau de bord", Icon: LayoutDashboard, exact: true },
  { href: "/app/calendrier", label: "Calendrier", Icon: CalendarDays },
  { href: "/app/articles", label: "Articles", Icon: FileText },
  { href: "/app/mots-cles", label: "Mots-clés", Icon: LineChart },
  { href: "/app/audit", label: "Audit", Icon: Gauge },
  { href: "/app/integrations", label: "Intégrations", Icon: Plug },
  { href: "/app/reglages", label: "Réglages", Icon: Settings },
] as const;
