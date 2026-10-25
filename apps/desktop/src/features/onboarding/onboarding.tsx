import { Badge, Button, Input, RadioCard, RadioCardGroup, RadioChip, Spinner, StatusBadge, Stepper, toast } from "@repo/ui";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Code2,
  Globe,
  GraduationCap,
  HardDrive,
  Layers,
  Lock,
  Rocket,
  ShieldCheck,
  User,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import appIcon from "../../../app-icon.svg";
import postgresLogo from "../../assets/providers/postgresql.svg";
import { useAppState } from "../../app/app-state";
import { type RemoteDraft, useNavigation } from "../../app/navigation";
import type { Experience, ManagedServer, Role, UseCase } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { InstallFlow } from "../servers/install-flow";
import { externalPostgres, SOURCE_LABELS, useDetection } from "../servers/use-detection";
import { useServerStatuses } from "../servers/use-server-statuses";

const STEPS = ["Welcome", "About you", "Usage", "PostgreSQL", "Ready"];

const ROLES: Record<Role, { label: string; icon: ReactNode }> = {
  developer: { label: "Developer", icon: <Code2 /> },
  analyst: { label: "Data / Analyst", icon: <BarChart3 /> },
  dba: { label: "Database admin", icon: <ShieldCheck /> },
  student: { label: "Student", icon: <GraduationCap /> },
  other: { label: "Other", icon: <User /> },
};

const USE_CASES: Record<UseCase, { label: string; description: string; icon: ReactNode }> = {
  local_dev: { label: "Local development", description: "Postgres on this computer", icon: <HardDrive /> },
  remote: { label: "Remote servers", description: "Cloud or hosted databases", icon: <Globe /> },
  both: { label: "Both", description: "Local and remote", icon: <Layers /> },
  learning: { label: "Learning SQL", description: "A safe place to practice", icon: <BookOpen /> },
};

interface Answers {
  name: string;
  role: Role;
  experience: Experience;
  useCase: UseCase;
  telemetry: boolean;
}

