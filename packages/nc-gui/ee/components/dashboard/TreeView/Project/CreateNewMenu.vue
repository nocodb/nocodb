<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['@update:visible', 'newTable', 'emptyScript'])

const vVisible = useVModel(props, 'visible', emits)

const base = inject(ProjectInj)!

const source = computed(() => {
  return base.value.sources?.[0]
})

const { isUIAllowed } = useRoles()

const { isMarketVisible } = storeToRefs(useAutomationStore())

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

const showBaseOption = (source: SourceType) => {
  return ['airtableImport', 'csvImport', 'jsonImport', 'excelImport'].some((permission) => isUIAllowed(permission, { source }))
}

const openMarketPlace = () => {
  vVisible.value = false
  isMarketVisible.value = true
}
</script>

<template>
  <NcMenu variant="large" @click="vVisible = false">
    <NcMenuItem inner-class="w-full" class="nc-menu-item-combo" data-testid="create-new-table" @click="emits('newTable')">
      <div class="w-full flex items-center">
        <div class="flex-1 flex items-center gap-2 cursor-pointer">
          <GeneralIcon icon="table" class="!w-4 !h-4" />
          Table
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
            title-class="!p-0 hover:bg-brand-50 group"
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
                <span class="normal-case min-w-[180px]"> Import Options </span>
              </NcMenuItemLabel>
            </template>
          </DashboardTreeViewBaseOptions>
        </template>
      </div>
    </NcMenuItem>

    <NcMenuItem inner-class="w-full" disabled data-testid="create-new-dashboard">
      <GeneralIcon icon="ncLayout" class="w-4 h-4" />
      Dashboard
      <div class="flex-1 w-full" />
      <NcBadge :border="false" size="xs" class="!text-brand-600 !bg-brand-50"> Soon </NcBadge>
    </NcMenuItem>

    <template v-if="isAutomationEnabled">
      <NcMenuItemLabel>
        <span class="normal-case"> Automations </span>
      </NcMenuItemLabel>
      <NcMenuItem inner-class="w-full" class="nc-menu-item-combo" data-testid="create-new-script" @click="emits('emptyScript')">
        <div class="w-full flex items-center">
          <div class="flex-1 flex items-center gap-2 cursor-pointer">
            <GeneralIcon icon="ncScript" />
            Script
          </div>

          <div class="px-1 cursor-default flex items-center h-9 -my-2" @click.stop>
            <div class="h-7 w-px flex-none bg-nc-border-gray-medium" />
          </div>

          <NcSubMenu
            variant="large"
            class="nc-sub-menu-item-icon-only"
            title-class="!p-0 hover:bg-brand-50 group"
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
              <span class="normal-case min-w-[180px]"> New Script </span>
            </NcMenuItemLabel>
            <NcMenuItem @click="emits('emptyScript')">
              <GeneralIcon icon="ncScript" class="w-4 h-4 text-brand-500" />
              Empty Script
            </NcMenuItem>
            <NcMenuItem @click="openMarketPlace">
              <GeneralIcon icon="ncScript" class="w-4 h-4 text-nc-content-maroon-dark" />
              Script by NocoDB
            </NcMenuItem>
          </NcSubMenu>
        </div>
      </NcMenuItem>
      <NcMenuItem inner-class="w-full" data-testid="create-new-automation" disabled>
        <GeneralIcon icon="ncAutomation" />
        Automation
        <div class="flex-1 w-full" />
        <NcBadge :border="false" size="xs" class="!text-brand-600 !bg-brand-50"> Soon </NcBadge>
      </NcMenuItem>
    </template>
  </NcMenu>
</template>

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
