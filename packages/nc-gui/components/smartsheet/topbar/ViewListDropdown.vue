<script lang="ts" setup>
import { ViewTypes, type ViewType } from 'nocodb-sdk'

const { base } = storeToRefs(useBase())

const { activeTable } = storeToRefs(useTablesStore())

const viewsStore = useViewsStore()
const { activeView, views } = storeToRefs(viewsStore)

const isOpen = ref<boolean>(false)

/**
 * Handles navigation to a selected view.
 * 
 * @param {ViewType} view - The view to navigate to.
 * @returns {Promise<void>}
 * 
 * @description
 * This function is called when a user selects a view from the dropdown list.
 * It checks if the view has a valid ID and then navigates to the selected view.
 * If the view is a form and it's already active, it performs a hard reload.
 */
const handleNavigateToView = async (view: ViewType) => {
  if (!view?.id) return
  
  await viewsStore.navigateToView({
    view,
    tableId: activeTable.value.id!,
    baseId: base.value.id!,
    hardReload: view.type === ViewTypes.FORM && activeView.value?.id === view.id,
    doNotSwitchTab: true,
  })
}
</script>

<template>
  <NcDropdown v-if="activeView" v-model:visible="isOpen">
    <slot name="default" :isOpen="isOpen"></slot>
    <template #overlay>
      <NcList
        v-model:open="isOpen"
        :value="activeView.id"
        @change="handleNavigateToView"
        :list="views"
        option-value-key="id"
        option-label-key="title"
        search-input-placeholder="Search views"
      >
        <template #listItem="{ option }">
          <div>
            <LazyGeneralEmojiPicker :emoji="option?.meta?.icon" readonly size="xsmall">
              <template #default>
                <GeneralViewIcon :meta="{ type: option?.type }" class="min-w-4 text-lg flex" />
              </template>
            </LazyGeneralEmojiPicker>
          </div>
          <NcTooltip class="truncate flex-1" show-on-truncate-only>
            <template #title>
              {{ option?.is_default ? $t('title.defaultView') : option?.title }}
            </template>
            {{ option?.is_default ? $t('title.defaultView') : option?.title }}
          </NcTooltip>
          <GeneralIcon
            v-if="option.id === activeView.id"
            id="nc-selected-item-icon"
            icon="check"
            class="flex-none text-primary w-4 h-4"
          />
        </template>
      </NcList>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scopped></style>
