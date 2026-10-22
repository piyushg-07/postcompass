/**
 * Brand logos for cloud PostgreSQL providers.
 *
 * Files in `src/assets/providers/`, downloaded from the Iconify "logos" set (svg-logos, CC0), which
 * keeps each brand's official colours. Railway and Render come from Simple Icons (CC0), recoloured
 * light because their marks are black. Rendered as <img> so gradient ids in different logos can't
 * clash.
 */
import aws from "../../assets/providers/aws.svg";
import azure from "../../assets/providers/azure.svg";
import cloudflare from "../../assets/providers/cloudflare.svg";
import gcp from "../../assets/providers/gcp.svg";
import neon from "../../assets/providers/neon.svg";
import postgresql from "../../assets/providers/postgresql.svg";
import railway from "../../assets/providers/railway.svg";
import render from "../../assets/providers/render.svg";
import supabase from "../../assets/providers/supabase.svg";

export const PROVIDER_LOGOS: Record<string, { label: string; src: string }> = {
  aws: { label: "AWS RDS", src: aws },
  gcp: { label: "Cloud SQL", src: gcp },
  azure: { label: "Azure", src: azure },
  cloudflare: { label: "Hyperdrive", src: cloudflare },
  supabase: { label: "Supabase", src: supabase },
  neon: { label: "Neon", src: neon },
  railway: { label: "Railway", src: railway },
  render: { label: "Render", src: render },
  other: { label: "PostgreSQL", src: postgresql },
};

export function ProviderLogo({
  provider,
  className = "size-5",
}: {
  provider: string;
  className?: string;
}) {
  const meta = PROVIDER_LOGOS[provider] ?? PROVIDER_LOGOS.other!;
  return (
    <img
      src={meta.src}
      alt={meta.label}
      draggable={false}
      className={`object-contain ${className}`}
    />
  );
}
