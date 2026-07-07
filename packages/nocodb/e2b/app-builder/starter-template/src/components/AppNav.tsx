import { Link, useLocation } from "react-router-dom";
import { pages } from "@/pages";

export default function AppNav() {
  const location = useLocation();

  // Live (published) apps only ever see the pages the server granted for the
  // current caller — window.__nc_app_pages__ is pre-filtered server-side and
  // omits routines. Dev/preview has no server gate, so it falls back to the
  // full local manifest.
  const isLive = window.__nc_app_live__ === true;
  const links = isLive
    ? window.__nc_app_pages__ ?? []
    : pages.map((p) => ({ id: p.id, path: p.path, title: p.title }));

  if (links.length <= 1) return null;

  return (
    <nav className="border-b bg-background px-6 py-3 flex items-center gap-4">
      {links.map((link) => (
        <Link
          key={link.id}
          to={link.path}
          className={
            location.pathname === link.path
              ? "text-sm font-medium text-foreground"
              : "text-sm font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {link.title}
        </Link>
      ))}
    </nav>
  );
}
