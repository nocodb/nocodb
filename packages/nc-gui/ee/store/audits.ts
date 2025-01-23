import type { AuditType, PaginatedType, UserType } from 'nocodb-sdk'

const defaultAuditLogsQuery = {
  type: undefined,
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

export const useAuditsStore = defineStore('auditsStore', () => {
  const { $api } = useNuxtApp()

  const { getBaseUrl } = useGlobal()

  const { isUIAllowed } = useRoles()

  const auditCollaborators = ref<User[] | UserType[]>([])

  const collaboratorsMap = computed<Map<string, User | UserType>>(() => {
    const map = new Map()

    auditCollaborators.value?.forEach((coll) => {
      if (coll?.email) {
        map.set(coll.email, coll)
      }
    })
    return map
  })

  const audits = ref<null | Array<AuditType>>(null)

  const isRowExpanded = ref(false)

  const selectedAudit = ref<null | AuditType>(null)

  const auditLogsQuery = ref<AuditLogsQuery>(defaultAuditLogsQuery)

  const auditPaginationData = ref<PaginatedType>({ page: 1, pageSize: 25, totalRows: 0 })

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

  watchEffect(() => {
    console.log('bases', bases.value)
  })

  const loadAudits = async (
    page: number = auditPaginationData.value.page!,
    limit: number = auditPaginationData.value.pageSize!,
  ) => {
    try {
      if (limit * (page - 1) > auditPaginationData.value.totalRows!) {
        auditPaginationData.value.page = 1
        page = 1
      }

      const { list, pageInfo } = await $api.audits.globalAuditList({
        offset: limit * (page - 1),
        limit,
        ...auditLogsQuery.value,
        sourceId: undefined,
      })

      audits.value = list
      auditPaginationData.value.totalRows = pageInfo.totalRows ?? 0
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      audits.value = []
      auditPaginationData.value.totalRows = 0
      auditPaginationData.value.page = 1
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
    loadAudits,
    isLoadingBases,
    loadBasesForWorkspace,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuditsStore as any, import.meta.hot))
}
