<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const workspaceStore = useWorkspace()

const { teamsMap } = storeToRefs(workspaceStore)

const editTeam = computed(() => {
  const teamId =
    route.value.name === 'index-typeOrId-settings' && route.value.query?.tab === 'teams'
      ? (route.value.query?.teamId as string)
      : ''

  return teamId ? teamsMap.value[teamId] : null
})

const vVisible = computed({
  get: () => {
    return !!editTeam.value
  },
  set: (value: boolean) => {
    if (!value) {
      router.replace({ query: { ...route.value.query, teamId: undefined } })
    }
  },
})

/**
 * Todo: @rameshmane7218 update doc links
 */
const supportedDocs: SupportedDocsType[] = [
  {
    title: 'Creating and Managing Teams',
    href: '',
  },
  {
    title: 'Understanding Team Roles',
    href: '',
  },
  {
    title: 'Inviting Members to a Team',
    href: '',
  },
  {
    title: 'Team Permissions',
    href: '',
  },
]
</script>

<template>
  <NcModal v-model:visible="vVisible" :header="false" size="large" :show-separator="false" wrap-class-name="nc-modal-teams">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="p-2 w-full flex items-center gap-3 border-b-1 border-nc-border-gray-medium">
        <div class="flex items-center">
          <GeneralIcon icon="table" class="!h-6 !w-6 pl-1" />
        </div>
        <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">Team: {{ editTeam?.title }}</div>

        <div class="flex items-center gap-3">
          <NcButton size="small" type="text" @click="vVisible = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>

      <div class="h-[calc(100%_-_50px)] flex">
        <!-- Content -->
        <div class="flex-1 nc-modal-teams-edit-content">
          <template v-if="editTeam">
            <WorkspaceTeamsEditGeneralSection :team="editTeam" />
            <WorkspaceTeamsEditMembersSection :team="editTeam" />
          </template>
        </div>

        <NcModalSupportedDocsSidebar>
          <NcModalSupportedDocs :docs="supportedDocs" />
        </NcModalSupportedDocsSidebar>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-teams {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-teams-edit-content {
    @apply px-6 pb-6 nc-scrollbar-thin relative w-full h-full flex flex-col gap-8;

    .nc-modal-teams-edit-content-section {
      @apply flex flex-col gap-4 min-w-[540px] mx-auto w-full;
    }
  }
}
</style>
