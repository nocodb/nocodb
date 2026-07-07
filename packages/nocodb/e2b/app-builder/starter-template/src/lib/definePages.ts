import type { ComponentType } from 'react';

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

/** Identity helper — returns the array as-is; exists for typing + so the
 *  publish scanner can statically find the page manifest. */
export function definePages(pages: AppPage[]): AppPage[] {
  return pages;
}
