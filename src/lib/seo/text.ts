/** Texte lisible d'une page HTML, pour l'analyse par l'IA (scripts, styles et balises retirés). */
export function htmlToText(html: string, max = 6000): { title: string; description: string; text: string } {
  const pick = (re: RegExp) => decode((html.match(re)?.[1] ?? "").trim());
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const body = html
    .replace(/<head[\s>][\s\S]*?<\/head>/i, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body).replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return { title, description, text: text.length > max ? `${text.slice(0, max)}…` : text };
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
