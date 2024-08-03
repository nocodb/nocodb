<script lang="ts" setup>
import type { SyncDataType } from '../../lib/enums'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['update:open'])
const vOpen = useVModel(props, 'open', emit)

const { syncDataUpvotes, updateSyncDataUpvotes } = useGlobal()

const { $e } = useNuxtApp()

const searchQuery = ref('')

const filteredSyncDataTypes = computed(() =>
  syncDataTypes.filter((s) => s.title.toLowerCase().includes(searchQuery.value.toLowerCase())),
)

const upvotesData = computed(() => {
  return new Set(syncDataUpvotes.value)
})

const handleUpvote = (syncDataType: SyncDataType) => {
  if (upvotesData.value.has(syncDataType)) return

  $e('a:sync:request', {
    value: syncDataType,
  })

  updateSyncDataUpvotes([...syncDataUpvotes.value, syncDataType])
}
</script>

<template>
  <NcModal
    v-model:visible="vOpen"
    centered
    size="large"
    wrap-class-name="nc-project-sync-data-modal-wrapper"
    nc-modal-class-name="!p-0 h-80vh max-h-[864px]"
    @keydown.esc="vOpen = false"
  >
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex items-center justify-between gap-4 p-4 border-b-1 border-gray-200">
        <GeneralIcon icon="refresh" class="flex-none h-5 w-5 !text-blue-700" />
        <div class="flex-1">
          <div class="flex-1 flex items-center gap-3">
            <h3 class="my-0 capitalize text-base font-weight-700">
              {{ $t('labels.syncData') }}
            </h3>

            <NcBadge :border="false" class="text-brand-500 !h-5.5 bg-brand-50 text-sm px-2">{{
              $t('msg.toast.futureRelease')
            }}</NcBadge>
          </div>
          <div class="text-xs text-gray-600">{{ $t('labels.syncDataModalSubtitle') }}</div>
        </div>
        <NcButton type="text" size="xs" class="!px-0" @click="vOpen = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
      <div class="p-6">
        <div class="flex items-center justify-end gap-3 max-w-[918px] mx-auto">
          <a-input
            v-model:value="searchQuery"
            type="text"
            class="nc-search-sync-data-input !min-w-[300px] !max-w-[300px] nc-input-sm flex-none"
            placeholder="Search service"
            allow-clear
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
            </template>
          </a-input>
        </div>
      </div>
      <div class="flex-1 px-6 flex overflow-auto nc-scrollbar-thin">
        <div
          class="flex flex-col gap-6 w-full max-w-[918px] mx-auto"
          :class="{
            'flex-1': !filteredSyncDataTypes.length,
          }"
        >
          <div v-if="filteredSyncDataTypes.length" class="flex items-start gap-3 flex-wrap pb-6">
            <div v-for="syncData of filteredSyncDataTypes" :key="syncData.value" class="nc-sync-data-card">
              <div class="card-icon-wrapper">
                <component :is="syncData.icon" class="flex-none stroke-transparent" />
              </div>
              <div class="card-title flex-1">
                {{ $t(syncData.title) }}
              </div>
              <div>
                <NcButton
                  type="secondary"
                  size="xsmall"
                  class="nc-sync-data-upvote-btn !rounded-lg !px-2"
                  :class="{
                    selected: upvotesData.has(syncData.value),
                  }"
                  @click="handleUpvote(syncData.value)"
                >
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="thumbsUpOutline" />
                  </div>
                </NcButton>
              </div>
            </div>
          </div>
          <div v-else class="pt-8 flex-1 flex items-center justify-center">
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-project-sync-data-modal-wrapper {
  .nc-modal {
    @apply !p-0;
    height: min(90vh, 1024px);
    max-height: min(90vh, 1024px) !important;
  }

  .nc-sync-data-title {
    @apply text-xl font-semibold;
  }

  .ant-input-affix-wrapper.nc-search-sync-data-input {
    &:not(:has(.ant-input-clear-icon-hidden)):has(.ant-input-clear-icon) {
      @apply border-[var(--ant-primary-5)];
    }
  }
  .nc-sync-data-card {
    @apply p-3 flex items-center gap-4 rounded-xl border-1 border-gray-200 w-[298px] h-[76px];

    .card-icon-wrapper {
      @apply w-[52px] h-[52px] p-1 flex items-center justify-center bg-gray-100 rounded-lg;

      .card-icon {
      }
    }

    .card-title {
      @apply text-base font-weight-700 text-gray-800;
    }

    .nc-sync-data-upvote-btn {
      &.selected {
        @apply shadow-selected !text-brand-500 !border-brand-500 !cursor-not-allowed pointer-events-none;
      }
    }
  }
}
</style>
