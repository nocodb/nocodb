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
      $e('c:scripts:marketplace:search')
    }
  },
  { debounce: 3000 },
)

const automationStore = useAutomationStore()

const { showScriptDetails, getScriptAssetsURL } = automationStore

const { availableScripts } = storeToRefs(automationStore)

const { blockAddNewScript } = useEeConfig()

const filteredAvailableScripts = computed(() =>
  (availableScripts.value || []).filter(
    (scr) =>
      scr.title.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()) ||
      scr.subTitle.toLowerCase().includes(searchQuery.value.toLowerCase()?.trim()),
  ),
)

const onScriptClick = (scriptId: string) => {
  showScriptDetails(scriptId)
  isOpen.value = false
}

const onAddScript = (scr: any) => {
  // addExtension(ext)
  isOpen.value = false
}
</script>

<template>
  <div class="h-full py-4 overflow-auto nc-scrollbar-thin">
    <div class="h-full flex flex-col gap-5 flex-1 pt-2 px-6 w-full mx-auto">
      <div class="text-base font-bold text-nc-content-gray">Popular Scripts</div>
      <div v-if="searchQuery" class="text-base text-nc-content-gray-subtle">Search result for ‘{{ searchQuery }}’</div>

      <div
        class="pb-2 grid gap-4"
        :class="{
          'h-full': searchQuery && !filteredAvailableScripts.length && availableScripts.length,
          'grid-cols-1 md:grid-cols-2 xl:grid-cols-3': !(
            searchQuery &&
            !filteredAvailableScripts.length &&
            availableScripts.length
          ),
        }"
      >
        <template v-for="scr of filteredAvailableScripts" :key="scr.id">
          <div
            class="nc-market-scripts-item flex items-center gap-3 border-1 rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-all"
            :data-testid="`nc-script-${scr.id}`"
            @click="onScriptClick(scr.id)"
          >
            <div class="h-[56px] w-[56px] overflow-hidden m-auto flex-none">
              <img :src="getScriptAssetsURL(scr.iconUrl)" alt="icon" class="w-full h-full object-contain" />
            </div>
            <div class="flex-1 flex flex-grow flex-col gap-2">
              <div>
                <div class="text-sm font-bold text-nc-content-gray line-clamp-1">
                  {{ scr.title }}
                </div>
                <div v-if="scr.publisher?.name" class="mt-0.5 text-xs leading-[18px] text-nc-content-gray-muted line-clamp-1">
                  Built by {{ scr.publisher.name }}
                </div>
              </div>

              <div class="max-h-[36px] text-small leading-[18px] text-nc-content-gray-subtle line-clamp-2">
                {{ scr.subTitle }}
              </div>
            </div>
            <NcButton
              v-if="!blockAddNewScript"
              size="small"
              type="secondary"
              class="flex-none !px-7px"
              @click.stop="onAddScript(scr)"
            >
              <div class="flex items-center gap-1 -ml-3px text-small">
                <GeneralIcon icon="plus" />
                {{ $t('general.add') }}
              </div>
            </NcButton>
          </div>
        </template>
        <div
          v-if="searchQuery && !filteredAvailableScripts.length && availableScripts.length"
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
