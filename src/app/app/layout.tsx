import { AppShell } from "@/components/shell/app-shell";
import { requireSite } from "@/lib/app/context";
import { config } from "@/lib/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, site, sites, subscription } = await requireSite();
  const quota = subscription ? { used: subscription.used, total: subscription.articlesPerMonth, trialEndsAt: subscription.status === "trialing" ? subscription.trialEndsAt : null } : null;
  const simulated = { ai: !config.ai, cms: !config.cms, data: !config.supabase };
  return <AppShell user={user} site={site} sites={sites} quota={quota} simulated={simulated}>{children}</AppShell>;
}
