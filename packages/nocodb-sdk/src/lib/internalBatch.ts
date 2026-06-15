/**
 * Shared configuration for the `/api/v2/internal/{workspaceId}/{baseId}`
 * `batch` envelope. Both the backend (which enforces the cap and dispatches
 * sub-ops) and the frontend (which decides what to coalesce) read from
 * here so neither side drifts out of sync.
 */

/**
 * Hard cap on sub-ops per request. Keep this small enough that one slow
 * sub-op can't hold the batch hostage for long, and large enough that
 * the common page-load fan-outs fit in a single round-trip (dashboards
 * with ~16 widgets, view-mount metadata with ~5 ops).
 */
export const INTERNAL_BATCH_MAX_SIZE = 25;

/**
 * Internal operations the frontend coalesces into a `batch` envelope by
 * default. Membership is a frontend hint — the backend doesn't enforce
 * this list; it just runs whatever sub-ops the batch carries. Defined
 * here so adding a new operation in one place (the operations module)
 * can pair it with batchability metadata without touching the SDK
 * monkey-patch / wire-level concerns.
 *
 * Inclusion criteria:
 *   • Read-only (no writes, mutations, or creates).
 *   • Frequently fires alongside siblings within ~50ms (a "fan-out").
 *   • Small response payload (a batch with many heavy responses can
 *     balloon a single HTTP request beyond reasonable limits).
 *   • Not gating first-paint UX — adding ~50ms of debounce should be
 *     invisible.
 *
 * Deliberately excluded categories — `tableGet`, `baseGet`, `tableList`
 * (navigation-critical, want immediate dispatch), `bulkAggregate`
 * (heavy responses), and anything that mutates state.
 */
export const BATCHABLE_INTERNAL_OPERATIONS: ReadonlySet<string> = new Set([
  // View metadata fan-out (5+ calls on every view mount)
  'viewColumnList',
  'filterList',
  'filterChildrenList',
  'sortList',
  'viewRowColorInfo',
  'viewList',
  'viewSectionList',

  // Sibling filter lists fired alongside the above
  'buttonFilterList',
  'linkFilterList',
  'widgetFilterList',
  'hookFilterList',
  'rlsPolicyFilterList',

  // View-type detail reads — one of these fires on view mount.
  // Gallery/Kanban/Calendar live in their own REST controllers
  // (controllers/galleries.controller.ts etc.) and aren't reachable via
  // the internal API. Timeline is also REST-only today — no internal
  // dispatcher and no frontend caller — so it's deliberately excluded
  // until/unless it migrates to UiGet.operations.ts. Form / Map have
  // inline switch cases in UiGet so both batched and non-batched dispatch
  // resolve to the same service call.
  'formViewGet',
  'mapViewGet',

  // Dashboard widgets fan-out (16+ calls on dashboard mount)
  'widgetDataGet',
  'widgetList',
  'widgetGet',
  'dashboardGet',

  // Per-row reads that fan out across a visible viewport
  'commentCount',
  'recordAuditList',

  // Schema-hash polling — useGridViewData / useMultiSelect / Fields.vue /
  // useCopyPaste / usePredictFields all poll this independently
  'columnsHash',

  // Aggregate fan-out: one per field with an aggregation configured.
  // `bulkAggregate` is *not* batched — its responses can be too large.
  'dataAggregate',

  // Base-load reads that coincide with other base-load fetches
  'baseVariableList',
  'extensionList',
  'tableSyncList',
  'listScripts',
  'dashboardList',
  'workflowList',
  'listSync',
]);
