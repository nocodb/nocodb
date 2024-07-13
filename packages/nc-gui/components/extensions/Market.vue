<script lang="ts" setup>
interface Prop {
  modelValue?: boolean
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, addExtension, getExtensionIcon, showExtensionDetails } = useExtensions()

const searchQuery = ref<string>('')

const filteredAvailableExtensions = computed(() =>
  (availableExtensions.value || []).filter(
    (ext) =>
      ext.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.value.toLowerCase()),
  ),
)

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
    <template #header>
      <div class="flex items-center gap-2 pb-2">
        <GeneralIcon icon="puzzle" class="h-5 w-5" />
        <div class="font-weight-700 text-base">Extensions Marketplace</div>
      </div>
    </template>
    <div class="flex flex-col h-[calc(100%_-_41px)]">
      <div class="h-full flex flex-col gap-4 flex-1 pt-2">
        <div class="flex flex max-w-[470px]">
          <a-input
            v-model:value="searchQuery"
            type="text"
            class="!h-10 !px-3 !py-1 !rounded-lg"
            placeholder="Search for an extension..."
            allow-clear
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>
        </div>
        <div
          class="max-h-[calc(100%_-_40px)] flex flex-wrap gap-3 nc-scrollbar-thin"
          :class="{
            'h-full': searchQuery && !filteredAvailableExtensions.length && availableExtensions.length,
          }"
        >
          <template v-for="ext of filteredAvailableExtensions" :key="ext.id">
            <div class="flex border-1 rounded-xl p-3 w-[360px] cursor-pointer" @click="onExtensionClick(ext.id)">
              <div class="h-[60px] w-[60px] overflow-hidden m-auto">
                <img :src="getExtensionIcon(ext.iconUrl)" alt="icon" class="w-full h-full object-contain" />
              </div>
              <div class="flex flex-grow flex-col gap-2 ml-3">
                <div class="flex justify-between gap-1">
                  <div class="font-weight-600">{{ ext.title }}</div>
                  <NcButton size="xsmall" type="secondary" @click.stop="onAddExtension(ext)">
                    <div class="flex items-center gap-2 mx-1">
                      <GeneralIcon icon="plus" />
                      Add
                    </div>
                  </NcButton>
                </div>
                <div class="w-[250px] h-[32px] text-xs text-gray-500 line-clamp-2">{{ ext.description }}</div>
              </div>
            </div>
          </template>
          <div
            v-if="searchQuery && !filteredAvailableExtensions.length && availableExtensions.length"
            class="w-full h-full flex items-center justify-center"
          >
            <div class="pb-6 text-gray-500 flex flex-col items-center gap-6">
              <img
                src="~assets/img/placeholder/no-search-result-found.png"
                class="!w-[164px] flex-none"
                alt="No search results found"
              />

              {{ $t('title.noResultsMatchedYourSearch') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped></style>
