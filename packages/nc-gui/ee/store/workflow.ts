import { PlanLimitTypes, type WorkflowType } from 'nocodb-sdk'
import { DlgWorkflowCreate } from '#components'

export const useWorkflowStore = defineStore('workflow', () => {
  const { $api, $e } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { showWorkflowPlanLimitExceededModal, updateStatLimit } = useEeConfig()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const router = useRouter()

  const route = useRoute()

  const baseStore = useBases()

  const { loadProject } = baseStore

  const { activeProjectId, bases, basesUser } = storeToRefs(baseStore)

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const isWorkflowsEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.WORKFLOWS))

  const baseUsers = computed(() => (activeProjectId.value ? basesUser.value.get(activeProjectId.value) || [] : []))

  // State
  const workflows = ref<Map<string, (WorkflowType & { _dirty?: string | number; ___is_new?: boolean })[]>>(new Map())

  const workflowNodes = ref<Map<string, WorkflowNodeSchema[]>>(new Map())

  const isLoadingWorkflow = ref(false)

  const activeBaseWorkflows = computed(() => {
    if (!activeProjectId.value) return []

    return (workflows.value.get(activeProjectId.value) || []).map((wf) => {
      const createdUser = baseUsers.value.find((u) => u.id === wf.created_by)
      const updatedUser = wf.updated_by ? baseUsers.value.find((u) => u.id === wf.updated_by) : null

      return {
        ...wf,
        created_by_user: createdUser || null,
        updated_by_user: updatedUser || null,
      }
    })
  })

  const activeBaseNodeSchemas = computed<Array<WorkflowNodeSchema>>(() => {
    if (!activeProjectId.value) return []
    return workflowNodes.value.get(activeProjectId.value) || []
  })

  const activeWorkflowId = computed(() => route.params.workflowId as string)

  const activeWorkflow = computed(() => {
    if (!activeWorkflowId.value) return null
    return activeBaseWorkflows.value.find((a) => a.id === activeWorkflowId.value) || null
  })

  const activeWorkflowUrlSlug = computed(() => {
    return route.params.slugs?.[0] || ''
  })

  const activeWorkflowReadableUrlSlug = computed(() => {
    if (!activeWorkflow.value) return ''

    return toReadableUrlSlug([activeWorkflow.value.title])
  })

  // Actions
  const loadWorkflows = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!isWorkflowsEnabled.value || !activeWorkspaceId.value) return []

    const existingWorkflows = workflows.value.get(baseId)
    if (existingWorkflows && !force) {
      return existingWorkflows
    }

    try {
      isLoadingWorkflow.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'workflowList',
      })) as WorkflowType[]

      if (ncIsArray(response)) {
        workflows.value.set(baseId, response)
        return response
      } else {
        return []
      }
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoadingWorkflow.value = false
    }
  }

  const loadWorkflow = async (workflowId: string, showLoader = true) => {
    if (!activeProjectId.value || !isWorkflowsEnabled.value || !activeWorkspaceId.value || !workflowId) {
      return null
    }

    let workflow: null | WorkflowType = null

    if (workflows.value.get(activeProjectId.value)?.find((a) => a.id === workflowId)) {
      workflow = (workflows.value.get(activeProjectId.value) ?? []).find((a) => a.id === workflowId) || null
    }

    try {
      if (showLoader) {
        isLoadingWorkflow.value = true
      }

      workflow =
        workflow ||
        ((await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'workflowGet',
          workflowId,
        })) as unknown as WorkflowType)

      const baseWorkflows = workflows.value.get(activeProjectId.value) || []
      const filtered = baseWorkflows.filter((a) => a.id !== workflowId)
      filtered.push(workflow)
      filtered.sort((a, b) => (a?.order || 0) - (b?.order || 0))
      workflows.value.set(activeProjectId.value, filtered)

      return workflow
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
      })
      return null
    } finally {
      if (showLoader) {
        isLoadingWorkflow.value = false
      }
    }
  }

  const createWorkflow = async (baseId: string, workflowData: Partial<WorkflowType>) => {
    if (!activeWorkspaceId.value) return null
    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'workflowCreate',
        },
        workflowData,
      )

      updateStatLimit(PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE, 1)

      const baseWorkflows = workflows.value.get(baseId) || []
      baseWorkflows.push({
        ...created,
        ___is_new: true,
      })

      workflows.value.set(baseId, baseWorkflows)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        workflowId: created.id,
        workflowTitle: created.title,
      })

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const updateWorkflow = async (
    baseId: string,
    workflowId: string,
    updates: Partial<WorkflowType>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    if (!activeWorkspaceId.value) return null
    try {
      const workflow = workflows.value.get(baseId)?.find((a) => a.id === workflowId)
      const updated = options?.skipNetworkCall
        ? {
            ...workflow,
            ...updates,
          }
        : await $api.internal.postOperation(
            activeWorkspaceId.value,
            baseId,
            {
              operation: 'workflowUpdate',
            },
            {
              ...updates,
              workflowId,
            },
          )

      const baseWorkflows = workflows.value.get(baseId) || []
      const index = baseWorkflows.findIndex((a) => a.id === workflowId)

      if (index !== -1) {
        const updatedWorkflows = [...baseWorkflows]
        updatedWorkflows[index] = {
          ...baseWorkflows[index],
          ...updated,
        } as unknown as WorkflowType
        workflows.value.set(baseId, updatedWorkflows)
      }

      if (!options?.skipNetworkCall) {
        $e('a:workflow:update')
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteWorkflow = async (baseId: string, workflowId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'workflowDelete',
        },
        {
          workflowId,
        },
      )

      updateStatLimit(PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE, -1)

      $e('a:workflow:delete')

      // Update local state
      const baseWorkflows = workflows.value.get(baseId) || []
      const filtered = baseWorkflows.filter((a) => a.id !== workflowId)
      workflows.value.set(baseId, filtered)

      if (activeWorkflowId.value === workflowId) {
        const nextWorkflow = filtered[0]
        if (nextWorkflow) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: activeProjectId.value,
            workflowId: nextWorkflow.id,
            workflowTitle: nextWorkflow.title,
          })
        }
      }

      if (!filtered.length) {
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId: activeProjectId.value,
        })
      }

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const openWorkflow = async (workflow: WorkflowType) => {
    if (!workflow.base_id || !workflow.id) return

    let base = bases.value.get(workflow.base_id)
    if (!base) {
      await loadProject(workflow.base_id)
      base = bases.value.get(workflow.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = activeWorkspaceId.value
    if (['nc', 'base'].includes(route.params.typeOrId as string)) {
      workspaceIdOrType = route.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id
    if (['base'].includes(route.params.typeOrId as string)) {
      baseIdOrBaseId = route.params.baseId as string
    }

    $e('c:workflow:open')

    ncNavigateTo({
      workspaceId: workspaceIdOrType,
      baseId: baseIdOrBaseId,
      workflowId: workflow.id,
      workflowTitle: workflow.title,
    })
  }

  const duplicateWorkflow = async (baseId: string, workflowId: string) => {
    if (!activeWorkspaceId.value) return null

    if (showWorkflowPlanLimitExceededModal()) {
      return null
    }

    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'workflowDuplicate',
        },
        {
          workflowId,
        },
      )

      updateStatLimit(PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE, 1)

      const baseWorkflows = workflows.value.get(baseId) || []
      baseWorkflows.push(created)
      workflows.value.set(baseId, baseWorkflows)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        workflowId: created.id,
        workflowTitle: created.title,
      })

      $e('a:workflow:duplicate')

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const loadWorkflowNodes = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return
    try {
      const response = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'workflowNodes',
      })

      const nodes = ncIsArray(response?.nodes) ? response.nodes : []

      workflowNodes.value.set(activeProjectId.value, nodes as any)
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
    }
  }

  const getWorkflowNodeByKey = (key: string) => {
    return activeBaseNodeSchemas.value.find((n) => n.key === key)
  }

  const getWorkflowNodesByCategory = (category: string) => {
    return activeBaseNodeSchemas.value.filter((n) => n.category === category)
  }

  async function openNewWorkflowModal({
    baseId,
    e,
    loadWorkflowsOnClose,
    scrollOnCreate,
  }: {
    baseId?: string
    e?: string
    loadWorkflowsOnClose?: boolean
    scrollOnCreate?: boolean
  }) {
    if (!baseId || showWorkflowPlanLimitExceededModal()) return

    const isDlgOpen = ref(true)

    const { close } = useDialog(DlgWorkflowCreate, {
      'modelValue': isDlgOpen,
      'baseId': baseId,
      'onUpdate:modelValue': () => closeDialog(),
      'onCreated': async (workflow: WorkflowType) => {
        closeDialog()

        if (loadWorkflowsOnClose) {
          await loadWorkflows({ baseId, force: true })
        }

        $e(e ?? 'a:workflow:create')

        if (!workflow) return

        if (scrollOnCreate) {
          setTimeout(() => {
            const newWorkflowDom = document.querySelector(`[data-workflow-id="${workflow.id}"]`)
            if (!newWorkflowDom) return

            // Scroll to the workflow node
            newWorkflowDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 1000)
        }
      },
    })

    function closeDialog() {
      isDlgOpen.value = false
      close(1000)
    }
  }

  // Watch for active workflow changes
  watch(activeWorkflowId, async (workflowId) => {
    if (!activeProjectId.value) return
    if (workflowId) {
      await loadWorkflow(workflowId)
    }
  })

  watch(activeProjectId, async () => {
    if (activeWorkspaceId.value && activeProjectId.value) {
      await loadWorkflowNodes()
    }
  })

  onMounted(() => {
    loadWorkflowNodes()
  })

  /**
   * Keeps the browser URL slug in sync with the workflow's readable slug.
   * Triggers only when:
   * - The current browser URL slug is missing, OR
   * - The browser URL slug does not match the workflow's readable slug.
   */
  watch(
    [activeWorkflowReadableUrlSlug, activeWorkflowUrlSlug],
    ([newActiveWorkflowReadableUrlSlug, newActiveWorkflowUrlSlug]) => {
      if (!newActiveWorkflowReadableUrlSlug || newActiveWorkflowUrlSlug === newActiveWorkflowReadableUrlSlug) return

      const slugs = (route.params.slugs as string[]) || []

      const newSlug = [newActiveWorkflowReadableUrlSlug]

      if (slugs.length > 1) {
        newSlug.push(...slugs.slice(1))
      }

      router.replace({
        name: 'index-typeOrId-baseId-index-workflows-workflowId-slugs',
        params: {
          ...route.params,
          slugs: newSlug,
        },
        query: route.query,
        force: true,
      })
    },
    {
      immediate: true,
      flush: 'post',
    },
  )

  return {
    // State
    workflows,
    activeWorkflow,
    isLoadingWorkflow,

    // Getters
    isWorkflowsEnabled,
    activeBaseWorkflows,
    activeWorkflowId,
    activeBaseNodeSchemas,

    // Actions
    loadWorkflows,
    loadWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    openWorkflow,
    duplicateWorkflow,
    openNewWorkflowModal,

    // Node Schemas

    getWorkflowNodeByKey,
    getWorkflowNodesByCategory,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkflowStore, import.meta.hot))
}
