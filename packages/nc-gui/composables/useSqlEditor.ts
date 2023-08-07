import { createGlobalState } from '#imports'

export const useSqlEditor = createGlobalState(() => {
  const sqlEditors = ref<any>()

  const selectBase = (..._args: any) => {}

  return {
    sqlEditors,
    selectBase,
    promptHistory: [] as any[],
  }
})
