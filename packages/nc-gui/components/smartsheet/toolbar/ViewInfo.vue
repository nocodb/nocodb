<script setup lang="ts">
import { ViewLockType } from 'nocodb-sdk'

const { t } = useI18n()

const { isMobileMode, user } = useGlobal()

const { activeView, openedViewsTab } = storeToRefs(useViewsStore())

const { basesUser } = storeToRefs(useBases())
const { base, isSharedBase } = storeToRefs(useBase())

const { activeTable } = storeToRefs(useTablesStore())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const isViewOwner = computed(() => {
  return activeView.value?.owned_by === user.value?.id
})

const idUserMap = computed(() => {
  return (basesUser.value.get(base.value?.id) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, any>)
})

const viewModeInfo = computed(() => {
  switch (activeView.value?.lock_type) {
    case ViewLockType.Collaborative:
      return t(viewLockIcons[ViewLockType.Collaborative]?.title)
    case ViewLockType.Personal:
      return `${t(viewLockIcons[ViewLockType.Personal]?.title)} ${
        isViewOwner.value
          ? `(${t('general.you')})`
          : activeView.value?.owned_by && idUserMap.value[activeView.value.owned_by]
          ? `(${idUserMap.value[activeView.value.owned_by]?.display_name || idUserMap.value[activeView.value.owned_by]?.email})`
          : ''
      }`
    case ViewLockType.Locked:
      if (!activeView.value?.meta?.lockedByUserId || idUserMap.value[activeView.value?.meta?.lockedByUserId]) {
        return t(viewLockIcons[ViewLockType.Locked]?.title)
      }

      return t('title.lockedByUser', {
        user:
          idUserMap.value[activeView.value?.meta?.lockedByUserId]?.id === user.value?.id
            ? t('general.you')
            : idUserMap.value[activeView.value?.meta?.lockedByUserId]?.display_name ||
              idUserMap.value[activeView.value?.meta?.lockedByUserId]?.email,
      })

    default:
      return t(viewLockIcons[ViewLockType.Collaborative]?.title)
  }
})
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
      <SmartsheetTopbarProjectListDropdown v-if="activeTable">
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

              <GeneralProjectIcon :type="base?.type" :color="parseProp(base.meta).iconColor" class="!grayscale min-w-4" />
            </NcTooltip>
            <template v-if="isSharedBase">
              <NcTooltip
                class="ml-1 truncate nc-active-base-title max-w-full !leading-5"
                show-on-truncate-only
                :disabled="isOpen"
              >
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
            </template>
          </div>
        </template>
      </SmartsheetTopbarProjectListDropdown>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
    </template>
    <template v-if="!(isMobileMode && !activeView?.is_default)">
      <SmartsheetTopbarTableListDropdown v-if="activeTable">
        <template #default="{ isOpen }">
          <div
            class="rounded-lg h-8 px-2 text-gray-700 font-weight-500 hover:(bg-gray-100 text-gray-900) flex items-center gap-1 cursor-pointer"
            :class="{
              'max-w-full': isMobileMode,
              'max-w-1/2': activeView?.is_default,
              'max-w-1/4': !isSharedBase && !isMobileMode && !activeView?.is_default,
              'max-w-none': isSharedBase && !isMobileMode,
            }"
          >
            <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeTable?.meta?.icon" readonly size="xsmall" class="mr-1">
              <template #default>
                <GeneralIcon
                  icon="table"
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
                {{ activeTable?.title }}
              </template>
              <span
                class="text-ellipsis"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ activeTable?.title }}
              </span>
            </NcTooltip>
            <GeneralIcon
              icon="chevronDown"
              class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
              :class="{ '!rotate-180': isOpen }"
            />
          </div>
        </template>
      </SmartsheetTopbarTableListDropdown>
    </template>

    <GeneralIcon v-if="!isMobileMode" icon="ncSlash1" class="nc-breadcrumb-divider" />

    <template v-if="!(isMobileMode && activeView?.is_default)">
      <!-- <SmartsheetToolbarOpenedViewAction /> -->

      <SmartsheetTopbarViewListDropdown>
        <template #default="{ isOpen }">
          <NcTooltip
            :tooltip-style="{ width: '240px', zIndex: '1049' }"
            :overlay-inner-style="{ width: '240px' }"
            trigger="hover"
            placement="bottom"
            class="flex"
            :disabled="isOpen"
            :class="{
              'max-w-full': isMobileMode,
              'max-w-2/5': !isSharedBase && !isMobileMode && activeView?.is_default,
              'max-w-1/2': !isSharedBase && !isMobileMode && !activeView?.is_default,
              'max-w-none': isSharedBase && !isMobileMode,
            }"
          >
            <template #title>
              <div class="flex flex-col gap-3">
                <div>
                  <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.viewName') }}</div>
                  <div class="text-small leading-[18px]">
                    {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
                  </div>
                </div>

                <div v-if="activeView?.created_by && idUserMap[activeView?.created_by]">
                  <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.createdBy') }}</div>
                  <div class="text-xs">
                    {{
                      idUserMap[activeView?.created_by]?.id === user?.id
                        ? $t('general.you')
                        : idUserMap[activeView?.created_by]?.display_name || idUserMap[activeView?.created_by]?.email
                    }}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] leading-[14px] text-gray-300 uppercase mb-1">{{ $t('labels.viewMode') }}</div>
                  <div class="text-xs flex items-start gap-2">
                    {{ viewModeInfo }}
                  </div>
                </div>
              </div>
            </template>
            <div
              class="rounded-lg h-8 px-2 text-gray-800 font-semibold hover:(bg-gray-100 text-gray-900) flex items-center gap-1 cursor-pointer"
              :class="{
                'max-w-full': !isSharedBase || isMobileMode,
                'max-w-none': isSharedBase && !isMobileMode,
              }"
            >
              <LazyGeneralEmojiPicker v-if="isMobileMode" :emoji="activeView?.meta?.icon" readonly size="xsmall" class="mr-1">
                <template #default>
                  <GeneralViewIcon :meta="{ type: activeView?.type }" class="min-w-4.5 text-lg flex" />
                </template>
              </LazyGeneralEmojiPicker>

              <NcTooltip class="truncate nc-active-view-title max-w-full !leading-5" show-on-truncate-only disabled>
                <template #title>
                  {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
                </template>
                <span
                  class="text-ellipsis"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ activeView?.is_default ? $t('title.defaultView') : activeView?.title }}
                </span>
              </NcTooltip>

              <component
                :is="viewLockIcons[activeView.lock_type].icon"
                v-if="[ViewLockType.Locked, ViewLockType.Personal].includes(activeView?.lock_type)"
                class="flex-none w-3.5 h-3.5 mx-0.5"
                :class="{
                  'text-brand-400': activeView?.lock_type === ViewLockType.Personal && isViewOwner,
                  'text-gray-400': !(activeView?.lock_type === ViewLockType.Personal && isViewOwner),
                }"
              />

              <GeneralIcon
                icon="chevronDown"
                class="!text-current opacity-70 flex-none transform transition-transform duration-25 w-3.5 h-3.5"
                :class="{ '!rotate-180': isOpen }"
              />
            </div>
          </NcTooltip>
        </template>
      </SmartsheetTopbarViewListDropdown>

      <LazySmartsheetToolbarReload v-if="openedViewsTab === 'view' && !isMobileMode" />
    </template>
  </div>
</template>
