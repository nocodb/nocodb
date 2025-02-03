import type { TableType } from 'nocodb-sdk'
import type { InjectionKey } from 'vue'
import type { EventHook } from '@vueuse/core'
import type { PageDesignerPayload } from './payload'

export const PageDesignerPayloadInj: InjectionKey<Ref<PageDesignerPayload>> = Symbol('page-designer-payload')
export const PageDesignerRowInj: InjectionKey<Ref<Row | undefined>> = Symbol('page-designer-row')
export const PageDesignerTableTypeInj: InjectionKey<Ref<TableType | undefined>> = Symbol('page-designer-table-type')
export const PageDesignerEventHookInj: InjectionKey<EventHook<'nextRecord' | 'previousRecord'> | undefined> =
  Symbol('page-designer-event-hook')
