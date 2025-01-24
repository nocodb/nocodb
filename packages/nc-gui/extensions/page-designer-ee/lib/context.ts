import type { TableType } from 'nocodb-sdk'
import type { PageDesignerPayload } from './payload'

export const PageDesignerPayloadInj: InjectionKey<Ref<PageDesignerPayload>> = Symbol('page-designer-payload')
export const PageDesignerRowInj: InjectionKey<Ref<Partial<Row>>> = Symbol('page-designer-row')
export const PageDesignerTableTypeInj: InjectionKey<Ref<TableType>> = Symbol('page-designer-table-type')
