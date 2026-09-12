// Platform-owned — restored every turn. Never edit.
//
// The whole seam: hand the platform your route table, it mounts everything that
// has to sit above your routes (error boundary, the react-query provider the
// action hooks read from, the router with the platform's basename, the in-app
// assistant). What it does and why is documented on `mountApp`.
//
// The routes are src/routes.ts and the layout they render inside is src/App.tsx,
// both yours. There is no platform navigation, no page registry, and no required
// layout — see CLAUDE.md.
import { mountApp } from "@nocodb/app-shell";
import "./index.css";
import { routes } from "@/routes";

mountApp(routes);
