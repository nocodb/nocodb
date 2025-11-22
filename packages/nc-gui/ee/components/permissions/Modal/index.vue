<script lang="ts" setup>
interface Props {
  visible: boolean
  baseId: string
  tableId: string
}

const props = defineProps<Props>()

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const contentRef = ref()
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    :header="false"
    size="large"
    :show-separator="false"
    wrap-class-name="nc-modal-field-permissions"
  >
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="p-2 w-full flex items-center gap-3 border-b-1 border-nc-border-gray-medium">
        <div class="flex items-center">
          <GeneralTableIcon
            :meta="{
              meta: contentRef?.tableData?.meta,
              synced: contentRef?.tableData?.synced,
            }"
            class="!mx-0 !text-current !h-6 !w-6 pl-1"
          />
        </div>
        <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">{{ contentRef?.tableData?.title }}</div>

        <div class="flex items-center gap-3">
          <NcButton size="small" type="text" @click="vVisible = false">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>

      <div class="h-[calc(100%_-_50px)] flex">
        <!-- Content -->
        <PermissionsModalContent
          v-if="vVisible"
          ref="contentRef"
          :table-id="tableId"
          permissions-table-wrapper-class="max-w-[720px]"
          permissions-field-wrapper-class="max-w-[720px]"
          permissions-table-toolbar-class-name="pt-6"
        />
        <div v-else class="flex-1">&nbsp;</div>

        <div class="w-[320px] h-full p-5 bg-nc-bg-gray-extralight">
          <PermissionsSupportedDocs />
          <NcDivider class="!my-4" />
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-field-permissions {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
}
</style>
