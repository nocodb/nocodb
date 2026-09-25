<script lang="ts" setup>
import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'

// Base settings as a modal shell — the same anatomy the table Tools shell uses
// (`components/smartsheet/Details.vue`): a nav rail on the left, and a content
// column of header band → pane → unified save bar.
//
// Route-driven, like Tools, but through `?settings={slug}` rather than a path of
// its own: settings is a thing you open *over* your work, so the table or view
// you were on stays mounted underneath and closing puts you back on it with no
// reload. The rail switches panes by replacing the query value, so deep links and
// the back button keep working. `/{ws}/{base}/settings/{slug}` still resolves —
// those pages redirect here.

const props = defineProps<{
  /** Internal tab name, already resolved from the URL slug by the route page. */
  tab: string
}>()

const router = useRouter()

const route = router.currentRoute

const { $e } = useNuxtApp()

const { isBaseRolesLoaded } = useRoles()

const { isMobileMode } = useGlobal()

const { base } = storeToRefs(useBase())

// Panes were built as tabs of the settings page and still watch this to know
// they became active — Data Sources only loads its list when it reads
// 'data-source' here. Written synchronously below, before any pane mounts.
const { projectPageTab } = storeToRefs(useConfigStore())

const {
  navGroups,
  paneMeta,
  availableTabs,
  firstAvailableTab,
  blockSync,
  blockBaseVariables,
  blockTrashSettings,
  blockSnapshotsPane,
} = useBaseSettingsNav()

// The shell's unified save-bar contract. Editing panes register their
// dirty/save/reset; the bar shows only then.
const { hasSaveBar, goBack, setCrumb } = useProvideShell()

// Panes were built for the settings sidebar page and read this to shed their
// own page chrome. The shell is that host now.
provide(IsSettingsSidebarInj, ref(true))

// Docs permissions is its own route slug (an old deep link) but not its own rail
// row — it is the second tab inside the Data Permissions pane.
const railActive = computed(() => (props.tab === 'docs-permissions' ? 'permissions' : props.tab))

const meta = computed(() => paneMeta.value[props.tab] ?? paneMeta.value[railActive.value])

const baseId = computed(() => base.value?.id)

/**
 * The rail's reachable set is the pane's gate too.
 *
 * Panes load on mount, so a pane the reader cannot reach must never mount —
 * bouncing it afterwards is a round of 403s too late. That also covers the case
 * the bounce below cannot: with nothing reachable at all, `firstAvailableTab`
 * falls back to `collaborator`, and the bounce to a tab we are already on is a
 * no-op.
 */
const isPaneAllowed = computed(() => isBaseRolesLoaded.value && availableTabs.value.has(railActive.value))

/**
 * A phone has no room for rail and pane at once, so it shows one at a time: the
 * rail is the list, picking a row pushes its pane over it, and back returns.
 * On a wide screen both are always up and this stays false.
 */
const isRailOnlyOnMobile = ref(true)

function goToTab(tab: string) {
  isRailOnlyOnMobile.value = false

  if (tab === props.tab) return

  navigateTo({ query: { ...route.value.query, settings: settingsTabToSlug[tab] || tab } })
}

const showRail = computed(() => !isMobileMode.value || isRailOnlyOnMobile.value)

const showPane = computed(() => !isMobileMode.value || !isRailOnlyOnMobile.value)

function onClose() {
  const query = { ...route.value.query }
  delete query.settings

  navigateTo({ query })
}

// Escape and a mask click unwind a pane's drill-in first; the header's × always
// closes outright.
function onVisibleChange(visible: boolean) {
  if (visible) return

  if (goBack()) return

  // On a phone, stepping out of a pane lands on the rail rather than leaving.
  if (isMobileMode.value && !isRailOnlyOnMobile.value) {
    isRailOnlyOnMobile.value = true
    return
  }

  onClose()
}

function onGroupToggle(key: string, open: boolean) {
  $e('c:settings:base:group-toggle', { group: key, open })
}

