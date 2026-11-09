/**
 * Markdown restreint des articles → HTML. Sûr par construction : tout le texte est échappé, seules
 * les balises produites ici sortent (h2, h3, p, ul, ol, li, strong, em, a, blockquote).
 * Liens : http(s) ou chemin du site (« /… ») uniquement, rel="noopener" sur les liens externes.
 *
 * Syntaxe : « ## titre », « ### sous-titre », « - puce », « 1. liste », « > citation »,
 * **gras**, *italique*, [texte](https://…). Paragraphes séparés par une ligne vide.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(h)) return h;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(h)) return h;
  return null;
}

function inline(text: string): string {
  // Liens d'abord (sur le texte brut), puis gras / italique sur le texte échappé.
  const out: string[] = [];
  let last = 0;
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;
  for (let m: RegExpExecArray | null; (m = re.exec(text)); ) {
    out.push(emph(escapeHtml(text.slice(last, m.index))));
    const href = safeHref(m[2]);
    const label = emph(escapeHtml(m[1]));
    if (href) {
      const ext = /^https?:/i.test(href) ? ' rel="noopener"' : "";
      out.push(`<a href="${escapeHtml(href)}"${ext}>${label}</a>`);
    } else {
      out.push(label);
    }
    last = m.index + m[0].length;
  }
  out.push(emph(escapeHtml(text.slice(last))));
  return out.join("");
}

function emph(s: string): string {
  return s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      flushAll();
      const tag = m[1].length === 2 ? "h2" : "h3";
      html.push(`<${tag}>${inline(m[2].trim())}</${tag}>`);
      continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.+)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return html.join("\n");
}

/** Nombre de mots du texte lisible (sans la syntaxe). */
export function wordCount(md: string): number {
  const text = md.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`-]/g, " ");
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}
