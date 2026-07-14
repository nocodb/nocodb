# Field Agents — Change Log & Review Guide

## What Are Field Agents?

Field Agents add AI-powered value generation to regular column types (SingleSelect, MultiSelect, SingleLineText, Number, Decimal, Percent, Currency, JSON). Users configure a prompt with `{FieldName}` references, and the AI generates cell values based on other fields in the same row. Think of it as "AI formulas" — but instead of deterministic computation, an LLM generates the value.

---

## Architecture Overview

```
nocodb-sdk          → Type definitions, helper functions (isFieldAgentCol, FIELD_AGENT_SUPPORTED_TYPES)
     ↓
nocodb (backend)    → AI prompt generation, row generation service
     ↓
nc-gui (frontend)   → Config UI, toolbar menu, canvas rendering, bulk operations, dirty tracking
```

**Data model:** Field agent config is stored in the column's `meta` JSON under the `field_agent` key:
```json
{
  "field_agent": {
    "enabled": true,
    "prompt_raw": "Classify {Product Name} into a category based on {Description}"
  }
}
```

The SDK constant `SelectFieldAgentMetaProp = 'field_agent'` is the key name. `isFieldAgentCol(column)` checks both that the column type is supported AND that `meta.field_agent.enabled === true`.

---

## Files Changed — By Package

### 1. nocodb-sdk (3 files)

| File | Change |
|------|--------|
| `src/lib/globals.ts` | Added `SelectFieldAgentMetaProp = 'field_agent'` constant |
| `src/lib/UITypes.ts` | Added `FIELD_AGENT_SUPPORTED_TYPES` array, `isFieldAgentCol()` function, `AIFieldAgent` name, search terms |
| `src/lib/index.ts` | Exported `FIELD_AGENT_SUPPORTED_TYPES` |

### 2. nocodb backend (2 files)

| File | Change |
|------|--------|
| `src/ee/integrations/ai/module/services/ai-data.service.ts` | Field agent detection in `generateFieldAgentRows`, schema helpers for each supported type, prompt construction |
| `src/ee/integrations/ai/module/prompts/data.ts` | `generateFieldAgentSystemMessage()` — specialized system prompts per field type (classification for SingleSelect, tagging for MultiSelect, data extraction for others) |

### 3. nc-gui frontend — New EE Components (4 files)

| File | Purpose |
|------|---------|
| `ee/components/smartsheet/toolbar/FieldAgentMenu.vue` | Toolbar dropdown menu. Lists field agent columns, bulk run options (all/unmodified/modified), new column creation submenu, dirty count display |
| `ee/components/dlg/FieldAgentSummary.vue` | Post-generation summary modal. Shows rows processed/failed, duration, AI integration, status (success/partial/error) |
| `ee/components/dlg/FieldAgentNewColumn.vue` | "New AI Field Agent" modal. Wraps column creation with field_agent preloaded |
| `ee/components/smartsheet/column/FieldAgentConfig.vue` | Column editor config panel. Toggle, prompt editor (TipTap with field references), preview pane |

### 4. nc-gui frontend — Modified Components (18 files)

**Core grid & toolbar:**

| File | Change |
|------|--------|
| `components/smartsheet/Toolbar.vue` | Renders `FieldAgentMenu` in toolbar |
| `components/smartsheet/column/EditOrAdd.vue` | Field Agent submenu in column type picker |
| `components/smartsheet/header/Cell.vue` | AI purple theme for field agent column headers |
| `components/smartsheet/expanded-form/.../ColumnList.vue` | Generating column tracking in expanded form |

**Cell editors (non-canvas):**

| File | Change |
|------|--------|
| `components/cell/SingleSelect/Editor.vue` | Single-cell AI generation button + handler |
| `components/cell/MultiSelect/Editor.vue` | Same as SingleSelect |

**Canvas grid cell renderers:**

