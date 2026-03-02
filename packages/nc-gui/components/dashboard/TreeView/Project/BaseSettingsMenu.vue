<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const base = inject(ProjectInj)!

const { isUIAllowed, baseRoles, loadRoles } = useRoles()

const { user } = useGlobal()

const isBaseRolesReady = computed(() => !!user.value?.base_roles)

const resolveBaseId = () => {
  if (route.value.params.baseId) return route.value.params.baseId as string
  if (base.value?.id) return base.value.id

  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolved = basesList.value.find((b) => b.id === lastVisitedBaseId) || basesList.value[0]
  return resolved?.id
}

const navigateToBaseSettings = (page: string) => {
  const baseId = resolveBaseId()
  if (!baseId) return

  const wsId = route.value.params.typeOrId
  const slug = settingsTabToSlug[page] || page
  navigateTo(`/${wsId}/${baseId}/settings/${slug}`)
}

const activeSettingsPage = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  return (route.value.params.page as string) || ''
})

const isSettingsItemActive = (tab: string) => {
  const slug = settingsTabToSlug[tab] || tab
  return activeSettingsPage.value === slug
}

// Load base roles if not already loaded (e.g. when landing directly on a ws-settings page)
onMounted(async () => {
  if (isBaseRolesReady.value) return

  const baseId = resolveBaseId()
  if (!baseId) return

  try {
    await loadRoles(baseId)
  } catch {
    // silently fail — items will stay hidden
  }
})
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-settings-section-header">
      {{ $t('labels.baseSettings') }}
    </div>

    <!-- Loading skeleton -->
    <template v-if="!isBaseRolesReady">
      <div v-for="i in 4" :key="i" class="flex items-center gap-2 h-7 pl-3 pr-1 my-[2px]">
        <a-skeleton-input active size="small" class="flex-1 children:(!rounded-md !h-4)" />
      </div>
    </template>

    <template v-else>
      <NcSidebarMenuItem
        v-if="isUIAllowed('newUser', { roles: baseRoles })"
        v-e="['c:admin:base:add-user']"
        icon="users"
        :active="isSettingsItemActive('collaborator')"
        @click="navigateToBaseSettings('collaborator')"
      >
        {{ $t('labels.addUserToBase') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="isUIAllowed('manageMCP')"
        v-e="['c:admin:base:mcp']"
        icon="mcp"
        :active="isSettingsItemActive('mcp')"
        @click="navigateToBaseSettings('mcp')"
      >
        {{ $t('title.mcpServer') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="isUIAllowed('sourceCreate')"
        v-e="['c:admin:base:add-data-source']"
        icon="ncDatabase"
        :active="isSettingsItemActive('data-source')"
        @click="navigateToBaseSettings('data-source')"
      >
        {{ $t('labels.addDataSource') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-e="['c:admin:base:more']"
        icon="ncMoreHorizontal"
        :active="isSettingsItemActive('base-settings')"
        @click="navigateToBaseSettings('base-settings')"
      >
        {{ $t('general.general') }}
      </NcSidebarMenuItem>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-settings-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
