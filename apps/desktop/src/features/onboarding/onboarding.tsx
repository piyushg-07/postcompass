import { Input, RadioCard, RadioCardGroup, RadioChip, Stepper, toast } from "@repo/ui";
import { useState } from "react";
import { useAppState } from "../../app/app-state";
import { Logo } from "../../app/logo";
import { type RemoteDraft, useNavigation } from "../../app/navigation";
import type { Experience, ManagedServer, Role, UseCase } from "../../lib/bindings";
import { commands, describeError, unwrap } from "../../lib/ipc";
import { Group, StepLayout } from "./layout";
import { type Answers, ROLES, STEPS, USE_CASES } from "./options";
import { PostgresStep } from "./postgres-step";
import { ReadyStep } from "./ready-step";
import { WelcomeStep } from "./welcome-step";

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
            <Logo size={32} />
            <span className="flex items-baseline gap-px text-xl text-fg">
              <span className="font-brand font-bold tracking-tighter">Post</span>
              <span className="bg-linear-to-r from-accent to-[color-mix(in_srgb,var(--color-accent),white_45%)] bg-clip-text pr-0.5 font-serif text-[1.4rem] leading-none text-transparent italic">
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
