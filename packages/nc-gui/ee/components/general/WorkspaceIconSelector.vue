<script lang="ts" setup>
import { WorkspaceIconType } from '#imports'
import type { UploadFile } from 'ant-design-vue'

interface Props {
  icon: string | Record<string, any>
  iconType: WorkspaceIconType | string
  currentWorkspace: any
}

const props = withDefaults(defineProps<Props>(), {})

const { currentWorkspace } = toRefs(props)

const emits = defineEmits(['update:icon', 'update:iconType'])

const vIcon = useVModel(props, 'icon', emits)

const vIconType = useVModel(props, 'iconType', emits)

const { getPossibleAttachmentSrc } = useAttachment()

const isOpen = ref<boolean>(false)

const isLoading = ref<boolean>(false)

const inputRef = ref<HTMLInputElement>()

const searchQuery = ref<string>('')

const activeTabLocal = ref<WorkspaceIconType>(WorkspaceIconType.IMAGE)

const activeTab = computed({
  get: () => activeTabLocal.value,
  set: (value: WorkspaceIconType) => {
    searchQuery.value = ''

    activeTabLocal.value = value

    if (value === WorkspaceIconType.ICON) {
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
})

const icons = computed(() => {
  return searchIcons(searchQuery.value)
})

const selectIcon = (icon: string) => {
  vIcon.value = icon
  vIconType.value = WorkspaceIconType.ICON

  isOpen.value = false
}

const handleRemoveIcon = (closeDropdown = true) => {
  vIcon.value = ''
  vIconType.value = ''

  if (closeDropdown) {
    isOpen.value = false
  }
}

const fileList = ref<UploadFile[]>([])

const imageCropperData = ref({
  cropperConfig: {
    stencilProps: {
      aspectRatio: undefined,
    },
    minHeight: 150,
    minWidth: 150,
  },
  imageConfig: {
    src: currentWorkspace.value?.image,
    type: 'image',
    name: 'icon',
  },
  uploadConfig: {
    path: [NOCO, 'workspace', currentWorkspace.value?.id, 'icon'].join('/'),
  },
})

const handleOnUploadImage = async (data: any) => {
  vIcon.value = data
  vIconType.value = WorkspaceIconType.IMAGE

  isOpen.value = false
}

const showImageCropperLocal = ref(false)

const showImageCropper = ref(false)

const getWorkspaceLogoSrc = computed(() => {
  if (vIcon.value && vIconType.value === WorkspaceIconType.IMAGE) {
    return getPossibleAttachmentSrc(vIcon.value)
  }

  return []
})

const isUploadingImage = ref(false)

const handleChange = (info: { file: UploadFile; fileList: File[] }) => {
  if (info.file.status === 'uploading') {
    isUploadingImage.value = true
    return
  }

  if (info?.file?.status === 'done' && info.file.originFileObj instanceof File) {
    // 1. Revoke the object URL, to allow the garbage collector to destroy the uploaded before file
    if (imageCropperData.value.imageConfig.src) {
      URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
    }
    // 2. Create the blob link to the file to optimize performance:
    const blob = URL.createObjectURL(info.file.originFileObj)

    // 3. Update the image. The type will be derived from the extension
    imageCropperData.value.imageConfig = {
      src: blob,
      type: info.file.originFileObj.type,
      name: info.file.originFileObj.name,
    }

    isUploadingImage.value = false
    showImageCropper.value = true
    return
  }

  if (info.file.status === 'error') {
    isUploadingImage.value = false
    message.error('Failed to upload workspace logo.')
  }
}

const onVisibilityChange = (value: boolean) => {
  if (!value && showImageCropperLocal.value) {
    isOpen.value = true
  }
}

watch(isOpen, (newValue) => {
  if (newValue) {
    activeTab.value = WorkspaceIconType.IMAGE
  }
})

watch(showImageCropper, (newValue) => {
  if (newValue) {
    showImageCropperLocal.value = true
  } else {
    setTimeout(() => {
      showImageCropperLocal.value = false
    }, 500)
  }
})
</script>

<template>
  <div>
    <NcDropdown v-model:visible="isOpen" overlay-class-name="w-[448px]" @visible-change="onVisibilityChange">
      <div
        class="mt-2 rounded-lg border-1 flex-none w-16 h-16 overflow-hidden transition-all duration-300 cursor-pointer"
        :class="{
          'border-transparent': !isOpen,
          'border-primary shadow-selected': isOpen,
        }"
      >
        <GeneralWorkspaceIcon
          :workspace="currentWorkspace"
          :workspace-icon="{
            icon: vIcon,
            iconType: vIconType,
          }"
          size="xlarge"
          class="!w-full !h-full !min-w-full rounded-none select-none"
        />
      </div>
      <template #overlay>
        <div class="pt-2">
          <NcTabs v-model:activeKey="activeTab" theme="ai" class="nc-workspace-icon-dropdown-tabs">
            <template #leftExtra>
              <div class="w-0"></div>
            </template>
            <template #rightExtra>
              <div>
                <NcButton size="xs" type="text" @click.stop="handleRemoveIcon"> Remove </NcButton>
              </div>
            </template>
            <a-tab-pane :key="WorkspaceIconType.IMAGE" class="w-full" :disabled="isLoading">
              <template #tab>
                <div
                  class="tab-title"
                  :class="{
                    '!cursor-wait': isLoading,
                  }"
                >
                  <GeneralIcon icon="ncUpload" class="flex-none" />
                  Upload Icon
                </div>
              </template>
              <div class="p-2 flex flex-col gap-2.5">
                <div v-if="getWorkspaceLogoSrc.length" class="flex items-center gap-4">
                  <div class="h-12 w-12 p-2">
                    <CellAttachmentPreviewImage
                      :srcs="getWorkspaceLogoSrc"
                      class="flex-none !object-contain max-h-full max-w-full !m-0 rounded-lg"
                    />
                  </div>
                  <div class="flex-1 w-[calc(100%_-_108px)]">
                    <NcTooltip class="truncate flex-1" show-on-truncate-only>
                      <template #title> {{ vIcon?.title || 'Workspace logo' }}</template>
                      {{ vIcon?.title || 'Workspace logo' }}
                    </NcTooltip>
                    <div class="text-nc-content-gray-muted text-sm">
                      {{ vIcon?.size ? `${(vIcon?.size / 1048576).toFixed(2)} MB` : '0 MB' }}
                    </div>
                  </div>

                  <div>
                    <NcButton icon-only type="text" size="xs" class="!px-1" @click="handleRemoveIcon(false)">
                      <template #icon>
                        <GeneralIcon icon="deleteListItem" />
                      </template>
                    </NcButton>
                  </div>
                </div>
                <div>
                  <a-upload-dragger
                    v-model:fileList="fileList"
                    name="file"
                    accept="image/*"
                    :disabled="isUploadingImage"
                    :multiple="false"
                    :show-upload-list="false"
                    class="nc-workspace-image-uploader"
                    @change="handleChange"
                  >
                    <div class="ant-upload-drag-icon !text-nc-content-gray-muted !mb-2 text-center">
                      <div v-if="isUploadingImage" class="h-6 grid place-items-center">
                        <GeneralLoader size="regular" />
                      </div>
                      <GeneralIcon v-else icon="upload" class="h-6 w-6" />
                    </div>

                    <div class="ant-upload-text !text-nc-content-gray-muted !text-sm">
                      Drop your icon here or <span class="text-nc-content-brand hover:underline">browse file</span>
                    </div>
                  </a-upload-dragger>
                </div>
              </div>
            </a-tab-pane>

            <a-tab-pane :key="WorkspaceIconType.ICON" class="w-full" :disabled="isLoading">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="ncPlaceholderIcon" class="flex-none" />
                  Icon
                </div>
              </template>
              <div class="">
                <div class="h-[244px] overflow-auto nc-scrollbar-thin flex flex-col">
                  <div class="!sticky top-0 flex gap-2 bg-white px-2 py-2">
                    <a-input
                      ref="inputRef"
                      v-model:value="searchQuery"
                      :placeholder="$t('placeholder.searchIcons')"
                      class="nc-dropdown-search-unified-input z-10"
                    >
                      <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
                    ></a-input>
                  </div>

                  <div v-if="icons.length" class="grid px-3 auto-rows-max pb-2 gap-3 grid-cols-10">
                    <component
                      :is="icon"
                      v-for="({ icon, name }, i) in icons"
                      :key="i"
                      :icon="icon"
                      class="w-6 hover:bg-gray-100 cursor-pointer rounded p-1 text-gray-700 h-6"
                      @click="selectIcon(name)"
                    />
                  </div>
                  <div v-else class="flex-1 grid place-items-center">
                    <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
                  </div>
                </div>
              </div>
            </a-tab-pane>
          </NcTabs>
        </div>
      </template>
    </NcDropdown>

    <GeneralImageCropper
      v-model:show-cropper="showImageCropper"
      :cropper-config="imageCropperData.cropperConfig"
      :image-config="imageCropperData.imageConfig"
      :upload-config="imageCropperData.uploadConfig"
      @submit="handleOnUploadImage"
    ></GeneralImageCropper>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-icon-dropdown-tabs {
  :deep(.ant-tabs-nav) {
    @apply px-3;

    .ant-tabs-extra-content {
      @apply self-start;
    }

    .ant-tabs-tab {
      @apply px-0 pt-1 pb-2;

      &.ant-tabs-tab-active {
        @apply font-medium;
      }

      & + .ant-tabs-tab {
        @apply ml-4;
      }

      .tab-title {
        @apply text-xs leading-[24px] px-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-2;
      }
    }
  }

  &.nc-ai-loading {
    :deep(.ant-tabs-tab) {
      @apply !cursor-wait;
    }
  }

  :deep(.ant-tabs-tab-disabled) {
    .tab-title {
      @apply text-nc-content-gray-muted hover:bg-transparent;
    }
  }
}
</style>

<style>
.nc-workspace-image-uploader {
  &.ant-upload.ant-upload-drag {
    @apply !rounded-lg !bg-white !hover:bg-nc-bg-gray-light !transition-colors duration-300;
  }
  .ant-upload-btn {
    @apply !flex flex-col items-center justify-center !min-h-[176px];
  }
}
</style>
