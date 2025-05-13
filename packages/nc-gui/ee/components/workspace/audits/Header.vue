<script lang="ts" setup>
import dayjs from 'dayjs'
import { auditV1OperationsCategory } from 'nocodb-sdk'
import { AuditLogsDateRange } from '~/lib/enums'

const defaultAuditDropdowns = {
  type: false,
  subType: false,
  workspace: false,
  base: false,
  user: false,
  dateRange: false,
}

const { t } = useI18n()

const auditsStore = useAuditsStore()

const { loadAudits, loadBasesForWorkspace } = auditsStore

const {
  bases,
  basesList,
  auditLogsQuery,
  auditPaginationData,
  isLoadingBases,
  isLoadingUsers,
  collaboratorsMap,
  auditCollaborators,
  isLoadingAudits,
} = storeToRefs(auditsStore)

const auditLogsQueryEndDate = computed(() =>
  auditLogsQuery.value.endDate ? dayjs(auditLogsQuery.value.endDate).local().format('YYYY-MM-DD') : auditLogsQuery.value.endDate,
)

const { workspaces, workspacesList } = storeToRefs(useWorkspace())

const auditDropdowns = ref(defaultAuditDropdowns)

const defaultAuditDropdownsSearch = {
  type: '',
  workspace: '',
  base: '',
  user: '',
}

const auditDropdownsSearch = ref(defaultAuditDropdownsSearch)

