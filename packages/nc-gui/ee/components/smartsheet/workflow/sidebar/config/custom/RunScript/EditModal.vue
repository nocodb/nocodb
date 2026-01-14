<script setup lang="ts">
import Variables from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/Variables.vue'
import Code from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/Code.vue'
import Result from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/Result.vue'
interface Props {
  value: boolean
}

const props = defineProps<Props>()

const modalVisible = useVModel(props, 'value')
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="fullscreen" wrap-class-name="nc-modal-run-script-edit">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex gap-2 items-center">
          <GeneralIcon class="text-nc-content-gray-emphasis h-5 w-5" icon="ncCode" />
          Edit Script
        </div>

        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton
            class="!text-nc-content-brand"
            type="text"
            size="small"
            data-testid="nc-close-script-modal"
            @click.stop="modalVisible = false"
          >
            Close
          </NcButton>
        </div>
      </div>
    </template>

    <div class="w-full flex h-full">
      <Variables class="w-4/18" />
      <Code class="w-9/18" />
      <Result class="w-5/18" />
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-run-script-edit {
  z-index: 1050;

  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
