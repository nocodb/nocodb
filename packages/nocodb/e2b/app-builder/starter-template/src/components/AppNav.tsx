// Default navigation — a simple top bar. This file is YOURS: restyle it or
// replace it with a sidebar, tabs, or a drawer when the user asks. Always
// render links from useAppPages() (the caller's granted pages, manifest-
// ordered) — never a hardcoded list.
import { Link, useLocation } from "react-router-dom";
import { useAppPages } from "@/lib/appShell";

export default function AppNav() {
  const location = useLocation();
  const links = useAppPages();

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