const auditTypeOptions = computed(() => {
  return Object.values(auditV1OperationsCategory)
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

const handleCloseDropdown = (field: keyof typeof defaultAuditDropdowns) => {
  auditDropdowns.value[field] = false
  loadAudits()
}

const handleUpdateWorkspaceQuery = (workspaceId?: string) => {
  auditLogsQuery.value = { ...auditLogsQuery.value, workspaceId, baseId: undefined, user: undefined }
  if (workspaceId) {
    loadBasesForWorkspace()
  }

  handleCloseDropdown('workspace')
}

const handleUpdateUserQuery = (userEmail?: string) => {
  auditLogsQuery.value.user = userEmail

  handleCloseDropdown('user')
}

const handleFilterUser = (query: string, option: any) => {
  return searchCompare([option.email, option.display_name], query)
}

const handleUpdateBaseQuery = (baseId?: string, sourceId?: string) => {
  auditLogsQuery.value.baseId = baseId
  auditLogsQuery.value.sourceId = sourceId

  handleCloseDropdown('user')
}

const handleUpdateEventQuery = (eventCat: string[] = []) => {
  auditLogsQuery.value.type = eventCat

  loadAudits()
}

const handleFilterEvent = (query: string, option: any) => {
  return searchCompare(t(option.label), query)
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

const selectedUserFilter = computed(() => {
  return (
    (auditLogsQuery.value.user &&
      (collaboratorsMap.value.get(auditLogsQuery.value.user)?.display_name ||
        collaboratorsMap.value
          .get(auditLogsQuery.value.user)
          ?.email?.slice(0, collaboratorsMap.value.get(auditLogsQuery.value.user)?.email?.indexOf('@')))) ||
    'All'
  )
})

const selectedEventTypes = computed(() => {
  if (!ncIsArray(auditLogsQuery.value.type) || !auditLogsQuery.value.type?.length) {
    return 'All'
  }

  return auditLogsQuery.value.type.map((cat) => t(auditV1OperationsCategory[cat]?.label ?? '')).join(', ')
})

const selectedWorkspace = computed(() => {
  return (auditLogsQuery.value.workspaceId && workspaces.value.get(auditLogsQuery.value.workspaceId)?.title) || 'All'
})

const selectedBase = computed(() => {
  return (auditLogsQuery.value.baseId && bases.value.get(auditLogsQuery.value.baseId)?.title) || 'All'
})

const showWorkspaceSelector = ref(false)
</script>

<template>
  <div class="flex items-center gap-3 justify-between flex-wrap">
    <div class="flex items-center gap-3">
      <NcDropdown
        v-if="showWorkspaceSelector"
        v-model:visible="auditDropdowns.workspace"
        overlay-class-name="overflow-hidden"
        @update:visible="handleClearDropdownSearch($event, 'workspace')"
      >
        <NcButton type="secondary" size="small">
          <div class="!w-[156px] flex items-center justify-between gap-2">
            <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
              {{ $t('objects.workspace') }}:
              <NcTooltip
                class="capitalize truncate !leading-5"
                :class="{ 'text-brand-500': auditLogsQuery.workspaceId }"
                show-on-truncate-only
              >
                <template #title>
                  <span class="capitalize">
                    {{ selectedWorkspace }}
                  </span>
                </template>
                {{ selectedWorkspace }}
              </NcTooltip>
            </div>
            <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
          </div>
        </NcButton>

        <template #overlay>
          <NcList
            v-model:open="auditDropdowns.workspace"
            :value="auditLogsQuery.workspaceId"
            :list="workspacesList"
            option-label-key="title"
            option-value-key="id"
            :item-height="40"
            search-input-placeholder="Search workspace"
            @update:value="handleUpdateWorkspaceQuery($event)"
          >
            <template #listItemContent="{ option }">
              <div class="w-[calc(100%_-_28px)] gap-2 flex items-center">
                <GeneralWorkspaceIcon :workspace="option" />
                <NcTooltip class="max-w-full capitalize" show-on-truncate-only>
                  <template #title>
                    {{ option.title }}
                  </template>
                  <span class="capitalize">
                    {{ option.title }}
                  </span>
                </NcTooltip>
              </div>
            </template>
            <template #listHeader>
              <div class="px-2" @click="handleUpdateWorkspaceQuery()">
                <div class="p-2 rounded-md w-full flex items-center justify-between gap-3 hover:bg-gray-100 cursor-pointer">
                  <span class="flex-1 text-gray-800"> All Workspaces </span>
                  <GeneralIcon v-if="!auditLogsQuery.workspaceId" icon="check" class="flex-none text-primary w-4 h-4" />
                </div>
              </div>
              <NcDivider class="!my-2" />
            </template>
          </NcList>
        </template>
      </NcDropdown>
      <NcDropdown
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
                  <span class="capitalize">
                    {{ selectedUserFilter }}
                  </span>
                </template>

                {{ selectedUserFilter }}
              </NcTooltip>
            </div>
            <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
          </div>
        </NcButton>

        <template #overlay>
          <NcList
            v-model:open="auditDropdowns.user"
            :value="auditLogsQuery.user"
            :list="auditCollaborators"
            option-label-key="email"
            option-value-key="email"
            :item-height="44"
            item-class-name="!py-1"
            search-input-placeholder="Search user"
            :filter-option="handleFilterUser"
            @update:value="handleUpdateUserQuery($event)"
          >
            <template #listItemContent="{ option }">
              <div v-if="option?.email" class="w-full flex gap-3 items-center max-w-[calc(100%_-_24px)]">
                <GeneralUserIcon :user="option" size="base" class="flex-none" />
                <div class="flex-1 flex flex-col max-w-[calc(100%_-_44px)]">
                  <div class="w-full flex gap-3">
                    <span class="text-sm text-gray-800 capitalize font-semibold truncate">
                      {{ option?.display_name || option?.email?.slice(0, option?.email.indexOf('@')) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-600 truncate">
                    {{ option?.email }}
                  </span>
                </div>
              </div>
              <template v-else>{{ option.email }} </template>
            </template>
            <template #listHeader>
              <div class="px-2" @click="handleUpdateUserQuery()">
                <div class="p-2 rounded-md w-full flex items-center justify-between gap-3 hover:bg-gray-100 cursor-pointer">
                  <span class="flex-1 text-gray-800"> All Users </span>
                  <GeneralIcon v-if="!auditLogsQuery.user" icon="check" class="flex-none text-primary w-4 h-4" />
                </div>
              </div>
              <NcDivider class="!my-2" />
            </template>
            <template v-if="isLoadingUsers && !auditCollaborators.length" #emptyState>
              <div class="flex flex-col justify-center items-center py-4">
                <GeneralLoader size="large" class="flex-none" />
              </div>
            </template>
          </NcList>
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
              <NcTooltip class="truncate !leading-5" :class="{ 'text-brand-500': auditLogsQuery.baseId }" show-on-truncate-only>
                <template #title>
                  <span class="capitalize">
                    {{ selectedBase }}
                  </span>
                </template>
                {{ selectedBase }}
              </NcTooltip>
            </div>
            <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
          </div>
        </NcButton>

        <template #overlay>
          <NcList
            v-model:open="auditDropdowns.base"
            :value="auditLogsQuery.baseId"
            :list="basesList"
            option-label-key="title"
            option-value-key="id"
            search-input-placeholder="Search base"
            @update:value="handleUpdateBaseQuery($event)"
          >
            <template #listItemContent="{ option }">
              <div class="flex-1 flex items-center gap-2 max-w-[calc(100%_-_24px)]">
                <GeneralProjectIcon
                  :color="option?.meta?.iconColor"
                  :type="option?.type || 'dataoption'"
                  class="nc-view-icon flex-none"
                />

                <NcTooltip class="max-w-full truncate text-gray-800" placement="top" show-on-truncate-only>
                  <template #title> {{ option.title }}</template>
                  {{ option.title }}
                </NcTooltip>
              </div>
            </template>
            <template #listHeader>
              <div
                class="px-2"
                :class="{
                  'mb-2': !basesList.length,
                }"
                @click="handleUpdateBaseQuery()"
              >
                <div class="p-2 rounded-md w-full flex items-center justify-between gap-3 hover:bg-gray-100 cursor-pointer">
                  <span class="flex-1 text-gray-800"> All Bases </span>
                  <GeneralIcon v-if="!auditLogsQuery.baseId" icon="check" class="flex-none text-primary w-4 h-4" />
                </div>
              </div>
              <NcDivider v-if="basesList.length" class="!my-2" />
            </template>
            <template v-if="!basesList.length || isLoadingBases" #emptyState>
              <div v-if="isLoadingBases" class="flex flex-col justify-center items-center py-4">
                <GeneralLoader size="large" class="flex-none" />
              </div>
              <div v-else>
                <!-- For spacing ony  -->
              </div>
            </template>
          </NcList>
        </template>
      </NcDropdown>

      <NcDropdown
        v-model:visible="auditDropdowns.type"
        overlay-class-name="overflow-hidden"
        @update:visible="handleClearDropdownSearch($event, 'type')"
      >
        <NcButton type="secondary" size="small">
          <div class="!w-[116px] flex items-center justify-between gap-2">
            <div class="max-w-full truncate text-sm !leading-5 flex items-center gap-1">
              {{ $t('general.event') }}:
              <NcTooltip
                class="truncate !leading-5"
                :class="{ 'text-brand-500': !(!ncIsArray(auditLogsQuery.type) || !auditLogsQuery.type?.length) }"
                show-on-truncate-only
              >
                <template #title>
                  <span class="capitalize">
                    {{ selectedEventTypes }}
                  </span>
                </template>
                {{ selectedEventTypes }}
              </NcTooltip>
            </div>
            <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4" />
          </div>
        </NcButton>

        <template #overlay>
          <NcList
            v-model:open="auditDropdowns.type"
            :value="auditLogsQuery.type"
            :list="auditTypeOptions"
            option-label-key="label"
            option-value-key="value"
            search-input-placeholder="Search event"
            is-multi-select
            :close-on-select="false"
            :filter-option="handleFilterEvent"
            @update:value="handleUpdateEventQuery($event)"
          >
            <template #listItemContent="{ option }">
              <NcTooltip class="flex-1 max-w-[calc(100%_-_24px)] truncate text-gray-800" placement="top" show-on-truncate-only>
                <template #title> {{ $t(option.label) }}</template>
                {{ $t(option.label) }}
              </NcTooltip>
            </template>
            <template #listHeader>
              <div class="px-2" @click="handleUpdateEventQuery()">
                <div class="p-2 rounded-md w-full flex items-center justify-between gap-3 hover:bg-gray-100 cursor-pointer">
                  <span class="flex-1 text-gray-800"> All Events </span>
                  <GeneralIcon
                    v-if="!ncIsArray(auditLogsQuery.type) || !auditLogsQuery.type?.length"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </div>
              <NcDivider class="!my-2" />
            </template>
          </NcList>
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
                  <span class="capitalize">
                    {{ auditLogsQuery.dateRange ? auditLogsQuery.dateRangeLabel : 'All Time' }}
                  </span>
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
                  <div class="w-full flex items-center justify-between gap-2">
                    <div class="flex-1 flex items-center gap-2 max-w-[calc(100%_-_24px)] text-gray-800">
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
                <LazyCellDate
                  :model-value="auditLogsQuery.startDate"
                  @update:model-value="handleUpdateCustomDateRange($event, 'startDate')"
                >
                </LazyCellDate>
              </div>
              <div class="nc-audit-custom-date-range-input">
                <LazyCellDate
                  :model-value="auditLogsQueryEndDate"
                  @update:model-value="handleUpdateCustomDateRange($event, 'endDate')"
                >
                </LazyCellDate>
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>
    </div>
    <div class="flex items-center gap-3">
      <NcButton type="text" size="small" :disabled="isLoadingAudits" @click="handleRefresh">
        <!-- Refresh -->
        <div class="flex items-center gap-2">
          {{ $t('general.refresh') }}

          <component :is="iconMap.refresh" class="h-3.5 w-3.5" :class="{ 'animate-infinite animate-spin': isLoadingAudits }" />
        </div>
      </NcButton>
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
