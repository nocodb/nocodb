// Platform-owned — restored every turn. Never edit. Renders the fixed app
// navigation (the caller's granted pages from useAppPages()) + app identity +
// the viewer, themed via the shadcn --sidebar* tokens so it re-skins with the
// app's Settings→Theme preset. Build page content in src/pages/<slug>.tsx;
// navigation is not app code.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAppMeta, useAppPages, useAppUser } from "@/lib/appShell";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pages = useAppPages();
  const user = useAppUser();
  const meta = useAppMeta();
  const location = useLocation();

  // Render the icon as a literal glyph ONLY when it looks like one. The platform
  // may store meta.icon as a named icon key (e.g. "ncApp") that this sandboxed
  // app can't resolve — in that case fall back to the app title's initial.
  const glyph =
    meta.icon && [...meta.icon].length <= 2 && !/[a-z]/i.test(meta.icon)
      ? meta.icon
      : null;

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
          {glyph ? <span>{glyph}</span> : (meta.title?.[0]?.toUpperCase() ?? "A")}
        </div>
        <span className="truncate text-sm font-semibold">{meta.title ?? "App"}</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {pages.map((p) => {
          const active = location.pathname === p.path;
          return (
            <Link
              key={p.id}
              to={p.path}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              {p.title}
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-sidebar-border px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials(user.displayName ?? "")}
          </div>
          <span className="truncate text-sm">{user.displayName ?? "Signed in"}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function AppSidebar() {
  const pages = useAppPages();
  const meta = useAppMeta();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Single-page apps get no chrome — the tool stays full-width.
  if (pages.length <= 1) return null;

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border md:flex">
        <SidebarBody />
      </aside>

      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <button aria-label="Open navigation" onClick={() => setOpen(true)} className="-ml-1 p-1">
          <Menu className="h-5 w-5" />
        </button>
        <span className="truncate text-sm font-semibold">{meta.title ?? "App"}</span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            <button
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 p-1 text-sidebar-foreground/70"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
