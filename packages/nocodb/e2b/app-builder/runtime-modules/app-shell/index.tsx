// The platform's mount seam, as a package.
//
// Everything here used to live in the app's own src/ and be re-copied over the
// app on every turn. That made it three things at once: code the app could
// break, a diff in every app whenever the platform changed, and a file the
// platform could never retire. As a package it is none of them — it arrives in
// node_modules, which is gitignored, so a platform fix reaches every app with no
// commit at all.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '@nocodb/app-ctx/react';
import AppAgent from './AppAgent';
import AppErrorBoundary from './AppErrorBoundary';
import { AgentInsetShell } from './agentShell';
import { appBasename, mountRoutes, type AppRoute } from './appShell';

export type {
  AppMeta,
  AppRoute,
  AppRouteHandle,
  PublicPage,
} from './appShell';
export { appBasename, useAppMeta } from './appShell';
export { AGENT_PANE_WIDTH } from './agentShell';

/**
 * Mount the app. Call once, from `src/main.tsx`, with the app's route table.
 *
 * What it puts above the routes, and why the app cannot be trusted to do it:
 *
 *  - AppErrorBoundary  a render crash shows a card instead of a white screen,
 *                      and is reported back to the builder.
 *  - AppDataProvider   the react-query client the action hooks read from —
 *                      without it every useActionQuery throws.
 *  - the data router    over the app's own route table, with the PLATFORM's
 *                      basename. The published app is served at "/" but the
 *                      builder preview is served under a deeper path, so a
 *                      hardcoded basename works in exactly one of the two.
 *  - AppAgent          the in-app assistant. Renders nothing unless the console
 *                      enabled one AND this caller's team is allowed it, both
 *                      decided server-side. Mounted outside the router, so it
 *                      survives every navigation the app makes.
 *  - AgentInsetShell   pads the app while the assistant is DOCKED, so the pane
 *                      reflows the app instead of covering it. Inert in every
 *                      other state, and invisible to the app.
 *
 * Everything above the routes is fixed; the routes are `src/routes.ts` and the
 * layout they render inside is `src/App.tsx`, both yours. There is no platform
 * navigation, no page registry, and no required layout — see CLAUDE.md.
 */
export function mountApp(routes: AppRoute[], rootId = 'root'): void {
  const rootElement = document.getElementById(rootId);
  if (!rootElement) throw new Error(`Root element "#${rootId}" not found`);

  const router = createBrowserRouter(mountRoutes(routes), {
    basename: appBasename(),
  });

  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <AppDataProvider>
          <AgentInsetShell>
            <RouterProvider router={router} />
          </AgentInsetShell>
          <AppAgent />
        </AppDataProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );
}
