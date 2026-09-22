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
const { hasSaveBar } = useProvideShell()

// Panes were built for the settings sidebar page and read this to shed their
// own page chrome. The shell is that host now.
provide(IsSettingsSidebarInj, ref(true))

// Docs permissions is its own route slug (an old deep link) but not its own rail
// row — it is the second tab inside the Data Permissions pane.
const railActive = computed(() => (props.tab === 'docs-permissions' ? 'permissions' : props.tab))

const meta = computed(() => paneMeta.value[props.tab] ?? paneMeta.value[railActive.value])

const baseId = computed(() => base.value?.id)

function goToTab(tab: string) {
  if (tab === props.tab) return

  navigateTo({ query: { ...route.value.query, settings: settingsTabToSlug[tab] || tab } })
}

function onClose() {
  const query = { ...route.value.query }
  delete query.settings

  navigateTo({ query })
}

function onVisibleChange(visible: boolean) {
  if (!visible) onClose()
}

function onGroupToggle(key: string, open: boolean) {
  $e('c:settings:base:group-toggle', { group: key, open })
}

watch(
  () => props.tab,
  (tab) => {
    projectPageTab.value = tab as ProjectPageType
  },
  { immediate: true },
)

watch(
  [() => props.tab, isBaseRolesLoaded],
  () => {
    if (!isBaseRolesLoaded.value) return

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
    size="xl"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-base-settings"
    @update:visible="onVisibleChange"
  >
    <div class="flex h-full w-full" data-testid="nc-base-settings-wrapper">
      <ShellRail
        :groups="navGroups"
        :active="railActive"
        :search-placeholder="$t('labels.baseNav.searchPlaceholder')"
        empty-text="labels.baseNav.searchEmpty"
        testid-prefix="nc-settings-rail"
        event-prefix="c:settings:base:"
        collapse-storage-key="nc-base-settings-open-groups"
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

      <div class="flex-1 flex flex-col min-w-0 min-h-0">
        <ShellHeader
          :title="meta?.title ?? ''"
          :description="meta?.description"
          :docs-href="meta?.docsHref"
          close-testid="nc-base-settings-close"
          @close="onClose"
        />

        <div class="flex-1 min-h-0">
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
            <PaymentUpgradeFeatureCard
              v-if="blockSync"
              :feature="PlanFeatureTypes.FEATURE_SYNC"
              :title="$t('labels.baseNav.upgradeTitleSync')"
              :detail="$t('labels.baseNav.upgradeDescSync')"
              icon="ncZap"
            />
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
            <PaymentUpgradeFeatureCard
              v-if="blockBaseVariables"
              :feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
              :title="$t('labels.baseNav.upgradeTitleVariables')"
              :detail="$t('labels.baseNav.upgradeDescVariables')"
              icon="ncCode"
            />
            <div v-else class="h-full max-h-full overflow-auto nc-scrollbar-thin px-6 pb-6">
              <DashboardSettingsBaseVariables />
            </div>
          </template>

          <div v-else-if="tab === 'skills'" class="h-full max-h-full overflow-auto nc-scrollbar-thin pb-6">
            <DashboardSettingsBaseSkills />
          </div>

          <template v-else-if="tab === 'record-trash'">
            <PaymentUpgradeFeatureCard
              v-if="blockTrashSettings"
              :feature="PlanFeatureTypes.FEATURE_TRASH_SETTINGS"
              :title="$t('labels.baseNav.upgradeTitleTrashRetention')"
              :detail="$t('labels.baseNav.upgradeDescTrashRetention')"
              icon="ncHistory"
            />
            <div v-else class="h-full max-h-full overflow-auto nc-scrollbar-thin px-6 pb-6">
              <DashboardSettingsBaseTrash />
            </div>
          </template>

          <template v-else-if="tab === 'snapshots'">
            <PaymentUpgradeFeatureCard
              v-if="blockSnapshotsPane"
              :feature="PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE"
              :title="$t('labels.baseNav.upgradeTitleSnapshots')"
              :detail="$t('labels.baseNav.upgradeDescSnapshots')"
              icon="ncLayers"
            />
            <div v-else class="h-full max-h-full overflow-auto nc-scrollbar-thin px-6 pb-6">
              <DashboardSettingsBaseSnapshots />
            </div>
          </template>

          <DashboardSettingsBase v-else-if="tab === 'base-settings' && baseId" :base-id="baseId" class="max-h-full" />

          <ProjectAppSettings v-else-if="tab.startsWith('app-')" :tab="tab" class="h-full max-h-full" />
        </div>

        <ShellSaveBar v-if="hasSaveBar" />
      </div>
    </div>
  </NcModal>
</template>
