<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible', 'newTable', 'emptyScript', 'emptyWorkflow', 'emptyDashboard', 'emptyPage'])

const vVisible = useVModel(props, 'visible', emits)

const base = inject(ProjectInj)!

const source = computed(() => {
  return base.value.sources?.[0]
})

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { isMarketVisible } = storeToRefs(useScriptStore())

const { isMobileMode } = useGlobal()

const { openTableSyncCreateModal } = useTableSyncStore()

const { isEEFeatureBlocked, blockDocs, blockScripts, blockSync, showEEFeatures, showUpgradeToUseScripts, showUpgradeToUseSync } =
  useEeConfig()

const { activeSidebarTab } = storeToRefs(useSidebarStore())

const isWorkflowsTab = computed(() => activeSidebarTab.value === 'workflows')

const showBaseOption = (source: SourceType) => {
  return (
    (source.enabled || (base.value.sources || []).length > 1) &&
    ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, { source }))
  )
}

const openMarketPlace = () => {
  vVisible.value = false

  if (blockScripts.value) {
    showUpgradeToUseScripts({ triggerSource: 'treeview-scripts' })
    return
  }

  isMarketVisible.value = true
}

const handleCreateSync = (createSyncClick: () => void) => {
  if (blockSync.value) {
    showUpgradeToUseSync({ triggerSource: 'treeview-sync' })
    return
  }
  createSyncClick()
}

function handleCreateTableSync() {
  $e('c:sync:create:table')
  // Gating (blockTableSync / upgrade modal) is handled inside the store action.
  openTableSyncCreateModal({ baseId: base.value?.id })
}

function handleCreateIntegrationSync(createSyncClick: () => void) {
  $e('c:sync:create:integration')
  handleCreateSync(createSyncClick)
}

const syncIcons = [SyncDataType.GITHUB, SyncDataType.JIRA, SyncDataType.ZENDESK]

const automationIcons = [SyncDataType.SLACK, SyncDataType.GMAIL, SyncDataType.OPENAI]
</script>

