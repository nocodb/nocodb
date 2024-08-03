<script lang="ts" setup>
import type { SyncDataType } from '../../lib/enums'
import { SyncDataType as SyncDataTypeEnum } from '../../lib/enums'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['update:open'])
const vOpen = useVModel(props, 'open', emit)

const upVoteCountBySyncDataTypeMap = computed(() => {
  return Object.values(SyncDataTypeEnum).reduce((acc, curr) => {
    // Todo: update this with api response count with formating like if count is less than 1000 show as it is or 1k+ an so on
    acc[curr] = null
    return acc
  }, {} as Record<SyncDataType, string | null>)
})
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
    <div class="h-full flex flex-col">
      <div class="flex items-center justify-between gap-4 p-4 border-b-1 border-gray-200">
        <GeneralIcon icon="refresh" class="flex-none h-8 w-8 !text-blue-700" />
        <div class="flex-1 flex items-center gap-3">
          <h3 class="my-0 capitalize text-gray-800 text-2xl font-bold">
            {{ $t('labels.syncData') }}
          </h3>

          <NcBadge :border="false" class="text-brand-500 !h-7 bg-brand-50 text-sm px-2 font-weight-500">{{
            $t('title.comingSoon')
          }}</NcBadge>
        </div>
        <NcButton type="secondary" size="xs" class="!px-0" @click="vOpen = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
      <div class="flex-1 p-6 overflow-auto nc-scrollbar-thin">
        <div class="flex flex-col gap-6 w-full max-w-[918px] mx-auto">
          <div class="flex flex-col gap-3">
            <div class="nc-sync-data-title">
              {{ $t('labels.syncDataModalTitle') }}
            </div>
            <div class="nc-sync-data-subtitle">
              {{ $t('labels.syncDataModalSubtitle') }}
            </div>
          </div>
          <div class="flex items-start gap-3 flex-wrap">
            <div v-for="syncData of syncDataTypes" class="nc-sync-data-card" :key="syncData.value">
              <div class="card-icon-wrapper">
                <component :is="syncData.icon" class="card-icon h-8 w-8" />
              </div>
              <div class="card-title flex-1">
                {{ $t(syncData.title) }}
              </div>
              <div>
                <NcButton type="secondary" size="xsmall" class="!rounded-lg !px-2">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="thumbsUpOutline" />
                    <span v-if="upVoteCountBySyncDataTypeMap[syncData.value]">{{ upVoteCountBySyncDataTypeMap[syncData.value] }}</span>
                  </div>
                </NcButton>
              </div>
            </div>
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
  .nc-sync-data-subtitle {
    @apply text-sm font-normal text-gray-600;
  }

  .nc-sync-data-card {
    @apply p-3 flex items-center gap-4 rounded-xl border-1 border-gray-200 w-[298px] h-[76px] cursor-pointer;

    &:hover {
      @apply bg-gray-50;
      box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
      .card-icon-wrapper {
        @apply bg-gray-200;
      }
    }

    .card-icon-wrapper {
      @apply w-[52px] h-[52px] p-2.5 flex items-center justify-center bg-gray-100 rounded-lg;

      .card-icon {
      }
    }

    .card-title {
      @apply text-base font-weight-700 text-gray-800;
    }
  }
}
</style>
