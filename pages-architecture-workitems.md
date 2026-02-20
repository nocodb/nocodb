# NocoDB Pages: Architecture & Work Items

**Date:** 2026-02-20
**Status:** Architectural Design
**Vision:** Data-aware documents natively integrated with NocoDB's structured data layer. Not "markdown pages next to tables" — documents that understand, query, and interact with the database underneath.

---

## Core Architectural Decisions

### 1. ProseMirror JSON as Canonical Storage — Not Markdown

The existing rich text cells store raw markdown and round-trip through `markdown-it → ProseMirror → MarkdownSerializer` on every load/save. This is lossy, creates multiple inconsistent rendering surfaces, and prevents server-side processing without a markdown parser.

Pages store **ProseMirror JSON** natively. Markdown becomes a derived export format, not the source of truth.

**Rationale:**

- Lossless round-trips: what you save is exactly what you load.
- Y.js/Hocuspocus operate directly on ProseMirror JSON — collaboration becomes a layer addition, not a storage migration.
- Server-side processing (mention extraction, search indexing, automation-generated content) works on structured JSON, not regex over markdown.
- Block-level identity (see below) is a natural property of JSON nodes, not something you can retrofit onto a markdown string.
- API consumers get structured data; markdown export is a `?format=markdown` query parameter.

**What this means for existing rich text cells:** They continue as-is. Pages and cells are different features with different storage strategies. The Tiptap editor core and extensions are shared; the serialization boundary diverges.

---

### 2. Block-Level Identity from Day One

