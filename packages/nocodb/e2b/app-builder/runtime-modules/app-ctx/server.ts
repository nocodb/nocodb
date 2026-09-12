/**
 * @nocodb/app-ctx/server — the authoring surface for app actions. Compiled at
 * image-build into /opt/app-ctx/server.js and copied into every built app's
 * node_modules, so app code writes
 * `import { defineAction, z } from '@nocodb/app-ctx/server'`.
 *
 * RULE 0 — ONE ZOD INSTANCE. `z` is re-exported from the `zod/v4` subpath, NOT bare
 * `zod`. Apps must import it from here and never depend on zod directly, so the
 * schema an app authors is validated by the exact zod the runtime runs. The
 * platform stays on classic zod (v3), which is NOT interoperable with v4, and
 * nothing carries a v4 schema object into platform code (they cross as JSON Schema).
 *
 * The public type surface lives in server.d.ts, copied verbatim from
 * `contract-app-actions.ts` §2-§3.
 */

export { z } from 'zod/v4';

import type { z as zt } from 'zod/v4';
import type { ActionDecl } from './server.d';

/**
 * Identity function at runtime — its whole job is inferring `TIn`/`TOut` at the
 * call site so `run`'s parameters and return type are checked while authoring.
 * Enforcement (capability check, input validation, audit) happens on the
 * platform at dispatch, before `run()` is ever reached — never here.
 */
export function defineAction<
  TIn extends zt.ZodTypeAny,
  TOut extends zt.ZodTypeAny,
>(decl: ActionDecl<TIn, TOut>): ActionDecl<TIn, TOut> {
  return decl;
}