watch(
  () => props.tab,
  (tab) => {
    projectPageTab.value = tab as ProjectPageType

    // Cleared here, not on pane unmount: the incoming pane mounts before the outgoing one unmounts.
    setCrumb(null)
  },
  { immediate: true },
)

// The General pane's inner tabs are rail rows now; old links carried them as `?tab=`.
const legacyGeneralTabs: Record<string, string> = {
  baseType: 'base-type',
  visibility: 'data-display',
  migrateToV3: 'migrate-to-v3',
  migrate: 'migrate',
}

const generalRows = ['base-type', 'data-display', 'migrate-to-v3', 'migrate']

watch(
  [() => props.tab, isBaseRolesLoaded],
  async () => {
    if (!isBaseRolesLoaded.value) return

    if (props.tab === 'base-settings') {
      const wanted = legacyGeneralTabs[route.value.query.tab as string]
      const target = [wanted, ...generalRows].find((slug) => slug && availableTabs.value.has(slug))

      const query = { ...route.value.query }
      delete query.tab

      // After the tick: this shell mounts as part of the navigation that brought
      // `?settings=settings` in, and replacing the route while that one is still
      // landing loses the rewrite — the address bar snaps back to the legacy path
      // and the overlay unmounts with it.
      await nextTick()

      navigateTo({ query: { ...query, settings: target ?? settingsTabToSlug[firstAvailableTab.value] } }, { replace: true })
      return
    }

    // A reader with no reachable pane has no settings to be in — a shared-base
    // visitor, or a base viewer on mobile, where every row but Members carries a
    // `!isMobileMode` gate. Closing beats sitting on an empty rail.
    if (!availableTabs.value.size) {
      onClose()
      return
    }

    // Bounce a deep link this role, edition or plan cannot reach — including the
    // docs-permissions slug, which rides on the Data Permissions row.
    if (!availableTabs.value.has(railActive.value)) {
      goToTab(firstAvailableTab.value)
      return
    }

    $e(`a:project:view:tab-change:${props.tab}`)
  },
  { immediate: true },
)
</script>

