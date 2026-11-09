import type { Site } from "@/lib/domain/types";

const DAYS = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [7, "Dim"]] as const;
const ZONES = ["Europe/Zurich", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Vienna", "Europe/Brussels", "Europe/London", "America/Montreal", "America/New_York"];

/** Planning de publication : heure, fuseau, jours, brouillon ou publication directe (S09, S20). */
export function ScheduleFields({ site }: { site: Site }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="publishTime" className="block text-sm font-semibold">Heure de publication</label>
          <input id="publishTime" name="publishTime" type="time" defaultValue={site.publishTime} required className="field" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="timezone" className="block text-sm font-semibold">Fuseau horaire</label>
          <select id="timezone" name="timezone" defaultValue={site.timezone} className="field">
            {(ZONES.includes(site.timezone) ? ZONES : [site.timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Jours de publication</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map(([n, label]) => (
            <label key={n} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-input px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:shadow-focus">
              <input type="checkbox" name="days" value={n} defaultChecked={site.publishDays.includes(n)} className="accent-[rgb(var(--c-accent))]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Quand l'article est prêt</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ["draft", "L'envoyer en brouillon", "Vous le relisez et le publiez vous-même. Recommandé."],
            ["publish", "Le publier directement", "Il paraît sur votre site à l'heure choisie."],
          ].map(([v, title, help]) => (
            <label key={v} className="card flex cursor-pointer gap-3 has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:shadow-focus">
              <input type="radio" name="publishMode" value={v} defaultChecked={site.publishMode === v} className="mt-1 accent-[rgb(var(--c-accent))]" />
              <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-text-muted">{help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
