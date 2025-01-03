<script setup lang="ts">
import { useAttachmentCell } from './utils'

const props = defineProps<{
  value: boolean
}>()

const { isMobileMode } = useGlobal()

const dialogShow = useVModel(props, 'value')

const { onDrop: saveAttachment, isPublic, stopCamera } = useAttachmentCell()!

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

watch(activeMenu, (newVal, oldValue) => {
  // Stop camera when switching to another menu
  if (oldValue === 'webcam' && newVal !== 'webcam') {
    // When the menu is switched when the startCamera function is called, the videoStream might not have initialized yet
    // So, we need to wait for a while before stopping the camera
    setTimeout(() => {
      stopCamera()
    }, 1000)
  }
})
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
    <div class="flex h-full" :class="isMobileMode ? 'flex-col' : 'flex-row'">
      <div style="border-top-left-radius: 1rem; border-bottom-left-radius: 1rem" class="px-2 !-full flex-grow bg-gray-50">
        <NcMenu class="!h-full !bg-gray-50 flex flex-col" :class="{ '!flex-row overflow-x-scroll': isMobileMode }">
          <NcMenuItem
            key="local"
            class="!hover:bg-gray-200 !hover:text-gray-800 rounded-md"
            :class="{
              'active-menu': activeMenu === 'local',
            }"
            @click="selectMenu('local')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="file" />
              {{ $t('title.localFiles') }}
            </div>
          </NcMenuItem>
          <NcMenuItem
            v-if="!isPublic"
            key="url"
            class="!hover:bg-gray-200 !hover:text-gray-800 rounded-md"
            :class="{
              'active-menu': activeMenu === 'url',
            }"
            @click="selectMenu('url')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="link2" />
              {{ $t('title.uploadViaUrl') }}
            </div>
          </NcMenuItem>
          <NcMenuItem
            key="webcam"
            class="!hover:bg-gray-200 !hover:text-gray-800 rounded-md"
            :class="{
              'active-menu': activeMenu === 'webcam',
            }"
            @click="selectMenu('webcam')"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="camera" />
              {{ $t('title.webcam') }}
            </div>
          </NcMenuItem>
        </NcMenu>
      </div>

      <div style="height: 425px" class="w-full p-2">
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
    @apply bg-brand-50 font-sembold text-brand-500 rounded-md;
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
