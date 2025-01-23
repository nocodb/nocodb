import type { AuditType, PaginatedType } from 'nocodb-sdk'

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

export const useAudits = defineStore('auditsStore', () => {
  const { $api } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const auditLogsQuery = ref<AuditLogsQuery>(defaultAuditLogsQuery)

  const audits = ref<null | Array<AuditType>>(null)

  const auditPaginationData = ref<PaginatedType>({ page: 1, pageSize: 25, totalRows: 0 })

  const loadAudits = async (
    workspaceId?: string,
    page: number = auditPaginationData.value.page!,
    limit: number = auditPaginationData.value.pageSize!,
  ) => {
    try {
      if (isUIAllowed('workspaceAuditList') && !workspaceId) return

      if (limit * (page - 1) > auditPaginationData.value.totalRows!) {
        auditPaginationData.value.page = 1
        page = 1
      }

      const { list, pageInfo } = await $api.workspace.auditList(workspaceId, {
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

  return {
    auditLogsQuery,
    audits,
    auditPaginationData,
    loadAudits,
  }
})
