<script setup lang="ts">
interface Props {
  percentage: number
  isShowNumber?: boolean
  precision?: number
}

const props = withDefaults(defineProps<Props>(), {
  precision: 2,
})

const cPercentage = computed(() => Math.max(0, Math.min(100, props.percentage)))

const slots = useSlots()

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}
</script>

<template>
  <div
    class="flex flex-col w-full progress-container min-h-[4px]"
    style="align-self: stretch; justify-self: stretch; height: 100%; border-radius: 9999px"
  >
    <div class="progress-bar-input" :class="slotHasChildren() ? 'has-child' : ''">
      <slot></slot>
    </div>
    <div class="progress-bar flex items-center gap-2 w-full h-full" :class="{ 'min-h-[16px]': isShowNumber }">
      <div class="relative flex-1 flex rounded-full overflow-hidden self-center" :class="isShowNumber ? 'h-full' : 'h-[6px]'">
        <div class="bg-nc-brand-500" style="align-self: stretch" :style="{ width: `${cPercentage}%` }"></div>
        <div
          class="bg-[#e5e5e5] dark:bg-nc-bg-brand-inverted"
          style="align-self: stretch"
          :style="{ width: `${100 - cPercentage}%` }"
        ></div>
        <template v-if="isShowNumber">
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="text-captionSm leading-none" style="mix-blend-mode: difference; color: #ffffff">
              {{ `${formatPercentage(percentage, precision)}` }}
            </span>
          </div>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="text-captionSm leading-none" style="mix-blend-mode: overlay; color: #ffffff">
              {{ `${formatPercentage(percentage, precision)}` }}
            </span>
          </div>
        </template>
      </div>
      <div v-if="!isShowNumber" class="text-captionSm text-nc-content-gray-muted">
        {{ `${formatPercentage(percentage, precision)}` }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress-container:not(:focus-within):not(:hover) > div.progress-bar-input:not(:focus-within):not(:hover) {
  position: absolute;
  top: 0px;
  max-height: 0px !important;
  overflow-y: hidden;
}
.progress-container:focus-within > div.progress-bar-input.has-child,
.progress-container:hover > div.progress-bar-input.has-child {
  position: relative;
  width: 100%;
  max-height: 100%;
  height: 100%;
  overflow-y: hidden;
  transition: max-height 0.1s ease-in;
}

.progress-container:focus-within:has(div.progress-bar-input.has-child) > div.progress-bar,
.progress-container:hover:has(div.progress-bar-input.has-child) > div.progress-bar {
  visibility: collapse;
  opacity: 0;
  display: none;
  transition: visibility 0.1s ease-out, opacity 0.1s ease-out, display 0.1s allow-discrete;
}
</style>
