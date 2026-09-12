// YOURS — the app's route table. Edit freely; the platform never overwrites this
// file.
//
// Every entity or section the user named gets its OWN route here and its own
// file in src/pages/, nested under the App.tsx layout so they share its chrome.
// Tabs switch views of one dataset; they are not a substitute for routes. Only a
// genuinely single-purpose tool ("a table of open invoices") stays one screen.
//
// A route is also where a screen is declared PUBLIC — readable by anyone with
// the link, no sign-in — by carrying `handle: { public: { … } }`. Every route
// without it is private. See CLAUDE.md before declaring one.
//
// One rule here is not a style preference: this file imports NOTHING at module
// scope. Screens arrive through `lazy`, whose body the build never runs; a
// top-level `import Index from "@/pages/index"`, or a constant pulled from
// "@/lib/anything", breaks the public-page extraction for the whole app and
// fails the turn. (`import type` is erased and is fine.)
import type { AppRoute } from "@nocodb/app-shell";

export const routes: AppRoute[] = [
  {
    lazy: async () => ({ Component: (await import("@/App")).default }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("@/pages/index")).default }),
      },
    ],
  },
];
