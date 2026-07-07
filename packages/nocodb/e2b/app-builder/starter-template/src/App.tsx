import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

// The platform serves this bundle under different path prefixes — the app's own
// domain root when published, a deeper path in the builder preview — and injects
// that prefix as window.__nc_app_base__. Use it as the router basename so history
// routes (real, shareable URLs) resolve in both. Trailing slash stripped because
// react-router expects a basename without one.
const basename = (window.__nc_app_base__ ?? "/").replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
