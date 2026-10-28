import type { MetadataRoute } from "next";
import { PRODUCT } from "@/config/product";
import { GUIDES } from "@/config/guides";

// Real pages only: search engines ignore #anchors, so the home page's sections aren't listed separately
export default function sitemap(): MetadataRoute.Sitemap {
  const base = PRODUCT.website;
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/download`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
