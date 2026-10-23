import { Button } from "@repo/ui";
import { AlertTriangle, Copy, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Changing this resets the boundary, e.g. when navigating to another page. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  componentStack: string;
}

/**
 * Shows a readable error instead of a black window when a screen crashes.
 * Placed around the page area so the sidebar keeps working, and around the whole app as a last resort.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PostCompass] screen crashed:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: "" });
    }
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const details = `${error.name}: ${error.message}\n${error.stack ?? ""}\n\nComponent stack:${componentStack}`;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex w-full max-w-xl flex-col gap-4 rounded-card border border-danger/30 bg-surface p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-sm font-semibold text-fg">
                This screen ran into a problem
              </h2>
              <p className="font-mono text-xs break-words text-danger">
                {error.message}
              </p>
              <p className="text-xs text-fg-muted">
                Your data is safe. Try again, or copy the details if it keeps
                happening.
              </p>
            </div>
          </div>
          <pre className="max-h-48 overflow-auto rounded-control border border-border bg-bg p-3 font-mono text-[11px] whitespace-pre-wrap text-fg-subtle select-text">
            {details}
          </pre>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<Copy />}
              onClick={() => void navigator.clipboard.writeText(details)}
            >
              Copy details
            </Button>
            <Button
              size="sm"
              variant="primary"
              iconLeft={<RotateCcw />}
              onClick={() => this.setState({ error: null, componentStack: "" })}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
