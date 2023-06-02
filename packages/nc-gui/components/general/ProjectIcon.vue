<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type } = defineProps<{
  type?: NcProjectType | string
}>()
</script>

<template>
  <img
    v-if="type === NcProjectType.DOCS"
    src="~/assets/nc-icons/docs.svg"
    class="text-[#247727] text-lg p-1px rounded bg-opacity-5 !px-1"
  />
  <PhPencilCircleThin v-else-if="type === NcProjectType.COWRITER" class="text-[#8626FF] text-lg p-2px rounded bg-opacity-5" />
  <PhFlowArrowThin v-else-if="type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-lg p-2px rounded bg-opacity-5" />
  <img
    v-else-if="type === NcProjectType.DASHBOARD"
    src="~/assets/nc-icons/dashboard.svg"
    class="text-[#DDB00F] text-lg p-2px rounded bg-opacity-5 mx-0.5"
  />
  <img v-else src="~/assets/nc-icons/database.svg" class="text-[#2824FB] text-lg p-1px rounded bg-opacity-5 !px-1" />
</template>

<style scoped></style>
