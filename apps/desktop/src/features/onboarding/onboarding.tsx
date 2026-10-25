import { Button, Input, RadioCard, RadioCardGroup, RadioChip, StatusBadge, Stepper, Switch, toast } from "@repo/ui";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Code2,
  Globe,
  GraduationCap,
  HardDrive,
  Layers,
  ShieldCheck,
  User,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import appIcon from "../../../app-icon.svg";
import postgresLogo from "../../assets/providers/postgresql.svg";
import { useAppState } from "../../app/app-state";
import type { Experience, ManagedServer, Role, UseCase } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { InstallFlow } from "../servers/install-flow";
import { useServerStatuses } from "../servers/use-server-statuses";

const STEPS = ["Welcome", "About you", "Usage", "PostgreSQL", "Ready"];

interface Answers {
  name: string;
  role: Role;
  experience: Experience;
  useCase: UseCase;
  telemetry: boolean;
}

export function Onboarding() {
  const { setState, refresh } = useAppState();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    name: "",
    role: "developer",
    experience: "some",
    useCase: "local_dev",
    telemetry: false,
  });
  const [installed, setInstalled] = useState<ManagedServer | null>(null);
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
              <span className="bg-gradient-to-r from-accent to-[#7ee7b8] bg-clip-text pr-0.5 font-serif text-[1.4rem] leading-none text-transparent italic">
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
                  <RadioChip value="developer" title="Developer" icon={<Code2 />} />
                  <RadioChip value="analyst" title="Data / Analyst" icon={<BarChart3 />} />
                  <RadioChip value="dba" title="Database admin" icon={<ShieldCheck />} />
                  <RadioChip value="student" title="Student" icon={<GraduationCap />} />
                  <RadioChip value="other" title="Other" icon={<User />} />
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
                <RadioCard value="local_dev" title="Local development" description="Postgres on this computer" icon={<HardDrive />} />
                <RadioCard value="remote" title="Remote servers" description="Cloud or hosted databases" icon={<Globe />} />
                <RadioCard value="both" title="Both" description="Local and remote" icon={<Layers />} />
                <RadioCard value="learning" title="Learning SQL" description="A safe place to practice" icon={<BookOpen />} />
              </RadioCardGroup>
            </StepLayout>
          )}

          {step === 3 && (
            <PostgresStep
              installed={installed}
              onInstalled={(server) => {
                setInstalled(server);
                void refresh();
                next();
              }}
              onBack={back}
              onNext={next}
            />
          )}

          {step === 4 && (
            <StepLayout
              title="You're all set"
              description={installed ? `${installed.name} is running on port ${installed.port}.` : "PostCompass is ready to use."}
              onBack={back}
              nextLabel="Open PostCompass"
              onNext={() => void finish()}
              nextLoading={saving}
            >
              <ul className="flex flex-col gap-3 text-sm text-fg-muted">
                <Summary>{answers.name.trim() ? `Hi ${answers.name.trim()}, welcome aboard.` : "Welcome aboard."}</Summary>
                {installed && <Summary>Local PostgreSQL {installed.version} installed and running.</Summary>}
                <Summary>Your passwords are stored in your system keychain.</Summary>
              </ul>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-card border border-border bg-surface px-4 py-3.5">
                <span className="flex flex-col gap-1">
                  <span className="text-sm text-fg">Share anonymous usage stats</span>
                  <span className="text-xs text-fg-muted">Helps us improve PostCompass. Never includes your data or queries.</span>
                </span>
                <Switch checked={answers.telemetry} onCheckedChange={(checked) => set("telemetry", checked)} />
              </label>
            </StepLayout>
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
  onInstalled,
  onBack,
  onNext,
}: {
  installed: ManagedServer | null;
  onInstalled: (server: ManagedServer) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { state } = useAppState();
  const [installing, setInstalling] = useState(false);
  const ready = installed ?? state.servers[0] ?? null;
  const { statuses } = useServerStatuses(ready ? [ready.id] : []);
  const status = ready ? statuses[ready.id] : undefined;

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

function Summary({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}
