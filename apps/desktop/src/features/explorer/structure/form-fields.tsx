import { Input } from "@repo/ui";
import { z } from "zod";
import { COMMON_TYPES, isSafeTypeName } from "../../../lib/sql";

export const identifierSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(63, "PostgreSQL names are at most 63 characters");

export const typeSchema = z.string().trim().min(1, "Required").refine(isSafeTypeName, "Not a valid type name");

/** First validation error of a TanStack Form field, as text. */
export function fieldError(errors: unknown[]): string | undefined {
  const first = errors.find(Boolean);
  if (!first) return undefined;
  if (typeof first === "string") return first;
  if (typeof first === "object" && first && "message" in first) return String((first as { message: unknown }).message);
  return String(first);
}

/** Free-text type input with suggestions for common types. */
export function TypeInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <>
      <Input
        id={id}
        list="pg-common-types"
        className={className ?? "font-mono"}
        value={value}
        placeholder="text"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <datalist id="pg-common-types">
        {COMMON_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}
