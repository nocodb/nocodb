import type { ProjectType, TableInfoType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { useNuxtApp, useViews } from '#imports'

const [useProvideCowriterStore, useCowriterStore] = useInjectionState((projectId: string) => {
  const cowriterLayout = ref<'form' | 'grid'>('form')

  const cowriterProject = ref<ProjectType | null>()

  const cowriterTable = ref<TableInfoType | null>()

  const cowriterFormView = ref<ViewType | null>()

  const cowriterGridView = ref<ViewType | null>()

  const cowriterFormRef = ref()

  const cowriterFormState = reactive({})

  const promptStatementTemplate = ref('')

  const { $api } = useNuxtApp()

  async function loadCowriterProject() {
    cowriterProject.value = await $api.project.read(projectId)

    if (cowriterProject.value) {
      const meta =
        typeof cowriterProject.value.meta === 'string' ? JSON.parse(cowriterProject.value.meta) : cowriterProject.value.meta
      promptStatementTemplate.value = meta?.prompt_statement ?? ''
    }
  }

  async function loadCowriterTable() {
    const firstTable = (await $api.dbTable.list(projectId)).list?.[0]
    cowriterTable.value = await $api.dbTable.read(firstTable!.id!)
    console.log(cowriterTable.value)
    await loadCowriterView()
  }

  async function loadCowriterView() {
    const { views, loadViews } = useViews(cowriterTable.value as TableInfoType)
    await loadViews()
    if (views.value.length === 1) {
      // no form view, create one
      await $api.dbView.formCreate(cowriterTable.value!.id!, {
        type: ViewTypes.FORM,
        title: `${cowriterTable.value!.title}_form`,
      } as ViewType)
      await loadViews()
    }
    cowriterGridView.value = views.value[0]
    cowriterFormView.value = views.value[1]
  }

  function translatePromptStatement(promptStatementTemplate: string) {
    // TODO:
    return ''
  }

  async function generateCowriter() {
    try {
      await cowriterFormRef.value?.validateFields()
    } catch (e: any) {
      e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
      if (e.errorFields.length) return
    }
    const cowriter = await $api.cowriterTable.create(cowriterTable.value!.id!, {
      ...cowriterFormState,
      prompt_statement_template: promptStatementTemplate.value,
      prompt_statement: translatePromptStatement(promptStatementTemplate.value),
    })
    console.log(cowriter)
  }

  watch(
    cowriterProject,
    async (project) => {
      if (project) return
      await Promise.all([loadCowriterProject(), loadCowriterTable()])
    },
    { immediate: true },
  )

  return {
    cowriterLayout,
    cowriterProject,
    cowriterTable,
    cowriterGridView,
    cowriterFormView,
    cowriterFormRef,
    cowriterFormState,
    promptStatementTemplate,
    loadCowriterTable,
    generateCowriter,
  }
})

export { useProvideCowriterStore }

export function useCowriterStoreOrThrow() {
  const state = useCowriterStore()
  if (!state) throw new Error('Please call `useProvideCowriterStore` on the appropriate parent component')
  return state
}
