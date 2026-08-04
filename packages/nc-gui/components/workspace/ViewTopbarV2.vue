<script lang="ts" setup>
const router = useRouter()

const route = router.currentRoute

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

const { commandPalette } = useCommandPalette()

const { isBaseListAllLoading, loadBaseListAll } = useWsBaseListAll()

const searchQuery = useState<string>('ws-home-search', () => '')

const workspaceTitle = computed(() => {
  if (isEeUI) return activeWorkspace.value?.title
  return 'Default Workspace'
})

const activeTabKey = computed(() => {
  if (isWsAdminRoute(route.value)) return 'admin'

  return routeNameToWsTab[route.value.name as string] || 'bases'
})

const activeTabLabel = computed(() => {
  switch (activeTabKey.value) {
    case 'collaborators':
      return t('labels.members')
    case 'teams':
      return t('general.teams')
    case 'integrations':
      return t('general.integrations')
    case 'admin':
      return t('labels.admin')
    default:
      return t('objects.projects')
  }
})

function navigateToBases() {
  const typeOrId = route.value.params.typeOrId || activeWorkspaceId.value || 'nc'

  router.push({ name: 'index-typeOrId', params: { typeOrId } })
}

function onWorkspaceCrumbClick() {
  if (activeTabKey.value === 'bases') return

  navigateToBases()
}

function openCommandPalette() {
  commandPalette.value?.open()
}

// Searching is only meaningful on the bases page — jump there when the user starts typing
watch(searchQuery, (value) => {
  if (value && activeTabKey.value !== 'bases') {
    navigateToBases()
  }
})

onMounted(() => {
  if (isEeUI) {
    loadBaseListAll()
  }
})
</script>

<template>
  <div class="flex items-center gap-2 px-2 sm:px-4 h-[var(--topbar-height)] flex-none border-b-1 border-nc-border-gray-medium">
    <div class="flex-1 flex items-center gap-2 min-w-0">
      <GeneralOpenLeftSidebarBtn />
      <div class="flex items-center gap-1.5 min-w-0 text-bodyDefaultSm" data-testid="nc-ws-home-topbar-breadcrumb">
        <span
          class="text-nc-content-gray-muted capitalize truncate"
          :class="{ 'cursor-pointer hover:text-nc-content-gray': activeTabKey !== 'bases' }"
          data-testid="nc-ws-home-topbar-title"
          @click="onWorkspaceCrumbClick"
        >
          {{ workspaceTitle }}
        </span>
        <span class="text-nc-content-gray-muted">/</span>
        <span class="text-bodyDefaultSmBold text-nc-content-gray truncate">{{ activeTabLabel }}</span>
      </div>
    </div>

    <!-- Centered search -->
    <div v-if="!isMobileMode" class="flex-none w-full max-w-[420px]">
      <a-input
        v-model:value="searchQuery"
        type="text"
        class="nc-input-border-on-value nc-ws-home-search !h-8 !pl-1.5 !pr-1 !py-1 !rounded-lg"
        :placeholder="$t('placeholder.searchBasesInWorkspace', { workspace: workspaceTitle })"
        data-testid="nc-ws-home-topbar-search"
        allow-clear
        @keydown.stop
      >
        <template #prefix>
          <div class="flex items-center gap-1 mr-1">
            <GeneralLoader v-if="isBaseListAllLoading" size="regular" class="h-4 w-4" />
            <GeneralIcon v-else icon="search" class="h-4 w-4 text-nc-content-gray-muted" />
          </div>
        </template>
        <template #suffix>
          <div
            class="px-1 text-bodySmBold text-nc-content-gray-subtle bg-nc-bg-gray-medium rounded cursor-pointer"
            @click="openCommandPalette"
          >
            {{ renderCmdOrCtrlKey(true) }} K
          </div>
        </template>
      </a-input>
    </div>

    <div class="flex-1 hidden sm:block"></div>
  </div>
</template>

<style lang="scss" scoped></style>
