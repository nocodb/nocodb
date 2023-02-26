import type { RemovableRef } from '@vueuse/core'
import { useStorage } from '@vueuse/core'
import { createGlobalState } from '#imports'

export const useSqlEditor = createGlobalState(() => {
  const storageSqlEditor: RemovableRef<{
    promptHistory: { baseId: number; prompt: string; query: string; status: boolean | null; error: string }[]
  }> = useStorage('nc-sql-editor', {
    promptHistory: [],
  })

  const rawSql = ref('')

  const sqlPrompt = ref<string>('')

  const selectedBase = ref()

  return {
    rawSql,
    sqlPrompt,
    selectedBase,
    promptHistory: storageSqlEditor.value.promptHistory,
  }
})
