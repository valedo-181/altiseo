"use client";
import { useEffect, useRef } from "react";

/** Éclaire chaque bloc « .scene » quand il arrive à l'écran (mêmes effets que la page Services). */
export function RevealScope({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add("is-in");
    }, { threshold: 0.2 });
    el.querySelectorAll(".scene").forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`film ${className ?? ""}`}>{children}</div>;
}
