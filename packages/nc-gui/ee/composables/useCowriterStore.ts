import type { ColumnType, CowriterType, ProjectType, TableReqType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, useCopy, useNuxtApp } from '#imports'

const [useProvideCowriterStore, useCowriterStore] = useInjectionState((projectId: string) => {
  enum COWRITER_TABS {
    INPUT_FIELDS_KEY = 'cowriter-form',
    INPUT_PROMPT_KEY = 'cowriter-prompt',
    OUTPUT_RESULT_KEY = 'cowriter-output',
    OUTPUT_HISTORY_KEY = 'cowriter-history',
    OUTPUT_STARRED_KEY = 'cowriter-starred',
    INPUT_FIELDS_VALUE = 'Fields',
    INPUT_PROMPT_VALUE = 'Prompt',
    OUTPUT_RESULT_VALUE = 'Output',
    OUTPUT_HISTORY_VALUE = 'History',
    OUTPUT_STARRED_VALUE = 'Starred',
  }

  const cowriterLayout = ref<'form' | 'grid'>('form')

  const cowriterProject = ref<ProjectType | null>()

  const cowriterTable = ref<TableType | TableReqType | null>()

  const cowriterFormView = ref<ViewType | null>()

  const cowriterGridView = ref<ViewType | null>()

  const cowriterHistoryList = ref<CowriterType[] | []>([])

  const cowriterOutputList = ref<CowriterType[] | []>([])

  const cowriterStarredList = ref<CowriterType[] | []>([])

  const cowriterInputActiveKey = ref(COWRITER_TABS.INPUT_FIELDS_KEY)

  const cowriterOutputActiveKey = ref(COWRITER_TABS.OUTPUT_RESULT_KEY)

  const cowriterFormRef = ref()

  const cowriterFormState = reactive<Record<string, any>>({})

  const promptStatementTemplate = ref('')

  const generateCowriterLoading = ref(false)

  const generateColumnBtnLoading = ref(false)

  const maxCowriterGeneration = ref(1)

  const unsupportedColumnTypes: string[] = [
    UITypes.Rollup,
    UITypes.Lookup,
    UITypes.Formula,
    UITypes.QrCode,
    UITypes.SpecificDBType,
  ]

  const supportedColumns = computed(
    () =>
      ((cowriterTable.value as TableType)?.columns || [])
        .filter((c: ColumnType) => !unsupportedColumnTypes.includes(c.uidt) && !isSystemColumn(c))
        .sort((a, b) => a.order! - b.order!) || [],
  )

  const { $api } = useNuxtApp()

  const { copy } = useCopy()

  async function loadCowriterProject() {
    try {
      cowriterProject.value = await $api.project.read(projectId)
      if (cowriterProject.value) {
        const meta =
          typeof cowriterProject.value.meta === 'string' ? JSON.parse(cowriterProject.value.meta) : cowriterProject.value.meta
        promptStatementTemplate.value = meta?.prompt_statement ?? ''
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function clearCowriterOutput() {
    if (cowriterOutputList.value.length) {
      await Promise.all(
        cowriterOutputList.value.map(
          async (record) => await $api.cowriterTable.patch(cowriterTable.value!.id!, record!.id!, { is_read: true }),
        ),
      )
        .then(async () => {
          await loadCowriterList()
          message.success('Outputs have been cleared. They will be still available in History.')
        })
        .catch(async (e: any) => {
          message.error(await extractSdkResponseErrorMsg(e))
        })
    }
  }

  async function loadCowriterTable() {
    try {
      const firstTable = (await $api.dbTable.list(projectId)).list?.[0]
      cowriterTable.value = await $api.dbTable.read(firstTable!.id!)
      await loadCowriterView()
      await loadCowriterList()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function loadCowriterView() {
    try {
      const { views } = storeToRefs(useViewsStore())
      const { loadViews } = useViewsStore()
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
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
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
    await Promise.all(generationTasks)
      .then((results) => {
        results.forEach((cowriter: CowriterType) => {
          ;(cowriterOutputList.value as CowriterType[]).unshift(cowriter)
          ;(cowriterHistoryList.value as CowriterType[]).unshift(cowriter)
        })
      })
      .catch(async (e: any) => {
        message.error(await extractSdkResponseErrorMsg(e))
      })
    generateCowriterLoading.value = false
  }

  async function loadCowriterList() {
    try {
      cowriterHistoryList.value = (await $api.cowriterTable.list(cowriterTable.value!.id!)).list as CowriterType[]
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    try {
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
    } catch (e: any) {
      message.error(e)
    }
  }

  async function savePromptStatementTemplate() {
    if (!cowriterProject.value) return
    try {
      const oldMeta =
        typeof cowriterProject.value.meta === 'string' ? JSON.parse(cowriterProject.value.meta) : cowriterProject.value.meta
      $api.project.update(cowriterProject.value.id!, {
        meta: JSON.stringify({
          ...oldMeta,
          prompt_statement: promptStatementTemplate.value,
        }),
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function generateAIColumns(title: string) {
    if (!cowriterTable.value || !cowriterProject.value || !title) return
    try {
      await $api.cowriterTable.generateColumns(cowriterTable.value!.id!, { title })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
    await loadCowriterTable()
  }

  async function deleteCowriterFormColumn(columnId: string) {
    try {
      await $api.dbTableColumn.delete(columnId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
    await loadCowriterTable()
  }

  function copyCowriterOutput(output: string) {
    try {
      copy(output)
      message.success('Copied to clipboard')
    } catch {
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
    COWRITER_TABS,
    cowriterLayout,
    cowriterProject,
    cowriterTable,
    cowriterGridView,
    cowriterFormView,
    cowriterFormRef,
    cowriterFormState,
    cowriterHistoryList,
    cowriterOutputList,
    cowriterStarredList,
    cowriterInputActiveKey,
    cowriterOutputActiveKey,
    clearCowriterOutput,
    copyCowriterOutput,
    deleteCowriterFormColumn,
    promptStatementTemplate,
    loadCowriterTable,
    loadCowriterList,
    generateCowriter,
    getUpdatedStarredInMeta,
    generateAIColumns,
    generateCowriterLoading,
    generateColumnBtnLoading,
    starCowriterOutput,
    savePromptStatementTemplate,
    unsupportedColumnTypes,
    supportedColumns,
    maxCowriterGeneration,
  }
})

export { useProvideCowriterStore }

export function useCowriterStoreOrThrow() {
  const state = useCowriterStore()
  if (!state) throw new Error('Please call `useProvideCowriterStore` on the appropriate parent component')
  return state
}
