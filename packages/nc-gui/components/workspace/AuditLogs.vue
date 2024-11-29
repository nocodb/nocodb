<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { AuditType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import { auditOperationSubTypeLabels, auditOperationTypeLabels, timeAgo } from 'nocodb-sdk'

interface Props {
  workspaceId?: string
  baseId?: string
  sourceId?: string
  bordered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  bordered: true,
})

const { isUIAllowed } = useRoles()

const { $api } = useNuxtApp()

const workspaceStore = useWorkspace()

const { loadAudits: _loadAudits } = workspaceStore

const { audits, auditLogsQuery, auditPaginationData } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { getBaseUsers, loadProjects } = basesStore

const { bases } = storeToRefs(basesStore)

const localCollaborators = ref<User[] | UserType[]>([])

const collaboratorsMap = computed<Map<string, (WorkspaceUserType & { id: string }) | User | UserType>>(() => {
  const map = new Map()

  localCollaborators.value?.forEach((coll) => {
    if (coll?.email) {
      map.set(coll.email, coll)
    }
  })
  return map
})

const { appInfo } = useGlobal()

const isLoading = ref(false)

const isRowExpanded = ref(false)

const selectedAudit = ref<null | AuditType>(null)

const tableWrapper = ref<HTMLDivElement>()

async function loadAudits(
  page = auditPaginationData.value.page,
  limit = auditPaginationData.value.pageSize,
  updateCurrentPage = true,
) {
  try {
    if ((!isUIAllowed('workspaceAuditList') && !props.baseId) || (!isUIAllowed('baseAuditList') && props.baseId)) {
      return
    }

    if (updateCurrentPage) {
      auditPaginationData.value.page = 1
    }

    isLoading.value = true
    await _loadAudits(props.workspaceId, updateCurrentPage ? 1 : page, limit)
  } catch {
  } finally {
    isLoading.value = false
  }
}

const handleChangePage = async (page: number) => {
  auditPaginationData.value.page = page
  await loadAudits(undefined, undefined, false)
}

const { onLeft, onRight, onUp, onDown } = usePaginationShortcuts({
  paginationDataRef: auditPaginationData,
  changePage: handleChangePage,
  isViewDataLoading: isLoading,
})

