<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  tableId: string
  title?: string
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const baseStore = useBase()
const { base } = storeToRefs(baseStore)
</script>

<template>
  <NcModal
    v-model:visible="visible"
    size="md"
    height="auto"
    :show-separator="false"
    wrap-class-name="nc-modal-rls-policies"
  >
    <div class="relative" style="min-height: 400px; max-height: 70vh">
      <RlsPolicyList :table-id="tableId" :base="base" :table-name="title" />
    </div>
  </NcModal>
</template>
