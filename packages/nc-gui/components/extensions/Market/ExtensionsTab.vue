<script lang="ts" setup>
interface Props {
  searchQuery: string
  isOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:searchQuery', 'update:isOpen'])

const { $e } = useNuxtApp()

const searchQuery = useVModel(props, 'searchQuery', emits)

const isOpen = useVModel(props, 'isOpen', emits)

watchDebounced(
  searchQuery,
  () => {
    if (searchQuery.value) {
      $e('c:extensions:marketplace:search')
    }
  },
  { debounce: 3000 },
)

const { availableExtensions, addExtension, getExtensionAssetsUrl, showExtensionDetails } = useExtensions()

const filteredAvailableExtensions = computed(() =>
  (availableExtensions.value || []).filter(
    (ext) =>
      ext.title.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()) ||
      ext.subTitle.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()),
  ),
)

const onExtensionClick = (extensionId: string) => {
  showExtensionDetails(extensionId, 'market')
  isOpen.value = false
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  isOpen.value = false
}
</script>

<template>
  <div class="h-full py-4 overflow-auto nc-scrollbar-thin">
    <div class="h-full flex flex-col gap-5 flex-1 pt-2 px-6 w-full mx-auto">
      <div class="text-base font-bold text-nc-content-gray">Popular Extensions</div>
      <div v-if="searchQuery" class="text-base text-nc-content-gray-subtle">Search result for ‘{{ searchQuery }}’</div>

      <div
        class="pb-2 grid gap-4"
        :class="{
          'h-full': searchQuery && !filteredAvailableExtensions.length && availableExtensions.length,
          'grid-cols-1 md:grid-cols-2 xl:grid-cols-3': !(
            searchQuery &&
            !filteredAvailableExtensions.length &&
            availableExtensions.length
          ),
        }"
      >
        <template v-for="ext of filteredAvailableExtensions" :key="ext.id">
          <div
            class="nc-market-extension-item flex items-center gap-3 border-1 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-all"
            :data-testid="`nc-extension-${ext.id}`"
            @click="onExtensionClick(ext.id)"
          >
            <div class="h-[56px] w-[56px] overflow-hidden m-auto flex-none">
              <img :src="getExtensionAssetsUrl(ext.iconUrl)" alt="icon" class="w-full h-full object-contain" />
            </div>
            <div class="flex-1 flex flex-grow flex-col gap-2">
              <div>
                <div class="text-sm font-bold text-nc-content-gray line-clamp-1">
                  {{ ext.title }}
                </div>
                <div v-if="ext.publisher?.name" class="mt-0.5 text-xs leading-[18px] text-nc-content-gray-muted line-clamp-1">
                  Built by {{ ext.publisher.name }}
                </div>
              </div>

              <div class="max-h-[36px] text-small leading-[18px] text-nc-content-gray-subtle line-clamp-2">
                {{ ext.subTitle }}
              </div>
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
