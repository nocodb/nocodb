<script setup lang="ts">
const props = defineProps<{ isEmpty: boolean }>()

const { isEmpty } = toRefs(props)

const search = defineModel<string>('search', { default: '' })

const showSearch = ref(false)
const searchInput = ref<any>()

const isSearchVisible = computed(() => !!search.value || showSearch.value)

function open() {
  showSearch.value = true
  nextTick(() => searchInput.value?.focus?.())
}

function onBlur() {
  if (!search.value) showSearch.value = false
}
</script>

<template>
  <div class="nc-bookmark-header">
    <span class="nc-bookmark-title">{{ $t('title.bookmarks') }}</span>
    <span class="grow" />

    <template v-if="!isEmpty">
      <a-input
        v-if="isSearchVisible"
        ref="searchInput"
        v-model:value="search"
        :placeholder="$t('general.search')"
        class="!rounded-lg !w-44 nc-bookmark-search"
        allow-clear
        data-testid="nc-bookmark-flyout-search"
        @blur="onBlur"
        @keydown.escape="onBlur"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="text-nc-content-gray-muted mr-1" />
        </template>
      </a-input>
      <NcButton v-else type="text" size="small" class="!rounded-md" @click="open">
        <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
      </NcButton>
    </template>

    <BookmarksAddBookmarkDropdown />

    <BookmarksSettingsMenu />
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-header {
  @apply flex items-center gap-2 px-3 py-2.5 border-b-1 border-nc-border-gray-medium flex-none;
}
.nc-bookmark-title {
  @apply text-bodyBold text-nc-content-gray pl-1;
}
.grow {
  flex: 1;
}
.nc-bookmark-search :deep(.ant-input) {
  font-size: 13px;
}
</style>
