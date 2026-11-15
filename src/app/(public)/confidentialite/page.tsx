import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COMPANY, PROCESSORS } from "@/lib/legal";

export const metadata: Metadata = { alternates: { canonical: "/confidentialite" }, title: "Politique de confidentialité", description: "Quelles données Altiseo traite, pourquoi, avec quels prestataires, et comment exercer vos droits." };

export default function Privacy() {
  const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Cette page explique quelles données personnelles Altiseo traite, pourquoi, et quels sont vos droits. Elle suit la loi fédérale suisse sur la protection des données (LPD) et, lorsqu'il s'applique, le règlement européen (RGPD).</p>

      <h2>Qui est responsable de vos données</h2>
      <p>{COMPANY.name}, {COMPANY.street}, {COMPANY.city}, Suisse. Pour toute question ou demande : {mail}.</p>

      <h2>Les données que nous traitons</h2>
      <ul>
        <li><strong>Votre compte</strong> : adresse e-mail, nom si vous l'indiquez, date de dernière connexion.</li>
        <li><strong>Votre entreprise et votre site</strong> : adresse du site, description de l'activité, clientèle visée, ton, consignes de rédaction, concurrents que vous indiquez.</li>
        <li><strong>Vos contenus</strong> : sujets, articles, images, annonces, réglages de publication.</li>
        <li><strong>Vos connexions</strong> : identifiants de votre site (WordPress, GitHub) et accès à Google Search Console, si vous les connectez. Ils sont conservés chiffrés et ne sont jamais affichés.</li>
        <li><strong>Données techniques</strong> : journaux de l'application (date, page demandée, erreurs), nécessaires à son fonctionnement et à sa sécurité.</li>
      </ul>
      <p>Nous ne vendons aucune donnée et n'en faisons aucun usage publicitaire.</p>

      <h2>Pourquoi nous les traitons</h2>
      <ul>
        <li>Fournir le service que vous avez demandé : préparer, écrire, illustrer et publier vos contenus, mesurer leurs résultats.</li>
        <li>Gérer votre compte, votre essai et votre abonnement.</li>
        <li>Assurer la sécurité du service, prévenir les abus et corriger les pannes.</li>
        <li>Respecter nos obligations légales, notamment comptables.</li>
      </ul>

      <h2>Les prestataires qui nous aident</h2>
      <p>Nous faisons appel aux prestataires ci-dessous. Ils ne reçoivent que ce qui est nécessaire à leur tâche et n'ont pas le droit d'utiliser ces données pour leur propre compte.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-text-muted">
            <tr><th scope="col" className="px-4 py-2 font-semibold">Prestataire</th><th scope="col" className="px-4 py-2 font-semibold">Rôle</th><th scope="col" className="px-4 py-2 font-semibold">Données</th><th scope="col" className="px-4 py-2 font-semibold">Lieu</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PROCESSORS.map((p) => (
              <tr key={p.name}><th scope="row" className="px-4 py-2 align-top font-semibold">{p.name}</th><td className="px-4 py-2">{p.role}</td><td className="px-4 py-2">{p.data}</td><td className="px-4 py-2">{p.where}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Transferts hors de Suisse</h2>
      <p>Certains de ces prestataires se trouvent dans l'Union européenne, dont le niveau de protection est reconnu par la Suisse, ou aux États-Unis. Pour les États-Unis, les transferts reposent sur les garanties prévues par la loi, en particulier des clauses contractuelles types ou la certification du prestataire au cadre de protection des données Suisse–États-Unis.</p>

      <h2>Intelligence artificielle</h2>
      <p>Pour écrire vos contenus, Altiseo transmet à un service d'intelligence artificielle la description de votre activité, le contenu public de votre site et vos consignes. Évitez d'y inscrire des données personnelles de tiers. Les contenus produits vous sont proposés pour relecture : aucune décision ayant un effet juridique pour vous n'est prise de façon automatique.</p>

      <h2>Cookies</h2>
      <p>Altiseo utilise uniquement les cookies indispensables : celui qui maintient votre connexion et ceux qui protègent les formulaires. Il n'y a ni cookie publicitaire ni outil de suivi tiers sur ce site, donc pas de bandeau de consentement.</p>

      <h2>Statistiques de visites de votre propre site</h2>
      <p>Si vous activez la mesure des visites sur votre site, Altiseo compte les pages vues sans cookie et sans conserver l'adresse IP de vos visiteurs. Vous restez responsable de l'information donnée à vos visiteurs ; Altiseo agit alors comme votre sous-traitant.</p>

      <h2>Combien de temps nous gardons vos données</h2>
      <ul>
        <li>Tant que votre compte est ouvert, pour vous fournir le service.</li>
        <li>À la fermeture du compte, vos données sont effacées dans un délai de 30 jours, sauf celles que la loi nous oblige à conserver (pièces comptables : dix ans).</li>
        <li>Les journaux techniques sont conservés quelques semaines au plus.</li>
      </ul>

      <h2>Sécurité</h2>
      <p>Les échanges sont chiffrés. Chaque client n'accède qu'à ses propres données, ce que la base de données contrôle elle-même. Les identifiants de vos sites sont chiffrés. L'accès de notre équipe aux comptes est limité, protégé par une double authentification et consigné dans un journal.</p>

      <h2>Vos droits</h2>
      <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, leur remise dans un format courant, ou vous opposer à un traitement. Écrivez à {mail} : nous répondons dans les 30 jours.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez vous adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT), ou à l'autorité de protection des données de votre pays de résidence dans l'Union européenne.</p>

      <h2>Modifications</h2>
      <p>Nous mettons cette page à jour lorsque le service évolue, par exemple à l'ajout d'un prestataire. La date en haut de page indique la dernière version.</p>
    </LegalPage>
  );
}
