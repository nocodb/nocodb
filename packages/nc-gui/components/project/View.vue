<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
  tab?: string
  showEmptySkeleton?: boolean
}>()

const { hideSidebar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { integrations } = useProvideIntegrationViewStore()

const basesStore = useBases()

const { openedProject, activeProjectId, basesUser, bases } = storeToRefs(basesStore)
const { activeTable } = storeToRefs(useTablesStore())
const { activeWorkspace } = storeToRefs(useWorkspace())

const { isSharedBase, isPrivateBase } = storeToRefs(useBase())

const { $e, $api } = useNuxtApp()

const { blockTableAndFieldPermissions, showUpgradeToUseTableAndFieldPermissions } = useEeConfig()

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

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed, baseRoles, isBaseRolesLoaded } = useRoles()

const { base } = storeToRefs(useBase())

const { projectPageTab: _projectPageTab } = storeToRefs(useConfigStore())

const { isMobileMode } = useGlobal()

const baseSettingsState = ref('')

const userCount = computed(() => {
  // if private base and don't have owner permission then return
  if (base.value?.default_role && !baseRoles.value[ProjectRoles.OWNER]) {
    return
  }

  return activeProjectId.value ? basesUser.value.get(activeProjectId.value)?.filter((user) => !user?.deleted)?.length : 0
})

const { isTableAndFieldPermissionsEnabled } = usePermissions()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isOverviewTabVisible = computed(() => isUIAllowed('projectOverviewTab'))

const projectPageTab = computed({
  get() {
    return _projectPageTab.value
  },
  set(value) {
    if (value === 'permissions' && showUpgradeToUseTableAndFieldPermissions()) {
      return
    }

    _projectPageTab.value = value
  },
})

watch(
  () => route.value.query?.page,
  async (newVal, oldVal) => {
    if (!('baseId' in route.value.params)) return
    // if (route.value.name !== 'index-typeOrId-baseId-index-index') return

    // Wait for base roles to be loaded before checking if the overview tab is visible
    await until(() => isBaseRolesLoaded.value).toBeTruthy()

    /**
     * We are waiting for base role load and their might be the case that,
     * on navigating to different page this watch get called which will overwrite projectPageTab value and navigateToProjectPage fn get called
     */
    if (route.value.params.viewId) return

    if (newVal && newVal !== oldVal) {
      if (newVal === 'syncs') {
        projectPageTab.value = 'syncs'
      } else if (newVal === 'data-source') {
        projectPageTab.value = 'data-source'
      } else if (newVal === 'overview' && isOverviewTabVisible.value) {
        projectPageTab.value = 'overview'
      } else if (
        newVal === 'permissions' &&
        !blockTableAndFieldPermissions.value &&
        isEeUI &&
        isTableAndFieldPermissionsEnabled.value
      ) {
        projectPageTab.value = 'permissions'
      } else if (newVal === 'base-settings') {
        projectPageTab.value = 'base-settings'
      } else {
        projectPageTab.value = 'collaborator'
      }
      return
    }

    if (isAdminPanel.value || !isOverviewTabVisible.value) {
      projectPageTab.value = 'collaborator'
    } else {
      projectPageTab.value = 'overview'
    }
  },
  { immediate: true },
)

const { navigateToProjectPage } = useBase()

watch(projectPageTab, () => {
  $e(`a:project:view:tab-change:${projectPageTab.value}`)

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
  await until(() => !!currentBase.value?.id).toBeTruthy()
  if (props.tab) {
    projectPageTab.value = props.tab
  }
})

onMounted(() => {
  hideSidebar.value = false
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
        <div v-if="!showEmptySkeleton" class="flex flex-row items-center h-full gap-x-2 px-2">
          <GeneralProjectIcon :color="parseProp(currentBase?.meta).iconColor" :type="currentBase?.type" />
          <NcTooltip class="flex font-bold text-sm capitalize truncate max-w-150 text-gray-800" show-on-truncate-only>
            <template #title> {{ currentBase?.title }}</template>
            <span class="truncate">
              {{ currentBase?.title }}
            </span>
          </NcTooltip>
          <NcBadge
            v-if="isPrivateBase"
            size="xs"
            class="!text-bodySm !bg-nc-bg-gray-medium !text-nc-content-gray-subtle2"
            color="grey"
            :border="false"
          >
            <GeneralIcon icon="ncLock" class="w-3.5 h-3.5 mr-1" />
            {{ $t('general.private') }}
          </NcBadge>
        </div>
      </div>
      <template v-if="!showEmptySkeleton">
        <SmartsheetTopbarCmdK v-if="!isSharedBase && !isNewSidebarEnabled" />

        <LazyGeneralShareProject />
      </template>
    </div>
    <div
      v-if="!showEmptySkeleton"
      class="flex nc-base-view-tab"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <a-tabs v-model:active-key="projectPageTab" class="w-full">
        <template #leftExtra>
          <div class="w-3"></div>
        </template>
        <a-tab-pane v-if="!isAdminPanel && isOverviewTabVisible" key="overview" class="nc-project-overview-tab-content">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__overview">
              <GeneralIcon icon="ncMultiCircle" />
              <div>{{ $t('general.overview') }}</div>
            </div>
          </template>
          <ProjectOverview />
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
        <a-tab-pane
          v-if="isEeUI && isUIAllowed('sourceCreate') && base.id && isTableAndFieldPermissionsEnabled"
          key="permissions"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__permissions">
              <GeneralIcon icon="ncLock" />
              <div>{{ $t('general.permissions') }}</div>
            </div>
          </template>
          <DashboardSettingsPermissions v-model:state="baseSettingsState" :base-id="base.id" />
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
        <a-tab-pane v-if="isFeatureEnabled(FEATURE_FLAG.SYNC) && isUIAllowed('sourceCreate') && base.id" key="syncs">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__syncs">
              <GeneralIcon icon="ncZap" />
              <div>Syncs</div>
            </div>
          </template>
          <DashboardSettingsSyncs v-model:state="baseSettingsState" :base-id="base.id" class="max-h-full" />
        </a-tab-pane>
        <a-tab-pane
          v-if="!isSharedBase && (isUIAllowed('baseMiscSettings') || isFeatureEnabled(FEATURE_FLAG.MODEL_CONTEXT_PROTOCOL))"
          key="base-settings"
        >
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
  &:not(:has(.nc-project-overview-tab-content.ant-tabs-tabpane-active)) {
    @apply nc-content-max-w;
  }
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
