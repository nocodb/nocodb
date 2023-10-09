import type { ColumnType, FilterType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { NcProject, PageSidebarNode, Row, TabItem } from '#imports'

export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const IsPublicInj: InjectionKey<Ref<boolean>> = Symbol('is-public')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType> | Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem> | Ref<TabItem>> = Symbol('tab-meta-injection')
export const IsFormInj: InjectionKey<Ref<boolean>> = Symbol('is-form-injection')
export const IsSurveyFormInj: InjectionKey<Ref<boolean>> = Symbol('is-survey-form-injection')
export const IsGridInj: InjectionKey<Ref<boolean>> = Symbol('is-grid-injection')
export const IsGroupByInj: InjectionKey<Ref<boolean>> = Symbol('is-group-by-injection')
export const IsGalleryInj: InjectionKey<Ref<boolean>> = Symbol('is-gallery-injection')
export const IsKanbanInj: InjectionKey<Ref<boolean>> = Symbol('is-kanban-injection')
export const IsLockedInj: InjectionKey<Ref<boolean>> = Symbol('is-locked-injection')
export const IsExpandedFormOpenInj: InjectionKey<Ref<boolean>> = Symbol('is-expanded-form-open-injection')
export const CellValueInj: InjectionKey<Ref<any>> = Symbol('cell-value-injection')
export const ActiveViewInj: InjectionKey<Ref<ViewType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('readonly-injection')
export const RowHeightInj: InjectionKey<Ref<1 | 2 | 4 | 6 | undefined>> = Symbol('row-height-injection')
export const ScrollParentInj: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('scroll-parent-injection')
/** when bool is passed, it indicates if a loading spinner should be visible while reloading */
export const ReloadViewDataHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-data-injection')
export const ReloadViewMetaHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-meta-injection')
export const ReloadRowDataHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-row-data-injection')
export const OpenNewRecordFormHookInj: InjectionKey<EventHook<void>> = Symbol('open-new-record-form-injection')
export const FieldsInj: InjectionKey<Ref<ColumnType[]>> = Symbol('fields-injection')
export const EditModeInj: InjectionKey<Ref<boolean>> = Symbol('edit-mode-injection')
export const SharedViewPasswordInj: InjectionKey<Ref<string | null>> = Symbol('shared-view-password-injection')
export const CellUrlDisableOverlayInj: InjectionKey<Ref<boolean>> = Symbol('cell-url-disable-url')
export const DropZoneRef: InjectionKey<Ref<Element | undefined>> = Symbol('drop-zone-ref')
export const ToggleDialogInj: InjectionKey<Function> = Symbol('toggle-dialog-injection')
export const CellClickHookInj: InjectionKey<EventHook<MouseEvent> | undefined> = Symbol('cell-click-injection')
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
  openRenameTableDialog: (table: TableType, rightClick: boolean) => void
  contextMenuTarget: { type?: 'base' | 'base' | 'table' | 'main' | 'layout'; value?: any }
}> = Symbol('tree-view-functions-injection')
export const JsonExpandInj: InjectionKey<Ref<boolean>> = Symbol('json-expand-injection')
export const AllFiltersInj: InjectionKey<Ref<Record<string, FilterType[]>>> = Symbol('all-filters-injection')
