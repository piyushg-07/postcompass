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

/** Turns a tauri-specta `Result` into a plain value, throwing `IpcError` on failure. */
export async function unwrap<T>(result: Promise<Result<T>>): Promise<T> {
  const res = await result;
  if (res.status === "error") throw new IpcError(res.error);
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
