<script lang="ts" setup>
import type { UploadChangeParam, UploadFile } from 'ant-design-vue'
import { Upload } from 'ant-design-vue'
import data from 'emoji-mart-vue-fast/data/apple.json'
import { EmojiIndex, Picker } from 'emoji-mart-vue-fast/src'
import { WorkspaceIconType } from '#imports'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { PublicAttachmentScope } from 'nocodb-sdk'

interface Props {
  icon: string | Record<string, any>
  iconType: WorkspaceIconType | string
  currentWorkspace: any
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:icon', 'update:iconType', 'submit'])

const { currentWorkspace } = toRefs(props)

const vIcon = useVModel(props, 'icon', emits)

const vIconType = useVModel(props, 'iconType', emits)

const { t } = useI18n()

const { getPossibleAttachmentSrc } = useAttachment()

const isOpen = ref<boolean>(false)

const isLoading = ref<boolean>(false)

const inputRef = ref<HTMLInputElement>()

const searchQuery = ref<string>('')

const activeTabLocal = ref<WorkspaceIconType>(WorkspaceIconType.ICON)

const activeTab = computed({
  get: () => activeTabLocal.value,
  set: (value: WorkspaceIconType) => {
    searchQuery.value = ''

    activeTabLocal.value = value

    nextTick(() => {
      focusInput()
    })
  },
})

const icons = computed(() => {
  return searchIcons(searchQuery.value)
})

const selectIcon = (icon: string) => {
  vIcon.value = icon
  vIconType.value = WorkspaceIconType.ICON

  emits('submit')

  isOpen.value = false
}

const handleRemoveIcon = (closeDropdown = true) => {
  vIcon.value = ''
  vIconType.value = ''

  if (closeDropdown) {
    isOpen.value = false
  }
}

const emojiIndex = new EmojiIndex(data, {
  emojisToShowFilter: (emoji: any) => {
    if (Number(emoji.added_in) >= 14) {
      return false
    }

    return true
  },
})

function selectEmoji(_emoji: any) {
  vIcon.value = _emoji.native
  vIconType.value = WorkspaceIconType.EMOJI

  emits('submit')

  isOpen.value = false
}

const fileList = ref<UploadFile[]>([])

const imageCropperData = ref({
  cropperConfig: {
    stencilProps: {
      aspectRatio: 1,
      fillDefault: true,
    },
    minHeight: 150,
    minWidth: 150,
  },
  imageConfig: {
    src: '',
    type: 'image',
    name: 'icon',
  },
  uploadConfig: {
    path: [NOCO, 'workspace', currentWorkspace.value?.id, 'icon'].join('/'),
    scope: PublicAttachmentScope.WORKSPACEPICS,
    maxFileSize: 2 * 1024 * 1024,
  },
})

const handleOnUploadImage = async (data: any) => {
  vIcon.value = data
  vIconType.value = WorkspaceIconType.IMAGE

  emits('submit')

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

function rejectDrop(fileList: UploadFile[]) {
  fileList.map((file) => {
    return message.error(`${t('msg.error.fileUploadFailed')} ${file.name}`)
  })
}

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status

  if (status === 'uploading') {
    isUploadingImage.value = true
    return
  }

  if (status && status !== 'removed' && status === 'done' && info.file.originFileObj instanceof File) {
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

  if (status === 'error') {
    isUploadingImage.value = false
    message.error(`${t('msg.error.fileUploadFailed')} ${info.file.name}`)
  }
}

/** a workaround to override default antd upload api call */
const customReqCbk = (customReqArgs: { file: any; onSuccess: () => void }) => {
  fileList.value.forEach((f) => {
    if (f.uid === customReqArgs.file.uid) {
      f.status = 'done'
      handleChange({ file: f, fileList: fileList.value })
    }
  })

  customReqArgs.onSuccess()
}

/** check if the file size exceeds the limit */
const beforeUpload = (file: UploadFile) => {
  const exceedLimit = file.size! / 1024 / 1024 > 2
  if (exceedLimit) {
    message.error(`File ${file.name} is too big. The accepted file size is less than 2MB.`)
  }
  return !exceedLimit || Upload.LIST_IGNORE
}

const onVisibilityChange = (value: boolean) => {
  if (!value && showImageCropperLocal.value) {
    isOpen.value = true
  }
}

function focusInput() {
  if (activeTab.value === WorkspaceIconType.EMOJI) {
    setTimeout(() => {
      const emojiInput = document.querySelector('.emoji-mart-search input') as HTMLInputElement

      if (!emojiInput) return

      emojiInput.focus()
      emojiInput.select()
    })
  } else if (activeTab.value === WorkspaceIconType.ICON) {
    setTimeout(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    }, 250)
  }
}

watch(showImageCropper, (newValue) => {
  if (newValue) {
    showImageCropperLocal.value = true
  } else {
    setTimeout(() => {
      showImageCropperLocal.value = false
    }, 500)
  }
})

watch(isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      focusInput()
    })
  }
})
</script>

