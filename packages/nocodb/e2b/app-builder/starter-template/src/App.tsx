// Platform-owned — restored every turn. Never edit: it auto-routes the
// caller's granted pages (useAppPages()) to the component discovered at
// `src/pages/<slug>.tsx`. To add, remove, or reorder pages, use the MCP
// `create_page` / `update_page` / `delete_page` tools — see CLAUDE.md →
// "Routing". Restyle navigation in `src/components/AppNav.tsx` instead.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import type { ComponentType } from "react";
import AppNav from "@/components/AppNav";
import { appBasename, useAppPages } from "@/lib/appShell";

const modules = import.meta.glob("./pages/*.tsx", { eager: true }) as Record<string, { default: ComponentType }>;
const componentForSlug = (slug: string): ComponentType | null => modules[`./pages/${slug}.tsx`]?.default ?? null;
const NotFound = () => <div className="p-8 text-muted-foreground">Page unavailable.</div>;

export default function App() {
  const pages = useAppPages();
  return (
    <BrowserRouter basename={appBasename()}>
      <div className="min-h-screen bg-background text-foreground">
        <AppNav />
        <Routes>
          {pages.map((p) => {
            const C = componentForSlug(p.slug);
            return <Route key={p.id} path={p.path} element={C ? <C /> : <NotFound />} />;
          })}
        </Routes>
      </div>
    </BrowserRouter>
  );
}