Every top-level block in a page gets a stable UUID (`blk_` prefixed) assigned at creation time, persisted in the ProseMirror JSON. The document is still stored and loaded as a single unit — blocks are not individual database rows (avoiding Notion's performance tax).

```json
{
  "type": "doc",
  "content": [
    {
      "id": "blk_a1b2c3",
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Q4 Revenue Report" }]
    },
    {
      "id": "blk_d4e5f6",
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Revenue grew by 23% QoQ..." }]
    },
    {
      "id": "blk_g7h8i9",
      "type": "tableEmbed",
      "attrs": { "view_id": "vw_xyz", "filters": {} }
    }
  ]
}
```

**Why this matters even though v1 doesn't use it:**

- Block-level collaboration: Y.js conflict resolution targets individual blocks, not the whole document.
- Block-level comments: "Comment on this paragraph" anchors to a block UUID that survives edits above and below it.
- Block references: "Embed this block from another page" or "this automation updates block X" requires addressable blocks.
- Table/view embedding: A `tableEmbed` block is a reference to a NocoDB view, rendered inline. It needs its own identity and lifecycle.
- Granular permissions: Enterprise "this section is manager-only" is block-level ACL keyed on block UUIDs.
- Partial loading: Large documents can lazy-load blocks below the fold.

**Design principle:** Store as one document (cheap reads/writes), address as individual blocks (cheap to extend).

---

### 3. Pages as a Peer Entity, Not a Table Type

Pages live in their own meta table (`nc_docs_v2`), not crammed into `nc_models_v2` with a `type = 'doc'` discriminator. Tables and pages have fundamentally different lifecycles, permission models, versioning needs, and content structures.

They share a `base_id` — a page belongs to a base just like a table does. They appear in the base sidebar alongside tables and automations as a first-class nav item.

**Why not reuse `nc_models_v2`:** Column definitions, view configurations, sort/filter state, webhook bindings — none of this applies to pages. Sharing the table means either nullable columns everywhere or a polymorphic mess. Separate entities that share a base is cleaner and doesn't constrain either feature's evolution.

---

### 4. Unified Mentions & References System

Replace the current regex-based mention extraction (`@(userId|email|name)` in markdown strings) with a relational mention/reference table that serves both pages and cells.

```
nc_mentions_v2
├── id
├── base_id
├── source_type       ← 'doc' | 'cell' | 'comment'
├── source_id         ← doc_id or row_id
├── source_block_id   ← nullable, for block-level anchoring in pages
├── mention_type      ← 'user' | 'page' | 'record' | 'field'
├── target_id         ← user_id, doc_id, row_id, etc.
├── created_by
├── created_at
```

**What this unlocks:**

- "Find all pages that mention me" → indexed query, not full-text scan.
- "Find all pages that reference this record" → bidirectional linking between pages and table data.
- Reliable notifications: mentions are relational facts, not regex matches that can misparse on special characters.
- Backfill existing cell mentions and deprecate the fragile `extractMentions()` regex utility.

In ProseMirror JSON, mentions become: `{ "type": "mention", "attrs": { "mention_id": "mnt_xyz" } }` — a pointer to the mentions table, not inline data.

---

### 5. Collaboration as a Storage Format Property

v1 ships with optimistic concurrency (version-based conflict detection), not real-time collaboration. But the storage format (ProseMirror JSON with block UUIDs) is chosen specifically because Y.js operates on it natively. When collaboration arrives, it's a transport layer addition — not a data migration.

**v1 concurrency model:** Page has a `version` integer. On load, client receives `version: N`. On save, client sends `version: N` with the updated content. Server rejects the save if `version != N` (someone else saved in between) and returns a diff. Client resolves manually or auto-merges.

**Future collaboration model:** Hocuspocus server wraps the same ProseMirror JSON. Y.js handles operational transforms on the block-level structure. The `version` column becomes a checkpoint counter. No document format changes required.

---

## Data Model

### `nc_docs_v2` — Page Storage

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar PK | `doc_` prefixed |
| `base_id` | varchar FK | Links to base |
| `fk_workspace_id` | varchar FK | Workspace scoping |
| `title` | text | Indexed for search and sidebar display |
| `content` | jsonb | ProseMirror JSON with block-level UUIDs |
| `content_text` | text | Server-derived plaintext for full-text search |
| `meta` | jsonb | Icon, cover image, lock status, settings |
| `order` | float | Drag-to-reorder within sidebar |
| `parent_id` | varchar FK (nullable) | Self-referential. Always NULL in v1. Enables nesting in v2+ without migration |
| `version` | integer | Optimistic concurrency. Incremented on every save |
| `created_by` | varchar FK | User who created |
| `updated_by` | varchar FK | Last editor |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**

- `(base_id, fk_workspace_id)` — context index, consistent with NocoDB patterns
- `(base_id, parent_id, order)` — sidebar ordering, future nesting
- `(base_id, title)` — title search
- GIN index on `content_text` — full-text search (Postgres)

### `nc_doc_versions_v2` — Version History

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar PK | |
| `doc_id` | varchar FK | Links to `nc_docs_v2` |
| `base_id` | varchar FK | |
| `version` | integer | Matches the `version` at time of snapshot |
| `content` | jsonb | Full ProseMirror JSON snapshot |
| `title` | text | Title at time of snapshot |
| `created_by` | varchar FK | Who made this edit |
| `created_at` | timestamp | |

**Pruning policy:** Keep all versions for 30 days, then keep one per day for 90 days, then one per week indefinitely. Configurable via base settings.

### `nc_mentions_v2` — Unified Mentions & References

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar PK | `mnt_` prefixed |
| `base_id` | varchar FK | |
| `source_type` | enum | `'doc'`, `'cell'`, `'comment'` |
| `source_id` | varchar | doc_id, row_id, or comment_id |
| `source_block_id` | varchar (nullable) | Block UUID within a page |
| `mention_type` | enum | `'user'`, `'page'`, `'record'`, `'field'` |
| `target_id` | varchar | The referenced entity's ID |
| `created_by` | varchar FK | |
| `created_at` | timestamp | |

**Indexes:**

- `(target_id, mention_type)` — "find everything mentioning this user/page/record"
- `(source_type, source_id)` — "find all mentions in this page/cell"
- `(base_id, mention_type)` — workspace-scoped queries

---

## Work Items

### Phase 1: Foundation (v1 Ship)

#### 1.1 Data Model & Migration

- [ ] Create `nc_docs_v2` migration with all columns including `parent_id` (nullable) and `version`
- [ ] Create `nc_doc_versions_v2` migration
- [ ] Create `nc_mentions_v2` migration
- [ ] Add `MetaTable.DOCS`, `MetaTable.DOC_VERSIONS`, `MetaTable.MENTIONS` to both CE and EE `globals.ts`
- [ ] Add `CacheScope.DOC`, `CacheScope.DOC_VERSION`, `CacheScope.MENTION`
- [ ] Ensure composite PK pattern (`base_id + id`) consistent with existing v3 conventions

#### 1.2 Backend: Doc Model & Service

- [ ] Create `Doc.ts` model in `packages/nocodb/src/models/` — CRUD with cache, version management
- [ ] Create `DocVersion.ts` model — snapshot creation, retrieval, pruning
- [ ] Create `Mention.ts` model — CRUD, query by target, query by source
- [ ] Create `doc.service.ts` — business logic: create, read, update (with version check), delete, reorder, search
- [ ] `content_text` derivation: server-side ProseMirror JSON → plaintext stripping on every save
- [ ] Server-side content validation: walk the JSON tree, reject unknown node types, enforce schema
- [ ] Server-side sanitization: strip dangerous attributes, validate URLs in link/image nodes
- [ ] Mention extraction from ProseMirror JSON: walk tree, find mention nodes, sync to `nc_mentions_v2`
- [ ] Version snapshot: debounced (save version only if >N seconds since last version), configurable

#### 1.3 Backend: API Endpoints

- [ ] `GET /api/v2/meta/bases/:baseId/docs` — list pages in a base (title, meta, order; no content)
- [ ] `POST /api/v2/meta/bases/:baseId/docs` — create page
- [ ] `GET /api/v2/meta/docs/:docId` — get page with full content
- [ ] `PATCH /api/v2/meta/docs/:docId` — update page (version-checked optimistic concurrency)
- [ ] `DELETE /api/v2/meta/docs/:docId` — soft delete
- [ ] `POST /api/v2/meta/docs/:docId/reorder` — update sidebar order
- [ ] `GET /api/v2/meta/docs/:docId/versions` — list version history
- [ ] `GET /api/v2/meta/doc-versions/:versionId` — get specific version content
- [ ] `POST /api/v2/meta/docs/:docId/restore/:versionId` — restore a version
- [ ] `GET /api/v2/meta/docs/:docId?format=markdown` — derived markdown export
- [ ] Register all endpoints in ACL, internal controllers, and `noco.module.ts`

#### 1.4 Backend: ACL & Permissions

- [ ] Define doc-level roles: owner, editor, commenter, viewer (aligned with base roles for v1)
- [ ] ACL entries for all doc endpoints
- [ ] Pages inherit base-level permissions in v1 (no per-page overrides yet)
- [ ] Audit log entries for doc create/update/delete

#### 1.5 SDK: Types & Helpers

- [ ] Add `DocType`, `DocVersionType`, `MentionType` interfaces to `nocodb-sdk`
- [ ] Add `DocEvents` to SDK enums (DOC_CREATE, DOC_UPDATE, DOC_DELETE, DOC_MENTION)
- [ ] Add `isDoc()` helper to SDK
- [ ] Rebuild SDK: `pnpm run build:ee`

#### 1.6 Frontend: Page Editor

- [ ] Create `packages/nc-gui/components/doc/Editor.vue` — Tiptap editor configured for ProseMirror JSON (NOT markdown serialization)
- [ ] Reuse existing Tiptap extensions: bold, italic, underline, strike, link, image, task list, heading, code block, blockquote, hard break, horizontal rule
- [ ] Add custom `BlockId` extension: assigns `blk_` UUID to every top-level node on creation, preserves on edit
- [ ] Add `UserMention` extension (reuse from existing rich text, wire to `nc_mentions_v2`)
- [ ] Title input: separate from Tiptap content, bound to `doc.title`, with autosave
- [ ] Autosave: debounced (2s after last keystroke), with version conflict detection
- [ ] Manual save: Ctrl/Cmd+S
- [ ] Conflict handling: on version mismatch, show diff dialog with options to overwrite or reload

#### 1.7 Frontend: Sidebar Integration

- [ ] Add "Pages" section to base sidebar, below tables and above automations
- [ ] List pages with title + icon from `meta`
- [ ] "New Page" button
- [ ] Drag-to-reorder (update `order` via reorder endpoint)
- [ ] Right-click context menu: rename, duplicate, delete
- [ ] Click to open page in main content area (replacing grid/form view)

#### 1.8 Frontend: Store & Composables

- [ ] Create `packages/nc-gui/store/doc.ts` — Pinia store for page list, active page, loading states
- [ ] Create `packages/nc-gui/composables/useDoc.ts` — CRUD operations, autosave logic, version management
- [ ] Create `packages/nc-gui/composables/useDocMentions.ts` — mention sync, notification triggers

#### 1.9 Verification & Testing

- [ ] Backend unit tests: Doc model CRUD, version creation and pruning, mention extraction from ProseMirror JSON, content validation, optimistic concurrency rejection
- [ ] API integration tests: full endpoint coverage including version conflicts
- [ ] Frontend E2E: create page, edit content, autosave, sidebar navigation, reorder, delete
- [ ] Security: verify server-side sanitization rejects script tags, event handlers, javascript: URLs in JSON node attributes
- [ ] Performance: load test with 100+ pages per base, pages with 500+ blocks

---

### Phase 2: History, Search & Polish

#### 2.1 Version History UI

- [ ] Version history sidebar panel: list of versions with timestamps and authors
- [ ] Version preview: read-only render of a historical version
- [ ] Restore version: creates a new version (doesn't overwrite history)
- [ ] Diff view: visual diff between two versions (block-level, leveraging block UUIDs for alignment)

#### 2.2 Search

- [ ] Global search includes page titles and `content_text`
- [ ] In-page Ctrl+F search within the Tiptap editor
- [ ] Base-level "search across pages" with highlighted results

#### 2.3 Export

- [ ] Export page as Markdown (server-side ProseMirror JSON → markdown serialization)
- [ ] Export page as PDF (ProseMirror JSON → HTML → PDF via headless rendering)
- [ ] Export page as HTML

#### 2.4 Mention Backfill

- [ ] Migration to backfill `nc_mentions_v2` from existing rich text cell content (parse `@(userId|...)` from all richMode LongText cells)
- [ ] Dual-write: cell rich text saves continue writing inline format AND syncing to mentions table
- [ ] Deprecation path for regex-based `extractMentions()` utility

---

### Phase 3: Data-Aware Documents

#### 3.1 Table/View Embed Block

- [ ] New Tiptap node type: `tableEmbed` — stores `view_id` and optional filter/sort overrides
- [ ] Renderer: inline, interactive NocoDB grid/gallery/kanban view within the page
- [ ] Live data: embed reflects current table data, not a snapshot
- [ ] Permissions: embed respects the viewer's table-level ACL

#### 3.2 Field Reference Inline

- [ ] New Tiptap node type: `fieldRef` — stores `table_id`, `row_id`, `field_id`
- [ ] Renders as inline chip showing the current field value
- [ ] Updates when the referenced record changes (via existing websocket infrastructure)

#### 3.3 Automation Integration

- [ ] New automation action: "Create/Update Page" — automations can write to page content
- [ ] Block-level targeting: "Update block blk_xyz in page doc_abc with this content"
- [ ] Template pages: automation generates a page from a template, populating field references from table data

---

### Phase 4: Collaboration & Nesting

#### 4.1 Real-Time Collaboration

- [ ] Hocuspocus server integration for Y.js-based real-time sync
- [ ] Presence indicators: show who else is viewing/editing the page
- [ ] Cursor positions: show collaborator cursors in real-time
- [ ] Conflict resolution: Y.js handles merges at the block level using block UUIDs
- [ ] Offline support: queue changes locally, sync on reconnect

#### 4.2 Nested Pages

- [ ] Activate `parent_id` column: UI for creating sub-pages
- [ ] Tree view in sidebar with expand/collapse
- [ ] Breadcrumb navigation within nested page hierarchy
- [ ] Drag-to-reparent in sidebar
- [ ] `order` scoped within `parent_id` for sibling ordering

#### 4.3 Block-Level Comments

- [ ] Comment anchored to block UUID
- [ ] Comment thread UI: inline markers in the page, sidebar thread list
- [ ] Resolve/unresolve comments
- [ ] Mention users in comments (reuse `nc_mentions_v2`)

#### 4.4 Page-Level Permissions (EE)

- [ ] Per-page permission overrides (beyond base-level inheritance)
- [ ] Block-level visibility rules (enterprise): "this section visible to role X only"
- [ ] Lock page: prevent edits without explicit unlock

---

## Decisions Deferred

| Decision | Why Deferred | When to Revisit |
|----------|-------------|-----------------|
| Block-level storage (each block is a DB row) | Premature optimization; document-level storage with block UUIDs in JSON is sufficient until pages routinely exceed 1000+ blocks | When partial loading / lazy rendering becomes a real performance need |
| Page templates | Nice-to-have, not structural | After v1 ships and usage patterns emerge |
| Public sharing / published pages | Requires auth model changes, CDN strategy | After collaboration is stable |
| Page SEO / slug-based URLs | Only relevant for published pages | After public sharing |
| Cross-base page references | Requires cross-base mention resolution | After mentions system proves stable within a single base |
| AI-generated pages | Requires automation integration + template system | Phase 3 |

---

## Relationship to Existing Rich Text Cells

Pages and rich text cells are **separate features** that share tooling but diverge at the storage boundary.

| Aspect | Rich Text Cells | Pages |
|--------|----------------|-------|
| Storage format | Raw markdown (TEXT column) | ProseMirror JSON (JSONB column) |
| Serialization | Custom `tiptap-markdown` layer | Tiptap native `getJSON()` / `setContent()` |
| Mention storage | Inline in markdown string | Relational `nc_mentions_v2` table |
| Search | SQL LIKE on raw markdown | SQL on `content_text` (stripped plaintext) |
| Versioning | None | `nc_doc_versions_v2` with pruning |
| Collaboration | Last-write-wins, no detection | Optimistic concurrency (v1), Y.js (v4) |
| Sanitization | Frontend-only (DOMPurify) | Server-side JSON schema validation + frontend |
| Scope | Single cell value | Full document within a base |

The Tiptap editor instance, extensions (bold, italic, lists, mentions, etc.), and UI components (bubble menus, formatting toolbar) are shared. The `Markdown` extension is used only by cells; pages use Tiptap's native JSON.

Over time, the mentions backfill (Phase 2.4) unifies the mention system. The cell editor continues to store markdown but dual-writes mentions to `nc_mentions_v2`.

---

## Key Risk: The "Just Add Markdown Pages" Trap

The easiest v1 is a markdown editor that saves to a TEXT column. Every decision in this document exists to avoid that path — not because it doesn't work for v1, but because it creates a migration cliff for every subsequent phase. ProseMirror JSON, block UUIDs, relational mentions, and optimistic concurrency are all v1 costs that pay for themselves by making phases 2-4 additive rather than migratory.
