<script lang="ts" setup>
import type { ViewType } from 'nocodb-sdk'

const { isViewToolbar } = defineProps<{
  isViewToolbar?: boolean
}>()

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

let view: Ref<ViewType | undefined>
if (isViewToolbar) {
  try {
    const store = useSmartsheetStoreOrThrow()
    view = store.view
  } catch (e) {
    console.error(e)
  }
}

const activeTab = ref<'base' | 'view'>('base')

const { formStatus, showShareModal } = storeToRefs(useShare())
const { resetData } = useShare()

const highlightStyle = ref({ top: '4px' })

watch(showShareModal, (val) => {
  if (!val) {
    setTimeout(() => {
      resetData()
    }, 500)
  }
})

const updateHighlightPosition = () => {
  nextTick(() => {
    const activeTab = document.querySelector('.nc-share-active') as HTMLElement
    if (activeTab) {
      highlightStyle.value.top = `${activeTab.offsetTop}px`
    }
  })
}

watch(activeTab, () => {
  updateHighlightPosition()
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
    :width="formStatus === 'manageCollaborators' ? '60rem' : '48rem'"
    height="28rem"
  >
    <div class="flex flex-col gap-6 p-6">
      <div class="flex text-2xl font-bold">{{ $t('activity.share') }}</div>
      <div class="flex flex-1 gap-3">
        <div v-if="isViewToolbar" class="flex relative flex-col flex-grow-1 cursor-pointer p-1 w-32 rounded-lg h-80 bg-gray-200">
          <div :style="highlightStyle" class="highlight"></div>

          <div
            data-testid="nc-share-base-tab"
            :class="{ 'nc-share-active': activeTab === 'base' }"
            class="flex flex-col z-1 text-gray-600 font-semibold items-center rounded-lg w-full justify-center h-1/2"
            @click="activeTab = 'base'"
          >
            <GeneralProjectIcon
              :color="parseProp(base.meta).iconColor"
              :type="base.type"
              class="nc-view-icon w-6 h-6 group-hover"
            />
            Base
          </div>
          <div
            :class="{ 'nc-share-active': activeTab === 'view' }"
            data-testid="nc-share-view-tab"
            class="flex flex-col items-center text-gray-600 font-semibold z-1 w-full cursor-pointer rounded-lg justify-center h-1/2"
            @click="activeTab = 'view'"
          >
            <component
              :is="viewIcons[view?.type]?.icon"
              :class="{
                'text-gray-500': activeTab !== 'view',
              }"
              :style="{ color: activeTab === 'view' ? viewIcons[view?.type]?.color : '' }"
              class="nc-view-icon !text-2xl group-hover"
            />
            View
          </div>
        </div>
        <div class="flex flex-1 h-full flex-col">
          <LazyDlgShareAndCollaborateShareBase v-if="activeTab === 'base'" />
          <LazyDlgShareAndCollaborateSharePage v-else-if="activeTab === 'view'" />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.nc-share-active {
  @apply bg-transparent !text-gray-900;
}

.highlight {
  @apply absolute h-[calc(50%-4px)] w-[calc(8rem-8px)] shadow bg-white rounded-lg transition-all duration-300;
  z-index: 0;
}

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
