"use client";
import { Printer } from "lucide-react";

/** « Télécharger en PDF » : la fenêtre d'impression du navigateur, avec « Enregistrer en PDF ». */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm print:hidden">
      <Printer aria-hidden="true" className="size-4" />Télécharger en PDF
    </button>
  );
}
