"use client";
import { connectGitHub, connectWordPress } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { WordPressFields } from "@/components/forms/wordpress-fields";
import { TextField, UrlField } from "@/components/ui/field";

export function WordPressForm({ endpoint, username }: { endpoint: string; username?: string }) {
  return (
    <ActionForm action={connectWordPress} className="space-y-4">
      <WordPressFields endpoint={endpoint} username={username} />
      <Submit>Connecter et tester</Submit>
    </ActionForm>
  );
}

/** Site statique sur GitHub : Altiseo écrit chaque article en JSON dans le dépôt du site. */
export function GitHubForm({ siteUrl }: { siteUrl: string }) {
  return (
    <ActionForm action={connectGitHub} className="space-y-4">
      <UrlField label="Adresse du site" name="siteUrl" defaultValue={siteUrl.replace(/^https:\/\//, "")} required />
      <TextField label="Dépôt GitHub du site" name="repo" placeholder="proprietaire/depot" autoComplete="off" required help="Le dépôt qui contient les pages du site, par exemple valedo-181/domevia." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Branche" name="branch" defaultValue="main" autoComplete="off" required help="Celle que votre hébergeur met en ligne." />
        <TextField label="Dossier du blog" name="dir" defaultValue="blog" autoComplete="off" required help="Articles dans blog/articles/, pages à /blog/." />
      </div>
      <TextField
        label="Jeton d'accès GitHub"
        name="token"
        type="password"
        autoComplete="off"
        required
        help="GitHub : Settings → Developer settings → Fine-grained tokens → Generate. Accès à ce seul dépôt, permission « Contents : Read and write ». Il est chiffré et ne sert qu'à écrire les articles."
      />
      <Submit>Connecter et tester</Submit>
    </ActionForm>
  );
}
