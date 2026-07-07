// This file is YOURS to restyle — swap the top nav for a sidebar, add a
// layout, nest routes. Two rules keep routing and access control intact (see
// CLAUDE.md → Routing): derive every route from the `pages` manifest (each
// page mounted at its `path`), and keep `basename={appBasename()}` on the
// router. Page access is enforced inside the manifest itself — a non-granted
// page renders "Page unavailable" however it's reached — so custom layouts
// never need their own access checks.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppNav from "@/components/AppNav";
import { appBasename } from "@/lib/appShell";
import { pages } from "@/pages";

export default function App() {
  return (
    <BrowserRouter basename={appBasename()}>
      <div className="min-h-screen bg-background text-foreground">
        <AppNav />
        <Routes>
          {pages.map((p) => (
            <Route key={p.id} path={p.path} element={<p.component />} />
          ))}
        </Routes>
      </div>
    </BrowserRouter>
  );
}
