// YOURS — the app's root LAYOUT. Edit freely; the platform never overwrites this
// file.
//
// Chrome every screen shares lives here — a sidebar you write, or a header with
// NavLinks — wrapped around the <Outlet/> where the routed screen renders. Which
// screens exist, and at which paths, is src/routes.ts.
//
// The router, the react-query provider and the error boundary are already
// mounted above this component in main.tsx — don't add your own.
import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* your nav goes here — it wraps every screen */}
      <Outlet />
      <Toaster />
    </div>
  );
}
