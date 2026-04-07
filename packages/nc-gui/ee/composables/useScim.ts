import { message } from 'ant-design-vue'
import { WorkspaceUserRoles } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

export interface ScimConfig {
  id?: string
  fk_org_id?: string
  enabled: boolean
  provisioning_token?: string
  base_url?: string
  role_mapping?: Record<string, any>
  default_role?: string
  token_exists?: boolean
}

export const useScim = (orgId: ComputedRef<string> | Ref<string>) => {
  const { $state, $api } = useNuxtApp()
  const { t } = useI18n()

  const baseURL = $api.instance.defaults.baseURL

  const scimConfig = ref<ScimConfig | null>(null)
  const isLoading = ref(false)
  const tokenVisible = ref(false) // Controls token visibility after generation

  const scimFetch = <T = any>(path: string, opts: Record<string, any> = {}) => {
    return $fetch<T>(path, {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'xc-auth': $state.token.value as string,
      },
      ...opts,
    })
  }

  const configPath = () => `/api/v3/meta/orgs/${orgId.value}/scim/config`

  // Fetch SCIM configuration
  const fetchScimConfig = async () => {
    if (!orgId.value) return

    try {
      isLoading.value = true
      scimConfig.value = await scimFetch<ScimConfig>(configPath())
      tokenVisible.value = false
    } catch {
      scimConfig.value = null
    } finally {
      isLoading.value = false
    }
  }

  // Initialize SCIM configuration
  const initializeScim = async () => {
    if (!orgId.value) return

    try {
      isLoading.value = true
      const response = await scimFetch<ScimConfig>(configPath(), { method: 'POST' })
      scimConfig.value = response
      tokenVisible.value = true
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
    if (!orgId.value) return

    try {
      isLoading.value = true
      const response = await scimFetch<ScimConfig>(`${configPath()}/token/regenerate`, { method: 'POST' })
      if (scimConfig.value && response.provisioning_token) {
        scimConfig.value.provisioning_token = response.provisioning_token
        scimConfig.value.token_exists = true
      }
      tokenVisible.value = true
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
    if (!orgId.value) return

    try {
      isLoading.value = true
      await scimFetch(configPath(), { method: 'PATCH', body: { enabled } })
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

  // Update default role
  const updateDefaultRole = async (role: string) => {
    if (!orgId.value) return

    try {
      await scimFetch(configPath(), { method: 'PATCH', body: { default_role: role } })
      if (scimConfig.value) {
        scimConfig.value.default_role = role
      }
      message.success(t('msg.success.defaultRoleUpdated'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      throw e
    }
  }

  // Delete SCIM configuration
  const deleteScimConfig = async () => {
    if (!orgId.value) return

    try {
      isLoading.value = true
      await scimFetch(configPath(), { method: 'DELETE' })
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
    updateDefaultRole,
    deleteScimConfig,
  }
}
