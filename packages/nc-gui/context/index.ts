import type { ColumnType, FilterType, SourceType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Reactive, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { PageSidebarNode } from '#imports'

export type ExtractInjectedRef<T> = T extends InjectionKey<Ref<infer U>> ? U : never
export type ExtractInjectedReactive<T> = T extends InjectionKey<Reactive<infer U>> ? U : never

export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const IsPublicInj: InjectionKey<Ref<boolean>> = Symbol('is-public')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('column-injection')
export const CanvasColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('canvas-column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType> | Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem> | Ref<TabItem>> = Symbol('tab-meta-injection')
export const IsFormInj: InjectionKey<Ref<boolean>> = Symbol('is-form-injection')
export const IsCalendarInj: InjectionKey<Ref<boolean>> = Symbol('is-calendar-injection')
export const IsSurveyFormInj: InjectionKey<Ref<boolean>> = Symbol('is-survey-form-injection')
export const IsGridInj: InjectionKey<Ref<boolean>> = Symbol('is-grid-injection')
export const IsGroupByInj: InjectionKey<Ref<boolean>> = Symbol('is-group-by-injection')
export const IsGroupByLabelInj: InjectionKey<Ref<boolean>> = Symbol('is-group-by-label-injection')
export const IsGalleryInj: InjectionKey<Ref<boolean>> = Symbol('is-gallery-injection')
export const IsKanbanInj: InjectionKey<Ref<boolean>> = Symbol('is-kanban-injection')
export const IsLockedInj: InjectionKey<Ref<boolean>> = Symbol('is-locked-injection')
export const IsExpandedFormOpenInj: InjectionKey<Ref<boolean>> = Symbol('is-expanded-form-open-injection')
export const IsExpandedBulkUpdateFormOpenInj: InjectionKey<Ref<boolean>> = Symbol('is-expanded-bulk-update-form-open-injection')
export const CellValueInj: InjectionKey<Ref<any>> = Symbol('cell-value-injection')
export const ActiveViewInj: InjectionKey<Ref<ViewType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('readonly-injection')
export const RawReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('raw-readonly-injection')
export const RowHeightInj: InjectionKey<Ref<1 | 2 | 4 | 6 | undefined>> = Symbol('row-height-injection')
export const ScrollParentInj: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('scroll-parent-injection')
/** when shouldShowLoading bool is passed, it indicates if a loading spinner should be visible while reloading */
export const ReloadViewDataHookInj: InjectionKey<
  EventHook<{ shouldShowLoading?: boolean; offset?: number; isFormFieldFilters?: boolean } | void>
> = Symbol('reload-view-data-injection')
export const ReloadViewMetaHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-meta-injection')
export const ReloadVisibleDataHookInj: InjectionKey<EventHook<void>> = Symbol('reload-visible-data-injection')
export const ReloadRowDataHookInj: InjectionKey<EventHook<{ shouldShowLoading?: boolean; offset?: number } | void>> =
  Symbol('reload-row-data-injection')
export const ReloadAggregateHookInj: InjectionKey<
  EventHook<
    | {
        fields: {
          title: string
          aggregation?: string
        }[]
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
export const OnDivDataCellEventHookInj: InjectionKey<EventHook<Event> | undefined> = Symbol('on-div-data-cell-event-injection')
export const SaveRowInj: InjectionKey<(() => void) | undefined> = Symbol('save-row-injection')
export const CurrentCellInj: InjectionKey<Ref<Element | undefined>> = Symbol('current-cell-injection')
export const IsUnderLookupInj: InjectionKey<Ref<boolean>> = Symbol('is-under-lookup-injection')
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
    undo?: boolean,
    disableTitleDiffCheck?: boolean,
  ) => void
  openViewDescriptionDialog: (view: ViewType) => void
  openAutomationDescriptionDialog?: (automation: any) => void
  openTableDescriptionDialog: (table: TableType) => void
  contextMenuTarget: { type?: 'base' | 'base' | 'table' | 'main' | 'layout'; value?: any }
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
  }>
> = Symbol('canvas-cell-event-data-injection')

// triggering this hook from within an editable cell will turn it into "selection state"
export const CanvasSelectCellInj: InjectionKey<EventHook> = Symbol('canvas-select-cell-inj')
