import { HashRouter, Routes, Route, NavLink } from "react-router-dom";
import { Sparkles, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Home from "@/pages/Home";
import About from "@/pages/About";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "text-sm font-medium transition-colors hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground"
        )
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Header / Nav */}
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-6xl flex h-14 items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="font-semibold tracking-tight text-sm">Starter</span>
            </div>
            <nav className="flex items-center gap-6">
              <NavItem to="/">Home</NavItem>
              <NavItem to="/about">About</NavItem>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
                <Sparkles className="size-3" />
              </span>
              Starter App — a clean foundation.
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-4" />
            <p className="text-xs text-muted-foreground">
              Built with Vite · React 19 · shadcn/ui · Tailwind CSS v4
            </p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
}