const loadCollaborators = async () => {
  try {
    if (!auditLogsQuery.value.baseId) return

    const { users } = await getBaseUsers({
      baseId: auditLogsQuery.value.baseId,
    })

    localCollaborators.value = users
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const loadOrgUsers = async () => {
  try {
    const response: any = await $api.orgUsers.list()

    if (!response?.list) return

    localCollaborators.value = response.list as UserType[]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleRowClick = (audit: AuditType) => {
  selectedAudit.value = audit
  isRowExpanded.value = true
}

const updateOrderBy = (field: 'created_at' | 'user') => {
  if (!audits.value?.length) return

  if (auditLogsQuery.value.orderBy?.[field] === 'asc') {
    auditLogsQuery.value.orderBy[field] = 'desc'
  } else if (auditLogsQuery.value.orderBy?.[field] === 'desc') {
    auditLogsQuery.value.orderBy[field] = undefined
  } else {
    auditLogsQuery.value.orderBy[field] = 'asc'
  }

  loadAudits(undefined, undefined, false)
}

const isEditEnabled = computed(() => true)

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(EditModeInj, readonly(isEditEnabled))

provide(IsFormInj, ref(true))

watch(
  () => auditLogsQuery.value.baseId,
  () => {
    if (!auditLogsQuery.value.baseId) return

    loadCollaborators()
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  if (props.baseId) {
    auditLogsQuery.value.baseId = props.baseId
  } else {
    auditLogsQuery.value.baseId = undefined
    auditLogsQuery.value.sourceId = undefined
  }

  if (props.sourceId) {
    auditLogsQuery.value.sourceId = props.sourceId
  }

  if (!props.baseId) {
    await Promise.allSettled([loadProjects(), loadOrgUsers()])
  }

  if (appInfo.value.auditEnabled) {
    await loadAudits(auditPaginationData.value.page, auditPaginationData.value.pageSize, false)
  }
})

useEventListener(tableWrapper, 'scroll', () => {
  const stickyHeaderCell = tableWrapper.value?.querySelector('th.cell-user')
  const nonStickyHeaderFirstCell = tableWrapper.value?.querySelector('th.cell-base')
  if (!stickyHeaderCell?.getBoundingClientRect().right || !nonStickyHeaderFirstCell?.getBoundingClientRect().left) {
    return
  }

  if (nonStickyHeaderFirstCell?.getBoundingClientRect().left < stickyHeaderCell?.getBoundingClientRect().right + 180) {
    tableWrapper.value?.classList.add('sticky-shadow')
  } else {
    tableWrapper.value?.classList.remove('sticky-shadow')
  }
})

const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

// Keyboard shortcuts for pagination
onKeyStroke('ArrowLeft', onLeft)
onKeyStroke('ArrowRight', onRight)
onKeyStroke('ArrowUp', onUp)
onKeyStroke('ArrowDown', onDown)
</script>

<template>
  <div class="h-full flex flex-col" :class="{ 'gap-4 px-1': baseId }">
    <NcPageHeader v-if="!baseId">
      <template #icon>
        <GeneralIcon icon="audit" class="flex-none text-gray-700 h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.auditLogs') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w flex flex-col" :class="{ 'gap-6 p-6 h-[calc(100vh_-_100px)]': !baseId, 'gap-4 h-full': baseId }">
      <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>

      <div class="flex flex-col" :class="{ 'gap-6': !baseId, 'gap-4': baseId }">
        <div class="flex flex-row items-center gap-3 justify-between">
          <div
            :class="{
              'flex-1 max-w-[75%]': baseId,
            }"
          >
            <h6
              v-if="baseId"
              class="font-semibold text-gray-900 !my-0 flex items-center gap-1"
              :style="{
                'word-break': 'keep-all',
              }"
              :class="{
                'text-xl': baseId,
                'text-2xl': !baseId,
              }"
            >
              <span class="keep-word min-w-[100px]"> {{ $t('title.auditLogs') }} </span>
              <NcTooltip
                class="max-w-[80%] truncate"
                :class="{
                  '!leading-7': baseId,
                  '!leading-8': !baseId,
                }"
                show-on-truncate-only
                placement="bottom"
              >
                <template #title>
                  {{ bases.get(baseId)?.title }}
                </template>
                : {{ bases.get(baseId)?.title }}
              </NcTooltip>
            </h6>
          </div>
          <div v-if="appInfo.auditEnabled" class="flex items-center gap-3 justify-end flex-wrap">
            <div class="flex items-center gap-3">
              <NcButton type="text" size="small" :disabled="isLoading" @click="loadAudits()">
                <!-- Refresh -->
                <div class="flex items-center gap-2">
                  {{ $t('general.refresh') }}

                  <component :is="iconMap.refresh" class="h-3.5 w-3.5" :class="{ 'animate-infinite animate-spin': isLoading }" />
                </div>
              </NcButton>
            </div>
          </div>
        </div>
      </div>
      <template v-if="appInfo.auditEnabled">
        <div
          class="table-container relative"
          :class="{
            'h-[calc(100%_-_48px)] ': baseId,
            'h-[calc(100%_-_56px)]': !baseId,
            'bordered': bordered,
          }"
        >
          <div
            ref="tableWrapper"
            class="nc-audit-logs-table h-full max-h-[calc(100%_-_40px)] relative nc-scrollbar-thin !overflow-auto"
          >
            <table class="!sticky top-0 z-5">
              <thead>
                <tr>
                  <th
                    class="cell-user !hover:bg-gray-100 select-none cursor-pointer"
                    :class="{
                      'cursor-not-allowed': !audits?.length,
                    }"
                    @click="updateOrderBy('user')"
                  >
                    <div class="flex items-center gap-3">
                      <div>{{ $t('objects.user') }}</div>
                      <GeneralIcon
                        v-if="auditLogsQuery.orderBy?.user"
                        icon="chevronDown"
                        class="flex-none"
                        :class="{
                          'transform rotate-180': auditLogsQuery.orderBy?.user === 'asc',
                        }"
                      />
                      <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                    </div>
                  </th>
                  <th
                    class="cell-timestamp !hover:bg-gray-100 select-none cursor-pointer"
                    :class="{
                      'cursor-not-allowed': !audits?.length,
                    }"
                    @click="updateOrderBy('created_at')"
                  >
                    <div class="flex items-center gap-3">
                      <div>Time</div>

                      <GeneralIcon
                        v-if="auditLogsQuery.orderBy?.created_at"
                        icon="chevronDown"
                        class="flex-none"
                        :class="{
                          'transform rotate-180': auditLogsQuery.orderBy?.created_at === 'asc',
                        }"
                      />
                      <GeneralIcon v-else icon="chevronUpDown" class="flex-none" />
                    </div>
                  </th>
                  <th class="cell-base">
                    <div>{{ $t('objects.project') }}</div>
                  </th>
                  <th class="cell-type">
                    <div>{{ $t('general.type') }}</div>
                  </th>
                  <th class="cell-sub-type">
                    <div>{{ $t('general.subType') }}</div>
                  </th>
                  <th class="cell-description">
                    <div>{{ $t('labels.description') }}</div>
                  </th>
                  <th class="cell-ip">
                    <div>{{ $t('general.ipAddress') }}</div>
                  </th>
                </tr>
              </thead>
            </table>
            <template v-if="audits?.length">
              <table>
                <tbody>
                  <tr
                    v-for="(audit, i) of audits"
                    :key="i"
                    :class="{
                      selected: selectedAudit?.id === audit.id && isRowExpanded,
                    }"
                    @click="handleRowClick(audit)"
                  >
                    <td class="cell-user">
                      <div>
                        <div v-if="audit.user && collaboratorsMap.get(audit.user)?.email" class="w-full flex gap-3 items-center">
                          <GeneralUserIcon :email="collaboratorsMap.get(audit.user)?.email" size="base" class="flex-none" />
                          <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                            <div class="w-full flex gap-3">
                              <NcTooltip
                                class="text-sm !leading-5 text-gray-800 capitalize font-semibold truncate"
                                show-on-truncate-only
                                placement="bottom"
                              >
                                <template #title>
                                  {{
                                    collaboratorsMap.get(audit.user)?.display_name ||
                                    collaboratorsMap
                                      .get(audit.user)
                                      ?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
                                  }}
                                </template>
                                {{
                                  collaboratorsMap.get(audit.user)?.display_name ||
                                  collaboratorsMap
                                    .get(audit.user)
                                    ?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
                                }}
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
                    </td>
                    <td class="cell-timestamp">
                      <div>
                        <NcTooltip placement="bottom">
                          <template #title> {{ parseStringDateTime(audit.created_at, 'D MMMM YYYY HH:mm') }}</template>

                          {{ timeAgo(audit.created_at) }}
                        </NcTooltip>
                      </div>
                    </td>
                    <td class="cell-base">
                      <div>
                        <div v-if="audit.base_id" class="w-full">
                          <NcTooltip
                            class="truncate text-sm !leading-5 text-gray-800 font-semibold"
                            show-on-truncate-only
                            placement="bottom"
                          >
                            <template #title>
                              {{ bases.get(audit.base_id)?.title }}
                            </template>
                            {{ bases.get(audit.base_id)?.title }}
                          </NcTooltip>

                          <div class="text-gray-600 text-xs">ID: {{ audit.base_id }}</div>
                        </div>
                        <template v-else>
                          {{ audit.base_id }}
                        </template>
                      </div>
                    </td>
                    <td class="cell-type">
                      <div>
                        <div class="truncate bg-gray-200 px-2 py-1 rounded-lg">
                          <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
                            <template #title> {{ auditOperationTypeLabels[audit.op_type] }}</template>

                            <span class="truncate"> {{ auditOperationTypeLabels[audit.op_type] }} </span>
                          </NcTooltip>
                        </div>
                      </div>
                    </td>
                    <td class="cell-sub-type">
                      <div>
                        <div class="truncate">
                          <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
                            <template #title> {{ auditOperationSubTypeLabels[audit.op_sub_type] }}</template>

                            <span class="truncate"> {{ auditOperationSubTypeLabels[audit.op_sub_type] }} </span>
                          </NcTooltip>
                        </div>
                      </div>
                    </td>
                    <td class="cell-description">
                      <div>
                        <div class="truncate">
                          {{ audit.description }}
                        </div>
                      </div>
                    </td>
                    <td class="cell-ip">
                      <div>
                        <div class="truncate">
                          {{ audit.ip }}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>
          <div
            v-show="isLoading"
            class="flex items-center justify-center absolute left-0 top-0 w-full h-full z-10 pb-10 pointer-events-none"
          >
            <div class="flex flex-col justify-center items-center gap-2">
              <GeneralLoader size="xlarge" />
              <span class="text-center">{{ $t('general.loading') }}</span>
            </div>
          </div>
          <div
            v-if="!isLoading && !audits?.length"
            class="flex items-center justify-center absolute left-0 top-0 w-full h-full pb-10 flex items-center justify-center text-gray-500"
          >
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
          </div>
          <div
            v-if="auditPaginationData.totalRows"
            class="flex flex-row justify-center items-center bg-gray-50 min-h-10"
            :class="{
              'pointer-events-none': isLoading,
            }"
          >
            <div class="flex justify-between items-center w-full px-6">
              <div>&nbsp;</div>
              <NcPagination
                v-model:current="auditPaginationData.page"
                v-model:page-size="auditPaginationData.pageSize"
                :total="+auditPaginationData.totalRows"
                show-size-changer
                :use-stored-page-size="false"
                :prev-page-tooltip="`${renderAltOrOptlKey()}+←`"
                :next-page-tooltip="`${renderAltOrOptlKey()}+→`"
                :first-page-tooltip="`${renderAltOrOptlKey()}+↓`"
                :last-page-tooltip="`${renderAltOrOptlKey()}+↑`"
                @update:current="loadAudits(undefined, undefined, false)"
                @update:page-size="loadAudits(currentPage, $event, false)"
              />
              <div class="text-gray-500 text-xs">
                {{ auditPaginationData.totalRows }} {{ auditPaginationData.totalRows === 1 ? 'record' : 'records' }}
              </div>
            </div>
          </div>
        </div>
        <NcModal v-model:visible="isRowExpanded" size="medium" :show-separator="false" @keydown.esc="isRowExpanded = false">
          <template #header>
            <div class="flex items-center justify-between gap-x-2 w-full">
              <div class="flex-1 text-base font-weight-700 text-gray-900">Audit Details</div>
              <div class="flex items-center gap-2">
                <NcTooltip placement="bottom" class="text-gray-600 text-small leading-[18px]">
                  <template #title> {{ parseStringDateTime(selectedAudit.created_at, 'D MMMM YYYY HH:mm') }}</template>

                  {{ timeAgo(selectedAudit.created_at) }}
                </NcTooltip>
              </div>
            </div>
          </template>
          <div v-if="selectedAudit" class="nc-expanded-audit flex flex-col gap-4">
            <div class="bg-gray-50 rounded-lg border-1 border-gray-200">
              <div class="flex">
                <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
                  <div class="cell-header">Performed by</div>
                  <div
                    v-if="selectedAudit?.user && collaboratorsMap.get(selectedAudit.user)?.email"
                    class="w-full flex gap-3 items-center"
                  >
                    <GeneralUserIcon :email="collaboratorsMap.get(selectedAudit.user)?.email" size="base" class="flex-none" />
                    <div class="flex-1 flex flex-col">
                      <div class="w-full flex gap-3">
                        <span class="text-sm text-gray-800 capitalize font-semibold">
                          {{
                            collaboratorsMap.get(selectedAudit.user)?.display_name ||
                            collaboratorsMap
                              .get(selectedAudit.user)
                              ?.email?.slice(0, collaboratorsMap.get(selectedAudit.user)?.email.indexOf('@'))
                          }}
                        </span>
                      </div>
                      <span class="text-xs text-gray-600">
                        {{ collaboratorsMap.get(selectedAudit.user)?.email }}
                      </span>
                    </div>
                  </div>

                  <div v-else class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.user }}</div>
                </div>
                <div class="w-1/2 flex flex-col gap-2 px-4 py-3">
                  <div class="cell-header">{{ $t('general.ipAddress') }}</div>
                  <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.ip }}</div>
                </div>
              </div>
              <div class="border-t-1 border-gray-200 flex">
                <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
                  <div class="cell-header">{{ $t('objects.project') }}</div>
                  <div v-if="selectedAudit?.base_id && bases.get(selectedAudit?.base_id)" class="flex items-stretch gap-3">
                    <div class="flex items-center">
                      <GeneralProjectIcon
                        :color="bases.get(selectedAudit?.base_id)?.meta?.iconColor"
                        :type="bases.get(selectedAudit?.base_id)?.type || 'database'"
                        class="nc-view-icon w-5 h-5"
                      />
                    </div>
                    <div>
                      <div class="text-sm font-weight-500 text-gray-900">{{ bases.get(selectedAudit?.base_id)?.title }}</div>
                      <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.base_id }}</div>
                    </div>
                  </div>
                  <template v-else>
                    {{ selectedAudit.base_id }}
                  </template>
                </div>
                <div class="w-1/2">
                  <div class="h-1/2 border-b border-gray-200 flex items-center gap-2 px-4 py-3">
                    <div class="cell-header">{{ $t('general.type') }}</div>
                    <div class="text-small leading-[18px] text-gray-600 bg-gray-200 px-1 rounded-md">
                      {{ auditOperationTypeLabels[selectedAudit?.op_type] }}
                    </div>
                  </div>
                  <div class="h-1/2 flex items-center gap-2 px-4 py-3">
                    <div class="cell-header">{{ $t('general.subType') }}</div>
                    <div class="text-small leading-[18px] text-gray-600">
                      {{ auditOperationSubTypeLabels[selectedAudit?.op_sub_type] }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div class="cell-header">{{ $t('labels.description') }}</div>
              <div>
                <pre class="!text-small !leading-[18px] !text-gray-600 mb-0">{{ selectedAudit?.description }}</pre>
              </div>
            </div>
          </div>
        </NcModal>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-expanded-audit pre {
  font-family: Manrope, 'Inter', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
}

:deep(.nc-menu-item-inner) {
  @apply !w-full;
}

.table-container {
  &.bordered {
    @apply border-1 border-gray-200 rounded-lg overflow-hidden;
  }
}

.nc-audit-logs-table {
  &.sticky-shadow {
    th,
    td {
      &.cell-user {
        @apply border-r-1 border-gray-200;
      }
    }
  }
  &:not(.sticky-shadow) {
    th,
    td {
      &.cell-user {
        @apply border-r-1 border-transparent;
      }
    }
  }
  thead {
    th {
      @apply bg-gray-50 text-sm text-gray-500 font-weight-500;

      &.cell-user {
        @apply sticky left-0 z-4 bg-gray-50;
      }
    }
  }

  tbody {
    tr {
      @apply cursor-pointer;

      td {
        @apply text-sm text-gray-600;

        &.cell-user {
          @apply sticky left-0 z-4 bg-white;
        }
      }
    }
  }

  tr {
    @apply h-[54px] flex border-b-1  border-gray-200;

    &:hover td {
      @apply !bg-gray-50;
    }

    &.selected td {
      @apply !bg-gray-50;
    }

    th,
    td {
      @apply h-full;

      & > div {
        @apply px-6 h-full flex items-center;
      }

      &.cell-user {
        @apply w-[220px] sticky left-0 z-5;
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

.cell-header {
  @apply text-xs font-semibold text-gray-500;
}
:deep(.nc-button) {
  svg.sort-asc path.up {
    @apply !stroke-brand-500;
  }
  svg.sort-desc path.down {
    @apply !stroke-brand-500;
  }
}
:deep(.nc-menu-item::after) {
  content: none;
}
:deep(.ant-menu.nc-menu) {
  @apply !pt-0 !border-none !rounded-none;
  &.nc-audit-date-range-menu {
    @apply !pb-0;
  }
}
.nc-audit-custom-date-range-input {
  @apply border-1 border-gray-200 rounded-lg pr-2 py-1 transition-all duration-0.3s shadow-default focus-within:(border-brand-500 shadow-selected);
  &:hover:not(:focus-within) {
    @apply shadow-hover;
  }

  :deep(.ant-picker-input > input) {
    @apply !px-2;
  }
}
:deep(.ant-empty-description) {
  @apply mb-0;
}
</style>
