<script lang="ts" setup>

/* interface */

const props = defineProps<{
  attachments?: any[],
}>();

const emit = defineEmits([
  'open:file-picker',
]);


const activeAttachmentIndex = defineModel<number>('activeAttachmentIndex', {
  required: true,
});


/* expansion */

const isExpanded = ref(false);

</script>


<template>
  <div
    class="absolute left-0 top-0 bottom-0 bg-white border-r-1 border-gray-200 flex flex-col transition-all duration-500"
    :class="{
      'w-[80px]': !isExpanded,
      'w-[320px]': isExpanded,
    }"
    @mouseenter="isExpanded = true;"
    @mouseleave="isExpanded = false;">
    <div class="flex-1 h-0 flex flex-col items-center justify-center">
      <div class="w-full max-h-full overflow-y-auto scrollbar-thin-dull p-2 pb-6 space-y-2">
        <SmartsheetExpandedFormPresentorsAttachmentsPreviewCell
          v-for="(attachment, index) of props.attachments"
          :key="attachment.id"
          :attachment="attachment"
          :active="activeAttachmentIndex === index"
          :is-expanded="isExpanded"
          @click="activeAttachmentIndex = index"
        />
      </div>
    </div>
    <div>
      <div class="flex items-center border-t-1 border-gray-200 rounded-t-lg overflow-clip">
        <NcButton
          type="text"
          class="w-0 flex-1 !border-r-1 !border-gray-200 !rounded-none"
          :disabled="!props.attachments || activeAttachmentIndex === 0"
          @click="activeAttachmentIndex = activeAttachmentIndex - 1"
        >
          <GeneralIcon icon="chevronUpSmall" />
          <span
            class="ml-2 transition duration-500"
            :class="{
              'invisible absolute opacity-0': !isExpanded,
              'opacity-100': isExpanded,
            }">
            Previous
          </span>
        </NcButton>
        <NcButton
          type="text"
          class="w-0 flex-1 !rounded-none"
          :disabled="!props.attachments || activeAttachmentIndex === props.attachments.length - 1"
          @click="activeAttachmentIndex = activeAttachmentIndex + 1"
        >
          <GeneralIcon icon="chevronDownSmall" />
          <span
            class="ml-2 transition duration-500"
            :class="{
              'invisible absolute opacity-0': !isExpanded,
              'opacity-100': isExpanded,
            }">
            Next
          </span>
        </NcButton>
      </div>
      <NcButton type="text" class="w-full !rounded-none !border-t-1 !border-gray-200 !h-16" @click="emit('open:file-picker')">
        <div class="flex flex-col items-center">
          <GeneralIcon icon="plus" />
          <span class="mt-2">
            Add file(s)
          </span>
        </div>
      </NcButton>
    </div>
  </div>
</template>