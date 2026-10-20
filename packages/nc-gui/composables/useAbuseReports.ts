import { AbuseReportStatus, NO_SCOPE } from 'nocodb-sdk'
import type { AbuseReportDetailType, AbuseReportListType, AbuseReportType } from 'nocodb-sdk'

/** Instance admin abuse queue. Self-hosted super admins only. */
export const useAbuseReports = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const reports = ref<AbuseReportType[]>([])

  const status = ref<AbuseReportStatus | 'all'>(AbuseReportStatus.OPEN)

  const page = ref(1)

  const pageSize = ref(25)

  const totalRows = ref(0)

  const openCount = ref(0)

  const isLoading = ref(false)

  async function fetchReports() {
    try {
      isLoading.value = true
      const result = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'abuseReportList',
        ...(status.value === 'all' ? {} : { status: status.value }),
        page: page.value,
        pageSize: pageSize.value,
      })) as AbuseReportListType

      reports.value = result.list
      totalRows.value = result.pageInfo.totalRows
      openCount.value = result.openCount
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  /** For the admin menu badge, without disturbing the loaded page. */
  async function fetchOpenCount() {
    try {
      const result = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
        operation: 'abuseReportList',
        status: AbuseReportStatus.OPEN,
        pageSize: 1,
      })) as AbuseReportListType
      openCount.value = result.openCount
    } catch {
      // The badge is optional.
    }
  }

  async function fetchReport(reportId: string) {
    return (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
      operation: 'abuseReportGet',
      reportId,
    })) as AbuseReportDetailType
  }

  async function updateStatus(reportId: string, newStatus: AbuseReportStatus) {
    await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'abuseReportUpdate' }, { reportId, status: newStatus })
    await fetchReports()
  }

  async function disableResource(reportId: string) {
    await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'abuseReportDisableResource' }, { reportId })
    await fetchReports()
  }

  async function blockUser(userId: string, reason?: string) {
    await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'orgUserBlock' }, { userId, reason })
  }

  async function unblockUser(userId: string) {
    await $api.internal.postOperation(NO_SCOPE, NO_SCOPE, { operation: 'orgUserUnblock' }, { userId })
  }

  watch([status, pageSize], () => {
    page.value = 1
  })

  return {
    reports,
    status,
    page,
    pageSize,
    totalRows,
    openCount,
    isLoading,
    fetchReports,
    fetchOpenCount,
    fetchReport,
    updateStatus,
    disableResource,
    blockUser,
    unblockUser,
  }
})
