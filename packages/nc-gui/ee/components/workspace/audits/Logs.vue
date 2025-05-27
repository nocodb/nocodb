<script lang="ts" setup>
import { type AuditType, auditV1OperationTypesAlias } from 'nocodb-sdk'

const { t } = useI18n()

const { appInfo } = useGlobal()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const auditsStore = useAuditsStore()

const { loadAudits, onInit, getUserName } = auditsStore
const {
  isRowExpanded,
  selectedAudit,
  bases,
  audits,
  auditLogsQuery,
  auditPaginationData,
  collaboratorsMap,
  isLoadingAudits,
  loadActionWorkspaceLogsOnly,
} = storeToRefs(auditsStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const handleChangePage = async (page: number) => {
  auditPaginationData.value.page = page
  await loadAudits(undefined, undefined, false)
}

const { onLeft, onRight, onUp, onDown } = usePaginationShortcuts({
  paginationDataRef: auditPaginationData,
  changePage: handleChangePage,
  isViewDataLoading: isLoadingAudits,
})

const columns: NcTableColumnProps<AuditType>[] = [
  {
    key: 'user',
    title: t('objects.user'),
    basis: '40%',
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'user',
  },
  {
    key: 'created_at',
    title: 'Timestamp',
    basis: '25%',
    minWidth: 180,
    padding: '0px 12px',
    dataIndex: 'created_at',
    showOrderBy: true,
  },
  {
    key: 'base_id',
    title: t('objects.project'),
    basis: '25%',
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'base_id',
  },
  {
    key: 'event',
    title: t('general.event'),
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'op_type',
  },
  {
    key: 'ip',
    title: t('general.ipAddress'),
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'ip',
  },
  {
    key: 'user_agent',
    title: t('labels.osBrowser'),
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'user_agent',
  },
]

const orderBy = computed({
  get: () => {
    return auditLogsQuery.value.orderBy
  },
  set: (value) => {
    auditLogsQuery.value.orderBy = value

    loadAudits(undefined, undefined, false)
  },
})

const customRow = (audit: AuditType) => ({
  onclick: () => {
    selectedAudit.value = audit
    isRowExpanded.value = true
  },
})

onMounted(() => {
  loadActionWorkspaceLogsOnly.value = true
  onInit()
})

watch(activeWorkspaceId, () => {
  if (!isAdminPanel.value) return

  onInit()
})

// Keyboard shortcuts for pagination
onKeyStroke('ArrowLeft', onLeft)
onKeyStroke('ArrowRight', onRight)
onKeyStroke('ArrowUp', onUp)
onKeyStroke('ArrowDown', onDown)
</script>

<template>
  <div class="nc-content-max-w mx-auto h-full flex flex-col gap-6">
    <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>

    <template v-else>
      <WorkspaceAuditsHeader />
      <NcTable
        v-model:order-by="orderBy"
        :is-data-loading="isLoadingAudits"
        :columns="columns"
        :data="audits || []"
        sticky-first-column
        class="flex-1 nc-audit-logs-table max-w-full"
        :custom-row="customRow"
      >
        <template #bodyCell="{ column, record: audit }">
          <div v-if="column.key === 'user'" class="w-full">
            <div v-if="audit.user && collaboratorsMap.get(audit.user)?.email" class="w-full flex gap-3 items-center">
              <GeneralUserIcon :user="collaboratorsMap.get(audit.user)" size="base" class="flex-none" />
              <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                <div class="w-full flex gap-3">
                  <NcTooltip
                    class="text-sm !leading-5 text-gray-800 capitalize font-semibold truncate"
                    show-on-truncate-only
                    placement="bottom"
                  >
                    <template #title>
                      {{ getUserName(audit.user) }}
                    </template>
                    {{ getUserName(audit.user) }}
                  </NcTooltip>
                </div>
                <NcTooltip class="text-xs !leading-4 text-gray-600 truncate" show-on-truncate-only placement="bottom">
                  <template #title>
                    {{ collaboratorsMap.get(audit.user)?.email }}
                  </template>
                  {{ collaboratorsMap.get(audit.user)?.email }}
                </NcTooltip>
              </div>
            </div>
            <template v-else>{{ audit.user }} </template>
          </div>

          <div v-if="column.key === 'created_at'" class="w-full flex">
            <NcTooltip placement="bottom">
              <template #title> {{ parseStringDateTime(audit.created_at, 'D MMMM YYYY HH:mm') }}</template>

              {{ timeAgo(audit.created_at) }}
            </NcTooltip>
          </div>
          <div v-if="column.key === 'base_id'" class="w-full">
            <div v-if="bases.get(audit.base_id)" class="w-full">
              <NcTooltip class="truncate text-sm !leading-5 text-gray-800 font-semibold" show-on-truncate-only placement="bottom">
                <template #title>
                  {{ bases.get(audit.base_id)?.title }}
                </template>
                {{ bases.get(audit.base_id)?.title }}
              </NcTooltip>

              <div class="text-gray-600 text-xs">ID: {{ audit.base_id }}</div>
            </div>
            <div v-else class="truncate">{{ audit.base_id ?? '' }}</div>
          </div>
          <div v-if="column.key === 'event'" class="w-full">
            <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
              <template #title> {{ auditV1OperationTypesAlias[audit.op_type] }}</template>

              <span class="truncate"> {{ auditV1OperationTypesAlias[audit.op_type] }} </span>
            </NcTooltip>
          </div>

          <div v-if="column.key === 'ip'" class="w-full truncate">
            {{ audit.ip === '::1' ? 'localhost' : '' }}
          </div>
          <div v-if="column.key === 'user_agent'" class="w-full truncate">
            {{ audit.user_agent || '' }}
          </div>
        </template>

        <template #tableFooter>
          <div
            v-if="auditPaginationData.totalRows"
            class="flex flex-row justify-center items-center bg-gray-50 min-h-10"
            :class="{
              'pointer-events-none': isLoadingAudits,
            }"
          >
            <div class="flex justify-between items-center w-full px-6">
              <div>&nbsp;</div>
              <NcPagination
                v-model:current="auditPaginationData.page"
                :page-size="auditPaginationData.pageSize"
                :total="+auditPaginationData.totalRows"
                :use-stored-page-size="false"
                :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
                :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
                :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
                :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
                @update:current="loadAudits(undefined, undefined, false)"
              />
              <div class="text-gray-500 text-xs">
                {{ auditPaginationData.totalRows }} {{ auditPaginationData.totalRows === 1 ? 'record' : 'records' }}
              </div>
            </div>
          </div>
        </template>
      </NcTable>
      <WorkspaceAuditsExpandedAudit />
    </template>
  </div>
</template>
