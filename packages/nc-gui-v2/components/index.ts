import type { ColumnType, TableType } from 'nocodb-sdk'
import type { InjectionKey, Ref } from 'vue'

export const ColumnInj: InjectionKey<ColumnType> = Symbol('column-injection')
export const MetaInj: InjectionKey<Ref<TableType>> = Symbol('meta-injection')
export const TabMetaInj: InjectionKey<any> = Symbol('tab-meta-injection')
