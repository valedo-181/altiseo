"use client";
import { connectWordPress } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { WordPressFields } from "@/components/forms/wordpress-fields";

export function WordPressForm({ endpoint, username }: { endpoint: string; username?: string }) {
  return (
    <ActionForm action={connectWordPress} className="space-y-4">
      <WordPressFields endpoint={endpoint} username={username} />
      <Submit>Connecter et tester</Submit>
    </ActionForm>
  );
}
