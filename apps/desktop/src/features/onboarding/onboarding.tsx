import { Button, Field, Input, RadioCard, RadioCardGroup, Stepper, Switch, toast } from "@repo/ui";
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
import { useAppState } from "../../app/app-state";
import type { Experience, ManagedServer, Role, UseCase } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { DetectionResults } from "../servers/detection-results";
import { InstallFlow } from "../servers/install-flow";
import { foundExternal, useDetection } from "../servers/use-detection";

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
    <div className="flex h-full flex-col">
      {step > 0 && (
        <header className="flex h-16 shrink-0 items-center justify-center border-b border-border px-8">
          <Stepper steps={STEPS} current={step} />
        </header>
      )}

      <div className="flex flex-1 justify-center overflow-y-auto px-8 py-14">
        <div className="my-auto flex w-full max-w-xl flex-col">
          {step === 0 && <WelcomeStep onNext={next} />}

          {step === 1 && (
            <StepLayout title="Tell us about you" description="This helps PostCompass pick sensible defaults." onBack={back} onNext={next}>
              <Field label="Your name (optional)">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="What should we call you?"
                    value={answers.name}
                    onChange={(e) => set("name", e.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Group label="Your role">
                <RadioCardGroup className="grid-cols-2" value={answers.role} onValueChange={(v) => set("role", v as Role)}>
                  <RadioCard value="developer" title="Developer" icon={<Code2 />} />
                  <RadioCard value="analyst" title="Data / Analyst" icon={<BarChart3 />} />
                  <RadioCard value="dba" title="Database admin" icon={<ShieldCheck />} />
                  <RadioCard value="student" title="Student" icon={<GraduationCap />} />
                  <RadioCard value="other" title="Other" icon={<User />} />
                </RadioCardGroup>
              </Group>
              <Group label="Experience with PostgreSQL">
                <RadioCardGroup
                  className="grid-cols-3"
                  value={answers.experience}
                  onValueChange={(v) => set("experience", v as Experience)}
                >
                  <RadioCard value="new" title="New" description="Show me hints" />
                  <RadioCard value="some" title="Some" description="I know the basics" />
                  <RadioCard value="expert" title="Expert" description="Keep it dense" />
                </RadioCardGroup>
              </Group>
            </StepLayout>
          )}

          {step === 2 && (
            <StepLayout title="How will you use PostCompass?" description="You can do all of these later." onBack={back} onNext={next}>
              <RadioCardGroup value={answers.useCase} onValueChange={(v) => set("useCase", v as UseCase)}>
                <RadioCard value="local_dev" title="Local development" description="Run PostgreSQL on this computer while building apps." icon={<HardDrive />} />
                <RadioCard value="remote" title="Manage remote servers" description="Connect to databases in the cloud or on a server." icon={<Globe />} />
                <RadioCard value="both" title="Both" description="Local databases and remote servers." icon={<Layers />} />
                <RadioCard value="learning" title="Learning SQL" description="A safe place to practice." icon={<BookOpen />} />
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
  const detection = useDetection();
  const [installing, setInstalling] = useState(false);
  const report = detection.state.status === "done" ? detection.state.report : null;
  const found = report ? foundExternal(report) : false;

  if (installing) {
    return (
      <StepLayout title="Install PostgreSQL" description="Installs PostgreSQL privately for this computer. No admin rights needed.">
        <InstallFlow onInstalled={onInstalled} onCancel={() => setInstalling(false)} cancelLabel="Back" />
      </StepLayout>
    );
  }

  const title =
    detection.state.status === "scanning"
      ? "Looking for PostgreSQL…"
      : found
        ? "We found PostgreSQL on this computer"
        : "PostgreSQL isn't installed yet";
  const description =
    detection.state.status === "scanning"
      ? "Checking installed programs, services and local ports."
      : found
        ? "You can connect to it, or install a separate one managed by PostCompass."
        : "Install it in one click. No admin rights needed, and it won't touch anything else on your computer.";

  return (
    <StepLayout title={title} description={description} onBack={onBack}>
      <DetectionResults state={detection.state} />

      {report && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onNext}>
            Skip, I'll connect to a remote server
          </Button>
          <div className="flex gap-2">
            {found ? (
              <>
                <Button onClick={() => setInstalling(true)}>Install a separate one</Button>
                <Button variant="primary" iconRight={<ArrowRight />} onClick={onNext}>
                  Use existing
                </Button>
              </>
            ) : installed ? (
              <Button variant="primary" iconRight={<ArrowRight />} onClick={onNext}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setInstalling(true)}>
                Install PostgreSQL
              </Button>
            )}
          </div>
        </div>
      )}
      {detection.state.status === "error" && (
        <div className="flex justify-end gap-2">
          <Button onClick={detection.rescan}>Scan again</Button>
          <Button variant="primary" onClick={() => setInstalling(true)}>
            Install PostgreSQL
          </Button>
        </div>
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
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
}) {
  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[15px] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-8">{children}</div>
      {(onBack || onNext) && (
        <div className="flex items-center justify-between border-t border-border pt-6">
          {onBack ? (
            <Button variant="ghost" iconLeft={<ArrowLeft />} onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {onNext && (
            <Button variant="primary" iconRight={<ArrowRight />} onClick={onNext} loading={nextLoading}>
              {nextLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
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
