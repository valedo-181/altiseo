"use client";
import { connectSearchDemo, refreshSearch } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

export function RefreshSearch() {
  return <ActionForm action={refreshSearch}><Submit variant="secondary">Actualiser</Submit></ActionForm>;
}

export function ConnectDemo() {
  return <ActionForm action={connectSearchDemo}><Submit>Voir avec des chiffres d'exemple</Submit></ActionForm>;
}
