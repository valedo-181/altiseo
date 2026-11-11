import Link from "next/link";
import { Logo } from "@/components/brand/logo";

type Props = { title: string; lead: React.ReactNode; children: React.ReactNode; footer: React.ReactNode; aside: { quote: string; points: string[] } };

/**
 * Cadre des pages de connexion et d'inscription : le formulaire à gauche, le sommet à droite
 * (masqué sur téléphone). Toujours sombre, comme l'accueil. Le logo puis le formulaire viennent en
 * premier dans l'ordre du clavier.
 */
export function AuthShell({ title, lead, children, footer, aside }: Props) {
  return (
    <div data-theme="dark" className="grid min-h-dvh bg-bg text-text lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <main className="relative flex flex-col px-6 py-8 sm:px-10">
        <div className="pricing-glow absolute inset-x-0 top-0 h-72 lg:hidden" aria-hidden="true" />
        <Link href="/" className="relative w-fit" aria-label="Altiseo, retour à l'accueil"><Logo size={30} /></Link>
        <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] leading-tight md:text-[34px]">{title}</h1>
          <p className="mt-3 text-text-muted">{lead}</p>
          <div className="plan plan-best mt-8">
            <div className="rounded-[15px] bg-surface p-6">{children}</div>
          </div>
          <div className="mt-6 text-sm text-text-muted">{footer}</div>
        </div>
        <p className="relative text-xs text-text-muted">© 2026 Altiseo, Suisse · <Link href="/tarifs" className="hover:text-text">Tarifs</Link> · <Link href="/services" className="hover:text-text">Services</Link></p>
      </main>

      <aside className="relative hidden overflow-hidden lg:block" aria-label="Altiseo en bref">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/sommet.jpg" alt="" className="absolute inset-0 size-full object-cover object-[72%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <p className="max-w-md font-display text-2xl font-medium leading-snug tracking-tight xl:text-[32px]">{aside.quote}</p>
          <ul className="mt-8 space-y-3">
            {aside.points.map((p, i) => (
              <li key={p} className="flex items-baseline gap-4 border-t border-text/15 pt-3">
                <span className="font-display text-sm font-medium text-highlight">0{i + 1}</span>
                <span className="text-text/90">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
