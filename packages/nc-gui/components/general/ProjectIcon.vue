<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type } = defineProps<{
  type?: NcProjectType | string
}>()
</script>

<template>
  <PhBookThin v-if="type === NcProjectType.DOCS" class="text-[#247727] bg-[#247727] text-lg p-2px rounded bg-opacity-10" />
  <PhPencilCircleThin v-else-if="type === NcProjectType.COWRITER" class="text-[#8626FF] bg-[#8626FF] text-lg p-2px  rounded bg-opacity-10" />
  <PhFlowArrowThin v-else-if="type === NcProjectType.AUTOMATION" class="text-[#DDB00F] bg-[#DDB00F] text-lg p-2px rounded bg-opacity-10" />
  <PhDatabaseThin v-else class="text-[#2824FB] bg-[#2824FB] text-lg p-2px rounded bg-opacity-10" />
</template>

<style scoped></style>
