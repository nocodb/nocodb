// ⚠️ THE PAGE MANIFEST — the platform scans this exact `definePages([...])` call to
// build routing, navigation, and PER-PAGE ACCESS CONTROL. Keep it a single
// `definePages([...])` with one object per page (string-literal `id`, `path`, `title`,
// a `component`, and its `routines`). To add/remove/reorder pages, edit ONLY this array.
// NEVER turn this into a plain array, drop `definePages`, or drop `id`/`component` — and
// never hand-write <Route>s in App.tsx. Doing so ships an app with no nav and no access
// control. See CLAUDE.md → "Routing — the definePages manifest is MANDATORY".
import { definePages } from '@/lib/definePages';
import Home from '@/pages/Home';

export const pages = definePages([
  { id: 'home', path: '/', title: 'Home', component: Home, routines: [] },
]);
