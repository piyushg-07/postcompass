import { FAQ_ITEMS } from "../config/product";
import { ChevronDown } from "./Icons";
import SectionHeader from "./SectionHeader";

export default function FaqSection() {
  return (
    <section className="relative py-24 max-lg:py-16 max-md:py-12" id="faq">
      <div className="mx-auto w-full max-w-[820px] px-6 max-md:px-4">
        <SectionHeader badge="FAQ" title="Questions, answered" />

        <div className="flex flex-col border-t border-[rgba(255,255,255,0.07)]" data-reveal="stagger">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group border-b border-[rgba(255,255,255,0.07)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-[1.2rem] text-[1rem] font-semibold text-fg hover:text-white focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-hover [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 text-fg-muted [transition:transform_0.2s_ease] group-open:[transform:rotate(180deg)] group-open:text-accent-hover"
                />
              </summary>
              <p className="m-0 pt-0 pr-10 pb-[1.3rem] pl-1 text-[0.95rem] leading-[1.7] text-fg-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
