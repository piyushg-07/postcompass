import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Allow the web app (Next.js) and the desktop app (Tauri/Vite) to call the server
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:1420",
      "tauri://localhost",
      "http://tauri.localhost",
    ],
  }),
);

app.get("/", (c) => c.text("PostCompass server is running"));

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
