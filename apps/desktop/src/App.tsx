import { Spinner, Toaster, TooltipProvider } from "@repo/ui";
import { AppStateProvider, useAppState } from "./app/app-state";
import { Shell } from "./app/shell";
import { Onboarding } from "./features/onboarding/onboarding";

export function App() {
  return (
    <TooltipProvider>
      <AppStateProvider
        fallback={
          <div className="flex h-full items-center justify-center text-fg-subtle">
            <Spinner />
          </div>
        }
      >
        <Root />
      </AppStateProvider>
      <Toaster />
    </TooltipProvider>
  );
}

/** First launch shows onboarding; afterwards the main app. */
function Root() {
  const { state } = useAppState();
  return state.profile ? <Shell /> : <Onboarding />;
}
