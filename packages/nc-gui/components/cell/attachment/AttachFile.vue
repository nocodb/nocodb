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

const saveAttachments = (files: File[]) => {
  saveAttachment(files, {} as any)
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
            Local Files
          </NcMenuItem>
          <NcMenuItem
            key="url"
            :class="{
              'active-menu': activeMenu === 'url',
            }"
            @click="selectMenu('url')"
          >
            Upload via URL
          </NcMenuItem>
          <NcMenuItem
            key="webcam"
            :class="{
              'active-menu': activeMenu === 'webcam',
            }"
            @click="selectMenu('webcam')"
          >
            Webcam
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

  :deep(.ant-menu-vertical-left) {
    border-right: none !important;
  }
}

.nc-modal {
  @apply !p-0;
}
</style>
