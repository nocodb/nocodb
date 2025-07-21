<script lang="ts" setup>
interface Props {
  workspaceId?: string
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: true,
})

const { workspaceId, isActive } = toRefs(props)

const { t } = useI18n()

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Teams')

const searchQuery = ref('')

const isTeamsLoading = ref(false)

const teams = ref([])

const sortedTeams = computed(() => {
  return handleGetSortedData(teams.value, sorts.value)
})

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateUserSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateUserSort({
      field,
      direction,
    })
  },
})

const columns = [
  {
    key: 'teamName',
    title: t('labels.teamName'),
    minWidth: 220,
    dataIndex: 'teamName',
    showOrderBy: true,
  },
  {
    key: 'badge',
    title: t('labels.badge'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'badge',
    showOrderBy: true,
  },
  {
    key: 'owner',
    title: t('objects.owner'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'owner',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

/**
 * Reset search query on tab change
 */
watch(isActive, () => {
  searchQuery.value = ''
})

onMounted(async () => {
  loadSorts()
})
</script>

<template>
  <div
    class="nc-teams-container overflow-auto nc-scrollbar-thin relative"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <div class="nc-teams-wrapper h-full max-w-[1200px] mx-auto py-6 px-6 flex flex-col gap-6 sticky top-0">
      <div class="w-full flex items-center justify-between gap-3">
        <a-input
          v-model:value="searchQuery"
          allow-clear
          :disabled="isTeamsLoading"
          class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
          :placeholder="$t('placeholder.searchATeam')"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
          </template>
        </a-input>

        <NcButton size="small" inner-class="gap-2" :disabled="isTeamsLoading" data-testid="nc-new-team-btn">
          <template #icon>
            <GeneralIcon icon="plus" class="h-4 w-4" />
          </template>
          {{ $t('labels.newTeam') }}
        </NcButton>
      </div>

      <NcTable
        v-model:order-by="orderBy"
        :columns="columns"
        :data="sortedTeams"
        :is-data-loading="isTeamsLoading"
        :bordered="false"
        class="flex-1 nc-teams-list"
        :pagination="true"
        :pagination-offset="25"
      >
        <template #emptyText>
          <NcEmptyPlaceholder :title="$t('activity.noTeams')" :subtitle="$t('activity.noTeamsSubtitle')">
            <template #action>
              <NcButton size="small" inner-class="gap-2">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.newTeam') }}
              </NcButton>
            </template>
          </NcEmptyPlaceholder>
        </template>

        <template #bodyCell="{ column, record, recordIndex }">
          <div v-if="column.key === 'owner'" class="w-full flex gap-3 items-center">
            <GeneralUserIcon size="base" :user="record" class="flex-none" />
            <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
              <div class="flex items-center gap-1">
                <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                  <template #title>
                    {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                  </template>
                  {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                </NcTooltip>
              </div>
              <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                <template #title>
                  {{ record.email }}
                </template>
                {{ record.email }}
              </NcTooltip>
            </div>
          </div>

          <div v-if="column.key === 'action'">
            <NcDropdown>
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem>
                    <GeneralIcon icon="ncEdit" class="h-4 w-4" />
                    {{ $t('general.edit') }}
                  </NcMenuItem>
                  <NcMenuItem key="delete" class="!text-red-500 !hover:bg-red-50">
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }}
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </NcTable>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
