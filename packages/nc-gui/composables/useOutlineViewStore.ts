import type { OutlineType, OutlineViewLevelType, TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

export interface OutlineViewRow {
  __nc_depth: number
  __nc_pk: string | number
  __nc_parent_id: string | null
  __nc_row_type: string
  __nc_descendant_count: number
  [key: string]: any
}

const [useProvideOutlineViewStore, useOutlineViewStore] = useInjectionState(
  (meta: Ref<TableType | undefined>, viewMeta: Ref<ViewType | undefined>) => {
    const { updateViewMeta: _updateViewMeta } = useViewsStore()
    const selectedLevelId = ref<string | null>(null)

    const viewId = computed(() => viewMeta.value?.id)

    const outlineMetaData = computed<OutlineType | undefined>(() => {
      return viewMeta.value?.view as OutlineType | undefined
    })

    const levels = computed<OutlineViewLevelType[]>(() => {
      return outlineMetaData.value?.levels || []
    })

    const isConfigured = computed(() => levels.value.length >= 1)

    const showEmptyParents = computed(() => {
      return outlineMetaData.value?.show_empty_parents !== false
    })

    const selectedLevel = computed<OutlineViewLevelType | undefined>(() => {
      if (!selectedLevelId.value) return levels.value[0]
      return levels.value.find((l) => l.id === selectedLevelId.value)
    })

    // Display levels: reversed so highest level = depth 0
    const displayLevels = computed(() => [...levels.value].reverse())

    // Map model ID -> depth index in displayLevels
    const modelIdToDepth = computed<Record<string, number>>(() => {
      const map: Record<string, number> = {}
      displayLevels.value.forEach((level, idx) => {
        if (level.fk_model_id) map[level.fk_model_id] = idx
      })
      return map
    })

    // Map depth index -> level ID
    const depthToLevelId = computed<Record<number, string>>(() => {
      const map: Record<number, string> = {}
      displayLevels.value.forEach((level, depth) => {
        if (level.id) map[depth] = level.id
      })
      return map
    })

    const collapsedParents = ref<Record<number, string[]>>({})

    function setSelectedLevel(levelId: string | null) {
      selectedLevelId.value = levelId
    }

    function toggleCollapse(depth: number, pk: string) {
      const current = { ...collapsedParents.value }
      const arr = current[depth] ? [...current[depth]] : []
      const idx = arr.indexOf(pk)
      if (idx >= 0) {
        arr.splice(idx, 1)
      } else {
        arr.push(pk)
      }
      current[depth] = arr
      collapsedParents.value = current
    }

    function isCollapsed(depth: number, pk: string): boolean {
      return collapsedParents.value[depth]?.includes(pk) ?? false
    }

    async function saveLevelConfiguration(config: { levels: OutlineViewLevelType[] }) {
      if (!viewId.value) return

      try {
        await _updateViewMeta(viewId.value, ViewTypes.OUTLINE, {
          levels: config.levels,
        })
      } catch (e) {
        console.error('Error saving level configuration:', e)
        throw e
      }
    }

    /** Update view meta (show_empty_parents, etc.) */
    async function updateViewMeta(updates: Partial<OutlineType>) {
      if (!viewId.value) return

      try {
        await _updateViewMeta(viewId.value, ViewTypes.OUTLINE, updates)
      } catch (e) {
        console.error('Error updating outline view meta:', e)
        throw e
      }
    }

    watch(
      levels,
      (newLevels) => {
        if (newLevels.length > 0 && !newLevels.find((l) => l.id === selectedLevelId.value)) {
          selectedLevelId.value = newLevels[0]?.id ?? null
        } else if (newLevels.length === 0) {
          selectedLevelId.value = null
        }
      },
      { immediate: true },
    )

    onMounted(async () => {
      await waitForCondition(() => levels.value?.length, 100)
      if (levels.value.length > 0 && !levels.value.find((l) => l.id === selectedLevelId.value)) {
        selectedLevelId.value = levels.value[0]?.id ?? null
      } else if (levels.value.length === 0) {
        selectedLevelId.value = null
      }
    })

    return {
      levels,
      isConfigured,
      showEmptyParents,
      selectedLevelId,
      selectedLevel,
      setSelectedLevel,
      outlineMetaData,
      displayLevels,
      modelIdToDepth,
      depthToLevelId,
      collapsedParents,
      toggleCollapse,
      isCollapsed,
      saveLevelConfiguration,
      updateViewMeta,
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
