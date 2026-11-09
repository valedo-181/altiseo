"use client";
import { useId } from "react";
import { cx } from "@/lib/cx";

type Props = { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean };

export function Switch({ label, help, checked, onChange, disabled }: Props) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={help ? `${id}-h` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 rounded-pill border transition-colors duration-fast disabled:opacity-50",
          checked ? "border-accent bg-accent" : "border-border-input bg-surface-sunken",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute left-0.5 top-0.5 size-[18px] rounded-full bg-bg shadow-card transition-transform duration-fast",
            checked && "translate-x-4",
          )}
        />
      </button>
      <div>
        <p id={`${id}-l`} className="cursor-pointer text-sm font-semibold" onClick={() => !disabled && onChange(!checked)}>{label}</p>
        {help && <p id={`${id}-h`} className="text-xs text-text-muted">{help}</p>}
      </div>
    </div>
  );
}
