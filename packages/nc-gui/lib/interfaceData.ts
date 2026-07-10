import type { Ref } from 'vue'
import type { FilterType, PaginatedType, SortType } from 'nocodb-sdk'

/** Environment a consumer-facing interface page renders against. */
export type InterfacePageDataEnv = 'draft' | 'published'

/**
 * Data adapter contract for smartsheet components mounted inside an interface
 * page. Interface-page wrappers provide an implementation via
 * `InterfacePageDataInj` (see `context/index.ts`); the CE data composables
 * (`useInfiniteData`, `useKanbanViewStore`, ...) route their data calls through
 * it instead of the view/shared-view endpoints when it is present.
 *
 * The implementation lives in EE (`ee/composables/useInterfacePageData.ts`) —
 * only the contract + inject token are CE so CE never imports from `ee/`.
 */
export interface InterfacePageDataApi {
  fetchList(params: {
    limit?: number
    offset?: number
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<{ list: Record<string, any>[]; pageInfo: PaginatedType }>
  fetchCount(params: { where?: string; filtersArr?: FilterType[] }): Promise<{ count: number }>
  /** Grouped (kanban stack) load — the stacking column is resolved server-side from the viz config. */
  fetchGroupedData(params: {
    limit?: number
    offset?: number
    where?: string
    sortsArr?: SortType[]
    filtersArr?: FilterType[]
  }): Promise<Array<{ key: string; value: { list: Record<string, any>[]; pageInfo: PaginatedType } }>>
  insertRow(data: Record<string, any>): Promise<Record<string, any>>
  updateRow(rowId: string, data: Record<string, any>): Promise<Record<string, any>>
  deleteRow(rowId: string): Promise<boolean>
  /** viz-config editability gates the UI */
  canEditInline: Ref<boolean>
  canAddDeleteInline: Ref<boolean>
}
