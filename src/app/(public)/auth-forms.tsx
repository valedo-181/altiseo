"use client";
import { signIn, signUp } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

/**
 * Étape 2 (connexion ou inscription) : l'e-mail contient un code à 6 chiffres et un lien.
 * Le code sert quand le lien s'ouvre dans un autre navigateur ou sur un autre appareil (téléphone).
 */
function CodeStep({ email, restart }: { email: string; restart: string }) {
  return (
    <>
      <input type="hidden" name="email" value={email} />
      <TextField
        label="Code reçu par e-mail"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 \-]*"
        maxLength={12}
        placeholder="123456"
        help={`Envoyé à ${email}. Vous pouvez aussi cliquer sur le lien de l'e-mail.`}
        className="text-center font-mono text-2xl tracking-[0.4em]"
        autoFocus
        required
      />
      <Submit className="mt-5 w-full" size="lg">Valider le code</Submit>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button type="submit" variant="ghost" size="sm" name="intent" value="renvoyer" formNoValidate>Recevoir un nouveau code</Button>
        <a href={restart} className="text-text-muted underline underline-offset-2">Changer d&apos;adresse</a>
      </div>
    </>
  );
}

export function SignUpForm() {
  return (
    <ActionForm action={signUp}>
      {(state) =>
        state?.sentTo ? (
          <CodeStep email={state.sentTo} restart="/inscription" />
        ) : (
          <>
            <div className="space-y-4">
              <TextField label="Votre nom" name="name" autoComplete="name" maxLength={80} />
              <TextField label="E-mail professionnel" name="email" type="email" autoComplete="email" required />
            </div>
            <Submit className="mt-5 w-full" size="lg">Créer mon compte</Submit>
          </>
        )
      }
    </ActionForm>
  );
}

export function SignInForm() {
  return (
    <ActionForm action={signIn}>
      {(state) =>
        state?.sentTo ? (
          <CodeStep email={state.sentTo} restart="/connexion" />
        ) : (
          <>
            <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
            <Submit className="mt-5 w-full" size="lg">Recevoir mon code de connexion</Submit>
          </>
        )
      }
    </ActionForm>
  );
}
