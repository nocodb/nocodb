<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  count: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'continue': [cancelPending: boolean]
}>()

const vModel = useVModel(props, 'visible', emit)

const cancelPendingExecutions = ref(false)

const handleContinue = () => {
  emit('continue', cancelPendingExecutions.value)
}

const handleCancel = () => {
  vModel.value = false
}
</script>

<template>
  <NcModal v-model:visible="vModel" :show-separator="false" size="small">
    <div class="flex gap-2 w-full text-base font-semibold mb-2 text-nc-content-gray-emphasis items-center">
      <GeneralIcon icon="alertTriangle" class="text-orange-500 !h-5 !w-5" />
      Pending Workflow Executions
    </div>
    <div data-testid="nc-workflow-pending-executions-modal" class="flex flex-col">
      <div class="mb-2 nc-content-gray">
        This workflow has <span class="font-bold">{{ count }}</span> execution(s) that are paused and waiting to resume. What
        would you like to do with them?
      </div>

      <a-radio-group v-model:value="cancelPendingExecutions">
        <a-radio
          data-testid="nc-workflow-pending-continue"
          :style="{
            display: 'flex',
            height: '30px',
            lineHeight: '30px',
          }"
          :value="false"
        >
          <div class="nc-content-gray">Let them continue with <span class="font-bold">old version</span></div>
        </a-radio>
        <a-radio
          data-testid="nc-workflow-pending-cancel"
          :style="{
            display: 'flex',
            lineHeight: '30px',
          }"
          :value="true"
        >
          <div class="nc-content-gray leading-5">
            <span class="font-bold">Cancel</span>
            pending executions
          </div>
        </a-radio>
      </a-radio-group>
    </div>
    <div class="flex flex-row mt-5 justify-end gap-x-2">
      <NcButton data-testid="nc-workflow-pending-cancel-btn" type="secondary" size="small" @click="handleCancel">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton data-testid="nc-workflow-pending-continue-btn" type="primary" size="small" @click="handleContinue">
        {{ $t('labels.continue') }}
      </NcButton>
    </div>
  </NcModal>
</template>
