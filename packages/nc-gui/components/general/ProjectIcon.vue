<script lang="ts" setup>
import tinycolor from 'tinycolor2'

const props = withDefaults(
  defineProps<{
    type?: string
    hoverable?: boolean
    color?: string
  }>(),
  {
    color: baseIconColors[0],
  },
)
const { color } = toRefs(props)

const iconColor = computed(() => {
  return color.value && tinycolor(color.value).isValid()
    ? {
        tint: baseIconColors.includes(color.value) ? color.value : tinycolor(color.value).lighten(10).toHexString(),
        shade: tinycolor(color.value).darken(40).toHexString(),
      }
    : {
        tint: baseIconColors[0],
        shade: tinycolor(baseIconColors[0]).darken(40).toHexString(),
      }
})
</script>

<template>
  <svg
    width="16"
    height="16"
    viewBox="0 0 1073 1073"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="text-[#2824FB] base"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  >
    <mask id="mask0_1749_80944" style="mask-type: luminance" maskUnits="userSpaceOnUse" x="94" y="40" width="885" height="993">
      <path d="M978.723 40H94V1033H978.723V40Z" fill="white" />
    </mask>
    <g mask="url(#mask0_1749_80944)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M638.951 291.265L936.342 462.949C966.129 480.145 980.256 502.958 978.723 525.482V774.266C980.256 796.789 966.129 819.602 936.342 836.798L638.951 1008.48C582.292 1041.19 490.431 1041.19 433.773 1008.48L136.381 836.798C106.595 819.602 92.4675 796.789 93.9999 774.266L93.9999 525.482C92.4675 502.957 106.595 480.145 136.381 462.949L433.773 291.265C490.431 258.556 582.292 258.556 638.951 291.265Z"
        :fill="iconColor.shade"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M638.951 65.0055L936.342 236.69C966.129 253.886 980.256 276.699 978.723 299.222V548.006C980.256 570.529 966.129 593.343 936.342 610.538L638.951 782.223C582.292 814.931 490.431 814.931 433.773 782.223L136.381 610.538C106.595 593.343 92.4675 570.529 93.9999 548.006L93.9999 299.222C92.4675 276.699 106.595 253.886 136.381 236.69L433.773 65.0055C490.431 32.2968 582.292 32.2968 638.951 65.0055Z"
        :fill="iconColor.tint"
      />
    </g>
  </svg>
</template>

<style scoped>
.nc-base-icon {
  @apply text-xl;
}
.nc-base-icon-hoverable {
  @apply cursor-pointer !hover:bg-gray-200 !hover:bg-opacity-50;
}
</style>
