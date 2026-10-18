// Same fonts as Supabase: Inter (text), Manrope (headings), Source Code Pro (code)
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/source-code-pro";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
