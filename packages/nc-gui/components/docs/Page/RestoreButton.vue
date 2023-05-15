<script lang="ts" setup>
const isVisible = ref(false)

const { isRestoring } = storeToRefs(useDocHistoryStore())
const { restore } = useDocHistoryStore()

const onRestore = async () => {
  await restore()
  isVisible.value = false
}
</script>

<template>
  <a-button
    type="text"
    class="!border-1 !border-gray-100 !rounded-md !px-3 mr-2"
    data-testid="nc-docs-history-restore-button"
    @click="isVisible = true"
  >
    <div class="flex flex-row items-center">
      <MdiRestore />
      <div class="ml-1">Restore</div>
    </div>
  </a-button>
  <a-modal v-model:visible="isVisible" :footer="null" centered :closable="isRestoring">
    <div class="flex flex-col gap-y-6 mx-2">
      <div class="flex text-base">This action will restore page to selected version</div>
      <div class="flex flex-row gap-x-2">
        <a-button
          type="text"
          class="!rounded-sm"
          :disabled="isRestoring"
          data-testid="nc-docs-history-restore-cancel-button"
          @click="isVisible = false"
          >Cancel</a-button
        >
        <a-button
          type="primary"
          class="!rounded-sm"
          :loading="isRestoring"
          data-testid="nc-docs-history-confirm-button"
          @click="onRestore"
          >Restore</a-button
        >
      </div>
    </div>
  </a-modal>
</template>
