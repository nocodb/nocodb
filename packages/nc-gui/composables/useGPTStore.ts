import type { ProjectType, TableInfoType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { useNuxtApp, useViews } from '#imports'

const [useProvideGPTStore, useGPTStore] = useInjectionState((projectId: string) => {
  const gptLayout = ref<'form' | 'grid'>('form')

  const gptProject = ref<ProjectType | null>()

  const gptTable = ref<TableInfoType | null>()

  const gptFormView = ref<ViewType | null>()

  const gptGridView = ref<ViewType | null>()

  const promptStatement = ref('')

  const { $api } = useNuxtApp()

  async function loadGPTProject() {
    gptProject.value = await $api.project.read(projectId)
    console.log(gptProject.value)
  }

  async function loadGPTTable() {
    const firstTable = (await $api.dbTable.list(projectId)).list?.[0]
    gptTable.value = await $api.dbTable.read(firstTable!.id!)
    console.log(gptTable.value)
    await loadGPTView()
  }

  async function loadGPTView() {
    const { views, loadViews } = useViews(gptTable.value as TableInfoType)
    await loadViews()
    if (views.value.length === 1) {
      // no form view, create one
      await $api.dbView.formCreate(gptTable.value!.id!, {
        type: ViewTypes.FORM,
        title: `${gptTable.value!.title}_form`,
      } as ViewType)
      await loadViews()
    }
    gptGridView.value = views.value[0]
    gptFormView.value = views.value[1]
  }

  watch(
    gptProject,
    async (project) => {
      if (project) return
      await Promise.all([loadGPTProject(), loadGPTTable()])
    },
    { immediate: true },
  )

  return {
    gptLayout,
    gptProject,
    gptTable,
    gptGridView,
    gptFormView,
    promptStatement,
    loadGPTTable,
  }
})

export { useProvideGPTStore }

export function useGPTStoreOrThrow() {
  const state = useGPTStore()
  if (!state) throw new Error('Please call `useProvideGPTStore` on the appropriate parent component')
  return state
}
