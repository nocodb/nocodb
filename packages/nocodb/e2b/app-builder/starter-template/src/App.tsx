// ⚠️ GENERATED ROUTER SHELL — do NOT edit. Routes + nav are derived from the
// `definePages([...])` manifest in src/pages.ts, which the platform also scans for
// per-page access control. To change pages, edit src/pages.ts — NEVER hand-write
// <Route>s here or replace this with your own routing. See CLAUDE.md → Routing.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppNav from "@/components/AppNav";
import { pages } from "@/pages";

// The platform serves this bundle under different path prefixes — the app's own
// domain root when published, a deeper path in the builder preview — and injects
// that prefix as window.__nc_app_base__. Use it as the router basename so history
// routes (real, shareable URLs) resolve in both. Trailing slash stripped because
// react-router expects a basename without one.
const basename = (window.__nc_app_base__ ?? "/").replace(/\/$/, "") || "/";

// A published app must honor the per-caller page grants. The bundle ships EVERY
// page, so without a guard here a page whose nav link is hidden still renders on
// in-app navigation (client-side routing never re-hits the server). When live,
// window.__nc_app_pages__ is the set of pages this caller may view, filtered
// server-side; render only those, and show "unavailable" for the rest — the same
// filter AppNav applies to links. Dev/preview has no server gate
// (__nc_app_live__ !== true) → every page is viewable. This is a UX guard, not
// the security boundary: the server still gates the initial document and every
// routine invoke.
const isLive = window.__nc_app_live__ === true;
const grantedPageIds = isLive
  ? new Set((window.__nc_app_pages__ ?? []).map((p) => p.id))
  : null; // null → no gate (dev/preview): every page viewable

function isPageViewable(id: string): boolean {
  return grantedPageIds === null || grantedPageIds.has(id);
}

function PageUnavailable() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-semibold text-foreground">Page unavailable</p>
      <p className="text-sm text-muted-foreground">
        You don&apos;t have access to this page.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="min-h-screen bg-background text-foreground">
        <AppNav />
        <Routes>
          {pages.map((p) => (
            <Route
              key={p.id}
              path={p.path}
              element={
                isPageViewable(p.id) ? <p.component /> : <PageUnavailable />
              }
            />
          ))}
        </Routes>
      </div>
    </BrowserRouter>
  );
}
