<script lang="ts" setup>
interface Props {
  /**
   * Modal visibility is based on query params, and will use following method
   * Open - router.push
   * Close - router.back or router.replace (if back history is not available)
   * */
  isOpenUsingRouterPush?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpenUsingRouterPush: false,
})

const { isOpenUsingRouterPush } = toRefs(props)

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()

const { teamsMap, activeWorkspaceId } = storeToRefs(workspaceStore)

const hasEditPermission = computed(() => {
  return isUIAllowed('teamUpdate')
})

const teamId = computed(() => {
  return route.value.name === 'index-typeOrId-settings' && route.value.query?.tab === 'teams'
    ? (route.value.query?.teamId as string)
    : ''
})

const editTeam = computed(() => {
  return teamId.value ? teamsMap.value[teamId.value] : null
})

const vVisible = computed({
  get: () => {
    return !!editTeam.value
  },
  set: (value: boolean) => {
    if (!value) {
      if (isOpenUsingRouterPush.value) {
        router.back()
      } else {
        router.replace({ query: { ...route.value.query, teamId: undefined } })
      }
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
          <GeneralIcon icon="ncBuilding" class="!h-6 !w-6 pl-1" />
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
            <WorkspaceTeamsEditGeneralSection v-model:team="editTeam" :read-only="!hasEditPermission" />
            <WorkspaceTeamsEditMembersSection v-model:team="editTeam" :read-only="!hasEditPermission" @close="vVisible = false" />
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
    @apply px-6 pb-6 nc-scrollbar-thin relative w-full h-full flex flex-col gap-2;

    .nc-modal-teams-edit-content-section {
      @apply flex flex-col gap-4 min-w-[540px] max-w-[720px] mx-auto w-full;
    }
  }
}
</style>
