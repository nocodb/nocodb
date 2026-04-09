import type { IntegrationType } from 'nocodb-sdk'

export function useBaseIntegrations() {
  const { $api } = useNuxtApp()

  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const linkedIntegrations = ref<IntegrationType[]>([])
  const isLoading = ref(false)
  const isLoaded = ref(false)

  const loadLinkedIntegrations = async (baseId: string, opts?: { type?: string; subType?: string }) => {
    if (!activeWorkspaceId.value || !baseId) return

    try {
      isLoading.value = true
      const result = await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'baseIntegrationList',
        ...(opts?.type ? { type: opts.type } : {}),
        ...(opts?.subType ? { subType: opts.subType } : {}),
      })

      linkedIntegrations.value = Array.isArray(result) ? result : []
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
      isLoaded.value = true
    }
  }

  const linkIntegration = async (baseId: string, integrationId: string) => {
    if (!activeWorkspaceId.value || !baseId) return

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, baseId, { operation: 'baseIntegrationLink', integrationId }, {})

      await loadLinkedIntegrations(baseId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const unlinkIntegration = async (baseId: string, integrationId: string) => {
    if (!activeWorkspaceId.value || !baseId) return

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'baseIntegrationUnlink', integrationId },
        {},
      )

      await loadLinkedIntegrations(baseId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    linkedIntegrations,
    isLoading,
    isLoaded,
    loadLinkedIntegrations,
    linkIntegration,
    unlinkIntegration,
  }
}
