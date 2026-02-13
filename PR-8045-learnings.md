# PR #8045 — Agent Learnings & Resurrection Guide

This document captures all context, patterns, gotchas, and decisions needed to resume work on the View Sections feature. It is written for a future agent session that has no prior context.

---

## 1. Feature Overview

**What:** "View Sections" (folders) in the left sidebar to group views within a table.
**Where:** EE-only feature, gated behind Business plan (`FEATURE_VIEW_SECTIONS`).
**PR:** #8045 on `nocodb/nocohub` (the enterprise repo, NOT the open-source `nocodb` repo).

Users can create named collapsible folders in the sidebar view list, move views into them, customize folder icon colors, and drag-drop to reorder sections. A virtual "Default" folder holds unassigned views when sections exist.

---

## 2. Repository Structure & Conventions

### CE/EE Separation

NocoDB uses a layered architecture where EE code lives in `ee/` subdirectories that mirror the CE structure. Same-path files in `ee/` override their CE counterparts at build time (Nuxt layers for frontend, module imports for backend).

Key rule: **CE code must never import from EE**. EE extends CE, not the other way around.

### Build Order

```
nocodb-sdk → nocodb (backend) → nc-gui (frontend)
```

After SDK type changes, always rebuild SDK first: `cd packages/nocodb-sdk && pnpm run build:ee`

### Skills

The repo has `.skills/` documentation. Read `CLAUDE.md` at the repo root first, then relevant skill files for the area you're working in.

---

## 3. Complete File Inventory

### SDK (`packages/nocodb-sdk/src/lib/`)

| File | What's there |
|------|-------------|
| `Api.ts` (lines 6278-6345) | `ViewSectionType`, `ViewSectionListType`, `ViewSectionCreateReqType`, `ViewSectionUpdateReqType` interfaces. Also `dbViewSection` API client methods (lines 18796-18870). `ViewType` has `fk_view_section_id?: StringOrNullType` field. |
| `enums.ts` | `AppEvents.VIEW_SECTION_CREATE/UPDATE/DELETE` |
| `globals.ts` | Error code `ERR_VIEW_SECTION_NOT_FOUND` |
| `payment/index.ts` | `PlanFeatureTypes.FEATURE_VIEW_SECTIONS = 'feature_view_sections'` with description |
| `error-handler/preset-error-codex-map.ts` | Error code mapping for view section not found |

**IMPORTANT:** The SDK types DO exist in `Api.ts` and are properly exported via `index.ts` (`export * from '~/lib/Api'`). A code review flagged this as "missing" but it was a false positive.

### Backend Models

| File | Purpose |
|------|---------|
| `packages/nocodb/src/models/ViewSection.ts` | CE stub with empty methods returning `null`/`[]`/`true`. Methods: `get`, `list`, `insert`, `update`, `delete`, `deleteByModelId`, `findByTitle`. |
| `packages/nocodb/src/ee/models/ViewSection.ts` | Full EE implementation. Extends CE stub, implements `ViewSectionType`. Uses `NocoCache` with `CacheScope.VIEW_SECTION`. Key methods: `get` (with cache), `list` (with cache + in-memory sort for NULL handling), `findByTitle` (direct DB query for duplicate checking), `insert` (auto-order via `metaGetNextOrder`), `update`, `delete` (bulk view unassignment via `bulkMetaUpdate`), `deleteByModelId`. |
| `packages/nocodb/src/models/View.ts` | Has `fk_view_section_id` field |
| `packages/nocodb/src/ee/models/View.ts` | Has `fk_view_section_id` in `extractProps` |
| `packages/nocodb/src/models/index.ts` | Exports `ViewSection` |
| `packages/nocodb/src/ee/models/index.ts` | Exports EE `ViewSection` |

### Backend Controller & Service

| File | Purpose |
|------|---------|
| `packages/nocodb/src/ee/controllers/view-sections.controller.ts` | REST controller with 4 endpoints. Uses `Acl` decorator with `subActions.sectionManage`. Routes: `GET /tables/:tableId/view-sections`, `POST /tables/:tableId/view-sections`, `PATCH /view-sections/:sectionId`, `DELETE /view-sections/:sectionId`. |
| `packages/nocodb/src/ee/services/view-sections.service.ts` | Business logic: schema lock checks, title validation (uses `findByTitle` for direct query), `Model.get` for source_id lookup, `AppHooks` emission. |

### Backend Infrastructure

