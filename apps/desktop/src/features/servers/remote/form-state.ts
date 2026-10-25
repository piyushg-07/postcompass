import type { RemoteDraft } from "../../../app/navigation";
import type {
  RemoteConnection,
  RemoteConnectionRequest,
  SslMode,
} from "../../../lib/bindings";
import { OTHER_PROVIDER, type Provider, PROVIDERS, providerById } from "./providers";

export interface FormState {
  name: string;
  provider: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslMode: SslMode;
  caCert: string;
}

export function empty(provider: Provider = PROVIDERS[0]!): FormState {
  return {
    name: "",
    provider: provider.id,
    host: "",
    port: String(provider.defaultPort ?? 5432),
    user: "postgres",
    password: "",
    database: "postgres",
    sslMode: provider.defaultSsl,
    caCert: "",
  };
}

export function fromExisting(rc: RemoteConnection): FormState {
  return {
    name: rc.name,
    provider: rc.provider,
    host: rc.host,
    port: String(rc.port),
    user: rc.user,
    password: "",
    database: rc.database,
    sslMode: rc.sslMode,
    caCert: rc.caCert ?? "",
  };
}

/** A server found on this computer: self-hosted, with its name, host and port filled in. */
export function fromDraft(draft: RemoteDraft): FormState {
  return { ...empty(OTHER_PROVIDER), ...draft, port: String(draft.port) };
}

/** An empty port means the default; anything else must be a real TCP port. */
export function isValidPort(port: string) {
  if (!port.trim()) return true;
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

export function toRequest(form: FormState): RemoteConnectionRequest {
  return {
    name: form.name.trim() || `${providerById(form.provider).label} connection`,
    host: form.host.trim(),
    port: parseInt(form.port, 10) || 5432,
    user: form.user.trim(),
    password: form.password,
    database: form.database.trim(),
    sslMode: form.sslMode,
    caCert: form.sslMode === "verify_full" ? form.caCert.trim() || null : null,
    provider: form.provider,
  };
}
