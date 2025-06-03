import { type AuditType, type UserType, type WorkspaceUserType, auditV1OperationsCategory } from 'nocodb-sdk'

const defaultAuditLogsQuery = {
  type: [],
  workspaceId: undefined,
  baseId: undefined,
  sourceId: undefined,
  user: undefined,
  startDate: undefined,
  endDate: undefined,
  dateRangeLabel: undefined,
  orderBy: {
    created_at: 'desc',
    user: undefined,
  },
} as AuditLogsQuery

export type CollaboratorType = User | UserType | (WorkspaceUserType & { id: string })

export const useAuditsStore = defineStore('auditsStore', () => {
  const { $api } = useNuxtApp()

  const { getBaseUrl } = useGlobal()

  const workspaceStore = useWorkspace()

  const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

  const loadActionWorkspaceLogsOnly = ref<boolean>(false)

  const audits = ref<Array<AuditType>>([])

  const isRowExpanded = ref(false)

  const selectedAudit = ref<null | AuditType>(null)

  const auditLogsQuery = ref<AuditLogsQuery>(defaultAuditLogsQuery)

  const allBases = ref<Map<string, NcProject[]>>(new Map())

  const basesList = computed<NcProject[]>(() => {
    return auditLogsQuery.value.workspaceId ? allBases.value.get(auditLogsQuery.value.workspaceId) ?? [] : []
  })

  const bases = computed<Map<string, NcProject>>(() => {
    if (basesList.value.length) {
      return new Map(basesList.value.map((base) => [base.id, base]))
    }

    return new Map()
  })

  const collaboratorsMap = ref<Map<string, CollaboratorType>>(new Map())

  const auditCollaborators = computed<CollaboratorType[]>(() => {
    return Array.from(collaboratorsMap.value.values())
  })

  const isLoadingAudits = ref(false)

  const currentCursor = ref('')

  const hasMoreAudits = ref(false)

  const loadAudits = async (resetCursor = true, showLoading = true) => {
    if (showLoading) {
      isLoadingAudits.value = true
    }

    try {
      if (resetCursor) {
        currentCursor.value = ''
        audits.value = []
      }

      if (!activeWorkspaceId.value) return

      const user = collaboratorsMap.value.get(auditLogsQuery.value.user)

      const { list, pageInfo } = await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'workspaceAuditList',
        cursor: currentCursor.value,
        baseId: auditLogsQuery.value.baseId,
        fkUserId: user?.id || user?.fk_user_id,
        type:
          ncIsArray(auditLogsQuery.value.type) && auditLogsQuery.value.type.length
            ? auditLogsQuery.value.type.flatMap((cat) => auditV1OperationsCategory[cat]?.types ?? [])
            : undefined,
        startDate: auditLogsQuery.value.startDate,
        endDate: auditLogsQuery.value.endDate,
        orderBy: auditLogsQuery.value.orderBy,
      })

      const lastRecord = list[list.length - 1]

      if (lastRecord) {
        currentCursor.value = `${lastRecord.id}|${lastRecord.created_at}`
      }

      audits.value.push(...list)

      hasMoreAudits.value = !pageInfo?.isLastPage
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      hasMoreAudits.value = false
    } finally {
      if (showLoading) {
        isLoadingAudits.value = false
      }
    }
  }

  const isLoadingBases = ref(false)

  const loadBasesForWorkspace = async () => {
    if (!auditLogsQuery.value.workspaceId || allBases.value.get(auditLogsQuery.value.workspaceId)) return
    isLoadingBases.value = true

    try {
      const { list } = await $api.workspaceBase.list(auditLogsQuery.value.workspaceId, {
        baseURL: getBaseUrl(auditLogsQuery.value.workspaceId),
      })

      allBases.value.set(
        auditLogsQuery.value.workspaceId,
        list.sort((a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity)),
      )
    } catch (e: any) {
      console.error(e)
    } finally {
      isLoadingBases.value = false
    }
  }

  const isLoadingUsers = ref(false)

  const loadUsersForWorkspace = async (workspaceId: string) => {
    if (!workspaceId) return

    try {
      const { list } = await $api.workspaceUser.list(
        workspaceId,
        {},
        {
          baseURL: getBaseUrl(workspaceId),
        },
      )

      if (!list) return

      for (const user of list) {
        if (user.email && !collaboratorsMap.value.get(user.email)) {
          collaboratorsMap.value.set(user.email, user)
        }
      }
    } catch (e: any) {
      console.error(e)
    }
  }

  const handleReset = () => {
    auditLogsQuery.value = { ...defaultAuditLogsQuery }

    allBases.value.clear()
    collaboratorsMap.value.clear()
  }

  const onInit = async () => {
    if (loadActionWorkspaceLogsOnly.value) {
      auditLogsQuery.value.workspaceId = activeWorkspaceId.value
    }

    const promises = [loadAudits(true, false)]
    isLoadingAudits.value = true
    isLoadingUsers.value = true
    if (!loadActionWorkspaceLogsOnly.value && !workspacesList.value.length) {
      await workspaceStore.loadWorkspaces(true)
    }

    if (!collaboratorsMap.value.size) {
      if (loadActionWorkspaceLogsOnly.value) {
        loadUsersForWorkspace(activeWorkspaceId.value!)
      } else {
        promises.push(workspacesList.value.map((workspace) => loadUsersForWorkspace(workspace?.id)))
      }
    }

    if (!allBases.value.size && loadActionWorkspaceLogsOnly.value) {
      promises.push(loadBasesForWorkspace())
    }

    try {
      await Promise.all(promises)
    } catch (e: any) {
      message.error((await extractSdkResponseErrorMsgv2(e)).message)
    } finally {
      isLoadingAudits.value = false
      isLoadingUsers.value = false
    }
  }

  const getUserName = (userEmail?: string) => {
    if (!userEmail) return ''

    const userInfo = collaboratorsMap.value.get(userEmail)

    if (!userInfo) return ''

    if (userInfo?.display_name) {
      return userInfo.display_name
    }

    return userInfo?.email?.slice(0, userInfo?.email.indexOf('@'))
  }

  return {
    bases,
    basesList,
    auditCollaborators,
    collaboratorsMap,
    audits,
    isRowExpanded,
    selectedAudit,
    auditLogsQuery,
    isLoadingAudits,
    handleReset,
    loadAudits,
    isLoadingBases,
    isLoadingUsers,
    loadBasesForWorkspace,
    loadUsersForWorkspace,
    onInit,
    getUserName,
    loadActionWorkspaceLogsOnly,
    hasMoreAudits,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuditsStore as any, import.meta.hot))
}
