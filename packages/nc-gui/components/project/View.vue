<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import NcLayout from '~icons/nc-icons/layout'

const props = defineProps<{
  baseId?: string
  tab?: string
}>()

const { integrations } = useProvideIntegrationViewStore()

const basesStore = useBases()

const { openedProject, activeProjectId, basesUser, bases } = storeToRefs(basesStore)
const { activeTables, activeTable } = storeToRefs(useTablesStore())
const { activeWorkspace } = storeToRefs(useWorkspace())

const { isSharedBase } = useBase()

const automationStore = useAutomationStore()

const { loadAutomations } = automationStore

const { automations, isAutomationActive } = storeToRefs(automationStore)

const { $e, $api } = useNuxtApp()

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    base = bases.value.get(props.baseId)
    if (!base) base = await $api.base.read(props.baseId!)
  } else {
    base = openedProject.value
  }

  return base
})

const scripts = computed(() => automations.value.get(currentBase.value?.id))

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed, baseRoles } = useRoles()

const { base } = storeToRefs(useBase())

const { projectPageTab } = storeToRefs(useConfigStore())

const { isMobileMode } = useGlobal()

const baseSettingsState = ref('')

const userCount = computed(() =>
  activeProjectId.value ? basesUser.value.get(activeProjectId.value)?.filter((user) => !user?.deleted)?.length : 0,
)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

watch(
  () => route.value.query?.page,
  (newVal, oldVal) => {
    // if (route.value.name !== 'index-typeOrId-baseId-index-index') return
    if (newVal && newVal !== oldVal) {
      if (newVal === 'collaborator') {
        projectPageTab.value = 'collaborator'
      } else if (newVal === 'data-source') {
        projectPageTab.value = 'data-source'
      } else if (newVal === 'allTable') {
        projectPageTab.value = 'allTable'
      } else if (newVal === 'allScripts' && isAutomationEnabled.value && isEeUI) {
        projectPageTab.value = 'allScripts'
      } else {
        projectPageTab.value = 'base-settings'
      }
      return
    }
    if (isAdminPanel.value) {
      projectPageTab.value = 'collaborator'
    } else {
      projectPageTab.value = 'allTable'
    }
  },
  { immediate: true },
)

const { navigateToProjectPage } = useBase()

watch(projectPageTab, () => {
  $e(`a:project:view:tab-change:${projectPageTab.value}`)

  if (isAutomationActive.value) return

  navigateToProjectPage({
    page: projectPageTab.value as any,
  })
})

watch(
  () => [currentBase.value?.id, currentBase.value?.title],
  () => {
    if (activeTable.value?.title) return

    useTitle(`${currentBase.value?.title ?? activeWorkspace.value?.title ?? 'NocoDB'}`)
  },
  {
    immediate: true,
  },
)

watch(
  () => currentBase.value?.id,
  () => {
    /**
     * When the current base ID changes, reset the integrations array.
     * This ensures that the integration data is cleared, allowing it to be reloaded
     * properly when opening the create/edit source modal with the updated base.
     */
    integrations.value = []
  },
)

onMounted(async () => {
  if (props.tab) {
    projectPageTab.value = props.tab
  }

  await until(() => !!currentBase.value?.id).toBeTruthy()

  await loadAutomations({ baseId: currentBase.value?.id })
})
</script>

<template>
  <div class="h-full nc-base-view">
    <div
      v-if="!isAdminPanel"
      class="flex flex-row px-2 py-2 gap-3 justify-between w-full border-b-1 border-gray-200"
      :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    >
      <div class="flex-1 flex flex-row items-center gap-x-3">
        <GeneralOpenLeftSidebarBtn />
        <div class="flex flex-row items-center h-full gap-x-2 px-2">
          <GeneralProjectIcon :color="parseProp(currentBase?.meta).iconColor" :type="currentBase?.type" />
          <NcTooltip class="flex font-bold text-sm capitalize truncate max-w-150 text-gray-800" show-on-truncate-only>
            <template #title> {{ currentBase?.title }}</template>
            <span class="truncate">
              {{ currentBase?.title }}
            </span>
          </NcTooltip>
        </div>
      </div>

      <SmartsheetTopbarCmdK v-if="!isSharedBase" />

      <LazyGeneralShareProject />
    </div>
    <div
      class="flex nc-base-view-tab"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <a-tabs v-model:activeKey="projectPageTab" class="w-full">
        <template #leftExtra>
          <div class="w-3"></div>
        </template>
        <a-tab-pane v-if="!isAdminPanel" key="allTable">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__all-tables">
              <NcLayout />
              <div>{{ $t('labels.allTables') }}</div>
              <div
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'allTable',
                  'bg-gray-50': projectPageTab !== 'allTable',
                }"
              >
                {{ activeTables.length }}
              </div>
            </div>
          </template>
          <ProjectAllTables />
        </a-tab-pane>
        <a-tab-pane
          v-if="!isAdminPanel && isAutomationEnabled && isEeUI && isUIAllowed('scriptList') && !isSharedBase"
          key="allScripts"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__all-tables">
              <NcLayout />
              <div>{{ $t('labels.allScripts') }}</div>
              <div
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'allScripts',
                  'bg-gray-50': projectPageTab !== 'allScripts',
                }"
              >
                {{ scripts?.length }}
              </div>
            </div>
          </template>
          <ProjectAllScripts />
        </a-tab-pane>
        <!-- <a-tab-pane v-if="defaultBase" key="erd" tab="Base ERD" force-render class="pt-4 pb-12">
          <ErdView :source-id="defaultBase!.id" class="!h-full" />
        </a-tab-pane> -->
        <a-tab-pane v-if="isUIAllowed('newUser', { roles: baseRoles }) && !isSharedBase" key="collaborator">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__access-settings">
              <GeneralIcon icon="users" />
              <div>{{ $t('labels.members') }}</div>
              <div
                v-if="userCount"
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'collaborator',
                  'bg-gray-50': projectPageTab !== 'collaborator',
                }"
              >
                {{ userCount }}
              </div>
            </div>
          </template>
          <ProjectAccessSettings :base-id="currentBase?.id" />
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('sourceCreate') && base.id" key="data-source">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__data-sources">
              <GeneralIcon icon="ncDatabase" />
              <div>{{ $t('labels.dataSources') }}</div>
              <div
                v-if="base.sources?.length"
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'data-source',
                  'bg-gray-50': projectPageTab !== 'data-source',
                }"
              >
                {{ base.sources.length }}
              </div>
            </div>
          </template>
          <DashboardSettingsDataSources v-model:state="baseSettingsState" :base-id="base.id" class="max-h-full" />
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('baseMiscSettings')" key="base-settings">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__base-settings">
              <GeneralIcon icon="ncSettings" />
              <div>{{ $t('activity.settings') }}</div>
            </div>
          </template>
          <DashboardSettingsBase :base-id="base.id!" class="max-h-full" />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-content) {
  @apply !h-full;
}
:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

.tab-title {
  @apply flex flex-row items-center gap-x-2 px-2 py-[1px];
}
:deep(.ant-tabs-tab) {
  @apply pt-2 pb-3;
}
:deep(.ant-tabs-content) {
  @apply nc-content-max-w;
}
:deep(.ant-tabs-tab .tab-title) {
  @apply text-gray-500;
}
:deep(.ant-tabs-tab-active .tab-title) {
  @apply text-primary;
}

.tab-info {
  @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
}
</style>
