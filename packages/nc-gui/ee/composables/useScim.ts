import { message } from 'ant-design-vue'
import type { ComputedRef, Ref } from 'vue'

export interface ScimConfig {
  id?: string
  fk_workspace_id?: string
  enabled: boolean
  provisioning_token?: string
  base_url?: string
  role_mapping?: Record<string, any>
  token_exists?: boolean
}

export const useScim = (workspaceId: ComputedRef<string> | Ref<string>) => {
  const { $state, $api } = useNuxtApp()
  const { t } = useI18n()

  const baseURL = $api.instance.defaults.baseURL

  const scimConfig = ref<ScimConfig | null>(null)
  const isLoading = ref(false)
  const tokenVisible = ref(false) // Controls token visibility after generation

  // Fetch SCIM configuration
  const fetchScimConfig = async () => {
    if (!workspaceId.value) return

    try {
      isLoading.value = true
      const response = await $fetch<ScimConfig>(
        `${baseURL}/api/v3/meta/workspaces/${workspaceId.value}/scim/config`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'xc-auth': $state.token.value as string,
          },
        }
      )
      scimConfig.value = response
      tokenVisible.value = false // Mask token by default
    } catch (e: any) {
      // SCIM not configured yet - 404 is expected
      if (e?.status !== 404 && e?.statusCode !== 404) {
        console.error('Failed to fetch SCIM config:', e)
      }
      scimConfig.value = null
    } finally {
      isLoading.value = false
    }
  }

  // Initialize SCIM configuration
  const initializeScim = async () => {
    if (!workspaceId.value) return

    try {
      isLoading.value = true
      const response = await $fetch<ScimConfig>(
        `${baseURL}/api/v3/meta/workspaces/${workspaceId.value}/scim/config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xc-auth': $state.token.value as string,
          },
          body: {
            siteUrl: window.location.origin,
          },
        }
      )
      scimConfig.value = response
      tokenVisible.value = true // Show token on first generation
      message.success(t('msg.success.scimInitialized'))
      return response
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // Regenerate provisioning token
  const regenerateToken = async () => {
    if (!workspaceId.value) return

    try {
      isLoading.value = true
      const response = await $fetch<ScimConfig>(
        `${baseURL}/api/v3/meta/workspaces/${workspaceId.value}/scim/config/token/regenerate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xc-auth': $state.token.value as string,
          },
        }
      )
      if (scimConfig.value && response.provisioning_token) {
        scimConfig.value.provisioning_token = response.provisioning_token
        scimConfig.value.token_exists = true
      }
      tokenVisible.value = true // Show new token
      message.success(t('msg.success.tokenRegenerated'))
      return response
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // Toggle SCIM enabled/disabled
  const toggleScim = async (enabled: boolean) => {
    if (!workspaceId.value) return

    try {
      isLoading.value = true
      await $fetch(`${baseURL}/api/v3/meta/workspaces/${workspaceId.value}/scim/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'xc-auth': $state.token.value as string,
        },
        body: { enabled },
      })
      if (scimConfig.value) {
        scimConfig.value.enabled = enabled
      }
      message.success(enabled ? t('msg.success.scimEnabled') : t('msg.success.scimDisabled'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // Delete SCIM configuration
  const deleteScimConfig = async () => {
    if (!workspaceId.value) return

    try {
      isLoading.value = true
      await $fetch(`${baseURL}/api/v3/meta/workspaces/${workspaceId.value}/scim/config`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'xc-auth': $state.token.value as string,
        },
      })
      scimConfig.value = null
      message.success(t('msg.success.scimDeleted'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    scimConfig,
    isLoading,
    tokenVisible,
    fetchScimConfig,
    initializeScim,
    regenerateToken,
    toggleScim,
    deleteScimConfig,
  }
}
