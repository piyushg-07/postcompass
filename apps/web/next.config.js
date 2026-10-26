/** @type {import('next').NextConfig} */
const nextConfig = {
  // The one-line installers (public/install.sh, public/install.ps1) are read by curl and PowerShell,
  // so serve them as text: shown in the browser, never downloaded as an unknown binary
  headers() {
    const asText = [{ key: "Content-Type", value: "text/plain; charset=utf-8" }];
    return [
      { source: "/install.sh", headers: asText },
      { source: "/install.ps1", headers: asText },
    ];
  },
};

export default nextConfig;
