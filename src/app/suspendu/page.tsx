import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { config } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Compte suspendu", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Ce que voit un client dont l'espace est suspendu : la raison, et comment nous joindre. */
export default async function Suspended() {
  if (!config.supabase) notFound();
  const sb = await userClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion");
  const { data } = await sb.rpc("my_suspension");
  const s = (data as Array<{ name: string; reason: string | null }> | null)?.[0];
  if (!s) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-4 px-4">
      <Logo size={32} />
      <h1 className="text-xl">Votre compte est suspendu</h1>
      <p className="text-text-muted">L'espace « {s.name} » est suspendu. Vos articles et vos réglages sont conservés.</p>
      {s.reason && <p className="card text-sm"><span className="font-semibold">Raison : </span>{s.reason}</p>}
      <p className="text-sm text-text-muted">Pour le réactiver, répondez à notre dernier e-mail ou écrivez-nous.</p>
      <form action={signOut}><button className="btn btn-secondary">Se déconnecter</button></form>
    </main>
  );
}
