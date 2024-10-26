<script lang="ts" setup>
import { WorkspaceIconType } from '#imports'

interface Props {
  icon: string
  iconType: WorkspaceIconType | string
  currentWorkspace: any
}

const props = withDefaults(defineProps<Props>(), {})

const { currentWorkspace } = toRefs(props)

const emits = defineEmits(['update:icon', 'update:iconType'])

const vIcon = useVModel(props, 'icon', emits)

const vIconType = useVModel(props, 'iconType', emits)

const isOpen = ref<boolean>(false)

const isLoading = ref<boolean>(false)

const inputRef = ref<HTMLInputElement>()

const searchQuery = ref<string>('')

const activeTabLocal = ref<WorkspaceIconType>(WorkspaceIconType.UPLOAD)

const activeTab = computed({
  get: () => activeTabLocal.value,
  set: (value: WorkspaceIconType) => {
    searchQuery.value = ''

    activeTabLocal.value = value

    if (value === WorkspaceIconType.ICON) {
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
})

const icons = computed(() => {
  return searchIcons(searchQuery.value)
})

const selectIcon = (icon: string) => {
  vIcon.value = icon
  vIconType.value = WorkspaceIconType.ICON

  isOpen.value = false
}

const handleRemoveIcon = () => {
  vIcon.value = ''
  vIconType.value = ''

  isOpen.value = false
}

watch(isOpen, (newValue) => {
  if (newValue) {
    activeTab.value = WorkspaceIconType.UPLOAD
  }
})
</script>

<template>
  <div>
    <NcDropdown v-model:visible="isOpen" overlay-class-name="w-[448px]">
      <div
        class="mt-2 rounded-lg border-1 flex-none w-16 h-16 overflow-hidden transition-all duration-300 cursor-pointer"
        :class="{
          'border-transparent': !isOpen,
          'border-primary shadow-selected': isOpen,
        }"
      >
        <GeneralWorkspaceIcon
          :workspace="currentWorkspace"
          size="xlarge"
          class="!w-full !h-full !min-w-full rounded-none select-none"
        />
      </div>
      <template #overlay>
        <div class="pt-2">
          <NcTabs v-model:activeKey="activeTab" theme="ai" class="nc-workspace-icon-dropdown-tabs">
            <template #leftExtra>
              <div class="w-0"></div>
            </template>
            <template #rightExtra>
              <div>
                <NcButton size="xs" type="text" @click.stop="handleRemoveIcon"> Remove </NcButton>
              </div>
            </template>
            <a-tab-pane :key="WorkspaceIconType.UPLOAD" class="w-full" :disabled="isLoading">
              <template #tab>
                <div
                  class="tab-title"
                  :class="{
                    '!cursor-wait': isLoading,
                  }"
                >
                  <GeneralIcon icon="ncUpload" class="flex-none" />
                  Upload Icon
                </div>
              </template>
              <div class="p-2">upload</div>
            </a-tab-pane>

            <a-tab-pane :key="WorkspaceIconType.ICON" class="w-full" :disabled="isLoading">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="ncPlaceholderIcon" class="flex-none" />
                  Icon
                </div>
              </template>
              <div class="">
                <div class="h-[244px] overflow-auto nc-scrollbar-thin flex flex-col">
                  <div class="!sticky top-0 flex gap-2 bg-white px-2 py-2">
                    <a-input
                      ref="inputRef"
                      v-model:value="searchQuery"
                      :placeholder="$t('placeholder.searchIcons')"
                      class="nc-dropdown-search-unified-input z-10"
                    >
                      <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
                    ></a-input>
                  </div>

                  <div v-if="icons.length" class="grid px-3 auto-rows-max pb-2 gap-3 grid-cols-10">
                    <component
                      :is="icon"
                      v-for="({ icon, name }, i) in icons"
                      :key="i"
                      :icon="icon"
                      class="w-6 hover:bg-gray-100 cursor-pointer rounded p-1 text-gray-700 h-6"
                      @click="selectIcon(name)"
                    />
                  </div>
                  <div v-else class="flex-1 grid place-items-center">
                    <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
                  </div>
                </div>
              </div>
            </a-tab-pane>
          </NcTabs>
        </div>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-icon-dropdown-tabs {
  :deep(.ant-tabs-nav) {
    @apply px-3;

    .ant-tabs-extra-content {
      @apply self-start;
    }

    .ant-tabs-tab {
      @apply px-0 pt-1 pb-2;

      &.ant-tabs-tab-active {
        @apply font-medium;
      }

      & + .ant-tabs-tab {
        @apply ml-4;
      }

      .tab-title {
        @apply text-xs leading-[24px] px-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-2;
      }
    }
  }

  &.nc-ai-loading {
    :deep(.ant-tabs-tab) {
      @apply !cursor-wait;
    }
  }

  :deep(.ant-tabs-tab-disabled) {
    .tab-title {
      @apply text-nc-content-gray-muted hover:bg-transparent;
    }
  }
}
</style>
