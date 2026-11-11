/**
 * Article d'exemple en MODE DÉMO (sans IA) : un plan structuré autour du sujet, des liens internes
 * vers les articles déjà écrits, une FAQ. La vraie rédaction (Claude) renverra la même forme.
 */
import { MAX_INTERNAL_LINKS, type InternalLink } from "./types.ts";
import { wordCount } from "./markdown.ts";

export type WriteInput = {
  siteName: string;
  siteUrl: string;
  theme: string;
  title: string;
  angle: string;
  keyword: string;
  existing: Array<{ title: string; slug: string }>;
};

export type WrittenArticle = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyMd: string;
  keywords: string[];
  internalLinks: InternalLink[];
  wordCount: number;
  /** Scène à photographier pour illustrer l'article (en anglais), si la rédaction en propose une. */
  imageIdea?: string;
};

export function clip(s: string, max: number): string {
  if ([...s].length <= max) return s;
  const cut = [...s].slice(0, max - 1).join("");
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.!?-]+$/, "")}…`;
}

export function writeDemoArticle(input: WriteInput): WrittenArticle {
  const t = input.theme.trim().toLowerCase() || "ce sujet";
  const links: InternalLink[] = input.existing.slice(0, MAX_INTERNAL_LINKS).map((a) => ({ url: `/${a.slug}`, anchor: a.title }));
  const related = links.slice(0, 3);
  const md = [
    `${input.angle} Dans cet article, ${input.siteName} vous explique l'essentiel, sans jargon, pour décider en connaissance de cause.`,
    "",
    "## L'essentiel en bref",
    "",
    `- Ce qu'il faut savoir avant de se lancer dans un projet de ${t}.`,
    "- Les points qui font varier le résultat… et le budget.",
    "- Nos conseils concrets, tirés du terrain.",
    "",
    `## Pourquoi c'est important`,
    "",
    `Un projet de ${t} bien préparé, c'est moins de stress, moins d'imprévus et un résultat à la hauteur. Les clients qui prennent le temps de s'informer évitent la plupart des mauvaises surprises.`,
    "",
    "## Nos conseils, étape par étape",
    "",
    "1. **Faites le point sur vos besoins.** Notez ce qui compte vraiment pour vous : délai, budget, qualité.",
    "2. **Comparez au moins deux offres.** Regardez le détail, pas seulement le prix total.",
    "3. **Posez vos questions par écrit.** Une réponse claire est un bon signe de sérieux.",
    "4. **Anticipez.** Plus vous vous y prenez tôt, plus vous avez le choix.",
    "",
    ...(related.length
      ? ["## Pour aller plus loin", "", ...related.map((l) => `- [${l.anchor}](${l.url})`), ""]
      : []),
    "## Questions fréquentes",
    "",
    `### Combien de temps faut-il prévoir ?`,
    "",
    "Cela dépend de votre situation. Comptez quelques jours de préparation pour un petit projet, plusieurs semaines pour un projet important.",
    "",
    `### Faut-il faire appel à un professionnel ?`,
    "",
    `Ce n'est pas obligatoire, mais un professionnel du ${t} vous fait gagner du temps et vous évite des erreurs coûteuses.`,
    "",
    "## En résumé",
    "",
    `Bien préparé, votre projet de ${t} se passe sereinement. Une question ? [Contactez ${input.siteName}](${input.siteUrl}).`,
  ].join("\n");
  return {
    title: input.title,
    metaTitle: clip(input.title, 60),
    metaDescription: clip(`${input.angle} Les conseils de ${input.siteName}.`, 155),
    bodyMd: md,
    keywords: [input.keyword],
    internalLinks: links,
    wordCount: wordCount(md),
  };
}
