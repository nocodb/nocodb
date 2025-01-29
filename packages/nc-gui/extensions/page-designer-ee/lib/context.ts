import type { TableType, ViewType } from 'nocodb-sdk'
import type { PageDesignerPayload } from './payload'

export const PageDesignerPayloadInj: InjectionKey<Ref<PageDesignerPayload>> = Symbol('page-designer-payload')
export const PageDesignerRowInj: InjectionKey<Ref<Row | undefined>> = Symbol('page-designer-row')
export const PageDesignerTableTypeInj: InjectionKey<Ref<TableType | undefined>> = Symbol('page-designer-table-type')
export const PageDesignerViewTypeInj: InjectionKey<Ref<ViewType>> = Symbol('page-designer-view-type')
