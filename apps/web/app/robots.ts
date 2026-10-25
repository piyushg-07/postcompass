import type { MetadataRoute } from "next";
import { PRODUCT } from "@/config/product";

/** Search engines and AI assistants' crawlers, named so it's explicit they're welcome. */
const AI_CRAWLERS = [
  // OpenAI: ChatGPT search, user-triggered browsing, training
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  // Anthropic: Claude search, user-triggered fetches, training
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google Gemini and AI Overviews, Apple Intelligence
  "Google-Extended",
  "Applebot-Extended",
  // Others
  "Amazonbot",
  "DuckAssistBot",
  "cohere-ai",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_CRAWLERS, allow: "/" },
    ],
    sitemap: `${PRODUCT.website}/sitemap.xml`,
  };
}
