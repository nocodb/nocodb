<script lang="ts" setup>
interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['@update:visible', 'newTable', 'newScript'])

const vVisible = useVModel(props, 'visible', emits)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))
</script>

<template>
  <NcMenu variant="large" @click="vVisible = false">
    <div class="nc-menu-item-combo">
      <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard">
        <GeneralIcon icon="table" class="!w-4 !h-4" />
        Dashboard
      </NcMenuItem>
      <div class="h-7 w-px flex-none bg-nc-border-gray-medium" />

      <NcSubMenu variant="medium" title-class="!p-0 hover:bg-brand-100" @click.stop>
        <template #title>
          <div class="flex items-center justify-center h-8 w-8 rounded-lg">
            <GeneralIcon icon="ncChevronRight" />
          </div>
        </template>
        <template #expandIcon> </template>
        <NcMenuItemLabel>
          <span class="normal-case"> Import Options </span>
        </NcMenuItemLabel>
        <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard">
          <GeneralIcon icon="ncImport" class="!w-4 !h-4" />
          Import from CSV
        </NcMenuItem>
      </NcSubMenu>
    </div>
    <NcMenuComboWrapper>
      <template #ncMenuItem>
        <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard">
          <GeneralIcon icon="table" class="!w-4 !h-4" />
          Dashboard
        </NcMenuItem>
      </template>
      <template #ncSubMenu>
        <NcSubMenu variant="medium" title-class="!p-0 hover:bg-brand-100" @click.stop>
          <template #title>
            <GeneralIcon icon="ncChevronRight" />
          </template>
          <template #expandIcon> </template>
          <NcMenuItemLabel>
            <span class="normal-case"> Import Options </span>
          </NcMenuItemLabel>
          <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard">
            <GeneralIcon icon="ncImport" class="!w-4 !h-4" />
            Import from CSV
          </NcMenuItem>
        </NcSubMenu>
      </template>
    </NcMenuComboWrapper>

    <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard" :selectable="false">
      <GeneralIcon icon="ncTable" class="!w-4 !h-4" />
      Dashboard
      <div class="flex-1 w-full" />
      <NcBadge :border="false" size="xs" class="!text-brand-600 !bg-brand-50"> Soon </NcBadge>
    </NcMenuItem>

    <template v-if="isAutomationEnabled">
      <NcMenuItemLabel>
        <span class="normal-case"> Automations </span>
      </NcMenuItemLabel>
      <NcMenuItem inner-class="w-full" data-testid="create-new-script" @click="emits('newScript')">
        <GeneralIcon icon="ncScript" />
        New Script
        <div class="flex-1 w-full" />
        <NcBadge :border="false" size="xs" class="!text-brand-600 !bg-brand-50"> Beta </NcBadge>
      </NcMenuItem>
      <NcMenuItem
        inner-class="w-full"
        data-testid="create-new-automation"
        :selectable="false"
        @click.stop="
          () => {
            console.log('clicked')
          }
        "
      >
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
  @apply mx-1 flex flex-row items-center hover:bg-gray-100 rounded-lg;

  .ant-dropdown-menu-submenu-title {
    @apply !px-0 !w-8;
  }
}
</style>
