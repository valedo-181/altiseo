/** « Déménager en hiver : 7 conseils ! » → « demenager-en-hiver-7-conseils ». */
export function slugify(title: string, max = 80): string {
  const s = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s || "article";
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : max).replace(/-+$/, "");
}

/** Slug libre : ajoute -2, -3… si le slug est déjà pris sur le site. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const s = `${base}-${i}`;
    if (!taken.has(s)) return s;
  }
}
