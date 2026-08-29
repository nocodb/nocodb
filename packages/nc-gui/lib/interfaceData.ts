import type { Ref } from 'vue'
import type { FilterType, InterfacePageType, InterfaceVizFieldConfig, PaginatedType, SortType, TableType } from 'nocodb-sdk'

/** Environment a consumer-facing interface page renders against. */
export type InterfacePageDataEnv = 'draft' | 'published'

/**
 * Prefix of synthetic interface view ids (see `buildInterfaceSyntheticView` in
 * `ee/utils/interfaceViewUtils.ts`, which imports this constant) — the prefix
 * guarantees they can never collide with real view ids. Defined in this CE lib
 * so CE code (e.g. `store/views.ts`) can detect synthetic views without
 * importing from `ee/`.
 */
export const INTERFACE_VIEW_ID_PREFIX = 'nc-interface-'

/**
 * Synthetic interface views are client-fabricated — the server has never heard
 * of them, so server-computed per-view data (e.g. a realtime event's
 * `matchedViewIds`) can never reference them. Realtime handlers must skip any
 * "my view id is absent → row filtered out" conclusion for these views, or
 * every broadcast wrongly evicts the row from interface visualizations.
 */
export function isInterfaceSyntheticViewId(viewId?: string | null): boolean {
  return !!viewId?.startsWith(INTERFACE_VIEW_ID_PREFIX)
}

/**
 * Suffix for a DATA_EVENT subscription key made from an interface page — the
 * server parses `:iface:{pageId}:{vizId}:{env}` and joins the socket into a
 * page-scoped room (interface-grant gated, viz filters + field allow-list
 * applied at broadcast time) instead of the base-role-gated table room.
 * Empty string outside interface pages (or on public shares).
 */
export function interfaceDataEventSuffix(
  api?: { realtimeScope?(): { pageId: string; vizId: string; env: string } | null } | null,
): string {
  // Optional MEMBER access too — the record sheet's forwarding proxy is always
  // truthy but forwards `undefined` per member on adapterless opens.
  const scope = api?.realtimeScope?.()
  if (!scope) return ''
  return `:iface:${scope.pageId}:${scope.vizId}:${scope.env}`
}

/**
 * One row of the list viz's leveled response (`fetchLeveledList`) — the List
 * view CTE engine's markers ride on every record: `__nc_depth` (0 = top
 * level, N-1 = leaf), `__nc_pk`, `__nc_parent_id` (pk of the record's parent
 * one level up) and `__nc_row_type` (the row's table/model id). Parents are
 * first-class rows interleaved before their children; pagination walks the
 * flattened tree.
 */
export type InterfaceLeveledRow = Record<string, any> & {
  __nc_depth: number
  __nc_pk: string | number
  __nc_parent_id: string | number | null
  __nc_row_type: string
  /** Nested-records (self-link tree) metadata — leaf rows only, when enabled. */
  __nc_nest?: number
  __nc_self_parent?: string | number | null
  __nc_has_nested?: boolean
}

/**
 * Data adapter contract for smartsheet components mounted inside an interface
 * page. Interface-page wrappers provide an implementation via
 * `InterfacePageDataInj` (see `context/index.ts`); the CE data composables
 * (`useInfiniteData`, `useKanbanViewStore`, ...) route their data calls through
 * it instead of the view/shared-view endpoints when it is present.
 *
 * The implementation lives in EE (`ee/composables/useInterfacePageData.ts`) —
 * only the contract + inject token are CE so CE never imports from `ee/`.
 */
