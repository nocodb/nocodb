import { type AuditType, type PaginatedType, type UserType, type WorkspaceUserType, auditV1OperationsCategory } from 'nocodb-sdk'

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

const defaultPaginationData = { page: 1, pageSize: 25, totalRows: 0 }

export type CollaboratorType = User | UserType | (WorkspaceUserType & { id: string })

export const useAuditsStore = defineStore('auditsStore', () => {
  const { $api } = useNuxtApp()

  const { getBaseUrl } = useGlobal()

  const workspaceStore = useWorkspace()

  const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

  const loadActionWorkspaceLogsOnly = ref<boolean>(false)

  const audits = ref<null | Array<AuditType>>(null)

  const isRowExpanded = ref(false)

  const selectedAudit = ref<null | AuditType>(null)

  const auditLogsQuery = ref<AuditLogsQuery>(defaultAuditLogsQuery)

  const auditPaginationData = ref<PaginatedType>(defaultPaginationData)

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

  const loadAudits = async (
    page: number = auditPaginationData.value.page!,
    limit: number = auditPaginationData.value.pageSize!,
    updateCurrentPage = true,
    showLoading = true,
  ) => {
    if (showLoading) {
      isLoadingAudits.value = true
    }

    try {
      if (updateCurrentPage) {
        auditPaginationData.value.page = 1
      }

      if (limit * (page - 1) > auditPaginationData.value.totalRows!) {
        auditPaginationData.value.page = 1
        page = 1
      }

      if (!activeWorkspaceId.value) return

      const { list, pageInfo } = await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'workspaceAuditList',
        page,
        baseId: auditLogsQuery.value.baseId,
        user: auditLogsQuery.value.user,
        type:
          ncIsArray(auditLogsQuery.value.type) && auditLogsQuery.value.type.length
            ? auditLogsQuery.value.type.flatMap((cat) => auditV1OperationsCategory[cat]?.types ?? [])
            : undefined,
        startDate: auditLogsQuery.value.startDate,
        endDate: auditLogsQuery.value.endDate,
        orderBy: auditLogsQuery.value.orderBy,
      })

      audits.value = list
      auditPaginationData.value.totalRows = pageInfo.totalRows ?? 0
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      audits.value = []
      auditPaginationData.value.totalRows = 0
      auditPaginationData.value.page = 1
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
    auditPaginationData.value = { ...defaultPaginationData }

    allBases.value.clear()
    collaboratorsMap.value.clear()
  }

  const onInit = async () => {
    if (loadActionWorkspaceLogsOnly.value) {
      auditLogsQuery.value.workspaceId = activeWorkspaceId.value
    }

    const promises = [loadAudits(undefined, undefined, true, false)]
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
    auditPaginationData,
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
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuditsStore as any, import.meta.hot))
}
