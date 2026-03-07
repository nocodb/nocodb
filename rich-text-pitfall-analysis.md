# Rich Text Implementation: Architectural Pitfall Analysis

**Date:** 2026-02-19
**Scope:** NocoDB Rich Text (LongText cell with `richMode` flag)
**Reviewer:** Independent Senior Architect Review

---

## How It Works Today

Rich Text is a mode on the `LongText` column, toggled via `column.meta.richMode`. The frontend uses a **Tiptap/ProseMirror** editor that reads and writes **raw Markdown**. The backend stores that markdown as a plain `TEXT` column in the underlying database (Postgres/MySQL/SQLite). The API returns the raw markdown string; the frontend is solely responsible for parsing and rendering it.

The custom `tiptap-markdown` layer (~33 extension files) handles the bidirectional conversion: markdown-it parses markdown to HTML for ProseMirror, and a custom `MarkdownSerializer` converts ProseMirror documents back to markdown on every keystroke.

---

## 1. Security: No Server-Side Sanitization

**Severity: High**

The backend field handler (`long-text.general.handler.ts`) only validates content *length* (`NC_MAX_TEXT_LENGTH`). It does not sanitize HTML, validate markdown structure, or strip dangerous content. The full data flow is:

```
User Input → toString() → length check → raw INSERT into TEXT column
```

This means the database will happily store `<script>alert('xss')</script>` or `<img onerror="..." src="x">` embedded in markdown. The entire XSS defense rests on the frontend's `markdown-it` parser and `vue-dompurify-html` plugin.

**Why this is dangerous:**

- Any API consumer that renders the raw markdown without sanitization is vulnerable. NocoDB's own API docs don't warn about this.
- The markdown-it instance is initialized with `html: true` (see `Markdown.ts` line 12), meaning raw HTML passthrough is *enabled by default*. If DOMPurify is ever bypassed, misconfigured, or not applied in a rendering path, stored XSS is possible.
- Public form submissions from anonymous users go through the same zero-sanitization path, making this a persistent XSS vector from unauthenticated sources.
- Webhooks and notification templates receive raw markdown including any embedded HTML, which could trigger unexpected behavior in downstream systems.

**Recommendation:** Add server-side sanitization (e.g., `sanitize-html` or `DOMPurify` in Node) before storage. This provides defense-in-depth regardless of frontend behavior or API consumer discipline.

---

## 2. Markdown as the Storage Format: A Lossy Abstraction

**Severity: Medium**

Storing raw markdown instead of ProseMirror's native JSON document model creates a lossy round-trip:

```
ProseMirror Doc → MarkdownSerializer → markdown string → DB
DB → markdown string → markdown-it → HTML → ProseMirror Doc
```

Every save serializes to markdown; every load parses it back. This round-trip is **not lossless**. Examples of information that can be lost or mangled:

- **Whitespace and line breaks**: The serializer and parser handle whitespace differently. The `<br />` → `<br>` replacement in `Markdown.ts` line 46 is a symptom of this.
- **Nested structures**: Complex nesting (e.g., a blockquote containing a task list containing a link) may not survive the round-trip identically.
- **HTML fragments**: Since `html: true` is enabled, users can insert raw HTML that markdown-it may interpret differently on re-parse.
- **Mention format fragility**: Mentions are stored as `@(userId|email|displayName)` in the markdown string. If a display name contains `)` or `|`, the regex extractor (`/@\(([^)]+)\)/g` in `richTextHelper.ts`) will break. No escaping is performed.

