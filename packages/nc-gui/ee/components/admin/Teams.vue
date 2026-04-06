<script setup lang="ts">
import type { TeamV3ResponseType } from 'nocodb-sdk'

const { $api } = useNuxtApp()

const $route = useRoute()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const orgId = computed(() => $route.params.orgId as string)

const teams = ref<TeamV3ResponseType[]>([])

const isLoading = ref(false)

const searchQuery = ref('')

const isCreateModalVisible = ref(false)

const newTeamTitle = ref('')

const isCreating = ref(false)

const inputEl = ref<HTMLInputElement>()

const { showConfirmModal } = useNcConfirmModal()

const loadTeams = async () => {
  if (!orgId.value) return

  try {
    isLoading.value = true
    const response = await $api.instance.get(`/api/v3/meta/workspaces/${orgId.value}/teams`)
    teams.value = (response.data?.list || []).filter((t: TeamV3ResponseType) => t.scope === 'org')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const filteredTeams = computed(() => {
  if (!searchQuery.value) return teams.value
  return teams.value.filter((t) => searchCompare([t.title], searchQuery.value))
})

const columns = computed(() => [
  {
    key: 'teamName',
    title: t('objects.team'),
    width: 400,
    showOrderBy: false,
  },
  {
    key: 'members',
    title: t('objects.members'),
    width: 120,
    showOrderBy: false,
  },
  {
    key: 'actions',
    title: '',
    width: 64,
    showOrderBy: false,
    align: 'right',
  },
])

const handleCreateTeam = () => {
  newTeamTitle.value = generateUniqueTitle('Team', teams.value ?? [], 'title', '-', true)
  isCreateModalVisible.value = true
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

const createTeam = async () => {
  if (!newTeamTitle.value.trim() || !orgId.value || isCreating.value) return

  try {
    isCreating.value = true
    await $api.instance.post(`/api/v3/meta/workspaces/${orgId.value}/teams`, {
      title: newTeamTitle.value.trim(),
    })
    isCreateModalVisible.value = false
    newTeamTitle.value = ''
    await loadTeams()
    message.success(t('msg.success.teamCreated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      isCreating.value = false
    }, 500)
  }
}

const confirmDeleteTeam = (team: TeamV3ResponseType) => {
  showConfirmModal({
    title: t('objects.teams.confirmDeleteTeamTitle'),
    content: t('objects.teams.confirmDeleteTeamSubtitle'),
    okCallback: async () => {
      try {
        await $api.instance.delete(`/api/v3/meta/workspaces/${orgId.value}/teams/${team.id}`)
        await loadTeams()
        message.success(t('msg.success.teamDeleted'))
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

onMounted(() => {
  loadTeams()
})
</script>

<template>
  <div
    class="nc-teams-container overflow-auto nc-scrollbar-thin relative h-[calc(100vh-144px)]"
    data-testid="nc-admin-teams"
  >
    <div class="nc-teams-wrapper h-full max-w-[1200px] mx-auto p-4 md:p-6 flex flex-col gap-6 sticky top-0">
      <div class="w-full flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a-input
            v-model:value="searchQuery"
            allow-clear
            :disabled="isLoading"
            class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
            :placeholder="$t('title.searchTeams')"
          >
            <template #prefix>
              <GeneralIcon
                icon="search"
                class="mr-2 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme"
              />
            </template>
          </a-input>
        </div>

        <NcButton
          size="small"
          inner-class="!gap-2"
          :disabled="isLoading"
          data-testid="nc-admin-teams-create"
          class="capitalize"
          :icon-only="isMobileMode"
          @click="handleCreateTeam()"
        >
          <template #icon>
            <GeneralIcon icon="plus" class="h-4 w-4" />
          </template>
          <span class="xs:hidden">
            {{ $t('labels.newTeam') }}
          </span>
        </NcButton>
      </div>

      <NcTable
        :columns="columns"
        :data="filteredTeams"
        :is-data-loading="isLoading"
        :bordered="false"
        class="flex-1 nc-teams-list"
        :pagination="true"
        :pagination-offset="25"
      >
        <template #emptyText>
          <NcEmptyPlaceholder
            :title="teams.length ? '' : $t('msg.info.noTeamsFound')"
            :subtitle="teams.length ? $t('title.noResultsMatchedYourSearch') : ''"
          >
            <template #icon>
              <img
                v-if="!teams.length"
                src="~assets/img/placeholder/moscot-collaborators.png"
                alt="New Team"
                class="!w-[320px] flex-none"
              />
              <img
                v-else
                src="~assets/img/placeholder/no-search-result-found.png"
                alt="No search results found"
                class="!w-[320px] flex-none"
              />
            </template>
            <template #action>
              <NcButton size="small" inner-class="!gap-2" class="capitalize" @click="handleCreateTeam()">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.newTeam') }}
              </NcButton>
            </template>
          </NcEmptyPlaceholder>
        </template>

        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'teamName'" class="flex items-center gap-1">
            <GeneralTeamInfo :team="record" :icon-props="{ size: 'base', wrapperClass: '!rounded-lg' }" />
            <NcBadge
              v-if="record.scim_managed"
              :border="false"
              color="green"
              class="text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
            >
              SCIM
            </NcBadge>
          </div>

          <div v-if="column.key === 'members'" class="text-nc-content-gray-muted">
            {{ record.members_count ?? 0 }}
          </div>

          <div v-if="column.key === 'actions'" class="flex items-center justify-end">
            <NcDropdown v-if="!record.scim_managed">
              <NcButton size="xsmall" type="text" class="!px-1">
                <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-muted" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="confirmDeleteTeam(record)">
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

    <!-- Create Team Modal — matches workspace-level Create.vue style -->
    <NcModal
      v-model:visible="isCreateModalVisible"
      :header="$t('labels.newTeam')"
      size="xs"
      height="auto"
      :centered="false"
      nc-modal-class-name="!p-0"
      class="!top-[25vh]"
      :mask-closable="!isCreating"
      wrap-class-name="nc-modal-team-create-wrapper"
    >
      <div class="py-4 md:py-5 flex flex-col gap-5">
        <div class="px-4 md:px-5 flex justify-between w-full items-center">
          <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray capitalize">
            <GeneralIcon icon="ncBuilding" class="!text-nc-content-gray-subtle2 w-5 h-5" />
            {{ $t('labels.newTeam') }}
          </div>
        </div>

        <a-form
          layout="vertical"
          name="create-new-org-team-form"
          class="flex flex-col gap-5 !px-4 md:!px-5"
          @keydown.enter="createTeam"
          @keydown.esc="isCreateModalVisible = false"
        >
          <a-form-item class="!mb-0">
            <a-input
              ref="inputEl"
              v-model:value="newTeamTitle"
              class="nc-team-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="nc-admin-teams-create-input"
              :placeholder="$t('placeholder.enterTeamName')"
            />
          </a-form-item>

          <div class="flex flex-row items-center justify-end gap-x-2">
            <NcButton type="secondary" size="small" :disabled="isCreating" @click="isCreateModalVisible = false">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton
              v-e="['a:org-team:create']"
              type="primary"
              size="small"
              :disabled="!newTeamTitle.trim() || isCreating"
              :loading="isCreating"
              class="capitalize"
              data-testid="nc-admin-teams-create-submit"
              @click="createTeam"
            >
              {{ $t('labels.createTeam') }}
              <template #loading> {{ $t('labels.creatingTeam') }} </template>
            </NcButton>
          </div>
        </a-form>
      </div>
    </NcModal>
  </div>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}
</style>
