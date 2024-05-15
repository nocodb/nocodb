<script lang="ts" setup>
interface Prop {
  modelValue?: boolean
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, addExtension, getExtensionIcon, showExtensionDetails } = useExtensions()

const onExtensionClick = (extensionId: string) => {
  showExtensionDetails(extensionId)
  vModel.value = false
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  vModel.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :body-style="{ 'max-height': '864px', 'height': '85vh' }"
    :class="{ active: vModel }"
    :closable="true"
    :footer="null"
    :width="1280"
    size="medium"
    wrap-class-name="nc-modal-extension-market"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-center px-4 py-2">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="puzzle" />
          <div class="font-weight-700">Extensions Marketplace</div>
        </div>
      </div>
      <div class="flex flex-col flex-1 px-4 py-2">
        <div class="flex flex-wrap gap-4 p-2">
          <template v-for="ext of availableExtensions" :key="ext.id">
            <div class="flex border-1 rounded-lg p-2 w-[360px] cursor-pointer" @click="onExtensionClick(ext.id)">
              <div class="h-[60px] overflow-hidden m-auto">
                <img :src="getExtensionIcon(ext.iconUrl)" alt="icon" class="w-full h-full object-cover" />
              </div>
              <div class="flex flex-grow flex-col ml-3">
                <div class="flex justify-between">
                  <div class="font-weight-600">{{ ext.title }}</div>
                  <NcButton size="xsmall" @click.stop="onAddExtension(ext)">
                    <div class="flex items-center gap-1 mx-1">
                      <GeneralIcon icon="plus" />
                      Add
                    </div>
                  </NcButton>
                </div>
                <div class="w-[250px] h-[50px] text-xs line-clamp-3">{{ ext.description }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped></style>