**Recommendation:** Consider storing ProseMirror JSON as the canonical format (it's already the internal editor state). Markdown can be derived on read for API consumers. This eliminates round-trip loss and makes server-side processing (search indexing, mention extraction) more reliable.

---

## 3. Search and Filters Operate on Raw Markdown

**Severity: Medium**

All text-based filters (`is like`, `contains`, `is equal`, etc.) and global search run SQL `LIKE` queries against the raw markdown string in the database. This means:

- Searching for "bold text" will NOT match `**bold text**` because the asterisks are part of the stored string.
- Searching for "click here" will NOT match `[click here](https://example.com)` because the link syntax wraps it.
- Searching for `@` will match every mention in the system (`@(userId|email|name)` format), producing noisy results.
- Sorting is alphabetical on the markdown source, so `# Heading` sorts before `A paragraph` due to the `#` character.

Users who switch a column from plain LongText to Rich Text will find that their existing filters and search behavior subtly changes.

**Recommendation:** Maintain a parallel plaintext-stripped column or computed index for search/filter operations. Alternatively, apply a markdown-strip function at query time (though this has performance implications).

---

## 4. Canvas Grid Renderer: Parsing on Every Frame

**Severity: Medium-High**

The canvas grid cell renderer (`canvas/cells/LongText.ts`) calls `renderMarkdown()` for every rich text cell visible on screen. This function parses the markdown string, computes layout, and draws to canvas. There is an LRU cache (`markdownTextCache`, 1000 entries), but:

- Cache keys include cell dimensions, font, and content. Any row height change invalidates the entire cache.
- Hovering, selecting, or scrolling can trigger re-renders of all visible cells.
- A grid with 50 visible rows of rich text means 50 markdown parse operations per render cycle.
- Complex markdown (nested lists, tables, code blocks) is significantly more expensive to parse than plain text.

The link click-target detection also runs at render time (extracting URLs from rendered markdown and storing hit regions), adding overhead per frame.

**Recommendation:** Separate the parse step from the render step. Parse markdown once on data load, cache the parsed AST/layout, and only re-render the cached layout on scroll/paint. Invalidate only the specific cells whose content changed.

---

## 5. No Collaborative Editing or Conflict Resolution

**Severity: High (for multi-user deployments)**

Rich text cells use last-write-wins semantics. There is no Operational Transformation, CRDT, or even optimistic concurrency control. If User A and User B edit the same rich text cell simultaneously:

1. Both load the same markdown string.
2. Both make different edits in their Tiptap editors.
3. Whoever saves last overwrites the other's changes silently.

This is worse than plain text last-write-wins because rich text edits are structurally richer (reformatting a paragraph, adding a list item, etc.) and users invest more effort in formatting. The mention system compounds this: if User A's save is overwritten, the mentions they added are silently lost, and the mentioned users never get notified.

The `handleRichTextMentions()` method in `BaseModelSqlv2.ts` only compares the *final* stored state against the previous state. It has no awareness of concurrent edits.

**Recommendation:** At minimum, add optimistic locking (version column or ETag) so concurrent edits are detected and one user gets a conflict error. For a better UX, consider Y.js or similar CRDT integration with the Tiptap editor for real-time collaborative editing.

---

## 6. Export Produces Raw Markdown

**Severity: Medium**

CSV and Excel exports write the raw markdown string into cells. A user exporting a table will see:

```
"**Project Alpha** - due [next week](https://pm.tool/123)\n\n- [ ] Task 1\n- [x] Task 2"
```

...instead of formatted text. This is confusing for non-technical users who expect the export to look like what they see in the grid. Excel's cell format doesn't render markdown, so all syntax characters appear as literal text.

There's no option to export as stripped plaintext either.

**Recommendation:** Offer an export option to strip markdown to plaintext. For Excel specifically, consider converting markdown formatting to Excel cell formatting (bold → Excel bold, etc.) using the XLSX library's formatting capabilities.

---

## 7. Mention System is Tightly Coupled to Markdown Syntax

**Severity: Medium**

Mentions are embedded inline in the markdown string as `@(userId|email|displayName)`. This has several issues:

- **No separate relational storage**: To find "all cells that mention User X," you'd need to `LIKE '%@(usr_xyz%'` across all rich text columns in all tables. There's no junction table for cell-mention relationships.
- **Fragile extraction**: The regex `/@\(([^)]+)\)/g` in `richTextHelper.ts` doesn't handle edge cases: display names containing `)` or `|` will break parsing. No escaping is applied when serializing mentions.
- **Copy-paste across workspaces**: Mentions are workspace-scoped user IDs. Pasting a mention from Workspace A into Workspace B produces a broken reference with no error. The `@(usr_abc|...)` string persists but points to a non-existent user in the target workspace.
- **User deletion/rename**: When a user is deleted or changes their display name, existing mentions in markdown are stale. The stored `displayName` in the markdown string is never updated.
- **Notification timing**: Mentions are extracted *after* the database write (`handleRichTextMentions` runs post-insert). If the write succeeds but mention processing fails, notifications are silently lost.

**Recommendation:** Store mentions in a separate relational table (`cell_mentions`) with foreign keys to users and cells. The markdown can still contain a mention placeholder, but the source of truth for "who is mentioned where" should be a proper relational structure.

---

## 8. richMode Toggle is a One-Way Formatting Door

**Severity: Low-Medium**

When a user toggles `richMode` on a LongText column, existing plain text becomes interpretable as markdown. The string `**not bold**` that was previously literal text is now rendered as **not bold**. Conversely, toggling richMode *off* leaves markdown syntax visible as literal characters.

The column config UI (`LongTextOptions.vue`) clears the default value (`cdf`) on toggle, but does NOT transform existing cell data. There's no migration or warning about how existing content will be reinterpreted.

This also interacts with the AI text generation feature: `richMode` and `ai` mode are mutually exclusive in the UI, but there's no backend constraint enforcing this. Setting both `meta.richMode = true` and `meta.ai = true` via the API is not prevented.

**Recommendation:** Show a confirmation dialog when toggling richMode that warns about reinterpretation of existing data. Consider offering a bulk migration option (escape existing markdown syntax when turning on, strip syntax when turning off). Add a backend validation to enforce mutual exclusivity of `richMode` and `ai`.

---

## 9. Frontend-Heavy Architecture Creates Inconsistent Rendering

**Severity: Medium**

Because the backend stores and returns raw markdown with no processing, every rendering surface must independently implement markdown parsing:

- **Tiptap editor**: Uses the custom `tiptap-markdown` layer (33 extension files) with markdown-it.
- **Canvas grid**: Uses a separate `renderMarkdown()` utility with its own parsing logic.
- **Gallery/Kanban views**: Render via `tag?.renderAsTag` with yet another rendering path.
- **Comments (RichComment.vue)**: Uses a shared Tiptap instance but with different extension configuration.
- **Notifications/emails**: Use React/JSX templates that receive raw markdown.

Each of these surfaces can render the same markdown slightly differently. The Tiptap editor and canvas renderer don't share a parser. A markdown string that renders correctly in the editor might look different in the grid, and different again in an email notification.

**Recommendation:** Create a single, shared markdown processing module used by all rendering surfaces. If storing ProseMirror JSON (see point 2), a single `renderToPlaintext()` and `renderToHtml()` function on the server can serve all consumers.

---

## 10. Commented-Out Validation is a Red Flag

**Severity: Low (but symptomatic)**

In `long-text.general.handler.ts` (lines 29-45), there's a block of commented-out validation logic:

```typescript
// if (typeof params.value !== 'string') {
//   NcError.invalidValueForField({...});
// }
// if (Number(params.column.dtxp) > 0 && params.value.length > Number(params.column.dtxp)) {
//   NcError.invalidValueForField({...});
// }
```

This suggests type validation and column-precision enforcement were attempted but abandoned. The remaining validation is just the global `NC_MAX_TEXT_LENGTH` check. This means:

- Non-string values (objects, arrays) are silently coerced via `toString()`, potentially producing `[object Object]` in the database.
- Database column precision (`dtxp`) is ignored, which could cause silent truncation at the database level for MySQL `VARCHAR(n)` columns.

**Recommendation:** Uncomment and fix the type validation. At minimum, reject non-string, non-null inputs that aren't AI prompt objects. Enforce `dtxp` limits with a clear error message rather than relying on database-level truncation.

---

## Summary

| # | Pitfall | Severity | Category |
|---|---------|----------|----------|
| 1 | No server-side sanitization; XSS defense is frontend-only | High | Security |
| 2 | Markdown as storage format creates lossy round-trips | Medium | Architecture |
| 3 | Search/filters operate on raw markdown, not semantic text | Medium | Functionality |
| 4 | Canvas renderer parses markdown on every frame | Medium-High | Performance |
| 5 | No collaborative editing; last-write-wins loses data | High | Collaboration |
| 6 | Exports produce raw markdown, not formatted/plain text | Medium | UX |
| 7 | Mentions embedded in markdown with no relational backing | Medium | Data Model |
| 8 | richMode toggle reinterprets existing data silently | Low-Medium | UX |
| 9 | Multiple independent rendering surfaces produce inconsistent output | Medium | Architecture |
| 10 | Commented-out validation suggests incomplete input handling | Low | Code Quality |
