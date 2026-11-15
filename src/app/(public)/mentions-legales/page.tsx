import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { alternates: { canonical: "/mentions-legales" }, title: "Mentions légales", description: "Qui exploite Altiseo : raison sociale, adresse, contact et informations légales." };

export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur du site et du service</h2>
      <p>
        {COMPANY.name}<br />
        {COMPANY.street}<br />
        {COMPANY.city}, Suisse
      </p>
      {COMPANY.ide && <p>Numéro d'identification des entreprises (IDE) : {COMPANY.ide}</p>}
      <p>Contact : <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>

      <h2>Hébergement</h2>
      <p>L'application est hébergée par Vercel Inc. (région européenne, Irlande). Les données sont conservées par Supabase dans l'Union européenne (Irlande). Le détail figure dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>

      <h2>Propriété intellectuelle</h2>
      <p>Le nom Altiseo, le logo, les textes, les images et le code de ce site appartiennent à {COMPANY.name} ou sont utilisés avec autorisation. Toute reprise demande notre accord écrit.</p>
      <p>Les articles, images et annonces produits pour un client dans l'application lui appartiennent, dans les limites décrites dans les <Link href="/conditions">conditions d'utilisation</Link>.</p>

      <h2>Contenus produits avec l'intelligence artificielle</h2>
      <p>Les sujets, articles, images et annonces proposés par Altiseo sont produits à l'aide de systèmes d'intelligence artificielle. Ils peuvent contenir des erreurs. Chaque client relit et valide ses contenus avant de les publier, et en reste responsable.</p>

      <h2>Responsabilité</h2>
      <p>Nous veillons à l'exactitude des informations de ce site, sans pouvoir la garantir. Altiseo ne promet aucun classement dans les moteurs de recherche ni dans les assistants d'intelligence artificielle : ces résultats dépendent de tiers.</p>
      <p>Les sites vers lesquels nous renvoyons sont sous la responsabilité de leurs éditeurs.</p>

      <h2>Droit applicable</h2>
      <p>Le droit suisse s'applique. Le for est à {COMPANY.forum}, sous réserve des fors impératifs prévus par la loi.</p>
    </LegalPage>
  );
}
