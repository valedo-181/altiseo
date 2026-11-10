import { ShieldCheck } from "lucide-react";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { Banner } from "@/components/ui/feedback";
import type { AdminContext } from "@/lib/admin/context";
import { verifyMfa } from "./actions";

/** Double authentification : configuration la première fois (QR code), puis code à chaque connexion. */
export async function MfaScreen({ ctx }: { ctx: AdminContext }) {
  let factorId = ctx.factorId;
  let qr: string | null = null;
  let secret: string | null = null;

  if (ctx.mfa === "enroll") {
    // Les configurations commencées et jamais terminées sont remplacées par une nouvelle.
    const { data: factors } = await ctx.supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await ctx.supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await ctx.supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Altiseo" });
    if (error || !data) return <Banner tone="danger">La double authentification n'a pas pu être préparée. Rechargez la page.</Banner>;
    factorId = data.id;
    qr = data.totp.qr_code;
    secret = data.totp.secret;
  }

  return (
    <section className="card mx-auto max-w-md space-y-4 p-6" aria-labelledby="mfa-title">
      <h1 id="mfa-title" className="flex items-center gap-2 text-xl"><ShieldCheck aria-hidden="true" className="size-5 text-accent" />Double authentification</h1>
      {ctx.mfa === "enroll" ? (
        <>
          <p className="text-sm text-text-muted">La console donne accès à tous les clients : elle demande un code en plus de votre connexion.</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Ouvrez une application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Scannez ce QR code.</li>
            <li>Saisissez le code à 6 chiffres affiché.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr!} alt="QR code de la double authentification" className="mx-auto size-48 rounded-md bg-white p-2" />
          <p className="text-center text-xs text-text-muted">Pas de caméra ? Clé à saisir : <span className="select-all break-all font-mono text-text">{secret}</span></p>
        </>
      ) : (
        <p className="text-sm text-text-muted">Saisissez le code à 6 chiffres de votre application d'authentification.</p>
      )}
      <ActionForm action={verifyMfa} className="space-y-4">
        <input type="hidden" name="factor_id" value={factorId ?? ""} />
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-semibold">Code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className="field field-lg font-mono text-lg tracking-[0.3em]" />
        </div>
        <Submit className="w-full" size="lg">Valider</Submit>
      </ActionForm>
    </section>
  );
}
