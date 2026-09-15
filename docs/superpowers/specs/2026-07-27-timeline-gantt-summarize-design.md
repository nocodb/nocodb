# Timeline / Gantt "Summarize" — Design Spec

**Date:** 2026-07-27
**Status:** Approved design, pre-implementation
**Scope:** A per-view/per-viz summary bar for the **Timeline** and **Gantt** views, in **both** the native smartsheet views and the interface builder (incl. public shares). Equivalent to Airtable's timeline "Summarize" bottom bar.
**Not in scope:** Calendar view (shares the same model — a trivial future extension), multiple simultaneous summaries, per-record proration.

---

## 1. Feature semantics & data model

A summary is a single **`(calculation field, aggregation function)`** pair per view/viz, gated by field type via the existing `getAvailableAggregations(uidt)` (same function set as the grid summary bar: Sum/Avg/Min/Max/Median/StdDev/Range for numeric; Count/CountEmpty/CountFilled/CountUnique/percent* for any; Checked/Unchecked for boolean; Earliest/Latest/DateRange for date; AttachmentSize for attachment).

### Results computed (one request → three result families)

| Result | Grouping | Rendered as |
|---|---|---|
| Per-bucket | `GROUP BY bucket` | Bottom summary bar — one value under each visible time column |
| Per-group × per-bucket | `GROUP BY group, bucket` | A summary sub-row at the foot of each group's stack, column-aligned |
| Per-group total + grand total | `GROUP BY group` / `GROUP BY ()` | Group header roll-up + overall total |

### Bucketing rule — "every overlapping bucket", full value

- A record's span is `[from_col, COALESCE(to_col, from_col)]`. Records with a null `from` are excluded.
- A record contributes to **every visible bucket its span overlaps**, at its **full value** in each (no proration). e.g. Budget=90 spanning 3 day-columns → each of those 3 days sees 90. "Sum of Budget under a day" = total budget of records active that day ("area under the bar" reading).
- **Consequence (must surface in UI copy so it doesn't read as a bug):** per-bucket values will **not** sum to the grand total, because spanning records are counted in multiple buckets. For avg/min/max the relationship is even less direct. The per-group **total** and grand total are computed over **distinct** records (each counted once), so those are dedup-correct.

### Config schema (persisted — **no migration**, rides in existing `meta` / viz-config JSON)

```ts
// native:    TimelineView.meta.summary  /  GanttView.meta.summary
// interface: InterfaceTimelineVizConfig.summary  /  InterfaceGanttVizConfig.summary
summary?: {
  fk_column_id: string          // "Calculation field"
  aggregation: string           // one of the existing aggregation enums
  label?: 'function' | 'custom' // default 'function'
  custom_label?: string
}
```

Airtable's **Color** and **"Show in"** dropdowns are deferred from v1 ("Show in" is implied: bottom bar + group rows). Both are additive keys on this object later.

---

## 2. Backend

### Endpoints (siblings of the existing data endpoints, same controllers)

- Timeline: `GET /api/v1/db/timeline-summary/:orgs/:baseName/:tableName/views/:viewName` + public `GET /api/v2/public/timeline-view/:uuid/summary`
- Gantt: `GET /api/v1/db/gantt-summary/...` + public variant

**Request params:** `from_date`, `to_date`, `buckets` (JSON array of `{start,end}` — the exact visible column boundaries computed by the client, so all timescale / `two_weeks` / custom logic stays client-side and alignment is guaranteed), `summaryField` (fk_column_id), `summaryFn` (aggregation enum), optional `groupByColId`, plus existing `where` / `filterArrJson`. The record span columns (`from`/`to`) are read **server-side** from the view's `timeline_range` / gantt range config — the client does not send them.

### SQL — two queries, reusing the extracted aggregation expression

**Query A (bucketed — bottom bar + per-group×per-bucket):** client-supplied `buckets` relation via `VALUES`, range-overlap-joined to rows, grouped by bucket (and group col). The overlap join realizes "full value in each overlapping bucket".

```sql
WITH buckets(idx, b_start, b_end) AS (VALUES (0, …, …), (1, …, …), …)   -- from client
SELECT b.idx [, <group_expr> AS grp], <AGG_EXPR(field)> AS val
FROM <table> t
JOIN buckets b
  ON t.from_col <= b.b_end
 AND COALESCE(t.to_col, t.from_col) >= b.b_start
WHERE <window + view filters + RLS>
GROUP BY b.idx [, grp]
```

**Query B (totals — group headers + grand total, dedup):** no bucket join, each record once.

```sql
SELECT [<group_expr> AS grp,] <AGG_EXPR(field)> AS val
FROM <table> t
WHERE <window overlap: from_col <= window_end AND COALESCE(to_col, from_col) >= window_start> + filters + RLS
GROUP BY GROUPING SETS ((grp), ())      -- two plain GROUP BY queries on SQLite (no GROUPING SETS)
```

Use `LEFT JOIN` semantics for Query A so empty buckets return the aggregation's proper empty value (COUNT→0, SUM→0/null, AVG→null) via `formatAggregation`.

### Main refactor

Factor the per-aggregation SQL **expression** out of the existing `GenericAggregationHandler` (+ `pg/mysql/sqlite/mssql/oracle` handlers) so the `AGG_EXPR(field)` fragment can be embedded inside a `GROUP BY`, not only a flat scalar select. **No behavior change to grid aggregation** — guard with targeted `mocha --grep` on the existing aggregation tests.

### Shared helper

All four services (native timeline, native gantt, interface timeline, interface gantt) call one helper — the single source of truth for the SQL:

```ts
buildDateAxisSummary(context, {
  model, fromCol, toCol, groupCol, field, fn, buckets, window, filters, dbDriver
}): Promise<{ buckets: BucketVal[]; groups?: GroupVal[]; grandTotal: unknown }>
```

### Portability & safety

- `VALUES` + range-overlap join is standard across all 5 dialects (Oracle: `SELECT … FROM DUAL UNION ALL`). Buckets bounded (~≤90 cols), window ≤400 rows → tiny join.
- **All execution through the sql-executor `execAndParse` path — never a bare `dbDriver.raw()` await** — because EE external sources use the pool-less DB-mux driver. Single agg selected (not per-field) → avoids the `json_build_object` 100-arg and 512MiB-result traps.
- Filters / RLS / cross-base rules reuse the existing view query-builder.
- Dialect order: PG first, then mysql/sqlite/mssql/oracle.

### Gating

No separate plan gate. Summarize rides on timeline/gantt availability (already EE-only), consistent with grid aggregation.

---

## 3. Native frontend (Timeline + Gantt)

**Control location.** Timeline/gantt suppress the main `Toolbar.vue` and render their own embedded toolbars in `ee/components/smartsheet/timeline/index.vue` and `ee/components/smartsheet/gantt/index.vue`. Add a **"Summarize"** button there opening a popover (Summary function + Calculation field), reusing grid's picker logic (`getAggregations(column)` → `getAvailableAggregations` filtered by the field's type). Extract the panel + picker into **one shared component** `ee/components/smartsheet/summarize/Config.vue`, reused by timeline, gantt, and interface — not copied.

