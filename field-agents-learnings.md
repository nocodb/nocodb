# Field Agents — Agent Learnings & Resurrection Guide

Use this document to onboard a new agent to continue work on the Field Agents feature.

---

## Repository Context

This is `nocohub` — the **enterprise/proprietary** NocoDB repo (NOT open-source `nocodb`). It's a monorepo:

```
packages/
  nocodb-sdk/     → TypeScript types + API client (build first after type changes!)
  nocodb/         → NestJS backend (port 8080)
  nc-gui/         → Vue 3 / Nuxt 3 frontend (port 3000)
```

**Build order matters:** `nocodb-sdk → nocodb → nc-gui`. After SDK changes, always rebuild: `cd packages/nocodb-sdk && pnpm run build:ee`

**EE code lives in `ee/` subdirectories** that mirror the CE structure. CE code must never import from EE.

---

## Codebase Patterns You Must Know

### 1. `useNocoAi` is a Shared Singleton

```typescript
export const useNocoAi = createSharedComposable(() => { ... })
```

This means there's ONE instance across the entire app. Any ref you add here is global state. This is where field agent dirty tracking lives because it needs to be accessed from both the toolbar (FieldAgentMenu) and the data composables (useData, useInfiniteData, useGridViewData).

### 2. Canvas Grid vs Non-Canvas Grid

NocoDB has TWO rendering paths:
- **Canvas grid** (default, performance-focused) — Uses `useInfiniteData.ts`, custom canvas renderers in `components/smartsheet/grid/canvas/cells/`, and `ActionManager.ts` for async operations
- **Non-canvas grid** (legacy) — Uses `useData.ts` and Vue components for cells

Most users are on canvas grid. If something works in testing but not in production, check if you hooked into the right composable.

### 3. Three Cell Update Paths

This was a hard-won discovery. Cell edits flow through three different composables:

| Path | Composable | When Used |
|------|-----------|-----------|
| Single cell edit (canvas) | `useInfiniteData.ts` → `updateRowProperty()` | User edits one cell in canvas grid |
| Single cell edit (non-canvas) | `useData.ts` → `updateRowProperty()` | User edits one cell in legacy grid |
| Bulk paste/update | `useGridViewData.ts` → `bulkUpdateRows()` / `bulkUpsertRows()` | User pastes data or bulk-edits |

All three need identical hooks for dirty tracking. Missing any one causes the "Re-run modified" feature to not detect changes made through that path.

### 4. `canvasBulkAiGeneration` Bridge Pattern

The toolbar can't directly access ActionManager (which lives inside canvas grid composables). The bridge:
1. `useCanvasTable.ts` writes: `canvasBulkAiGeneration.value = (columnId, rowIds, rows, path) => actionManager.executeBulkAiGeneration(...)`
2. `FieldAgentMenu.vue` reads: `if (canvasBulkAiGeneration.value) { await canvasBulkAiGeneration.value(...) }`
3. If not in canvas mode, the menu falls back to direct `generateRows` calls with manual state management

### 5. Column Meta Structure

Field agent config lives at:
```typescript
const colMeta = parseProp(column.meta)
const fieldAgentConfig = colMeta?.[SelectFieldAgentMetaProp]
// → { enabled: true, prompt_raw: "Classify {Product Name} based on {Description}" }
```

The `{FieldName}` tokens in `prompt_raw` reference other columns by title. The backend resolves these to column IDs, then to actual cell values per row.

### 6. `parseProp` Gotcha

Always use `parseProp(column.meta)` from nocodb-sdk — never `JSON.parse(column.meta)`. The meta field might already be an object or might be a JSON string depending on context.

### 7. NcMenuItem `theme="ai"`

For AI-related menu items, use `theme="ai"` on `<NcMenuItem>` to get the purple AI styling. Pair with `<GeneralIcon icon="ncAutoAwesome">` for the sparkle icon.

### 8. NcBadge Valid Colors

Only these work: `purple`, `gray`, `brand`, `red`, `orange`. "blue" does NOT exist and will render wrong.

### 9. Available General Icons

`circleCheckSolid`, `alertTriangleSolid`, `ncInfoSolid`, `ncAutoAwesome`, `ncZap`, `closeCircle`, `ncPlus`, `ncRefresh`. Note: `ncXSolid` does NOT exist — was tried and failed.

---

## Field Agent Feature — How It Works

### Data Flow (Bulk Generation)

1. User clicks "All cells in view" in FieldAgentMenu
2. Menu fetches row PKs from API (or uses dirty PKs for "Re-run modified")
3. If canvas grid: calls `canvasBulkAiGeneration.value(columnId, rowIds, rows, path)`
   - ActionManager shows spinner in each cell
   - Calls backend `generateRows(columnId, rowIds)`
   - Backend builds prompts per row, calls LLM, returns array of results
   - ActionManager writes results to `cachedRows` for real-time update
   - Summary modal shows results
4. If non-canvas: uses `generatingRows` / `generatingColumnRows` refs for manual state

### Dirty Row Tracking Flow

1. `buildFieldAgentDependencyMap(columns)` parses all field agent prompts
   - Input: `prompt_raw = "Classify {Product Name}"` on column "Category" (id: col123)
   - Output: `fieldAgentDependencyMap = Map { "Product Name" → ["col123"] }`
2. When user edits a cell, `onFieldAgentCellUpdate(property, rowPk)` is called
   - Checks if `property` (column title) is in the dependency map
   - If yes, adds `rowPk` to `dirtyFieldAgentRows.get("col123")`
