import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  LogViewer,
  NativeSelect,
  PasswordInput,
  Progress,
  RadioCard,
  RadioCardGroup,
  Skeleton,
  Spinner,
  StatusBadge,
  Stepper,
  Switch,
  TaskSteps,
  toast,
} from "@repo/ui";
import { Copy, Database, Plus, Settings, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PageHeader } from "../app/page";
import { generatePassword } from "../lib/format";

/** Dev-only gallery of every component in every state. */
export function Playground() {
  const [password, setPassword] = useState(generatePassword());
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <PageHeader title="Components" description="Every design-system component in every state. Development builds only." />

      <Section title="Buttons">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
        </Row>
        <Row>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button iconLeft={<Plus />}>With icon</Button>
          <IconButton label="Settings" icon={<Settings />} />
          <IconButton label="Copy" icon={<Copy />} size="sm" />
        </Row>
      </Section>

      <Section title="Toasts">
        <Row>
          <Button onClick={() => toast.success("Server started", { description: "Local PostgreSQL 18 on port 5432" })}>Success</Button>
          <Button onClick={() => toast.error("Connection failed", { description: "password authentication failed for user postgres" })}>Error</Button>
          <Button onClick={() => toast.warning("Server is using an old version")}>Warning</Button>
          <Button onClick={() => toast.info("A new version is available", { action: { label: "Update", onClick: () => toast.success("Updating…") } })}>
            Info + action
          </Button>
          <Button
            onClick={() =>
              void toast
                .promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
                  loading: "Saving…",
                  success: "Saved",
                  error: "Failed",
                })
                .catch(() => undefined)
            }
          >
            Promise
          </Button>
        </Row>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <Field label="Host" hint="Hostname or IP address">
            {(p) => <Input {...p} placeholder="localhost" />}
          </Field>
          <Field label="Port" error="Port 5432 is in use">
            {(p) => <Input {...p} defaultValue={5432} className="font-mono" />}
          </Field>
          <Field label="Password">
            {(p) => (
              <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} onGenerate={() => setPassword(generatePassword())} />
            )}
          </Field>
          <Field label="Version">
            {(p) => (
              <NativeSelect {...p}>
                <option>PostgreSQL 18.6.0</option>
                <option>PostgreSQL 17.11.0</option>
              </NativeSelect>
            )}
          </Field>
          <Field label="Disabled">{(p) => <Input {...p} disabled value="Read only" />}</Field>
        </div>
        <Row>
          <label className="flex items-center gap-2 text-sm"><Switch defaultChecked /> Switch on</label>
          <label className="flex items-center gap-2 text-sm"><Switch /> Switch off</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Checked</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox /> Unchecked</label>
        </Row>
        <RadioCardGroup defaultValue="a" className="max-w-xl grid-cols-2">
          <RadioCard value="a" title="Selected" description="With a description" icon={<Database />} />
          <RadioCard value="b" title="Not selected" description="Hover me" icon={<Database />} />
        </RadioCardGroup>
      </Section>

      <Section title="Status">
        <Row>
          <StatusBadge status="running" />
          <StatusBadge status="starting" />
          <StatusBadge status="stopped" />
          <StatusBadge status="error" />
          <Badge>Neutral</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <span className="flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          <Spinner />
        </Row>
      </Section>

      <Section title="Progress">
        <div className="flex max-w-xl flex-col gap-4">
          <Stepper steps={["Welcome", "About you", "Usage", "PostgreSQL", "Ready"]} current={2} />
          <Progress value={64} label="Download" />
          <Progress label="Working" />
          <TaskSteps
            steps={[
              { id: "1", label: "Checking system", state: "done" },
              { id: "2", label: "Downloading PostgreSQL", state: "active", detail: "18.2 / 54.1 MB" },
              { id: "3", label: "Verifying checksum", state: "pending" },
              { id: "4", label: "Extracting files", state: "skipped", detail: "Already installed" },
              { id: "5", label: "Starting server", state: "error", detail: "port 5432 is already in use" },
            ]}
          />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>
      </Section>

      <Section title="Containers">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description goes here.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-fg-muted">Card content.</CardContent>
            <CardFooter className="justify-end">
              <Button size="sm" variant="ghost">Cancel</Button>
              <Button size="sm" variant="primary">Save</Button>
            </CardFooter>
          </Card>
          <Card>
            <EmptyState
              icon={<Database />}
              title="No connections yet"
              description="Connect to a database to start exploring."
              actions={<Button variant="primary" iconLeft={<Plus />}>Add connection</Button>}
            />
          </Card>
        </div>
        <LogViewer
          lines={[
            "The files belonging to this database system will be owned by user \"postgres\".",
            "Success. You can now start the database server using:",
            "    pg_ctl -D data -l logfile start",
          ]}
        />
      </Section>

      <Section title="Dialogs">
        <Row>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Add connection" description="Connect to a PostgreSQL server.">
              <Field label="Host">{(p) => <Input {...p} placeholder="localhost" autoFocus />}</Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="primary">Connect</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="danger" iconLeft={<Trash2 />} onClick={() => setConfirmOpen(true)}>
            Destructive confirm
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Remove Local PostgreSQL 18?"
            description="This permanently deletes all databases on this server."
            confirmText="Local PostgreSQL 18"
            confirmLabel="Remove server"
            destructive
            onConfirm={() => {
              setConfirmOpen(false);
              toast.success("Removed (demo)");
            }}
          />
        </Row>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
