import { Button } from "@repo/ui";
import { ArrowRight } from "lucide-react";
import { Logo } from "../../app/logo";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <Logo size={88} title="PostCompass" />
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
