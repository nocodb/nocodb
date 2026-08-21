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
  // inline-flex, not flex: a block-level tag stretches to the full option row
  // instead of hugging its label. Padding matches `.rounded-tag` in the select cells.
  @apply py-[0.5px] px-2 rounded-[12px] my-[1px] inline-flex items-center max-w-full;
}

.nc-select-option-tag-close {
  @apply ml-1 cursor-pointer transition-all transition-ease-in-out !text-xs text-nc-content-gray-muted;

  &:hover {
    @apply text-nc-content-gray-subtle2;
  }
}
</style>
