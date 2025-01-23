<script lang="ts" setup>
import dayjs from 'dayjs'
import type { VNodeRef } from '@vue/runtime-core'

import {
  auditOperationTypeLabels,
  AuditOperationTypes,
  auditV1OperationTypesAlias,
  type AuditType,
  type UserType,
  type WorkspaceUserType,
} from 'nocodb-sdk'

const allowedAuditOperationTypes = [AuditOperationTypes.DATA, AuditOperationTypes.TABLE, AuditOperationTypes.TABLE_COLUMN]

const { t } = useI18n()

const { appInfo } = useGlobal()

const isLoading = ref(false)

const auditsStore = useAuditsStore()

const { loadAudits: _loadAudits, loadBasesForWorkspace } = auditsStore
const { isRowExpanded, selectedAudit, bases, basesList, audits, auditLogsQuery, auditPaginationData, isLoadingBases } =
  storeToRefs(auditsStore)

const workspaceStore = useWorkspace()

const { workspaces, workspacesList } = storeToRefs(workspaceStore)

const localCollaborators = ref<User[] | UserType[]>([])

const auditCollaborators = computed(() => {
  return (auditLogsQuery.value.baseId ? localCollaborators.value : []) || []
})

const collaboratorsMap = computed<Map<string, User | UserType>>(() => {
  const map = new Map()

  auditCollaborators.value?.forEach((coll) => {
    if (coll?.email) {
      map.set(coll.email, coll)
    }
  })
  return map
})

const defaultAuditDropdowns = {
  type: false,
  subType: false,
  workspace: false,
  base: false,
  user: false,
  dateRange: false,
}

const auditDropdowns = ref(defaultAuditDropdowns)

const defaultAuditDropdownsSearch = {
  type: '',
  workspace: '',
  base: '',
  user: '',
}

const auditDropdownsSearch = ref(defaultAuditDropdownsSearch)

const focusWorkspaceSearchRef: VNodeRef = (el) => {
  return el && auditDropdowns.value.user && el?.focus?.()
}
const focusUserSearchRef: VNodeRef = (el) => {
  return el && auditDropdowns.value.user && el?.focus?.()
}
const focusBaseSearchRef: VNodeRef = (el) => {
  return el && auditDropdowns.value.base && el?.focus?.()
}
const focusTypeSearchRef: VNodeRef = (el) => {
  return el && auditDropdowns.value.type && el?.focus?.()
}

const auditTypeOptions = computed(() => {
  return Object.values(AuditOperationTypes)
    .filter((type) => allowedAuditOperationTypes.includes(type as AuditOperationTypes))
    .map((type) => ({
      label: auditOperationTypeLabels[type],
      value: type,
    }))
})

const dateRangeOptions = computed(() => {
  return [
    {
      label: 'Last 24H',
      value: AuditLogsDateRange.Last24H,
    },
    {
      label: 'Past Week',
      value: AuditLogsDateRange.PastWeek,
    },
    {
      label: 'Past Month',
      value: AuditLogsDateRange.PastMonth,
    },
    {
      label: 'Past Year',
      value: AuditLogsDateRange.PastYear,
    },
  ]
})

