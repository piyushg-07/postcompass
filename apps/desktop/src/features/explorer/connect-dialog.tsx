import { Button, cn, Dialog, DialogContent, IconButton, toast } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Plug } from "lucide-react";
import { useState } from "react";
import type { ManagedServer } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";

type Format = "uri" | "psql" | "env" | "jdbc";

const FORMATS: { id: Format; label: string }[] = [
  { id: "uri", label: "URI" },
  { id: "psql", label: "psql" },
  { id: "env", label: ".env" },
  { id: "jdbc", label: "JDBC" },
];

const MASK = "••••••••";

function formatString(
  format: Format,
  server: ManagedServer,
  database: string,
  password: string,
) {
  const host = server.host;
  const port = server.port;
  const user = server.superuser;
  const db = encodeURIComponent(database);
  const pw = password === MASK ? MASK : encodeURIComponent(password);
  switch (format) {
    case "uri":
      return `postgresql://${user}:${pw}@${host}:${port}/${db}`;
    case "psql":
      return `psql "postgresql://${user}:${pw}@${host}:${port}/${db}"`;
    case "env":
      return `DATABASE_URL=postgresql://${user}:${pw}@${host}:${port}/${db}`;
    case "jdbc":
      return `jdbc:postgresql://${host}:${port}/${db}?user=${user}&password=${pw}`;
  }
}

/** "Connect" button + dialog: how to reach the database that is currently selected in the explorer. */
export function ConnectButton({
  server,
  database,
}: {
  server: ManagedServer;
  database: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconLeft={<Plug />}
        onClick={() => setOpen(true)}
      >
        Connect
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <ConnectDialogBody server={server} database={database} />}
      </Dialog>
    </>
  );
}

function ConnectDialogBody({
  server,
  database,
}: {
  server: ManagedServer;
  database: string;
}) {
  const [format, setFormat] = useState<Format>("uri");
  const [reveal, setReveal] = useState(false);
  // The password is read from the OS keychain only while this dialog is open
  const password = useQuery({
    queryKey: ["server-password", server.id],
    queryFn: () => unwrap(commands.serverPassword(server.id)),
    staleTime: 0,
    gcTime: 0,
  });

  const secret = password.data ?? "";
  const shown = formatString(
    format,
    server,
    database,
    reveal && secret ? secret : MASK,
  );

  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`));

  const copyString = () => {
    if (!secret) {
      toast.error("Couldn't read the password", {
        description: password.error
          ? describeError(password.error).message
          : undefined,
      });
      return;
    }
    copy(formatString(format, server, database, secret), "Connection string");
  };

  return (
    <DialogContent
      title={`Connect to ${database}`}
      description={`Use these details in your app or any PostgreSQL tool. Database "${database}" on ${server.name}.`}
      className="w-[600px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "h-7 cursor-pointer rounded-control px-2.5 text-xs transition-colors",
                format === f.id
                  ? "bg-surface-hover text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-control border border-border-strong bg-bg py-1 pr-1 pl-3">
          <code
            className="min-w-0 flex-1 truncate font-mono text-xs text-fg select-text"
            title={shown}
          >
            {shown}
          </code>
          <IconButton
            size="sm"
            label={reveal ? "Hide password" : "Show password"}
            icon={reveal ? <EyeOff /> : <Eye />}
            onClick={() => setReveal((r) => !r)}
          />
          <IconButton
            size="sm"
            label="Copy"
            icon={<Copy />}
            onClick={copyString}
          />
        </div>
      </div>

      <dl className="grid grid-cols-[110px_1fr] overflow-hidden rounded-card border border-border">
        <Field label="Host" value={server.host} onCopy={copy} />
        <Field label="Port" value={String(server.port)} onCopy={copy} />
        <Field label="Database" value={database} onCopy={copy} />
        <Field label="User" value={server.superuser} onCopy={copy} />
        <Field
          label="Password"
          value={secret}
          display={reveal ? secret : MASK}
          onCopy={copy}
          last
        />
      </dl>

      <p className="text-xs text-fg-subtle">
        This database only accepts connections from this computer (127.0.0.1).
        The password is stored in your system keychain.
      </p>
    </DialogContent>
  );
}

function Field({
  label,
  value,
  display,
  onCopy,
  last,
}: {
  label: string;
  value: string;
  display?: string;
  onCopy: (text: string, what: string) => void;
  last?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const border = last ? "" : "border-b border-border";
  return (
    <>
      <dt className={cn("bg-surface px-3 py-2 text-xs text-fg-subtle", border)}>
        {label}
      </dt>
      <dd className={cn("flex min-w-0 items-center gap-2 px-3 py-1", border)}>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg select-text">
          {display ?? value}
        </span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          disabled={!value}
          onClick={() => {
            onCopy(value, label);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="cursor-pointer rounded p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:opacity-40"
        >
          {copied ? (
            <Check className="size-3.5 text-accent" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </dd>
    </>
  );
}
