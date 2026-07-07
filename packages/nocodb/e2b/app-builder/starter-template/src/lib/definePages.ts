import { createElement } from 'react';
import type { ComponentType, ReactElement } from 'react';

export interface AppPage {
  /** Stable, unique per app — the permission target. */
  id: string;
  /** Router path, e.g. "/" or "/admin". */
  path: string;
  /** Nav label. */
  title: string;
  /** The page component. */
  component: ComponentType;
  /** Routine names this page may invoke (its reachability set). */
  routines?: string[];
}

// Live (published) apps must honor per-caller page grants CLIENT-SIDE too: the
// bundle ships every page, so without a guard a page whose nav link is hidden
// still renders on in-app navigation (client routing never re-hits the
// server). window.__nc_app_pages__ is the caller's grant set, pre-filtered
// server-side. Dev/preview (__nc_app_live__ !== true) has no gate. This is a
// UX guard, not the security boundary — the server still gates the initial
// document and every routine invoke. Read per-render (not at module scope) so
// the guard never depends on script evaluation order.
function grantedPageIds(): Set<string> | null {
  if (window.__nc_app_live__ !== true) return null; // dev/preview: no gate
  return new Set((window.__nc_app_pages__ ?? []).map((p) => p.id));
}

function PageUnavailable(): ReactElement {
  return createElement(
    'div',
    {
      className:
        'flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center',
    },
    createElement(
      'p',
      { className: 'text-lg font-semibold text-foreground' },
      'Page unavailable',
    ),
    createElement(
      'p',
      { className: 'text-sm text-muted-foreground' },
      "You don't have access to this page.",
    ),
  );
}

function withPageGuard(id: string, Component: ComponentType): ComponentType {
  return function GuardedPage() {
    const granted = grantedPageIds();
    if (granted !== null && !granted.has(id)) {
      return createElement(PageUnavailable);
    }
    return createElement(Component);
  };
}

/**
 * The page manifest helper. The publish scanner statically finds this exact
 * `definePages([...])` call, and every returned page's `component` carries the
 * platform's per-page access guard — a page the caller may not view renders
 * "Page unavailable" no matter how the app routes to it, so custom routers and
 * layouts never need to re-implement access checks.
 */
export function definePages(pages: AppPage[]): AppPage[] {
  return pages.map((p) => ({
    ...p,
    component: withPageGuard(p.id, p.component),
  }));
}
