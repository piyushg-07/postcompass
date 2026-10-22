import { Badge, Button, Input, Skeleton } from "@repo/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import { describeError } from "../../../lib/ipc";
import {
  createExtension,
  dropExtension,
  updateExtension,
} from "../../../lib/sql";
import { useExtensions } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";

/** Install and remove extensions (pgvector, PostGIS, pgcrypto, …) in a database. */
export function ExtensionsTab({
  database,
  schema,
}: {
  database: string;
  schema: string | null;
}) {
  const extensions = useExtensions(database);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{
    name: string;
    install: boolean;
    update?: string;
  } | null>(null);

  if (extensions.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (extensions.isError)
    return (
      <p className="p-4 text-sm text-danger">
        {describeError(extensions.error).message}
      </p>
    );

  const query = search.trim().toLowerCase();
  const list = extensions.data.filter(
    (e) =>
      !query ||
      e.name.includes(query) ||
      (e.comment ?? "").toLowerCase().includes(query),
  );
  const installed = list.filter((e) => e.installedVersion);
  const available = list.filter((e) => !e.installedVersion);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative w-72">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            className="pl-8"
            placeholder="Search extensions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-fg-subtle">
          {installed.length} installed · {available.length} available in{" "}
          <span className="font-mono">{database}</span>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {[
          { title: "Installed", items: installed },
          { title: "Available", items: available },
        ].map(
          (group) =>
            group.items.length > 0 && (
              <section key={group.title} className="mb-6 flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                  {group.title}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                  {group.items.map((e) => (
                    <li
                      key={e.name}
                      className="flex items-center gap-3 bg-surface px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm text-fg">
                            {e.name}
                          </span>
                          {e.installedVersion ? (
                            <Badge variant="accent">
                              v{e.installedVersion}
                            </Badge>
                          ) : (
                            e.defaultVersion && (
                              <Badge>v{e.defaultVersion}</Badge>
                            )
                          )}
                        </span>
                        {e.comment && (
                          <span className="truncate text-xs text-fg-muted">
                            {e.comment}
                          </span>
                        )}
                      </div>
                      {e.installedVersion &&
                        e.defaultVersion &&
                        e.defaultVersion !== e.installedVersion && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setPending({
                                name: e.name,
                                install: false,
                                update: e.defaultVersion!,
                              })
                            }
                          >
                            Update to v{e.defaultVersion}
                          </Button>
                        )}
                      {e.installedVersion ? (
                        e.name !== "plpgsql" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setPending({ name: e.name, install: false })
                            }
                          >
                            Remove
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            setPending({ name: e.name, install: true })
                          }
                        >
                          Install
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>

      {pending?.update && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Update ${pending.name} to v${pending.update}?`}
          description="Updates the extension's functions and types in place. Your data isn't changed."
          sql={updateExtension(pending.name)}
          database={database}
          confirmLabel="Update"
          successMessage={`${pending.name} updated to v${pending.update}`}
        />
      )}
      {pending && !pending.update && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={
            pending.install
              ? `Install ${pending.name}?`
              : `Remove ${pending.name}?`
          }
          description={
            pending.install
              ? `Its functions and types are created in the ${schema ?? "public"} schema.`
              : "Removing fails if objects depend on it."
          }
          sql={
            pending.install
              ? createExtension(pending.name, schema ?? undefined)
              : dropExtension(pending.name)
          }
          database={database}
          confirmLabel={pending.install ? "Install" : "Remove"}
          destructive={!pending.install}
          successMessage={
            pending.install
              ? `${pending.name} installed`
              : `${pending.name} removed`
          }
        />
      )}
    </div>
  );
}
