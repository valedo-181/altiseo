"use client";
import { useEffect, useRef } from "react";

/**
 * Fond de l'accueil : l'image du sommet, puis la vidéo en boucle par-dessus (muette).
 * Avec « réduire les animations », la vidéo n'est pas lancée : l'image reste.
 * En défilant, le fond recule légèrement et s'estompe (suit le doigt, rien d'automatique).
 */
export function HeroVideo() {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const w = wrap.current, v = video.current;
    if (!w || !v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.play().catch(() => undefined);
    let raf = 0;
    const paint = () => {
      raf = 0;
      const p = Math.min(1, window.scrollY / window.innerHeight);
      w.style.transform = `scale(${(1 + p * 0.12).toFixed(4)}) translate3d(0, ${(p * 40).toFixed(1)}px, 0)`;
      w.style.opacity = String(1 - p * 0.75);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0 will-change-transform" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/sommet.jpg" alt="" className="absolute inset-0 size-full object-cover object-[70%_center]" />
      <video ref={video} muted loop playsInline preload="metadata" poster="/brand/sommet.jpg" className="absolute inset-0 size-full object-cover object-[70%_center]">
        <source src="/brand/sommet.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
