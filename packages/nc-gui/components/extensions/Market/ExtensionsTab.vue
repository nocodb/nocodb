<script lang="ts" setup>
interface Props {
  searchQuery: string
  isOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:searchQuery', 'update:isOpen'])

const searchQuery = useVModel(props, 'searchQuery', emits)

const isOpen = useVModel(props, 'isOpen', emits)

const {} = toRefs(props)

const { availableExtensions, addExtension, getExtensionAssetsUrl, showExtensionDetails } = useExtensions()

const filteredAvailableExtensions = computed(() =>
  (availableExtensions.value || []).filter(
    (ext) =>
      ext.title.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()) ||
      ext.subTitle.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()),
  ),
)

const onExtensionClick = (extensionId: string) => {
  showExtensionDetails(extensionId)
  isOpen.value = false
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  isOpen.value = false
}
</script>

<template>
  <div class="h-full py-4">
    <div class="h-full flex flex-col gap-6 flex-1 pt-2 px-6 max-w-[900px] w-full mx-auto">
      <div v-if="searchQuery" class="text-base text-nc-content-gray-subtle">Search result for ‘{{ searchQuery }}’</div>
      <div
        class="flex flex-wrap gap-6 overflow-auto nc-scrollbar-thin pb-2"
        :class="{
          'h-full': searchQuery && !filteredAvailableExtensions.length && availableExtensions.length,
        }"
      >
        <template v-for="ext of filteredAvailableExtensions" :key="ext.id">
          <div
            class="nc-market-extension-item w-full md:w-[calc(50%_-_12px)] flex items-center gap-3 border-1 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-all"
            @click="onExtensionClick(ext.id)"
          >
            <div class="h-[60px] w-[60px] overflow-hidden m-auto flex-none">
              <img :src="getExtensionAssetsUrl(ext.iconUrl)" alt="icon" class="w-full h-full object-contain" />
            </div>
            <div class="flex-1 flex flex-grow flex-col gap-1">
              <div class="font-weight-600 text-base line-clamp-1">
                {{ ext.title }}
              </div>

              <div class="max-h-[32px] text-xs text-gray-500 line-clamp-2">{{ ext.subTitle }}</div>
            </div>
            <NcButton size="small" type="secondary" class="flex-none !px-7px" @click.stop="onAddExtension(ext)">
              <div class="flex items-center gap-1 -ml-3px text-small">
                <GeneralIcon icon="plus" />
                {{ $t('general.add') }}
              </div>
            </NcButton>
          </div>
        </template>
        <div
          v-if="searchQuery && !filteredAvailableExtensions.length && availableExtensions.length"
          class="w-full h-full flex items-center justify-center"
        >
          <div class="pb-6 text-gray-500 flex flex-col items-center gap-6 text-center">
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
</template>

<style lang="scss" scoped></style>
