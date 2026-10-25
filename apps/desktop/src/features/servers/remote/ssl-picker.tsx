import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { SslMode } from "../../../lib/bindings";

const SSL_OPTIONS: { value: SslMode; label: string; short: string; description: string; color: string }[] = [
  {
    value: "disable",
    label: "Off",
    short: "Not encrypted",
    description: "No encryption. Only for databases on this computer or a private network you trust.",
    color: "text-fg-muted",
  },
  {
    value: "prefer",
    label: "Prefer",
    short: "Encrypted if supported",
    description: "Encrypts when the server supports it, otherwise connects without encryption.",
    color: "text-amber-500",
  },
  {
    value: "require",
    label: "Require",
    short: "Encrypted",
    description: "Always encrypted. Recommended for cloud databases; the server's certificate isn't checked.",
    color: "text-blue-500",
  },
  {
    value: "verify_full",
    label: "Verify certificate",
    short: "Encrypted + verified",
    description: "Always encrypted, and checks the server really is who it claims to be. Most secure.",
    color: "text-success",
  },
];

// ── SSL icon ──────────────────────────────────────────────────────────────────

function SslIcon({ value, className }: { value: SslMode; className?: string }) {
  if (value === "disable")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    );
  if (value === "prefer")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="8" cy="10" r="1" fill="currentColor" opacity="0.4"/>
      </svg>
    );
  if (value === "require")
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="8" cy="10" r="1" fill="currentColor"/>
      </svg>
    );
  // verify_full
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10 7V5a2 2 0 0 0-4 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6.5 10.2l1 1L9.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── SSL picker ────────────────────────────────────────────────────────────────

export function SslPicker({
  value,
  onChange,
}: {
  value: SslMode;
  onChange: (v: SslMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = SSL_OPTIONS.find((o) => o.value === value) ?? SSL_OPTIONS[2];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-control border border-border-strong bg-bg px-2.5 text-sm text-fg transition-colors hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <SslIcon value={value} className={`size-3.5 shrink-0 ${selected.color}`} />
          <span className="flex-1 truncate text-left">{selected.label}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1.5" align="start">
        {SSL_OPTIONS.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-accent/10 text-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <SslIcon value={opt.value} className={`mt-0.5 size-4 shrink-0 ${isSelected ? opt.color : "text-fg-subtle"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">{opt.label}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-accent" strokeWidth={2.5} />}
                </div>
                <p className="mt-0.5 text-xs text-fg-subtle leading-snug">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
