<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type } = defineProps<{
  type?: NcProjectType | string
}>()
</script>

<template>
  <GeneralIcon v-if="type === NcProjectType.DOCS" icon="doc" class="text-[#247727] text-lg p-1px rounded bg-opacity-5 !px-1" />
  <PhPencilCircleThin v-else-if="type === NcProjectType.COWRITER" class="text-[#8626FF] text-lg p-2px rounded bg-opacity-5" />
  <PhFlowArrowThin v-else-if="type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-lg p-2px rounded bg-opacity-5" />
  <PhPenThin v-else-if="type === NcProjectType.DASHBOARD" class="text-[#DDB00F] text-lg p-2px rounded bg-opacity-5 my-1" />
  <GeneralIcon v-else icon="database" class="text-[#2824FB] text-lg p-1px rounded bg-opacity-5 !px-1" />
</template>

<style scoped></style>
