import type { Config } from "tailwindcss";
import preset from "./tailwind.preset";

/** Toutes les couleurs, tailles et rayons viennent des jetons (replica/design/tokens.json → npm run tokens). */
export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;
