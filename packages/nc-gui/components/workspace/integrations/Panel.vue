<script lang="ts" setup>
import type { iconMap } from '#imports'

const props = withDefaults(
  defineProps<{
    title: string
    icon?: keyof typeof iconMap
    collapsible?: boolean
    collapsed?: boolean
  }>(),
  {
    collapsible: false,
    collapsed: true,
  },
)

const panelRef = ref<HTMLElement | null>(null)

const collapsed = ref(props.collapsible ? props.collapsed : false)

const toggleCollapse = () => {
  if (!props.collapsible) return
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div ref="panelRef" class="panel" :data-label="props.title" :data-icon="props.icon">
    <div class="flex items-center gap-2" @click="toggleCollapse">
      <template v-if="props.collapsible">
        <GeneralIcon :icon="collapsed ? 'arrowRight' : 'arrowDown'" />
      </template>
      <GeneralIcon v-else-if="props.icon" :icon="props.icon" />
      <div class="panel-label" :class="{ 'cursor-pointer': props.collapsible, 'cursor-default': !props.collapsible }">
        {{ props.title }}
      </div>
      <slot name="header-info"></slot>
    </div>
    <div v-if="!collapsed" class="panel-body"><slot></slot></div>
  </div>
</template>

<style lang="scss" scoped>
.panel {
  @apply border-1 border-gray-200 px-6 py-4 rounded-lg mb-4;

  .panel-label {
    @apply text-md font-weight-bold flex-1;
  }

  .panel-body {
    @apply mt-4;
  }
}
</style>
