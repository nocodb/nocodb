// Platform-owned — restored every turn. Never edit.
//
// The seam that lets the docked assistant reflow the app instead of covering it.
//
// The app is wrapped in a container whose right padding tracks the pane width.
// The app keeps owning its own layout — it just lives in a slightly narrower
// box while the pane is docked — so nothing in an app has to know the
// assistant exists.
//
// Both the pane's width and the app's inset read the SAME custom properties,
// published from here at import time, so they cannot disagree mid-transition and
// an app that wants to react to the pane can read the variable in its own CSS.
import type { ReactNode } from "react";

/** Width of the docked pane, from `sm` up. */
export const AGENT_PANE_WIDTH = "24rem";

/** Published so the pane itself and this inset read one value. */
const PANE_WIDTH_VAR = "--nc-agent-pane-width";

/** Current inset: the pane width while docked, zero otherwise. */
const INSET_VAR = "--nc-agent-inset";

// At import time, not on first dock: the pane's own `sm:w-(--nc-agent-pane-width)`
// would otherwise render one frame against an undefined variable.
document.documentElement.style.setProperty(PANE_WIDTH_VAR, AGENT_PANE_WIDTH);

/** Fired by AppAgent whenever the presentation changes. */
export function setAgentInset(docked: boolean): void {
  document.documentElement.style.setProperty(
    INSET_VAR,
    docked ? AGENT_PANE_WIDTH : "0px",
  );
}

/**
 * Wraps the app so a docked pane narrows it — from `sm` up only. Under `sm` the
 * pane covers the app instead (it is full-bleed there): there is no useful width
 * left to split on a phone, and a 24rem pane is wider than the viewport.
 *
 * Pure CSS, no state: the inset variable is the whole mechanism, so this cannot
 * fall out of step with the pane that sets it.
 */
export function AgentInsetShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="agent-inset-shell"
      className="min-h-dvh transition-[padding] duration-200 ease-out motion-reduce:transition-none sm:pe-(--nc-agent-inset)"
    >
      {children}
    </div>
  );
}
