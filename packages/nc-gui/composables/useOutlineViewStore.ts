import type { TableType, ViewType } from 'nocodb-sdk'

export interface OutlineViewRow {
  __nc_depth: number
  __nc_pk: string | number
  __nc_parent_id: string | null
  __nc_row_type: string
  __nc_descendant_count: number
  [key: string]: any
}

const [useProvideOutlineViewStore, useOutlineViewStore] = useInjectionState(
  (_meta: Ref<TableType | undefined>, _viewMeta: Ref<ViewType | undefined>) => {
    return {
      levels: computed(() => []),
      isConfigured: computed(() => false),
      showEmptyParents: computed(() => false),
      selectedLevelId: ref<string | null>(null),
      selectedLevel: computed(() => undefined),
      setSelectedLevel: (_levelId: string | null) => {},
      outlineMetaData: computed(() => undefined),
      displayLevels: computed(() => []),
      modelIdToDepth: computed(() => ({})),
      depthToLevelId: computed(() => ({})),
      collapsedParents: ref<Record<number, string[]>>({}),
      toggleCollapse: (_depth: number, _pk: string) => {},
      isCollapsed: (_depth: number, _pk: string) => false,
      saveLevelConfiguration: async (_config: { levels: any[] }) => {},
      updateViewMeta: async (_updates: Record<string, any>) => {},
    }
  },
  'outlineView',
)

export { useProvideOutlineViewStore, useOutlineViewStore }

export function useOutlineViewStoreOrThrow() {
  const state = useOutlineViewStore()

  if (!state) throw new Error('Please call `useProvideOutlineViewStore` on the appropriate parent component')

  return state
}
