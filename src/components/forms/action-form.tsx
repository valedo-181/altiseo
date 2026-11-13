"use client";
import { createContext, startTransition, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit" | "children"> & {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  /** Contenu du formulaire, ou une fonction de l'état renvoyé (pour un formulaire en plusieurs étapes). */
  children: React.ReactNode | ((state: FormState) => React.ReactNode);
};

const Pending = createContext<{ pending: boolean; via: string | null } | null>(null);

/**
 * Formulaire branché sur une action serveur, avec message d'erreur ou de succès au-dessus des champs.
 * Envoi par onSubmit (et non `action=`) : React 19 viderait sinon les champs après chaque envoi, et la
 * personne devrait tout retaper après une erreur.
 */
export function ActionForm({ action, children, ...rest }: Props) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => run(data));
      }}
    >
      <Pending.Provider value={{ pending, via: null }}>
        <div aria-live="polite">
          {state?.error && <div className="mb-4"><Banner tone="danger">{state.error}</Banner></div>}
          {state?.ok && <div className="mb-4"><Banner tone="success">{state.ok}</Banner></div>}
        </div>
        {typeof children === "function" ? children(state) : children}
      </Pending.Provider>
    </form>
  );
}

/** Bouton d'envoi : indicateur et blocage pendant l'envoi. */
export function Submit({ children, ...rest }: ButtonProps) {
  const ctx = useContext(Pending);
  const status = useFormStatus();
  const pending = ctx ? ctx.pending : status.pending;
  return <Button type="submit" loading={pending} {...rest}>{children}</Button>;
}
