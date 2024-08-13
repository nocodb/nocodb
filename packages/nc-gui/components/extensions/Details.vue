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
    :body-style="{ 'max-height': '864px', 'height': '85vh' }"
    :class="{ active: vModel }"
    :closable="from === 'extension'"
    :footer="null"
    :width="1154"
    size="medium"
    wrap-class-name="nc-modal-extension-market"
  >
    <div v-if="activeExtension" class="flex flex-col w-full h-full">
      <div v-if="from === 'market'" class="flex-none h-8 flex items-center mb-4">
        <NcButton size="xsmall" type="text" class="!bg-gray-200/75 !hover:bg-gray-200 !rounded-full" @click="onBack">
          <div class="flex items-center gap-2 px-2">
            <GeneralIcon icon="ncArrowLeft" />
            <span>Back</span>
          </div>
        </NcButton>
      </div>
      <div v-else class="h-8"></div>

      <div class="extension-details">
        <div class="extension-details-left nc-scrollbar-thin">
          <div class="flex gap-6">
            <img :src="getExtensionIcon(activeExtension.iconUrl)" alt="icon" class="h-[80px] w-[80px] object-contain" />
            <div class="flex flex-col gap-3">
              <div class="font-weight-700 text-2xl">{{ activeExtension.title }}</div>
            </div>
          </div>

          <div class="text-base text-gray-600" v-html="detailsBody"></div>
        </div>
        <div class="extension-details-right">
          <NcButton class="w-full" @click="onAddExtension(activeExtension)">
            <div class="flex items-center justify-center">Add Extension</div>
          </NcButton>

          <div class="flex flex-col gap-4 nc-scrollbar-thin">
            <div class="flex flex-col gap-1">
              <div class="extension-details-right-title">Version</div>
              <div class="extension-details-right-subtitle">{{ activeExtension.version }}</div>
            </div>
            <div class="flex flex-col gap-1">
              <div v-if="activeExtension.publisherName" class="extension-details-right-title">Publisher</div>
              <div class="extension-details-right-subtitle">{{ activeExtension.publisherName }}</div>
            </div>
            <div v-if="activeExtension.publisherEmail" class="flex flex-col gap-1">
              <div class="extension-details-right-title">Publisher Email</div>
              <div class="extension-details-right-subtitle">
                <a :href="`mailto:${activeExtension.publisherEmail}`" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherEmail }}
                </a>
              </div>
            </div>
            <div v-if="activeExtension.publisherUrl" class="flex flex-col gap-1">
              <div class="extension-details-right-title">Publisher Website</div>
              <div class="extension-details-right-subtitle">
                <a :href="activeExtension.publisherUrl" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherUrl }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.extension-details {
  @apply flex w-full h-full gap-8 px-3;

  .extension-details-left {
    @apply flex flex-col gap-6 w-3/4;
  }

  .extension-details-right {
    @apply w-1/4 flex flex-col gap-4;

    .extension-details-right-title {
      @apply text-base font-weight-700 text-gray-800;
    }
    .extension-details-right-subtitle {
      @apply text-sm font-weight-500 text-gray-600;
    }
  }
}
</style>
