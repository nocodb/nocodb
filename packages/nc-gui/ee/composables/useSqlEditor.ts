import type { RemovableRef } from '@vueuse/core'
import { useStorage } from '@vueuse/core'
import { createGlobalState } from '#imports'

export const useSqlEditor = createGlobalState(() => {
  const storageSqlEditor: RemovableRef<{
    promptHistory: { sourceId: string; prompt: string; query: string; status: boolean | null; error: string }[]
  }> = useStorage('nc-sql-editor', {
    promptHistory: [],
  })

  const sqlEditors = ref<Record<string, { rawSql: string; sqlPrompt: string }>>({})

  const selectBase = (sourceId: string) => {
    if (!sqlEditors.value[sourceId]) {
      sqlEditors.value[sourceId] = {
        rawSql: '',
        sqlPrompt: '',
      }
    }
  }

  return {
    sqlEditors,
    selectBase,
    promptHistory: storageSqlEditor.value.promptHistory,
  }
})