| File | Purpose |
|------|---------|
| `packages/nocodb/src/meta/migrations/v2/nc_099_view_sections.ts` | Creates `nc_view_sections_v2` table (columns: id, fk_workspace_id, base_id, source_id, fk_model_id, title, order, meta, created_by, updated_by, created_at, updated_at) + adds `fk_view_section_id` to views table. Has `up()` and `down()`. |
| `packages/nocodb/src/utils/globals.ts` | `MetaTable.VIEW_SECTIONS = 'nc_view_sections_v2'`, `CacheScope.VIEW_SECTION = 'viewSection'` |
| `packages/nocodb/src/ee/modules/noco.module.ts` | Registers `ViewSectionsController` and `ViewSectionsService` |
| `packages/nocodb/src/ee/services/app-hooks/interfaces.ts` | Event interfaces: `ViewSectionCreateEvent`, `ViewSectionUpdateEvent`, `ViewSectionDeleteEvent` |
| `packages/nocodb/src/ee/middlewares/extract-ids/extract-ids.middleware.ts` | Handles `sectionId` in route params for ID extraction |
| `packages/nocodb/src/helpers/ncError.ts` | `viewSectionNotFound()` method |

### Frontend Store

| File | Purpose |
|------|---------|
| `packages/nc-gui/ee/store/viewSections.ts` | Pinia store. State: `sectionsByTable` (Map<string, ViewSectionType[]>), `sectionTableIndex` (Map<string, string> — reverse index for O(1) lookups). Computed: `sections` (getter/setter keyed by active table). Actions: `loadSections`, `createSection`, `updateSection`, `deleteSection`, `reorderSection`, `getNextSectionTitle`. All CRUD uses raw `$api.instance` Axios calls (not generated SDK client methods). |

### Frontend Components

| File | Purpose |
|------|---------|
| `packages/nc-gui/ee/components/dashboard/TreeView/Views/SectionNode.vue` | Single section header. Props: `section`, `isExpanded`, `allExpanded`, `allCollapsed`, `isDefault`. Emits: `expand-toggle`, `rename`, `delete`, `open-menu`, `expand-all`, `collapse-all`, `change-color`. Features: open/closed folder icons with dynamic color, inline rename (dbl-click or context menu), context menu with expand-all/collapse-all (disabled states based on `allExpanded`/`allCollapsed`), icon color picker (palette icon + `GeneralColorPicker` with `baseIconColors`), rename section, delete section. Default sections hide rename/delete/color picker. Scoped CSS for 20×20px color tiles. |
| `packages/nc-gui/ee/components/dashboard/TreeView/Views/List.vue` | Main sidebar list (EE override of CE List.vue). Key state: `expandedSections` (Record<string, boolean>, persisted to localStorage with debounced writes). Key computed: `topLevelItems` (sections + views or Default folder), `allSectionIds`, `allSectionsExpanded`/`Collapsed`, `showDefaultFolder`, `filteredViews`. Sections use `Sortable.js` for drag-drop reorder. Virtual default section: `DEFAULT_SECTION_ID = '__default__'`, appears only when real sections exist, always last. Active view visible in collapsed folders via `v-if="expandedSections[item.id] \|\| activeView?.id === view.id"`. Section CRUD handlers: `onRenameSection`, `onChangeSectionColor`, `openDeleteSectionDialog`, `onDeleteSection`, `onCreateSection`. |
| `packages/nc-gui/ee/components/dashboard/TreeView/CreateViewBtn.vue` | Create view/section dropdown. Section item wrapped with `NcTooltip` (tooltip: "Organize views into collapsible sections") and `PaymentUpgradeBadgeProvider`. Uses `ncFolderOpen` icon with `#3f8292` color. Click: `click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => onCreateSection())`. |
| `packages/nc-gui/ee/components/smartsheet/toolbar/ViewActionMenu.vue` | View context menu (EE override). "Move to..." submenu lists sections with `ncFolderOpen` icons + dynamic colors. "Remove from section" option. Wrapped with `PaymentUpgradeBadgeProvider`. |

### Frontend Utilities & Assets

