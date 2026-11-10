import "server-only";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { db } from "@/lib/data/store";
import { userClient } from "@/lib/supabase/server";
import type { Site } from "@/lib/domain/types";
import { currentSiteId, sessionUserId } from "./session";

/** Compte et espace de la personne connectée, sinon retour à la connexion. */
export async function requireAccount() {
  const userId = await sessionUserId();
  if (!userId) redirect("/connexion");
  const user = await db.getUser(userId);
  if (!user) redirect("/connexion");
  let workspace = await db.workspaceOf(userId);
  if (!workspace && config.supabase) {
    // Premier passage après le lien de connexion : l'espace et l'essai sont créés dans la base.
    await (await userClient()).rpc("ensure_workspace", { ws_name: user.name ? `Espace de ${user.name}` : null });
    workspace = await db.workspaceOf(userId);
    if (!workspace) {
      // Espace suspendu par le super admin : la base ne le montre plus à ses membres.
      const { data } = await (await userClient()).rpc("my_suspension");
      if (Array.isArray(data) && data.length) redirect("/suspendu");
    }
  }
  if (!workspace) redirect("/connexion");
  return { user, workspace };
}

/** Compte + site courant. Sans site : onboarding. Site pas encore configuré : reprise de l'onboarding. */
export async function requireSite(opts: { allowOnboarding?: boolean } = {}) {
  const acc = await requireAccount();
  const sites = await db.listSites(acc.workspace.id);
  if (!sites.length) redirect("/onboarding/site");
  const wanted = await currentSiteId();
  const site: Site = sites.find((s) => s.id === wanted) ?? sites[0];
  if (!opts.allowOnboarding && site.onboardingStep < 8) redirect(`/onboarding/${ONBOARDING_STEPS[Math.max(0, site.onboardingStep - 1)].slug}`);
  const subscription = await db.subscription(acc.workspace.id);
  return { ...acc, sites, site, subscription };
}

export const ONBOARDING_STEPS = [
  { slug: "site", label: "Site" },
  { slug: "activite", label: "Activité" },
  { slug: "concurrents", label: "Concurrents" },
  { slug: "langue", label: "Langue et ton" },
  { slug: "publication", label: "Publication" },
  { slug: "planning", label: "Planning" },
  { slug: "offre", label: "Offre" },
] as const;
export type OnboardingSlug = (typeof ONBOARDING_STEPS)[number]["slug"];
