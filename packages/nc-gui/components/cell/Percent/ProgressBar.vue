<script setup lang="ts">
interface Props {
  percentage: number
  isShowNumber?: boolean
}
const props = defineProps<Props>()
const emit = defineEmits(['focus', 'submit'])
const cPercentage = computed(() => Math.max(0, Math.min(100, props.percentage)))
const labelMarginLeft = computed<number>(() => {
  return Math.max(1, Math.min(props.percentage / 2, 50))
})
const onContainerFocus = (e: FocusEvent) => {
  emit('focus', e)
}
</script>

<template>
  <div
    tabindex="0"
    class="flex w-full progress-container min-h-[4px]"
    style="align-self: stretch; justify-self: stretch; height: 100%"
    @focus="onContainerFocus"
  >
    <div class="progress-bar-input">
      <slot></slot>
    </div>
    <div class="w-full progress-bar flex" style="align-self: stretch; border-radius: 9999px; overflow: hidden">
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
.progress-container:not(:focus-within) > div.progress-bar-input:not(:focus-within) {
  visibility: collapse;
  display: none;
}
.progress-container:focus-within > div.progress-bar {
  visibility: collapse;
  display: none;
}
</style>
