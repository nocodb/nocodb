import type { PageDesignerPayload } from './payload'

export const PageDesignerPayloadInj: InjectionKey<Ref<PageDesignerPayload>> = Symbol('page-designer-payload')
export const PageDesignerRowInj: InjectionKey<Ref<Row | undefined>> = Symbol('page-designer-row')
