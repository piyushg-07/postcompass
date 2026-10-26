import { Badge, Button } from "@repo/ui";
import { ArrowLeft, ArrowRight, Lock, Rocket } from "lucide-react";
import postgresLogo from "../../assets/providers/postgresql.svg";
import type { RemoteDraft } from "../../app/navigation";
import type { ManagedServer } from "../../lib/bindings";
import { RecapTile } from "./layout";
import { type Answers, ROLES, USE_CASES } from "./options";

export function ReadyStep({
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
