<script lang="ts" setup>
/**
 * @description
 * Tabbed select component
 *
 * @example
 * <NcSelectTab :items="items" v-model="modelValue" />
 */

interface Props {
  disabled?: boolean
  tooltip?: string
  items: {
    icon: keyof typeof iconMap
    title?: string
    tooltip?: string
    value: string
    hidden?: boolean
  }[]
}

const props = defineProps<Props>()

const modelValue = defineModel<string>()
</script>

<template>
  <NcTooltip :disabled="!props.tooltip">
    <template #title>
      {{ props.tooltip }}
    </template>
    <div
      class="flex flex-row p-1 bg-gray-200 rounded-lg gap-x-0.5"
      :class="{
        '!cursor-not-allowed opacity-50': props.disabled,
      }"
    >
      <NcTooltip
        v-for="item of props.items.filter((it) => !it.hidden)"
        :key="item.value"
        :disabled="!item.tooltip || props.disabled"
      >
        <template #title>{{ item.tooltip }}</template>
        <div
          v-e="[`c:project:mode:${item.value}`]"
          class="tab"
          :class="{
            'pointer-events-none': props.disabled,
            'active': modelValue === item.value,
          }"
          @click="modelValue = item.value"
        >
          <GeneralIcon :icon="item.icon" class="tab-icon" />
          <div v-if="item.title" class="tab-title nc-tab">
            {{ $t(item.title) }}
          </div>
        </div>
      </NcTooltip>
    </div>
  </NcTooltip>
</template>

<style scoped>
.tab {
  @apply flex flex-row items-center h-6 justify-center px-2 py-1 rounded-md gap-x-2 text-gray-600 hover:text-black cursor-pointer transition-all duration-300 select-none;
}

.tab-icon {
  font-size: 1rem !important;
  @apply w-4;
}
.tab .tab-title {
  @apply min-w-0;
  word-break: keep-all;
  white-space: nowrap;
  display: inline;
  line-height: 0.95;
}

.active {
  @apply bg-white text-brand-600 hover:text-brand-600;

  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}
</style>
