/**
 * De l'article à la demande d'image : toujours une photo réaliste, sans texte, sans logo et sans
 * visage reconnaissable (pas de faute d'orthographe générée, pas de faux « employé »).
 * Fonctions pures, testées dans images.test.ts.
 */
export const IMAGE_STYLE = "Realistic editorial photograph, natural light, shallow depth of field, landscape 16:9. No text, no letters, no numbers, no signage, no logos, no brand names, no watermark: any paper, screen, box or sign in the scene is blank. No recognizable faces: people only from behind, at a distance or hands only.";
export const MAX_IMAGE_GENERATIONS = 5;
const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Guillemets retirés : un mot entre guillemets est lu par le modèle comme un texte à écrire dans l'image. */
const unquote = (s: string) => s.replace(/["'`«»“”„‘’‹›]/g, " ");

/**
 * `idea` : la scène proposée à la rédaction (peut manquer). Sinon on décrit le sujet par le mot-clé
 * et le thème, jamais par le titre : un titre dans la demande finit écrit sur la photo (et mal orthographié).
 */
export function buildImagePrompt(a: { idea?: string | null; title: string; theme: string; keyword?: string }): string {
  const idea = clean(unquote(a.idea ?? ""), 400);
  const topic = [a.keyword, a.theme].map((x) => clean(unquote(x ?? ""), 80)).filter(Boolean).join(", ");
  const subject = idea || `A realistic everyday scene about ${topic || "home life"}, shown only through concrete objects, places and actions, never through written words`;
  return `${subject.replace(/[.\s]+$/, "")}. ${IMAGE_STYLE}`;
}

/** Demande enregistrée par l'ancienne version (titre entre guillemets) : à refaire plutôt qu'à réutiliser. */
export function isLegacyImagePrompt(prompt: string | null | undefined): boolean {
  return Boolean(prompt && /^A scene illustrating "/.test(prompt));
}

/** Texte de remplacement (lecteurs d'écran, Google Images) : court, sans « image de ». */
export function imageAlt(title: string): string {
  return clean(title, 125);
}

/**
 * Seules nos propres images partent vers le site du client : l'adresse doit être dans notre stockage.
 * (Un membre peut modifier son article dans la base ; il ne doit pas pouvoir nous faire télécharger autre chose.)
 */
export function isOwnImage(url: string | null | undefined, storageBase: string | null): url is string {
  if (!url || !storageBase) return false;
  try {
    const u = new URL(url), b = new URL(storageBase);
    return u.protocol === "https:" && u.host === b.host && u.pathname.startsWith("/storage/v1/object/public/article-images/") && !u.pathname.includes("..");
  } catch {
    return false;
  }
}
