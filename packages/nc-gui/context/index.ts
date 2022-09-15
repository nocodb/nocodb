import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { useViewData } from '#imports'
import type { Row, TabItem } from '~/lib'

export const ActiveCellInj: InjectionKey<Ref<boolean>> = Symbol('active-cell')
export const IsPublicInj: InjectionKey<Ref<boolean>> = Symbol('is-public')
export const RowInj: InjectionKey<Ref<Row>> = Symbol('row')
export const ColumnInj: InjectionKey<Ref<ColumnType & { meta: any }>> = Symbol('column-injection')
export const MetaInj: InjectionKey<ComputedRef<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<ComputedRef<TabItem>> = Symbol('tab-meta-injection')
export const PaginationDataInj: InjectionKey<ReturnType<typeof useViewData>['paginationData']> =
  Symbol('pagination-data-injection')
export const ChangePageInj: InjectionKey<ReturnType<typeof useViewData>['changePage']> = Symbol('pagination-data-injection')
export const IsFormInj: InjectionKey<Ref<boolean>> = Symbol('is-form-injection')
export const IsGridInj: InjectionKey<Ref<boolean>> = Symbol('is-grid-injection')
export const IsGalleryInj: InjectionKey<Ref<boolean>> = Symbol('is-gallery-injection')
export const IsLockedInj: InjectionKey<Ref<boolean>> = Symbol('is-locked-injection')
export const CellValueInj: InjectionKey<Ref<any>> = Symbol('cell-value-injection')
export const ActiveViewInj: InjectionKey<Ref<ViewType>> = Symbol('active-view-injection')
export const ReadonlyInj: InjectionKey<boolean> = Symbol('readonly-injection')

/** when bool is passed, it indicates if a loading spinner should be visible while reloading */
export const ReloadViewDataHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-data-injection')
export const ReloadViewMetaHookInj: InjectionKey<EventHook<boolean | void>> = Symbol('reload-view-meta-injection')
export const ReloadRowDataHookInj: InjectionKey<EventHook<void>> = Symbol('reload-row-data-injection')
export const OpenNewRecordFormHookInj: InjectionKey<EventHook<void>> = Symbol('open-new-record-form-injection')
export const FieldsInj: InjectionKey<Ref<any[]>> = Symbol('fields-injection')
export const ViewListInj: InjectionKey<Ref<ViewType[]>> = Symbol('view-list-injection')
export const EditModeInj: InjectionKey<Ref<boolean>> = Symbol('edit-mode-injection')
export const SharedViewPasswordInj: InjectionKey<Ref<string | null>> = Symbol('shared-view-password-injection')
export const CellUrlDisableOverlayInj: InjectionKey<Ref<boolean>> = Symbol('cell-url-disable-url')
export const DropZoneRef: InjectionKey<Ref<Element | undefined>> = Symbol('drop-zone-ref')
