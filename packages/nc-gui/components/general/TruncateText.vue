<script lang="ts" setup>
import type { TooltipPlacement } from 'ant-design-vue/es/tooltip'

interface Props {
  placement?: TooltipPlacement
  length?: number
}

const { placement = 'bottom', length = 20 } = defineProps<Props>()

const text = ref<HTMLDivElement>()

const enableTooltip = computed(() => text.value?.textContent?.length && text.value?.textContent?.length > length)

const shortName = computed(() =>
  text.value?.textContent?.length && text.value?.textContent.length > length
    ? `${text.value?.textContent?.substr(0, length - 3)}...`
    : text.value?.textContent,
)
</script>

<template>
  <NcTooltip v-if="enableTooltip" :placement="placement">
    <template #title>
      <slot />
    </template>
    <div class="w-full">{{ shortName }}</div>
  </NcTooltip>
  <div v-else class="w-full" data-testid="truncate-label">
    <slot />
  </div>
  <div ref="text" class="hidden"><slot /></div>
</template>
