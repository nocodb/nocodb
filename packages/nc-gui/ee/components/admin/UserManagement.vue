<script lang="ts" setup>
const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Organization')

const organizationStore = useOrganization()

const { fetchOrganizationMembers, listWorkspaces } = organizationStore

const { members } = organizationStore

const searchInput = ref('')

// Used to store the selected Users for the bulk actions
// To be cleared after the action is performed and when search is used, also when page is changed
const selected = reactive<{
  [key: number]: boolean
}>({})
const filteredMembers = computed(() =>
  members.value.filter((member) => (member.display_name || member.email).toLowerCase().includes(searchInput.value.toLowerCase())),
)

const sortedMembers = computed(() => {
  return handleGetSortedData(filteredMembers.value, sorts.value)
})

const toggleSelectAll = (value: boolean) => {
  sortedMembers.value.forEach((_, i) => {
    selected[i] = value
  })
}

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === sortedMembers.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

const isSomeSelected = computed(() => Object.values(selected).some((v) => v))
const bulkAddMemberDlg = ref(false)

const bulkOpsEmails = ref<string[]>([])

const inviteUsersToWorkspace = () => {
  bulkAddMemberDlg.value = true
}

const inviteUserToWorkspace = (email: string) => {
  bulkOpsEmails.value = [email]
  bulkAddMemberDlg.value = true
}

watch(bulkAddMemberDlg, (val) => {
  if (!val) {
    bulkOpsEmails.value = []
    fetchOrganizationMembers()
  }
})

onMounted(() => {
  fetchOrganizationMembers()
  listWorkspaces()
  loadSorts()
})

watch(selected, () => {
  bulkOpsEmails.value = sortedMembers.value.filter((_collab, i) => selected[i]).map((collab) => collab.email)
})
</script>

<template>
  <div class="flex flex-col items-center" data-test-id="nc-admin-members">
    <LazyDlgInviteDlg v-model:model-value="bulkAddMemberDlg" :emails="bulkOpsEmails" type="organization" />
    <div class="flex flex-col w-full px-6 max-w-[97.5rem]">
      <span class="font-bold w-full text-2xl" data-rec="true">
        {{ $t('labels.members') }}
      </span>
      <div class="w-full justify-between mt-5 flex items-center">
        <div class="flex items-center gap-2">
          <a-input v-model:value="searchInput" placeholder="Search for a member">
            <template #prefix>
              <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
            </template>
          </a-input>
          <NcDropdown>
            <NcButton :disabled="!isSomeSelected">
              <div class="flex gap-2 items-center">
                <component :is="iconMap.threeDotVertical" />
                {{ $t('labels.action') }}
              </div>
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem @click="inviteUsersToWorkspace">
                  <GeneralIcon class="text-gray-800" icon="email" />
                  <span>{{ $t('labels.inviteUsersToWorkspace') }}</span>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>

        <NcButton @click="bulkAddMemberDlg = true">
          <component :is="iconMap.plus" />
          {{ $t('activity.addMembers') }}
        </NcButton>
      </div>

      <div class="mt-5 h-full" data-testid="nc-org-members-list">
        <div class="flex flex-col overflow-hidden border-b-1 min-h-[calc(100%-8rem)]">
          <div class="flex flex-row bg-gray-50 max-h-11 items-center border-b-1">
            <div class="py-3 px-6"><NcCheckbox v-model:checked="selectAll" /></div>
            <LazyAccountHeaderWithSorter
              class="text-gray-700 w-[25rem] users-email-grid flex items-center space-x-2 cursor-pointer"
              :header="$t('objects.member')"
              :active-sort="sorts"
              field="email"
              :toggle-sort="toggleSort"
            />

            <LazyAccountHeaderWithSorter
              :active-sort="sorts"
              :header="$t('objects.workspaces')"
              :toggle-sort="toggleSort"
              class="text-gray-700 w-full flex-1 px-6 py-3 flex items-center space-x-2"
              field="workspaceCount"
            />
            <div class="text-gray-700 w-full flex-1 px-6 py-3">{{ $t('labels.dateAdded') }}</div>
            <div class="text-gray-700 w-full flex-1 px-6 py-3">{{ $t('labels.lastActive') }}</div>
            <div class="text-gray-700 w-full flex-1 px-6 text-right py-3">{{ $t('labels.actions') }}</div>
          </div>
          <div class="flex flex-col nc-scrollbar-md">
            <div
              v-for="(member, i) of sortedMembers"
              :key="i"
              :class="{
                'bg-[#F0F3FF]': selected[i],
              }"
              class="user-row flex hover:bg-[#F0F3FF] !max-h-13.5 flex-row last:border-b-0 border-b-1 py-1 items-center"
            >
              <div class="py-3 px-6">
                <NcCheckbox v-model:checked="selected[i]" />
              </div>

              <div class="flex gap-3 w-[25rem] items-center users-email-grid">
                <GeneralUserIcon :email="member?.email" size="base" />
                <div class="flex flex-col">
                  <div class="flex gap-3">
                    <span class="text-gray-800 font-semibold">
                      {{ member.display_name || member.email.split('@')[0] }}
                    </span>
                    <RolesBadge v-if="member.cloud_org_roles" :border="false" :role="member.cloud_org_roles" :show-icon="false" />
                  </div>
                  <span class="text-xs text-gray-600">
                    {{ member.email }}
                  </span>
                </div>
              </div>

              <div class="w-full flex-1 px-6 py-3">
                <NcDropdown :trigger="['hover']">
                  <span>
                    {{ member.workspaceCount }}
                  </span>

                  <template #overlay>
                    <div class="rounded-lg">
                      <div class="rounded-t-lg font-medium bg-gray-100 py-1.5 px-2">
                        {{ $t('labels.memberIn') }}
                      </div>
                      <div class="max-h-72 nc-scrollbar-md overflow-y-auto">
                        <div
                          v-for="x in member.workspaces"
                          :key="x.id"
                          class="flex gap-3 px-2 py-3 w-72 justify-between font-semibold items-center"
                        >
                          <div class="flex gap-3">
                            <!--
                            <GeneralWorkspaceIcon :workspace="x" hide-label />
