// Platform-owned — restored every turn. Never edit: it auto-routes the caller's
// granted pages (useAppPages()) to the component at src/pages/<slug>.tsx and
// renders the fixed navigation sidebar (AppSidebar). To add/remove/reorder
// pages use the MCP create_page / update_page / delete_page tools — see
// CLAUDE.md → "Routing".
import { BrowserRouter, Routes, Route } from "react-router-dom";
import type { ComponentType } from "react";
import AppSidebar from "@/components/AppSidebar";
import { appBasename, useAppPages } from "@/lib/appShell";

const modules = import.meta.glob("./pages/*.tsx", { eager: true }) as Record<string, { default: ComponentType }>;
const componentForSlug = (slug: string): ComponentType | null => modules[`./pages/${slug}.tsx`]?.default ?? null;
const NotFound = () => <div className="p-8 text-muted-foreground">Page unavailable.</div>;

export default function App() {
  const pages = useAppPages();
  return (
    <BrowserRouter basename={appBasename()}>
      <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Routes>
            {pages.map((p) => {
              const C = componentForSlug(p.slug);
              return <Route key={p.id} path={p.path} element={C ? <C /> : <NotFound />} />;
            })}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