<template>
  <NcModal
    :visible="true"
    :size="isMobileMode ? 'fullscreen' : 'xl'"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-base-settings"
    @update:visible="onVisibleChange"
  >
    <div class="nc-base-settings relative flex h-full w-full" data-testid="nc-base-settings-wrapper">
      <ShellBack v-if="isMobileMode && !isRailOnlyOnMobile" testid="nc-base-settings-back" @back="isRailOnlyOnMobile = true" />

      <ShellClose testid="nc-base-settings-close" @close="onClose" />

      <ShellRail
        v-if="showRail"
        :full-width="isMobileMode"
        :groups="navGroups"
        :active="railActive"
        :search-placeholder="$t('labels.baseNav.searchPlaceholder')"
        empty-text="labels.baseNav.searchEmpty"
        testid-prefix="nc-settings-rail"
        event-prefix="c:settings:base:"
        @select="goToTab"
        @group-toggle="onGroupToggle"
      >
        <template v-if="base" #subject>
          <GeneralProjectIcon
            :color="parseProp(base.meta).iconColor"
            :icon="parseProp(base.meta).icon"
            :type="base.type"
            :managed-app="{ managed_app_master: base.managed_app_master, managed_app_id: base.managed_app_id }"
            class="!h-4 !w-4 flex-none"
          />
          <NcTooltip show-on-truncate-only class="truncate">{{ base.title }}</NcTooltip>
        </template>
      </ShellRail>

      <div v-if="showPane" class="flex-1 flex flex-col min-w-0 min-h-0">
        <ShellHeader
          :title="meta?.title ?? ''"
          :description="meta?.description"
          :docs-href="meta?.docsHref"
          :leading-inset="isMobileMode"
        />

        <div v-if="!isPaneAllowed" class="flex-1 min-h-0 flex items-center justify-center">
          <GeneralLoader size="xlarge" />
        </div>

        <div v-else class="flex-1 min-h-0">
          <ProjectAccessSettings v-if="tab === 'collaborator'" :base-id="baseId" />

          <ProjectInterfaceMembers v-else-if="tab === 'interface-members'" />

          <ProjectWorkflowsList v-else-if="tab === 'workflows' && baseId" :base-id="baseId" />

          <DashboardSettingsDataPermissions
            v-else-if="(tab === 'permissions' || tab === 'docs-permissions') && baseId"
            :base-id="baseId"
            :initial-tab="tab === 'docs-permissions' ? 'docs' : 'tables'"
          />

          <DashboardSettingsDataSources v-else-if="tab === 'data-source' && baseId" :base-id="baseId" class="max-h-full" />

          <DashboardSettingsBaseIntegrations v-else-if="tab === 'integrations' && baseId" :base-id="baseId" />

          <template v-else-if="tab === 'syncs' && baseId">
            <div v-if="blockSync" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_SYNC"
                :title="$t('labels.baseNav.upgradeTitleSync')"
                :detail="$t('labels.baseNav.upgradeDescSync')"
                icon="ncZap"
              />
            </div>
            <ProjectSync v-else :base-id="baseId" class="max-h-full" />
          </template>

          <WorkspaceAudits v-else-if="tab === 'audits' && baseId" :base-id="baseId" />

          <!-- Height-bounded so the pane's own overflow-auto has something to
               resolve h-full against; padding stays inside the pane. -->
          <div v-else-if="tab === 'mcp' && baseId" class="h-full max-h-full">
            <DashboardSettingsBaseMCP :base-id="baseId" />
          </div>

          <div v-else-if="tab === 'api-tokens' && baseId" class="h-full max-h-full">
            <DashboardSettingsBaseApiTokens :base-id="baseId" />
          </div>

          <template v-else-if="tab === 'variables'">
            <div v-if="blockBaseVariables" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
                :title="$t('labels.baseNav.upgradeTitleVariables')"
                :detail="$t('labels.baseNav.upgradeDescVariables')"
                icon="ncCode"
              />
            </div>
            <DashboardSettingsBaseVariables v-else />
          </template>

          <DashboardSettingsBaseSkills v-else-if="tab === 'skills'" />

          <template v-else-if="tab === 'record-trash'">
            <div v-if="blockTrashSettings" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_TRASH_SETTINGS"
                :title="$t('labels.baseNav.upgradeTitleTrashRetention')"
                :detail="$t('labels.baseNav.upgradeDescTrashRetention')"
                icon="ncHistory"
              />
            </div>
            <DashboardSettingsBaseTrash v-else />
          </template>

          <template v-else-if="tab === 'snapshots'">
            <div v-if="blockSnapshotsPane" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE"
                :title="$t('labels.baseNav.upgradeTitleSnapshots')"
                :detail="$t('labels.baseNav.upgradeDescSnapshots')"
                icon="ncLayers"
              />
            </div>
            <DashboardSettingsBaseSnapshots v-else />
          </template>

          <DashboardSettingsBaseAccess v-else-if="tab === 'base-type'" />

          <DashboardSettingsBaseVisibility v-else-if="tab === 'data-display'" />

          <DashboardSettingsBaseMigrateToV3 v-else-if="tab === 'migrate-to-v3'" />

          <DashboardSettingsBaseMigrate v-else-if="tab === 'migrate'" />

          <ProjectAppSettings v-else-if="tab.startsWith('app-')" :tab="tab" class="h-full max-h-full" />
        </div>

        <ShellSaveBar v-if="hasSaveBar" />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
// Ant caps every dialog at `calc(100vw - 32px)` and floats it with a radius, so
// asking for a fullscreen size still left a phone with an inset card and a strip
// of mask down each side. On a phone this surface is the whole screen.
@media (max-width: 640px) {
  .nc-modal-base-settings {
    .ant-modal {
      @apply !max-w-full !top-0 !m-0 !p-0;
    }

    .nc-modal {
      @apply !rounded-none;
    }
  }
}
</style>
