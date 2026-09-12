// Platform-owned — restored every turn. Never edit.
//
// The facts about its own hosting that an app cannot derive for itself, plus the
// types and the seam the platform reads the app's route table through.
// Everything else about the caller — identity, teams, capabilities, actions —
// comes from `ctx` in `@nocodb/app-ctx`; this module deliberately does not
// mirror any of it, so there is exactly one answer to "who is calling".
import type {
  IndexRouteObject,
  NonIndexRouteObject,
  RouteObject,
} from 'react-router-dom';
import { RouteErrorBoundary } from './AppErrorBoundary';

/**
 * Router basename — the platform-injected path prefix ("/" on the published
 * domain, a deeper path in the builder preview). `main.tsx` already passes this
 * to `createBrowserRouter`; an app that mounts its own router must pass it too,
 * or routing works in exactly one of the two contexts.
 */
export function appBasename(): string {
  return (window.__nc_app_base__ ?? '/').replace(/\/$/, '') || '/';
}

declare global {
  interface Window {
    /**
     * Path prefix the platform serves this app under, injected at serve time.
     * "/" on the published domain root; a deeper path in the builder preview.
     */
    __nc_app_base__?: string;
    /** App identity as set in the console, injected at serve time. */
    __nc_app_meta__?: AppMeta;
  }
}

export interface AppMeta {
  title?: string;
  icon?: string;
}

/**
 * App identity (title + optional icon) as set in the console, for whatever
 * header or nav the app chooses to build. Falls back to the document title for
 * a pure local `vite dev` where nothing is injected.
 */
export function useAppMeta(): AppMeta {
  const injected = window.__nc_app_meta__;
  if (injected && (injected.title || injected.icon)) return injected;
  return { title: document.title || undefined };
}

/**
 * A route's public declaration. Present ⇒ this route is served to ANONYMOUS
 * visitors: no session, no cookie, no `ctx.user`.
 *
 * CLOSED on purpose — no index signature. That is what makes a misspelt key a
 * compile error instead of a silently ignored one, on the one object in this
 * app where a typo changes who can read a page.
 */
export interface PublicPage {
  /** Publish the whole subtree under this route (`/docs` ⇒ `/docs/*`), not just the exact path. */
  subtree?: boolean;
  /** `<title>` and `og:title`. Falls back to the app title. */
  title?: string;
  /** `<meta name="description">` and `og:description`. */
  description?: string;
  /** Bundle-relative image path — `assets/og.png`. NEVER an absolute URL. */
  og_image?: string;
  /** Exact https origins allowed to iframe the ANONYMOUS serve of this route. */
  embed_origins?: string[];
}

/**
 * What the platform reads off a route's `handle`. Also closed: in this app
 * `handle` is the platform's, and route metadata of your own belongs in the
 * component.
 */
export interface AppRouteHandle {
  public?: true | PublicPage;
}

/**
 * A route in `src/routes.ts`. Exactly react-router's own `RouteObject` with one
 * field narrowed: `handle`.
 *
 * react-router types `handle?: any` in library mode (verified against 7.18.2,
 * `dist/development/data-*.d.ts:767`; the framework-mode `RouteHandle` is
 * `unknown` and is not publicly exported, so there is nothing to augment). `any`
 * means `handle: { publik: {…} }` and `embed_origins` spelt `embedOrigins` both
 * compile and both silently change what is published. So the registry is typed
 * with THIS, never with `RouteObject[]`.
 */
export type AppRoute =
  | (Omit<IndexRouteObject, 'handle'> & { handle?: AppRouteHandle })
  | (Omit<NonIndexRouteObject, 'handle' | 'children'> & {
      handle?: AppRouteHandle;
      children?: AppRoute[];
    });

/**
 * The app's route table, ready for `createBrowserRouter`. A data router catches
 * a render error into its own boundary, so the `AppErrorBoundary` mounted above
 * the router never sees a route crash and the builder is never told about it —
 * this puts the platform's route-level boundary on every top-level route that
 * has not declared one. Applied in `main.tsx`, after `routes.ts` is read, so an
 * app cannot drop it.
 */
export function mountRoutes(routes: AppRoute[]): RouteObject[] {
  return routes.map((route) =>
    route.ErrorBoundary || route.errorElement
      ? route
      : { ...route, ErrorBoundary: RouteErrorBoundary },
  );
}

// The narrowing above is the only thing standing between a typo and a page that
// silently changes who can read it, so it is asserted rather than trusted: a
// react-router bump that widens `handle` back out leaves these directives with
// nothing to suppress, which is itself an error and fails the build.
const _appRouteNarrowing: AppRoute[] = [
  // @ts-expect-error the flag itself must be spelt `public`
  { path: 'a', handle: { publik: {} } },
  // @ts-expect-error PublicPage keys are snake_case
  { path: 'b', handle: { public: { embedOrigins: ['https://acme.com'] } } },
  // @ts-expect-error `subtree` is a boolean, and nothing is coerced
  { path: 'c', handle: { public: { subtree: 'yes' } } },
  // @ts-expect-error nested routes are checked identically to top-level ones
  { children: [{ path: 'd', handle: { public: { titel: 'x' } } }] },
];
