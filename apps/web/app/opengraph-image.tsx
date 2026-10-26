import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ACCENT } from "@/config/theme";

// The preview shown when a PostCompass link is shared (Slack, X, LinkedIn, Discord…), built at build time
export const alt = "PostCompass: free PostgreSQL GUI for Windows, macOS and Linux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo.png"))).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: `radial-gradient(circle at 80% 20%, rgba(${ACCENT.rgb},0.22), transparent 55%), #09090b`,
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={112} height={112} alt="" style={{ borderRadius: 24 }} />
          <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -3 }}>
            Post<span style={{ color: ACCENT.light }}>Compass</span>
          </div>
        </div>
        <div style={{ marginTop: 44, fontSize: 44, fontWeight: 600, lineHeight: 1.25, maxWidth: 960 }}>
          The free, open-source PostgreSQL GUI
        </div>
        <div style={{ marginTop: 20, fontSize: 30, color: "#a1a1aa", lineHeight: 1.4, maxWidth: 980 }}>
          Run PostgreSQL locally in one click. Connect to any cloud. Windows, macOS and Linux.
        </div>
      </div>
    ),
    size,
  );
}
