import type { ColumnType, TableType } from 'nocodb-sdk'
import type { InjectionKey, Ref } from 'vue'
import type useViewData from '~/composables/useViewData'

export const ColumnInj: InjectionKey<ColumnType> = Symbol('column-injection')
export const MetaInj: InjectionKey<Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<any> = Symbol('tab-meta-injection')
export const PaginationDataInj: InjectionKey<ReturnType<typeof useViewData>['paginationData']> =
  Symbol('pagination-data-injection')
export const ChangePageInj: InjectionKey<ReturnType<typeof useViewData>['changePage']> = Symbol('pagination-data-injection')
export const IsFormInj: InjectionKey<boolean> = Symbol('is-form-injection')
export const IsGridInj: InjectionKey<boolean> = Symbol('is-grid-injection')
export const ValueInj: InjectionKey<any> = Symbol('value-injection')
