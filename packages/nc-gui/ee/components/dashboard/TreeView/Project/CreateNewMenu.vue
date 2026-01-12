<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:visible', 'newTable', 'emptyScript', 'emptyWorkflow', 'emptyDashboard'])

const vVisible = useVModel(props, 'visible', emits)

const base = inject(ProjectInj)!

const source = computed(() => {
  return base.value.sources?.[0]
})

const { isUIAllowed } = useRoles()

const { isMarketVisible } = storeToRefs(useScriptStore())

const { isWorkflowsEnabled } = storeToRefs(useWorkflowStore())

const { isDashboardEnabled } = storeToRefs(useDashboardStore())

const showBaseOption = (source: SourceType) => {
  return (
    (source.enabled || (base.value.sources || []).length > 1) &&
    ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, { source }))
  )
}

const openMarketPlace = () => {
  vVisible.value = false
  isMarketVisible.value = true
}

const syncIcons = [SyncDataType.GITHUB, SyncDataType.JIRA, SyncDataType.ZENDESK]

const automationIcons = [SyncDataType.SLACK, SyncDataType.GMAIL, SyncDataType.OPENAI]
</script>

<template>
  <NcMenu variant="large" data-testid="nc-home-create-new-menu" @click="vVisible = false">
    <NcMenuItem inner-class="w-full" class="nc-menu-item-combo" data-testid="create-new-table" @click="emits('newTable')">
      <div class="w-full flex items-center">
        <div class="flex-1 flex items-center gap-2 cursor-pointer">
          <GeneralIcon icon="table" class="!w-4 !h-4" />
          {{ $t('objects.table') }}
        </div>
        <template v-if="source && showBaseOption(source)">
          <div class="px-1 cursor-default flex items-center h-9 -my-2" @click.stop>
            <div class="h-7 w-px flex-none bg-nc-border-gray-medium" />
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

    <NcMenuItem
      v-if="isDashboardEnabled"
      inner-class="w-full"
      data-testid="create-new-dashboard"
      @click="emits('emptyDashboard')"
    >
      <GeneralIcon icon="dashboards" />
      {{ $t('labels.dashboard') }}
    </NcMenuItem>

    <ProjectSyncCreateProvider>
      <template #default="{ createSyncClick }">
        <NcMenuItem
          class="nc-menu-item-integration"
          inner-class="w-full"
          data-testid="create-new-sync"
          @click="
            () => {
              createSyncClick()
            }
          "
        >
          <GeneralIcon icon="ncZap" />
          {{ $t('labels.sync') }}
          <div class="flex-1 w-full" />
          <div class="flex items-center">
            <div v-for="icon in syncIcons" :key="icon" class="nc-integration-icon-wrapper">
              <GeneralIntegrationIcon :type="icon" size="sx" class="nc-integration-icon" />
            </div>
            <div class="nc-integration-icon-wrapper text-nc-content-gray-muted text-bodySm">+10</div>
          </div>
        </NcMenuItem>
      </template>
    </ProjectSyncCreateProvider>

    <NcMenuItemLabel>
      <span class="normal-case"> {{ $t('general.automations') }} </span>
    </NcMenuItemLabel>
    <NcMenuItem
      v-if="isWorkflowsEnabled"
      class="nc-menu-item-integration"
      inner-class="w-full"
      data-testid="create-new-workflow"
      @click="emits('emptyWorkflow')"
    >
      <GeneralIcon icon="ncAutomation" />
      {{ $t('general.workflow') }}
      <NcBadgeBeta class="!text-nc-content-brand-disabled !bg-nc-bg-brand" />
      <div class="flex-1 w-full" />
      <div class="flex items-center">
        <div v-for="icon in automationIcons" :key="icon" class="nc-integration-icon-wrapper">
          <GeneralIntegrationIcon :type="icon" size="sx" class="nc-integration-icon" />
        </div>
        <div class="nc-integration-icon-wrapper text-nc-content-gray-muted text-bodySm">+4</div>
      </div>
    </NcMenuItem>
    <NcMenuItem inner-class="w-full" class="nc-menu-item-combo" data-testid="create-new-script" @click="emits('emptyScript')">
      <div class="w-full flex items-center">
        <div class="flex-1 flex items-center gap-2 cursor-pointer">
          <GeneralIcon icon="ncScript" />
          {{ $t('objects.script') }}
        </div>

        <div class="px-1 cursor-default flex items-center h-9 -my-2" @click.stop>
          <div class="h-7 w-px flex-none bg-nc-border-gray-medium" />
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
