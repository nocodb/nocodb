<script lang="ts" setup>
interface Props {
  items: Record<string, any>[]
  labelKey?: string
  iconWidth?: number
  paddingX?: number
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  labelKey: 'label',
  iconWidth: 24,
  paddingX: 16,
})

const { items } = toRefs(props)

const containerRef = ref<HTMLElement | null>(null)

const visibleItems = ref<Props['items']>([])

const hiddenCount = ref(0)

async function calculateVisibleItems() {
  await nextTick()

  const containerWidth = containerRef.value?.offsetWidth ? containerRef.value.offsetWidth - 100 : 0
  let usedWidth = 0
  let count = 0

  for (const item of items.value || []) {
    const tagWidth = Math.min(
      estimateTagWidth({
        text: item[props.labelKey] ?? '',
        iconWidth: props.iconWidth,
        paddingX: props.paddingX,
      }),
      items.value.length === 1 ? containerWidth : containerWidth / 2,
    )

    if (usedWidth + tagWidth <= containerWidth) {
      usedWidth += tagWidth + 10
      count++
    } else {
      break
    }
  }

  visibleItems.value = items.value.slice(0, count)
  hiddenCount.value = items.value.length - count
}

onMounted(() => {
  window.addEventListener('resize', calculateVisibleItems)
  calculateVisibleItems()
})

watch(items, () => {
  calculateVisibleItems()
})
</script>

<template>
  <div ref="containerRef" class="flex items-center gap-2 flex-1 overflow-hidden">
    <slot name="default" :visible-items="visibleItems" :hidden-count="hiddenCount"></slot>

    <slot name="more" :hidden-count="hiddenCount">
      <!-- Show +X more if there are additional items -->
      <div v-if="hiddenCount > 0" class="flex items-center gap-1 pr-2 py-0.5 !text-caption text-nc-content-gray-subtle2 truncate">
        +{{ hiddenCount }} more
      </div>
    </slot>
  </div>
</template>
