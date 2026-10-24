"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fades content up as it scrolls into view: every section header, any element with data-reveal, and each
 * child of a data-reveal="stagger" container (one after another). Content already on screen is left alone,
 * and once an element has revealed its classes are removed so its own hover transitions work normally.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>(".section-header, [data-reveal]").forEach((el) => {
      if (el.dataset.reveal === "stagger") {
        Array.from(el.children).forEach((child, i) => {
          if (child instanceof HTMLElement) {
            child.style.setProperty("--reveal-delay", `${Math.min(i, 8) * 0.07}s`);
            targets.push(child);
          }
        });
      } else {
        targets.push(el);
      }
    });

    const below = targets.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    below.forEach((el) => el.classList.add("reveal"));

    const finish = (e: TransitionEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (e.target !== el || e.propertyName !== "transform") return;
      el.classList.remove("reveal", "revealed");
      el.style.removeProperty("--reveal-delay");
      el.removeEventListener("transitionend", finish);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.addEventListener("transitionend", finish);
          el.classList.add("revealed");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    below.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      below.forEach((el) => {
        el.classList.remove("reveal", "revealed");
        el.style.removeProperty("--reveal-delay");
        el.removeEventListener("transitionend", finish);
      });
    };
  }, [pathname]);

  return null;
}
