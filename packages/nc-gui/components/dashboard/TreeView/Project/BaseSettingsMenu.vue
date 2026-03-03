<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { resolvedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab } = storeToRefs(sidebarStore)

const { isSharedBase } = storeToRefs(useBase())

const base = inject(ProjectInj)!

const baseRole = inject(ProjectRoleInj)!

const { isMobileMode } = useGlobal()

const { isUIAllowed, baseRoles, loadRoles } = useRoles()

const { isWsAuditEnabled, showUpgradeToUseTableAndFieldPermissions, showUpgradeToUseSync, isEEFeatureBlocked } = useEeConfig()

const navigateToBaseSettings = (page: string) => {
  if (page === 'permissions' && showUpgradeToUseTableAndFieldPermissions()) return
  if (page === 'syncs' && showUpgradeToUseSync()) return

  const baseId = resolvedProject.value?.id
  if (!baseId) return

  const wsId = route.value.params.typeOrId
  const slug = settingsTabToSlug[page] || page
  navigateTo(`/${wsId}/${baseId}/settings/${slug}`)
}

const activeBaseSettingsTab = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  const page = route.value.params.page as string
  return page ? baseSettingsSlugToTab[page] || '' : ''
})

// Use injected base role for immediate permission checks; load full roles in background
const effectiveRoles = computed(() => baseRoles.value ?? baseRole.value)

// Load base roles in background if not already loaded
onMounted(() => {
  const baseId = resolvedProject.value?.id
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
      data-testid="base-collaborator"
      :active="activeBaseSettingsTab === 'collaborator'"
      @click="navigateToBaseSettings('collaborator')"
    >
      {{ $t('labels.addUserToBase') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:permissions']"
      icon="ncLock"
      data-testid="base-permissions"
      :active="activeBaseSettingsTab === 'permissions'"
      @click="navigateToBaseSettings('permissions')"
    >
      {{ $t('labels.dataPermissions') }}
      <template #extraRight>
        <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS" remove-click />
      </template>
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:add-data-source']"
      icon="ncDatabase"
      data-testid="base-data-source"
      :active="activeBaseSettingsTab === 'data-source'"
      @click="navigateToBaseSettings('data-source')"
    >
      {{ $t('labels.addDataSource') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:syncs']"
      icon="ncZap"
      data-testid="base-syncs"
      :active="activeBaseSettingsTab === 'syncs'"
      @click="navigateToBaseSettings('syncs')"
    >
      {{ $t('labels.manageSyncs') }}
      <template #extraRight>
        <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_SYNC" remove-click />
      </template>
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isEeUI && isUIAllowed('baseAuditList', { roles: effectiveRoles }) && isWsAuditEnabled && !isMobileMode"
      v-e="['c:settings:base:audits']"
      icon="audit"
      data-testid="base-audit"
      :active="activeBaseSettingsTab === 'audit'"
      @click="navigateToBaseSettings('audit')"
    >
      {{ $t('title.audits') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="isUIAllowed('manageMCP', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:mcp']"
      icon="mcp"
      data-testid="base-mcp"
      :active="activeBaseSettingsTab === 'mcp'"
      @click="navigateToBaseSettings('mcp')"
    >
      {{ $t('title.mcpServer') }}
    </NcSidebarMenuItem>
    <NcSidebarMenuItem
      v-if="
        isEeUI &&
        isUIAllowed('baseMiscSettings', { roles: effectiveRoles }) &&
        isUIAllowed('manageSnapshot', { roles: effectiveRoles }) &&
        !isMobileMode
      "
      v-e="['c:settings:base:snapshots']"
      icon="camera"
      data-testid="base-snapshots"
      :active="activeBaseSettingsTab === 'snapshots'"
      @click="navigateToBaseSettings('snapshots')"
    >
      {{ $t('labels.manageSnapshots') }}
    </NcSidebarMenuItem>

    <NcSidebarMenuItem
      v-if="!isSharedBase && isUIAllowed('baseMiscSettings', { roles: effectiveRoles }) && !isMobileMode"
      v-e="['c:settings:base:more']"
      icon="ncMoreHorizontal"
      data-testid="base-settings"
      :active="activeBaseSettingsTab === 'base-settings'"
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
