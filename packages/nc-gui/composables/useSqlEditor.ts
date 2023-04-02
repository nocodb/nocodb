import type { RemovableRef } from '@vueuse/core'
import { useStorage } from '@vueuse/core'
import { createGlobalState } from '#imports'

export const useSqlEditor = createGlobalState(() => {
  const storageSqlEditor: RemovableRef<{
    promptHistory: { baseId: string; prompt: string; query: string; status: boolean | null; error: string }[]
  }> = useStorage('nc-sql-editor', {
    promptHistory: [],
  })

  const sqlEditors = ref<Record<string, { rawSql: string; sqlPrompt: string; selectedBase?: string }>>({})

  const selectBase = (projectId: string, baseId?: string) => {
    if (sqlEditors.value[projectId]) {
      sqlEditors.value[projectId].selectedBase = baseId
    } else {
      sqlEditors.value[projectId] = {
        rawSql: '',
        sqlPrompt: '',
        selectedBase: baseId,
      }
    }
  }

  return {
    sqlEditors,
    selectBase,
    promptHistory: storageSqlEditor.value.promptHistory,
  }
})
