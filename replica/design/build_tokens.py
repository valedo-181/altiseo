"""Génère tokens.css et tailwind.preset.ts depuis tokens.json (même dossier).

    python3 -I replica/design/build_tokens.py            # écrit src/styles/tokens.css et tailwind.preset.ts

Couleurs en variables CSS « r g b » pour garder les opacités Tailwind (bg-accent/10).
Mode sombre : préférence du système, ou data-theme="dark" sur <html>.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CSS_OUT = os.path.join(ROOT, "src", "styles", "tokens.css")
PRESET_OUT = os.path.join(ROOT, "tailwind.preset.ts")


def rgb(hex_):
    h = hex_.lstrip("#")
    return "%d %d %d" % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def main():
    with open(os.path.join(HERE, "tokens.json"), encoding="utf-8") as fh:
        t = json.load(fh)
    light = {k: v for k, v in t["color"].items() if isinstance(v, str)}
    dark = t["color"]["dark"]
    missing = sorted(set(light) - set(dark))
    if missing:
        print("build_tokens: rôles sans valeur sombre : %s" % ", ".join(missing), file=sys.stderr)
        return 1

    def block(cols):
        return "\n".join("  --c-%s: %s;" % (k, rgb(v)) for k, v in cols.items())

    lines = ["/* Généré par build_tokens.py depuis tokens.json. Ne pas modifier à la main. */", ":root {", block(light)]
    lines += ["  --font-sans: %s;" % t["font"]["sans"], "  --font-serif: %s;" % t["font"]["serif"],
              "  --font-mono: %s;" % t["font"]["mono"]]
    for k, v in t["radius"].items():
        lines.append("  --radius-%s: %dpx;" % (k, v))
    for k, v in t["shadow"].items():
        lines.append("  --shadow-%s: %s;" % (k, v.replace("var(--color-bg)", "rgb(var(--c-bg))").replace("var(--color-focus)", "rgb(var(--c-focus))")))
    for k, v in t["motion"].items():
        lines.append("  --motion-%s: %s;" % (k, v))
    for k, v in t["layout"].items():
        if isinstance(v, int):
            lines.append("  --layout-%s: %dpx;" % (k, v))
    lines += ["  color-scheme: light;", "}",
              '@media (prefers-color-scheme: dark) {', '  :root:not([data-theme="light"]) {', block(dark).replace("\n", "\n  "), "    color-scheme: dark;", "  }", "}",
              ':root[data-theme="dark"] {', block(dark), "  color-scheme: dark;", "}", ""]
    os.makedirs(os.path.dirname(CSS_OUT), exist_ok=True)
    with open(CSS_OUT, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    colors = ",\n".join('        "%s": c("%s")' % (k, k) for k in light)
    sizes = ",\n".join('        "%s": ["%dpx", { lineHeight: "%dpx", fontWeight: "%d" }]' % (k, v["size"], v["line"], v["weight"])
                       for k, v in t["type"].items())
    # Espacement : l'échelle de Tailwind (pas de 4 px) correspond déjà à tokens.json ; la redéfinir
    # changerait le sens de h-10, p-4… Vérifier qu'elle reste sur la grille de 4 px.
    bad = [v for v in t["space"] if v % 4]
    if bad:
        print("build_tokens: espacements hors grille de 4 px : %s" % bad, file=sys.stderr)
        return 1
    bps = ",\n".join('      %s: "%dpx"' % (k, v) for k, v in t["layout"]["breakpoints"].items())
    ts = """// Généré par build_tokens.py depuis tokens.json. Ne pas modifier à la main.
// Utilisé par tailwind.config.ts ; les variables sont dans src/styles/tokens.css.
import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: ["variant", ["@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }", "&:is([data-theme=dark] *)"]],
  theme: {
    screens: {
%s
    },
    extend: {
      colors: {
%s
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
%s
      },
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)", pill: "var(--radius-pill)" },
      boxShadow: { card: "var(--shadow-card)", pop: "var(--shadow-pop)", focus: "var(--shadow-focus)" },
      transitionDuration: { fast: "120ms", base: "200ms", slow: "320ms" },
      transitionTimingFunction: { brand: "%s" },
      maxWidth: { content: "var(--layout-content-max)", reading: "var(--layout-reading-max)" },
      // Noms (pas de chiffres) : ne masquent pas l'échelle p-4, h-10… de Tailwind.
      spacing: { sidebar: "var(--layout-sidebar)", topbar: "var(--layout-topbar)" },
    },
  },
} satisfies Partial<Config>;
""" % (bps, colors, sizes, t["motion"]["ease"])
    with open(PRESET_OUT, "w", encoding="utf-8") as fh:
        fh.write(ts)
    print("build_tokens : tokens.css et tailwind.preset.ts écrits (%d couleurs, mode sombre inclus)" % len(light))
    return 0


if __name__ == "__main__":
    sys.exit(main())
