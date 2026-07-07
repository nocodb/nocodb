import type { EnvironmentReqType, EnvironmentType } from 'nocodb-sdk'

/**
 * Which scope the store currently targets. Org-level environment management is
 * a separate surface (the org admin page) that talks to the v3 REST API
 * directly — org environments have no internal-op counterpart.
 */
export type EnvironmentScopeType = 'workspace' | 'base'

export const useEnvironments = defineStore('environmentsStore', () => {
  const environments = ref<EnvironmentType[]>([])

  const isLoading = ref(false)

  const activeScope = ref<EnvironmentScopeType>('workspace')

  const activeEnvironmentKey = ref<string>('production')

  const activeEnvironment = computed<EnvironmentType | undefined>(() => undefined)

  const sandboxEnvironmentKey = computed<string | null>(() => null)

  const loadEnvironments = async (_opts?: { force?: boolean }): Promise<EnvironmentType[]> => []

  const createEnvironment = async (_body: EnvironmentReqType): Promise<EnvironmentType | undefined> => undefined

  const updateEnvironment = async (
    _environmentId: string,
    _body: Partial<EnvironmentReqType>,
  ): Promise<EnvironmentType | undefined> => undefined

  const deleteEnvironment = async (_environmentId: string): Promise<boolean> => false

  const setIntegrationEnvConfig = async (
    _integrationId: string,
    _environmentId: string,
    _config: Record<string, any>,
  ): Promise<unknown> => undefined

  const deleteIntegrationEnvConfig = async (_integrationId: string, _environmentId: string): Promise<boolean> => false

  return {
    environments,
    isLoading,
    activeScope,
    activeEnvironmentKey,
    activeEnvironment,
    sandboxEnvironmentKey,
    loadEnvironments,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setIntegrationEnvConfig,
    deleteIntegrationEnvConfig,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEnvironments as any, import.meta.hot))
}
