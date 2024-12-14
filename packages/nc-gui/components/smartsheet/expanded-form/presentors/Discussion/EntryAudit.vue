<script setup lang="ts">
/* interface */

const props = defineProps<{
  auditGroup: any
}>()
</script>

<template>
  <div class="py-4 mx-6 border-l border-gray-200">
    <div class="flex items-center h-[32px] gap-2 mb-3">
      <GeneralIcon
        icon="pencil"
        class="w-[28px] h-[28px] p-1 text-gray-500 bg-white rounded-full border border-1 border-gray-300 shadow -ml-3.5"
      />
      <GeneralUserIcon :email="props.auditGroup.user" class="w-[24px] aspect-square ml-1" />
      <p class="text-sm font-medium mb-0">
        {{ props.auditGroup.displayName }} {{ props.auditGroup.audits[0]?.op_sub_type === 'UPDATE' ? 'Updated' : 'Created' }}
        {{ props.auditGroup.audits.length }} fields
      </p>
      <div class="text-xs text-gray-500">
        {{ timeAgo(props.auditGroup.audits[0]?.created_at) }}
      </div>
    </div>
    <template v-if="props.auditGroup.audits[0]?.op_sub_type === 'INSERT'">
      <div v-for="audit in props.auditGroup.audits" :key="audit.id" class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <p class="text-sm mb-1 ml-6.5">
          {{ audit.description }}
        </p>
      </div>
    </template>
    <template v-else>
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <div class="text-sm mb-1 ml-6.5">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellText" class="w-[12px] h-[12px]" />
            Title
          </span>
          <span class="line-through"> Initial value </span>
          <span class="ml-2"> New value </span>
        </div>
      </div>
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <div class="text-sm mb-1 ml-6.5">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellEmail" class="w-[12px] h-[12px]" />
            Email
          </span>
          <span class="line-through"> yooneskh@gmail.com </span>
          <span class="ml-2"> yooneskh@nocodb.com </span>
        </div>
      </div>
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <div class="text-sm mb-1 ml-6.5">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellLongText" class="w-[12px] h-[12px]" />
            Description
          </span>
          <span class="line-through"> Lorem ipsum dolor sit amet consectetur adipisicing elit. Iste, dolores, </span>
          <span class="text-primary">...more</span>
          <span class="mx-2"> to </span>
          <span class="ml-2"> lorem ipsum dolor sit amet </span>
          <span class="text-primary">...more</span>
        </div>
      </div>
      <div class="relative mb-2">
        <GeneralIcon
          icon="ncLink"
          class="w-[12px] h-[12px] text-gray-500 absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2"
        />
        <div class="text-sm mb-1 ml-6.5">
          changed
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-1 mr-3"
          >
            <GeneralIcon icon="cellSingleSelect" class="w-[12px] h-[12px]" />
            Status
          </span>
          <span
            class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-blue-200 inline-flex items-center gap-1 line-through"
          >
            Open
          </span>
          <span class="ml-2 text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-green-200 inline-flex items-center gap-1">
            Closed
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
