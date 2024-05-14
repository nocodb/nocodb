<script lang="ts" setup>
const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Organization')

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
  <div class="flex flex-col items-center" data-test-id="nc-admin-bases">
    <LazyDlgRenameBase
      v-if="renameBaseDlg && selectedBase?.title"
      v-model:model-value="renameBaseDlg"
      :base-id="selectedBaseId"
      :title="selectedBase?.title"
    />
    <div class="flex flex-col w-full px-6 max-w-[97.5rem]">
      <span class="font-bold w-full text-2xl" data-rec="true">
        {{ $t('objects.projects') }}
      </span>
      <div class="w-full justify-between mt-5 flex items-center">
        <a-input v-model:value="searchInput" placeholder="Search a base">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
          </template>
        </a-input>
      </div>

      <div class="mt-5 h-full" data-testid="nc-org-members-list">
        <div class="flex flex-col min-h-[calc(100%-8rem)]">
          <div class="flex flex-row bg-gray-50 max-h-11 items-center border-b-1">
            <LazyAccountHeaderWithSorter
              class="text-gray-500 w-[17rem] px-6 py-3 users-email-grid flex items-center space-x-2 cursor-pointer"
              :header="$t('general.name')"
              :active-sort="sorts"
              field="title"
              :toggle-sort="toggleSort"
            />
            <div class="text-gray-500 w-[15rem] px-6 py-3 users-email-grid flex items-center space-x-2 cursor-pointer">
              <span>
                {{ $t('objects.owner') }}
              </span>
            </div>
            <div class="text-gray-500 w-[15rem] px-6 py-3 users-email-grid flex items-center space-x-2">
              <span>
                {{ $t('labels.workspaceName') }}
              </span>
            </div>

            <LazyAccountHeaderWithSorter
              :active-sort="sorts"
              :header="$t('labels.numberOfMembers')"
              :toggle-sort="toggleSort"
              class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2"
              field="memberCount"
            />
            <div class="text-gray-500 text-right flex-1 px-6 py-3">{{ $t('labels.actions') }}</div>
          </div>
          <div class="flex flex-col nc-scrollbar-md">
            <NuxtLink
              v-for="(base, i) of sortedBases"
              :key="i"
              :href="`${$route.params.page}/${base.id}`"
              class="!underline-transparent border-gray-200 border-b-1 !max-h-13 !text-gray-800 !hover:text-gray-800"
            >
              <div class="workspace-row flex hover:bg-[#F0F3FF] flex-row !max-h-13 items-center">
                <div class="flex gap-3 !w-[17rem] items-center px-6 py-3">
                  <GeneralBaseIconColorPicker :readonly="true" size="xsmall" />

                  <NcTooltip class="overflow-ellipsis truncate" show-on-truncate-only>
                    <span
                      :style="{
                        wordBreak: 'keep-all',
                        whiteSpace: 'nowrap',
                        display: 'inline',
                      }"
                      class="text-ellipsis font-semibold text-gray-800 overflow-hidden"
                    >
                      {{ base.title }}
                    </span>
                    <template #title>
                      {{ base.title }}
                    </template>
                  </NcTooltip>
                </div>
                <div class="flex gap-3 !w-[15rem] items-center px-6 py-1.5">
                  <GeneralUserIcon :email="extractBaseOwner(base)?.email" size="base" />
                  <div class="flex flex-col">
                    <div class="flex gap-3">
                      <span class="text-gray-800 font-semibold">
                        {{ extractBaseOwner(base)?.display_name || extractBaseOwner(base)?.email.split('@')[0] }}
                      </span>
                    </div>
                    <span class="text-xs text-gray-600">
                      {{ extractBaseOwner(base)?.email }}
                    </span>
                  </div>
                </div>
                <div class="!w-[15rem] gap-3 flex items-center px-6 py-3">
                  <GeneralWorkspaceIcon
                    :workspace="{
                      id: base.workspace_id,
                      title: base.workspace_title,
                      meta: JSON.parse(base?.workspace_meta),
                    }"
                    hide-label
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
                <div class="w-full flex-1 px-6 py-3">
                  <NcTooltip class="max-w-full">
                    <template #title>
                      {{ base.memberCount }}
                    </template>
                    <span>
                      {{ base.memberCount }}
                    </span>
                  </NcTooltip>
                </div>
                <div class="flex-1 flex justify-end px-6 py-2">
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
              </div>
            </NuxtLink>
          </div>
        </div>
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
