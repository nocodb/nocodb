<script setup lang="ts">
import { Tooltip as ATooltip, Empty } from 'ant-design-vue'
import type { AuditType, PaginatedType } from 'nocodb-sdk'
import { timeAgo } from 'nocodb-sdk'

interface Props {
  workspaceId?: string
}

const props = defineProps<Props>()

const { workspaceRoles } = useRoles()

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator, loadWorkspace } = workspaceStore

const { collaborators, activeWorkspace, workspacesList } = storeToRefs(workspaceStore)

const currentWorkspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (!ws) {
      await loadWorkspace(props.workspaceId)

      return workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    }
  }
  return activeWorkspace.value ?? workspacesList.value[0]
})

const baseStore = useBase()

const { base } = storeToRefs(baseStore)

const { $api } = useNuxtApp()

const { t } = useI18n()

const isLoading = ref(false)

const audits = ref<null | Array<AuditType>>(null)

const totalRows = ref(0)

const currentPage = ref(1)

const currentLimit = ref(25)

const { appInfo } = useGlobal()

async function loadAudits(page = currentPage.value, limit = currentLimit.value) {
  try {
    if (!props.workspaceId) return

    isLoading.value = true

    if (limit * (page - 1) > totalRows.value) {
      currentPage.value = 1
      page = 1
    }

    const { list, pageInfo } = await $api.workspace.auditList(props.workspaceId, {
      offset: limit * (page - 1),
      limit,
    })

    audits.value = list
    totalRows.value = pageInfo.totalRows ?? 0
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (audits.value === null) {
    await loadAudits(currentPage.value, currentLimit.value)
  }
})

const tableHeaderRenderer = (label: string) => () => h('div', { class: 'text-gray-500' }, label)

const columns = [
  {
    // User
    title: tableHeaderRenderer(t('objects.user')),
    dataIndex: 'user',
    key: 'user',
    customRender: (value: { text: string }) => h('div', {}, value.text || 'Shared base'),
    width: 200,
  },
  {
    // Created
    title: tableHeaderRenderer(t('labels.created')),
    dataIndex: 'created_at',
    key: 'created_at',
    sort: 'desc',
    customRender: (value: { text: string }) =>
      h(ATooltip, { placement: 'bottom', title: h('span', {}, value.text) }, () => timeAgo(value.text)),
    width: 180,
  },
  {
    // Base
    title: tableHeaderRenderer('Base'),
    dataIndex: 'base_id',
    key: 'base_id',
    customRender: (value: { text: string }) => h('div', {}, value.text || 'Shared base'),
    width: 200,
  },
  {
    // Operation Type
    title: tableHeaderRenderer(t('labels.operationType')),
    dataIndex: 'op_type',
    key: 'op_type',
    width: 120,
  },
  {
    // Operation sub-type
    title: tableHeaderRenderer(t('labels.operationSubType')),
    dataIndex: 'op_sub_type',
    key: 'op_sub_type',
    width: 160,
  },
  {
    // Description
    title: tableHeaderRenderer(t('labels.description')),
    dataIndex: 'description',
    key: 'description',
    customRender: (value: { text: string }) => h('pre', {}, value.text),
    width: 350,
  },
]
</script>

