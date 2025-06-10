<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const { isMobileMode } = useGlobal()
</script>

<template>
  <slot v-if="isMobileMode" />
  <NcDropdown
    v-else
    :visible="visible"
    :trigger="['click']"
    placement="bottomLeft"
    overlay-class-name="nc-dropdown-toolbar-search !border-primary !shadow-selected overflow-hidden"
  >
    <div class="absolute -right-1 -top-4"></div>
    <template #overlay>
      <slot />
    </template>
  </NcDropdown>
</template>
