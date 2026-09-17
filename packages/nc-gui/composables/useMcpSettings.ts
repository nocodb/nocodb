import { type MCPTokenType } from 'nocodb-sdk'
import dayjs from 'dayjs'

export type MCPTokenExtendedType = MCPTokenType & {
  isNew?: boolean
  loading?: boolean
  error?: boolean
  created_display_name?: string
  workspace?: { title?: string }
  base?: { title?: string }
}

export const useMcpSettings = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const basesStore = useBases()

  const { activeWorkspaceId, activeWorkspace } = storeToRefs(useWorkspace())

  const { activeProjectId, openedProject } = storeToRefs(basesStore)

  const { basesUser } = storeToRefs(basesStore)

  const baseUsers = computed(() => (activeProjectId.value ? basesUser.value.get(activeProjectId.value) || [] : []))

  const mcpTokens = ref<MCPTokenExtendedType[]>([] as MCPTokenExtendedType[])

  const accountMcpTokens = ref<MCPTokenExtendedType[]>([])

  const newMcpTokenTitle = ref('')

  const isCreatingMcpToken = ref(false)

  const isUnsavedMCPTokenPending = computed(() => mcpTokens.value.some((t) => t.isNew))

  const listMcpTokens = async () => {
    try {
      const response = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'mcpList',
      })

      if (response && Array.isArray(response)) {
        mcpTokens.value = response.map((token: MCPTokenType) => {
          const user = baseUsers.value.find((u) => u.id === token.fk_user_id)
          return {
            ...token,
            isNew: false,
            created_display_name: extractUserDisplayNameOrEmail(user),
          }
        })
      }
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const cancelNewMcpToken = () => {
    mcpTokens.value = mcpTokens.value.filter((t) => !t.isNew)
  }

  const createMcpToken = async (token: Partial<MCPTokenExtendedType>) => {
    if (!activeProjectId.value) return

    try {
      isCreatingMcpToken.value = true

      // trim title before saving
      if (newMcpTokenTitle.value) {
        newMcpTokenTitle.value = newMcpTokenTitle.value.trim()
      }

      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'mcpCreate',
        },
        {
          ...token,
          title: newMcpTokenTitle.value,
        },
      )

      if (response) {
        // Replace the new token placeholder with the created token
        const index = mcpTokens.value.findIndex((t) => t.isNew)
        if (index !== -1) {
          const createdToken = response
          const user = baseUsers.value.find((u) => u.id === createdToken.fk_user_id)
          mcpTokens.value[index] = {
            ...createdToken,
            isNew: false,
            created_display_name: extractUserDisplayNameOrEmail(user),
          }
        }
      }

      message.success(t('msg.success.mcpTokenCreated'))
      isCreatingMcpToken.value = false
      return response
    } catch (error: any) {
      isCreatingMcpToken.value = false
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const updateMcpToken = async (token: MCPTokenExtendedType, isAccountLevel = false) => {
    const workspaceId = isAccountLevel ? token.fk_workspace_id : activeWorkspaceId.value
    const baseId = isAccountLevel ? token.base_id : activeProjectId.value

    if (!workspaceId || !baseId) return

    const tokenList = isAccountLevel ? accountMcpTokens : mcpTokens

    try {
      token.loading = true

      const res = await $api.internal.postOperation(
        workspaceId,
        baseId,
        {
          operation: 'mcpUpdate',
        },
        {
          tokenId: token.id,
        },
      )

      token.loading = false
      message.success(t('msg.success.mcpTokenUpdated'))

      // Update the token in the appropriate list
      if (isAccountLevel) {
        const index = tokenList.value.findIndex((t) => t.id === token.id)
        if (index !== -1 && res) {
          tokenList.value[index] = { ...tokenList.value[index], ...res }
        }
      }

      return res
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      token.loading = false
      console.error(error)
    }
  }

  const deleteMcpToken = async (token: MCPTokenExtendedType, isAccountLevel = false) => {
    const workspaceId = isAccountLevel ? token.fk_workspace_id : activeWorkspaceId.value
    const baseId = isAccountLevel ? token.base_id : activeProjectId.value

    if (!workspaceId || !baseId) return

    try {
      const tokenList = isAccountLevel ? accountMcpTokens : mcpTokens

      // Add loading state
      const tokenToDelete = tokenList.value.find((t) => t.id === token.id)
      if (tokenToDelete) {
        tokenToDelete.loading = true
      }

      const response = await $api.internal.postOperation(
        workspaceId,
        baseId,
        {
          operation: 'mcpDelete',
        },
        {
          tokenId: token.id,
        },
      )

      // Only remove from the list if successful
      if (response) {
        tokenList.value = tokenList.value.filter((t) => t.id !== token.id)
        message.toast(t('msg.success.mcpTokenDeleted'))
      } else {
        if (tokenToDelete) {
          tokenToDelete.loading = false
        }
        message.error(t('msg.error.failedToDeleteMcpToken'))
      }
    } catch (error: any) {
      const tokenList = isAccountLevel ? accountMcpTokens.value : mcpTokens.value
      const tokenToDelete = tokenList.find((t) => t.id === token.id)
      if (tokenToDelete) {
        tokenToDelete.loading = false
      }

      message.error(await extractSdkResponseErrorMsg(error))
      console.error('Error deleting MCP token:', error)
    }
  }

  const addNewMcpToken = () => {
    newMcpTokenTitle.value = `${openedProject.value?.title || 'Base'}(${activeWorkspace.value?.title}) : ${dayjs().format(
      'D MMMM YYYY, h:mm A',
    )}`

    mcpTokens.value = [
      {
        title: newMcpTokenTitle.value,
        isNew: true,
      },
      ...mcpTokens.value,
    ]
  }

  const listAccountMcpTokens = async (baseId?: string) => {
    try {
      // `baseId` rides the query through to the handler, which narrows the
      // list to connections that reach that base (base settings view).
      const response = await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'mcpRootList',
        ...(baseId ? { baseId } : {}),
      } as any)

      if (response && Array.isArray(response)) {
        accountMcpTokens.value = response.map((token: any) => ({
          ...token,
          isNew: false,
        }))
      }
      return accountMcpTokens.value
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
      return []
    }
  }

  const toolCatalog = ref<McpToolCatalogEntry[]>([])

  /** What a connection can be granted, read off the tool surface itself. */
  const loadToolCatalog = async () => {
    if (toolCatalog.value.length) return toolCatalog.value

    try {
      const response = await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'mcpToolCatalog',
      })

      toolCatalog.value = (response as { list?: McpToolCatalogEntry[] })?.list ?? []
    } catch (error: any) {
      // The picker still works without it — the tiers are known, only the tool
      // names and counts come from here.
      console.error(error)
    }

    return toolCatalog.value
  }

  const createAccountMcpToken = async (payload: { title: string; scopes: ApiTokenScopeEntry[]; tools: string[] }) => {
    try {
      isCreatingMcpToken.value = true

      const response = await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'mcpRootCreate' }, payload)

      // No toast: the page itself moves to the setup phase, which is the confirmation.
      if (response) {
        accountMcpTokens.value = [{ ...response, isNew: false }, ...accountMcpTokens.value]
      }

      return response
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    } finally {
      isCreatingMcpToken.value = false
    }
  }

  /** A connection whose authority is its scopes carries no base to address it by. */
  const isScopedMcpToken = (token: MCPTokenExtendedType) => !token.base_id || token.base_id === NO_SCOPE

  const regenerateAccountMcpToken = async (token: MCPTokenExtendedType) => {
    // A row with a real base is still reachable base-scoped, which is the only
    // shape CE ever produces — so the branch is on the row, not the edition.
    if (!isScopedMcpToken(token)) return updateMcpToken(token, true)

    try {
      token.loading = true
      const res = await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'mcpRootUpdate' }, { tokenId: token.id })

      if (res) {
        const index = accountMcpTokens.value.findIndex((t) => t.id === token.id)
        if (index !== -1) accountMcpTokens.value[index] = { ...accountMcpTokens.value[index], ...res }
        message.toast(t('msg.success.mcpTokenUpdated'))
      }

      return res
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    } finally {
      token.loading = false
    }
  }

  /** Change a scoped connection's name, reach or tools; its secret stays. */
  const updateAccountMcpToken = async (
    token: MCPTokenExtendedType,
    payload: { title: string; scopes: ApiTokenScopeEntry[]; tools: string[] },
  ) => {
    try {
      isCreatingMcpToken.value = true

      const res = await $api.internal.postOperation(
        NO_SCOPE,
        NO_SCOPE,
        { operation: 'mcpRootUpdate' },
        { tokenId: token.id, ...payload },
      )

      if (res) {
        const index = accountMcpTokens.value.findIndex((t) => t.id === token.id)
        if (index !== -1) accountMcpTokens.value[index] = { ...accountMcpTokens.value[index], ...res }
        message.toast(t('msg.success.mcpTokenUpdated'))
      }

      return res
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    } finally {
      isCreatingMcpToken.value = false
    }
  }

  const deleteAccountMcpToken = async (token: MCPTokenExtendedType) => {
    if (!isScopedMcpToken(token)) return deleteMcpToken(token, true)

    try {
      token.loading = true
      const res = await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'mcpRootDelete' }, { tokenId: token.id })

      if (res) {
        accountMcpTokens.value = accountMcpTokens.value.filter((t) => t.id !== token.id)
        message.toast(t('msg.success.mcpTokenDeleted'))
      } else {
        message.error(t('msg.error.failedToDeleteMcpToken'))
      }
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    } finally {
      token.loading = false
    }
  }

  return {
    mcpTokens,
    createMcpToken,
    listMcpTokens,
    updateMcpToken,
    deleteMcpToken,
    isUnsavedMCPTokenPending,
    cancelNewMcpToken,
    addNewMcpToken,
    isCreatingMcpToken,
    newMcpTokenTitle,
    // Account-level
    accountMcpTokens,
    listAccountMcpTokens,
    createAccountMcpToken,
    toolCatalog,
    loadToolCatalog,
    regenerateAccountMcpToken,
    updateAccountMcpToken,
    deleteAccountMcpToken,
    isScopedMcpToken,
  }
})
