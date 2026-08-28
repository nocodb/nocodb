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

export interface FormulaPlan {
  refs: Map<string, RefDescriptor>;
  /** Σ over reference SITES — what the inline emitter produces today */
  inlineLeafPaths: number;
  /** Σ with every hoistable column's subtree counted once, recursively */
  hoistedLeafPaths: number;
  estimatedInlineBytes: number;
  estimatedHoistedBytes: number;
  hoistable: string[];
  /** post-hoist estimate still exceeds the generated-SQL cap */
  stillOverCap: boolean;
  /** the wholesale gate: over threshold AND something to hoist */
  shouldHoist: boolean;
}
