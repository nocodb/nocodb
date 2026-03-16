<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  name: string
  icon?: string
  iconComponent?: Component
  clickable?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  iconComponent: undefined,
  clickable: false,
})

const emits = defineEmits<{
  click: []
}>()
</script>

<template>
  <span
    class="nc-chat-entity-mention inline-flex gap-1 rounded-md transition-colors duration-150 ease-in-out"
    :class="clickable ? 'cursor-pointer' : 'border-transparent'"
    @click="clickable && emits('click')"
  >
    <slot name="icon">
      <component :is="iconComponent" v-if="iconComponent" class="flex-none w-3.5 h-3.5 text-nc-content-gray-emphasis" />
      <GeneralIcon v-else-if="icon" :icon="icon" class="flex-none w-3.5 h-3.5 text-nc-content-gray-emphasis" />
    </slot>

    <NcTooltip
      :title="name"
      show-on-truncate-only
      class="truncate text-nc-content-gray-emphasis text-bodyDefaultSmBold underline underline-dotted underline-offset-2 max-w-[160px]"
    >
      <template #default>
        {{ name }}
      </template>
    </NcTooltip>

    <slot name="suffix" />
  </span>
</template>

<style lang="scss" scoped></style>
