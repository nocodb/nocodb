<script setup lang="ts">

import dayjs from 'dayjs'

/* interface */

const props = defineProps<{
  auditGroup: any
}>()

/* formatting */

function formatDateToRelative(date: string) {
  return dayjs(date).fromNow()
}

</script>

<template>
  <div>
    <div class="flex items-center h-[32px] mb-1 relative">
      <GeneralIcon icon="pencil" class="w-[24px] h-[24px] p-1 text-gray-500 absolute -left-6 transform -translate-x-1/2 bg-white rounded-full border border-1 border-gray-300 shadow" />
      <p class="text-sm font-medium mb-0">
        {{ props.auditGroup.displayName }} {{ props.auditGroup.audits[0]?.op_sub_type === 'UPDATE' ? 'Updated' : 'Created' }} {{ props.auditGroup.audits.length }} fields
      </p>
      <div class="text-xs text-gray-500 ml-4">
        {{ formatDateToRelative(props.auditGroup.audits[0]?.created_at) }}
      </div>
    </div>
    <div v-for="audit in props.auditGroup.audits" :key="audit.id" class="relative">
      <GeneralIcon icon="ncLink" class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 -left-6 transform -translate-y-1/2 -translate-x-1/2" />
      <p class="text-sm mb-1">
        {{ audit.description }}
      </p>
    </div>
  </div>
</template>
