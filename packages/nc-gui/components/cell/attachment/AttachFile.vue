<script setup lang="ts">
import { useAttachmentCell } from './utils'

const props = defineProps<{
  value: boolean
}>()

const dialogShow = useVModel(props, 'value')

const { onDrop: saveAttachment } = useAttachmentCell()!

const activeMenu = ref('local')

const selectMenu = (option: string) => {
  activeMenu.value = option
}

const closeModal = (value: boolean) => {
  dialogShow.value = value
}

const saveAttachments = async (files: File[]) => {
  await saveAttachment(files, {} as any)
  dialogShow.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="medium"
    width="50rem"
    wrap-class-name="nc-modal-attachment-create"
    class="!rounded-md"
    @keydown.esc="dialogShow = false"
  >
    <div class="flex h-full flex-row">
      <div class="px-2 h-full">
        <NcMenu class="!h-full">
          <NcMenuItem
            key="local"
            :class="{
              'active-menu': activeMenu === 'local',
            }"
            @click="selectMenu('local')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="upload" />
              Local Files
            </div>
          </NcMenuItem>
          <NcMenuItem
            key="url"
            :class="{
              'active-menu': activeMenu === 'url',
            }"
            @click="selectMenu('url')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="link" />
              Upload via URL
            </div>
          </NcMenuItem>
          <NcMenuItem
            key="webcam"
            :class="{
              'active-menu': activeMenu === 'webcam',
            }"
            @click="selectMenu('webcam')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="camera" />
              Webcam
            </div>
          </NcMenuItem>
        </NcMenu>
      </div>

      <div style="height: 425px" class="w-full">
        <LazyCellAttachmentUploadProvidersLocal
          v-show="activeMenu === 'local'"
          @update:visible="closeModal"
          @upload="(e) => saveAttachments(e)"
        />

        <LazyCellAttachmentUploadProvidersCamera
          v-if="activeMenu === 'webcam'"
          @update:visible="closeModal"
          @upload="(e) => saveAttachments(e)"
        />

        <LazyCellAttachmentUploadProvidersUrl
          v-if="activeMenu === 'url'"
          @update:visible="closeModal"
          @upload="(e) => saveAttachments(e)"
        />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-attachment-create {
  .active-menu {
    @apply !bg-gray-100 font-sembold text-brand-500 rounded-md;
  }
}

.nc-modal-attachment-create {
  .nc-modal {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
:deep(.ant-menu-inline),
:deep(.ant-menu-vertical),
:deep(.ant-menu-vertical-left) {
  border-right: none !important;
}
</style>
