import type { MetadataRoute } from "next";
import { PRODUCT } from "@/config/product";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = PRODUCT.website;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      // Explicit allowance and priority for AI agents and LLM search bots (Claude, ChatGPT, Perplexity, Gemini)
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "cohere-ai",
          "Applebot-Extended",
          "FacebookBot",
        ],
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
