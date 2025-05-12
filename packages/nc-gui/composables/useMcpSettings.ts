import { type MCPTokenType } from 'nocodb-sdk'
import dayjs from 'dayjs'

export type MCPTokenExtendedType = MCPTokenType & {
  isNew?: boolean
  loading?: boolean
  error?: boolean
  created_display_name?: string
}

export const useMcpSettings = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { user } = useGlobal()

  const { t } = useI18n()

  const basesStore = useBases()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeProjectId } = storeToRefs(basesStore)

  const { basesUser } = storeToRefs(basesStore)

  const baseUsers = computed(() => (activeProjectId.value ? basesUser.value.get(activeProjectId.value) || [] : []))

  const mcpTokens = ref<MCPTokenExtendedType[]>([] as MCPTokenExtendedType[])

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
            created_display_name: user?.display_name ?? user?.email ?? '',
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
            created_display_name: user?.display_name ?? user?.email ?? '',
          }
        }
      }

      message.success(t('msg.success.mcpTokenCreated'))
      isCreatingMcpToken.value = false
    } catch (error: any) {
      isCreatingMcpToken.value = false
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const updateMcpToken = async (token: MCPTokenExtendedType) => {
    try {
      token.loading = true

      await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'mcpUpdate',
        },
        {
          tokenId: token.id,
          title: token.title,
          expires_at: token.expires_at,
        },
      )

      token.loading = false
      message.success(t('msg.success.mcpTokenUpdated'))
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      token.loading = false
      console.error(error)
    }
  }

  const deleteMcpToken = async (token: MCPTokenExtendedType) => {
    if (!activeProjectId.value || !activeWorkspaceId.value) return

    try {
      // Add loading state
      const tokenToDelete = mcpTokens.value.find((t) => t.id === token.id)
      if (tokenToDelete) {
        tokenToDelete.loading = true
      }

      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'mcpDelete',
        },
        {
          tokenId: token.id,
        },
      )

      // Only remove from the list if successful
      if (response) {
        mcpTokens.value = mcpTokens.value.filter((t) => t.id !== token.id)
        message.success(t('msg.success.mcpTokenDeleted'))
      } else {
        // Reset loading state if unsuccessful
        if (tokenToDelete) {
          tokenToDelete.loading = false
        }
        message.error(t('msg.error.failedToDeleteMcpToken'))
      }
    } catch (error: any) {
      const tokenToDelete = mcpTokens.value.find((t) => t.id === token.id)
      if (tokenToDelete) {
        tokenToDelete.loading = false
      }

      message.error(await extractSdkResponseErrorMsg(error))
      console.error('Error deleting MCP token:', error)
    }
  }

  const addNewMcpToken = () => {
    newMcpTokenTitle.value = `MCP - ${user.value?.display_name} - ${dayjs().format('D MMMM YYYY, h:mm A')}`
    mcpTokens.value = [
      {
        title: newMcpTokenTitle.value,
        isNew: true,
      },
      ...mcpTokens.value,
    ]
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
  }
})
