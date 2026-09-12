"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "../internal/utils";
import { Spinner } from "../internal/spinner";
import { ShimmerLabel } from "../surfaces";

export interface ToolStepItem {
  id: string;
  /** Human name for the step. Never an action id — a viewer runs a booking system, not a set of actions. */
  label: string;
  /** Mirrors AppAgentToolStatus's values as literals, so this element stays presentational. */
  status: "running" | "done" | "error";
  error?: string;
}

/** Consecutive identical successes read as one line with a count; a failure never merges. */
function coalesce(steps: ToolStepItem[]): { step: ToolStepItem; count: number }[] {
  const out: { step: ToolStepItem; count: number }[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (
      last &&
      step.status === "done" &&
      last.step.status === "done" &&
      last.step.label === step.label
    ) {
      last.count += 1;
      continue;
    }
    out.push({ step, count: 1 });
  }
  return out;
}

function StepRow({
  step,
  count = 1,
}: {
  step: ToolStepItem;
  count?: number;
}) {
  const failed = step.status === "error";

  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 items-center gap-1.5 self-start text-[11px] leading-5",
        failed ? "text-destructive" : "text-foreground/45",
      )}
    >
      {step.status === "running" ? (
        <Spinner className="size-3 shrink-0" />
      ) : failed ? (
        <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <CheckIcon className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">
        {step.label}
        {step.error ? ` — ${step.error}` : ""}
      </span>
      {count > 1 ? (
        <span className="text-foreground/30 shrink-0 tabular-nums">
          × {count}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One run of steps the assistant took, as a single foldable line.
 *
 * A bulk request ("add some dummy records") produces a dozen calls, and a dozen
 * lines buries the answer they belong to — so the run collapses to a summary and
 * the answer stays the content. Two things are never folded away: a step still
 * running, which IS the current status, and a step that failed, which the person
 * has to see without going looking for it.
 *
 * A lone step needs no summary — it renders as the bare line it already was.
 */
export function ToolSteps({
  steps,
  className,
}: {
  steps: ToolStepItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!steps.length) return null;
  if (steps.length === 1) {
    return (
      <div className={cn("flex w-full max-w-[68ch] flex-col", className)}>
        <StepRow step={steps[0]} />
      </div>
    );
  }

  // The LAST running step, not the first: earlier ones have already resolved.
  const running = [...steps].reverse().find((s) => s.status === "running");
  const failures = steps.filter((s) => s.status === "error");

  return (
    <div
      className={cn(
        "flex w-full max-w-[68ch] flex-col gap-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "focus-visible:ring-foreground/20 flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-md text-[11px] leading-5 outline-none transition-colors focus-visible:ring-2",
          failures.length
            ? "text-destructive"
            : "text-foreground/45 hover:text-foreground/70",
        )}
      >
        {running ? (
          <Spinner className="size-3 shrink-0" />
        ) : failures.length ? (
          <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" />
        ) : (
          <CheckIcon className="size-3 shrink-0" aria-hidden="true" />
        )}

        {running ? (
          <ShimmerLabel className="relative inline-block min-w-0 truncate">
            {running.label}…
          </ShimmerLabel>
        ) : (
          <span className="truncate">
            {failures.length
              ? `${steps.length} steps · ${failures.length} failed`
              : `Worked on ${steps.length} steps`}
          </span>
        )}

        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {/* 0fr → 1fr is the one collapse that animates to content height without
          measuring it. Base UI is the app's dependency, not the shell's. */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 ps-4">
            {coalesce(steps).map(({ step, count }) => (
              <StepRow key={step.id} step={step} count={count} />
            ))}
          </div>
        </div>
      </div>

      {!open && failures.length ? (
        <div className="flex flex-col gap-0.5 ps-4">
          {failures.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
