// Généré par build_tokens.py depuis tokens.json. Ne pas modifier à la main.
// Utilisé par tailwind.config.ts ; les variables sont dans src/styles/tokens.css.
import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: ["variant", ["@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }", "&:is([data-theme=dark] *)"]],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px"
    },
    extend: {
      colors: {
        "bg": c("bg"),
        "surface": c("surface"),
        "surface-sunken": c("surface-sunken"),
        "border": c("border"),
        "border-input": c("border-input"),
        "text": c("text"),
        "text-muted": c("text-muted"),
        "accent": c("accent"),
        "accent-hover": c("accent-hover"),
        "accent-soft": c("accent-soft"),
        "on-accent": c("on-accent"),
        "focus": c("focus"),
        "danger": c("danger"),
        "danger-soft": c("danger-soft"),
        "warning": c("warning"),
        "warning-soft": c("warning-soft"),
        "success": c("success"),
        "success-soft": c("success-soft"),
        "info": c("info"),
        "info-soft": c("info-soft")
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "xs": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "base": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "lg": ["18px", { lineHeight: "28px", fontWeight: "600" }],
        "xl": ["24px", { lineHeight: "32px", fontWeight: "650" }],
        "2xl": ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "display": ["48px", { lineHeight: "56px", fontWeight: "750" }]
      },
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)", pill: "var(--radius-pill)" },
      boxShadow: { card: "var(--shadow-card)", pop: "var(--shadow-pop)", focus: "var(--shadow-focus)" },
      transitionDuration: { fast: "120ms", base: "200ms", slow: "320ms" },
      transitionTimingFunction: { brand: "cubic-bezier(.2,.8,.2,1)" },
      maxWidth: { content: "var(--layout-content-max)", reading: "var(--layout-reading-max)" },
      width: { sidebar: "var(--layout-sidebar)" },
      height: { topbar: "var(--layout-topbar)" },
    },
  },
} satisfies Partial<Config>;
