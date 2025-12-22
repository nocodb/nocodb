import { PlanLimitTypes, type ScriptType } from 'nocodb-sdk'
import { parseScript, validateConfigValues } from 'nocodb-sdk'
import { DlgScriptCreate } from '#components'

export const useScriptStore = defineStore('script', () => {
  const { $api, $e } = useNuxtApp()
  const router = useRouter()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const bases = useBases()
  const { activeProjectId } = storeToRefs(bases)
  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { showScriptPlanLimitExceededModal, updateStatLimit } = useEeConfig()

  const { refreshCommandPalette } = useCommandPalette()

  // State
  const scripts = ref<Map<string, (ScriptType & { _dirty?: string | number })[]>>(new Map())
  const isUpdatingScript = ref(false)
  const isLoadingScript = ref(false)
  const isSettingsOpen = ref(false)
  const isMarketVisible = ref(false)

  const activeBaseScripts = computed(() => {
    if (!activeProjectId.value) return []
    return scripts.value.get(activeProjectId.value) || []
  })

  const activeScriptId = computed(() => route.params.scriptId as string)

  const activeScript = computed(() => {
    if (!activeScriptId.value) return null
    return activeBaseScripts.value.find((a) => a.id === activeScriptId.value) || null
  })

  const activeScriptUrlSlug = computed(() => {
    return route.params.slugs?.[0] || ''
  })

  const activeScriptReadableUrlSlug = computed(() => {
    if (!activeScript.value) return ''

    return toReadableUrlSlug([activeScript.value.title])
  })

  const activeBaseSchema = ref(null)
  // Actions
  const loadScripts = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!activeWorkspaceId.value) return []

    const existingScripts = scripts.value.get(baseId)
    if (existingScripts && !force) {
      return existingScripts
    }

    try {
      isLoadingScript.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'listScripts',
      })) as ScriptType[]

      scripts.value.set(baseId, response)
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoadingScript.value = false
    }
  }

  const loadScript = async (scriptId: string, showLoader = true) => {
    if (!activeProjectId.value || !activeWorkspaceId.value || !scriptId) {
      return null
    }

    let script: null | ScriptType = null

    if (scripts.value.get(activeProjectId.value)?.find((a) => a.id === scriptId)) {
      script = (scripts.value.get(activeProjectId.value) ?? []).find((a) => a.id === scriptId) || null
    }

    try {
      if (showLoader) {
        isLoadingScript.value = true
      }

      script =
        script ||
        ((await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'getScript',
          id: scriptId,
        })) as unknown as ScriptType)

      return script
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
        isLoadingScript.value = false
      }
    }
  }

  const duplicateScript = async (baseId: string, scriptId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'duplicateScript',
        },
        {
          id: scriptId,
        },
      )

      updateStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE, 1)

      const baseScripts = scripts.value.get(baseId) || []
      baseScripts.push(created)
      scripts.value.set(baseId, baseScripts)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        scriptId: created.id,
        scriptTitle: created.title,
      })

      await refreshCommandPalette()

      $e('a:script:duplicate')

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const createScript = async (baseId: string, scriptData: Partial<ScriptType>) => {
    if (!activeWorkspaceId.value) return null
    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'createScript',
        },
        scriptData,
      )

      updateStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE, 1)

      const baseScripts = scripts.value.get(baseId) || []
      baseScripts.push(created)
      scripts.value.set(baseId, baseScripts)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        scriptId: created.id,
        scriptTitle: created.title,
      })

      await refreshCommandPalette()

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const updateScript = async (
    baseId: string,
    scriptId: string,
    updates: Partial<ScriptType>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    if (!activeWorkspaceId.value) return null
    try {
      isUpdatingScript.value = true

      const script = scripts.value.get(baseId)?.find((a) => a.id === scriptId)
      const updated = options?.skipNetworkCall
        ? {
            ...script,
            ...updates,
          }
        : await $api.internal.postOperation(
            activeWorkspaceId.value,
            baseId,
            {
              operation: 'updateScript',
            },
            {
              ...updates,
              id: scriptId,
            },
          )

      await refreshCommandPalette()

      if (!options?.skipNetworkCall) {
        $e('a:script:update')
      }

      const baseScripts = scripts.value.get(baseId) || []
      const index = baseScripts.findIndex((a) => a.id === scriptId)
      if (index !== -1) {
        baseScripts[index] = {
          ...baseScripts[index],
          ...updated,
        } as unknown as ScriptType
        scripts.value.set(baseId, baseScripts)
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    } finally {
      isUpdatingScript.value = false
    }
  }

  const deleteScript = async (baseId: string, scriptId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'deleteScript',
        },
        {
          id: scriptId,
        },
      )

      updateStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE, -1)

      // Update local state
      const baseScripts = scripts.value.get(baseId) || []
      const filtered = baseScripts.filter((a) => a.id !== scriptId)
      scripts.value.set(baseId, filtered)

      if (activeScriptId.value === scriptId) {
        const nextScript = filtered[0]
        if (nextScript) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: activeProjectId.value,
            scriptId: nextScript.id,
            scriptTitle: nextScript.title,
          })
        }
      }

      await refreshCommandPalette()

      $e('a:script:delete')

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

  const openScript = async (script: ScriptType) => {
    if (!script.base_id || !script.id) return

    const basesS = bases.bases
    const workspaceId = workspaceStore.activeWorkspaceId

    let base = basesS.get(script.base_id)
    if (!base) {
      await bases.loadProject(script.base_id)
      base = basesS.get(script.base_id)
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
      scriptId: script.id,
      scriptTitle: script.title,
    })
  }

  const updateBaseSchema = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      activeBaseSchema.value = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'baseSchema',
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
    }
  }

  watch(activeProjectId, async () => {
    if (activeWorkspaceId.value && activeProjectId.value) {
      await updateBaseSchema()
    }
  })

  // Watch for active script changes
  watch(activeScriptId, async (scriptId) => {
    let script
    if (!activeProjectId.value) return
    if (scriptId) {
      script = await loadScript(scriptId)
    }

    if (script) {
      const scriptCode = parseScript(script.script ?? '')
      const isValid = validateConfigValues(scriptCode ?? {}, script?.config ?? {})
      if (isValid?.length) {
        isSettingsOpen.value = true
      } else {
        if (script) {
          isSettingsOpen.value = true
        }
        isSettingsOpen.value = false
      }
    }
  })

  // Script details modal

  const { availableScripts, getPluginDescription, getScriptContent, getPluginAssetUrl, pluginTypes, pluginDescriptionContent } =
    usePlugin()

  const isDetailsVisible = ref(false)
  const detailsScriptId = ref<string>()

  const showScriptDetails = (scriptId: string) => {
    detailsScriptId.value = scriptId
    isDetailsVisible.value = true

    $e('c:script:details', { scriptId })
  }

  async function openNewScriptModal({
    baseId,
    e,
    loadScriptsOnClose,
    scrollOnCreate,
  }: {
    baseId?: string
    e?: string
    loadScriptsOnClose?: boolean
    scrollOnCreate?: boolean
  }) {
    if (!baseId || showScriptPlanLimitExceededModal()) return

    const isDlgOpen = ref(true)

    const { close } = useDialog(DlgScriptCreate, {
      'modelValue': isDlgOpen,
      'baseId': baseId,
      'onUpdate:modelValue': () => closeDialog(),
      'onCreated': async (script: ScriptType) => {
        closeDialog()

        if (loadScriptsOnClose) {
          await loadScripts({ baseId, force: true })
        }

        $e(e ?? 'a:script:create')

        if (!script) return

        if (scrollOnCreate) {
          setTimeout(() => {
            const newScriptDom = document.querySelector(`[data-script-id="${script.id}"]`)
            if (!newScriptDom) return

            // Scroll to the script node
            newScriptDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 1000)
        }
      },
    })

    function closeDialog() {
      isDlgOpen.value = false
      close(1000)
    }
  }

  /**
   * Keeps the browser URL slug in sync with the script's readable slug.
   * Triggers only when:
   * - The current browser URL slug is missing, OR
   * - The browser URL slug does not match the script's readable slug.
   */
  watch(
    [activeScriptReadableUrlSlug, activeScriptUrlSlug],
    ([newActiveScriptReadableUrlSlug, newActiveScriptUrlSlug]) => {
      if (!newActiveScriptReadableUrlSlug || newActiveScriptUrlSlug === newActiveScriptReadableUrlSlug) return

      const slugs = (route.params.slugs as string[]) || []

      const newSlug = [newActiveScriptReadableUrlSlug]

      if (slugs.length > 1) {
        newSlug.push(...slugs.slice(1))
      }

      router.replace({
        name: 'index-typeOrId-baseId-index-scripts-scriptId-slugs',
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
    scripts,
    activeScript,
    isUpdatingScript,
    isLoadingScript,
    isSettingsOpen,
    activeBaseSchema,

    // Getters
    activeBaseScripts,
    activeScriptId,

    // Actions
    loadScripts,
    loadScript,
    createScript,
    updateScript,
    deleteScript,
    openScript,

    // Script Templates
    showScriptDetails,
    isDetailsVisible,
    detailsScriptId,
    isMarketVisible,
    availableScripts,
    getScriptDescription: getPluginDescription,
    descriptionContent: pluginDescriptionContent,
    getScriptContent,
    getScriptAssetsURL: (pathOrUrl: string) => getPluginAssetUrl(pathOrUrl, pluginTypes.script),
    openNewScriptModal,
    duplicateScript,
    updateBaseSchema,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useScriptStore, import.meta.hot))
}
