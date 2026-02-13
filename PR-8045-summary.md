# PR #8045 — View Sections (Folders) for Left Sidebar

## Overview

This PR adds a "Sections" (folders) feature to the left sidebar view list in NocoDB. Sections allow users to organize views within a table into collapsible groups, similar to Airtable's view folders. This is an EE-only feature gated behind the Business plan.

## What It Does

When sections exist for a table, views can be grouped into named, collapsible folders in the sidebar. A virtual "Default" folder automatically collects any views not assigned to a section. Users can create sections, rename them, reorder them via drag-and-drop, change their folder icon color, and move views between sections.

## Architecture

The feature spans the full stack — SDK types, backend CRUD, frontend store, and UI components — following NocoDB's established CE/EE separation pattern.

### Database

A new `nc_view_sections_v2` table stores section metadata (title, order, meta JSON for icon color, etc.). The existing `nc_views_v2` table gets a new nullable `fk_view_section_id` foreign key column. Migration: `nc_099_view_sections.ts`.

### Backend (NestJS)

The CE model (`src/models/ViewSection.ts`) is a stub with no-op methods. The EE model (`src/ee/models/ViewSection.ts`) provides full CRUD with NocoDB's standard caching layer (`NocoCache` + `CacheScope.VIEW_SECTION`). A dedicated controller exposes four REST endpoints:

- `GET /api/v2/meta/tables/:tableId/view-sections` — list sections for a table
- `POST /api/v2/meta/tables/:tableId/view-sections` — create section
- `PATCH /api/v2/meta/view-sections/:sectionId` — update section
- `DELETE /api/v2/meta/view-sections/:sectionId` — delete section (views are unassigned, not deleted)

The service layer validates uniqueness of section titles per table, enforces schema lock checks, and emits `AppEvents` for audit logging.

### Frontend

A Pinia store (`ee/store/viewSections.ts`) manages section state with a `sectionsByTable` map keyed by `baseId:tableId`. A reverse index (`sectionTableIndex`) provides O(1) lookups by section ID for update/delete/reorder operations.

Two new EE components handle rendering:

- **`SectionNode.vue`** — renders a single section header with expand/collapse toggle (open/closed folder icons), inline rename, context menu (expand all, collapse all, icon color picker, rename, delete), and a tooltip showing the section name.
- **`List.vue`** (EE override) — orchestrates the full sidebar view list. Computes `topLevelItems` mixing sections and views, manages a virtual "Default" section (`__default__`) for unassigned views, handles drag-drop reordering via Sortable.js, and persists expand/collapse state to localStorage.

The EE `ViewActionMenu.vue` adds a "Move to..." submenu with folder icons for each section plus a "Remove from section" option. The EE `CreateViewBtn.vue` adds a "Section" item to the create view dropdown.

### Plan Gating

Sections are gated behind `PlanFeatureTypes.FEATURE_VIEW_SECTIONS` (Business plan). The `PaymentUpgradeBadgeProvider` + `LazyPaymentUpgradeBadge` pattern wraps section-related menu items in both the create view dropdown and the "Move to..." submenu.

## Key Design Decisions

**Virtual Default Folder.** Rather than requiring every view to belong to a section, unassigned views are shown in a client-side-only "Default" folder (ID `__default__`) that appears only when at least one real section exists. This avoids backend complexity and migration headaches for existing views.

**Open/Closed Folder Icons.** Expand/collapse state is conveyed through `ncFolderOpen` and `ncFolderClosed` SVG icons rather than chevrons, giving the feature a more file-manager-like feel. The same icons are used for expand-all/collapse-all context menu items.

**Icon Color Picker.** Each section's folder icon color is stored in `section.meta.iconColor` (JSON field). A `GeneralColorPicker` with `baseIconColors` is embedded directly in the context menu with scoped CSS overrides for compact 20×20px color tiles.

**Active View Always Visible.** Even when a folder is collapsed, the currently active view remains visible in the sidebar. This is implemented with a conditional: `v-if="expandedSections[item.id] || activeView?.id === view.id"`.

**Debounced localStorage.** Expand/collapse state is persisted to localStorage, but writes are debounced (300ms) to avoid blocking the main thread during rapid toggling.

## Performance Optimizations (from review feedback)

Several performance improvements were made based on review feedback:

- **Bulk deletion:** Section deletion now uses `bulkMetaUpdate` for a single DB query instead of N+1 per-view updates.
- **Indexed store lookups:** A reverse index (`sectionId → tableKey`) avoids iterating all tables when updating/deleting/reordering a section.
- **Direct title validation:** Duplicate title checking uses `findByTitle()` with a direct `metaGet2` query instead of fetching all sections.
- **Removed redundant sort:** The in-memory sort in `ViewSection.list()` handles NULL ordering; the redundant DB-level `ORDER BY` was removed.

## Files Changed

| Area | Files | Purpose |
|------|-------|---------|
| SDK | `Api.ts`, `enums.ts`, `globals.ts`, `payment/index.ts` | Types, events, error codes, plan feature |
| Backend Models | `models/ViewSection.ts` (CE stub + EE impl) | CRUD with caching |
| Backend API | `controllers/view-sections.controller.ts`, `services/view-sections.service.ts` | REST endpoints + business logic |
| Backend Infra | `migrations/nc_099_view_sections.ts`, `globals.ts`, `noco.module.ts`, `app-hooks` | DB schema, constants, DI, audit events |
| Frontend Store | `ee/store/viewSections.ts` | State management with indexed lookups |
| Frontend UI | `SectionNode.vue`, `List.vue`, `CreateViewBtn.vue`, `ViewActionMenu.vue` | Sidebar rendering + interactions |
| Frontend Utils | `iconUtils.ts`, `en.json` | Icons + i18n strings |
| Icons | `folder-closed.svg`, `folder-open.svg`, `palette.svg` | New SVG assets |