<template>
  <div>
    <NcDropdown v-model:visible="isOpen" overlay-class-name="w-[432px]" @visible-change="onVisibilityChange">
      <div
        class="rounded-lg border-1 flex-none w-17 h-17 overflow-hidden transition-all duration-300 cursor-pointer"
        :class="{
          'border-transparent': !isOpen && vIconType === WorkspaceIconType.IMAGE,
          'border-nc-gray-medium': !isOpen && vIconType !== WorkspaceIconType.IMAGE,
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
          class="!w-full !h-full !min-w-full rounded-none select-none cursor-pointer"
        />
      </div>
      <template #overlay>
        <div class="pt-2 h-[320px]">
          <NcTabs v-model:activeKey="activeTab" theme="ai" class="nc-workspace-icon-dropdown-tabs h-full">
            <template #leftExtra>
              <div class="w-0"></div>
            </template>
            <template #rightExtra>
              <div>
                <NcButton size="xs" type="text" :disabled="!vIcon" @click.stop="handleRemoveIcon"> Remove </NcButton>
              </div>
            </template>
            <a-tab-pane :key="WorkspaceIconType.ICON" class="w-full" :disabled="isLoading">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="ncPlaceholderIcon" class="flex-none" />
                  Icon
                </div>
              </template>

              <div class="h-full overflow-auto nc-scrollbar-thin flex flex-col">
                <div class="!sticky top-0 flex gap-2 bg-white px-2 py-2">
                  <a-input
                    ref="inputRef"
                    v-model:value="searchQuery"
                    :placeholder="$t('placeholder.searchIcons')"
                    class="nc-dropdown-search-unified-input z-10"
                  >
                  </a-input>
                </div>

                <div v-if="icons.length" class="grid px-3 auto-rows-max pb-2 gap-3 grid-cols-10">
                  <component
                    :is="i"
                    v-for="({ icon: i, name }, idx) in icons"
                    :key="idx"
                    :icon="i"
                    class="w-6 hover:bg-gray-100 cursor-pointer rounded p-1 text-gray-700 h-6"
                    @click="selectIcon(name)"
                  />
                </div>
                <div v-else class="flex-1 grid place-items-center">
                  <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane :key="WorkspaceIconType.IMAGE" class="w-full" :disabled="isLoading">
              <template #tab>
                <div
                  class="tab-title"
                  :class="{
                    '!cursor-wait': isLoading,
                  }"
                >
                  <GeneralIcon icon="ncUpload" class="flex-none" />
                  Upload
                </div>
              </template>
              <div class="p-2 flex flex-col gap-2.5 h-full">
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
                <div class="flex-1">
                  <a-upload-dragger
                    v-model:fileList="fileList"
                    name="file"
                    accept="image/*"
                    :disabled="isUploadingImage"
                    :multiple="false"
                    :show-upload-list="false"
                    class="nc-workspace-image-uploader"
                    :custom-request="customReqCbk"
                    :before-upload="beforeUpload"
                    @change="handleChange"
                    @reject="rejectDrop"
                  >
                    <div class="ant-upload-drag-icon !text-nc-content-gray-muted !mb-2 text-center">
                      <div v-if="isUploadingImage" class="h-6 grid place-items-center">
                        <GeneralLoader size="regular" />
                      </div>
                      <GeneralIcon v-else icon="upload" class="h-6 w-6" />
                    </div>

                    <div class="ant-upload-text !text-nc-content-gray-muted !text-sm">
                      Drop your icon here or <span class="text-nc-content-brand hover:underline">browse file</span>
                      <div class="mt-1">Supported: image/*</div>
                    </div>
                  </a-upload-dragger>
                </div>
              </div>
            </a-tab-pane>
            <a-tab-pane :key="WorkspaceIconType.EMOJI" class="w-full" :disabled="isLoading">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="ncSmile" class="flex-none" />
                  Emoji
                </div>
              </template>
              <div class="h-full">
                <Picker
                  :data="emojiIndex"
                  :native="true"
                  :show-preview="false"
                  color="#40444D"
                  :auto-focus="true"
                  :show-categories="false"
                  :i18n="{
                    search: 'Search emoji',
                  }"
                  class="nc-workspace-emoji-picker"
                  @select="selectEmoji"
                  @click.stop="() => {}"
                ></Picker>
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

  :deep(.ant-tabs-content) {
    @apply h-full;
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

:deep(.ant-input::placeholder) {
  @apply text-gray-500;
}

:deep(.nc-workspace-avatar img) {
  @apply !cursor-pointer;
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

.nc-workspace-emoji-picker.emoji-mart {
  @apply !w-108 !h-full !border-none bg-transparent rounded-t-none rounded-b-lg;

  span.emoji-type-native {
    @apply cursor-pointer;
  }

  .emoji-mart-anchor {
    @apply h-8 py-1.5;
    svg {
      @apply h-3.5 !important;
    }
  }

  .emoji-mart-search {
    @apply px-2 mt-2;
    input {
      @apply text-sm pl-[11px] rounded-lg !py-5px transition-all duration-300 !outline-none ring-0;

      &:focus {
        @apply !outline-none ring-0 shadow-selected border-primary;
      }
    }
  }

  .emoji-mart-scroll {
    @apply mt-1 px-1 overflow-x-hidden;

    h3.emoji-mart-category-label {
      @apply text-xs text-gray-500 mb-0;
    }
  }

  .emoji-mart-scroll {
    @apply nc-scrollbar-thin;
    overflow-y: overlay;
  }

  .emoji-mart-emoji {
    @apply !px-1 !py-0.75 !m-0.5;
  }
  .emoji-mart-emoji:hover:before {
    @apply !rounded-md;
  }
}
</style>
