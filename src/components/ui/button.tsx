import { Loader2 } from "lucide-react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Affiche l'indicateur, garde le libellé pour les lecteurs d'écran et bloque le clic. */
  loading?: boolean;
  /** Bouton carré sans texte : aria-label obligatoire. */
  iconOnly?: boolean;
};

// Noms complets (pas de `btn-${variant}`) : Tailwind ne garde que les classes écrites en entier.
const VARIANT: Record<Variant, string> = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost", danger: "btn-danger" };
const SIZE: Record<Size, string> = { xs: "btn-xs", sm: "btn-sm", md: "", lg: "btn-lg" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", iconOnly = false): string {
  return cx("btn", VARIANT[variant], SIZE[size], iconOnly && "btn-icon");
}

export function Button({ variant = "primary", size = "md", loading, iconOnly, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass(variant, size, iconOnly), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
