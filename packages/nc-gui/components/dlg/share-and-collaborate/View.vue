<script lang="ts" setup>
import { ViewLockType, type ViewType } from 'nocodb-sdk'
import { useViewsStore } from '~/store/views'

const { isViewToolbar } = defineProps<{
  isViewToolbar?: boolean
}>()

const isLocked = inject(IsLockedInj, ref(false))

const baseStore = useBase()
const { base } = storeToRefs(baseStore)
const { navigateToProjectPage } = baseStore
const { activeView } = storeToRefs(useViewsStore())

let view: Ref<ViewType | undefined>
if (isViewToolbar) {
  try {
    const store = useSmartsheetStoreOrThrow()
    view = store.view
  } catch (e) {
    console.error(e)
  }
}

const { formStatus, showShareModal } = storeToRefs(useShare())
const { resetData } = useShare()

const isOpeningManageAccess = ref(false)

const openManageAccess = async () => {
  isOpeningManageAccess.value = true
  try {
    await navigateToProjectPage({ page: 'collaborator' })
    showShareModal.value = false
  } catch (e) {
    console.error(e)
    message.error('Failed to open manage access')
  } finally {
    isOpeningManageAccess.value = false
  }
}

watch(showShareModal, (val) => {
  if (!val) {
    setTimeout(() => {
      resetData()
    }, 500)
  }
})
</script>

<template>
  <a-modal
    v-model:visible="showShareModal"
    class="!top-[1%]"
    :class="{ active: showShareModal }"
    wrap-class-name="nc-modal-share-collaborate"
    :closable="false"
    :mask-closable="formStatus !== 'base-collaborateSaving'"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :width="formStatus === 'manageCollaborators' ? '60rem' : '40rem'"
  >
    <div class="flex flex-col px-1">
      <div class="flex flex-row justify-between items-center pb-1 mx-4 mt-3">
        <div class="flex text-base font-medium">{{ $t('activity.share') }}</div>
      </div>
      <div v-if="isViewToolbar && activeView" class="share-view">
        <div class="flex flex-row items-center gap-x-2 px-4 pt-3 pb-3 select-none">
          <component
            :is="viewIcons[view?.type]?.icon"
            class="nc-view-icon group-hover"
            :style="{ color: viewIcons[view?.type]?.color }"
          />
          <div>{{ $t('activity.shareView') }}</div>
          <div
            class="max-w-79/100 ml-2 px-2 py-0.5 rounded-md bg-gray-100 capitalize text-ellipsis overflow-hidden"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
          >
            <span v-if="activeView.is_default">{{ $t('labels.defaultView') }}</span>
            <span v-else>
              {{ activeView.title }}
            </span>
          </div>
        </div>
        <div v-if="isLocked" class="flex items-center gap-x-2 px-4 text-nc-content-gray-muted">
          <component
            :is="viewLockIcons[view.lock_type].icon"
            v-if="view?.lock_type"
            class="flex-none"
            :class="{
              'w-4 h-4': view?.lock_type === ViewLockType.Locked,
              'w-3.5 h-3.5': view?.lock_type !== ViewLockType.Locked,
            }"
          />

          <div class="flex-1">
            {{
              $t('title.viewSettingsCantBeChangedWhenViewIs', {
                type: $t(viewLockIcons[activeView?.lock_type]?.title).toLowerCase(),
              })
            }}
          </div>
        </div>

        <DlgShareAndCollaborateSharePage />
      </div>
      <div class="share-base">
        <div class="flex flex-row items-center gap-x-2 px-4 pt-3 pb-3 select-none">
          <GeneralProjectIcon :color="parseProp(base.meta).iconColor" :type="base.type" class="nc-view-icon group-hover" />

          <div>{{ $t('activity.shareBase.label') }}</div>
          <div
            class="max-w-79/100 ml-2 px-2 py-0.5 rounded-md bg-gray-100 capitalize text-ellipsis overflow-hidden"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
          >
            {{ base.title }}
          </div>
        </div>
        <LazyDlgShareAndCollaborateShareBase />
      </div>
      <div class="flex flex-row justify-end mx-3 mt-1 mb-2 pt-4 gap-x-2">
        <NcButton type="secondary" data-testid="docs-cancel-btn" @click="showShareModal = false">
          {{ $t('general.close') }}
        </NcButton>
        <NcButton
          data-testid="docs-share-manage-access"
          type="secondary"
          :loading="isOpeningManageAccess"
          @click="openManageAccess"
          >{{ $t('activity.manageProjectAccess') }}
        </NcButton>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.share-collapse-item {
  @apply !rounded-lg !mb-2 !mt-4 !border-0;
}

.ant-collapse {
  @apply !bg-white !border-0;
}
</style>

<style lang="scss">
.nc-modal-share-collaborate {
  .ant-modal {
    top: 10vh !important;
  }

  .share-view,
  .share-base {
    @apply !border-1 border-gray-200 mx-3 rounded-lg mt-3 px-1 py-1;
  }

  .ant-collapse-item {
    @apply !border-1 border-gray-100;
  }

  .ant-collapse-content {
    @apply !border-t-0;
  }

  .ant-collapse-content-box {
    @apply !p-0;
  }

  .ant-modal-content {
    @apply !rounded-lg !px-1 !py-2;
  }

  .ant-select-selector {
    @apply !rounded-md !border-gray-200 !border-1;
  }

  .ant-form-item {
    @apply !my-0;
  }

  .ant-form-item-explain {
    @apply !ml-3;
  }

  .ant-select {
    @apply !p-0.5;
  }

  .ant-select-selector {
    @apply !bg-white;
  }
}
</style>
