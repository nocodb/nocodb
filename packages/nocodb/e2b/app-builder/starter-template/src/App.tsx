import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
