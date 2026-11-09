import { useId } from "react";
import { cx } from "@/lib/cx";

type FieldShellProps = { label: string; help?: string; error?: string; id: string; children: React.ReactNode; aside?: React.ReactNode };

function FieldShell({ label, help, error, id, children, aside }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children}
      <div className="flex justify-between gap-4">
        {error ? (
          <p id={`${id}-msg`} className="text-xs text-danger">{error}</p>
        ) : help ? (
          <p id={`${id}-msg`} className="text-xs text-text-muted">{help}</p>
        ) : <span />}
        {aside}
      </div>
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { label: string; help?: string; error?: string; large?: boolean };

export function TextField({ label, help, error, large, className, id, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} help={help} error={error} id={fid}>
      <input
        id={fid}
        className={cx("field", large && "field-lg", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={help || error ? `${fid}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

/** Adresse d'un site : « https:// » affiché devant, non modifiable. */
export function UrlField({ label, help, error, large, id, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} help={help} error={error} id={fid}>
      <div className={cx("field flex items-stretch overflow-hidden p-0", large && "field-lg")}>
        <span className="flex items-center border-r border-border bg-surface px-3 text-sm text-text-muted" aria-hidden="true">https://</span>
        <input
          id={fid}
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-3 outline-none"
          aria-invalid={error ? true : undefined}
          aria-describedby={help || error ? `${fid}-msg` : undefined}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string; error?: string; maxLength: number; value: string };

/** Zone de texte avec compteur : orange à 90 %, rouge au-delà (l'envoi est bloqué par le formulaire). */
export function TextAreaCounter({ label, help, error, maxLength, value, id, className, ...rest }: AreaProps) {
  const auto = useId();
  const fid = id ?? auto;
  const n = [...value].length;
  const tone = n > maxLength ? "text-danger" : n >= maxLength * 0.9 ? "text-warning" : "text-text-muted";
  const near = n >= maxLength * 0.9;
  return (
    <FieldShell
      label={label}
      help={help}
      error={error ?? (n > maxLength ? `${n - maxLength} caractères de trop` : undefined)}
      id={fid}
      aside={<p className={cx("text-xs tabular-nums", tone)} aria-live={near ? "polite" : "off"}>{n} / {maxLength}</p>}
    >
      <textarea
        id={fid}
        value={value}
        className={cx("field", className)}
        aria-invalid={n > maxLength || error ? true : undefined}
        aria-describedby={`${fid}-msg`}
        {...rest}
      />
    </FieldShell>
  );
}