3. FieldAgentMenu shows "Re-run modified (N)" when `getFieldAgentDirtyCount(colId) > 0`
4. After successful generation, `clearFieldAgentDirty(colId)` resets the set

### Backend Prompt Architecture

In `ai-data.service.ts`, the `generateFieldAgentRows` method:
1. Fetches records by PKs (single `WHERE pk IN (...)` query)
2. For each row, replaces `{ColumnTitle}` tokens with actual cell values
3. Calls `generateFieldAgentSystemMessage(column)` for type-specific system prompt:
   - SingleSelect → "You are a classification agent. Pick exactly ONE option..."
   - MultiSelect → "You are a tagging agent. Pick ONE or MORE options..."
   - Others → "You are a data field agent. Generate a value matching the target field type..."
4. Sends prompt + system message to configured AI integration
5. Returns array of `Record<string, any>` mapping column title → generated value

---

## Bugs Fixed & Their Root Causes

### "Cell not updating after Run AI Agent"
**Root cause:** `executeBulkAiGeneration` called `generateRows` but didn't write results back to `cachedRows`. The canvas grid only re-renders from its cache.
**Fix:** Added `rows` and `path` params, wrote results using `rowMeta.rowIndex` as cache key.

### "Re-run modified option not showing"
**Root cause:** Dirty tracking watcher was in `useData.ts` (non-canvas path), but the canvas grid uses `useInfiniteData.ts`.
**Fix:** Added identical watcher + hook to `useInfiniteData.ts`.

### "Bulk paste doesn't update dirty flag"
**Root cause:** Paste goes through `useGridViewData.ts` → `bulkUpdateRows()` / `bulkUpsertRows()`, which is a third separate code path from the other two composables.
**Fix:** Added `onFieldAgentCellUpdate` hooks to both bulk methods in `useGridViewData.ts`.

---

## Things That Don't Work Yet / Known Limitations

1. **Token usage not tracked** — Backend doesn't return token consumption from the AI integration. The summary modal shows "AI Integration" name instead. When backend adds usage tracking, add `tokensConsumed` back to `FieldAgentBulkStats`.

2. **Model name not shown** — Same reason. The configured model per-integration isn't exposed to the frontend. When it is, add `model` back.

3. **Batch size hardcoded to 25** — The max rows per bulk generation is 25, defined in the backend. Not configurable from the UI.

4. **No auto-run** — When dependent fields change, the field agent doesn't auto-regenerate. It only marks rows as dirty. This was an intentional design choice (simpler, cheaper, user-controlled).

5. **Dirty tracking is session-scoped** — Refreshing the page clears the dirty row map. There's no server-side persistence.

6. **Cell renderer duplication** — Each canvas cell type (SingleSelect, MultiSelect, Number, etc.) has similar field agent rendering code. A shared `renderFieldAgentIfApplicable()` utility would reduce duplication but hasn't been extracted yet.

---

## Files to Exclude from Commits

These files should NOT be committed:
- `packages/noco-integrations/pnpm-lock.yaml`
- `pnpm-lock.yaml` (root)
- `_tmp_*` files anywhere
- `field-agent-phase1-plan.md` (planning doc)
- `packages/nocodb-sdk/_tmp_*`
- `field-agents-changelog.md` (this review doc)
- `field-agents-learnings.md` (this learnings doc)

---

## Quick Reference: Key Functions & Where They Live

| Function | File | Purpose |
|----------|------|---------|
| `isFieldAgentCol(col)` | `nocodb-sdk/UITypes.ts` | Check if column has field agent enabled |
| `buildFieldAgentDependencyMap(cols)` | `useNocoAi.ts` | Parse prompts → build reverse dependency map |
| `onFieldAgentCellUpdate(prop, pk)` | `useNocoAi.ts` | Mark row dirty when dependent field changes |
| `getFieldAgentDirtyCount(colId)` | `useNocoAi.ts` | Count of dirty rows for a field agent column |
| `getFieldAgentDirtyRowIds(colId)` | `useNocoAi.ts` | Get PKs of dirty rows |
| `clearFieldAgentDirty(colId)` | `useNocoAi.ts` | Clear dirty state after generation |
| `executeBulkAiGeneration(...)` | `ActionManager.ts` | Run bulk generation with loading spinners |
| `generateFieldAgentSystemMessage(col)` | `prompts/data.ts` | Build type-specific system prompt |
| `runFieldAgentBulk(col, mode)` | `FieldAgentMenu.vue` | Orchestrate bulk run from toolbar |
| `openSummaryModal(stats)` | `FieldAgentMenu.vue` | Show generation results dialog |

---

## Debugging Tips

1. **Field agent menu not showing?** Check: Is AI integration configured? Is `isAiFeaturesEnabled` true? Is the view type grid/gallery? Is `isSharedBase` false?

2. **Dirty count not updating?** Check: Is the edited column's title present in any field agent's `prompt_raw` as `{ColumnTitle}`? Are you editing through canvas grid or legacy grid? Did you hook the right composable?

3. **Generation not updating cells?** Check: Is `canvasBulkAiGeneration.value` set? Is `rows` array being passed with valid `rowMeta.rowIndex` values? Is the `path` correct for grouped views?

4. **Context menu "Run AI Agent" not showing?** Check: Is the selection within a single column? Is that column a field agent column? Does the user have edit permission?
