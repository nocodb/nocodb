<script lang="ts" setup>
import { computed, ref } from '#imports'

interface Props {
  placement?:
    | 'top'
    | 'left'
    | 'right'
    | 'bottom'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'leftTop'
    | 'leftBottom'
    | 'rightTop'
    | 'rightBottom'
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
  <a-tooltip v-if="enableTooltip" :placement="placement">
    <template #title>
      <slot />
    </template>
    <div class="w-full">{{ shortName }}</div>
  </a-tooltip>
  <div v-else class="w-full" data-testid="truncate-label">
    <slot />
  </div>
  <div ref="text" class="hidden">
    <slot />
  </div>
</template>
