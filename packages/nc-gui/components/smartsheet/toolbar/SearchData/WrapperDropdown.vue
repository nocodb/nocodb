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
    placement="bottomRight"
    overlay-class-name="nc-dropdown-toolbar-search !border-primary !shadow-selected overflow-hidden !z-1000"
  >
    <div class="absolute -right-1 -top-5"></div>
    <template #overlay>
      <slot />
    </template>
  </NcDropdown>
</template>