export interface InterfacePageDataApi {
  fetchList(params: {
    limit?: number
    offset?: number
    where?: string
    /**
     * Group-nesting predicate (per-group row loads of the grid group-by) —
     * kept apart from `where` (search) since the server gates the two
     * differently: `where` follows the Search action, this always applies.
     */
    nestedWhere?: string
    /**
     * Same nesting predicate as a filter array (canvas grid) — kept apart
     * from `filtersArr` (end-user ad-hoc filters, gated on the Filter
     * action); this always applies.
     */
    nestedFiltersArr?: FilterType[]
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Leveled rows for a LIST viz with configured levels — the List view CTE
   * engine over the viz config (Postgres/default sources only; other sources
   * reject). `pageInfo.totalRows` counts the flattened tree (parents
   * included).
   */
  fetchLeveledList(params: {
    limit?: number
    offset?: number
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
    /** Collapsed parents per depth (JSON) — server prunes their subtrees. */
    collapsed?: string
  }): Promise<{ list: InterfaceLeveledRow[]; pageInfo: PaginatedType }>
  /**
   * Per-model row counts + flattened total for a LIST viz's levels — powers the
   * canvas list's virtual-scroll height math. `counts` is keyed by model id.
   */
  fetchLeveledCount(params: {
    where?: string
    filtersArr?: FilterType[]
    collapsed?: string
  }): Promise<{ totalRows: number; counts: Record<string, number> }>
  fetchCount(params: {
    where?: string
    filtersArr?: FilterType[]
    /** Group-nesting predicate (per-group counts) — always applied, unlike `filtersArr`. */
    nestedFiltersArr?: FilterType[]
  }): Promise<{ count: number }>
  /**
   * Enqueue a server-side CSV export of this page/viz scope (builder-opt-in
   * via the page's Advanced `allow_csv_export` toggle). The server resolves
   * the exact same composed scope as `fetchList` — grants, draft/published
   * env, builder ∧ user-filter ∧ ad-hoc filters, field allow-list — and
   * returns a job id; poll the job for the presigned download URL.
   */
  exportCsv(params?: { where?: string; sortsArr?: SortType[]; filtersArr?: FilterType[] }): Promise<{ id: string }>
  /**
   * Grid group-by headers — distinct group keys + counts for one nesting
   * level. `pageInfo.totalRows` carries the exact total group count.
   */
  fetchGroupBy(params: {
    limit?: number
    offset?: number
    where?: string
    /** Grouping column title. */
    column_name: string
    /** Next nesting level's column title — adds `__sub_group_count__` per group. */
    subGroupColumnName?: string
    /** Group-key ordering (`+Title` / `-Title` / `~+Title` / `~-Title`). */
    sort?: string
    /** Parent-group nesting predicate — always applied, unlike `filtersArr`. */
    nestedFiltersArr?: FilterType[]
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Calendar viz date-window rows — the server resolves the viz's
   * `date_ranges` and composes the window-overlap predicate. `from/to` bound
   * the visible window; `prev/next` are the exclusive day boundaries (same
   * params as the per-view calendar data endpoint).
   */
  fetchCalendarData(params: {
    from_date: string
    to_date: string
    prev_date: string
    next_date: string
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Dates carrying records inside a window (+ total count) — powers the
   * calendar's active-date dots and the too-many-records warning.
   */
  fetchCalendarActiveDates(params: {
    from_date: string
    to_date: string
    prev_date: string
    next_date: string
    where?: string
    filtersArr?: FilterType[]
  }): Promise<{ count: number; dates: string[] }>
  /**
   * Timeline viz date-window rows — the server composes the bar-overlap
   * predicate from the viz's `date_ranges` and caps the response like the
   * per-view timeline data endpoint.
   */
  fetchTimelineData(params: {
    from_date: string
    to_date: string
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Gantt viz rows — windowless calls page by offset/limit in chronological
   * (start-date) order; passing `from/to` adds the bar-overlap predicate
   * (same modes as the per-view gantt data endpoint).
   */
  fetchGanttData(params: {
    limit?: number
    offset?: number
    from_date?: string
    to_date?: string
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Gantt dependency-edge graph — `[childPk, parentPk]` pairs from the
   * table-level DateDependency rule's linkrow column, scoped to the viz's
   * composed filters (same shape as the per-view `/deps` endpoint). Empty
   * when the viz has dependencies off or no rule is configured.
   */
  fetchGanttDeps(): Promise<{ edges: Array<[string, string]> }>
  /** Grouped (kanban stack) load — the stacking column is resolved server-side from the viz config. */
  fetchGroupedData(params: {
    limit?: number
    offset?: number
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
    /**
     * Restrict the group-by to these stack titles (`null` = uncategorized) so
     * a high-cardinality board can load one visible window at a time instead
     * of every stack upfront. Purely narrowing — omitting it returns every
     * group, and the server clamps the list to the stacking column's real
     * options. Counts still come back for ALL stacks (the count query is a
     * single GROUP BY), matching the per-view kanban's behaviour.
     */
    stackTitles?: (string | null)[]
  }): Promise<Array<{ key: string; value: { list: Record<string, any>[]; pageInfo: PaginatedType } }>>
  insertRow(data: Record<string, any>, opts?: { before?: string }): Promise<Record<string, any>>
  /**
   * Full-fidelity duplicate — the server reads the source row, so fields
   * outside the viz's allow-list survive the copy. Optional on older adapters.
   */
  duplicateRow?(rowId: string, opts?: { before?: string }): Promise<Record<string, any>>
  updateRow(rowId: string, data: Record<string, any>): Promise<Record<string, any>>
  /** Bulk inline cell edits (range paste) — multi-row twin of `updateRow`. */
  bulkUpdateRows?(rows: Array<{ rowId: string; data: Record<string, any> }>): Promise<boolean>
  deleteRow(rowId: string): Promise<boolean>
  bulkDeleteRows(rowIds: string[]): Promise<boolean>
  /**
   * Read a single record within the page scope (record expansion). Bounded by
   * the composed page ∧ viz ∧ user-filter conditions and projected to the viz
   * field allow-list — so an interface-only consumer can expand a row without
   * base access. Returns `null` when unavailable (e.g. public share) so the
   * caller keeps the list-projected values it already has.
   */
  fetchRecord?(rowId: string): Promise<Record<string, any> | null>
  /**
   * Bulk comment counts for the grid's row badges — the interface-scoped
   * `interfaceCommentCount` against the viz's bound record-detail page (the
   * page the badge's click leads to). Returns `null` when badges don't apply
   * on this viz: row click doesn't open a bound detail layout, its Comments
   * toggle is off, or the surface is a public share.
   */
  commentCounts?(rowIds: string[]): Promise<Array<{ row_id: string; count: number | string }> | null>
  /**
   * Create a record through a FORM / record-detail page (interface-scoped),
   * stripped to the page's configured field set. Editor-capable grant only.
   */
  createRecord?(data: Record<string, any>): Promise<Record<string, any>>
  /**
   * Linked records of one LTAR cell within the page scope — pk + display
   * value by default, or the related-table fields named in `fields`
   * (comma-separated titles; the LTAR cards/embedded-view renderers).
   * Optional display-value search. Read-tier: any grant that sees the page
   * can expand the cell.
   */
  nestedList?(params: {
    rowId: string
    columnId: string
    limit?: number
    offset?: number
    search?: string
    /**
     * The record-form field element requesting the read — the server gates
     * `fields` on that element's allow-list (its viz curation, else the
     * related table's non-system columns). Omit it and `fields` is ignored,
     * leaving the pk + display-value default.
     */
    fieldElementId?: string
    /**
     * Page whose config carries `fieldElementId` when it is NOT this
     * adapter's page — overlay record-detail sheets read through their
     * origin viz's adapter while their elements live on the sheet's page.
     */
    fieldPageId?: string
    fields?: string
    /** Related-table where/sort (data-API grammar) — the LTAR embedded-viz renderers. */
    where?: string
    sort?: string
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * "Link record" picker candidates (related rows NOT yet linked) — same
   * projection/search contract as `nestedList`. Editor-gated like the link
   * write it precedes. Element addressing scopes the candidates to the
   * field's "Link/unlink records" selection filter server-side.
   */
  nestedExcludedList?(params: {
    rowId: string
    columnId: string
    limit?: number
    offset?: number
    search?: string
    fieldElementId?: string
    fieldPageId?: string
    /** Allow-listed related-table field titles — the picker's card rows. */
    fields?: string
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  /**
   * Link records into an LTAR cell — gated like an inline cell edit, or (when
   * element-addressed) through the element's own "Link/unlink records" grant.
   */
  nestedLink?(params: {
    rowId: string
    columnId: string
    refRowIds: (string | number)[]
    fieldElementId?: string
    fieldPageId?: string
  }): Promise<boolean>
  /** Unlink records from an LTAR cell — same gating as `nestedLink`. */
  nestedUnlink?(params: {
    rowId: string
    columnId: string
    refRowIds: (string | number)[]
    fieldElementId?: string
    fieldPageId?: string
  }): Promise<boolean>
  /**
   * Single-cell LTAR copy/paste or clear-all (the structured cell paste) —
   * every entry's column/row is validated against the page scope server-side.
   * Same wire response as the base op: the applied `{link, unlink}` diff.
   */
  nestedCopyPaste?(
    operations: Array<{
      operation: 'copy' | 'paste' | 'deleteAll'
      rowId: string
      columnId: string
      fk_related_model_id: string
    }>,
  ): Promise<{ link: any[]; unlink: any[] } | undefined>
  /** Bulk (multi-cell range) twin of `nestedCopyPaste`. */
  nestedBulkCopyPaste?(
    data: Array<{
      columnId: string
      data: Array<{
        operation: 'copy' | 'paste' | 'deleteAll'
        rowId: string
        columnId: string
        fk_related_model_id: string
      }>
    }>,
  ): Promise<unknown>
  /** Plain-text paste into LTAR cells — display values resolved to links server-side. */
  nestedBulkLinkByDisplay?(data: Array<{ columnId: string; rowId: string; displayValues: string[] }>): Promise<unknown>
  /**
   * Trigger a Button field's manual webhook — the hook resolves server-side
   * from the column (never a caller-supplied hook id). Editor-gated.
   */
  triggerButtonHook?(params: { rowId: string; columnId: string }): Promise<unknown>
  /**
   * Identity of the page/viz this api serves — appended to the DATA_EVENT
   * subscription key (see `interfaceDataEventSuffix`) so the server routes
   * the socket into the page-scoped realtime room (grant-gated, filters +
   * field allow-list enforced server-side) instead of the base-role-gated
   * table room. `null` on public shares (no authenticated socket).
   */
  realtimeScope(): { pageId: string; vizId: string; env: InterfacePageDataEnv } | null
  /**
   * Per-viewer narrowing as filter roots — the resolved user-filter element
   * selection (tabs / dropdown, mirroring the server's fail-closed rules)
   * plus any group-level ad-hoc filters. The scoped realtime room only
   * enforces the builder scope, so realtime handlers AND these client-side
   * before applying pushed rows.
   */
  viewerScopeFilters(): FilterType[]
  /** viz-config editability gates the UI */
  canEditInline: Ref<boolean>
  canAddDeleteInline: Ref<boolean>
  /**
   * Builder edit mode — gates the grid header field menu (the 3-dot
   * Edit/Hide). Absent or false (published / consumer) renders no header
   * field affordance at all.
   */
  canConfigureFields?: Ref<boolean>
  /** Hide a field from THIS viz (writes viz `visible_field_ids`, not view columns). */
  hideField?: (columnId: string) => void
  /** Persist a footer/group-header summary pick for this viz (builder only —
   *  writes viz `field_configs[columnId].aggregation`; absent = picks stay
   *  session-local, the consumer-runtime behaviour). */
  setFieldAggregation?: (columnId: string, aggregation: string) => void
  /**
   * Persist a header RESIZE for this viz — writes viz
   * `field_configs[columnId].width`. The source table's own grid views are
   * never touched (the view-column write stays gated on `!isPublic`, and an
   * interface mount is always "public"). Absent = the resize stays
   * session-local, the consumer-runtime behaviour.
   */
  setFieldWidth?: (columnId: string, width: string) => void
  /**
   * Persist a header DRAG-REORDER for this viz — writes viz `field_order` with
   * the shown columns in their new order. Same builder-only / no-native-write
   * contract as `setFieldWidth`.
   */
  setFieldOrder?: (orderedColumnIds: string[]) => void
  /** Frozen field count for a grid viz (reactive; the canvas reads it instead of grid view meta). */
  frozenFieldCount?: Ref<number | undefined>
  /**
   * Persist the freeze-divider drag for this viz — writes viz
   * `frozen_column_count` (1-3). Same builder-only / no-native-write contract
   * as `setFieldWidth`; absent = the divider is not adjustable.
   */
  setFrozenFieldCount?: (count: number) => void
  /** Open this column's Field pane in the properties panel (builder canvas). */
  openFieldPane?: (columnId: string) => void
  /** Close the active column Field pane (builder canvas field deselect). */
  closeFieldPane?: () => void
  /** Per-column overrides (label / inline-edit) keyed by column id — the grid
   *  header reads its label override from here (reactive → redraw on change). */
  fieldConfigs?: Ref<Record<string, InterfaceVizFieldConfig>>
  /**
   * Summary-bar aggregations (grid viz) — explicit `(column id, type)` pairs;
   * resolves to `{ [column title]: value }` like the per-view aggregate op.
   */
  fetchAggregate?: (params: {
    aggregation: Array<{ field: string; type: string }>
    where?: string
    filtersArr?: FilterType[]
  }) => Promise<Record<string, any>>
  /** Per-group aggregations (group-by headers) — one filter bucket per group, keyed by alias. */
  fetchBulkAggregate?: (params: {
    aggregation: Array<{ field: string; type: string }>
    where?: string
    filtersArr?: FilterType[]
    bulkFilterList: Array<{ alias: string; where?: string; filterArrJson?: string }>
  }) => Promise<Record<string, Record<string, any>>>
}

/**
 * Record-sidebar adapter for the comment + revision-history panels of an
 * interface record overlay — the record-scoped sibling of
 * `InterfacePageDataApi`. Provided by the overlay via `InterfaceRecordSidebarInj`;
 * when present, the base comment/audit composables (`useRowComments`,
 * `useExpandedFormStore`) route their network calls through it — the
 * interface-scoped `interfaceComment*` / `interfaceRecordAuditList` ops (grant +
 * builder-toggle + record-scope gated) — instead of the base ops, so
 * interface-only consumers can use them. Thin network wrappers: the composables
 * keep their own optimistic updates + user/cursor post-processing.
 */
export interface InterfaceRecordSidebarApi {
  commentList(rowId: string): Promise<{ list: any[] }>
  commentRow(rowId: string, body: { comment: string; attachments?: any[]; meta?: any; parent_comment_id?: string }): Promise<any>
  commentUpdate(commentId: string, body: Record<string, any>): Promise<any>
  commentDelete(commentId: string): Promise<any>
  commentResolve(commentId: string): Promise<any>
  recordAuditList(rowId: string, cursor?: string): Promise<{ list: any[]; pageInfo?: any }>
  /** The record bell — per-user comment-notification preference. */
  commentNotificationPreferenceGet(rowId: string): Promise<{ preference: 'all' | 'mentions' }>
  commentNotificationPreferenceSet(rowId: string, preference: 'all' | 'mentions'): Promise<{ preference: 'all' | 'mentions' }>
}

/**
 * Public share-to-web consumer context for interface-page renderers. Provided
 * by the anonymous shared-page route (EE `interface/consumer/PublicPage.vue`)
 * via `InterfacePublicPageInj` (see `context/index.ts`); when present, the
 * page renderers prefer this page/meta over the builder store and the data
 * adapter routes through the public REST endpoints. Null in normal
 * (authenticated) contexts.
 */
export interface InterfacePublicPageState {
  /** The shared page — `config`/`published_config` hold the published snapshot. */
  page: InterfacePageType
  /** Projected source-table meta (TABLE layout only). */
  tableMeta?: TableType
  /** Public-share credentials for the public data endpoints. */
  share: { uuid: string; password: string }
  /**
   * TABLE layout: the page's source table was deleted (server-detected, since
   * public viewers can't list base tables) — drives the "Table deleted" badge.
   */
  sourceTableDeleted?: boolean
  /** DASHBOARD layout: 'view' widget ids whose bound table was deleted. */
  deletedViewWidgetIds?: string[]
}
