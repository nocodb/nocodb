export function useDataReflection() {
  const { appInfo } = useGlobal()

  const { $api } = useNuxtApp()

  const { activeWorkspace } = storeToRefs(useWorkspace())

  const connectionDetails = ref()

  const selectedBase = ref<string>()

  const dataReflectionEnabled = computed(() => activeWorkspace.value?.data_reflection_enabled)

  const connectionHost = computed(
    () => connectionDetails.value?.host || (appInfo.value.ncSiteUrl ? `${new URL(appInfo.value.ncSiteUrl).hostname}` : ''),
  )

  const connectionUrl = computed(() => {
    return `postgresql://${connectionDetails.value.username}:${connectionDetails.value.password}@${connectionHost.value}:${
      connectionDetails.value.port
    }/${connectionDetails.value.database}${
      selectedBase.value ? `?options=-c%20search_path%3D${encodeURIComponent(selectedBase.value)}` : ''
    }`
  })

  const getConnectionDetails = async (baseId?: string) => {
    if (!activeWorkspace.value?.id) return

    const res = await $api.internal.getOperation(activeWorkspace.value.id, NO_SCOPE, {
      operation: 'getDataReflection',
    })

    if (baseId) {
      selectedBase.value = baseId
    }

    return (connectionDetails.value = res)
  }

  const createConnectionDetails = async (baseId?: string) => {
    if (!activeWorkspace.value?.id) return

    try {
      const res = await $api.internal.postOperation(
        activeWorkspace.value.id,
        NO_SCOPE,
        {
          operation: 'createDataReflection',
        },
        {},
      )

      if (baseId) {
        selectedBase.value = baseId
      }

      connectionDetails.value = res
      ;(activeWorkspace.value as any).data_reflection_enabled = true
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
    }

    return connectionDetails.value
  }

  const deleteConnectionDetails = async () => {
    if (!activeWorkspace.value?.id) return

    try {
      await $api.internal.postOperation(
        activeWorkspace.value.id,
        NO_SCOPE,
        {
          operation: 'deleteDataReflection',
        },
        {},
      )
      connectionDetails.value = null
      ;(activeWorkspace.value as any).data_reflection_enabled = false
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    connectionUrl,
    connectionHost,
    connectionDetails,
    selectedBase,
    dataReflectionEnabled,
    getConnectionDetails,
    createConnectionDetails,
    deleteConnectionDetails,
  }
}
