import type { ColumnType, FormType, GalleryType, GridType, KanbanType, TableType } from 'nocodb-sdk'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { useViewData } from '#imports'
import type { Row } from '~/composables'
import type { TabItem } from '~/composables/useTabs'

export const EditEnabledInj: InjectionKey<boolean> = Symbol('edit-enabled')
export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<ColumnType & { meta: any }> = Symbol('column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem>> = Symbol('tab-meta-injection')
export const PaginationDataInj: InjectionKey<ReturnType<typeof useViewData>['paginationData']> =
  Symbol('pagination-data-injection')
export const ChangePageInj: InjectionKey<ReturnType<typeof useViewData>['changePage']> = Symbol('pagination-data-injection')
export const IsFormInj: InjectionKey<boolean> = Symbol('is-form-injection')
export const IsGridInj: InjectionKey<boolean> = Symbol('is-grid-injection')
export const IsLockedInj: InjectionKey<boolean> = Symbol('is-locked-injection')
export const ValueInj: InjectionKey<Ref<any>> = Symbol('value-injection')
export const ActiveViewInj: InjectionKey<Ref<GridType | FormType | KanbanType | GalleryType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<any> = Symbol('readonly-injection')
export const ReloadViewDataHookInj: InjectionKey<EventHook<void>> = Symbol('reload-view-data-injection')
export const FieldsInj: InjectionKey<Ref<any[]>> = Symbol('fields-injection')
export const ViewListInj: InjectionKey<Ref<(GridType | FormType | KanbanType | GalleryType)[]>> = Symbol('view-list-injection')

export const RightSidebarInj: InjectionKey<Ref<boolean>> = Symbol('right-sidebar-injection')
export const EditModeInj: InjectionKey<ComputedRef<boolean>> = Symbol('edit-mode-injection')