<template>
  <div class="h-full flex flex-col gap-4 w-full h-[calc(100vh-120px)] pt-6">
    <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>
    <div class="flex flex-col gap-y-6">
      <div class="flex flex-col gap-3">
        <div class="flex flex-row items-center gap-3">
          <h6 class="text-xl font-semibold text-gray-900 !my-0">Audit Logs</h6>
          <NcButton class="!px-1" type="text" size="xs" :disabled="isLoading" @click="loadAudits">
            <!-- Reload -->
            <div class="flex items-center text-gray-600 font-light">
              <component :is="iconMap.refresh" :class="{ 'animate-infinite animate-spin': isLoading }" />
            </div>
          </NcButton>
        </div>
        <div class="text-base text-gray-600">Track and monitor any changes made to any base in your workspace.</div>
      </div>
      <div></div>
    </div>
    <div class="h-[calc(100%_-_102px)]">
      <div class="table-wrapper h-[calc(100%_-_40px)] overflow-auto nc-scrollbar-thin">
        <div class="nc-audit-logs-table table h-full">
          <div class="thead sticky top-0">
            <div class="tr">
              <div class="th cell-user">User</div>
              <div class="th cell-timestamp">Time stamp</div>
              <div class="th cell-base">Base</div>
              <div class="th cell-type">Type</div>
              <div class="th cell-sub-type">Sub-type</div>
              <div class="th cell-description">Description</div>
              <div class="th cell-ip">IP</div>
            </div>
          </div>
          <div class="tbody">
            <template v-if="audits?.length">
              <template v-for="(audit, i) of audits" :key="i">
                <div class="tr">
                  <div class="td cell-user">
                    <div class="truncate">
                      {{ audit.user }}
                    </div>
                  </div>
                  <div class="td cell-timestamp">
                    <NcTooltip placement="bottom">
                      <template #title> {{ audit.created_at }}</template>

                      {{ timeAgo(audit.created_at) }}
                    </NcTooltip>
                  </div>
                  <div class="td cell-base">{{ audit.base_id }}</div>
                  <div class="td cell-type">{{ audit.op_type }}</div>
                  <div class="td cell-sub-type">{{ audit.op_sub_type }}</div>
                  <div class="td cell-description">
                    <div class="truncate">
                      {{ audit.description }}
                    </div>
                  </div>
                  <div class="td cell-ip">
                    <div class="truncate">
                      {{ audit.ip }}
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <div v-else class="tr flex items-center justify-center text-gray-500">
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="+totalRows > currentLimit" class="flex flex-row justify-center items-center bg-gray-50 min-h-10">
        <div class="flex justify-between items-center w-full">
          <div>&nbsp;</div>
          <NcPagination
            v-model:current="currentPage"
            v-model:page-size="currentLimit"
            :total="+totalRows"
            show-size-changer
            @update:current="loadAudits"
            @update:page-size="loadAudits(currentPage, $event)"
          />
          <div class="text-gray-500 text-xs">{{ totalRows }} records</div>
        </div>
      </div>
    </div>

    <!-- <div class="h-[calc(100%_-_102px)] overflow-y-auto nc-scrollbar-thin">
      <a-table
        class="nc-audit-table w-full"
        size="small"
        :data-source="audits ?? []"
        :columns="columns"
        :pagination="false"
        :loading="isLoading"
        data-testid="audit-tab-table"
        sticky
        bordered
      >
        <template #emptyText>
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
        </template>
      </a-table>
    </div> -->
  </div>
</template>

<style lang="scss" scoped>
.nc-audit-table pre {
  display: table;
  table-layout: fixed;
  width: 100%;
  white-space: break-spaces;
  font-size: unset;
  font-family: unset;
}

.nc-audit-logs-table {
  .thead {
    .th {
      @apply bg-gray-50 text-sm text-gray-600;
    }
  }

  .tbody {
    .td {
      @apply text-small leading-[18px] text-gray-600;
    }
  }

  .tr {
    @apply h-[54px] flex overflow-hidden border-b-1  border-gray-200 cursor-pointer;

    &:hover .td {
      @apply bg-gray-50;
    }

    .th,
    .td {
      @apply px-6 h-full flex items-center;

      &.cell-user {
        @apply w-[220px];
      }
      &.cell-timestamp,
      &.cell-base,
      &.cell-ip {
        @apply w-[180px];
      }
      &.cell-type {
        @apply w-[118px];
      }
      &.cell-sub-type {
        @apply w-[150px];
      }
      &.cell-description {
        @apply w-[472px];
      }
    }
  }
}

.pagination {
  .ant-select-dropdown {
    @apply !border-1 !border-gray-200;
  }
}
</style>
