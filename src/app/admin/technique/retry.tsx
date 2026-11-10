"use client";
import { retryItem } from "@/app/admin/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

export function Retry({ kind, id }: { kind: string; id: string }) {
  return (
    <ActionForm action={retryItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Submit variant="secondary" size="sm">Relancer</Submit>
    </ActionForm>
  );
}
