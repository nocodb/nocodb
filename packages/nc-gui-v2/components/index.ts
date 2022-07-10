import type { ColumnType, FormType, GalleryType, GridType, KanbanType, TableType } from 'nocodb-sdk'
import type { InjectionKey, Ref } from 'vue'
import type useViewData from '~/composables/useViewData'

export const ColumnInj: InjectionKey<ColumnType & { meta: any }> = Symbol('column-injection')
export const MetaInj: InjectionKey<Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<any> = Symbol('tab-meta-injection')
export const PaginationDataInj: InjectionKey<ReturnType<typeof useViewData>['paginationData']> =
  Symbol('pagination-data-injection')
export const ChangePageInj: InjectionKey<ReturnType<typeof useViewData>['changePage']> = Symbol('pagination-data-injection')
export const IsFormInj: InjectionKey<boolean> = Symbol('is-form-injection')
export const IsGridInj: InjectionKey<boolean> = Symbol('is-grid-injection')
export const IsLockedInj: InjectionKey<boolean> = Symbol('is-locked-injection')
export const ValueInj: InjectionKey<any> = Symbol('value-injection')
export const ActiveViewInj: InjectionKey<Ref<(GridType | GalleryType | FormType | KanbanType) & { id?: string }>> =
  Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<any> = Symbol('readonly-injection')
export const ReloadViewDataInj: InjectionKey<any> = Symbol('reload-view-data-injection')
