import { ArrowRight } from "@/components/ui/Icons";
import SectionHeader from "@/components/ui/SectionHeader";

/** The home page's short version of /compare: three differences, then a link to the full comparison. */
export default function WhySection() {
  const POINTS = [
    {
      value: "1 click",
      title: "PostgreSQL, running for you",
      them: "No installer. No Docker.",
    },
    {
      value: "EXPLAIN",
      title: "See why a query is slow",
      them: "The slowest step, highlighted.",
    },
    {
      value: "$0",
      title: "Every feature, free",
      them: "No paid tier. No account.",
    },
  ];

  return (
    <section className="relative py-24 max-lg:py-16 max-md:py-12" id="why">
      <div className="mx-auto w-full max-w-[1200px] px-6 max-md:px-4">
        <SectionHeader
          badge="Why PostCompass"
          title="Why developers switch"
          description="Other Postgres clients cost you setup time, memory or money. PostCompass doesn't."
        />
        <ul data-reveal="stagger" className="grid grid-cols-3 gap-5 max-[861px]:grid-cols-1">
          {POINTS.map((p) => (
            <li
              key={p.title}
              className="group/why relative overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-root bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-7 [transition:border-color_0.2s_ease] hover:border-[rgb(var(--accent-rgb)/0.3)]"
            >
              <span
                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.12),transparent_70%)] opacity-60 [transition:opacity_0.3s_ease] group-hover/why:opacity-100"
                aria-hidden="true"
              />
              <span className="block font-mono text-[2.4rem] leading-none font-bold tracking-[-0.04em] text-white">
                {p.value}
              </span>
              <h3 className="mt-4 text-[1.1rem] font-[650] tracking-[-0.015em] text-fg">{p.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-[1.6] text-fg-muted">{p.them}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <a
            href="/compare"
            className="group/link inline-flex h-11 items-center gap-2 rounded-[10px] border border-[rgba(255,255,255,0.12)] px-5 text-[0.9rem] font-medium text-fg-secondary [transition:border-color_0.15s_ease,color_0.15s_ease] hover:border-[rgb(var(--accent-rgb)/0.45)] hover:text-white"
          >
            Compare with pgAdmin, DBeaver, DataGrip and more
            <ArrowRight size={15} className="[transition:transform_0.15s_ease] group-hover/link:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
