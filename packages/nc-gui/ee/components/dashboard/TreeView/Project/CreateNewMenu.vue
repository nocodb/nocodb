<script lang="ts" setup>
interface Props {
  visible: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['@update:visible', 'newTable', 'newScript'])

const vVisible = useVModel(props, 'visible', emits)

const {} = toRefs(props)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))
</script>

<template>
  <NcMenu variant="medium" @click="vVisible = false">
    <NcSubMenu
      class="py-0"
      data-testid="mini-sidebar-view-create"
      variant="small"
      @click="emits('newTable')"
      inner-class="w-full"
    >
      <template #title>
        <GeneralIcon icon="table" />
        New Table
      </template>
      <NcMenuItemLabel>
        <span class="normal-case"> Import Options </span>
      </NcMenuItemLabel>
      <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard">
        <GeneralIcon icon="ncImport" class="!w-4 !h-4" />
        Import from CSV
      </NcMenuItem>
    </NcSubMenu>
    <NcMenuItem inner-class="w-full !opacity-100" data-testid="create-new-dashboard" @click.stop disabled>
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
      <NcMenuItem inner-class="w-full" data-testid="create-new-automation" disabled>
        <GeneralIcon icon="ncScript" />
        Automation
        <div class="flex-1 w-full" />
        <NcBadge :border="false" size="xs" class="!text-brand-600 !bg-brand-50"> Soon </NcBadge>
      </NcMenuItem>
    </template>
  </NcMenu>
</template>

<style lang="scss" scoped></style>
