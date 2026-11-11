"use client";
import { ImageIcon } from "lucide-react";
import { createArticleImage, removeArticleImage } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";

type Props = { id: string; url: string | null; alt: string; demo: boolean; left: number };

/** Image d'illustration de l'article : aperçu, « Changer l'image » (nombre d'essais limité) et « Retirer ». */
export function ArticleImage({ id, url, alt, demo, left }: Props) {
  return (
    <section aria-labelledby="h-image" className="card">
      <div className="flex flex-wrap items-start gap-4">
        <div className="aspect-video w-full max-w-sm shrink-0 overflow-hidden rounded-md bg-surface-sunken">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-text-muted"><ImageIcon aria-hidden="true" className="size-8" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 id="h-image" className="font-semibold">Image de l'article</h2>
            <p className="mt-1 text-sm text-text-muted">
              {!url ? "Cet article n'a pas d'image." : demo ? "Image d'exemple : la création d'images n'est pas encore branchée. Elle ne sera pas envoyée sur votre site." : "Photo créée pour cet article. Elle part avec lui comme image mise en avant dans WordPress."}
            </p>
            {url && !demo && <p className="mt-1 text-xs text-text-muted">Description pour Google et les lecteurs d'écran : « {alt} »</p>}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {left > 0 ? (
              <ActionForm action={createArticleImage}>
                <input type="hidden" name="id" value={id} />
                <Submit variant="secondary">{url ? "Changer l'image" : "Créer une image"}</Submit>
              </ActionForm>
            ) : (
              <p className="text-xs text-text-muted">Nombre maximal d'images atteint pour cet article.</p>
            )}
            {url && (
              <form action={removeArticleImage}>
                <input type="hidden" name="id" value={id} />
                <button className="btn btn-ghost">Retirer l'image</button>
              </form>
            )}
          </div>
          {left > 0 && left < 5 && <p className="text-xs text-text-muted">Encore {left} essai{left > 1 ? "s" : ""} pour cet article. La création prend jusqu'à une minute.</p>}
        </div>
      </div>
    </section>
  );
}