-->
                            {{ x.title }}
                          </div>

                          <RolesBadge :border="false" :show-icon="true" icon-only role="owner" />
                        </div>
                      </div>
                    </div>
                  </template>
                </NcDropdown>
              </div>
              <div class="w-full flex-1 px-6 py-3">
                <NcTooltip class="max-w-full">
                  <template #title>
                    {{ parseStringDateTime(member?.created_at) }}
                  </template>
                  <span>
                    {{ timeAgo(member?.created_at) }}
                  </span>
                </NcTooltip>
              </div>
              <div class="w-full flex-1 px-6 py-3">
                <NcTooltip class="max-w-full">
                  <template #title>
                    {{ parseStringDateTime(member?.created_at) }}
                  </template>
                  <span>
                    {{ timeAgo(member?.created_at) }}
                  </span>
                </NcTooltip>
              </div>
              <div class="w-full flex-1 flex justify-end px-6 py-3">
                <NcDropdown>
                  <NcButton size="small" type="secondary">
                    <component :is="iconMap.threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu>
                      <NcMenuItem data-testid="nc-admin-org-user-assign-admin" @click="inviteUserToWorkspace(member.email)">
                        <GeneralIcon class="text-gray-800" icon="send" />
                        <span>{{ $t('activity.inviteToWorkspace') }}</span>
                      </NcMenuItem>

                      <!--                      <NcMenuItem data-testid="nc-admin-org-user-delete">
                        <GeneralIcon class="text-gray-800" icon="signout" />
                        <span>{{ $t('labels.signOutUser') }}</span>
                      </NcMenuItem>

                      <a-menu-divider class="my-1.5" />

                      <NcMenuItem class="!hover:bg-red-50" data-testid="nc-admin-org-user-delete">
                        <div class="text-red-500">
                          <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="delete" />
                          {{ $t('labels.deactivateUser') }}
                        </div>
                      </NcMenuItem> -->
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </div>
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
