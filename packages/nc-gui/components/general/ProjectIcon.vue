<script lang="ts" setup>
import { NcProjectType } from '#imports'

const { type } = defineProps<{
  type?: NcProjectType | string
}>()
</script>

<template>
  <PhBookThin v-if="type === NcProjectType.DOCS" class="text-[#247727] text-sm" />
  <PhPencilCircleThin v-else-if="type === NcProjectType.COWRITER" class="text-[#8626FF] text-sm" />
  <PhFlowArrowThin v-else-if="type === NcProjectType.AUTOMATION" class="text-[#DDB00F] text-sm" />
  <PhDatabaseThin v-else class="text-[#2824FB] text-sm" />
</template>

<style scoped></style>
