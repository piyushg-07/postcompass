import { Spinner, Toaster, TooltipProvider } from "@repo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { AppStateGate, useAppState } from "./app/app-state";
import { ErrorBoundary } from "./app/error-boundary";
import { Shell } from "./app/shell";
import { WindowFrame } from "./app/title-bar";
import { Onboarding } from "./features/onboarding/onboarding";
import { queryClient } from "./lib/query";

// Dev-only; the import is dropped from production builds
const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <AppStateGate
            fallback={
              <WindowFrame>
                <div className="flex h-full items-center justify-center text-fg-subtle">
                  <Spinner />
                </div>
              </WindowFrame>
            }
          >
            <Root />
          </AppStateGate>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
      <Suspense>
        <QueryDevtools buttonPosition="bottom-right" />
      </Suspense>
    </QueryClientProvider>
  );
}

/** First launch shows onboarding; afterwards the main app. */
function Root() {
  const { state } = useAppState();
  return state.profile ? (
    <Shell />
  ) : (
    <WindowFrame>
      <Onboarding />
    </WindowFrame>
  );
}
