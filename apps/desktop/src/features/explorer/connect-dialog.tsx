import { Button, cn, Dialog, SheetContent, toast } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Lock, Plug } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ManagedServer } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";

const MASK = "••••••••";

interface Details {
  host: string;
  port: number;
  database: string;
  user: string;
  /** Already URL-encoded where a format needs it. */
  password: string;
}

const uri = (d: Details) =>
  `postgresql://${d.user}:${encodeURIComponent(d.password)}@${d.host}:${d.port}/${encodeURIComponent(d.database)}`;

/** Connection strings: what they are and where they go. */
const STRINGS: {
  id: string;
  label: string;
  hint: string;
  build: (d: Details) => string;
}[] = [
  {
    id: "uri",
    label: "URI",
    hint: "Works with most drivers, ORMs and tools.",
    build: uri,
  },
  {
    id: "psql",
    label: "psql",
    hint: "Paste into a terminal to open psql.",
    build: (d) => `psql "${uri(d)}"`,
  },
  {
    id: "env",
    label: ".env",
    hint: "Add to your project's .env file.",
    build: (d) => `DATABASE_URL=${uri(d)}`,
  },
  {
    id: "jdbc",
    label: "JDBC",
    hint: "For Java, Kotlin and JVM tools like DBeaver.",
    build: (d) =>
      `jdbc:postgresql://${d.host}:${d.port}/${encodeURIComponent(d.database)}?user=${d.user}&password=${encodeURIComponent(d.password)}`,
  },
];

/** Ready-to-paste snippets for popular stacks. */
const SNIPPETS: {
  id: string;
  label: string;
  hint: string;
  build: (d: Details) => string;
}[] = [
  {
    id: "node",
    label: "Node.js",
    hint: "npm install pg",
    build: (d) => `import pg from "pg";

const client = new pg.Client({
  connectionString: "${uri(d)}",
});
await client.connect();

const { rows } = await client.query("select now()");
console.log(rows);`,
  },
  {
    id: "python",
    label: "Python",
    hint: "pip install psycopg",
    build: (d) => `import psycopg

with psycopg.connect("${uri(d)}") as conn:
    print(conn.execute("select now()").fetchone())`,
  },
  {
    id: "prisma",
    label: "Prisma",
    hint: "In schema.prisma; put DATABASE_URL in .env",
    build: (d) => `# .env
DATABASE_URL="${uri(d)}"

// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`,
  },
  {
    id: "drizzle",
    label: "Drizzle",
    hint: "npm install drizzle-orm pg",
    build: (d) => `import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle("${uri(d)}");`,
  },
  {
    id: "go",
    label: "Go",
    hint: "go get github.com/jackc/pgx/v5",
    build: (d) => `conn, err := pgx.Connect(context.Background(),
    "${uri(d)}")
if err != nil {
    log.Fatal(err)
}
defer conn.Close(context.Background())`,
  },
];

type View = "string" | "code" | "params";