| File | Change |
|------|--------|
| `canvas/cells/index.ts` | Field agent cell rendering integration |
| `canvas/cells/SingleSelect.ts` | Placeholder text, loading spinner, AI button rendering |
| `canvas/cells/MultiSelect.ts` | Same |
| `canvas/cells/SingleLineText.ts` | Same |
| `canvas/cells/Number.ts` | Same |
| `canvas/cells/Decimal.ts` | Same |
| `canvas/cells/Percent.ts` | Same |
| `canvas/cells/Currency.ts` | Same |
| `canvas/cells/Json.ts` | Same |

**Canvas grid infrastructure:**

| File | Change |
|------|--------|
| `canvas/composables/useCanvasRender.ts` | Field agent column checks in render pipeline |
| `canvas/composables/useCanvasTable.ts` | `canvasBulkAiGeneration` binding to ActionManager |
| `canvas/loaders/ActionManager.ts` | `executeBulkAiGeneration()` method with real-time cell updates via cachedRows |
| `canvas/context/Cell.vue` | "Run AI Agent" in right-click context menu |

### 5. nc-gui frontend — Composables (4 files)

| File | Change |
|------|--------|
| `composables/useNocoAi.ts` | Dirty row tracking state + helpers (dependency map, mark dirty, get/clear dirty), `canvasBulkAiGeneration` shared ref |
| `composables/useData.ts` | Dirty tracking hooks in `updateRowProperty()` and `bulkUpdateRows()` |
| `composables/useInfiniteData.ts` | Same hooks for canvas grid single-cell edits |
| `composables/useGridViewData.ts` | Same hooks for bulk paste operations |

---

## Key Design Decisions

### Why meta storage instead of a new column type?
Field agents extend existing column types (SingleSelect, Number, etc.) rather than being a separate UIType. This means all existing cell rendering, validation, sorting, and filtering still works. The `meta.field_agent` config is an overlay.

### Why three separate cell-update hooks?
NocoDB has three composables handling cell updates depending on context:
- `useData.ts` — Non-canvas grid (legacy path)
- `useInfiniteData.ts` — Canvas grid single-cell edits
- `useGridViewData.ts` — Canvas grid bulk paste/update

All three need dirty tracking hooks because a user might edit cells through any path.

### Why `canvasBulkAiGeneration` shared ref pattern?
The toolbar menu (FieldAgentMenu.vue) needs to trigger bulk generation with cell-level loading spinners in the canvas grid. But the toolbar doesn't have direct access to the ActionManager. The shared ref in `useNocoAi` acts as a bridge — canvas grid writes the method reference, toolbar reads it.

### Why dirty tracking is session-scoped (frontend only)?
Persisting dirty state server-side would require schema changes and add complexity. Since field agents are interactive (user-triggered), session-scoped tracking is sufficient. Users can always re-run "All cells" if needed.

---

## Recent Changes (This Session)

1. **Cell right-click context menu** — Added "Run AI Agent" option in canvas grid cell context menu
2. **Real-time cell update fix** — `executeBulkAiGeneration` now writes generated data back to `cachedRows`
3. **Dirty row tracking** — Tracks which rows need re-generation when dependent fields change
4. **"Re-run modified (N)" menu option** — Shows count of stale rows, generates only those
5. **Bulk paste support** — Dirty tracking now works with paste operations via `useGridViewData.ts`
6. **Code audit cleanup** — Removed redundant ternary, removed unused export, added JSDoc
7. **Removed fake data** — Eliminated hardcoded `Math.random() * 3000` token counts and hardcoded `'gpt-4o-mini'` model from summary modal

---

## What's NOT Changed (Out of Scope)

These were flagged in a review but are intentional or deferred:

- **Cell renderer duplication** — Each canvas cell renderer (15+ files) has similar field agent rendering logic. Extracting to a shared utility is a valid future refactor but touches too many files for this PR.
- **Backend prompt template caching** — The `{FieldName}` → `{columnId}` replacement happens per-row. With a 25-row batch limit, the impact is negligible.
- **Canvas vs non-canvas state management** — The split is by design in NocoDB's architecture.
- **Animation loop** — The `startAnimationLoop` in ActionManager already self-terminates via cooldown timer. It is NOT infinite despite what the bot review claimed.
