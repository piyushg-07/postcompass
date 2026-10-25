import { type CoreError, commands } from "./bindings";

type Result<T> = { status: "ok"; data: T } | { status: "error"; error: CoreError };

/** Thrown when a Rust command returns an error. Carries the stable `code` for the UI to branch on. */
export class IpcError extends Error {
  readonly code: CoreError["code"];

  constructor(error: CoreError) {
    super(error.message);
    this.name = "IpcError";
    this.code = error.code;
  }
}

/**
 * Tauri rejects with a bare string (not a `CoreError`) when a command can't run at all, e.g. its
 * arguments failed to deserialize. Without this the error would have no message and no code.
 */
function toCoreError(error: unknown): CoreError {
  if (typeof error === "object" && error !== null && "code" in error && "message" in error)
    return error as CoreError;
  return { code: "internal", message: typeof error === "string" ? error : String(error) };
}

/** Turns a tauri-specta `Result` into a plain value, throwing `IpcError` on failure. */
export async function unwrap<T>(result: Promise<Result<T>>): Promise<T> {
  const res = await result;
  if (res.status === "error") throw new IpcError(toCoreError(res.error));
  return res.data;
}

export function isCancelled(error: unknown) {
  return error instanceof IpcError && error.code === "cancelled";
}

/** A short title and an optional hint for showing an error to the user. */
export function describeError(error: unknown): { title: string; message: string; hint?: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof IpcError)) return { title: "Something went wrong", message };

  switch (error.code) {
    case "port_in_use":
      return { title: "Port already in use", message, hint: "Pick another port and try again." };
    case "network":
      return {
        title: "Download failed",
        message,
        hint: "Check your internet connection. The download resumes where it stopped.",
      };
    case "checksum_mismatch":
      return {
        title: "Download was corrupted",
        message,
        hint: "The file was deleted. Try again to download a fresh copy.",
      };
    case "insufficient_disk_space":
      return { title: "Not enough disk space", message, hint: "Free up at least 1 GB and try again." };
    case "auth_failed":
      return { title: "Password rejected", message, hint: "The saved password no longer matches the server." };
    case "connection_failed":
      return { title: "Couldn't connect", message, hint: "Check that the database is running." };
    case "query_failed":
      return { title: "The server returned an error", message };
    case "secrets":
      return { title: "Couldn't access the system keychain", message };
    case "unsupported":
      return { title: "Not supported on this computer", message };
    case "process_failed":
      return {
        title: "PostgreSQL reported an error",
        message,
        // Windows: the binaries need the Visual C++ runtime (STATUS_DLL_NOT_FOUND)
        hint: /0xc0000135/i.test(message)
          ? "Install the Microsoft Visual C++ Redistributable (x64), then try again."
          : undefined,
      };
    default:
      return { title: "Something went wrong", message };
  }
}

export { commands };
