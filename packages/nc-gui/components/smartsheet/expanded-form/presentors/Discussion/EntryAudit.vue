<script setup lang="ts">

/* interface */

const props = defineProps<{
  auditGroup: any
}>()

</script>

<template>
  <div class="py-4 mx-6 border-l border-gray-200">
    <div class="flex items-center h-[32px] gap-2 mb-3">
      <GeneralIcon icon="pencil" class="w-[28px] h-[28px] p-1 text-gray-500 bg-white rounded-full border border-1 border-gray-300 shadow -ml-3.5" />
      <GeneralUserIcon :email="props.auditGroup.user" class="w-[24px] aspect-square ml-1" />
      <p class="text-sm font-medium mb-0">
        {{ props.auditGroup.displayName }} {{ props.auditGroup.audits[0]?.op_sub_type === 'UPDATE' ? 'Updated' : 'Created' }} {{ props.auditGroup.audits.length }} fields
      </p>
      <div class="text-xs text-gray-500">
        {{ timeAgo(props.auditGroup.audits[0]?.created_at) }}
      </div>
    </div>
    <div v-for="audit in props.auditGroup.audits" :key="audit.id" class="relative mb-2">
      <GeneralIcon icon="ncLink" class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2" />
      <p class="text-sm mb-1 ml-6.5">
        {{ audit.description }}
      </p>
    </div>
  </div>
</template>
