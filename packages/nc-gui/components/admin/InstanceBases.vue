<script lang="ts" setup>
const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Organization')

const { bases, fetchBases } = useInstanceAdmin()

const searchInput = ref('')

const filteredBases = computed(() => {
  return bases.value.filter((base) => base.title.toLowerCase().includes(searchInput.value.toLowerCase()))
})

const sortedBases = computed(() => {
  return handleGetSortedData(filteredBases.value, sorts.value)
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

const { appInfo } = useGlobal()

const columns = computed(() => {
  const cols: NcTableColumnProps[] = [
    {
      key: 'title',
      title: t('general.name'),
      minWidth: 288,
      dataIndex: 'title',
      showOrderBy: true,
    },
  ]

  if (appInfo.value?.isOnPrem) {
    cols.push({
      key: 'workspaceName',
      title: t('labels.workspaceName'),
      minWidth: 260,
    })
  }

  cols.push({
    key: 'memberCount',
    title: t('labels.numberOfMembers'),
    minWidth: 170,
    width: 170,
    dataIndex: 'memberCount',
    showOrderBy: true,
  })

  return cols
})

const customRow = (base: Record<string, any>) => ({
  onClick: () => {
    if (isEeUI) {
      navigateTo(`/${base.workspace_id}/${base.id}`)
    } else {
      navigateTo(`/nc/${base.workspace_id}/${base.id}`)
    }
  },
})

onMounted(() => {
  loadSorts()
  fetchBases()
})
</script>

<template>
  <div class="flex flex-col h-full" data-testid="nc-instance-admin-bases">
    <div class="h-full flex flex-col w-full">
      <NcPageHeader>
        <template #icon>
          <div class="flex justify-center items-center h-5 w-5">
            <GeneralProjectIcon class="flex-none h-5 w-5" />
          </div>
        </template>
        <template #title>
          <span data-rec="true">
            {{ $t('objects.projects') }}
          </span>
        </template>
      </NcPageHeader>

      <div class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col gap-6 p-6">
        <div class="w-full justify-between flex items-center">
          <a-input
            v-model:value="searchInput"
            allow-clear
            placeholder="Search for a base"
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
          :data="sortedBases"
          :bordered="false"
          :custom-row="customRow"
          data-testid="nc-instance-admin-bases-list"
          class="flex-1 nc-instance-base-list"
        >
          <template #bodyCell="{ column, record: base }">
            <div v-if="column.key === 'title'" class="w-full flex gap-3 items-center">
              <GeneralBaseIconColorPicker :readonly="true" size="xsmall" :model-value="parseProp(base.meta).iconColor" />

              <NcTooltip class="truncate max-w-[calc(100%_-_32px)]" show-on-truncate-only>
                <template #title>
                  {{ base.title }}
                </template>
                <span class="capitalize font-semibold text-nc-content-gray">
                  {{ base.title }}
                </span>
              </NcTooltip>
            </div>
            <div v-if="column.key === 'workspaceName'" class="w-full gap-3 flex items-center">
              <GeneralWorkspaceIcon
                :workspace="{
                  id: base.workspace_id,
                  title: base.workspace_title,
                  meta: parseProp(base.workspace_meta),
                }"
              />
              <NcTooltip class="max-w-full" show-on-truncate-only>
                <template #title>
                  {{ base.workspace_title }}
                </template>
                <span class="capitalize">
                  {{ base.workspace_title }}
                </span>
              </NcTooltip>
            </div>
            <div v-if="column.key === 'memberCount'">
              {{ base.memberCount }}
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
