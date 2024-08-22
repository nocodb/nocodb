<script lang="ts" setup>
import { marked } from 'marked'

interface Prop {
  modelValue: boolean
  extensionId: string
  from: 'market' | 'extension'
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, addExtension, getExtensionIcon, isMarketVisible } = useExtensions()

const onBack = () => {
  vModel.value = false
  isMarketVisible.value = true
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  vModel.value = false
}

const activeExtension = computed(() => {
  return availableExtensions.value.find((ext) => ext.id === props.extensionId)
})

const detailsBody = activeExtension.value?.description ? marked.parse(activeExtension.value.description) : '<p></p>'
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :width="1154"
    size="medium"
    wrap-class-name="nc-modal-extension-details"
  >
    <div v-if="activeExtension" class="flex flex-col w-full h-full">
      <div class="flex items-center gap-3 p-4 border-b-1 border-gray-200">
        <NcButton v-if="from === 'market'" size="small" type="text" @click="onBack">
          <GeneralIcon icon="arrowLeft" />
        </NcButton>

        <img :src="getExtensionIcon(activeExtension.iconUrl)" alt="icon" class="h-[28px] w-[28px] object-contain" />
        <div class="flex-1 flex flex-col gap-3">
          <div class="font-semibold text-xl">{{ activeExtension.title }}</div>
        </div>
        <div class="self-start flex items-center gap-2.5">
          <NcButton size="small" class="w-full" @click="onAddExtension(activeExtension)">
            <div class="flex items-center justify-center">Add Extension</div>
          </NcButton>
          <NcButton size="small" type="text" @click="vModel = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>

      <div class="extension-details">
        <div class="extension-details-left">
          <div class="text-base text-gray-600" v-html="detailsBody"></div>
        </div>
        <div class="extension-details-right">
          <div class="extension-details-right-section">
            <div class="extension-details-right-title">Version</div>
            <div class="extension-details-right-subtitle">{{ activeExtension.version }}</div>
          </div>
          <NcDivider />
          <div class="extension-details-right-section">
            <div v-if="activeExtension.publisherName" class="extension-details-right-title">Publisher</div>
            <div class="extension-details-right-subtitle">{{ activeExtension.publisherName }}</div>
          </div>
          <template v-if="activeExtension.publisherEmail">
            <NcDivider />
            <div class="extension-details-right-section">
              <div class="extension-details-right-title">Publisher Email</div>
              <div class="extension-details-right-subtitle">
                <a :href="`mailto:${activeExtension.publisherEmail}`" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherEmail }}
                </a>
              </div>
            </div>
          </template>
          <template v-if="activeExtension.publisherUrl">
            <NcDivider />
            <div class="extension-details-right-section">
              <div class="extension-details-right-title">Publisher Website</div>
              <div class="extension-details-right-subtitle">
                <a :href="activeExtension.publisherUrl" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherUrl }}
                </a>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.extension-details {
  @apply flex w-full h-[calc(100%_-_65px)];

  .extension-details-left {
    @apply p-6 flex-1 flex flex-col gap-6 nc-scrollbar-thin;
  }

  .extension-details-right {
    @apply p-5 w-[320px] flex flex-col space-y-4 border-l-1 border-gray-200 bg-gray-50 nc-scrollbar-thin;

    .extension-details-right-section {
      @apply flex flex-col gap-3;
    }

    .extension-details-right-title {
      @apply text-sm font-semibold text-gray-800;
    }
    .extension-details-right-subtitle {
      @apply text-sm font-weight-500 text-gray-600;
    }
  }
}
</style>

<style lang="scss">
.nc-modal-extension-details {
  .ant-modal-content{
    @apply overflow-hidden;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }
}
</style>
