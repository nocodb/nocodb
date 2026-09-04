<script lang="ts" setup>
import type { IconMapKey } from '~/utils/iconUtils'

interface Props {
  icon?: IconMapKey
  label: string
  trailing?: 'chevron' | 'none'
  disabled?: boolean
  loading?: boolean
  comingSoon?: boolean
  danger?: boolean
  testid?: string
  veKey?: string
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  trailing: 'none',
  disabled: false,
  loading: false,
  comingSoon: false,
  danger: false,
  testid: undefined,
  veKey: undefined,
})

const emits = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const onClick = (event: MouseEvent) => {
  emits('click', event)
}
</script>

<template>
  <button
    v-e="veKey ? [veKey] : undefined"
    type="button"
    :disabled="disabled || comingSoon || loading"
    :data-testid="testid"
    class="nc-share-menu-item w-full flex items-center gap-2 px-3 py-2 mx-1.5 rounded-md text-bodyDefaultSm text-left transition-colors"
    :class="{
      'cursor-pointer hover:bg-nc-bg-gray-light': !disabled && !comingSoon && !danger && !loading,
      'cursor-pointer hover:bg-nc-bg-red-light': danger && !disabled && !loading,
      'cursor-wait': loading,
      'cursor-not-allowed': (disabled || comingSoon) && !loading,
      'opacity-60': disabled && !danger,
      'text-nc-content-red-medium': danger,
      'text-nc-content-gray-extreme': !danger,
    }"
    @click="onClick"
  >
    <GeneralLoader v-if="loading" size="small" class="flex-none !bg-inherit !text-inherit" />
    <GeneralIcon v-else-if="icon" :icon="icon" class="flex-none !w-4 !h-4" />
    <span class="flex-1 truncate">{{ label }}</span>
    <NcBadgeComingSoon v-if="comingSoon" />
    <GeneralIcon
      v-else-if="trailing === 'chevron'"
      icon="ncChevronRight"
      class="flex-none !w-4 !h-4 text-nc-content-gray-subtle2"
    />
  </button>
</template>

<style lang="scss" scoped>
.nc-share-menu-item {
  width: calc(100% - 0.75rem);
}
</style>
