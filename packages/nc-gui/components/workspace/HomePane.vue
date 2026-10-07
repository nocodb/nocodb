<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

// Members, Teams and Integrations, in the workspace home page's content area
// beside the home sidebar: the settings page's header band and pane, without its rail.
const props = defineProps<{
  pane: WsHomePane
}>()

const { t } = useI18n()

const route = useRoute()

const { isUIAllowed, isWorkspaceRolesLoaded } = useRoles()

const workspaceStore = useWorkspace()

const { loadCollaborators } = workspaceStore

const { activeWorkspace } = storeToRefs(workspaceStore)

const { blockTeamsManagement } = useEeConfig()

const { wsTabVisibility } = useWorkspaceTabVisibility(activeWorkspace)

const { hasSaveBar, goBack } = useProvideShell()

// Panes read this to shed the page chrome the header band replaces.
provide(IsSettingsSidebarInj, ref(true))

const workspaceId = computed(() => activeWorkspace.value?.id)

const isRolesLoaded = computed(() => isWorkspaceRolesLoaded(workspaceId.value))

const visibilityKey: Record<WsHomePane, 'collaborators' | 'teams' | 'integrations'> = {
  members: 'collaborators',
  teams: 'teams',
  integrations: 'integrations',
}

// Panes load on mount, so one the reader cannot reach must never mount.
const isPaneAllowed = computed(() => isRolesLoaded.value && !!wsTabVisibility.value[visibilityKey[props.pane]])

const meta = computed(() => {
  switch (props.pane) {
    case 'members':
      return {
        title: t('labels.wsNav.membersPage'),
        description: t('labels.wsNav.desc.members'),
        docsHref: 'https://nocodb.com/docs/product-docs/collaboration/workspace-collaboration',
      }
    case 'teams':
      return {
        title: t('general.teams'),
        description: t('labels.wsNav.desc.teams'),
        docsHref: 'https://nocodb.com/docs/product-docs/collaboration/teams',
      }
    default:
      return {
        title: t('general.integrations'),
        description: t('labels.wsNav.desc.integrations'),
        docsHref: 'https://nocodb.com/docs/product-docs/integrations',
      }
  }
})

// Read by the Integrations pane on mount: where it opens, not where it stays.
const integrationsInitialView = computed(() => (route.query.integrationsView === 'environments' ? 'environments' : undefined))

// Escape steps out of a pane's drill-in; there is nowhere further to leave to.
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.repeat) return

  if (isDrawerOrModalExist() || isNcDropdownOpen() || isActiveInputElementExist(e) || cmdKActive() || isCmdJActive()) return

  if (isPortalledOverlayActive() || isGeneralOverlayActive()) return

  goBack()
})

watch(
  [() => props.pane, isRolesLoaded, workspaceId, isPaneAllowed],
  () => {
    if (!isRolesLoaded.value || !workspaceId.value) return

    // Bounce a deep link this role or edition cannot reach.
    if (!isPaneAllowed.value) {
      navigateTo(`/${workspaceId.value}`, { replace: true })
      return
    }

    if (['members', 'teams'].includes(props.pane) && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({}, workspaceId.value)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-ws-home-pane flex flex-col h-full w-full" :data-testid="`nc-ws-home-pane-${pane}`">
    <ShellHeader :title="meta.title" :description="meta.description" :docs-href="meta.docsHref" class="!pt-3" no-close-inset />

    <div v-if="!isPaneAllowed || !workspaceId" class="flex-1 min-h-0 flex items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else class="flex-1 min-h-0">
      <WorkspaceCollaboratorsList v-if="pane === 'members'" :workspace-id="workspaceId" is-active />

      <template v-else-if="pane === 'teams'">
        <div v-if="blockTeamsManagement" class="h-full overflow-auto nc-scrollbar-thin">
          <PaymentUpgradeFeatureCard
            :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT"
            :title="$t('labels.baseNav.upgradeTitleTeams')"
            :detail="$t('labels.baseNav.upgradeDescTeams')"
            icon="ncBuilding"
            trigger-source="ws-home-teams"
          />
        </div>
        <WorkspaceTeams v-else :workspace-id="workspaceId" is-active />
      </template>

      <WorkspaceIntegrationsPane v-else :initial-view="integrationsInitialView" />
    </div>

    <ShellSaveBar v-if="hasSaveBar" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-shell-header-actions) {
  @apply !mt-0;
}
</style>
