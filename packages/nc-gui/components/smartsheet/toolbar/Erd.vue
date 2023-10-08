<script lang="ts" setup>
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue'])

const { activeTable } = storeToRefs(useTablesStore())

const vModel = useVModel(props, 'modelValue', emits)
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    size="small"
    :footer="null"
    width="max(900px,60vw)"
    :closable="false"
    wrap-class-name="erd-single-table-modal"
    transition-name="fade"
    :destroy-on-close="true"
  >
    <div class="flex justify-between w-full items-start pb-4 border-b-1 border-gray-50 mb-4">
      <div class="select-none text-gray-900 font-medium text-lg">
        {{ `ERD for "${activeTable?.title}"` }}
      </div>
    </div>

    <div class="w-full h-70vh">
      <LazyErdView :table="activeTable" :source-id="activeTable?.source_id" />
    </div>
  </a-modal>
</template>

<style>
.erd-single-table-modal {
  .ant-modal {
    @apply !top-[50px];
  }
  .ant-modal-body {
    @apply !p-0;
  }
}
</style>
