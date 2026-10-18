/** 1536 → "1.5 KB" */
export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** 12345 → "12.3K", for row estimates */
export function formatCount(count: number | null | undefined) {
  if (count === null || count === undefined) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function formatMb(bytes: number) {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Random password using only URL-safe characters, so it works unescaped in connection strings. */
export function generatePassword(length = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  // 256 % 57 bias is negligible for a 24-char password
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** `password: null` gives a display version with the password masked. */
export function connectionString(server: { superuser: string; host: string; port: number }, password: string | null) {
  const secret = password === null ? "••••••••" : encodeURIComponent(password);
  return `postgresql://${server.superuser}:${secret}@${server.host}:${server.port}/postgres`;
}

export function greeting(name?: string | null) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}
