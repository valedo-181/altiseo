import { AppShell } from "@/components/shell/app-shell";
import { requireSite } from "@/lib/app/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, site, sites, subscription } = await requireSite();
  const quota = subscription ? { used: subscription.used, total: subscription.articlesPerMonth, trialEndsAt: subscription.status === "trialing" ? subscription.trialEndsAt : null } : null;
  return <AppShell user={user} site={site} sites={sites} quota={quota}>{children}</AppShell>;
}
