import type { MetadataRoute } from "next";
import { PRODUCT } from "@/config/product";
import { SEO_CONFIG } from "@/config/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PRODUCT.name} — PostgreSQL Desktop App`,
    short_name: PRODUCT.name,
    description: SEO_CONFIG.description,
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icon.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
