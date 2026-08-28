import type { ParsedFormulaNode, UITypes } from 'nocodb-sdk';
import type { DuplicatingSite } from './duplication';
import type {
  FnHandlerKey,
  FnSitePath,
  FnVariant,
} from '~/db/formulav2/fn-handler';

export type HoistStrategy = 'inline' | 'cte-aggregate';

/**
 * `apply` — the gate should carry this out on the rebuild.
 * `unavailable` — the plan can see what would help but nothing implements it.
 * Explanation only, and the entry the fix flips when its variant lands.
 */
export type OptimizationStatus = 'apply' | 'unavailable';

/** Write each hoistable target's body once and reference it. */
export interface CteHoistOptimization {
  kind: 'cte-hoist';
  status: OptimizationStatus;
  /** block keys — same list as `FormulaPlan.hoistable` */
  targets: string[];
  reason: string;
}

/**
 * Emit a different lowering for specific occurrences of one registered
 * function/operator — not for the operator as a whole. `a/b/c/d` and a stray
 * `x/2` in the same formula are separate sites with separate costs, and only
 * the chain is worth rewriting.
 */
export interface FnVariantOptimization {
  kind: 'fn-variant';
  status: OptimizationStatus;
  key: FnHandlerKey;
  /**
   * The occurrences this entry covers, as parsed-tree paths (`$.left.right`).
   * The gate resolves them back to nodes of the tree the plan was built from
   * and pins `variant` onto those and nothing else.
   */
  sites: FnSitePath[];
  /** absent while `unavailable` — no variant is registered to switch to */
  variant?: FnVariant;
  reason: string;
}

export type FnOptimization = CteHoistOptimization | FnVariantOptimization;

/**
 * What the plan decided about one node, carried on that node. Present exactly
 * when the plan had something to say — most nodes have none.
 *
 * This is what makes the decision and the tree one thing: a node and its
 * verdict cannot be paired up wrongly, because they are the same object. The
 * emitter reads `variant` off the node it is lowering and needs nothing else.
 */
export type NodeOptimization =
  | {
      kind: 'fn-variant';
      path: FnSitePath;
      status: OptimizationStatus;
      key: FnHandlerKey;
      /** the lowering to emit here; absent while `unavailable` */
      variant?: FnVariant;
      /** copies of this node's own SQL the statement carries */
      weight: number;
      /** copies it makes of its most-repeated operand */
      multiplicity: number;
      /** duplicating sites enclosing it, itself included */
      chainDepth: number;
    }
  | {
      kind: 'cte-hoist';
      path: FnSitePath;
      status: OptimizationStatus;
      columnId: string;
      strategy: HoistStrategy;
      /** why this reference is not hoistable, when it is not */
      ineligibleReason?: string;
    };

/**
 * A parsed tree and everything known about it. The builder takes one of these
 * instead of a bare tree: with the decisions living on the nodes they concern,
 * there is no second argument that has to agree with the first.
 *
 * `plan` is absent for the builds that never had one — the first build (the
 * plan is derived from its measured SQL) and every referenced column's build.
 * Those pass `{ parsedTree }` and behave exactly as a bare tree did.
 *
 * JSON-serializable throughout: `plan.refs` is a plain record here, not the
 * `Map` the planner returns.
 */
export interface FormulaPayload {
  parsedTree?: ParsedFormulaNode;
  plan?: Omit<FormulaPlan, 'refs'> & { refs: Record<string, RefDescriptor> };
}

/**
 * Column metadata the planner needs, decoupled from the model layer so the
 * plan is pure and unit-testable. Production supplies a resolver backed by
 * Column/LookupColumn; tests supply a map.
 */
export interface PlanColumnMeta {
  uidt: UITypes;
  /** relation.type !== ONE_TO_ONE — the reference needs an aggregate */
  isArray?: boolean;
  /** per-lookup sort/limit configured (EE, pg-only) — diagnostic only */
  hasSortLimitConfig?: boolean;
  /** lookup/rollup: the column at the other end of the relation */
  targetColumnId?: string;
  /** formula: its parsed tree */
  formulaTree?: unknown;
  /**
   * formula: its model has a usable primary key. `hoistFormulaLookup` bails
   * without one (no key to match the block on), so the plan must too or it
   * would promise a block the emitter declines to write. Undefined is treated
   * as present — only an explicit `false` blocks hoisting.
   */
  hasPrimaryKey?: boolean;
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
  /**
   * Block keys the emitter will write — terminal formula column ids, at every
   * depth, not just top-level reference sites. One entry per `nc_lk_` alias in
   * the rebuilt SQL, so it can be asserted against the emitted query.
   */
  hoistable: string[];
  /** ratio clears MIN_HOIST_RATIO and there is something to hoist */
  worthHoisting: boolean;

  // ---- operand duplication (detection only; nothing acts on it yet) ----

  /**
   * `inlineLeafPaths` with every site weighted by how many times the emitter
   * writes it — see `duplication.ts`. Equal to `inlineLeafPaths` whenever no
   * lowering duplicates an operand, which is every non-pg and non-IEEE build.
   */
  emittedLeafPaths: number;
  /**
   * emittedLeafPaths / inlineLeafPaths. 1 means the expression is as large as
   * its reference count implies; 64 means duplication made it 64× that.
   */
  duplicationFactor: number;
  /** duplicating sites, heaviest contribution first */
  duplicatingSites: DuplicatingSite[];
  /**
   * Longest nested run of duplicating sites in the ROOT tree — the shape that
   * turns growth exponential. Duplication inside a referenced formula still
   * counts toward `duplicationFactor`, but not toward this.
   */
  maxDuplicationChain: number;
  /**
   * Duplication, not reference fan-out, is what makes this query large:
   * the factor clears DUPLICATION_DOMINANT_FACTOR and beats what hoisting
   * could recover. Hoisting cannot fix these — the fix has to change how the
   * duplicating operand is emitted.
   */
  duplicationDominant: boolean;

  /**
   * What to do about the above, and why — the plan's decision surface. The gate
   * carries out the `apply` entries and reports the rest; nothing else in the
   * emitter decides anything, so a build's strategy is inspectable as data
   * before it runs. Derived entirely from the fields above: adding an entry kind
   * never changes what those fields mean.
   */
  optimizations: FnOptimization[];
}
