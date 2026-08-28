/**
 * Calibrated against the base reported in #10194: the 500 KB cap is crossed
 * between 77 and 78 leaf paths (77 × 6494 ≈ 500 000), so ~6.5 KB of generated
 * SQL per referenced field. One datapoint — the existing cap check remains the
 * backstop for bases where this underestimates.
 */
export const BYTES_PER_LEAF_PATH = 6500;

export const MAX_GENERATED_SQL_BYTES = 500 * 1000;

/**
 * Hoist only above this many inline leaf paths (~260 KB estimated). Well below
 * the ~77-path cap cliff, well above ordinary formulas — under it, emitted SQL
 * is byte-identical to today's.
 */
export const HOIST_ABOVE_LEAF_PATHS = process.env
  .NC_FORMULA_CTE_HOIST_THRESHOLD
  ? +process.env.NC_FORMULA_CTE_HOIST_THRESHOLD
  : 40;

export const estimateBytes = (leafPaths: number) =>
  leafPaths * BYTES_PER_LEAF_PATH;
