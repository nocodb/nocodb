<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

// The workspace settings page at `/{ws}/settings/{slug}`, laid out like the base
// settings modal (`components/project/SettingsShell.vue`): a nav rail, then a
// content column of header band → pane → save bar. It stays a page because it
// hosts the billing and payment flows. The old `/{ws}/{page}` routes redirect here.

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

const { hasSaveBar } = useProvideShell()

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

// Read by the Integrations pane on mount: where it opens, not where it stays.
const integrationsInitialView = computed(() =>
  route.value.query.integrationsView === 'environments' ? 'environments' : undefined,
)

/** A phone shows rail or pane, not both — see the base settings shell. */
const isRailOnlyOnMobile = ref(true)

const showRail = computed(() => !isMobileMode.value || isRailOnlyOnMobile.value)

const showPane = computed(() => !isMobileMode.value || !isRailOnlyOnMobile.value)

function goToTab(tab: string) {
  isRailOnlyOnMobile.value = false

  if (tab === props.tab || !workspaceId.value) return

  // A bare path: pane-scoped params (`integrationsView`, `autoScroll`…) belong to the pane they opened.
  navigateTo(wsSettingsPath(workspaceId.value, tab as WsSettingsSlug))
}

function onGroupToggle(key: string, open: boolean) {
  $e('c:settings:ws:group-toggle', { group: key, open })
}

watch(
  [() => props.tab, isBaseRolesLoaded, availableTabs, workspaceId],
  () => {
    if (!isBaseRolesLoaded.value) return

    if (!workspaceId.value) return

    if (!availableTabs.value.size || !firstAvailableTab.value) {
      navigateTo(`/${workspaceId.value}`, { replace: true })
      return
    }

    // Bounce a deep link this role, edition or plan cannot reach.
    if (!availableTabs.value.has(props.tab)) {
      navigateTo(wsSettingsPath(workspaceId.value, firstAvailableTab.value), { replace: true })
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
  <div class="nc-ws-settings relative flex h-full w-full" data-testid="nc-ws-settings-wrapper">
    <ShellBack v-if="isMobileMode && !isRailOnlyOnMobile" testid="nc-ws-settings-back" @back="isRailOnlyOnMobile = true" />

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
        no-close-inset
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
</template>