<template>
  <NcMenu variant="large" data-testid="nc-home-create-new-menu" @click="vVisible = false">
    <!-- Data tab items: table, document, dashboard, sync -->
    <template v-if="!isWorkflowsTab">
      <NcMenuItem inner-class="w-full" class="nc-menu-item-combo" data-testid="create-new-table" @click="emits('newTable')">
        <div class="w-full flex items-center">
          <div class="flex-1 flex items-center gap-2 cursor-pointer">
            <GeneralIcon icon="table" class="!w-4 !h-4" />
            {{ $t('objects.table') }}
          </div>
          <template v-if="source && showBaseOption(source)">
            <div class="px-1 cursor-default flex items-center h-5 -my-2" @click.stop>
              <div class="h-3.5 w-px flex-none bg-nc-border-gray-medium" />
            </div>

            <DashboardTreeViewBaseOptions
              v-model:base="base"
              :source="source"
              variant="large"
              submenu-class="nc-sub-menu-item-icon-only"
              title-class="!p-0 hover:bg-nc-bg-brand dark:hover:bg-nc-bg-gray-medium group"
              show-noco-db-import
              :popup-offset="[8, -2]"
            >
              <template #title>
                <div class="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer group-hover:text-nc-content-brand">
                  <GeneralIcon icon="ncChevronRight" />
                </div>
              </template>
              <template #expandIcon> </template>
              <template #label>
                <NcMenuItemLabel>
                  <span class="normal-case min-w-[180px]"> {{ $t('labels.importOptions') }} </span>
                </NcMenuItemLabel>
              </template>
            </DashboardTreeViewBaseOptions>
          </template>
        </div>
      </NcMenuItem>

      <NcMenuItem v-if="showEEFeatures" inner-class="w-full" data-testid="create-new-document" @click="emits('emptyPage')">
        <GeneralIcon icon="ncFileText" />
        {{ $t('objects.document') }}
        <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !blockDocs" show-as-lock remove-click />
      </NcMenuItem>

      <NcMenuItem
        v-if="!isMobileMode && showEEFeatures"
        inner-class="w-full"
        data-testid="create-new-dashboard"
        @click="emits('emptyDashboard')"
      >
        <GeneralIcon icon="dashboards" />
        {{ $t('labels.dashboard') }}
        <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
      </NcMenuItem>

      <ProjectSyncCreateProvider v-if="!isMobileMode && showEEFeatures">
        <template #default="{ createSyncClick }">
          <NcSubMenu
            class="nc-menu-item-integration"
            data-testid="create-new-sync"
            popup-class-name="nc-create-new-sync-submenu"
            @click.stop
          >
            <template #title>
              <GeneralIcon icon="ncZap" />
              <span>{{ $t('labels.sync') }}</span>
              <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
            </template>

            <NcMenuItem data-testid="create-new-sync-table" @click="handleCreateTableSync">
              <div class="flex items-start gap-2 w-full py-1 min-w-[280px]">
                <GeneralIcon icon="nocodb1" class="!w-5 !h-5 flex-none mt-0.5" />
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <span class="text-bodyDefaultSmBold text-nc-content-gray">{{ $t('labels.tableSync') }}</span>
                  <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                    {{ $t('labels.tableSyncDesc') }}
                  </span>
                </div>
              </div>
            </NcMenuItem>

            <NcMenuItem data-testid="create-new-sync-integration" @click="handleCreateIntegrationSync(createSyncClick)">
              <div class="flex items-start gap-2 w-full py-1 min-w-[280px]">
                <GeneralIcon icon="integration" class="!w-5 !h-5 flex-none mt-0.5 text-nc-content-gray-emphasis" />
                <div class="flex flex-col gap-1 flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-bodyDefaultSmBold text-nc-content-gray">{{ $t('labels.integrationSync') }}</span>
                    <div class="flex items-center flex-none">
                      <div v-for="icon in syncIcons" :key="icon" class="nc-integration-icon-wrapper">
                        <GeneralIntegrationIcon :type="icon" size="sx" class="nc-integration-icon" />
                      </div>
                      <div class="nc-integration-icon-wrapper text-nc-content-gray-muted text-bodySm">+10</div>
                    </div>
                  </div>
                  <span class="text-bodyDefaultSm text-nc-content-gray-subtle2 whitespace-normal break-words">
                    {{ $t('labels.integrationSyncDesc') }}
                  </span>
                </div>
              </div>
            </NcMenuItem>
          </NcSubMenu>
        </template>
      </ProjectSyncCreateProvider>
    </template>

    <!-- Automations tab items: workflow, script -->
    <template v-if="isWorkflowsTab">
      <NcMenuItem
        v-if="showEEFeatures"
        class="nc-menu-item-integration"
        inner-class="w-full"
        data-testid="create-new-workflow"
        @click="emits('emptyWorkflow')"
      >
        <GeneralIcon icon="ncAutomation" />
        {{ $t('general.workflow') }}
        <NcBadgeBeta class="!text-nc-content-brand-disabled !bg-nc-bg-brand" />
        <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
        <div class="flex-1 w-full" />
        <div class="flex items-center">
          <div v-for="icon in automationIcons" :key="icon" class="nc-integration-icon-wrapper">
            <GeneralIntegrationIcon :type="icon" size="sx" class="nc-integration-icon" />
          </div>
          <div class="nc-integration-icon-wrapper text-nc-content-gray-muted text-bodySm">+4</div>
        </div>
      </NcMenuItem>

      <NcMenuItem
        v-if="showEEFeatures"
        inner-class="w-full"
        class="nc-menu-item-combo"
        data-testid="create-new-script"
        @click="emits('emptyScript')"
      >
        <div class="w-full flex items-center">
          <div class="flex-1 flex items-center gap-2 cursor-pointer">
            <GeneralIcon icon="ncScript" />
            {{ $t('objects.script') }}
            <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" show-as-lock remove-click />
          </div>

          <div class="px-1 cursor-default flex items-center h-5 -my-2" @click.stop>
            <div class="h-3.5 w-px flex-none bg-nc-border-gray-medium" />
          </div>

          <NcSubMenu
            variant="large"
            class="nc-sub-menu-item-icon-only"
            title-class="!p-0 hover:bg-nc-bg-brand dark:hover:bg-nc-bg-gray-medium group"
            :popup-offset="[8, -2]"
            @click.stop
          >
            <template #title>
              <div class="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer group-hover:text-nc-content-brand">
                <GeneralIcon icon="ncChevronRight" />
              </div>
            </template>
            <template #expandIcon> </template>

            <NcMenuItemLabel>
              <span class="normal-case min-w-[180px]"> {{ $t('labels.newScript') }} </span>
            </NcMenuItemLabel>
            <NcMenuItem @click="emits('emptyScript')">
              <GeneralIcon icon="ncScript" class="w-4 h-4 text-nc-content-brand" />
              {{ $t('labels.emptyScript') }}
            </NcMenuItem>
            <NcMenuItem @click="openMarketPlace">
              <GeneralIcon icon="ncScript" class="w-4 h-4 text-nc-content-maroon-dark" />
              {{ $t('labels.scriptByNocoDB') }}
            </NcMenuItem>
          </NcSubMenu>
        </div>
      </NcMenuItem>
    </template>
  </NcMenu>
</template>

<style scoped lang="scss">
.nc-menu-item-integration {
  .nc-integration-icon-wrapper {
    @apply flex items-center justify-center children:flex-none w-6;
  }

  .nc-integration-icon {
    transition: fill 0.2s ease;
  }

  &:not(:hover) {
    .nc-integration-icon {
      @apply text-nc-content-gray-muted;

      & * {
        fill: currentColor !important;
      }
    }
  }
}
</style>

<style lang="scss">
// Submenu popup is teleported out of the scoped subtree, so space the
// integration icons here in a global rule scoped to the popup class.
.nc-create-new-sync-submenu {
  .nc-integration-icon-wrapper {
    @apply flex items-center justify-center children:flex-none w-6;
  }
}

.nc-menu-item-combo {
  @apply !pr-1;
}

.nc-sub-menu-item-icon-only {
  @apply !mx-0 -my-1;

  .ant-dropdown-menu-submenu-title {
    @apply !px-0 !w-8 children:w-8 flex items-center !justify-center;
  }
}
</style>
