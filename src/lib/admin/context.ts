import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { config } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";
import { DEFAULT_USD_CHF, toClient, type Client, type WorkspaceRow } from "./console";

/**
 * Accès à la console super admin : compte listé dans platform_admins, puis double authentification.
 * Un compte non listé reçoit « page introuvable » (la console ne se révèle pas). La base revérifie
 * tout à chaque appel (fonctions admin_*) : ce contexte ne sert qu'à choisir l'écran.
 */
export type AdminContext = { supabase: SupabaseClient; email: string; mfa: "ok" | "enroll" | "challenge"; factorId: string | null };

export const adminContext = cache(async (): Promise<AdminContext> => {
  if (!config.supabase) notFound();
  const supabase = await userClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/connexion");
  const { data: st } = await supabase.rpc("platform_admin_status");
  if (!st?.listed) notFound();
  const email = data.user.email ?? "";
  if (st.aal2) return { supabase, email, mfa: "ok", factorId: null };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0]; // facteurs vérifiés seulement
  return { supabase, email, mfa: totp ? "challenge" : "enroll", factorId: totp?.id ?? null };
});

export const usdChf = () => Number(process.env.USD_CHF) || DEFAULT_USD_CHF;

export async function loadClients(ctx: AdminContext, now: Date): Promise<{ clients: Client[]; failed: boolean }> {
  const { data, error } = await ctx.supabase.rpc("admin_workspaces");
  if (error) return { clients: [], failed: true };
  const rate = usdChf();
  return {
    clients: ((data ?? []) as WorkspaceRow[]).map((r) =>
      toClient({ ...r, ai_cost_period_micro: Number(r.ai_cost_period_micro), ai_cost_30d_micro: Number(r.ai_cost_30d_micro), ai_cost_total_micro: Number(r.ai_cost_total_micro) }, now, rate)),
    failed: false,
  };
}

export type Failure = { kind: "publication" | "topic" | "job"; id: string; workspace_id: string | null; workspace_name: string | null; label: string; error: string | null; at: string };
export async function loadFailures(ctx: AdminContext): Promise<Failure[]> {
  const { data } = await ctx.supabase.rpc("admin_failures");
  return (data ?? []) as Failure[];
}

export type JournalRow = { at: string; admin_email: string | null; workspace_id: string | null; workspace_name: string | null; action: string; data: Record<string, unknown> | null };
export async function loadJournal(ctx: AdminContext, workspaceId: string | null, limit: number): Promise<JournalRow[]> {
  const { data } = await ctx.supabase.rpc("admin_journal", { wid: workspaceId, lim: limit });
  return (data ?? []) as JournalRow[];
}
