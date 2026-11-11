"use client";
import { signIn, signUp } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";

export function SignUpForm() {
  return (
    <ActionForm action={signUp}>
      <div className="space-y-4">
        <TextField label="Votre nom" name="name" autoComplete="name" maxLength={80} />
        <TextField label="E-mail professionnel" name="email" type="email" autoComplete="email" required />
      </div>
      <Submit className="mt-5 w-full" size="lg">Créer mon compte</Submit>
    </ActionForm>
  );
}

export function SignInForm() {
  return (
    <ActionForm action={signIn}>
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
      <Submit className="mt-5 w-full" size="lg">Se connecter</Submit>
    </ActionForm>
  );
}
