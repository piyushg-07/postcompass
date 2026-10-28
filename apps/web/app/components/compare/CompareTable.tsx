import { Check, X } from "@/components/ui/Icons";
import { ROWS, TOOLS, type Cell } from "@/config/compare";

/** One cell: a check, a cross, a "partly" mark or plain text, each with an optional short note. */
function Value({ cell, ours }: { cell: Cell; ours: boolean }) {
  const note = cell.note && (
    <span className={`block text-[0.72rem] leading-snug ${ours ? "text-accent-light" : "text-fg-muted"}`}>{cell.note}</span>
  );
  switch (cell.v) {
    case "yes":
      return (
        <span className="flex flex-col items-center gap-1">
          <span
            className={`inline-flex size-6 items-center justify-center rounded-full ${ours ? "bg-accent text-accent-fg shadow-[0_0_14px_rgb(var(--accent-rgb)/0.45)]" : "bg-[rgba(255,255,255,0.08)] text-fg"}`}
          >
            <Check size={13} />
            <span className="sr-only">Yes</span>
          </span>
          {note}
        </span>
      );
    case "no":
      return (
        <span className="flex flex-col items-center gap-1">
          <span className="inline-flex size-6 items-center justify-center rounded-full text-fg-faint">
            <X size={13} />
            <span className="sr-only">No</span>
          </span>
          {note}
        </span>
      );
    case "partial":
      return (
        <span className="flex flex-col items-center gap-1">
          <span className="inline-flex h-6 items-center rounded-full border border-[rgba(245,181,68,0.35)] bg-[rgba(245,181,68,0.08)] px-2 text-[0.7rem] font-medium text-key-primary">
            Partly
          </span>
          {note}
        </span>
      );
    case "unknown":
      return (
        <span className="text-fg-faint" title="We couldn't confirm this on the tool's own site">
          —<span className="sr-only">Not confirmed</span>
        </span>
      );
    case "text":
      return <span className={`text-[0.82rem] leading-snug ${ours ? "font-semibold text-fg" : "text-fg-secondary"}`}>{cell.note}</span>;
  }
}

/**
 * Tools across, questions down. The question column stays put while the table scrolls sideways on
 * narrow screens, and the PostCompass column is lit so it reads as the one being compared.
 */
export default function CompareTable() {
  return (
    <div
      data-reveal
      className="relative overflow-x-auto rounded-[18px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.005))] [scrollbar-width:thin]"
    >
      <table className="w-full min-w-[920px] border-collapse text-center">
        <caption className="sr-only">PostCompass compared with other PostgreSQL desktop clients</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-[200px] bg-root px-5 py-5 text-left align-bottom">
              <span className="font-mono text-[0.72rem] font-normal tracking-[0.04em] text-fg-faint uppercase">Feature</span>
            </th>
            {TOOLS.map((t) => {
              const ours = t.id === "postcompass";
              return (
                <th
                  key={t.id}
                  scope="col"
                  className={`px-3 py-5 align-top ${ours ? "relative bg-[rgb(var(--accent-rgb)/0.07)]" : ""}`}
                >
                  {ours && (
                    <span className="absolute top-0 right-0 left-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--color-accent-light),transparent)]" />
                  )}
                  <span
                    className={`mx-auto mb-2.5 flex size-10 items-center justify-center rounded-[10px] border ${ours ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.1)] shadow-[0_0_18px_rgb(var(--accent-rgb)/0.25)]" : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)]"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.logo} alt="" width={26} height={26} className="size-[26px] rounded-[6px] object-contain" loading="lazy" />
                  </span>
                  <span className={`block text-[0.9rem] font-semibold tracking-[-0.01em] whitespace-nowrap ${ours ? "text-white" : "text-fg-secondary"}`}>
                    {t.name}
                  </span>
                  <span className="mt-1 block font-mono text-[0.66rem] font-normal text-fg-faint">{t.runtime}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="group/row border-t border-[rgba(255,255,255,0.05)]">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-root px-5 py-4 text-left font-normal [transition:background_0.15s_ease] group-hover/row:bg-[#0e0e11]"
              >
                <span className="block text-[0.9rem] font-medium text-fg">{row.label}</span>
                {row.hint && <span className="mt-0.5 block text-[0.72rem] leading-snug text-fg-muted">{row.hint}</span>}
              </th>
              {TOOLS.map((t) => {
                const ours = t.id === "postcompass";
                return (
                  <td
                    key={t.id}
                    className={`px-3 py-4 align-middle [transition:background_0.15s_ease] ${ours ? "bg-[rgb(var(--accent-rgb)/0.07)]" : "group-hover/row:bg-[rgba(255,255,255,0.015)]"}`}
                  >
                    <Value cell={row.cells[t.id]} ours={ours} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
