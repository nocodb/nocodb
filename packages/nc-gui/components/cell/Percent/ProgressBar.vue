<script setup lang="ts">
interface Props {
  percentage: number
  isShowNumber?: boolean
  onFocus?: (event: any) => void
}
const props = defineProps<Props>()
const cPercentage = computed(() => Math.max(0, Math.min(100, props.percentage)))
const labelMarginLeft = computed<number>(() => {
  return Math.max(1, Math.min(props.percentage / 2, 50))
})
</script>

<template>
  <div
    tabindex="0"
    class="flex h-full w-full progress-container"
    style="align-self: stretch; justify-self: stretch"
    @focus="onFocus"
  >
    <div class="input">
      <slot></slot>
    </div>
    <div class="h-full w-full progress-bar flex" style="align-self: stretch; border-radius: 9999px; overflow: hidden">
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
.progress-container:not(:focus-within) > div.input:not(:focus-within) {
  visibility: collapse;
  display: none;
}
.progress-container:focus-within > div.progress-bar {
  visibility: collapse;
  display: none;
}
</style>
