<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { basesList } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const base = inject(ProjectInj)!

const baseRole = inject(ProjectRoleInj)!

const { isMobileMode } = useGlobal()

const { isUIAllowed, baseRoles, loadRoles } = useRoles()

const { showUpgradeToUseTableAndFieldPermissions, showUpgradeToUseSync } = useEeConfig()

const resolveBaseId = () => {
  if (route.value.params.baseId) return route.value.params.baseId as string
  if (base.value?.id) return base.value.id

  const lastVisitedBaseId = ncLastVisitedBase().get()
  const resolved = basesList.value.find((b) => b.id === lastVisitedBaseId) || basesList.value[0]
  return resolved?.id
}

const navigateToBaseSettings = (page: string) => {
  if (page === 'permissions' && showUpgradeToUseTableAndFieldPermissions()) return
  if (page === 'syncs' && showUpgradeToUseSync()) return

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

// Use injected base role for immediate permission checks; load full roles in background
const effectiveRoles = computed(() => baseRoles.value ?? baseRole.value)

// Load base roles in background if not already loaded
onMounted(() => {
  const baseId = resolveBaseId()
  if (baseId) {
    loadRoles(baseId).catch(() => {})
  }
})
</script>

<template>
  <div class="nc-project-home-section">
    <div class="nc-settings-section-header">
      {{ $t('labels.baseSettings') }}
    </div>
    <NcSidebarMenuItem
      v-if="isUIAllowed('newUser', { roles: effectiveRoles })"
      v-e="['c:settings:base:add-user']"
      icon="users"
      :active="isSettingsItemActive('collaborator')"
      @click="navigateToBaseSettings('collaborator')"
    >
      {{ $t('labels.addUserToBase') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:permissions']"
      icon="ncLock"
      :active="isSettingsItemActive('permissions')"
      @click="navigateToBaseSettings('permissions')"
    >
      {{ $t('labels.dataPermissions') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('manageMCP', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:mcp']"
      icon="mcp"
      :active="isSettingsItemActive('mcp')"
      @click="navigateToBaseSettings('mcp')"
    >
      {{ $t('title.mcpServer') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:syncs']"
      icon="ncZap"
      :active="isSettingsItemActive('syncs')"
      @click="navigateToBaseSettings('syncs')"
    >
      {{ $t('labels.manageSyncs') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('baseMiscSettings', { roles: effectiveRoles }) && isUIAllowed('manageSnapshot', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:snapshots']"
      icon="camera"
      :active="isSettingsItemActive('snapshots')"
      @click="navigateToBaseSettings('snapshots')"
    >
      {{ $t('labels.manageSnapshots') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:add-data-source']"
      icon="ncDatabase"
      :active="isSettingsItemActive('data-source')"
      @click="navigateToBaseSettings('data-source')"
    >
      {{ $t('labels.addDataSource') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="!isMobileMode"
      v-e="['c:settings:base:more']"
      icon="ncMoreHorizontal"
      :active="isSettingsItemActive('base-settings')"
      @click="navigateToBaseSettings('base-settings')"
    >
      {{ $t('general.general') }}
    </NcSidebarMenuItem>
  </div>
</template>

<style lang="scss" scoped>
.nc-settings-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
