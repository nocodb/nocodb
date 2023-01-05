import type { CowriterType, ProjectType, TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useCopy, useNuxtApp, useViews } from '#imports'

const [useProvideCowriterStore, useCowriterStore] = useInjectionState((projectId: string) => {
  const cowriterLayout = ref<'form' | 'grid'>('form')

  const cowriterProject = ref<ProjectType | null>()

  const cowriterTable = ref<TableType | TableInfoType | null>()

  const cowriterFormView = ref<ViewType | null>()

  const cowriterGridView = ref<ViewType | null>()

  const cowriterHistoryList = ref<CowriterType[] | []>([])

  const cowriterOutputList = ref<CowriterType[] | []>([])

  const cowriterStarredList = ref<CowriterType[] | []>([])

  const cowriterInputActiveKey = ref('cowriter-form')

  const cowriterOutputActiveKey = ref('cowriter-output')

  const cowriterFormRef = ref()

  const cowriterFormState = reactive<Record<string, any>>({})

  const promptStatementTemplate = ref('')

  const generateCowriterLoading = ref(false)

  const generateColumnBtnLoading = ref(false)

  const maxCowriterGeneration = ref(1)

  const { $api } = useNuxtApp()

  const { copy } = useCopy()

  async function loadCowriterProject() {
    cowriterProject.value = await $api.project.read(projectId)

    if (cowriterProject.value) {
      const meta =
        typeof cowriterProject.value.meta === 'string' ? JSON.parse(cowriterProject.value.meta) : cowriterProject.value.meta
      promptStatementTemplate.value = meta?.prompt_statement ?? ''
    }
  }

  async function clearCowriterOutput() {
    if (cowriterOutputList.value.length) {
      await Promise.all(
        cowriterOutputList.value.map(
          async (record) => await $api.cowriterTable.patch(cowriterTable.value!.id!, record!.id!, { is_read: true }),
        ),
      )
      await loadCowriterList()
    }
  }

  async function loadCowriterTable() {
    const firstTable = (await $api.dbTable.list(projectId)).list?.[0]
    cowriterTable.value = await $api.dbTable.read(firstTable!.id!)
    await loadCowriterView()
    await loadCowriterList()
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

  async function generateCowriter() {
    if (!promptStatementTemplate.value) {
      message.warn('No prompt statement is found.')
      return
    }

    generateCowriterLoading.value = true
    try {
      await cowriterFormRef.value?.validateFields()
    } catch (e: any) {
      e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
      generateCowriterLoading.value = false
      if (e.errorFields.length) return
    }

    const generationTasks = []
    for (let i = 0; i < maxCowriterGeneration.value; i++) {
      generationTasks.push(await $api.cowriterTable.create(cowriterTable.value!.id!, cowriterFormState))
    }
    const generationResults = await Promise.all(generationTasks)
    generationResults.forEach((cowriter: CowriterType) => {
      ;(cowriterOutputList.value as CowriterType[]).unshift(cowriter)
      ;(cowriterHistoryList.value as CowriterType[]).unshift(cowriter)
    })
    generateCowriterLoading.value = false
  }

  async function loadCowriterList() {
    cowriterHistoryList.value = (await $api.cowriterTable.list(cowriterTable.value!.id!)).list as CowriterType[]
    cowriterOutputList.value = cowriterHistoryList.value.filter((o: CowriterType) => !!o.is_read! === false)
    cowriterStarredList.value = cowriterHistoryList.value.filter((o: CowriterType) => {
      if (!o.meta) return false
      let meta = o.meta
      if (typeof o.meta === 'string') meta = JSON.parse(o.meta)
      if ('starred' in meta) {
        return meta.starred
      } else {
        return false
      }
    })
  }

  async function savePromptStatementTemplate() {
    if (!cowriterProject.value) return
    const oldMeta =
      typeof cowriterProject.value.meta === 'string' ? JSON.parse(cowriterProject.value.meta) : cowriterProject.value.meta
    $api.project.update(cowriterProject.value.id!, {
      meta: JSON.stringify({
        ...oldMeta,
        prompt_statement: promptStatementTemplate.value,
      }),
    })
  }

  async function generateAIColumns(title: string) {
    if (!cowriterTable.value || !cowriterProject.value || !title) return
    await $api.cowriterTable.generateColumns(cowriterTable.value!.id!, { title })
    await loadCowriterTable()
  }

  async function deleteCowriterFormColumn(columnId: string) {
    await $api.dbTableColumn.delete(columnId)
    await loadCowriterTable()
  }

  function copyCowriterOutput(output: string) {
    try {
      copy(output)
      message.success('Copied to clipboard')
    } catch (_) {
      message.error('Failed to copy to clipboard')
    }
  }

  function getUpdatedStarredInMeta(meta: any) {
    if (!meta) meta = {}
    if (typeof meta === 'string') meta = JSON.parse(meta)
    if ('starred' in meta) {
      meta.starred = !meta.starred
    } else {
      meta.starred = true
    }
    return meta
  }

  async function starCowriterOutput(recordId: string, recordMeta: any) {
    try {
      const meta = getUpdatedStarredInMeta(recordMeta)
      await $api.cowriterTable.patch(cowriterTable.value!.id!, recordId, { meta })
      if (meta.starred) {
        message.success('Starred Output')
      } else {
        message.success('Unstarred Output')
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
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
    loadCowriterList,
    deleteCowriterFormColumn,
    generateCowriter,
    getUpdatedStarredInMeta,
    savePromptStatementTemplate,
    clearCowriterOutput,
    generateAIColumns,
    generateCowriterLoading,
    generateColumnBtnLoading,
    cowriterHistoryList,
    cowriterOutputList,
    cowriterStarredList,
    cowriterInputActiveKey,
    cowriterOutputActiveKey,
    copyCowriterOutput,
    starCowriterOutput,
    maxCowriterGeneration,
  }
})

export { useProvideCowriterStore }

export function useCowriterStoreOrThrow() {
  const state = useCowriterStore()
  if (!state) throw new Error('Please call `useProvideCowriterStore` on the appropriate parent component')
  return state
}
