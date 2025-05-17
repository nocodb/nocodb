<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { activeAutomation } = storeToRefs(useAutomationStore())

const { base, isSharedBase } = storeToRefs(useBase())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())
</script>

<template>
  <div
    class="flex flex-row items-center border-gray-50 transition-all duration-100 select-none"
    :class="{
      'text-base w-[calc(100%_-_52px)]': isMobileMode,
      'w-[calc(100%_-_44px)]': !isMobileMode && !isLeftSidebarOpen,
      'w-full': !isMobileMode && isLeftSidebarOpen,
    }"
  >
    <template v-if="!isMobileMode">
      <SmartsheetTopbarProjectListDropdown is-automation>
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-700 font-weight-500 hover:(bg-gray-100 text-gray-900) flex items-center gap-1 cursor-pointer max-w-1/3"
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
      <SmartsheetTopbarAutomationListDropdown v-if="activeAutomation">
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-700 font-weight-500 hover:(bg-gray-100 text-gray-900) flex items-center gap-1 cursor-pointer"
            :class="{
              'max-w-full': isMobileMode,
              'max-w-1/4': !isSharedBase && !isMobileMode && !activeAutomation,
              'max-w-none': isSharedBase && !isMobileMode,
            }"
          >
            <LazyGeneralEmojiPicker v-if="!isMobileMode" readonly size="xsmall" class="mr-1">
              <template #default>
                <GeneralIcon
                  icon="ncScript"
                  class="min-w-5"
                  :class="{
                    '!text-gray-500': !isMobileMode,
                    '!text-gray-700': isMobileMode,
                  }"
                />
              </template>
            </LazyGeneralEmojiPicker>

            <NcTooltip class="truncate nc-active-table-title max-w-full !leading-5" show-on-truncate-only :disabled="isOpen">
              <template #title>
                {{ activeAutomation?.title }}
              </template>
              <span
                class="text-ellipsis"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ activeAutomation?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarAutomationListDropdown>
    </template>
  </div>
</template>
