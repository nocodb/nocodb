<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type } = defineProps<{
  type?: NcProjectType | string
}>()
</script>

<template>
  <img v-if="type === NcProjectType.DOCS" src="~/assets/nc-icons/docs.svg" class="text-[#247727] nc-project-icon" />
  <PhPencilCircleThin v-else-if="type === NcProjectType.COWRITER" class="text-[#8626FF] nc-project-icon" />
  <PhFlowArrowThin v-else-if="type === NcProjectType.AUTOMATION" class="text-[#DDB00F] nc-project-icon" />
  <img
    v-else-if="type === NcProjectType.DASHBOARD"
    src="~/assets/nc-icons/dashboard.svg"
    class="text-[#DDB00F] nc-project-icon"
  />
  <img v-else src="~/assets/nc-icons/database.svg" class="text-[#2824FB] nc-project-icon" />
</template>

<style scoped>
.nc-project-icon {
  @apply h-6 px-1.5 py-1 text-lg rounded-md !hover:bg-gray-300 !hover:bg-opacity-50;
}
</style>