| File | Purpose |
|------|---------|
| `packages/nc-gui/utils/iconUtils.ts` | Imports and registers `ncFolderClosed`, `ncFolderOpen`, `ncPalette` icons. Also adds keyword entries. |
| `packages/nc-gui/assets/nc-icons-v2/folder-closed.svg` | Closed folder SVG (Lucide-based) |
| `packages/nc-gui/assets/nc-icons-v2/folder-open.svg` | Open folder SVG (Lucide-based) |
| `packages/nc-gui/assets/nc-icons-v2/palette.svg` | Color palette SVG |
| `packages/nc-gui/ee/assets/nc-icons-v2/` | Copies of above icons for EE build |
| `packages/nc-gui/lang/en.json` | i18n keys: `objects.section`, `labels.iconColour`, `labels.moveTo`, `labels.newSection`, `labels.removeFromSection`, `tooltip.organizeViewsIntoSections`, `msg.info.sectionDeleteConfirmation`, `upgrade.upgradeToAccessViewSectionsSubtitle` |

---

## 4. Patterns & Conventions

### Icon Registration

1. Add SVG file to `packages/nc-gui/assets/nc-icons-v2/` AND `packages/nc-gui/ee/assets/nc-icons-v2/`
2. Import in `packages/nc-gui/utils/iconUtils.ts`
3. Add to `iconMap` object
4. Add keyword entry
5. Use via `<GeneralIcon icon="ncYourIcon" />`

**Gotcha:** Icon names must match exactly what's in `iconMap`. Using `icon="folder"` won't work if the registered name is `ncFolder`.

### Plan Gating Pattern

```vue
<PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS">
  <template #default="{ click }">
    <NcMenuItem @click="click(PlanFeatureTypes.FEATURE_VIEW_SECTIONS, () => yourAction())">
      <!-- content -->
      <LazyPaymentUpgradeBadge
        :feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
        :plan-title="PlanTitles.BUSINESS"
        :limit-or-feature="PlanFeatureTypes.FEATURE_VIEW_SECTIONS"
        :content="$t('upgrade.upgradeToAccessViewSectionsSubtitle', { plan: getPlanTitle(PlanTitles.BUSINESS) })"
      />
    </NcMenuItem>
  </template>
</PaymentUpgradeBadgeProvider>
```

Requires: `import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'` and `const { getPlanTitle } = useEeConfig()`.

### NcMenuItem Alignment

`NcMenuItem` uses `p-2 mx-1.5` internally. If embedding a custom element (like a color picker) that should align with menu items, either use `NcMenuItem` with `!hover:bg-transparent !cursor-default` as a wrapper, or match the padding manually.

### Color Picker in Context Menu

The `GeneralColorPicker` with `baseIconColors` (8 predefined colors) is embedded in a context menu. Scoped CSS overrides are needed for compact sizing:

```scss
.nc-section-icon-color-picker {
  @apply !p-0;
  .color-picker-row { @apply !space-x-0.5; }
  .color-selector { @apply !h-5 !w-5 !rounded; }
  .color-picker-row > div { @apply !p-0.5 !h-auto; }
  .nc-more-colors-trigger { @apply !h-5 !w-5; .w-4 { @apply !w-3 !h-3; } }
}
```

### Backend Model Pattern

CE stub returns empty results. EE implementation extends CE and uses:
- `NocoCache` for read-through caching (`get`, `set`, `update`, `deepDel`, `getList`, `setList`, `appendToList`)
- `CacheScope.VIEW_SECTION` as cache key prefix
- `prepareForDb` / `prepareForResponse` for JSON field serialization (e.g., `meta`)
- `extractProps` to whitelist fields before DB operations
- `metaGetNextOrder` for auto-incrementing order values

### Frontend Store Raw API Calls

The store uses `$api.instance.get/post/patch/delete` (raw Axios) rather than generated SDK client methods. Endpoint patterns:
- List: `GET /api/v1/db/meta/tables/${tableId}/view-sections`
- Create: `POST /api/v1/db/meta/tables/${tableId}/view-sections`
- Update: `PATCH /api/v1/db/meta/view-sections/${sectionId}`
- Delete: `DELETE /api/v1/db/meta/view-sections/${sectionId}`

Note: The controller uses `/api/v2/` routes but the store calls `/api/v1/` — both may work due to version aliasing. Verify if this causes issues.

---

## 5. Key Design Decisions & Rationale

### Virtual Default Section (`__default__`)

**Decision:** Unassigned views go into a client-side-only "Default" folder rather than creating a real section in the database.

**Rationale:** Avoids migration complexity for existing tables, no backend changes for existing views, simpler cleanup when all sections are deleted, and the default folder needs different behavior (no rename, no delete, no color picker).

