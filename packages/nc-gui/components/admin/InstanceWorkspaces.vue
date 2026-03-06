<script lang="ts" setup>
const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Organization')

const { workspaces, fetchWorkspaces } = useInstanceAdmin()

const searchInput = ref('')

const filteredWorkspaces = computed(() =>
  workspaces.value.filter((ws) => ws.title.toLowerCase().includes(searchInput.value.toLowerCase())),
)

const sortedWorkspaces = computed(() => {
  return handleGetSortedData(filteredWorkspaces.value, sorts.value)
})

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
      field,
      direction,
    })
  },
})

const columns = [
  {
    key: 'title',
    title: t('labels.workspaceName'),
    minWidth: 288,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'memberCount',
    title: t('labels.numberOfMembers'),
    minWidth: 180,
    width: 180,
    dataIndex: 'memberCount',
    showOrderBy: true,
  },
  {
    key: 'baseCount',
    title: t('labels.numberOfBases'),
    minWidth: 150,
    width: 150,
    dataIndex: 'baseCount',
    showOrderBy: true,
  },
] as NcTableColumnProps[]

const customRow = (ws: Record<string, any>) => ({
  onClick: () => {
    if (isEeUI) {
      navigateTo(`/${ws.id}`)
    } else {
      navigateTo(`/nc/${ws.id}`)
    }
  },
})

onMounted(() => {
  loadSorts()
  fetchWorkspaces()
})
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-instance-admin-workspaces">
    <div class="h-full flex flex-col w-full">
      <NcPageHeader>
        <template #icon>
          <GeneralIcon class="flex-none !h-5 !w-5 fill-nc-bg-gray-medium" icon="ncWorkspace" />
        </template>
        <template #title>
          <span data-rec="true">
            {{ $t('labels.workspaces') }}
          </span>
        </template>
      </NcPageHeader>

      <div class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col gap-6 p-6">
        <div class="w-full justify-between flex items-center">
          <a-input
            v-model:value="searchInput"
            allow-clear
            placeholder="Search for a workspace"
            class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
          >
            <template #prefix>
              <GeneralIcon
                icon="search"
                class="mr-2 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme"
              />
            </template>
          </a-input>
        </div>

        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          :data="sortedWorkspaces"
          :bordered="false"
          :custom-row="customRow"
          data-testid="nc-instance-admin-workspaces-list"
          class="flex-1 nc-instance-workspace-list"
        >
          <template #bodyCell="{ column, record: ws }">
            <div v-if="column.key === 'title'" class="w-full gap-3 flex items-center">
              <GeneralWorkspaceIcon :workspace="ws" size="medium" />
              <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                <template #title>
                  {{ ws.title }}
                </template>
                <span class="capitalize font-semibold text-nc-content-gray">
                  {{ ws.title }}
                </span>
              </NcTooltip>
            </div>

            <div v-if="column.key === 'memberCount'">
              {{ ws.memberCount }}
            </div>
            <div v-if="column.key === 'baseCount'">
              {{ ws.baseCount }}
            </div>
          </template>
        </NcTable>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-nc-content-gray-muted;
}

.ant-input:placeholder-shown {
  @apply text-nc-content-gray-muted !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-nc-border-brand border-nc-border-gray-medium !ring-0;
}
</style>
