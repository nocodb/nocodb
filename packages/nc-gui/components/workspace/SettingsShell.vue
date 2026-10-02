<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

// Workspace settings as a modal shell — the base settings anatomy
// (`components/project/SettingsShell.vue`): a nav rail, then a content column of
// header band → pane → save bar.
//
// Opened by `?wsSettings={slug}` on whatever route is active — the workspace home
// or a table inside a base — so closing returns to it with no reload. The rail
// switches panes by replacing the query value; the old `/{ws}/{page}` routes
// redirect here.

const props = defineProps<{
  tab: WsSettingsSlug
}>()

const router = useRouter()

const route = router.currentRoute

const { $e } = useNuxtApp()

const { isUIAllowed, isBaseRolesLoaded } = useRoles()

const { isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { loadCollaborators } = workspaceStore

const { activeWorkspace } = storeToRefs(workspaceStore)

const { navGroups, paneMeta, availableTabs, firstAvailableTab, isWsAuditEnabled, blockWorkspaceSso, blockTeamsManagement } =
  useWorkspaceSettingsNav()

const { hasSaveBar, goBack } = useProvideShell()

// Panes read this to shed the page chrome they carry on their old routes.
provide(IsSettingsSidebarInj, ref(true))

const workspaceId = computed(() => activeWorkspace.value?.id)

const meta = computed(() => paneMeta.value[props.tab])

// Panes load on mount, so one the reader cannot reach must never mount.
const isPaneAllowed = computed(() => isBaseRolesLoaded.value && availableTabs.value.has(props.tab))

// The General page's sections, one rail row each.
const generalSectionBySlug: Partial<Record<WsSettingsSlug, WsSettingsSection>> = {
  'general': 'appearance',
  'skills': 'skills',
  'security': 'security',
  'danger-zone': 'dangerZone',
}

const generalSection = computed(() => generalSectionBySlug[props.tab])

// Captured once: it names where the Integrations pane opens, not where it stays.
const integrationsInitialView = route.value.query.integrationsView === 'environments' ? 'environments' : undefined

/** A phone shows rail or pane, not both — see the base settings shell. */
const isRailOnlyOnMobile = ref(true)

const showRail = computed(() => !isMobileMode.value || isRailOnlyOnMobile.value)

const showPane = computed(() => !isMobileMode.value || !isRailOnlyOnMobile.value)

function goToTab(tab: string) {
  isRailOnlyOnMobile.value = false

  if (tab === props.tab) return

  const query = { ...route.value.query, wsSettings: tab }
  delete query.integrationsView
  delete query.autoScroll
  delete query.activeBtn

  navigateTo({ query })
}

function onClose() {
  const query = { ...route.value.query }

  // Pane-scoped params travel with the shell.
  delete query.wsSettings
  delete query.integrationsView
  delete query.autoScroll
  delete query.activeBtn

  navigateTo({ query })
}

function onVisibleChange(visible: boolean) {
  if (visible) return

  if (goBack()) return

  if (isMobileMode.value && !isRailOnlyOnMobile.value) {
    isRailOnlyOnMobile.value = true
    return
  }

  onClose()
}

function onGroupToggle(key: string, open: boolean) {
  $e('c:settings:ws:group-toggle', { group: key, open })
}

watch(
  [() => props.tab, isBaseRolesLoaded, availableTabs],
  () => {
    if (!isBaseRolesLoaded.value) return

    if (!availableTabs.value.size || !firstAvailableTab.value) {
      onClose()
      return
    }

    // Bounce a deep link this role, edition or plan cannot reach.
    if (!availableTabs.value.has(props.tab)) {
      navigateTo({ query: { ...route.value.query, wsSettings: firstAvailableTab.value } }, { replace: true })
      return
    }

    if (['members', 'teams'].includes(props.tab) && workspaceId.value && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({}, workspaceId.value)
    }

    $e(`a:workspace:settings:tab-change:${props.tab}`)
  },
  { immediate: true },
)
</script>

<template>
  <NcModal
    :visible="true"
    :size="isMobileMode ? 'fullscreen' : 'xl'"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-ws-settings"
    @update:visible="onVisibleChange"
  >
    <div class="nc-ws-settings relative flex h-full w-full" data-testid="nc-ws-settings-wrapper">
      <ShellBack v-if="isMobileMode && !isRailOnlyOnMobile" testid="nc-ws-settings-back" @back="isRailOnlyOnMobile = true" />

      <ShellClose testid="nc-ws-settings-close" @close="onClose" />

      <ShellRail
        v-if="showRail"
        :full-width="isMobileMode"
        :groups="navGroups"
        :active="tab"
        :search-placeholder="$t('labels.baseNav.searchPlaceholder')"
        empty-text="labels.baseNav.searchEmpty"
        testid-prefix="nc-ws-settings-rail"
        event-prefix="c:settings:ws:"
        @select="goToTab"
        @group-toggle="onGroupToggle"
      >
        <template v-if="activeWorkspace" #subject>
          <GeneralWorkspaceIcon :workspace="activeWorkspace" size="small" class="flex-none" />
          <!-- `capitalize`, like the main sidebar: display only, the stored title is untouched. -->
          <NcTooltip show-on-truncate-only class="truncate capitalize">{{ activeWorkspace.title }}</NcTooltip>
        </template>
      </ShellRail>

      <div v-if="showPane" class="flex-1 flex flex-col min-w-0 min-h-0">
        <ShellHeader
          :title="meta?.title ?? ''"
          :description="meta?.description"
          :docs-href="meta?.docsHref"
          :leading-inset="isMobileMode"
        />

        <div v-if="!isPaneAllowed || !workspaceId" class="flex-1 min-h-0 flex items-center justify-center">
          <GeneralLoader size="xlarge" />
        </div>

        <div v-else class="flex-1 min-h-0">
          <WorkspaceCollaboratorsList v-if="tab === 'members'" :workspace-id="workspaceId" is-active />

          <template v-else-if="tab === 'teams'">
            <div v-if="blockTeamsManagement" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT"
                :title="$t('labels.baseNav.upgradeTitleTeams')"
                :detail="$t('labels.baseNav.upgradeDescTeams')"
                icon="ncBuilding"
                trigger-source="ws-settings-teams"
              />
            </div>
            <WorkspaceTeams v-else :workspace-id="workspaceId" is-active />
          </template>

          <WorkspaceIntegrationsPane v-else-if="tab === 'integrations'" :initial-view="integrationsInitialView" />

          <WorkspaceSettings v-else-if="generalSection" :workspace-id="workspaceId" :section="generalSection" />

          <PaymentBillingPage v-else-if="tab === 'billing'" />

          <WorkspaceUsage v-else-if="tab === 'usage'" :workspace-id="workspaceId" />

          <template v-else-if="tab === 'audits'">
            <div v-if="!isWsAuditEnabled" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE"
                :title="$t('labels.wsNav.upgradeTitleAudits')"
                :detail="$t('labels.wsNav.upgradeDescAudits')"
                icon="audit"
                trigger-source="ws-settings-audits"
              />
            </div>
            <WorkspaceAudits v-else />
          </template>

          <template v-else-if="tab === 'sso'">
            <div v-if="blockWorkspaceSso" class="h-full overflow-auto nc-scrollbar-thin">
              <PaymentUpgradeFeatureCard
                :feature="PlanFeatureTypes.FEATURE_SSO"
                :title="$t('labels.wsNav.upgradeTitleSso')"
                :detail="$t('labels.wsNav.upgradeDescSso')"
                icon="sso"
                trigger-source="ws-settings-sso"
              />
            </div>
            <WorkspaceSso v-else class="h-full" />
          </template>
        </div>

        <ShellSaveBar v-if="hasSaveBar" />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
// See `.nc-modal-base-settings`: on a phone this surface is the whole screen.
@media (max-width: 640px) {
  .nc-modal-ws-settings {
    .ant-modal {
      @apply !max-w-full !top-0 !m-0 !p-0;
    }

    .nc-modal {
      @apply !rounded-none;
    }
  }
}
</style>
