<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { activeWorkflow } = storeToRefs(useWorkflowStore())

const { base, isSharedBase } = storeToRefs(useBase())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())
</script>

<template>
  <div
    class="flex flex-row items-center border-nc-border-gray-extralight transition-all duration-100 select-none"
    :class="{
      'text-base w-[calc(100%_-_52px)]': isMobileMode,
      'w-[calc(100%_-_44px)]': !isMobileMode && !isLeftSidebarOpen,
      'w-full': !isMobileMode && isLeftSidebarOpen,
    }"
  >
    <template v-if="!isMobileMode">
      <SmartsheetTopbarProjectListDropdown>
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-nc-content-gray-subtle font-weight-500 hover:(bg-nc-bg-gray-light text-nc-content-gray-extreme) flex items-center gap-1 cursor-pointer max-w-1/3"
            :class="{
              '!max-w-none': isSharedBase && !isMobileMode,
              '': !isMobileMode && isLeftSidebarOpen,
            }"
          >
            <NcTooltip :disabled="isSharedBase || isOpen">
              <template #title>
                <span class="capitalize">
                  {{ base?.title }}
                </span>
              </template>

              <GeneralProjectIcon :type="base?.type" :color="parseProp(base.meta).iconColor" class="!grayscale min-w-5" />
            </NcTooltip>
            <NcTooltip class="ml-1 truncate nc-active-base-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                <span class="capitalize">
                  {{ base?.title }}
                </span>
              </template>

              <span
                class="text-ellipsis capitalize"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ base?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarProjectListDropdown>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
    </template>
    <template v-if="!isMobileMode">
      <SmartsheetTopbarWorkflowListDropdown v-if="activeWorkflow">
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-nc-content-gray-subtle font-weight-500 hover:(bg-nc-bg-gray-light text-nc-content-gray-extreme) flex items-center gap-1 cursor-pointer"
            :class="{
              'max-w-full': isMobileMode,
              'max-w-1/4': !isSharedBase && !isMobileMode && !activeWorkflow,
              'max-w-none': isSharedBase && !isMobileMode,
            }"
          >
            <LazyGeneralEmojiPicker
              v-if="!isMobileMode"
              :key="activeWorkflow?.meta"
              :emoji="activeWorkflow?.meta?.icon"
              readonly
              size="xsmall"
              class="mr-1"
            >
              <template #default>
                <GeneralIcon
                  icon="ncAutomation"
                  class="min-w-5"
                  :class="{
                    '!text-nc-content-gray-muted': !isMobileMode,
                    '!text-nc-content-gray-subtle': isMobileMode,
                  }"
                />
              </template>
            </LazyGeneralEmojiPicker>

            <NcTooltip class="truncate nc-active-table-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                {{ activeWorkflow?.title }}
              </template>
              <span
                class="text-ellipsis"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ activeWorkflow?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarWorkflowListDropdown>
    </template>
  </div>
</template>
