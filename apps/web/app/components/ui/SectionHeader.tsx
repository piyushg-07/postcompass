import type { ReactNode } from "react";

interface Props {
  badge: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The page's main heading (e.g. the /download page) is an h1; sections on the home page are h2s */
  as?: "h1" | "h2";
}

/** The centred badge, title and description that open every section. */
export default function SectionHeader({ badge, title, description, as: Heading = "h2" }: Props) {
  return (
    // "section-header" has no styles; ScrollReveal uses it to find section headers
    <div className="section-header mx-auto mb-16 max-w-[720px] text-center max-md:mb-10">
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-accent bg-accent-muted px-3 py-1 text-xs font-semibold tracking-[0.05em] text-accent uppercase shadow-[0_0_16px_rgb(var(--accent-rgb)/0.15)]">
        {badge}
      </span>
      <Heading className="mb-4 font-display text-4xl leading-tight font-bold tracking-[-0.02em] text-fg max-lg:text-3xl max-md:text-2xl max-[480px]:text-xl">
        {title}
      </Heading>
      {description && <p className="text-lg leading-normal text-fg-secondary max-md:text-base">{description}</p>}
    </div>
  );
}
