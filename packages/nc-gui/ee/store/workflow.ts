import { PlanLimitTypes, type WorkflowType } from 'nocodb-sdk'

export const useWorkflowStore = defineStore('workflow', () => {
  const { $api, $e } = useNuxtApp()
  const router = useRouter()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const bases = useBases()
  const { activeProjectId } = storeToRefs(bases)
  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { showWorkflowPlanLimitExceededModal, updateStatLimit } = useEeConfig()

  const { refreshCommandPalette } = useCommandPalette()

  // State
  const workflows = ref<Map<string, (WorkflowType & { _dirty?: string | number })[]>>(new Map())
  const isUpdatingWorkflow = ref(false)
  const isLoadingWorkflow = ref(false)

  const activeBaseWorkflows = computed(() => {
    if (!activeProjectId.value) return []
    return workflows.value.get(activeProjectId.value) || []
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
    if (!activeWorkspaceId.value) return []

    const existingWorkflows = workflows.value.get(baseId)
    if (existingWorkflows && !force) {
      return existingWorkflows
    }

    try {
      isLoadingWorkflow.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'workflowList',
      })) as WorkflowType[]

      workflows.value.set(baseId, response)
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoadingWorkflow.value = false
    }
  }

  const loadWorkflow = async (workflowId: string, showLoader = true) => {
    if (!activeProjectId.value || !activeWorkspaceId.value || !workflowId) {
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
      baseWorkflows.push(created)
      workflows.value.set(baseId, baseWorkflows)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        workflowId: created.id,
        workflowTitle: created.title,
      })

      await refreshCommandPalette()

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
      isUpdatingWorkflow.value = true

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

      await refreshCommandPalette()

      if (!options?.skipNetworkCall) {
        $e('a:workflow:update')
      }

      const baseWorkflows = workflows.value.get(baseId) || []
      const index = baseWorkflows.findIndex((a) => a.id === workflowId)
      if (index !== -1) {
        baseWorkflows[index] = {
          ...baseWorkflows[index],
          ...updated,
        } as unknown as WorkflowType
        workflows.value.set(baseId, baseWorkflows)
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    } finally {
      isUpdatingWorkflow.value = false
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

      await refreshCommandPalette()

      $e('a:workflow:delete')

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

    const basesS = bases.bases
    const workspaceId = workspaceStore.activeWorkspaceId

    let base = basesS.get(workflow.base_id)
    if (!base) {
      await bases.loadProject(workflow.base_id)
      base = basesS.get(workflow.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = workspaceId
    if (['nc', 'base'].includes(route.params.typeOrId as string)) {
      workspaceIdOrType = route.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id
    if (['base'].includes(route.params.typeOrId as string)) {
      baseIdOrBaseId = route.params.baseId as string
    }

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
      const workflow = await loadWorkflow(workflowId, false)
      if (!workflow) return null

      const duplicated = await createWorkflow(baseId, {
        title: `${workflow.title} (copy)`,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        config: workflow.config,
        meta: workflow.meta,
      })

      $e('a:workflow:duplicate')

      return duplicated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const openNewWorkflowModal = async ({ baseId }: { baseId: string }) => {
    if (showWorkflowPlanLimitExceededModal()) {
      return
    }

    // For now, just create a new workflow with a default name
    const workflowCount = (workflows.value.get(baseId) || []).length
    await createWorkflow(baseId, {
      title: `Workflow ${workflowCount + 1}`,
    })
  }

  const openWorkflowDescriptionDialog = (workflow: WorkflowType) => {
    const isOpen = ref(true)

    const { close } = useDialog(resolveComponent('DlgWorkflowWorkflowDescriptionUpdate'), {
      'modelValue': isOpen,
      'workflow': workflow,
      'onUpdate:modelValue': () => {
        isOpen.value = false
        close(1000)
      },
    })
  }

  watch(activeProjectId, async () => {
    if (activeWorkspaceId.value && activeProjectId.value) {
      await loadWorkflows({ baseId: activeProjectId.value })
    }
  })

  // Watch for active workflow changes
  watch(activeWorkflowId, async (workflowId) => {
    if (!activeProjectId.value) return
    if (workflowId) {
      await loadWorkflow(workflowId)
    }
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
    isUpdatingWorkflow,
    isLoadingWorkflow,

    // Getters
    activeBaseWorkflows,
    activeWorkflowId,

    // Actions
    loadWorkflows,
    loadWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    openWorkflow,
    duplicateWorkflow,
    openNewWorkflowModal,
    openWorkflowDescriptionDialog,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkflowStore, import.meta.hot))
}
