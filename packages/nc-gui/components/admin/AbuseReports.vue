<script lang="ts" setup>
import { AbuseReportStatus } from 'nocodb-sdk'

const { t } = useI18n()

const { reports, status, page, pageSize, totalRows, isLoading, fetchReports } = useAbuseReports()

const activeReportId = ref<string | null>(null)

const statusOptions = computed(() => [
  { value: AbuseReportStatus.OPEN, label: t('labels.abuseReport.statuses.open') },
  { value: AbuseReportStatus.RESOLVED, label: t('labels.abuseReport.statuses.resolved') },
  { value: AbuseReportStatus.DISMISSED, label: t('labels.abuseReport.statuses.dismissed') },
  { value: 'all', label: t('general.all') },
])

const columns = computed<NcTableColumnProps[]>(() => [
  { key: 'resource', title: t('labels.abuseReport.reportedItem'), minWidth: 260 },
  { key: 'reason', title: t('labels.abuseReport.reason'), minWidth: 180, width: 200 },
  { key: 'reporter', title: t('labels.abuseReport.reporter'), minWidth: 220 },
  { key: 'created_at', title: t('labels.abuseReport.received'), minWidth: 150, width: 160 },
  { key: 'status', title: t('general.status'), minWidth: 120, width: 130 },
])

function customRow(report: Record<string, any>) {
  return {
    onClick: () => {
      activeReportId.value = report.id
    },
  }
}

watch([status, page, pageSize], () => fetchReports())

onMounted(() => fetchReports())
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-admin-abuse-reports">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncFlag" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">{{ $t('title.abuseReports') }}</span>
      </template>
    </NcPageHeader>

    <div class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <div class="text-sm text-nc-content-gray-subtle">{{ $t('msg.info.abuseReport.queueDescription') }}</div>
        <NcSelect
          v-model:value="status"
          :options="statusOptions"
          class="nc-select-shadow !w-40 flex-none"
          data-testid="nc-admin-abuse-reports-status"
        />
      </div>

      <NcTable
        :columns="columns"
        :data="reports"
        :bordered="false"
        :is-data-loading="isLoading"
        :custom-row="customRow"
        class="flex-1"
        data-testid="nc-admin-abuse-reports-list"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'resource'">
            <div class="flex flex-col min-w-0">
              <NcTooltip class="truncate font-semibold text-nc-content-gray" show-on-truncate-only>
                <template #title>{{ record.resource_title }}</template>
                {{ record.resource_title || record.resource_id }}
              </NcTooltip>
              <div class="text-xs text-nc-content-gray-muted truncate">
                {{ $t(`labels.abuseReport.resourceTypes.${record.resource_type}`) }}
                <template v-if="record.workspace_title"> · {{ record.workspace_title }} </template>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'reason'">
            {{ $t(`labels.abuseReport.reasons.${record.reason}`) }}
          </template>
          <template v-else-if="column.key === 'reporter'">
            <div class="flex flex-col min-w-0">
              <span class="truncate">{{ record.reporter_name }}</span>
              <span class="truncate text-xs text-nc-content-gray-muted">{{ record.reporter_email }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'created_at'">
            {{ timeAgo(record.created_at) }}
          </template>
          <template v-else-if="column.key === 'status'">
            <AdminAbuseReportStatus :status="record.status" />
          </template>
        </template>
      </NcTable>

      <NcPaginationV2
        v-if="totalRows > pageSize"
        v-model:current="page"
        v-model:page-size="pageSize"
        :total="totalRows"
        show-size-changer
        variant="v2"
      />
    </div>

    <AdminAbuseReportDetail v-if="activeReportId" :report-id="activeReportId" @close="activeReportId = null" />
  </div>
</template>
