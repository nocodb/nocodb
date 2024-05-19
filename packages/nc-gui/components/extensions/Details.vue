<script lang="ts" setup>
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
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :body-style="{ 'max-height': '864px', 'height': '85vh' }"
    :class="{ active: vModel }"
    :closable="from === 'extension'"
    :footer="null"
    :width="1280"
    size="medium"
    wrap-class-name="nc-modal-extension-market"
  >
    <div v-if="activeExtension" class="flex flex-col w-full h-full">
      <div v-if="from === 'market'" class="h-[40px] flex items-start">
        <div class="flex items-center gap-2 pr-2 pb-2 cursor-pointer hover:text-primary" @click="onBack">
          <GeneralIcon icon="ncArrowLeft" />
          <span>Back</span>
        </div>
      </div>
      <div v-else class="h-[40px]"></div>
      <div class="extension-details">
        <div class="extension-details-left">
          <div class="flex">
            <img :src="getExtensionIcon(activeExtension.iconUrl)" alt="icon" class="h-[90px]" />
            <div class="flex flex-col p-4">
              <div class="font-weight-700 text-2xl">{{ activeExtension.title }}</div>
            </div>
          </div>
          <div class="p-4">
            <div class="whitespace-pre-line">{{ activeExtension.description }}</div>
          </div>
        </div>
        <div class="extension-details-right">
          <NcButton class="w-full" @click="onAddExtension(activeExtension)">
            <div class="flex items-center justify-center">Add Extension</div>
          </NcButton>
          <div class="flex flex-col gap-1">
            <div class="text-md font-weight-600">Version</div>
            <div>{{ activeExtension.version }}</div>
          </div>
          <div class="flex flex-col gap-1">
            <div v-if="activeExtension.publisherName" class="text-md font-weight-600">Publisher</div>
            <div>{{ activeExtension.publisherName }}</div>
          </div>
          <div v-if="activeExtension.publisherEmail" class="flex flex-col gap-1">
            <div class="text-md font-weight-600">Publisher Email</div>
            <div>
              <a :href="`mailto:${activeExtension.publisherEmail}`" target="_blank" rel="noopener noreferrer">
                {{ activeExtension.publisherEmail }}
              </a>
            </div>
          </div>
          <div v-if="activeExtension.publisherUrl" class="flex flex-col gap-1">
            <div class="text-md font-weight-600">Publisher Website</div>
            <div>
              <a :href="activeExtension.publisherUrl" target="_blank" rel="noopener noreferrer">
                {{ activeExtension.publisherUrl }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.extension-details {
  @apply flex w-full h-full;

  .extension-details-left {
    @apply flex flex-col w-3/4 p-2;
  }

  .extension-details-right {
    @apply w-1/4 p-2 flex flex-col gap-4;
  }
}
</style>
