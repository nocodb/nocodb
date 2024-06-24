<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import type { AuditType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import { AuditOperationTypes, auditOperationSubTypeLabels, auditOperationTypeLabels, timeAgo } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { AuditLogsDateRange } from '~/lib/enums'

interface Props {
  workspaceId?: string
  baseId?: string
  sourceId?: string
}

const props = defineProps<Props>()

const allowedAuditOperationTypes = [AuditOperationTypes.DATA, AuditOperationTypes.TABLE, AuditOperationTypes.TABLE_COLUMN]

const { isUIAllowed } = useRoles()

const { $api } = useNuxtApp()

const workspaceStore = useWorkspace()

const { loadAudits: _loadAudits } = workspaceStore

const {
  collaborators,
  audits,
  auditLogsQuery,
  auditCurrentLimit: currentLimit,
  auditCurrentPage: currentPage,
  auditTotalRows: totalRows,
} = storeToRefs(workspaceStore)

const basesStore = useBases()

const { getBaseUsers, loadProjects } = basesStore

const { bases, basesList } = storeToRefs(basesStore)

const localCollaborators = ref<User[] | UserType[]>([])

const auditCollaborators = computed(() => {
  return (auditLogsQuery.value.baseId || !isEeUI ? localCollaborators.value : collaborators.value) || []
})

const collaboratorsMap = computed<Map<string, (WorkspaceUserType & { id: string }) | User | UserType>>(() => {
  const map = new Map<string, WorkspaceUserType & { id: string }>()

  auditCollaborators.value?.forEach((coll) => {
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

const auditDropdowns = ref({
  type: false,
  subType: false,
  base: false,
  user: false,
  dateRange: false,
})

const auditDropdownsSearch = ref({
  type: '',
  base: '',
  user: '',
})

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

async function loadAudits(page = currentPage.value, limit = currentLimit.value, updateCurrentPage = true) {
  try {
    if (
      (isEeUI && isUIAllowed('workspaceAuditList') && !props.workspaceId) ||
      (!isUIAllowed('workspaceAuditList') && !props.baseId)
    ) {
      return
    }

    if (updateCurrentPage) {
      currentPage.value = 1
    }

    isLoading.value = true
    await _loadAudits(props.workspaceId, updateCurrentPage ? 1 : page, limit)
  } catch {
  } finally {
    isLoading.value = false
  }
}

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

const handleUpdateBaseQuery = (baseId?: string, sourceId?: string) => {
  auditLogsQuery.value.baseId = baseId
  auditLogsQuery.value.sourceId = sourceId
}

const updateOrderBy = (field: 'created_at' | 'user') => {
  if (auditLogsQuery.value.orderBy?.[field] === 'asc') {
    auditLogsQuery.value.orderBy[field] = 'desc'
  } else if (auditLogsQuery.value.orderBy?.[field] === 'desc') {
    auditLogsQuery.value.orderBy[field] = undefined
  } else {
    auditLogsQuery.value.orderBy[field] = 'asc'
  }

  loadAudits()
}

const handleCloseDropdown = (field: 'user' | 'base' | 'type' | 'dateRange') => {
  auditDropdowns.value[field] = false
  loadAudits()
}

const handleClearDropdownSearch = (isOpen: boolean, field: 'user' | 'base' | 'type') => {
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

  currentPage.value = 1
  currentLimit.value = 25
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
      auditLogsQuery.value.startDate = now.subtract(1, 'week').startOf('day').format('YYYY-MM-DD')
      auditLogsQuery.value.endDate = now.format('YYYY-MM-DD HH:mm:ss')
      break
    case AuditLogsDateRange.PastMonth:
      auditLogsQuery.value.startDate = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
      auditLogsQuery.value.endDate = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      break
    case AuditLogsDateRange.PastYear:
      auditLogsQuery.value.startDate = now.subtract(1, 'year').startOf('year').format('YYYY-MM-DD')
      auditLogsQuery.value.endDate = now.subtract(1, 'year').endOf('year').format('YYYY-MM-DD')
      break
    default:
      auditLogsQuery.value.startDate = undefined
      auditLogsQuery.value.endDate = undefined
      auditLogsQuery.value.dateRange = undefined
      auditLogsQuery.value.dateRangeLabel = undefined
  }

  auditDropdowns.value.dateRange = false
  currentPage.value = 1
  currentLimit.value = 25
  loadAudits()
}

const isEditEnabled = computed(() => true)

// provide the following to override the default behavior and enable input fields like in form
provide(ActiveCellInj, ref(true))
provide(EditModeInj, readonly(isEditEnabled))

provide(IsFormInj, ref(true))

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
    await loadProjects()
    await loadOrgUsers()
  }

  if (props.sourceId) {
    auditLogsQuery.value.sourceId = props.sourceId
  }

  if (audits.value === null && appInfo.value.auditEnabled) {
    await loadAudits(currentPage.value, currentLimit.value, false)
  }
})
</script>

<template>
  <div class="h-full flex flex-col" :class="{ 'gap-6': !baseId, 'pt-6': !baseId && isEeUI, 'gap-4': baseId }">
    <div v-if="!appInfo.auditEnabled" class="text-red-500">Audit logs are currently disabled by administrators.</div>

    <div class="flex flex-col" :class="{ 'gap-6': !baseId, 'gap-4': baseId }">
      <div class="flex flex-col gap-3">
        <div class="flex flex-row items-center gap-3">
          <h6 class="text-xl font-semibold text-gray-900 !my-0">
            Audit Logs
            <span v-if="baseId"> : {{ bases.get(baseId)?.title }} </span>
          </h6>
          <NcButton v-if="appInfo.auditEnabled" class="!px-1" type="text" size="xs" :disabled="isLoading" @click="loadAudits()">
            <!-- Reload -->
            <div class="flex items-center text-gray-600 font-light">
              <component :is="iconMap.refresh" :class="{ 'animate-infinite animate-spin': isLoading }" />
            </div>
          </NcButton>
        </div>
        <div v-if="!baseId" class="text-sm text-gray-600">Track and monitor any changes made to any base in your workspace.</div>
      </div>
      <div v-if="appInfo.auditEnabled" class="px-1 flex items-center gap-3">
        <NcDropdown
          v-if="auditCollaborators?.length"
          v-model:visible="auditDropdowns.user"
          @update:visible="handleClearDropdownSearch($event, 'user')"
          overlay-class-name="overflow-hidden"
        >
          <NcButton type="secondary" size="small">
            <div class="!w-[106px] flex items-center justify-between gap-2">
              <div class="max-w-full truncate text-sm !leading-5">
                User:
                <span class="capitalize" :class="{ 'text-brand-500': auditLogsQuery.user }">
                  {{
                    (auditLogsQuery.user &&
                      (collaboratorsMap.get(auditLogsQuery.user)?.display_name ||
                        collaboratorsMap
                          .get(auditLogsQuery.user)
                          ?.email?.slice(0, collaboratorsMap.get(auditLogsQuery.user)?.email.indexOf('@')))) ||
                    'All'
                  }}
                </span>
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
                <NcDivider />
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
                        <GeneralUserIcon :email="coll?.email" size="base" class="flex-none" />
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
          v-if="!baseId && basesList?.length"
          v-model:visible="auditDropdowns.base"
          @update:visible="handleClearDropdownSearch($event, 'base')"
          overlay-class-name="overflow-hidden"
        >
          <NcButton type="secondary" size="small">
            <div class="!w-[106px] flex items-center justify-between gap-2">
              <div class="max-w-full truncate text-sm !leading-5">
                Base:
                <span :class="{ 'text-brand-500': auditLogsQuery.baseId }">
                  {{ (auditLogsQuery.baseId && bases.get(auditLogsQuery.baseId)?.title) || 'All' }}
                </span>
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
                <NcDivider />
                <template v-for="(base, index) of basesList" :key="index">
                  <NcMenuItem
                    v-if="
                      base?.sources?.[0]?.enabled && base.title?.toLowerCase()?.includes(auditDropdownsSearch.base.toLowerCase())
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

                      <GeneralIcon v-if="auditLogsQuery.baseId === base.id" icon="check" class="flex-none text-primary w-4 h-4" />
                    </div>
                  </NcMenuItem>
                </template>
              </NcMenu>
            </div>
          </template>
        </NcDropdown>
        <NcDropdown
          v-model:visible="auditDropdowns.type"
          @update:visible="handleClearDropdownSearch($event, 'type')"
          overlay-class-name="overflow-hidden"
        >
          <NcButton type="secondary" size="small">
            <div class="!w-[106px] flex items-center justify-between gap-2">
              <div class="max-w-full truncate text-sm !leading-5">
                Type:
                <span :class="{ 'text-brand-500': auditLogsQuery.type }">
                  {{ auditLogsQuery.type ? auditOperationTypeLabels[auditLogsQuery.type] : 'All' }}
                </span>
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
              <div class="max-w-full truncate text-sm !leading-5">
                Range:
                <span :class="{ 'text-brand-500': auditLogsQuery.dateRange }">
                  {{ auditLogsQuery.dateRange ? auditLogsQuery.dateRangeLabel : 'All Time' }}
                </span>
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
                    placeholder="YYYY-MM-DD"
                    @update:model-value="(value) => handleUpdateCustomDateRange(value, 'startDate')"
                  >
                  </LazyCellDatePicker>
                </div>
                <div class="nc-audit-custom-date-range-input">
                  <LazyCellDatePicker
                    :model-value="auditLogsQuery.endDate"
                    placeholder="YYYY-MM-DD-12"
                    @update:model-value="(value) => handleUpdateCustomDateRange(value, 'endDate')"
                  >
                  </LazyCellDatePicker>
                </div>
              </div>
            </div>
          </template>
        </NcDropdown>
      </div>
    </div>
    <template v-if="appInfo.auditEnabled">
      <div
        class="relative"
        :class="{
          'h-[calc(100%_-_92px)] ': baseId,
          'h-[calc(100%_-_140px)]': !baseId,
        }"
      >
        <div class="table-wrapper max-h-[calc(100%_-_40px)] overflow-auto nc-scrollbar-thin relative">
          <div class="nc-audit-logs-table table h-full relative">
            <div class="thead sticky top-0">
              <div class="tr">
                <div class="th cell-user !hover:bg-gray-100" @click="updateOrderBy('user')">
                  <div class="flex items-center gap-3">
                    <div>User</div>
                    <GeneralIcon
                      v-if="auditLogsQuery.orderBy?.user"
                      icon="chevronDown"
                      class="flex-none"
                      :class="{
                        'transform rotate-180': auditLogsQuery.orderBy?.user === 'asc',
                      }"
                    />
                  </div>
                </div>
                <div class="th cell-timestamp !hover:bg-gray-100" @click="updateOrderBy('created_at')">
                  <div class="flex items-center gap-3">
                    <div>Time stamp</div>

                    <GeneralIcon
                      v-if="auditLogsQuery.orderBy?.created_at"
                      icon="chevronDown"
                      class="flex-none"
                      :class="{
                        'transform rotate-180': auditLogsQuery.orderBy?.created_at === 'asc',
                      }"
                    />
                  </div>
                </div>
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
                  <div
                    class="tr"
                    :class="{
                      selected: selectedAudit?.id === audit.id && isRowExpanded,
                    }"
                    @click="handleRowClick(audit)"
                  >
                    <div class="td cell-user">
                      <div v-if="audit.user && collaboratorsMap.get(audit.user)?.email" class="w-full flex gap-3 items-center">
                        <GeneralUserIcon :email="collaboratorsMap.get(audit.user)?.email" size="base" class="flex-none" />
                        <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                          <div class="w-full flex gap-3">
                            <span class="text-sm text-gray-800 capitalize font-semibold truncate">
                              {{
                                collaboratorsMap.get(audit.user)?.display_name ||
                                collaboratorsMap
                                  .get(audit.user)
                                  ?.email?.slice(0, collaboratorsMap.get(audit.user)?.email.indexOf('@'))
                              }}
                            </span>
                          </div>
                          <span class="text-xs text-gray-600 truncate">
                            {{ collaboratorsMap.get(audit.user)?.email }}
                          </span>
                        </div>
                      </div>
                      <template v-else>{{ audit.user }} </template>
                    </div>
                    <div class="td cell-timestamp">
                      <NcTooltip placement="bottom">
                        <template #title> {{ parseStringDateTime(audit.created_at, 'D MMMM YYYY HH:mm') }}</template>

                        {{ timeAgo(audit.created_at) }}
                      </NcTooltip>
                    </div>
                    <div class="td cell-base">
                      <div v-if="audit.base_id" class="w-full">
                        <div class="truncate text-sm text-gray-800 font-semibold">
                          {{ bases.get(audit.base_id)?.title }}
                        </div>
                        <div class="text-gray-600 text-xs">ID: {{ audit.base_id }}</div>
                      </div>
                      <template v-else>
                        {{ audit.base_id }}
                      </template>
                    </div>
                    <div class="td cell-type">
                      <div class="truncate bg-gray-200 px-2 py-1 rounded-lg">
                        <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
                          <template #title> {{ auditOperationTypeLabels[audit.op_type] }}</template>

                          <span class="truncate"> {{ auditOperationTypeLabels[audit.op_type] }} </span>
                        </NcTooltip>
                      </div>
                    </div>
                    <div class="td cell-sub-type">
                      <div class="truncate">
                        <NcTooltip class="truncate" placement="bottom" show-on-truncate-only>
                          <template #title> {{ auditOperationSubTypeLabels[audit.op_sub_type] }}</template>

                          <span class="truncate"> {{ auditOperationSubTypeLabels[audit.op_sub_type] }} </span>
                        </NcTooltip>
                      </div>
                    </div>
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
              <div v-else-if="!isLoading" class="flex items-center justify-center text-gray-500">
                <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
              </div>
            </div>
          </div>
        </div>
        <div
          v-show="isLoading"
          class="flex items-center justify-center absolute left-0 top-0 w-full h-full z-10 pb-10 pointer-events-none"
        >
          <div class="flex flex-col justify-center items-center gap-2">
            <GeneralLoader size="xlarge" />
            <span class="text-center">Loading...</span>
          </div>
        </div>
        <div
          v-if="totalRows"
          class="flex flex-row justify-center items-center bg-gray-50 min-h-10"
          :class="{
            'pointer-events-none': isLoading,
          }"
        >
          <div class="flex justify-between items-center w-full px-6">
            <div>&nbsp;</div>
            <template v-if="+totalRows > currentLimit">
              <NcPagination
                v-model:current="currentPage"
                v-model:page-size="currentLimit"
                :total="+totalRows"
                show-size-changer
                :use-stored-page-size="false"
                @update:current="loadAudits(undefined, undefined, false)"
                @update:page-size="loadAudits(currentPage, $event, false)"
              />
            </template>
            <div class="text-gray-500 text-xs">{{ totalRows }} {{ totalRows === 1 ? 'record' : 'records' }}</div>
          </div>
        </div>
      </div>
      <NcModal v-model:visible="isRowExpanded" size="medium" :show-separator="false" @keydown.esc="isRowExpanded = false">
        <template #header>
          <div class="flex items-center justify-between gap-x-2 w-full">
            <div class="flex-1 text-base font-weight-700 text-gray-900">Audit Details</div>
            <div class="flex items-center gap-2">
              <span class="cell-header"> Time stamp </span>

              <NcTooltip placement="bottom" class="text-gray-600 text-small leading-[18px]">
                <template #title> {{ parseStringDateTime(selectedAudit.created_at, 'D MMMM YYYY HH:mm') }}</template>

                {{ timeAgo(selectedAudit.created_at) }}
              </NcTooltip>
            </div>
          </div>
        </template>
        <div v-if="selectedAudit" class="flex flex-col gap-4">
          <div class="bg-gray-50 rounded-lg border-1 border-gray-200 flex">
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
              <div class="cell-header">IP Address</div>
              <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.ip }}</div>
            </div>
          </div>
          <div class="bg-gray-50 rounded-lg border-1 border-gray-200 flex">
            <div class="w-1/2 border-r border-gray-200 flex flex-col gap-2 px-4 py-3">
              <div class="cell-header">Base</div>
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
                <div class="cell-header">Type</div>
                <div class="text-small leading-[18px] text-gray-600 bg-gray-200 px-1 rounded-md">
                  {{ auditOperationTypeLabels[selectedAudit?.op_type] }}
                </div>
              </div>
              <div class="h-1/2 flex items-center gap-2 px-4 py-3">
                <div class="cell-header">Sub-type</div>
                <div class="text-small leading-[18px] text-gray-600">
                  {{ auditOperationSubTypeLabels[selectedAudit?.op_sub_type] }}
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div class="cell-header">{{ $t('labels.description') }}</div>
            <div class="text-small leading-[18px] text-gray-600">{{ selectedAudit?.description }}</div>
          </div>
        </div>
      </NcModal>
    </template>
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

:deep(.nc-menu-item-inner) {
  @apply !w-full;
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

    &.selected .td {
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

.cell-header {
  @apply uppercase text-tiny font-semibold text-gray-500;
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
