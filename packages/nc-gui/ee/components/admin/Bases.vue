<script lang="ts" setup>
const { t } = useI18n()

const route = useRoute()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Organization')

const { org } = storeToRefs(useOrg())

const { bases, fetchOrganizationBases } = useOrganization()

const searchInput = ref('')

const filteredBases = computed(() => {
  return bases.value.filter((base) => base.title.toLowerCase().includes(searchInput.value.toLowerCase()))
})

const sortedBases = computed(() => {
  return handleGetSortedData(filteredBases.value, sorts.value)
})

const renameBaseDlg = ref(false)

const selectedBaseId = ref('')

const selectedBase = computed(() => {
  return bases.value.find((base) => base.id === selectedBaseId.value)
})

const extractBaseOwner = (base) => {
  return base.members.find((member) => member.roles === 'owner')
}

const renameBase = (baseId: string) => {
  selectedBaseId.value = baseId
  renameBaseDlg.value = true
}

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
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
    title: t('general.name'),
    minWidth: 288,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'owner',
    title: t('objects.owner'),
    basis: '25%',
    minWidth: 252,
  },
  {
    key: 'workspaceName',
    title: t('labels.workspaceName'),
    minWidth: 288,
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
    key: 'action',
    title: t('labels.actions'),
    width: 120,
    minWidth: 120,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const customRow = (base: Record<string, any>) => ({
  onClick: () => {
    navigateTo(`${route.params.page}/${base.id}`)
  },
})

watch(renameBaseDlg, (val) => {
  if (!val) {
    selectedBaseId.value = ''
    fetchOrganizationBases()
  }
})

onMounted(() => {
  loadSorts()
  fetchOrganizationBases()
})
</script>

<template>
  <div class="flex flex-col h-full" data-test-id="nc-admin-bases">
    <LazyDlgRenameBase
      v-if="renameBaseDlg && selectedBase?.title"
      v-model:model-value="renameBaseDlg"
      :base-id="selectedBaseId"
      :title="selectedBase?.title"
    />
    <div class="h-full flex flex-col w-full">
      <div class="nc-breadcrumb px-2">
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <div class="nc-breadcrumb-item active">
          {{ $t('objects.projects') }}
        </div>
      </div>
      <NcPageHeader>
        <template #icon>
          <div class="flex justify-center items-center h-5 w-5">
            <GeneralProjectIcon class="flex-none h-4.5 w-4.5" />
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
          <a-input v-model:value="searchInput" placeholder="Search a base">
            <template #prefix>
              <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
            </template>
          </a-input>
        </div>

        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          :data="sortedBases"
          :bordered="false"
          :custom-row="customRow"
          data-testid="nc-org-members-list"
          class="flex-1 nc-org-base-list"
        >
          <template #bodyCell="{ column, record: base }">
            <div v-if="column.key === 'title'" class="w-full flex gap-3 items-center">
              <GeneralBaseIconColorPicker :readonly="true" size="xsmall" />

              <NcTooltip class="truncate max-w-[calc(100%_-_32px)]" show-on-truncate-only>
                <template #title>
                  {{ base.title }}
                </template>
                <span class="capitalize font-semibold text-gray-800">
                  {{ base.title }}
                </span>
              </NcTooltip>
            </div>
            <div v-if="column.key === 'owner'" class="w-full flex gap-3 items-center">
              <GeneralUserIcon :email="extractBaseOwner(base)?.email" size="base" class="flex-none" />
              <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                <div class="flex gap-3">
                  <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                    <template #title>
                      {{ extractBaseOwner(base)?.display_name || extractBaseOwner(base)?.email.split('@')[0] }}
                    </template>
                    {{ extractBaseOwner(base)?.display_name || extractBaseOwner(base)?.email.split('@')[0] }}
                  </NcTooltip>
                </div>
                <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                  <template #title>
                    {{ extractBaseOwner(base)?.email }}
                  </template>
                  {{ extractBaseOwner(base)?.email }}
                </NcTooltip>
              </div>
            </div>
            <div v-if="column.key === 'workspaceName'" class="w-full gap-3 flex items-center">
              <GeneralWorkspaceIcon
                :workspace="{
                  id: base.workspace_id,
                  title: base.workspace_title,
                  meta: parseProp(base?.workspace_meta),
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

            <div v-if="column.key === 'action'" class="flex justify-end" @click.stop>
              <NcDropdown>
                <NcButton size="small" type="secondary">
                  <component :is="iconMap.threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem data-testid="nc-admin-org-user-assign-admin" @click="renameBase(base.id)">
                      <GeneralIcon class="text-gray-800" icon="rename" />
                      <span>{{ $t('general.rename') }}</span>
                    </NcMenuItem>
                    <NuxtLink
                      :href="`${$route.params.page}/${base.id}`"
                      class="!underline-transparent !text-gray-800 !hover:text-gray-800"
                    >
                      <NcMenuItem data-testid="nc-admin-org-user-delete">
                        <GeneralIcon class="text-gray-800" icon="user" />
                        <span>{{ $t('activity.manageUsers') }}</span>
                      </NcMenuItem>
                    </NuxtLink>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>
        </NcTable>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
