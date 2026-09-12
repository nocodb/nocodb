// Platform-owned — restored every turn. Never edit. Catches render-time crashes
// so end users see a friendly card (never a white screen) and reports the error
// to the platform bridge via a document-level CustomEvent.
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router-dom";
import { inkButton, pressable } from "./surfaces";
import { cn } from "./internal/utils";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function reportAppError(detail: {
  message: string;
  stack?: string;
  componentStack?: string;
}) {
  try {
    document.dispatchEvent(new CustomEvent("nc:app-error", { detail }));
  } catch {
    /* reporting must never crash the fallback */
  }
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div role="alert" className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page hit an unexpected error. Your data is safe.
        </p>
        <button
          type="button"
          className={cn(
            "mt-4 h-9 rounded-md px-4 text-sm font-medium",
            inkButton,
            pressable,
          )}
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportAppError({
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: info?.componentStack ?? undefined,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Reset alone is enough to refresh data: children fully remount and
    // AppDataProvider's staleTime 0 refetches every query on mount.
    return <ErrorCard onRetry={() => this.setState({ error: null })} />;
  }
}

/**
 * The same card, for a route. A data router intercepts a render error into its
 * own boundary before the class above can see it, so without this on every route
 * the user gets react-router's stock "Unexpected Application Error" page and the
 * builder is never told. `mountRoutes()` attaches it; the app cannot remove it.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    reportAppError({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }, [error]);

  // Nothing to reset — the router owns this error, and it is cleared by
  // navigating, so recovery is a reload rather than a setState.
  return <ErrorCard onRetry={() => window.location.reload()} />;
}