export function Onboarding() {
  const { state, setState, refresh } = useAppState();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    name: "",
    role: "developer",
    experience: "some",
    useCase: "local_dev",
    telemetry: false,
  });
  const [installed, setInstalled] = useState<ManagedServer | null>(null);
  /** A PostgreSQL already on this computer the user chose to use; connected right after setup. */
  const [existing, setExisting] = useState<RemoteDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    try {
      const state = await unwrap(
        commands.saveProfile({
          name: answers.name.trim() || null,
          role: answers.role,
          experience: answers.experience,
          useCase: answers.useCase,
          telemetry: answers.telemetry,
          completedAt: Date.now(),
        }),
      );
      setState(state);
      // Ask for its password straight away, in the add-connection dialog
      if (existing) useNavigation.getState().openRemoteDialogWith(existing);
    } catch (e) {
      toast.error("Couldn't save your answers", { description: describeError(e).message });
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full">
      {step > 0 && (
        <aside className="flex w-60 shrink-0 flex-col gap-10 border-r border-border bg-surface px-8 py-12">
          <div className="flex items-center gap-2.5">
            <img src={appIcon} alt="" width={32} height={32} draggable={false} />
            <span className="flex items-baseline gap-px text-xl text-fg">
              <span className="font-brand font-bold tracking-tighter">Post</span>
              <span className="bg-linear-to-r from-accent to-[#7ee7b8] bg-clip-text pr-0.5 font-serif text-[1.4rem] leading-none text-transparent italic">
                Compass
              </span>
            </span>
          </div>
          <Stepper steps={STEPS} current={step} orientation="vertical" />
        </aside>
      )}

      <div className="flex flex-1 justify-center overflow-y-auto px-12 py-14">
        <div className="my-auto flex w-full max-w-xl flex-col">
          {step === 0 && <WelcomeStep onNext={next} />}

          {step === 1 && (
            <StepLayout title="A bit about you" onBack={back} onNext={next}>
              <Group label="Your name" hint="Optional" htmlFor="onboarding-name">
                <Input
                  id="onboarding-name"
                  placeholder="Your name"
                  value={answers.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoFocus
                />
              </Group>
              <Group label="Your role">
                <RadioCardGroup className="flex flex-wrap" value={answers.role} onValueChange={(v) => set("role", v as Role)}>
                  {Object.entries(ROLES).map(([value, { label, icon }]) => (
                    <RadioChip key={value} value={value} title={label} icon={icon} />
                  ))}
                </RadioCardGroup>
              </Group>
              <Group label="PostgreSQL experience">
                <RadioCardGroup
                  className="grid-cols-3"
                  value={answers.experience}
                  onValueChange={(v) => set("experience", v as Experience)}
                >
                  <RadioCard value="new" title="New" description="Show hints" />
                  <RadioCard value="some" title="Some" description="Know the basics" />
                  <RadioCard value="expert" title="Expert" description="Keep it dense" />
                </RadioCardGroup>
              </Group>
            </StepLayout>
          )}

          {step === 2 && (
            <StepLayout title="How will you use PostCompass?" onBack={back} onNext={next}>
              <RadioCardGroup className="grid-cols-2" value={answers.useCase} onValueChange={(v) => set("useCase", v as UseCase)}>
                {Object.entries(USE_CASES).map(([value, { label, description, icon }]) => (
                  <RadioCard key={value} value={value} title={label} description={description} icon={icon} />
                ))}
              </RadioCardGroup>
            </StepLayout>
          )}

          {step === 3 && (
            <PostgresStep
              installed={installed}
              existing={existing}
              onInstalled={(server) => {
                setInstalled(server);
                setExisting(null);
                void refresh();
                next();
              }}
              onUseExisting={(server) => {
                setExisting(server);
                next();
              }}
              onBack={back}
              onNext={next}
            />
          )}

          {step === 4 && (
            <ReadyStep
              answers={answers}
              server={installed ?? state.servers[0] ?? null}
              existing={existing}
              saving={saving}
              onBack={back}
              onFinish={() => void finish()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <img src={appIcon} alt="PostCompass" width={88} height={88} draggable={false} />
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Welcome to PostCompass</h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-fg-muted">
          A faster, friendlier way to work with PostgreSQL. Let's get you set up. It takes about a minute.
        </p>
      </div>
      <Button size="lg" variant="primary" iconRight={<ArrowRight />} onClick={onNext} autoFocus>
        Get started
      </Button>
    </div>
  );
}

function PostgresStep({
  installed,
  existing,
  onInstalled,
  onUseExisting,
  onBack,
  onNext,
}: {
  installed: ManagedServer | null;
  existing: RemoteDraft | null;
  onInstalled: (server: ManagedServer) => void;
  onUseExisting: (server: RemoteDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { state } = useAppState();
  const [installing, setInstalling] = useState(false);
  const ready = installed ?? state.servers[0] ?? null;
  const { statuses } = useServerStatuses(ready ? [ready.id] : []);
  const status = ready ? statuses[ready.id] : undefined;
  const { report, scanning } = useDetection();
  const found = report ? externalPostgres(report, state.servers) : null;
  const [picked, setPicked] = useState<number | null>(existing?.port ?? null);

  if (installing) {
    return (
      <StepLayout title="Install PostgreSQL">
        <InstallFlow onInstalled={onInstalled} onCancel={() => setInstalling(false)} cancelLabel="Back" />
      </StepLayout>
    );
  }

  if (ready) {
    return (
      <StepLayout title="PostgreSQL is ready" onBack={onBack} onNext={onNext}>
        <ServerCard
          title={ready.name}
          detail={`${ready.host}:${ready.port}`}
          aside={status && <StatusBadge status={status} />}
        />
      </StepLayout>
    );
  }

  // First scan still running: nothing to decide yet
  if (!report && scanning) {
    return (
      <StepLayout title="Looking for PostgreSQL…" onBack={onBack}>
        <ServerCard
          title="Checking this computer"
          detail="Looking for installed PostgreSQL and running servers."
          aside={<Spinner className="size-4 text-fg-subtle" />}
        />
      </StepLayout>
    );
  }

  // Already running on this computer: offer to use it
  if (found && found.servers.length > 0) {
    const selected = found.servers.find((s) => s.port === picked) ?? found.servers[0]!;
    const describe = (server: (typeof found.servers)[number]) => {
      const source = server.label ?? (server.source ? SOURCE_LABELS[server.source] : null);
      return `${server.host}:${server.port}${source ? ` · ${source}` : ""}`;
    };
    return (
      <StepLayout
        title="PostgreSQL is already on this computer"
        onBack={onBack}
        actions={
          <>
            <Button variant="ghost" onClick={() => setInstalling(true)}>
              Install a separate one
            </Button>
            <Button
              variant="primary"
              iconRight={<ArrowRight />}
              onClick={() =>
                onUseExisting({ name: `PostgreSQL on port ${selected.port}`, host: selected.host, port: selected.port })
              }
            >
              Use this
            </Button>
          </>
        }
      >
        {found.servers.length === 1 ? (
          <ServerCard
            title={`PostgreSQL on port ${selected.port}`}
            detail={describe(selected)}
            aside={<StatusBadge status="running" />}
          />
        ) : (
          <RadioCardGroup value={String(selected.port)} onValueChange={(v) => setPicked(Number(v))}>
            {found.servers.map((server) => (
              <RadioCard
                key={server.port}
                value={String(server.port)}
                title={`PostgreSQL on port ${server.port}`}
                description={describe(server)}
                icon={<img src={postgresLogo} alt="" draggable={false} />}
              />
            ))}
          </RadioCardGroup>
        )}
      </StepLayout>
    );
  }

  const stopped = found?.installs[0];
  return (
    <StepLayout
      title="Set up PostgreSQL"
      onBack={onBack}
      actions={
        <>
          <Button variant="ghost" onClick={onNext}>
            Skip for now
          </Button>
          <Button variant="primary" iconRight={<ArrowRight />} onClick={() => setInstalling(true)}>
            Install PostgreSQL
          </Button>
        </>
      }
    >
      <ServerCard title="PostgreSQL" detail="Runs privately on this computer. No admin rights or Docker." />
      {/* Installed but not running, so there's nothing to connect to yet */}
      {stopped && (
        <p className="-mt-6 text-sm text-fg-muted">
          We found PostgreSQL {stopped.version ?? ""} installed ({SOURCE_LABELS[stopped.source]}), but it isn't running.
          Start it and connect later from Databases, or install one here.
        </p>
      )}
    </StepLayout>
  );
}

function StepLayout({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextLoading,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
  /** Replaces the Continue button on the right of the footer. */
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[15px] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-11">{children}</div>
      {(onBack || onNext || actions) && (
        <div className="flex items-center justify-between border-t border-border pt-8">
          {onBack ? (
            <Button variant="ghost" iconLeft={<ArrowLeft />} onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex items-center gap-3">{actions}</div>
          ) : (
            onNext && (
              <Button variant="primary" iconRight={<ArrowRight />} onClick={onNext} loading={nextLoading}>
                {nextLabel}
              </Button>
            )
          )}
        </div>
      )}
    </section>
  );
}

function Group({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-fg">
        {label}
        {hint && <span className="text-xs font-normal text-fg-subtle">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ServerCard({ title, detail, aside }: { title: string; detail: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-5 rounded-card border border-border bg-surface p-5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-bg">
        <img src={postgresLogo} alt="" width={32} height={32} draggable={false} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-base font-medium text-fg">{title}</span>
        <span className="truncate text-sm text-fg-muted">{detail}</span>
      </span>
      {aside}
    </div>
  );
}

function ReadyStep({
  answers,
  server,
  saving,
  onBack,
  onFinish,
  existing,
}: {
  answers: Answers;
  server: ManagedServer | null;
  /** Chosen PostgreSQL already on this computer; connected after setup. */
  existing: RemoteDraft | null;
  saving: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const name = answers.name.trim();
  return (
    <div className="flex flex-col items-center gap-12 text-center">
      <div className="flex flex-col items-center gap-7">
        <span className="flex size-20 items-center justify-center rounded-2xl border border-accent/30 bg-linear-to-b from-accent/20 to-accent/5 shadow-[0_0_64px] shadow-accent/20">
          <Rocket className="size-9 text-accent" strokeWidth={1.75} />
        </span>
        <h1 className="flex flex-wrap items-baseline justify-center gap-x-2.5 text-4xl font-semibold tracking-tight">
          {name ? `${name}, you're ready to` : "You're ready to"}
          <span className="bg-linear-to-r from-accent to-[#7ee7b8] bg-clip-text pr-1 font-serif text-[2.9rem] leading-none font-normal text-transparent italic">
            explore
          </span>
        </h1>
      </div>

      <div className="grid w-full grid-cols-3 gap-3 text-left">
        <RecapTile
          icon={<img src={postgresLogo} alt="" className="size-4" draggable={false} />}
          label="PostgreSQL"
          value={server ? "Ready" : existing ? `Existing · port ${existing.port}` : "Not installed"}
        />
        <RecapTile icon={ROLES[answers.role].icon} label="Role" value={ROLES[answers.role].label} />
        <RecapTile icon={USE_CASES[answers.useCase].icon} label="Usage" value={USE_CASES[answers.useCase].label} />
      </div>

      <Button
        size="lg"
        variant="primary"
        iconRight={<ArrowRight />}
        onClick={onFinish}
        loading={saving}
        autoFocus
        className="w-full"
      >
        Open PostCompass
      </Button>

      <div className="-mt-4 flex w-full items-center justify-between">
        <Button variant="ghost" size="sm" iconLeft={<ArrowLeft />} onClick={onBack} className="-ml-3">
          Back
        </Button>
        <div className="flex items-center gap-5 text-xs text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" />
            Passwords stay in your keychain
          </span>
          <span className="flex items-center gap-2">
            Usage stats
            <Badge>Coming soon</Badge>
          </span>
        </div>
      </div>
    </div>
  );
}

function RecapTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-bg text-accent [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-xs text-fg-subtle">{label}</span>
        <span className="truncate text-sm font-medium text-fg">{value}</span>
      </span>
    </div>
  );
}
