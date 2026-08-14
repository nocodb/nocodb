import type {
  ColumnType,
  FilterType,
  InterfaceGalleryVizTheme,
  InterfaceKanbanVizTheme,
  SourceType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import type { ComputedRef, Reactive, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { InterfacePageDataApi, InterfacePublicPageState, InterfaceRecordSidebarApi } from '../lib/interfaceData'
import type { LinkRecordDropdownVariant, Row } from '../lib/types'
import type { PageSidebarNode } from '#imports'

export type ExtractInjectedRef<T> = T extends InjectionKey<Ref<infer U>> ? U : never
export type ExtractInjectedReactive<T> = T extends InjectionKey<Reactive<infer U>> ? U : never

export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const IsPublicInj: InjectionKey<Ref<boolean>> = Symbol('is-public')
export const IsInFilterInj: InjectionKey<Ref<boolean>> = Symbol('is-in-filter')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('column-injection')
export const GroupPathInj: InjectionKey<Ref<ColumnType>> = Symbol('group-path-injection')
export const CanvasColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('canvas-column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType> | Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem> | Ref<TabItem>> = Symbol('tab-meta-injection')
export const IsFormInj: InjectionKey<Ref<boolean>> = Symbol('is-form-injection')
export const FormFieldAutocompleteInj: InjectionKey<Ref<string | undefined>> = Symbol('form-field-autocomplete-injection')
export const IsCalendarInj: InjectionKey<Ref<boolean>> = Symbol('is-calendar-injection')
export const IsTimelineInj: InjectionKey<Ref<boolean>> = Symbol('is-timeline-injection')
export const IsGanttInj: InjectionKey<Ref<boolean>> = Symbol('is-gantt-injection')
export const IsSurveyFormInj: InjectionKey<Ref<boolean>> = Symbol('is-survey-form-injection')
export const IsGridInj: InjectionKey<Ref<boolean>> = Symbol('is-grid-injection')
export const IsGroupByInj: InjectionKey<Ref<boolean>> = Symbol('is-group-by-injection')
export const IsGroupByLabelInj: InjectionKey<Ref<boolean>> = Symbol('is-group-by-label-injection')
export const IsGalleryInj: InjectionKey<Ref<boolean>> = Symbol('is-gallery-injection')
export const IsListInj: InjectionKey<Ref<boolean>> = Symbol('is-list-injection')
export const IsKanbanInj: InjectionKey<Ref<boolean>> = Symbol('is-kanban-injection')
export const IsDashboardInj: InjectionKey<Ref<boolean>> = Symbol('is-dashboard-injection')
export const IsLockedInj: InjectionKey<Ref<boolean>> = Symbol('is-locked-injection')
export const IsExpandedFormOpenInj: InjectionKey<Ref<boolean>> = Symbol('is-expanded-form-open-injection')
export const IsExpandedBulkUpdateFormOpenInj: InjectionKey<Ref<boolean>> = Symbol('is-expanded-bulk-update-form-open-injection')
export const CellValueInj: InjectionKey<Ref<any>> = Symbol('cell-value-injection')
export const ActiveViewInj: InjectionKey<Ref<ViewType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('readonly-injection')
export const IsAllowedInj: InjectionKey<Ref<boolean>> = Symbol('is-allowed-injection')
export const RawReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('raw-readonly-injection')
export const RowHeightInj: InjectionKey<Ref<1 | 2 | 4 | 6 | undefined>> = Symbol('row-height-injection')
/** Host-tuned attachment-card display (interface record layouts): show every
 *  attachment (no "+N more" pager), the larger tile size, and whether the
 *  full-screen viewer may offer comments/annotations (false = the host's
 *  Comments setting is off; absent = the viewer's own gates decide). */
export const AttachmentCellDisplayInj: InjectionKey<
  Ref<{ showAll?: boolean; largeTiles?: boolean; allowComments?: boolean } | null>
> = Symbol('attachment-cell-display-injection')
/** The attachment currently open in the full-screen viewer — the comments side
 *  panel tags new comments with it (pin-less annotation) so they count toward
 *  that image's badge. Absent/null = plain record comments. */
export const AttachmentViewerCommentAnchorInj: InjectionKey<Ref<{ path?: string; url?: string; title?: string } | null>> = Symbol(
  'attachment-viewer-comment-anchor-injection',
)
export const ScrollParentInj: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('scroll-parent-injection')
export const isWorkflowInj: InjectionKey<Ref<boolean>> = Symbol('is-workflow-injection')
/** when shouldShowLoading bool is passed, it indicates if a loading spinner should be visible while reloading */
export const ReloadViewDataHookInj: InjectionKey<
  EventHook<{
    shouldShowLoading?: boolean
    offset?: number
    isFormFieldFilters?: boolean
    isFromLinkRecord?: boolean
    relatedTableMetaId?: string
    rowId?: string
    path?: Array<number>
    skipLoadingRowId?: string
  } | void>
> = Symbol('reload-view-data-injection')
export const ReloadViewMetaHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-meta-injection')
export const ReloadVisibleDataHookInj: InjectionKey<EventHook<void>> = Symbol('reload-visible-data-injection')
export const ReloadRowDataHookInj: InjectionKey<EventHook<{ shouldShowLoading?: boolean; offset?: number } | void>> =
  Symbol('reload-row-data-injection')
export const ReloadAggregateHookInj: InjectionKey<
  EventHook<
    | {
        fields?: {
          title: string
          aggregation?: string
        }[]
        path?: Array<number>
      }
    | undefined
  >
> = Symbol('reload-aggregate-data-injection')
export const OpenNewRecordFormHookInj: InjectionKey<EventHook<void>> = Symbol('open-new-record-form-injection')
export const FieldsInj: InjectionKey<Ref<ColumnType[]>> = Symbol('fields-injection')
export const EditModeInj: InjectionKey<Ref<boolean>> = Symbol('edit-mode-injection')
export const SharedViewPasswordInj: InjectionKey<Ref<string | null>> = Symbol('shared-view-password-injection')
export const CellUrlDisableOverlayInj: InjectionKey<Ref<boolean>> = Symbol('cell-url-disable-url')
export const DropZoneRef: InjectionKey<Ref<Element | undefined>> = Symbol('drop-zone-ref')
export const CellClickHookInj: InjectionKey<EventHook<MouseEvent> | undefined> = Symbol('cell-click-injection')
export const CellEventHookInj: InjectionKey<EventHook<MouseEvent | KeyboardEvent | PointerEvent> | undefined> =
  Symbol('cell-event-injection')
export const OnDivDataCellEventHookInj: InjectionKey<EventHook<Event> | undefined> = Symbol('on-div-data-cell-event-injection')
export const SaveRowInj: InjectionKey<(() => void) | undefined> = Symbol('save-row-injection')
export const CurrentCellInj: InjectionKey<Ref<Element | undefined>> = Symbol('current-cell-injection')
export const IsUnderLookupInj: InjectionKey<Ref<boolean>> = Symbol('is-under-lookup-injection')
export const IsUnderFormulaInj: InjectionKey<Ref<boolean>> = Symbol('is-under-ltar-injection')
export const IsUnderLTARInj: InjectionKey<Ref<boolean>> = Symbol('is-under-lookup-injection')
export const DocsLocalPageInj: InjectionKey<Ref<PageSidebarNode | undefined>> = Symbol('docs-local-page-injection')
export const ProjectRoleInj: InjectionKey<Ref<string | string[]>> = Symbol('base-roles-injection')
export const ProjectStarredModeInj: InjectionKey<Ref<boolean>> = Symbol('base-starred-injection')
export const ProjectInj: InjectionKey<Ref<NcProject>> = Symbol('base-injection')
export const ProjectIdInj: InjectionKey<Ref<string>> = Symbol('base-id-injection')
export const EditColumnInj: InjectionKey<Ref<boolean>> = Symbol('edit-column-injection')
export const SidebarTableInj: InjectionKey<Ref<TableType>> = Symbol('sidebar-table-injection')
export const TreeViewInj: InjectionKey<{
  setMenuContext: (type: 'base' | 'base' | 'table' | 'main' | 'layout', value?: any) => void
  duplicateTable: (table: TableType) => void
  handleTableRename: (
    table: TableType,
    title: string,
    orignalTitle: string,
    updateTitle: (title: string) => void,
    disableTitleDiffCheck?: boolean,
  ) => void
  openViewDescriptionDialog: (view: ViewType) => void
  openScriptDescriptionDialog?: (script: any) => void
  openDashboardDescriptionDialog?: (dashboard: any) => void
  openWorkflowDescriptionDialog?: (workflow: any) => void
  openTableDescriptionDialog: (table: TableType) => void
  contextMenuTarget: { type?: 'base' | 'table' | 'main' | 'layout'; value?: any }
  tableRenameId: Ref<string>
}> = Symbol('tree-view-functions-injection')
export const CalendarViewTypeInj: InjectionKey<Ref<'week' | 'month' | 'day' | 'year'>> = Symbol('calendar-view-type-injection')
export const JsonExpandInj: InjectionKey<Ref<boolean>> = Symbol('json-expand-injection')
export const AllFiltersInj: InjectionKey<Ref<Record<string, FilterType[]>>> = Symbol('all-filters-injection')

export const IsAdminPanelInj: InjectionKey<Ref<boolean>> = Symbol('is-admin-panel-injection')
/**
 * `ActiveSourceInj` is an injection key for providing the active source context to Vue components.
 * This is mainly used in useRoles composable to get source level restriction configuration in GUI.
 */
export const ActiveSourceInj: InjectionKey<
  ComputedRef<
    SourceType & {
      meta?: Record<string, any>
    }
  >
> = Symbol('active-source-injection')

export const IsToolbarIconMode: InjectionKey<ComputedRef<boolean>> = Symbol('toolbar-icon-mode-injection')
export const FieldNameAlias: InjectionKey<ComputedRef<Record<string, string>> | Ref<Record<string, string>>> =
  Symbol('field-name-alias')
export const IsCanvasInjectionInj: InjectionKey<boolean> = Symbol('is-canvas-injection')
export const ClientMousePositionInj: InjectionKey<Reactive<{ clientX: number; clientY: number }>> = Symbol(
  'client-mouse-position-injection',
)
export const CanvasCellEventDataInj: InjectionKey<
  Reactive<{
    keyboardKey?: string
    event?: KeyboardEvent | MouseEvent | PointerEvent
  }>
> = Symbol('canvas-cell-event-data-injection')

// triggering this hook from within an editable cell will turn it into "selection state"
export const CanvasSelectCellInj: InjectionKey<EventHook | undefined> = Symbol('canvas-select-cell-inj')

export const IsLinkRecordDropdownInj: InjectionKey<Ref<boolean>> = Symbol('is-link-record-dropdown-injection')

export const PlanUpgraderClickHookInj: InjectionKey<EventHook<void>> = Symbol('plan-upgrader-click-hook-injection')

export const IsMiniSidebarInj: InjectionKey<Ref<boolean>> = Symbol('is-mini-sidebar-injection')

export const ExtensionConfigInj: InjectionKey<Ref<ExtensionConfigInjType> | ComputedRef<ExtensionConfigInjType>> =
  Symbol('extension-config-injection')

export const IsOrgBillingInj: InjectionKey<Ref<boolean>> = Symbol('is-org-billing-injection')

export const IsTemplateModeInj: InjectionKey<Ref<boolean>> = Symbol('is-template-mode-injection')

export const BlueprintParentTableIdInj: InjectionKey<Ref<string | undefined>> = Symbol('blueprint-parent-table-id-injection')

/** Breadcrumb trail for nested sub-record forms (e.g., ['Project Template', 'Tasks']) */
export const TemplateBreadcrumbsInj: InjectionKey<Ref<string[]>> = Symbol('template-breadcrumbs-injection')

export const WorkflowVariableInj: InjectionKey<{
  selectedNodeId: Ref<string | null>
  getAvailableVariablesFlat: (nodeId: string) => any[]
  getAvailableVariables: (nodeId: string) => Array<{ nodeId: string; nodeTitle: string; variables: any[] }>
}> = Symbol('workflow-variable-injection')

export const IsWsBaseListModalInj: InjectionKey<Ref<boolean>> = Symbol('is-ws-base-list-modal-injection')

export const IsSettingsSidebarInj: InjectionKey<Ref<boolean>> = Symbol('is-settings-sidebar-injection')

export const DocIdInj: InjectionKey<Ref<string>> = Symbol('doc-id-injection')

/**
 * Whether real-time collaborative editing (Yjs) currently owns the document
 * body. When true, attachment uploads must create their FileReference eagerly
 * (the lazy REST reconcile is skipped in collab mode). Defaults to `false`.
 */
export const DocCollabActiveInj: InjectionKey<Ref<boolean>> = Symbol('doc-collab-active-injection')

/**
 * Cell-keyed attachment context for SmartText fields. When present, image and
 * file attachment nodes resolve their URLs via the cell-keyed proxy endpoint
 * (table+column+row triple) instead of the doc-keyed one.
 */
export const SmartTextCellAttachmentInj: InjectionKey<Ref<{ tableId: string; columnId: string; rowId: string } | null>> = Symbol(
  'smart-text-cell-attachment-injection',
)

/**
 * Public-share attachment context. Provided by the anonymous shared-doc reader
 * page so attachment nodes know to build URLs against the public endpoint
 * (gated by sharedDocUuid) instead of the auth-protected proxy. Null in
 * normal (authenticated) editor contexts.
 */
export const PublicDocShareInj: InjectionKey<Ref<{ sharedDocUuid: string; docId: string } | null>> =
  Symbol('public-doc-share-injection')

/**
 * Data adapter for smartsheet components mounted inside an interface page.
 * Provided by the interface-page wrappers (EE); when present, the smartsheet
 * data composables route list/count/CRUD calls through it instead of the
 * view / shared-view endpoints. Undefined in normal dashboard contexts.
 */
export const InterfacePageDataInj: InjectionKey<InterfacePageDataApi | undefined> = Symbol('interface-page-data')

/**
 * Marks an interface surface that sits OUTSIDE the viz tree, so it has no
 * `InterfacePageDataInj` ancestor to be recognised by — the builder's
 * properties panel, whose "Edit field" hosts the same column editor the canvas
 * does. Read it through `useIsInterfaceUi()` rather than injecting directly.
 */
export const IsInterfaceUiInj: InjectionKey<Ref<boolean>> = Symbol('is-interface-ui')

/**
 * Marks a visualization EMBEDDED as a dashboard view widget (a card inside a
 * group grid) rather than filling its own page — space-constrained renderers
 * adapt (e.g. kanban auto-collapses empty stacks). Provided by the interface
 * view-widget host; absent everywhere else.
 */
export const IsEmbeddedVizInj: InjectionKey<Ref<boolean>> = Symbol('is-embedded-viz')

/**
 * Which UI the LTAR cells render inside `LinkRecordDropdown` — `'classic'`
 * (default; the full card modal) or `'simple'` (the compact single-list
 * picker). Provided as `'simple'` by the interface grid/list viz hosts (EE);
 * `useLinkRecordDropdownVariant` additionally keeps forms, expanded records
 * and lookups on the classic UI regardless of the provided value.
 */
export const LinkRecordDropdownVariantInj: InjectionKey<Ref<LinkRecordDropdownVariant>> = Symbol('link-record-dropdown-variant')

/**
 * Per-column "Click into record details" for Links/LTAR cells — expands a
 * linked/unlinked record into the LINKED table's record-detail surface.
 * Provided by the interface viz hosts (EE) which resolve the per-column
 * config; `null`/absent = no expand affordance (the CE default everywhere).
 */
export interface LinkRecordExpandApi {
  /** Whether the LTAR column has click-into-details configured (with a valid layout). */
  isEnabled: (column: ColumnType) => boolean
  /** Open the record's detail surface — the picker passes the linked table's meta it already holds. */
  expand: (params: { column: ColumnType; row: Record<string, any>; relatedTableMeta: TableType }) => void
  /**
   * Builder-only: `isEnabled` is false and the host can offer the enable
   * prompt, so the affordance stays live and the click configures instead of
   * doing nothing. Absent on consumer surfaces — a viewer can't configure, so
   * there the click is genuinely inert.
   */
  configure?: (params: { column: ColumnType; row: Record<string, any>; relatedTableMeta: TableType }) => void
}

export const LinkRecordExpandInj: InjectionKey<Ref<LinkRecordExpandApi | null>> = Symbol('link-record-expand')

/**
 * Record-sidebar adapter for the comment + revision-history panels of an
 * interface record overlay — the record-scoped sibling of `InterfacePageDataInj`.
 * Provided by the overlay (EE); when present, the base comment/revision
 * composables (`useRowComments`, `useExpandedFormStore`) route their network
 * calls through it (the interface-scoped, grant + builder-toggle + record-scope
 * gated ops) instead of the base ops, so interface-only consumers can use them.
 * Undefined outside an interface record overlay.
 */
export const InterfaceRecordSidebarInj: InjectionKey<InterfaceRecordSidebarApi | undefined> = Symbol('interface-record-sidebar')

/**
 * Kanban surface theme for interface-mounted kanbans. Provided by the interface
 * hosts (EE) from the kanban viz config; undefined outside interface pages —
 * the renderer then keeps the data-app's default (`board`) treatment.
 */
export const InterfaceKanbanThemeInj: InjectionKey<Ref<InterfaceKanbanVizTheme> | undefined> = Symbol('interface-kanban-theme')

/**
 * Gallery surface theme for interface-mounted galleries. Provided by the
 * interface hosts (EE) from the gallery viz config; undefined outside interface
 * pages — the renderer then keeps the data-app's default (`card`) treatment.
 */
export const InterfaceGalleryThemeInj: InjectionKey<Ref<InterfaceGalleryVizTheme> | undefined> = Symbol('interface-gallery-theme')

/**
 * Public share-to-web consumer context for interface pages. Provided by the
 * anonymous shared-page route (EE `interface/consumer/PublicPage.vue`); when
 * present, the interface page renderers prefer its page/meta over the builder
 * store and the data adapter routes through the public REST endpoints. Null in
 * normal (authenticated) contexts.
 */
export const InterfacePublicPageInj: InjectionKey<Ref<InterfacePublicPageState | null>> = Symbol(
  'interface-public-page-injection',
)

/**
 * Scoped UI-ACL override for interface preview-as. Provided by the editor's
 * preview host (EE `interface/editor/AppPreview.vue`) with the previewed
 * principal's base-role object (`{ editor: true }` …) while a preview-as
 * target is active; `useRoles().isUIAllowed` then evaluates against it for
 * every component in the preview subtree, so the canvas gates its UI exactly
 * as the previewed user/role — while the editor chrome outside the subtree
 * keeps the builder's real roles. Null when not previewing.
 */
export const UiRolesOverrideInj: InjectionKey<Ref<Record<string, boolean> | null>> = Symbol('ui-roles-override')

/**
 * Companion to `UiRolesOverrideInj` for base table/field permission checks
 * (`usePermissions.isAllowed`): the previewed PRINCIPAL, not just its role.
 * User-subject grants need the previewed user's id — evaluating the builder's
 * own id would show a field as editable merely because the BUILDER is in the
 * grant's subject list. `userId` is unset for bare-role targets (a generic
 * principal of that role). Null when not previewing.
 */
export const PermissionPrincipalOverrideInj: InjectionKey<Ref<{ userId?: string; role?: string } | null>> =
  Symbol('permission-principal-override')

/**
 * Interface EDITOR only: a callback that selects the mounted visualization
 * element — moving the properties panel to its `Page › <Viz>` pane, exactly like
 * clicking a button element opens its pane. Provided by the interface page
 * wrapper (EE) while editing, bound to the mounted viz; null in the published
 * view and outside interface pages. Consumed today by the calendar sub-views so
 * a date click selects the element instead of highlighting the date / adding a
 * record.
 */
export const InterfaceVizEditSelectInj: InjectionKey<Ref<(() => void) | null>> = Symbol('interface-viz-edit-select')

/**
 * Interface EDITOR only: called when a double-click (or Enter) tries to edit a
 * cell while the element's "Edit records inline" option is off — the wrapper
 * surfaces guidance toward that option instead of letting the attempt die
 * silently. Provided by the interface page wrapper (EE) while editing; null in
 * the published view and outside interface pages, so every other readonly
 * context (locked views, shared views) stays silent.
 */
export const InterfaceInlineEditHintInj: InjectionKey<Ref<(() => void) | null>> = Symbol('interface-inline-edit-hint')

/**
 * Interface pages with a "new record" FORM configured (an OPEN_RECORD_FORM
 * button → RECORD_DETAIL page) route the calendar's inline add through this
 * handler instead of the default expanded-record form. Provided by the interface
 * page wrapper (EE) when such a form is set; null otherwise and outside interface
 * pages. The handler opens the configured form seeded with `prefill` (the clicked
 * date / filter context) and returns true when it handled the add.
 */
export const InterfaceNewRecordFormInj: InjectionKey<Ref<((prefill: Record<string, any>) => boolean) | null>> =
  Symbol('interface-new-record-form')

/**
 * Leveled-list rows may belong to a PARENT table, not the page's source table —
 * the list passes the row's table so the wrapper can open that table's
 * record-detail page (per-level "Click into record details" config).
 */
export interface InterfaceExpandRecordCtx {
  modelId?: string
  tableMeta?: TableType
  /** Pre-resolved primary key (leveled rows carry it; spares a column lookup). */
  pk?: string
}

/**
 * Row-expansion intercept for smartsheet components mounted inside an
 * interface page. Provided by the interface viz wrapper (EE); the components'
 * expand handlers call it FIRST — true means the interface handled the click
 * (record-detail sheet opened, or the viz has "Click into record details"
 * disabled and the click is inert), false falls through to the classic
 * expanded-record flow (new-row drafts keep their dialog). Undefined in
 * normal dashboard contexts.
 */
export const InterfaceExpandRecordInj: InjectionKey<((row: Row, ctx?: InterfaceExpandRecordCtx) => boolean) | undefined> =
  Symbol('interface-expand-record')

/**
 * Interface pages: whether the active viz opens records (its "Click into
 * record details" toggle) — context-menu Expand items hide when off.
 * Non-interface hosts inject the default (true) and are unaffected.
 */
export const InterfaceClickIntoDetailsInj: InjectionKey<Ref<boolean>> = Symbol('interface-click-into-details')

/**
 * Whether smartsheet renderers mounted inside an interface page should show the
 * row-expand (maximize) affordance. Provided by the interface viz wrapper (EE):
 * true when "Click into record details" is on, OR while the builder is editing
 * (a click then surfaces the enable prompt — see InterfaceExpandRecordInj).
 * False on the launched/published page when the toggle is off, so the otherwise
 * inert expand arrow is hidden. Defaults to true everywhere else — ordinary
 * grids always expand.
 */
export const InterfaceShowRowExpandInj: InjectionKey<Ref<boolean>> = Symbol('interface-show-row-expand')

/**
 * Compact presentation for the toolbar field-list dropdown (panel-density
 * text, no field icons) — provided by side-panel filter/sort hosts.
 */
export const FieldListCompactInj: InjectionKey<Ref<boolean>> = Symbol('field-list-compact-injection')

/**
 * Mark filter rows whose `fk_column_id` no longer resolves to a live column as
 * "orphaned" (a greyed indicator instead of a blank field picker). Provided by
 * the interface filter editor so that only interface config filters — where a
 * table/field delete leaves a stale id in the persisted tree — surface the cue;
 * grid-view filter rows keep their existing rendering.
 */
export const MarkOrphanFilterInj: InjectionKey<Ref<boolean>> = Symbol('mark-orphan-filter-injection')

/**
 * Resolved download context for an attachment rendered under a Lookup cell.
 * A lookup swaps MetaInj to the related table while RowInj stays the parent
 * row, so the attachment cell's own (model, row) no longer address the
 * attachment. Lookup.vue provides the parent table's modelId + the parent
 * row's pk + the lookup columnId here, and the attachment cell uses it to
 * download/sign the file via the parent row's lookup column. Null when not
 * under a lookup.
 */
export const LookupAttachmentDownloadInj: InjectionKey<
  Ref<{ workspaceId?: string; baseId?: string; modelId: string; columnId: string; rowId: string } | null>
> = Symbol('lookup-attachment-download-injection')
