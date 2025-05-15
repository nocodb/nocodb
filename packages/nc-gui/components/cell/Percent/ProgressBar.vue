<script setup lang="ts">
interface Props {
  percentage: number
  isShowNumber?: boolean
}

const props = defineProps<Props>()

const cPercentage = computed(() => Math.max(0, Math.min(100, props.percentage)))

const labelMarginLeft = computed<number>(() => {
  return Math.max(1, Math.min(props.percentage / 2, 50))
})

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
    <div class="w-full progress-bar flex" style="align-self: stretch; border-radius: 9999px; overflow: hidden; height: 100%">
      <div style="align-self: stretch; background-color: #3366ff" :style="{ width: `${cPercentage}%` }"></div>
      <div style="align-self: stretch; background-color: #e5e5e5" :style="{ width: `${100 - cPercentage}%` }"></div>
      <template v-if="isShowNumber">
        <div style="position: absolute" :style="{ 'margin-left': `${labelMarginLeft}%` }">
          <span
            style="mix-blend-mode: difference; color: #ffffff"
            :style="{
              'margin-left': `${-Math.min(percentage, 50)}%`,
            }"
          >
            {{ `${percentage}%` }}
          </span>
        </div>
        <div style="position: absolute" :style="{ 'margin-left': `${labelMarginLeft}%` }">
          <span
            style="mix-blend-mode: overlay; color: #ffffff"
            :style="{
              'margin-left': `${-Math.min(percentage, 50)}%`,
            }"
          >
            {{ `${percentage}%` }}
          </span>
        </div>
      </template>
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
