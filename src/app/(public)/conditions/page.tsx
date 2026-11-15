import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { COMPANY } from "@/lib/legal";

export const metadata: Metadata = { alternates: { canonical: "/conditions" }, title: "Conditions d'utilisation", description: "Les règles d'utilisation d'Altiseo : essai, offres, contenus produits par IA, responsabilités, résiliation." };

export default function Terms() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <p>Ces conditions règlent l'utilisation d'Altiseo, service exploité par {COMPANY.name} (« nous »). En créant un compte, vous les acceptez.</p>

      <h2>1. Le service</h2>
      <p>Altiseo aide les entreprises à être trouvées en ligne : préparation de sujets, rédaction d'articles et création d'images à l'aide de l'intelligence artificielle, envoi sur votre site, préparation d'annonces, audit et suivi des résultats. Les fonctions disponibles dépendent de votre offre et sont décrites sur la page <Link href="/tarifs">Tarifs</Link>.</p>

      <h2>2. Votre compte</h2>
      <p>Le service s'adresse aux entreprises et aux indépendants. Vous devez avoir le droit d'agir pour le site que vous enregistrez. Vous êtes responsable de l'usage de votre compte et de la confidentialité de votre accès.</p>

      <h2>3. Essai gratuit</h2>
      <p>L'essai gratuit dure trois jours, sauf durée différente convenue avec nous, et se fait sans carte bancaire. À son terme, le service s'arrête de produire des contenus tant que vous n'avez pas choisi une offre. Rien n'est facturé sans votre accord.</p>

      <h2>4. Offres, prix et paiement</h2>
      <p>Les prix sont indiqués en francs suisses, hors TVA. L'abonnement mensuel se renouvelle de mois en mois ; l'abonnement annuel, d'année en année. Les modalités de paiement vous sont présentées au moment de la souscription. Nous pouvons modifier nos prix pour l'avenir en vous prévenant au moins trente jours à l'avance.</p>

      <h2>5. Contenus produits par l'intelligence artificielle</h2>
      <ul>
        <li>Les sujets, articles, images et annonces sont des propositions. Ils peuvent contenir des erreurs ou des imprécisions.</li>
        <li><strong>Vous relisez et validez chaque contenu avant sa publication</strong>, y compris lorsque vous choisissez la publication automatique. Vous restez seul responsable de ce qui paraît sur votre site et dans vos annonces.</li>
        <li>Nous ne garantissons ni l'originalité absolue des contenus, ni leur conformité aux règles propres à votre profession. Vérifiez-les si votre activité est réglementée.</li>
      </ul>

      <h2>6. Ce qui vous appartient</h2>
      <p>Les contenus produits pour vous dans Altiseo vous appartiennent, dans la mesure où la loi permet de les protéger. Vous nous donnez le droit de les traiter pour vous fournir le service. Vos données restent les vôtres : leur traitement est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>

      <h2>7. Usage correct du service</h2>
      <p>Vous vous engagez à ne pas utiliser Altiseo pour publier des contenus illicites, trompeurs, diffamatoires ou portant atteinte aux droits d'autrui, ni pour produire du contenu en masse sans intérêt pour le lecteur. Vous respectez les règles des plateformes que vous connectez (Google, Meta, WordPress, GitHub). Nous pouvons suspendre un compte qui enfreint ces règles, en vous en indiquant la raison.</p>

      <h2>8. Résultats</h2>
      <p>Le référencement et la visibilité dépendent de moteurs de recherche et d'assistants que nous ne contrôlons pas. <strong>Nous ne garantissons aucun classement, aucun trafic ni aucun chiffre d'affaires.</strong> Les annonces que nous préparons sont mises en ligne par vous, dans vos propres comptes publicitaires et à vos frais.</p>

      <h2>9. Disponibilité</h2>
      <p>Nous faisons de notre mieux pour que le service soit disponible, sans promettre une disponibilité sans interruption. Des opérations de maintenance ou une panne d'un prestataire peuvent le suspendre brièvement.</p>

      <h2>10. Responsabilité</h2>
      <p>Notre responsabilité est engagée en cas de faute grave ou intentionnelle. Dans les autres cas, et dans les limites permises par la loi, elle est limitée aux montants que vous nous avez versés au cours des douze derniers mois. Nous ne répondons pas des dommages indirects, comme un manque à gagner ou une perte de classement.</p>

      <h2>11. Durée et résiliation</h2>
      <p>Vous pouvez arrêter à tout moment : l'accès reste ouvert jusqu'à la fin de la période payée. À la fermeture de votre compte, vos données sont effacées comme indiqué dans la politique de confidentialité. Les articles déjà publiés sur votre site y restent.</p>

      <h2>12. Modifications</h2>
      <p>Nous pouvons adapter ces conditions lorsque le service évolue. En cas de changement important, nous vous prévenons par e-mail au moins trente jours à l'avance ; vous pouvez alors résilier sans frais.</p>

      <h2>13. Droit applicable et for</h2>
      <p>Le droit suisse s'applique. Le for est à {COMPANY.forum}, sous réserve des fors impératifs prévus par la loi.</p>

      <h2>Contact</h2>
      <p>{COMPANY.name}, {COMPANY.street}, {COMPANY.city}, Suisse · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
    </LegalPage>
  );
}