**Rendering (concrete defaults, adjustable):**
- **Bottom bar:** sticky footer row spanning the timeline grid; each cell aligned to a date column using the same geometry that draws the columns (`gridlineOffsets`/`colWidth`/`visibleDates`); value formatted via `getFormattedAggrationValue`. Left header cell shows the label (function name or custom) + the **grand total**.
- **Grouped:** each group header cell shows that group's **total**; a summary sub-row at the foot of each group's stack shows per-group×per-bucket values, same column alignment.

**Store wiring** (`useTimelineViewStore`, `useGanttViewStore`):
- `summaryConfig` (from `view.meta.summary`), `summaryData` (`{ buckets, groups, grandTotal }`).
- `loadSummary()` — calls the endpoint with `bufferStart/bufferEnd`, derived `buckets` boundaries, `summaryField`/`summaryFn`, `groupByColId`, current `where`/filters.
- **Refetch triggers** mirror the row-data triggers: window/zoom pan (existing debounced `bufferStart/bufferEnd` watch), group-by change, filter change, config change — piggyback the same 250ms silent-refetch so the bar stays in lockstep and doesn't flicker on pan.
- `updateSummaryConfig()` persists `summary` into `meta` via the existing `timelineViewUpdate`/`ganttViewUpdate` op.

**States.** No config → button reads "Summarize", no bar. Loading/pan → keep prior values, silent refresh. Server-side compute → values accurate for the **full window** (not capped at the 400 rendered rows).

**Conventions.** `NcDropdown`/`NcSelect`/`NcTooltip`; telemetry `v-e="['c:timeline:summarize:…']"` / `$e`; `data-testid` on button + bar cells; reuse i18n keys where possible.

---

## 4. Interface builder (Timeline + Gantt viz) + public share

**Config (SDK).** Add the same `summary` object to `InterfaceTimelineVizConfig` and `InterfaceGanttVizConfig` in `packages/nocodb-sdk/src/lib/interface/pageConfigs.ts`; rebuild the SDK. Identical shape → shared config panel binds to either.

**Props panel.** Add a "Summarize" section to `ee/components/interface/pages/table/PropsVizTimeline.vue` (the shared date-axis pane covers timeline+gantt), reusing `summarize/Config.vue` bound to the viz config, persisted via `useInterfaceTablePageEditor`.

**Rendering is free.** The interface viz mounts the same `useProvideTimelineViewStore`/`useProvideGanttViewStore` via `VizWrapper`, so the Section 3 bar/group rendering is reused verbatim. Only the fetch branches: `loadSummary()` becomes adapter-aware exactly like `loadTimelineData` already is — native hits REST, interface calls an adapter method.

