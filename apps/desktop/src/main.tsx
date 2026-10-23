// Same fonts as Supabase: Inter (text), Manrope (headings), Source Code Pro (code); Space Grotesk + Instrument Serif italic for the wordmark
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/source-code-pro";
import "@fontsource-variable/space-grotesk";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// No browser menu (Back, Reload, Inspect…) on right click; our own menus open where they make sense.
// Text fields and editors keep the native one for cut / copy / paste.
document.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable='true']")) return;
  event.preventDefault();
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