/** "Connect" button + side panel: how to reach the database open in the explorer. */
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
  const [view, setView] = useState<View>("string");
  const [format, setFormat] = useState(STRINGS[0]!.id);
  const [snippet, setSnippet] = useState(SNIPPETS[0]!.id);
  const [reveal, setReveal] = useState(false);
  // The password is read from the OS keychain only while this dialog is open
  const password = useQuery({
    queryKey: ["server-password", server.id],
    queryFn: () => unwrap(commands.serverPassword(server.id)),
    staleTime: 0,
    gcTime: 0,
  });
  const secret = password.data ?? "";

  const details = (pw: string): Details => ({
    host: server.host,
    port: server.port,
    database,
    user: server.superuser,
    password: pw,
  });
  // What's shown keeps the mask unless revealed; copying always uses the real password
  const shown = (build: (d: Details) => string) =>
    build(details(reveal && secret ? secret : "PASSWORD"))
      .replaceAll(encodeURIComponent("PASSWORD"), MASK)
      .replaceAll("PASSWORD", MASK);

  const copy = (text: string, what: string) => {
    if (!secret) {
      toast.error("Couldn't read the password", {
        description: password.error
          ? describeError(password.error).message
          : undefined,
      });
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`));
  };

  const current =
    view === "code"
      ? SNIPPETS.find((s) => s.id === snippet)!
      : STRINGS.find((s) => s.id === format)!;

  return (
    <SheetContent
      title={
        <span className="flex items-center gap-2">
          Connect to <span className="font-mono">{database}</span>
        </span>
      }
      description="Use these details in your app, an ORM, or any PostgreSQL tool."
      className="w-[640px]"
      footer={
        <span className="mr-auto flex items-center gap-2 text-xs text-fg-subtle">
          <Lock className="size-3.5 shrink-0" />
          Only reachable from this computer ({server.host}). The password is
          kept in your system keychain.
        </span>
      }
    >
      {/* Tab line runs edge to edge; the panel keeps its normal padding */}
      <div className="-mx-5 -mt-4 mb-4 flex gap-5 border-b border-border px-5 pt-3">
        {(
          [
            ["string", "Connection string"],
            ["code", "Code"],
            ["params", "Parameters"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "relative -mb-px cursor-pointer border-b-2 pb-2.5 text-sm transition-colors",
              view === id
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {view === "params" ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Param label="Host" value={server.host} onCopy={copy} />
            <Param label="Port" value={String(server.port)} onCopy={copy} />
            <Param label="Database" value={database} onCopy={copy} />
            <Param label="User" value={server.superuser} onCopy={copy} />
            <Param
              label="Password"
              value={secret}
              display={reveal ? secret : MASK}
              onCopy={copy}
              wide
              action={
                <RevealButton
                  reveal={reveal}
                  onToggle={() => setReveal((r) => !r)}
                />
              }
            />
          </div>
        ) : (
          <>
            {/* Choice of format / stack */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(view === "code" ? SNIPPETS : STRINGS).map((o) => {
                const active =
                  view === "code" ? snippet === o.id : format === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      view === "code" ? setSnippet(o.id) : setFormat(o.id)
                    }
                    className={cn(
                      "h-7 cursor-pointer rounded-control border px-2.5 text-xs transition-colors",
                      active
                        ? "border-accent/50 bg-accent/10 text-fg"
                        : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            {/* The string or snippet */}
            <div className="overflow-hidden rounded-card border border-border-strong bg-bg">
              <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">
                  {current.hint}
                </span>
                <RevealButton
                  reveal={reveal}
                  onToggle={() => setReveal((r) => !r)}
                />
                <CopyButton
                  onCopy={() =>
                    copy(
                      current.build(details(secret)),
                      view === "code" ? "Snippet" : "Connection string",
                    )
                  }
                />
              </div>
              <pre
                className={cn(
                  "overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-fg select-text",
                  view === "string" && "break-all whitespace-pre-wrap",
                )}
              >
                {shown(current.build)}
              </pre>
            </div>
          </>
        )}
      </div>
    </SheetContent>
  );
}

function RevealButton({
  reveal,
  onToggle,
}: {
  reveal: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={reveal ? "Hide password" : "Show password"}
      onClick={onToggle}
      className="flex h-7 cursor-pointer items-center gap-1.5 rounded-control px-2 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg [&_svg]:size-3.5"
    >
      {reveal ? <EyeOff /> : <Eye />}
      {reveal ? "Hide" : "Show"} password
    </button>
  );
}

function CopyButton({ onCopy }: { onCopy: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onCopy();
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="flex h-7 cursor-pointer items-center gap-1.5 rounded-control border border-border px-2 text-xs text-fg hover:border-border-strong hover:bg-surface-hover [&_svg]:size-3.5"
    >
      {done ? <Check className="text-accent" /> : <Copy />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Param({
  label,
  value,
  display,
  onCopy,
  action,
  wide,
}: {
  label: string;
  value: string;
  display?: string;
  onCopy: (text: string, what: string) => void;
  action?: ReactNode;
  wide?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-card border border-border bg-bg p-3",
        wide && "col-span-2",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
          {label}
        </span>
        {action}
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg select-text">
          {display ?? value}
        </span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          disabled={!value}
          onClick={() => {
            onCopy(value, label);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          }}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:opacity-40 [&_svg]:size-3.5"
        >
          {done ? <Check className="text-accent" /> : <Copy />}
        </button>
      </div>
    </div>
  );
}
