import type {ColumnType, ProjectType, TableType, ViewType} from 'nocodb-sdk'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { useViewData } from '#imports'
import type { PageSidebarNode, Row, TabItem } from '~/lib'

export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const IsPublicInj: InjectionKey<Ref<boolean>> = Symbol('is-public')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<Ref<ColumnType>> = Symbol('column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem>> = Symbol('tab-meta-injection')
export const PaginationDataInj: InjectionKey<ReturnType<typeof useViewData>['paginationData']> =
  Symbol('pagination-data-injection')
export const ChangePageInj: InjectionKey<ReturnType<typeof useViewData>['changePage']> = Symbol('pagination-data-injection')
export const IsFormInj: InjectionKey<Ref<boolean>> = Symbol('is-form-injection')
export const IsGridInj: InjectionKey<Ref<boolean>> = Symbol('is-grid-injection')
export const IsGalleryInj: InjectionKey<Ref<boolean>> = Symbol('is-gallery-injection')
export const IsKanbanInj: InjectionKey<Ref<boolean>> = Symbol('is-kanban-injection')
export const IsLockedInj: InjectionKey<Ref<boolean>> = Symbol('is-locked-injection')
export const CellValueInj: InjectionKey<Ref<any>> = Symbol('cell-value-injection')
export const ActiveViewInj: InjectionKey<Ref<ViewType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<Ref<boolean>> = Symbol('readonly-injection')
export const RowHeightInj: InjectionKey<ComputedRef<1 | 2 | 4 | 6 | undefined>> = Symbol('row-height-injection')
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

export const DocsLocalPageInj: InjectionKey<Ref<PageSidebarNode | undefined>> = Symbol('docs-local-page-injection')
export const ProjectRoleInj: InjectionKey<Ref<string>> = Symbol('project-roles-injection')
export const ProjectInj: InjectionKey<Ref<ProjectType>> = Symbol('project-injection')
