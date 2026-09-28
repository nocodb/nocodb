<script lang="ts" setup>
/**
 * NcTooltipItem
 *
 * A trigger for the shared popup an `NcTooltipProvider glide` owns, so hovering
 * along a row of them slides one tooltip between them instead of popping a new
 * one at each stop.
 *
 * Outside a glide provider it renders an ordinary `NcTooltip`, so it is safe to
 * use on its own and the group can be added later.
 *
 * @example
 * ```vue
 * <NcTooltipProvider glide :delay="200">
 *   <NcTooltipItem v-for="p of providers" :key="p.type" :title="p.title">
 *     <GeneralIntegrationIcon :type="p.type" />
 *   </NcTooltipItem>
 * </NcTooltipProvider>
 * ```
 */
interface Props {
  title: string
  disabled?: boolean
  /** Seconds, matching `NcTooltip`'s prop; the provider overrides it while warm. */
  mouseEnterDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const group = inject(TooltipProviderInj, null)

const glide = computed(() => (props.disabled ? undefined : group?.glide))

const el = ref<HTMLElement>()

const isHovering = useElementHover(() => el.value)

let timer: ReturnType<typeof setTimeout> | undefined

watch(isHovering, (hovering) => {
  clearTimeout(timer)

  const anchor = el.value
  if (!glide.value || !anchor) return

  const own = props.mouseEnterDelay ? props.mouseEnterDelay * 1000 : 0
  const delay = hovering ? group?.enterDelay(own) ?? own : group?.closeDelay ?? 0

  const run = () => {
    if (hovering) {
      glide.value?.show(anchor, props.title)
      group?.onOpen()
    } else {
      glide.value?.hide(anchor)
      group?.onClose()
    }
  }

  if (!delay) return run()

  timer = setTimeout(run, delay)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  if (el.value) glide.value?.hide(el.value)
})
</script>

<template>
  <div v-if="glide" ref="el" class="nc-tooltip-item">
    <slot />
  </div>

  <NcTooltip v-else :title="title" :disabled="disabled" :mouse-enter-delay="mouseEnterDelay">
    <slot />
  </NcTooltip>
</template>

<style lang="scss" scoped>
// `display: contents` would leave nothing to measure for placement, so the
// wrapper is a real box that lays out exactly like its child.
.nc-tooltip-item {
  @apply inline-flex;
}
</style>
