"use client";
import { approveAllTopics, rebuildCalendar } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

export function CalendarActions({ empty }: { empty: boolean }) {
  if (empty) {
    return <ActionForm action={rebuildCalendar}><Submit>Préparer mes 30 sujets</Submit></ActionForm>;
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm action={rebuildCalendar}><Submit variant="secondary">Nouvelles propositions</Submit></ActionForm>
      <ActionForm action={approveAllTopics}><Submit>Tout approuver</Submit></ActionForm>
    </div>
  );
}
