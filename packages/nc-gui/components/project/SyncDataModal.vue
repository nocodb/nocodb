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
    <div class="h-full flex flex-col overflow-hidden">
      <div class="flex items-center justify-between gap-4 p-4 border-b-1 border-gray-200">
        <GeneralIcon icon="refresh" class="flex-none h-6 w-6 !text-blue-700" />
        <div class="flex-1 flex items-center gap-3">
          <h3 class="my-0 capitalize text-base font-weight-700">
            {{ $t('labels.syncData') }}
          </h3>

          <NcBadge :border="false" class="text-brand-500 !h-6 bg-brand-50 text-sm px-2">{{
            $t('msg.toast.futureRelease')
          }}</NcBadge>
        </div>
        <NcButton type="text" size="xs" class="!px-0" @click="vOpen = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
      <div class="flex-1 p-6 overflow-auto nc-scrollbar-thin">
        <div class="flex flex-col gap-6 w-full max-w-[918px] mx-auto">
          <div class="flex flex-col gap-3">
            <div class="nc-sync-data-subtitle">
              {{ $t('labels.syncDataModalSubtitle') }}
            </div>
          </div>
          <div class="flex items-start gap-3 flex-wrap">
            <div v-for="syncData of syncDataTypes" :key="syncData.value" class="nc-sync-data-card">
              <div class="card-icon-wrapper">
                <component :is="syncData.icon" class="flex-none stroke-transparent" />
              </div>
              <div class="card-title flex-1">
                {{ $t(syncData.title) }}
              </div>
              <div>
                <NcButton type="secondary" size="xsmall" class="!rounded-lg !px-2">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="thumbsUpOutline" />
                    <span v-if="upVoteCountBySyncDataTypeMap[syncData.value]">{{
                      upVoteCountBySyncDataTypeMap[syncData.value]
                    }}</span>
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

    .card-icon-wrapper {
      @apply w-[52px] h-[52px] p-1 flex items-center justify-center bg-gray-100 rounded-lg;

      .card-icon {
      }
    }

    .card-title {
      @apply text-base font-weight-700 text-gray-800;
    }
  }
}
</style>
