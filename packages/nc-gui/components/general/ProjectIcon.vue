<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type, hoverable } = defineProps<{
  type?: NcProjectType | string
  hoverable?: boolean
}>()
</script>

<template>
  <img
    v-if="type === NcProjectType.DOCS"
    src="~/assets/nc-icons/docs.svg"
    class="text-[#247727] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
  <PhPencilCircleThin
    v-else-if="type === NcProjectType.COWRITER"
    class="text-[#8626FF] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
  <PhFlowArrowThin
    v-else-if="type === NcProjectType.AUTOMATION"
    class="text-[#DDB00F] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
  <img
    v-else-if="type === NcProjectType.DASHBOARD"
    src="~/assets/nc-icons/dashboard.svg"
    class="text-[#DDB00F] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
  <img
    v-else
    src="~/assets/nc-icons/database.svg"
    class="text-[#2824FB] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
</template>

<style scoped>
.nc-project-icon {
  @apply h-6 px-1.5 py-1 text-lg rounded-md;
}
.nc-project-icon-hoverable {
  @apply cursor-pointer !hover:bg-gray-200 !hover:bg-opacity-50;
}
</style>
