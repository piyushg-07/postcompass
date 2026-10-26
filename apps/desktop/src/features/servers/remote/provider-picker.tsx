import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { ProviderLogo } from "../provider-logos";
import { PROVIDERS, providerById } from "./providers";

export function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = providerById(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2.5 rounded-control border border-border-strong bg-bg px-2.5 text-sm text-fg transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <span className="flex shrink-0 items-center">
            <ProviderLogo provider={selected.id} className="size-4" />
          </span>
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-3" align="start">
        <p className="mb-2.5 px-0.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
          Select a provider
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PROVIDERS.map((p) => {
            const isSelected = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`group relative flex flex-col items-start gap-2 rounded-control border px-3 py-2.5 text-left transition-all ${
                  isSelected
                    ? "border-accent bg-accent/8 text-fg"
                    : "border-border bg-bg text-fg-muted hover:border-border-strong hover:bg-surface-hover hover:text-fg"
                }`}
              >
                {/* Check mark */}
                {isSelected && (
                  <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
                <span className="flex items-center justify-center">
                  <ProviderLogo provider={p.id} className="size-5" />
                </span>
                <span className="text-xs font-medium leading-tight">{p.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
