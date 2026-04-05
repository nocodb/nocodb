<script setup lang="ts">
import type { TeamV3ResponseType } from 'nocodb-sdk'

const { $api } = useNuxtApp()

const $route = useRoute()

const { t } = useI18n()

const orgId = computed(() => $route.params.orgId as string)

const teams = ref<TeamV3ResponseType[]>([])

const isLoading = ref(false)

const searchQuery = ref('')

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
  const q = searchQuery.value.toLowerCase()
  return teams.value.filter((t) => t.title?.toLowerCase().includes(q))
})

onMounted(() => {
  loadTeams()
})
</script>

<template>
  <div class="flex flex-col" data-testid="nc-admin-teams">
    <div class="flex-1 flex flex-col items-center gap-6 p-6">
      <div class="flex flex-col gap-6 w-200">
        <div class="flex justify-between items-center">
          <span class="font-bold text-xl">{{ $t('title.teams') }}</span>
        </div>

        <div class="flex gap-4 items-center">
          <a-input
            v-model:value="searchQuery"
            class="!max-w-90 !rounded-md"
            :placeholder="$t('title.searchMembers')"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>
          <div class="flex-1" />
          <component :is="iconMap.reload" class="cursor-pointer" @click="loadTeams" />
        </div>

        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <a-spin />
        </div>

        <div v-else-if="filteredTeams.length === 0" class="text-nc-content-gray-muted text-sm py-8 text-center">
          {{ searchQuery ? $t('msg.noResultsFound') : $t('msg.info.noTeamsFound') }}
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="team in filteredTeams"
            :key="team.id"
            class="flex items-center gap-3 p-3 rounded-lg border border-nc-border-gray-medium hover:bg-nc-bg-gray-light transition-colors"
          >
            <GeneralTeamIcon v-if="team.icon" :team="team" class="!w-8 !h-8 flex-none" />
            <div v-else class="w-8 h-8 rounded-md bg-nc-bg-brand flex items-center justify-center text-white text-sm font-semibold flex-none">
              {{ team.title?.charAt(0)?.toUpperCase() }}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ team.title }}</span>
                <NcBadge
                  v-if="team.scim_managed"
                  :border="false"
                  color="green"
                  class="text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
                >
                  SCIM
                </NcBadge>
              </div>
              <div class="text-xs text-nc-content-gray-muted">
                {{ team.members_count }} {{ team.members_count === 1 ? $t('objects.member') : $t('objects.members') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
