<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { NcProjectType } from '#imports'

const props = withDefaults(
  defineProps<{
    type?: NcProjectType | string
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
  <img
    v-if="type === NcProjectType.DOCS"
    src="~/assets/nc-icons/docs.svg"
    class="text-[#247727] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
  <PhPencilCircleThin
    v-else-if="type === NcProjectType.COWRITER"
    class="text-[#8626FF] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
  <PhFlowArrowThin
    v-else-if="type === NcProjectType.AUTOMATION"
    class="text-[#DDB00F] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
  <img
    v-else-if="type === NcProjectType.DASHBOARD"
    src="~/assets/nc-icons/dashboard.svg"
    class="text-[#DDB00F] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    class="text-[#2824FB] nc-base-icon"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  >
    <path
      d="M20.9561 16.9326C20.9445 17.1394 20.7656 17.3451 20.4189 17.5029L13.2764 20.7549C12.5592 21.0813 11.3968 21.0813 10.6797 20.7549L3.53711 17.5029C3.19045 17.3451 3.01152 17.1394 3 16.9326H3.00293V10.9326H21.0029V16.9326H20.9561Z"
      :fill="iconColor.shade"
    />
    <path
      d="M21 12C20.9882 12.2033 20.8082 12.4054 20.4609 12.5605L13.3018 15.7588C12.5829 16.0799 11.4172 16.0799 10.6982 15.7588L3.53906 12.5605C3.19181 12.4054 3.01181 12.2033 3 12H21ZM10.6982 3.23926C11.4171 2.91975 12.5829 2.91975 13.3018 3.23926L20.4609 6.4209C20.8201 6.58052 20.9997 6.78982 21 6.99902H21.0068V11.999H3.00684V7.06055C2.9683 6.83124 3.14454 6.59625 3.53906 6.4209L10.6982 3.23926Z"
      :fill="iconColor.tint"
    />
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