**Adapter + backend ops.**
- Add `fetchTimelineSummary` / `fetchGanttSummary` to `InterfacePageDataApi` in `packages/nc-gui/lib/interfaceData.ts`, implemented in `useInterfacePageData.ts`.
- New interface-scoped ops `interfaceTableTimelineSummary` / `interfaceTableGanttSummary` in `InterfaceGet.operations.ts` + `interfaceScopedOps.ts` as `{ target: 'page' }`, with service methods in `interface-datas.service.ts`. Must resolve the page's viz config (from/to cols, group col) and honor the same `env` (draft/published), `userFilterTabId`/`userFilterValuesJson`, and `where` resolution as `tableTimelineDataList`, so the summary matches the rendered viz.

**Public share.**
- **Interface:** free — the `{ target: 'page' }` op is routed by the public consumer (`PublicPage.vue` + share uuid/password) automatically, like the existing data-list ops. No extra endpoint, no new auth surface.
- **Native:** the explicit public REST endpoints from §2.

---

## 5. Phasing & risks

**PR breakdown** (vertical-slice-first; **no migrations** anywhere — config in existing JSON):

| Phase | Scope | Packages |
|---|---|---|
| **1 — Foundation** | SDK: `summary` config type + summary request/response DTOs; add `summary` to interface viz configs; rebuild SDK. Backend: extract per-aggregation expression fragment from `GenericAggregationHandler` (+5 dialect handlers), no grid behavior change. | sdk, backend |
| **2 — BE native Timeline** | `buildDateAxisSummary` helper (VALUES buckets + overlap join + dedup totals); timeline summary REST + public endpoint; reads range cols from `TimelineView`. PG → mysql/sqlite/mssql/oracle. `execAndParse` throughout. | backend |
| **3 — FE native Timeline** | Shared `summarize/Config.vue`; store `summaryConfig`/`summaryData`/`loadSummary()`/`updateSummaryConfig()` + refetch triggers; bottom bar + group rows + group totals; toolbar button, telemetry, i18n, testids. | frontend |
| **4 — Native Gantt** | Gantt summary endpoint + public (reuse helper); gantt store wiring; reuse config panel + bar in gantt geometry. | backend, frontend |
| **5 — Interface Timeline + Gantt** | Adapter methods + `{target:'page'}` interface ops + services (reuse helper); Props-panel section; store adapter branch; public share verified. | sdk, backend, frontend |

Phases 1→2→3 yield a working native-timeline summarize end-to-end; 4 and 5 extend it.

**Risks / items the plan must nail:**
1. **Group-key alignment (trickiest).** The server `group_expr` must produce the same group keys the view already groups by client-side — trivial for text/number/single-select, hairy for LTAR/lookup/multi-select. Default: v1 group summaries cover the column types the view already permits grouping on; exotic types degrade to bottom-bar-only (never a wrong number). Pin against the actual grouping code during planning.
2. **Date-only vs datetime + timezone.** Bucket boundaries + overlap comparisons must reuse the timeline's existing date normalization so the bar aligns with the bars.
3. **Empty-bucket semantics.** LEFT-join so empty buckets return the aggregation's proper empty value via `formatAggregation`.
4. **Refactor regressions.** Grid aggregation behavior untouched — targeted `mocha --grep`, not the full suite.
5. **External source (pool-less mux).** Verify against an external PG source specifically.
6. **Overlap-join perf.** Bounded (~≤90 buckets × ≤400 rows) but sanity-check the widest zoom on a dense table.

**Testing posture.** Per standing preference, no tests written during implementation unless requested; verification via the local-verify-branch flow + the targeted mocha regression check for Phase 1.

---

## Key file map (reference)

- **SDK:** `packages/nocodb-sdk/src/lib/aggregationHelper.ts` (enums, `getAvailableAggregations`, `formatAggregation`), `aggregationCompute.ts`, `interface/pageConfigs.ts`
- **Backend agg SQL:** `packages/nocodb/src/dbQueryClient/aggregations/handlers/{generic,pg,mysql,sqlite,mssql,oracle}.ts`, `cross-db-utils/aggregate.ts`
- **Backend native data endpoints (siblings to add summary):** `packages/nocodb/src/ee/controllers/timelines-datas.controller.ts`, gantt equivalent; services `ee/services/timeline-datas.service.ts`, `gantt-datas.service.ts`
- **Backend view models / meta:** `packages/nocodb/src/ee/models/TimelineView.ts`, `GanttView.ts` (tables `nc_timeline_view_v2`, `nc_gantt_view_v2`, each with `meta` JSON); update ops `timelineViewUpdate`/`ganttViewUpdate` in `controllers/internal/modules/UiPost.operations.ts`
- **Backend interface:** `ee/services/interfaces/interface-datas.service.ts`, `ee/controllers/internal/modules/InterfaceGet.operations.ts`, `ee/controllers/internal/interfaceScopedOps.ts`
- **Frontend native:** `ee/composables/useTimelineViewStore.ts`, `useGanttViewStore.ts`; `ee/components/smartsheet/timeline/index.vue`, `gantt/index.vue`; grid reference `components/smartsheet/grid/Aggregation.vue`, `composables/useViewAggregate.ts`, `utils/aggregationUtils.ts`
- **Frontend interface:** `ee/components/interface/pages/table/VizWrapper.vue`, `PropsVizTimeline.vue`; adapter `lib/interfaceData.ts`, `composables/useInterfacePageData.ts`