**Implementation:** `DEFAULT_SECTION_ID = '__default__'` constant. `showDefaultFolder` computed is true when `sections.length > 0`. Default folder is always appended last (`order: Number.MAX_SAFE_INTEGER`). `getViewsInSection('__default__')` returns `getTopLevelViews()`.

### Folder Icons Instead of Chevrons

**Decision:** Use custom `ncFolderOpen`/`ncFolderClosed` SVGs instead of standard chevron icons for expand/collapse.

**Rationale:** User explicitly requested file-manager-like feel. Same icons reused for expand-all/collapse-all in context menu.

### Icon Color in Meta JSON

**Decision:** Store folder icon color as `section.meta.iconColor` rather than a dedicated column.

**Rationale:** Flexible schema for future per-section metadata without migrations. Accessed via `parseProp(section.meta)?.iconColor || '#3f8292'`.

### Active View Visibility in Collapsed Folders

**Decision:** Always show the active view even when its parent folder is collapsed.

**Rationale:** User feedback — losing sight of the active view when collapsing folders is disorienting.

**Implementation:** `v-if="expandedSections[item.id] || activeView?.id === view.id"` on the view node template.

---

## 6. Performance Optimizations Applied

These were made in response to a detailed code review:

1. **N+1 Query Fix (ViewSection.delete):** Changed from per-view `metaUpdate` loop to single `bulkMetaUpdate` call. Cache invalidation still loops (cache API doesn't support bulk).

2. **Reverse Index (Store):** Added `sectionTableIndex` (Map<sectionId, tableKey>) for O(1) lookups in `updateSection`, `deleteSection`, `reorderSection`. Previously iterated all tables.

3. **Direct Title Validation:** Added `ViewSection.findByTitle()` using `metaGet2` with `{fk_model_id, title}` condition. Replaces fetching all sections just to check uniqueness.

4. **Removed Redundant Sort:** `ViewSection.list()` had both DB-level `ORDER BY` and in-memory sort. Kept only in-memory sort (handles NULLs as Infinity).

5. **Debounced localStorage:** `saveExpandedSections` wrapped with `useDebounceFn(..., 300)`.

---

## 7. Common Gotchas

1. **Icon names:** Must match `iconMap` keys exactly. `folder` ≠ `ncFolder` ≠ `ncFolderOpen`.

2. **EE assets:** SVG icons must exist in BOTH `assets/nc-icons-v2/` AND `ee/assets/nc-icons-v2/`.

3. **Git config:** The repo may not have user.email/user.name configured. Set them before committing.

4. **i18n key format:** Use `$t('general.renameEntity', { entity: $t('objects.section').toLowerCase() })` pattern for entity-specific labels.

5. **`parseProp` for meta:** Section meta is stored as JSON string in DB. Always use `parseProp(section.meta)` to safely parse it.

6. **CE stub methods:** When adding new static methods to the EE model, add matching stub methods to the CE model too (returning null/empty).

7. **Default icon color:** `#3f8292` is used everywhere as the fallback. It's defined as `DEFAULT_ICON_COLOR` in SectionNode.vue.

8. **Expand/collapse disabled states:** `allExpanded` disables expand-all button, `allCollapsed` disables collapse-all. Both include the virtual default section in their calculations.

---

## 8. What's Left / Known Issues

- **CE/EE List.vue duplication:** The EE List.vue is a near-complete rewrite (~834 lines) with ~60% overlap with CE. A composable-based refactor was suggested but deferred.
- **Order field race condition:** `metaGetNextOrder` could race with concurrent inserts. Minor risk.
- **No DB unique constraint:** Title uniqueness is validated only at application level. A DB-level `UNIQUE(fk_model_id, title)` constraint was suggested but not added.
- **Frontend title validation:** The frontend doesn't validate title before API call (relies on server-side validation).
- **API version mismatch:** Controller uses `/api/v2/` but store calls `/api/v1/`. Verify routing.

---

## 9. Testing Checklist

- [ ] Create section, verify it appears in sidebar
- [ ] Rename section (double-click + context menu)
- [ ] Delete section, verify views return to top-level
- [ ] Move view to section via "Move to..." submenu
- [ ] Remove view from section
- [ ] Change folder icon color
- [ ] Expand/collapse individual sections
- [ ] Expand all / Collapse all
- [ ] Active view stays visible when folder collapsed
- [ ] Default folder appears when sections exist, disappears when all deleted
- [ ] Plan gating: upgrade badge shown for non-Business users
- [ ] Drag-drop reorder sections
- [ ] Unique section names enforced
- [ ] CE build works without sections feature
