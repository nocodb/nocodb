<script lang="ts" setup>
defineProps<{
  values: any[]
}>()

const selected = defineModel()
</script>

<template>
  <div class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5 nc-view-sidebar-tab">
    <div
      v-for="value in values"
      :key="value"
      class="tab flex-1"
      :class="{
        active: value === selected,
      }"
      @click="selected = value"
    >
      <div class="tab-title nc-tab">
        <slot :value="value">{{ value }}</slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab {
  @apply flex flex-row items-center h-6 justify-center px-2 py-1 rounded-md gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  @apply w-4 !text-base;
}
.tab .tab-title {
  @apply min-w-0 break-keep whitespace-nowrap inline leading-[0.95];
}

.active {
  @apply bg-white font-600 text-nc-content-gray-emphasis;
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
