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

export function connectionString(server: { superuser: string; host: string; port: number }, password: string) {
  return `postgresql://${server.superuser}:${encodeURIComponent(password)}@${server.host}:${server.port}/postgres`;
}

export function greeting(name?: string | null) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}
