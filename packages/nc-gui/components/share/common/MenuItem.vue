<script lang="ts" setup>
import type { IconMapKey } from '~/utils/iconUtils'

interface Props {
  icon?: IconMapKey
  /** When true (default) the icon is wrapped in a rounded square badge. */
  iconBadge?: boolean
  label: string
  hint?: string
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
  iconBadge: true,
  hint: undefined,
  trailing: 'none',
  disabled: false,
  loading: false,
  comingSoon: false,
  danger: false,
  testid: undefined,
  veKey: undefined,
})

defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<template>
  <button
    v-e="veKey ? [veKey] : undefined"
    type="button"
    :disabled="disabled || comingSoon || loading"
    :data-testid="testid"
    class="nc-share-menu-item w-full flex items-center gap-3 px-3 py-2 text-bodyDefaultSm text-left transition-colors"
    :class="{
      'cursor-pointer hover:bg-nc-bg-gray-light': !disabled && !comingSoon && !danger && !loading,
      'cursor-pointer hover:bg-nc-bg-red-light': danger && !disabled && !loading,
      'cursor-wait': loading,
      'cursor-not-allowed': (disabled || comingSoon) && !loading,
      'opacity-60': disabled && !danger,
      'text-nc-content-red-medium': danger,
      'text-nc-content-gray-extreme': !danger,
    }"
    @click="(event) => $emit('click', event)"
  >
    <template v-if="loading">
      <GeneralLoader size="small" class="flex-none !bg-inherit !text-inherit" />
    </template>
    <template v-else-if="icon">
      <div
        v-if="iconBadge && !danger"
        class="nc-share-menu-item-badge flex-none flex items-center justify-center rounded-md bg-nc-bg-gray-extralight"
      >
        <GeneralIcon :icon="icon" class="!w-4 !h-4 text-nc-content-gray-subtle2" />
      </div>
      <GeneralIcon v-else :icon="icon" class="flex-none !w-4 !h-4" />
    </template>
    <div class="flex flex-col flex-1 min-w-0">
      <span class="truncate font-weight-600">{{ label }}</span>
      <span v-if="hint" class="text-bodySm text-nc-content-gray-subtle leading-snug mt-0.5 truncate">
        {{ hint }}
      </span>
    </div>
    <NcBadgeComingSoon v-if="comingSoon" />
    <GeneralIcon
      v-else-if="trailing === 'chevron'"
      icon="ncChevronRight"
      class="flex-none !w-4 !h-4 text-nc-content-gray-muted"
    />
  </button>
</template>

<style lang="scss" scoped>
.nc-share-menu-item-badge {
  width: 32px;
  height: 32px;
}
</style>