async function loadAudits(
  page = auditPaginationData.value.page,
  limit = auditPaginationData.value.pageSize,
  updateCurrentPage = true,
) {
  try {
    if (updateCurrentPage) {
      auditPaginationData.value.page = 1
    }

    isLoading.value = true
    await _loadAudits(updateCurrentPage ? 1 : page, limit)
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

const columns: NcTableColumnProps<AuditType>[] = [
  {
    key: 'user',
    title: t('objects.user'),
    basis: '40%',
    minWidth: 220,
    padding: '0px 12px',
    dataIndex: 'user',
    showOrderBy: true,
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

const handleUpdateWorkspaceQuery = (workspaceId?: string) => {
  auditLogsQuery.value = { ...auditLogsQuery.value, workspaceId, baseId: undefined, user: undefined }
  if (workspaceId) {
    loadBasesForWorkspace()
  }
}

const handleUpdateBaseQuery = (baseId?: string, sourceId?: string) => {
  auditLogsQuery.value.baseId = baseId
  auditLogsQuery.value.sourceId = sourceId
}

const handleCloseDropdown = (field: keyof typeof defaultAuditDropdowns) => {
  auditDropdowns.value[field] = false
  loadAudits()
}

const handleClearDropdownSearch = (isOpen: boolean, field: keyof typeof defaultAuditDropdownsSearch) => {
  if (isOpen) {
    auditDropdownsSearch.value[field] = ''
  }
}

const handleClearDateRange = () => {
  auditLogsQuery.value.dateRange = undefined
  auditLogsQuery.value.dateRangeLabel = undefined
  auditLogsQuery.value.startDate = undefined
  auditLogsQuery.value.endDate = undefined

  auditDropdowns.value.dateRange = false

  auditPaginationData.value.page = 1
  auditPaginationData.value.pageSize = 25
  loadAudits()
}

const handleUpdateDateRange = (range?: AuditLogsDateRange, label?: string) => {
  auditLogsQuery.value.dateRange = range
  auditLogsQuery.value.dateRangeLabel = label

  const now = dayjs(new Date()).utc()

  switch (range) {
    case AuditLogsDateRange.Last24H:
      auditLogsQuery.value.startDate = now.subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ssZ')
      auditLogsQuery.value.endDate = now.format('YYYY-MM-DD HH:mm:ssZ')
      break
    case AuditLogsDateRange.PastWeek:
      auditLogsQuery.value.startDate = now.subtract(7, 'days').format('YYYY-MM-DD HH:mm:ssZ')
      auditLogsQuery.value.endDate = now.format('YYYY-MM-DD HH:mm:ssZ')
      break
    case AuditLogsDateRange.PastMonth:
      auditLogsQuery.value.startDate = now.subtract(30, 'days').format('YYYY-MM-DD HH:mm:ssZ')
      auditLogsQuery.value.endDate = now.format('YYYY-MM-DD HH:mm:ssZ')
      break
    case AuditLogsDateRange.PastYear:
      auditLogsQuery.value.startDate = now.subtract(365, 'days').format('YYYY-MM-DD HH:mm:ssZ')
      auditLogsQuery.value.endDate = now.format('YYYY-MM-DD HH:mm:ssZ')
      break
    default:
      auditLogsQuery.value.startDate = undefined
      auditLogsQuery.value.endDate = undefined
      auditLogsQuery.value.dateRange = undefined
      auditLogsQuery.value.dateRangeLabel = undefined
  }

  auditDropdowns.value.dateRange = false
  auditPaginationData.value.page = 1
  auditPaginationData.value.pageSize = 25
  loadAudits()
}

const handleCustomDateRangeClick = () => {
  if (auditLogsQuery.value.dateRange === AuditLogsDateRange.Custom) {
    auditLogsQuery.value.dateRange = undefined
    auditLogsQuery.value.dateRangeLabel = undefined
    auditDropdowns.value.dateRange = false
  } else {
    auditLogsQuery.value.dateRange = AuditLogsDateRange.Custom
    auditLogsQuery.value.dateRangeLabel = 'Custom Date Range'
  }

  auditLogsQuery.value.startDate = undefined
  auditLogsQuery.value.endDate = undefined

  loadAudits()
}

const handleUpdateCustomDateRange = (value: string | null, field: 'startDate' | 'endDate') => {
  if (auditLogsQuery.value[field] && dayjs(auditLogsQuery.value[field]).format('YYYY-MM-DD') === value) return

  if (field === 'startDate') {
    auditLogsQuery.value[field] = value || undefined
  } else if (value) {
    const currentTime = dayjs()

    const now = dayjs(value, 'YYYY-MM-DD').hour(currentTime.hour()).minute(currentTime.minute())

    auditLogsQuery.value[field] = now.utc().format('YYYY-MM-DD HH:mm:ssZ')
  } else {
    auditLogsQuery.value[field] = undefined
  }

  loadAudits()
}

const handleRefresh = () => {
  if (auditLogsQuery.value.endDate && auditLogsQuery.value.dateRange !== AuditLogsDateRange.Custom) {
    auditLogsQuery.value.endDate = dayjs(new Date()).utc().format('YYYY-MM-DD HH:mm:ssZ')
  }
  loadAudits()
}

const customRow = (audit: AuditType) => ({
  onclick: () => {
    selectedAudit.value = audit
    isRowExpanded.value = true
  },
})

onMounted(() => {
  const promises = [auditsStore.loadAudits()]

  if (!workspacesList.value.length) {
    promises.push(workspaceStore.loadWorkspaces())
  }

  Promise.allSettled(promises)
})

watchEffect(() => {
  console.log('workspacesList', workspacesList.value)
})

const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

// Keyboard shortcuts for pagination
onKeyStroke('ArrowLeft', onLeft)
onKeyStroke('ArrowRight', onRight)
onKeyStroke('ArrowUp', onUp)
onKeyStroke('ArrowDown', onDown)

const isTypeAndRangeFilterEnabled = false
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="audit" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.audits') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="flex items-center gap-3 justify-between flex-wrap">
        <div class="flex items-center gap-3">
          <NcDropdown
            v-model:visible="auditDropdowns.workspace"
            overlay-class-name="overflow-hidden"
            @update:visible="handleClearDropdownSearch($event, 'workspace')"
          >
            <NcButton type="secondary" size="small">
              <div class="!w-[156px] flex items-center justify-between gap-2">
                <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
                  {{ $t('objects.workspace') }}:
                  <NcTooltip
                    class="truncate !leading-5"
                    :class="{ 'text-brand-500': auditLogsQuery.workspaceId }"
                    show-on-truncate-only
                  >
                    <template #title>
                      {{ (auditLogsQuery.workspaceId && workspaces.get(auditLogsQuery.workspaceId)?.title) || 'All' }}
                    </template>
                    {{ (auditLogsQuery.workspaceId && workspaces.get(auditLogsQuery.workspaceId)?.title) || 'All' }}
                  </NcTooltip>
                </div>
                <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
              </div>
            </NcButton>

            <template #overlay>
              <div
                class="w-[256px]"
                :class="{
                  'pt-2': workspacesList.length >= 6,
                  'pt-1.5': workspacesList.length < 6,
                }"
              >
                <div v-if="workspacesList.length >= 6" class="px-2 pb-2" @click.stop>
                  <a-input
                    :ref="focusWorkspaceSearchRef"
                    v-model:value="auditDropdownsSearch.workspace"
                    type="text"
                    autocomplete="off"
                    class="nc-input-sm nc-input-shadow"
                    placeholder="Search Workspace"
                    data-testid="nc-audit-dropdown-workspace-search-input"
                  >
                    <template #prefix>
                      <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
                    </template>
                    <template #suffix>
                      <GeneralIcon
                        v-if="auditDropdownsSearch.workspace.length > 0"
                        icon="close"
                        class="ml-1 h-4 w-4 text-gray-500 group-hover:text-black"
                        data-testid="nc-audit-logs-clear-search"
                        @click="auditDropdownsSearch.workspace = ''"
                      />
                    </template>
                  </a-input>
                </div>

                <NcMenu class="w-full max-h-[360px] nc-scrollbar-thin" @click="handleCloseDropdown('workspace')">
                  <NcMenuItem
                    class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                    @click="handleUpdateWorkspaceQuery()"
                  >
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="flex-1 text-gray-800"> All Workspaces </span>
                      <GeneralIcon v-if="!auditLogsQuery.workspaceId" icon="check" class="flex-none text-primary w-4 h-4" />
                    </div>
                  </NcMenuItem>
                  <NcDivider v-if="workspacesList.length" />
                  <template v-for="(workspace, index) of workspacesList" :key="index">
                    <NcMenuItem
                      v-if="searchCompare([workspace.title], auditDropdownsSearch.workspace)"
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click="handleUpdateWorkspaceQuery(workspace.id)"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        {{ workspace.title }}

                        <GeneralIcon
                          v-if="auditLogsQuery.workspaceId === workspace.id"
                          icon="check"
                          class="flex-none text-primary w-4 h-4"
                        />
                      </div>
                    </NcMenuItem>
                  </template>
                </NcMenu>
              </div>
            </template>
          </NcDropdown>
          <NcDropdown
            v-if="auditCollaborators?.length"
            v-model:visible="auditDropdowns.user"
            overlay-class-name="overflow-hidden"
            @update:visible="handleClearDropdownSearch($event, 'user')"
          >
            <NcButton type="secondary" size="small">
              <div class="!w-[106px] flex items-center justify-between gap-2">
                <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
                  {{ $t('objects.user') }}:
                  <NcTooltip
                    class="capitalize truncate !leading-5"
                    :class="{ 'text-brand-500': auditLogsQuery.user }"
                    show-on-truncate-only
                  >
                    <template #title>
                      {{
                        (auditLogsQuery.user &&
                          (collaboratorsMap.get(auditLogsQuery.user)?.display_name ||
                            collaboratorsMap
                              .get(auditLogsQuery.user)
                              ?.email?.slice(0, collaboratorsMap.get(auditLogsQuery.user)?.email.indexOf('@')))) ||
                        'All'
                      }}
                    </template>

                    {{
                      (auditLogsQuery.user &&
                        (collaboratorsMap.get(auditLogsQuery.user)?.display_name ||
                          collaboratorsMap
                            .get(auditLogsQuery.user)
                            ?.email?.slice(0, collaboratorsMap.get(auditLogsQuery.user)?.email.indexOf('@')))) ||
                      'All'
                    }}
                  </NcTooltip>
                </div>
                <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
              </div>
            </NcButton>

            <template #overlay>
              <div
                class="w-[256px]"
                :class="{
                  'pt-2': auditCollaborators.length >= 6,
                  'pt-1.5': auditCollaborators.length < 6,
                }"
              >
                <div v-if="auditCollaborators.length >= 6" class="px-2 pb-2" @click.stop>
                  <a-input
                    :ref="focusUserSearchRef"
                    v-model:value="auditDropdownsSearch.user"
                    type="text"
                    autocomplete="off"
                    class="nc-input-sm nc-input-shadow"
                    placeholder="Search user"
                    data-testid="nc-audit-dropdown-user-search-input"
                  >
                    <template #prefix>
                      <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
                    </template>
                    <template #suffix>
                      <GeneralIcon
                        v-if="auditDropdownsSearch.user.length > 0"
                        icon="close"
                        class="ml-1 h-4 w-4 text-gray-500 group-hover:text-black"
                        data-testid="nc-audit-logs-clear-search"
                        @click="auditDropdownsSearch.user = ''"
                      />
                    </template>
                  </a-input>
                </div>

                <NcMenu class="w-full max-h-[360px] nc-scrollbar-thin" @click="handleCloseDropdown('user')">
                  <NcMenuItem
                    class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child sticky top-0"
                    @click="auditLogsQuery.user = undefined"
                  >
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="flex-1 text-gray-800"> All Users </span>
                      <GeneralIcon v-if="!auditLogsQuery.user" icon="check" class="flex-none text-primary w-4 h-4" />
                    </div>
                  </NcMenuItem>
                  <NcDivider v-if="auditCollaborators.length" />
                  <template v-for="(coll, index) of auditCollaborators" :key="index">
                    <NcMenuItem
                      v-if="
                        coll.email?.includes(auditDropdownsSearch.user.toLowerCase()) ||
                        coll.display_name?.includes(auditDropdownsSearch.user.toLowerCase())
                      "
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click="auditLogsQuery.user = coll.email"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        <div v-if="coll?.email" class="w-full flex gap-3 items-center max-w-[calc(100%_-_28px)]">
                          <GeneralUserIcon :user="coll" size="base" class="flex-none" />
                          <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                            <div class="w-full flex gap-3">
                              <span class="text-sm text-gray-800 capitalize font-semibold truncate">
                                {{ coll?.display_name || coll?.email?.slice(0, coll?.email.indexOf('@')) }}
                              </span>
                            </div>
                            <span class="text-xs text-gray-600 truncate">
                              {{ coll?.email }}
                            </span>
                          </div>
                        </div>
                        <template v-else>{{ coll.email }} </template>

                        <GeneralIcon
                          v-if="auditLogsQuery.user === coll.email"
                          icon="check"
                          class="flex-none text-primary w-4 h-4"
                        />
                      </div>
                    </NcMenuItem>
                  </template>
                </NcMenu>
              </div>
            </template>
          </NcDropdown>

          <NcDropdown
            v-model:visible="auditDropdowns.base"
            overlay-class-name="overflow-hidden"
            @update:visible="handleClearDropdownSearch($event, 'base')"
          >
            <NcButton type="secondary" size="small">
              <div class="!w-[106px] flex items-center justify-between gap-2">
                <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
                  {{ $t('objects.project') }}:
                  <NcTooltip
                    class="truncate !leading-5"
                    :class="{ 'text-brand-500': auditLogsQuery.baseId }"
                    show-on-truncate-only
                  >
                    <template #title>
                      {{ (auditLogsQuery.baseId && bases.get(auditLogsQuery.baseId)?.title) || 'All' }}
                    </template>
                    {{ (auditLogsQuery.baseId && bases.get(auditLogsQuery.baseId)?.title) || 'All' }}
                  </NcTooltip>
                </div>
                <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
              </div>
            </NcButton>

            <template #overlay>
              <div
                class="w-[256px]"
                :class="{
                  'pt-2': basesList.length >= 6,
                  'pt-1.5': basesList.length < 6,
                }"
              >
                <div v-if="basesList.length >= 6" class="px-2 pb-2" @click.stop>
                  <a-input
                    :ref="focusBaseSearchRef"
                    v-model:value="auditDropdownsSearch.base"
                    type="text"
                    autocomplete="off"
                    class="nc-input-sm nc-input-shadow"
                    placeholder="Search base"
                    data-testid="nc-audit-dropdown-base-search-input"
                  >
                    <template #prefix>
                      <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
                    </template>
                    <template #suffix>
                      <GeneralIcon
                        v-if="auditDropdownsSearch.user.length > 0"
                        icon="close"
                        class="ml-1 h-4 w-4 text-gray-500 group-hover:text-black"
                        data-testid="nc-audit-logs-clear-search"
                        @click="auditDropdownsSearch.user = ''"
                      />
                    </template>
                  </a-input>
                </div>

                <NcMenu class="w-full max-h-[360px] nc-scrollbar-thin" @click="handleCloseDropdown('base')">
                  <NcMenuItem
                    class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                    @click="handleUpdateBaseQuery()"
                  >
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="flex-1 text-gray-800"> All Bases </span>
                      <GeneralIcon v-if="!auditLogsQuery.baseId" icon="check" class="flex-none text-primary w-4 h-4" />
                    </div>
                  </NcMenuItem>
                  <NcDivider v-if="basesList.length" />
                  <template v-for="(base, index) of basesList" :key="index">
                    <NcMenuItem
                      v-if="
                        base?.sources?.[0]?.enabled &&
                        base.title?.toLowerCase()?.includes(auditDropdownsSearch.base.toLowerCase())
                      "
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click="handleUpdateBaseQuery(base.id, base?.sources?.[0]?.id)"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        <div class="flex-1 flex items-center gap-2 max-w-[calc(100%_-_28px)]">
                          <GeneralProjectIcon
                            :color="base?.meta?.iconColor"
                            :type="base?.type || 'database'"
                            class="nc-view-icon w-4 h-4 flex-none"
                          />

                          <NcTooltip class="max-w-full truncate text-gray-800" placement="top" show-on-truncate-only>
                            <template #title> {{ base.title }}</template>
                            {{ base.title }}
                          </NcTooltip>
                        </div>

                        <GeneralIcon
                          v-if="auditLogsQuery.baseId === base.id"
                          icon="check"
                          class="flex-none text-primary w-4 h-4"
                        />
                      </div>
                    </NcMenuItem>
                  </template>
                </NcMenu>
              </div>
            </template>
          </NcDropdown>
          <template v-if="isTypeAndRangeFilterEnabled">
            <NcDropdown
              v-model:visible="auditDropdowns.type"
              overlay-class-name="overflow-hidden"
              @update:visible="handleClearDropdownSearch($event, 'type')"
            >
              <NcButton type="secondary" size="small">
                <div class="!w-[106px] flex items-center justify-between gap-2">
                  <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
                    {{ $t('general.type') }}:
                    <NcTooltip
                      class="truncate !leading-5"
                      :class="{ 'text-brand-500': auditLogsQuery.type }"
                      show-on-truncate-only
                    >
                      <template #title>
                        {{ auditLogsQuery.type ? auditOperationTypeLabels[auditLogsQuery.type] : 'All' }}
                      </template>
                      {{ auditLogsQuery.type ? auditOperationTypeLabels[auditLogsQuery.type] : 'All' }}
                    </NcTooltip>
                  </div>
                  <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
                </div>
              </NcButton>

              <template #overlay>
                <div
                  class="w-[256px]"
                  :class="{
                    'pt-2': auditTypeOptions.length >= 6,
                    'pt-1.5': auditTypeOptions.length < 6,
                  }"
                >
                  <div v-if="auditTypeOptions.length >= 6" class="px-2 pb-2" @click.stop>
                    <a-input
                      :ref="focusTypeSearchRef"
                      v-model:value="auditDropdownsSearch.type"
                      type="text"
                      autocomplete="off"
                      class="nc-input-sm nc-input-shadow"
                      placeholder="Search type"
                      data-testid="nc-audit-dropdown-type-search-input"
                    >
                      <template #prefix>
                        <GeneralIcon icon="search" class="mr-1 h-4 w-4 text-gray-500 group-hover:text-black" />
                      </template>
                      <template #suffix>
                        <GeneralIcon
                          v-if="auditDropdownsSearch.type.length > 0"
                          icon="close"
                          class="ml-1 h-4 w-4 text-gray-500 group-hover:text-black"
                          data-testid="nc-audit-logs-clear-search"
                          @click="auditDropdownsSearch.type = ''"
                        />
                      </template>
                    </a-input>
                  </div>

                  <NcMenu class="w-full max-h-[360px] nc-scrollbar-thin" @click="handleCloseDropdown('type')">
                    <NcMenuItem
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click="auditLogsQuery.type = undefined"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        <span class="flex-1 text-gray-800"> All Types </span>
                        <GeneralIcon v-if="!auditLogsQuery.type" icon="check" class="flex-none text-primary w-4 h-4" />
                      </div>
                    </NcMenuItem>
                    <NcDivider />
                    <template v-for="type of auditTypeOptions" :key="type.value">
                      <NcMenuItem
                        v-if="type.label.toLowerCase().includes(auditDropdownsSearch.type.toLowerCase())"
                        class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                        @click="auditLogsQuery.type = type.value"
                      >
                        <div class="w-full flex items-center justify-between gap-3">
                          <div class="flex-1 flex items-center gap-2 max-w-[calc(100%_-_28px)] text-gray-800">
                            {{ type.label }}
                          </div>

                          <GeneralIcon
                            v-if="auditLogsQuery.type === type.value"
                            icon="check"
                            class="flex-none text-primary w-4 h-4"
                          />
                        </div>
                      </NcMenuItem>
                    </template>
                  </NcMenu>
                </div>
              </template>
            </NcDropdown>
            <NcDropdown v-model:visible="auditDropdowns.dateRange" overlay-class-name="overflow-hidden">
              <NcButton type="secondary" size="small">
                <div class="!w-[127px] flex items-center justify-between gap-2">
                  <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
                    Range:
                    <NcTooltip
                      class="truncate !leading-5"
                      :class="{ 'text-brand-500': auditLogsQuery.dateRange }"
                      show-on-truncate-only
                    >
                      <template #title>
                        {{ auditLogsQuery.dateRange ? auditLogsQuery.dateRangeLabel : 'All Time' }}
                      </template>
                      {{ auditLogsQuery.dateRange ? auditLogsQuery.dateRangeLabel : 'All Time' }}
                    </NcTooltip>
                  </div>
                  <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
                </div>
              </NcButton>

              <template #overlay>
                <div class="w-[256px] pt-1">
                  <NcMenu class="w-full max-h-[360px] nc-scrollbar-thin nc-audit-date-range-menu">
                    <NcMenuItem
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click="handleClearDateRange"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        <span class="flex-1 text-gray-800"> All Time </span>
                        <GeneralIcon v-if="!auditLogsQuery.dateRange" icon="check" class="flex-none text-primary w-4 h-4" />
                      </div>
                    </NcMenuItem>
                    <NcDivider />
                    <template v-for="range of dateRangeOptions" :key="range.value">
                      <NcMenuItem
                        class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                        @click="handleUpdateDateRange(range.value, range.label)"
                      >
                        <div class="w-full flex items-center justify-between gap-3">
                          <div class="flex-1 flex items-center gap-2 max-w-[calc(100%_-_28px)] text-gray-800">
                            {{ range.label }}
                          </div>

                          <GeneralIcon
                            v-if="auditLogsQuery.dateRange === range.value"
                            icon="check"
                            class="flex-none text-primary w-4 h-4"
                          />
                        </div>
                      </NcMenuItem>
                    </template>

                    <NcMenuItem
                      class="!children:w-full ant-dropdown-menu-item ant-dropdown-menu-item-only-child"
                      @click.stop="handleCustomDateRangeClick"
                    >
                      <div class="w-full flex items-center justify-between gap-3">
                        <div class="w-full flex items-center justify-between gap-2 text-gray-800">
                          <GeneralIcon
                            icon="chevronDown"
                            class="flex-none w-4 h-4 transform"
                            :class="{
                              'rotate-270': auditLogsQuery.dateRange !== AuditLogsDateRange.Custom,
                            }"
                          />
                          <span class="flex-1 text-gray-800"> Custom Date Range </span>
                        </div>
                        <GeneralIcon
                          v-if="auditLogsQuery.dateRange === AuditLogsDateRange.Custom"
                          icon="check"
                          class="flex-none text-primary w-4 h-4"
                        />
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                  <div
                    v-if="auditLogsQuery.dateRange === AuditLogsDateRange.Custom"
                    class="w-full flex flex-col gap-2 px-2 pb-2.5"
                    @click.stop
                  >
                    <div class="nc-audit-custom-date-range-input">
                      <LazyCellDatePicker
                        :model-value="auditLogsQuery.startDate"
                        @update:model-value="(value) => handleUpdateCustomDateRange(value, 'startDate')"
                      >
                      </LazyCellDatePicker>
                    </div>
                    <div class="nc-audit-custom-date-range-input">
                      <LazyCellDatePicker
                        :model-value="
                          auditLogsQuery.endDate
                            ? dayjs(auditLogsQuery.endDate).local().format('YYYY-MM-DD')
                            : auditLogsQuery.endDate
                        "
                        @update:model-value="(value) => handleUpdateCustomDateRange(value, 'endDate')"
                      >
                      </LazyCellDatePicker>
                    </div>
                  </div>
                </div>
              </template>
            </NcDropdown>
          </template>
        </div>
        <div class="flex items-center gap-3">
          <NcButton type="text" size="small" :disabled="isLoading" @click="handleRefresh">
            <!-- Refresh -->
            <div class="flex items-center gap-2">
              {{ $t('general.refresh') }}

              <component :is="iconMap.refresh" class="h-3.5 w-3.5" :class="{ 'animate-infinite animate-spin': isLoading }" />
            </div>
          </NcButton>
        </div>
      </div>
      <NcTable
        v-model:order-by="orderBy"
        :is-data-loading="isLoading"
        :columns="columns"
        :data="audits || []"
        sticky-first-column
        class="flex-1 nc-audit-logs-table max-w-full"
        :customRow="customRow"
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
                      {{
                        collaboratorsMap.get(audit.user)?.display_name ||
                        collaboratorsMap.get(audit.user)?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
                      }}
                    </template>
                    {{
                      collaboratorsMap.get(audit.user)?.display_name ||
                      collaboratorsMap.get(audit.user)?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
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

          <div v-if="column.key === 'created_at'" class="w-full flex">
            <NcTooltip placement="bottom">
              <template #title> {{ parseStringDateTime(audit.created_at, 'D MMMM YYYY HH:mm') }}</template>

              {{ timeAgo(audit.created_at) }}
            </NcTooltip>
          </div>
          <div v-if="column.key === 'base_id'" class="w-full">
            <div v-if="audit.base_id" class="w-full">
              <NcTooltip class="truncate text-sm !leading-5 text-gray-800 font-semibold" show-on-truncate-only placement="bottom">
                <template #title>
                  {{ bases.get(audit.base_id)?.title }}
                </template>
                {{ bases.get(audit.base_id)?.title }}
              </NcTooltip>

              <div class="text-gray-600 text-xs">ID: {{ audit.base_id }}</div>
            </div>
          </div>
          <div v-if="column.key === 'event'" class="w-full">
            <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
              <template #title> {{ auditV1OperationTypesAlias[audit.op_type] }}</template>

              <span class="truncate"> {{ auditV1OperationTypesAlias[audit.op_type] }} </span>
            </NcTooltip>
          </div>

          <div v-if="column.key === 'ip'" class="w-full truncate">
            {{ audit.ip || '' }}
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
                @update:page-size="loadAudits(auditPaginationData.page, $event, false)"
              />
              <div class="text-gray-500 text-xs">
                {{ auditPaginationData.totalRows }} {{ auditPaginationData.totalRows === 1 ? 'record' : 'records' }}
              </div>
            </div>
          </div>
        </template>
      </NcTable>
      <AccountAuditsExpandedAudit />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-menu-item-inner) {
  @apply !w-full;
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
</style>
