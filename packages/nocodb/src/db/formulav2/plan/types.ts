import type { UITypes } from 'nocodb-sdk';

export type HoistStrategy = 'inline' | 'cte-aggregate' | 'cte-window';

/**
 * Column metadata the planner needs, decoupled from the model layer so the
 * plan is pure and unit-testable. Production supplies a resolver backed by
 * Column/LookupColumn; tests supply a map.
 */
export interface PlanColumnMeta {
  uidt: UITypes;
  /** relation.type !== ONE_TO_ONE — the reference needs an aggregate */
  isArray?: boolean;
  /** per-lookup sort/limit configured (EE, pg-only) → cte-window */
  hasSortLimitConfig?: boolean;
  /** lookup/rollup: the column at the other end of the relation */
  targetColumnId?: string;
  /** formula: its parsed tree */
  formulaTree?: unknown;
}

export type PlanMetaResolver = (
  columnId: string,
) => Promise<PlanColumnMeta | undefined>;

export interface RefDescriptor {
  columnId: string;
  uidt: UITypes;
  /** occurrences in the root tree */
  siteCount: number;
  isArray: boolean;
  hasSortLimitConfig: boolean;
  /** lookup hops until a non-lookup column */
  depth: number;
  /** paths through this ref's subtree (one site's worth) */
  leafPaths: number;
  strategy: HoistStrategy;
  ineligibleReason?: string;
}

/**
 * Structural advice only. Deliberately carries no byte figures: per-leaf-path
 * SQL size varies ~97× between schemas, so bytes come from measuring the built
 * query (formulaQueryBuilderv2 already does), never from the plan.
 */
export interface FormulaPlan {
  refs: Map<string, RefDescriptor>;
  /** Σ over reference SITES — what the inline emitter produces today */
  inlineLeafPaths: number;
  /** Σ with every hoistable column's subtree counted once, recursively */
  hoistedLeafPaths: number;
  /** inlineLeafPaths / hoistedLeafPaths — 1 means hoisting changes nothing */
  reductionRatio: number;
  hoistable: string[];
  /** ratio clears MIN_HOIST_RATIO and there is something to hoist */
  worthHoisting: boolean;
}
