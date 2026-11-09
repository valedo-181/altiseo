import { TextField, UrlField } from "@/components/ui/field";

/** Connexion WordPress par mot de passe d'application (rien à installer sur le site). */
export function WordPressFields({ endpoint, username }: { endpoint?: string; username?: string }) {
  return (
    <div className="space-y-4">
      <UrlField label="Adresse du site WordPress" name="endpoint" defaultValue={endpoint?.replace(/^https:\/\//, "")} required />
      <TextField label="Nom d'utilisateur WordPress" name="username" autoComplete="off" defaultValue={username} required />
      <TextField
        label="Mot de passe d'application"
        name="appPassword"
        type="password"
        autoComplete="off"
        required
        help="Dans WordPress : Comptes → Profil → Mots de passe d'application → Ajouter. Collez les 24 caractères. Ce n'est pas votre mot de passe habituel."
      />
    </div>
  );
}
