/**
 * De l'article à la demande d'image : toujours une photo réaliste, sans texte, sans logo et sans
 * visage reconnaissable (pas de faute d'orthographe générée, pas de faux « employé »).
 * Fonctions pures, testées dans images.test.ts.
 */
export const IMAGE_STYLE = "Realistic editorial photograph, natural light, shallow depth of field, landscape 16:9. No text, no letters, no numbers, no signage, no logos, no brand names, no watermark. No recognizable faces: people only from behind, at a distance or hands only.";
export const MAX_IMAGE_GENERATIONS = 5;
const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** `idea` : la scène proposée à la rédaction (peut manquer) ; sinon on part du titre et du thème. */
export function buildImagePrompt(a: { idea?: string | null; title: string; theme: string; keyword?: string }): string {
  const idea = clean(a.idea ?? "", 400);
  const subject = idea || `A scene illustrating "${clean(a.title, 160)}"${a.theme ? `, in the field of ${clean(a.theme, 60)}` : ""}${a.keyword ? ` (${clean(a.keyword, 80)})` : ""}`;
  return `${subject.replace(/[.\s]+$/, "")}. ${IMAGE_STYLE}`;
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
