<script setup lang="ts">
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  title: string
  /** Option colour from `colOptions`. Omit for a neutral, theme-following chip. */
  color?: string
  /** Mirrors the column's `meta.isColorCodeEnabled` — when false the chip renders neutral. */
  isColorCodeEnabled?: boolean
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isColorCodeEnabled: true,
  closable: false,
})

const emits = defineEmits<{
  close: []
}>()

const { isDark, getColor } = useTheme()

const bgColor = computed(() =>
  getSelectTypeFieldOptionBgColor({
    color: props.color,
    isDark: isDark.value,
    getColor,
    isColorCodeEnabled: props.isColorCodeEnabled,
  }),
)

const textColor = computed(() =>
  getSelectTypeFieldOptionTextColor({
    color: props.color,
    isDark: isDark.value,
    getColor,
    isColorCodeEnabled: props.isColorCodeEnabled,
  }),
)
</script>

<template>
  <a-tag
    class="nc-select-option-tag max-w-full"
    :color="bgColor"
    :closable="closable"
    :close-icon="h(MdiCloseCircle, { class: ['nc-select-option-tag-close'] })"
    @close="emits('close')"
  >
    <NcTooltip class="truncate max-w-full" show-on-truncate-only>
      <template #title>{{ title }}</template>
      <span class="text-small" :style="{ color: textColor }">{{ title }}</span>
    </NcTooltip>
  </a-tag>
</template>

<style scoped lang="scss">
.nc-select-option-tag {
  @apply py-0 px-2 rounded-[12px] my-[2px] flex items-center;
}

.nc-select-option-tag-close {
  @apply ml-1 cursor-pointer transition-all transition-ease-in-out !text-xs text-nc-content-gray-muted;

  &:hover {
    @apply text-nc-content-gray-subtle2;
  }
}
</style>
